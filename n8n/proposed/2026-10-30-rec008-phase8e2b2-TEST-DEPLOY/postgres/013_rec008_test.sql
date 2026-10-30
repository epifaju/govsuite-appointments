-- REC-008 phase 8B. Migration préparée, non exécutée.
-- Additive : nouvelle table et fonctions. Aucune table existante n'est modifiée.
-- Ne pas stocker le jeton de gestion. Ne pas exécuter sans autorisation.

BEGIN;

CREATE TABLE public.ai_appointment_attempt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id varchar(255) NOT NULL,
  idempotency_key varchar(128),
  request_payload jsonb,
  request_fingerprint varchar(64) NOT NULL,
  status varchar(32) NOT NULL,
  appointment_id uuid,
  appointment_reference varchar(40),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  submitted_at timestamptz,
  confirmed_at timestamptz,
  lease_owner varchar(64),
  lease_until timestamptz,
  resume_count integer NOT NULL DEFAULT 0,
  CONSTRAINT ck_ai_appointment_attempt_status
    CHECK (status IN (
      'AWAITING_CONFIRMATION',
      'SUBMITTING',
      'UNCERTAIN',
      'CONFIRMED',
      'ABANDONED',
      'REJECTED',
      'SLOT_UNAVAILABLE',
      'EXPIRED'
    )),
  CONSTRAINT ck_ai_appointment_attempt_fingerprint
    CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_ai_appointment_attempt_key
    CHECK (
      idempotency_key IS NULL
      OR idempotency_key ~ '^[A-Za-z0-9._~-]{16,128}$'
    ),
  CONSTRAINT ck_ai_appointment_attempt_dates
    CHECK (
      updated_at >= created_at
      AND expires_at >= created_at
      AND (submitted_at IS NULL OR submitted_at >= created_at)
      AND (
        confirmed_at IS NULL
        OR (submitted_at IS NOT NULL AND confirmed_at >= submitted_at)
      )
    ),
  CONSTRAINT ck_ai_appointment_attempt_lease
    CHECK (
      (lease_owner IS NULL AND lease_until IS NULL)
      OR (
        status = 'SUBMITTING'
        AND lease_owner ~ '^[A-Za-z0-9._~-]{16,64}$'
        AND lease_until IS NOT NULL
      )
    ),
  CONSTRAINT ck_ai_appointment_attempt_resume
    CHECK (
      resume_count >= 0
      AND (status <> 'AWAITING_CONFIRMATION' OR resume_count = 0)
    ),
  CONSTRAINT ck_ai_appointment_attempt_open_body
    CHECK (
      status NOT IN ('AWAITING_CONFIRMATION', 'SUBMITTING', 'UNCERTAIN')
      OR (request_payload IS NOT NULL AND idempotency_key IS NOT NULL)
    ),
  CONSTRAINT ck_ai_appointment_attempt_terminal_privacy
    CHECK (
      status NOT IN ('CONFIRMED', 'ABANDONED', 'REJECTED', 'SLOT_UNAVAILABLE', 'EXPIRED')
      OR (
        request_payload IS NULL
        AND idempotency_key IS NULL
        AND lease_owner IS NULL
        AND lease_until IS NULL
      )
    ),
  CONSTRAINT ck_ai_appointment_attempt_result
    CHECK (
      (
        status = 'CONFIRMED'
        AND appointment_id IS NOT NULL
        AND appointment_reference IS NOT NULL
        AND submitted_at IS NOT NULL
        AND confirmed_at IS NOT NULL
      )
      OR (
        status <> 'CONFIRMED'
        AND appointment_id IS NULL
        AND appointment_reference IS NULL
        AND confirmed_at IS NULL
      )
    ),
  CONSTRAINT ck_ai_appointment_attempt_submitted
    CHECK (
      (
        status IN ('AWAITING_CONFIRMATION', 'ABANDONED', 'EXPIRED')
        AND submitted_at IS NULL
      )
      OR (
        status IN ('SUBMITTING', 'UNCERTAIN', 'CONFIRMED', 'REJECTED', 'SLOT_UNAVAILABLE')
        AND submitted_at IS NOT NULL
      )
    ),
  CONSTRAINT ck_ai_appointment_attempt_payload_shape
    CHECK (
      request_payload IS NULL
      OR (
        jsonb_typeof(request_payload) = 'object'
        AND request_payload ? 'slotId'
        AND request_payload ? 'nom'
        AND request_payload ? 'prenom'
        AND request_payload ? 'email'
        AND request_payload ? 'telephone'
        AND request_payload ? 'numeroDocument'
        AND request_payload ? 'langue'
        AND request_payload ? 'cleIdempotence'
        AND request_payload->>'cleIdempotence' IS NOT DISTINCT FROM idempotency_key
      )
    )
);

