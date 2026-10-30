-- REC-007 phase 7E. Migration préparée, non exécutée.
-- Additive : les 13 rendez-vous actuels restent valides.
-- L'ancien workflow n'appelle pas cette fonction.
-- Exécuter ce fichier dans une seule transaction.

BEGIN;

ALTER TABLE public.rendez_vous
  ADD COLUMN cle_idempotence varchar(64),
  ADD COLUMN empreinte_requete varchar(64);

ALTER TABLE public.rendez_vous
  ADD CONSTRAINT ck_rendez_vous_idempotence
  CHECK (
    (cle_idempotence IS NULL AND empreinte_requete IS NULL)
    OR (
      cle_idempotence IS NOT NULL
      AND empreinte_requete IS NOT NULL
      AND cle_idempotence ~ '^[0-9a-f]{64}$'
      AND empreinte_requete ~ '^[0-9a-f]{64}$'
    )
  );

CREATE UNIQUE INDEX uq_rendez_vous_cle_idempotence
  ON public.rendez_vous (cle_idempotence)
  WHERE cle_idempotence IS NOT NULL;

COMMENT ON COLUMN public.rendez_vous.cle_idempotence IS
  'SHA-256 hexadécimal de la clé brute. NULL si l''appel n''est pas idempotent. La clé brute n''est pas stockée.';

COMMENT ON COLUMN public.rendez_vous.empreinte_requete IS
  'SHA-256 hexadécimal du contenu normalisé. Sert à distinguer un replay d''un conflit de clé.';

CREATE OR REPLACE FUNCTION public.creer_rendez_vous_idempotent(
  p_slot uuid,
  p_nom text,
  p_prenom text,
  p_email text,
  p_telephone text,
  p_document text,
  p_langue text,
  p_cle text
)
RETURNS TABLE (
  issue text,
  id uuid,
  reference character varying,
  token_gestion uuid,
  statut character varying,
  email character varying,
  telephone character varying,
  debut timestamp with time zone,
  fin timestamp with time zone,
  service character varying,
  site character varying
)
LANGUAGE plpgsql
VOLATILE
SET search_path = pg_catalog, public
AS $function$
#variable_conflict use_column
DECLARE
  v_nom varchar(100);
  v_prenom varchar(100);
  v_email varchar(255);
  v_telephone varchar(50);
  v_document varchar(100);
  v_langue varchar(10);
  v_cle text;
  v_hash text;
  v_empreinte text;
  v_existing public.rendez_vous%ROWTYPE;
  v_service uuid;
  v_site uuid;
  v_row public.rendez_vous%ROWTYPE;
  v_places integer;
  v_constraint text;
  v_mode text;