COMMENT ON TABLE public.ai_appointment_attempt IS
  'Tentative de création issue du chatbot. Le jeton de gestion n''est pas stocké. Les statuts ouverts sont AWAITING_CONFIRMATION, SUBMITTING et UNCERTAIN.';

COMMENT ON COLUMN public.ai_appointment_attempt.idempotency_key IS
  'Clé brute envoyée au workflow 03, tirée une fois par tentative. Nulle après clôture. Elle n''est pas le jeton de gestion.';

COMMENT ON COLUMN public.ai_appointment_attempt.request_payload IS
  'Corps JSON figé. Effacé dès que la tentative n''est plus ouverte. Conservé pour UNCERTAIN.';

COMMENT ON COLUMN public.ai_appointment_attempt.request_fingerprint IS
  'SHA-256 hexadécimal du corps canonique. Ce n''est pas une donnée personnelle.';

COMMENT ON COLUMN public.ai_appointment_attempt.lease_owner IS
  'Jeton de bail du traitement en cours. Distinct de la clé d''idempotence.';

COMMENT ON COLUMN public.ai_appointment_attempt.lease_until IS
  'Fin du bail de 90 secondes. Une reprise de SUBMITTING n''est possible qu''après cette échéance.';

CREATE UNIQUE INDEX uq_ai_appointment_attempt_idempotency_key
  ON public.ai_appointment_attempt (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX uq_ai_appointment_attempt_session_ouverte
  ON public.ai_appointment_attempt (session_id)
  WHERE status IN ('AWAITING_CONFIRMATION', 'SUBMITTING', 'UNCERTAIN');

CREATE INDEX idx_ai_appointment_attempt_reprise
  ON public.ai_appointment_attempt (lease_until, id)
  WHERE status IN ('SUBMITTING', 'UNCERTAIN');

CREATE INDEX idx_ai_appointment_attempt_session_recent
  ON public.ai_appointment_attempt (session_id, created_at DESC);

REVOKE ALL ON TABLE public.ai_appointment_attempt FROM PUBLIC;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_appointment_attempt TO govsuite; -- retiré : rôle govsuite absent du cluster TEST

CREATE FUNCTION public.reclamer_tentative_rendez_vous(
  p_id uuid,
  p_session_id text,
  p_owner text
) RETURNS TABLE (
  acquired boolean,
  attempt_id uuid,
  attempt_status text,
  request_payload jsonb,
  idempotency_key text,
  request_fingerprint text,
  resume_count integer
)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
#variable_conflict use_column
BEGIN
  IF p_owner IS NULL OR p_owner !~ '^[A-Za-z0-9._~-]{16,64}$' THEN
    RETURN QUERY
    SELECT false, NULL::uuid, NULL::text, NULL::jsonb, NULL::text, NULL::text, NULL::integer;
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.ai_appointment_attempt AS a
  SET status = 'SUBMITTING',
      lease_owner = p_owner,
      lease_until = clock_timestamp() + interval '90 seconds',
      submitted_at = clock_timestamp(),
      updated_at = clock_timestamp()
  WHERE a.id = p_id
    AND a.session_id = p_session_id
    AND a.status = 'AWAITING_CONFIRMATION'
    AND a.expires_at > clock_timestamp()
    AND a.idempotency_key IS NOT NULL
    AND a.request_payload IS NOT NULL
  RETURNING
    true,
    a.id,
    a.status::text,
    a.request_payload,
    a.idempotency_key::text,
    a.request_fingerprint::text,
    a.resume_count;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT false, NULL::uuid, NULL::text, NULL::jsonb, NULL::text, NULL::text, NULL::integer;
  END IF;
END;
$function$;

CREATE FUNCTION public.reprendre_tentative_rendez_vous(
  p_id uuid,
  p_session_id text,
  p_owner text
) RETURNS TABLE (
  acquired boolean,
  attempt_id uuid,
  attempt_status text,
  request_payload jsonb,
  idempotency_key text,
  request_fingerprint text,
  resume_count integer
)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
#variable_conflict use_column
BEGIN
  IF p_owner IS NULL OR p_owner !~ '^[A-Za-z0-9._~-]{16,64}$' THEN
    RETURN QUERY
    SELECT false, NULL::uuid, NULL::text, NULL::jsonb, NULL::text, NULL::text, NULL::integer;
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.ai_appointment_attempt AS a
  SET status = 'SUBMITTING',
      lease_owner = p_owner,
      lease_until = clock_timestamp() + interval '90 seconds',
      resume_count = a.resume_count + 1,
      updated_at = clock_timestamp()
  WHERE a.id = p_id
    AND a.session_id = p_session_id
    AND a.idempotency_key IS NOT NULL
    AND a.request_payload IS NOT NULL
    AND (
      a.status = 'UNCERTAIN'
      OR (a.status = 'SUBMITTING' AND a.lease_until < clock_timestamp())
    )
  RETURNING
    true,
    a.id,
    a.status::text,
    a.request_payload,
    a.idempotency_key::text,
    a.request_fingerprint::text,
    a.resume_count;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT false, NULL::uuid, NULL::text, NULL::jsonb, NULL::text, NULL::text, NULL::integer;
  END IF;
END;
$function$;

CREATE FUNCTION public.marquer_tentative_incertaine(
  p_id uuid,
  p_session_id text,
  p_owner text
) RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
#variable_conflict use_column
DECLARE
  v_count integer;
BEGIN
  UPDATE public.ai_appointment_attempt AS a
  SET status = 'UNCERTAIN',
      lease_owner = NULL,
      lease_until = NULL,
      updated_at = clock_timestamp()
  WHERE a.id = p_id
    AND a.session_id = p_session_id
    AND a.status = 'SUBMITTING'
    AND a.lease_owner = p_owner
    AND a.lease_until >= clock_timestamp()
    AND a.idempotency_key IS NOT NULL
    AND a.request_payload IS NOT NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END;
$function$;

CREATE FUNCTION public.cloturer_tentative_rendez_vous(
  p_id uuid,
  p_session_id text,
  p_owner text,
  p_status text,
  p_appointment_id uuid,
  p_reference text
) RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
#variable_conflict use_column
DECLARE
  v_count integer;
BEGIN
  IF p_status = 'ABANDONED' THEN
    IF p_appointment_id IS NOT NULL OR p_reference IS NOT NULL THEN
      RETURN false;
    END IF;

    UPDATE public.ai_appointment_attempt AS a
    SET status = 'ABANDONED',
        idempotency_key = NULL,
        request_payload = NULL,
        lease_owner = NULL,
        lease_until = NULL,
        updated_at = clock_timestamp()
    WHERE a.id = p_id
      AND a.session_id = p_session_id
      AND a.status = 'AWAITING_CONFIRMATION';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count = 1;
  END IF;

  IF p_status NOT IN ('CONFIRMED', 'REJECTED', 'SLOT_UNAVAILABLE')
     OR p_owner IS NULL
     OR p_owner !~ '^[A-Za-z0-9._~-]{16,64}$' THEN
    RETURN false;
  END IF;

  IF p_status = 'CONFIRMED' THEN
    IF p_appointment_id IS NULL
       OR p_reference IS NULL
       OR char_length(p_reference) < 1
       OR char_length(p_reference) > 40 THEN
      RETURN false;
    END IF;

    UPDATE public.ai_appointment_attempt AS a
    SET status = 'CONFIRMED',
        appointment_id = p_appointment_id,
        appointment_reference = p_reference,
        confirmed_at = clock_timestamp(),
        idempotency_key = NULL,
        request_payload = NULL,
        lease_owner = NULL,
        lease_until = NULL,
        updated_at = clock_timestamp()
    WHERE a.id = p_id
      AND a.session_id = p_session_id
      AND a.status = 'SUBMITTING'
      AND a.lease_owner = p_owner
      AND a.lease_until >= clock_timestamp();
  ELSE
    IF p_appointment_id IS NOT NULL OR p_reference IS NOT NULL THEN
      RETURN false;
    END IF;

    UPDATE public.ai_appointment_attempt AS a
    SET status = p_status,
        idempotency_key = NULL,
        request_payload = NULL,
        lease_owner = NULL,
        lease_until = NULL,
        updated_at = clock_timestamp()
    WHERE a.id = p_id
      AND a.session_id = p_session_id
      AND a.status = 'SUBMITTING'
      AND a.lease_owner = p_owner
      AND a.lease_until >= clock_timestamp();
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END;
$function$;

CREATE FUNCTION public.expirer_tentatives_en_attente()
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
#variable_conflict use_column
DECLARE
  v_count integer;
BEGIN
  UPDATE public.ai_appointment_attempt AS a
  SET status = 'EXPIRED',
      idempotency_key = NULL,
      request_payload = NULL,
      lease_owner = NULL,
      lease_until = NULL,
      updated_at = clock_timestamp()
  WHERE a.status = 'AWAITING_CONFIRMATION'
    AND a.expires_at <= clock_timestamp();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

COMMENT ON FUNCTION public.reclamer_tentative_rendez_vous(uuid, text, text) IS
  'Passe une seule fois AWAITING_CONFIRMATION à SUBMITTING et pose un bail de 90 secondes. Zéro ligne signifie qu''un autre traitement a déjà gagné.';

COMMENT ON FUNCTION public.reprendre_tentative_rendez_vous(uuid, text, text) IS
  'Reprend UNCERTAIN, ou SUBMITTING dont le bail est échu. Ne change ni le corps ni la clé. Une seule exécution obtient le nouveau bail.';

COMMENT ON FUNCTION public.marquer_tentative_incertaine(uuid, text, text) IS
  'Le détenteur du bail marque un résultat HTTP inconnu. Le corps et la clé restent.';

COMMENT ON FUNCTION public.cloturer_tentative_rendez_vous(uuid, text, text, text, uuid, text) IS
  'Clôt une tentative et efface le corps ainsi que la clé. CONFIRMED conserve l''identifiant et la référence du rendez-vous, jamais le jeton.';

COMMENT ON FUNCTION public.expirer_tentatives_en_attente() IS
  'Expire uniquement les attentes dépassées. N''efface ni SUBMITTING ni UNCERTAIN.';

REVOKE ALL ON FUNCTION public.reclamer_tentative_rendez_vous(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reprendre_tentative_rendez_vous(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.marquer_tentative_incertaine(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cloturer_tentative_rendez_vous(uuid, text, text, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expirer_tentatives_en_attente() FROM PUBLIC;

-- GRANT EXECUTE ON FUNCTION public.reclamer_tentative_rendez_vous(uuid, text, text) TO govsuite; -- retiré : rôle govsuite absent du cluster TEST
-- GRANT EXECUTE ON FUNCTION public.reprendre_tentative_rendez_vous(uuid, text, text) TO govsuite; -- retiré : rôle govsuite absent du cluster TEST
-- GRANT EXECUTE ON FUNCTION public.marquer_tentative_incertaine(uuid, text, text) TO govsuite; -- retiré : rôle govsuite absent du cluster TEST
-- GRANT EXECUTE ON FUNCTION public.cloturer_tentative_rendez_vous(uuid, text, text, text, uuid, text) TO govsuite; -- retiré : rôle govsuite absent du cluster TEST
-- GRANT EXECUTE ON FUNCTION public.expirer_tentatives_en_attente() TO govsuite; -- retiré : rôle govsuite absent du cluster TEST

COMMIT;