BEGIN
  v_nom := left(normalize(btrim(coalesce(p_nom, '')), NFC), 100);
  v_prenom := left(normalize(btrim(coalesce(p_prenom, '')), NFC), 100);
  v_email := nullif(left(normalize(btrim(coalesce(p_email, '')), NFC), 255), '');
  v_telephone := nullif(left(normalize(btrim(coalesce(p_telephone, '')), NFC), 50), '');
  v_document := nullif(left(normalize(btrim(coalesce(p_document, '')), NFC), 100), '');
  v_langue := coalesce(nullif(left(normalize(btrim(coalesce(p_langue, '')), NFC), 10), ''), 'fr');
  v_cle := nullif(btrim(coalesce(p_cle, '')), '');

  IF v_nom = '' OR v_prenom = '' THEN
    RAISE EXCEPTION 'identite_incomplete' USING ERRCODE = '22023';
  END IF;

  IF v_cle IS NOT NULL AND v_cle !~ '^[A-Za-z0-9._~-]{16,128}$' THEN
    RAISE EXCEPTION 'cle_idempotence_invalide' USING ERRCODE = '22023';
  END IF;

  IF v_cle IS NULL THEN
    v_hash := NULL;
    v_empreinte := NULL;
  ELSE
    v_hash := encode(public.digest(convert_to(v_cle, 'UTF8'), 'sha256'), 'hex');
    v_empreinte := encode(public.digest(convert_to(jsonb_build_object(
      'slotId', lower(p_slot::text),
      'nom', v_nom,
      'prenom', v_prenom,
      'email', lower(v_email),
      'telephone', v_telephone,
      'numeroDocument', v_document,
      'langue', v_langue
    )::text, 'UTF8'), 'sha256'), 'hex');

    SELECT * INTO v_existing
    FROM public.rendez_vous
    WHERE cle_idempotence = v_hash
    FOR UPDATE;

    IF FOUND THEN
      v_mode := CASE
        WHEN v_existing.empreinte_requete = v_empreinte THEN 'REPLAYED'
        ELSE 'KEY_CONFLICT'
      END;
    END IF;
  END IF;

  IF v_mode IS NULL THEN
    SELECT c.service_id, c.site_id
    INTO v_service, v_site
    FROM public.creneaux c
    WHERE c.id = p_slot
      AND c.statut = 'DISPONIBLE'
      AND c.places_reservees < c.capacite
      AND c.debut > now()
    FOR UPDATE;

    IF NOT FOUND THEN
      -- Le créneau est complet, passé ou inconnu. Si le gagnant
      -- concurrent vient de valider la même clé, ce n'est pas un refus :
      -- la ligne est maintenant visible et doit être rejouée.
      IF v_hash IS NOT NULL THEN
        SELECT * INTO v_existing
        FROM public.rendez_vous
        WHERE cle_idempotence = v_hash
        FOR UPDATE;

        IF FOUND THEN
          v_mode := CASE
            WHEN v_existing.empreinte_requete = v_empreinte THEN 'REPLAYED'
            ELSE 'KEY_CONFLICT'
          END;
        END IF;
      END IF;

      IF v_mode IS NULL THEN
        v_mode := 'SLOT_UNAVAILABLE';
      END IF;
    END IF;
  END IF;

  IF v_mode = 'REPLAYED' THEN
    RETURN QUERY
    SELECT 'REPLAYED'::text, r.id, r.reference, r.token_gestion, r.statut,
           r.email, r.telephone, c.debut, c.fin, s.code, si.code
    FROM public.rendez_vous r
    JOIN public.creneaux c ON c.id = r.creneau_id
    JOIN public.services s ON s.id = r.service_id
    JOIN public.sites si ON si.id = r.site_id
    WHERE r.id = v_existing.id;
    RETURN;
  ELSIF v_mode IN ('KEY_CONFLICT', 'SLOT_UNAVAILABLE') THEN
    RETURN QUERY
    SELECT v_mode, NULL::uuid, NULL::character varying, NULL::uuid, NULL::character varying,
           NULL::character varying, NULL::character varying, NULL::timestamp with time zone,
           NULL::timestamp with time zone, NULL::character varying, NULL::character varying;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.rendez_vous (
      reference, service_id, site_id, creneau_id,
      nom, prenom, email, telephone, numero_document, langue, statut,
      cle_idempotence, empreinte_requete
    ) VALUES (
      'GB-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
      v_service, v_site, p_slot,
      v_nom, v_prenom, v_email, v_telephone, v_document, v_langue, 'CONFIRME',
      v_hash, v_empreinte
    )
    RETURNING * INTO v_row;

    -- id et statut sont aussi des noms de colonnes de retour : les qualifier.
    UPDATE public.creneaux AS c
    SET places_reservees = c.places_reservees + 1,
        statut = CASE
          WHEN c.places_reservees + 1 >= c.capacite THEN 'COMPLET'
          ELSE c.statut
        END,
        updated_at = now()
    WHERE c.id = p_slot
      AND c.statut = 'DISPONIBLE'
      AND c.places_reservees < c.capacite;

    GET DIAGNOSTICS v_places = ROW_COUNT;
    IF v_places <> 1 THEN
      RAISE EXCEPTION 'slot_indisponible' USING ERRCODE = 'GX001';
    END IF;

    INSERT INTO public.historique_rendez_vous (rendez_vous_id, action, nouveau_statut, details)
    VALUES (v_row.id, 'CREATION', 'CONFIRME', jsonb_build_object('reference', v_row.reference));

    IF v_row.email IS NOT NULL THEN
      INSERT INTO public.notifications (rendez_vous_id, type, canal, destinataire, statut)
      VALUES (v_row.id, 'CONFIRMATION', 'EMAIL', v_row.email, 'A_ENVOYER')
      ON CONFLICT (rendez_vous_id, type, canal) DO NOTHING;
    END IF;

    RETURN QUERY
    SELECT 'CREATED'::text, r.id, r.reference, r.token_gestion, r.statut,
           r.email, r.telephone, c.debut, c.fin, s.code, si.code
    FROM public.rendez_vous r
    JOIN public.creneaux c ON c.id = r.creneau_id
    JOIN public.services s ON s.id = r.service_id
    JOIN public.sites si ON si.id = r.site_id
    WHERE r.id = v_row.id;
    RETURN;
  EXCEPTION
    WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      IF v_constraint IS DISTINCT FROM 'uq_rendez_vous_cle_idempotence' THEN
        RAISE;
      END IF;

      SELECT * INTO v_existing
      FROM public.rendez_vous
      WHERE cle_idempotence = v_hash
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE;
      END IF;

      IF v_existing.empreinte_requete = v_empreinte THEN
        RETURN QUERY
        SELECT 'REPLAYED'::text, r.id, r.reference, r.token_gestion, r.statut,
               r.email, r.telephone, c.debut, c.fin, s.code, si.code
        FROM public.rendez_vous r
        JOIN public.creneaux c ON c.id = r.creneau_id
        JOIN public.services s ON s.id = r.service_id
        JOIN public.sites si ON si.id = r.site_id
        WHERE r.id = v_existing.id;
      ELSE
        RETURN QUERY
        SELECT 'KEY_CONFLICT'::text, NULL::uuid, NULL::character varying, NULL::uuid,
               NULL::character varying, NULL::character varying, NULL::character varying,
               NULL::timestamp with time zone, NULL::timestamp with time zone,
               NULL::character varying, NULL::character varying;
      END IF;
      RETURN;
    WHEN SQLSTATE 'GX001' THEN
      IF v_hash IS NOT NULL THEN
        SELECT * INTO v_existing
        FROM public.rendez_vous
        WHERE cle_idempotence = v_hash
        FOR UPDATE;
        IF FOUND AND v_existing.empreinte_requete = v_empreinte THEN
          RETURN QUERY
          SELECT 'REPLAYED'::text, r.id, r.reference, r.token_gestion, r.statut,
                 r.email, r.telephone, c.debut, c.fin, s.code, si.code
          FROM public.rendez_vous r
          JOIN public.creneaux c ON c.id = r.creneau_id
          JOIN public.services s ON s.id = r.service_id
          JOIN public.sites si ON si.id = r.site_id
          WHERE r.id = v_existing.id;
          RETURN;
        ELSIF FOUND THEN
          RETURN QUERY
          SELECT 'KEY_CONFLICT'::text, NULL::uuid, NULL::character varying, NULL::uuid,
                 NULL::character varying, NULL::character varying, NULL::character varying,
                 NULL::timestamp with time zone, NULL::timestamp with time zone,
                 NULL::character varying, NULL::character varying;
          RETURN;
        END IF;
      END IF;

      RETURN QUERY
      SELECT 'SLOT_UNAVAILABLE'::text, NULL::uuid, NULL::character varying, NULL::uuid,
             NULL::character varying, NULL::character varying, NULL::character varying,
             NULL::timestamp with time zone, NULL::timestamp with time zone,
             NULL::character varying, NULL::character varying;
      RETURN;
  END;
END;
$function$;

COMMENT ON FUNCTION public.creer_rendez_vous_idempotent(uuid, text, text, text, text, text, text, text) IS
  'Crée un rendez-vous ou rejoue une clé. L''index unique et le verrou de ligne du créneau tranchent les appels simultanés. Aucun verrou applicatif n8n.';

REVOKE ALL ON FUNCTION public.creer_rendez_vous_idempotent(uuid, text, text, text, text, text, text, text) FROM PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.creer_rendez_vous_idempotent(uuid, text, text, text, text, text, text, text) TO govsuite; -- retiré : rôle govsuite absent du cluster TEST

COMMIT;

