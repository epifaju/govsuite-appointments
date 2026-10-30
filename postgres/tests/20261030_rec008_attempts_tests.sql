-- REC-008 phase 8B. Tests préparés, non exécutés.
-- Les lancer seulement après une application autorisée de la migration,
-- dans une session dont la dernière instruction est ROLLBACK.
-- Ne pas les lancer sur la base métier pendant la phase 8B.
-- Le script ne sélectionne pas la clé brute : il compare des booléens.

BEGIN;

INSERT INTO public.ai_appointment_attempt (
  id, session_id, idempotency_key, request_payload, request_fingerprint,
  status, expires_at
) VALUES (
  '00000000-0000-4000-8000-000000008b01',
  'rec008-8b-session-a',
  'rec008-phase8b-aaaaaaaaaaaaaaaaaaaaaaaa',
  jsonb_build_object(
    'slotId', '00000000-0000-4000-8000-0000000000a1',
    'nom', 'REC008',
    'prenom', 'ESSAI',
    'email', 'rec008-phase8b-a@example.test',
    'telephone', '0600000801',
    'numeroDocument', '',
    'langue', 'fr',
    'cleIdempotence', 'rec008-phase8b-aaaaaaaaaaaaaaaaaaaaaaaa'
  ),
  repeat('ab', 32),
  'AWAITING_CONFIRMATION',
  clock_timestamp() + interval '2 hours'
);

DO $uniq$
BEGIN
  INSERT INTO public.ai_appointment_attempt (
    id, session_id, idempotency_key, request_payload, request_fingerprint,
    status, expires_at
  ) VALUES (
    '00000000-0000-4000-8000-000000008b02',
    'rec008-8b-session-a',
    'rec008-phase8b-bbbbbbbbbbbbbbbbbbbbbbbb',
    jsonb_build_object(
      'slotId', '00000000-0000-4000-8000-0000000000a1',
      'nom', 'REC008',
      'prenom', 'ESSAI',
      'email', 'rec008-phase8b-a@example.test',
      'telephone', '0600000801',
      'numeroDocument', '',
      'langue', 'fr',
      'cleIdempotence', 'rec008-phase8b-bbbbbbbbbbbbbbbbbbbbbbbb'
    ),
    repeat('cd', 32),
    'AWAITING_CONFIRMATION',
    clock_timestamp() + interval '2 hours'
  );
  RAISE EXCEPTION 'unicite_ouverte_non_appliquee';
EXCEPTION
  WHEN unique_violation THEN
    NULL;
END
$uniq$;

DO $claim$
DECLARE
  v_first boolean;
  v_second boolean;
  v_same boolean;
BEGIN
  SELECT acquired, (request_payload->>'nom' = 'REC008' AND resume_count = 0)
  INTO v_first, v_same
  FROM public.reclamer_tentative_rendez_vous(
    '00000000-0000-4000-8000-000000008b01',
    'rec008-8b-session-a',
    'owner-phase8b-0001'
  );

  SELECT acquired
  INTO v_second
  FROM public.reclamer_tentative_rendez_vous(
    '00000000-0000-4000-8000-000000008b01',
    'rec008-8b-session-a',
    'owner-phase8b-0002'
  );

  IF v_first IS NOT TRUE OR v_same IS NOT TRUE OR v_second IS NOT FALSE THEN
    RAISE EXCEPTION 'transition_atomique_incorrecte';
  END IF;
END
$claim$;

DO $resume$
DECLARE
  v_marked boolean;
  v_kept boolean;
  v_first boolean;
  v_first_same boolean;
  v_second boolean;
  v_second_same boolean;
  v_blocked boolean;
BEGIN
  SELECT public.marquer_tentative_incertaine(
    '00000000-0000-4000-8000-000000008b01',
    'rec008-8b-session-a',
    'owner-phase8b-0001'
  ) INTO v_marked;

  SELECT status = 'UNCERTAIN' AND request_payload IS NOT NULL AND idempotency_key IS NOT NULL
  INTO v_kept
  FROM public.ai_appointment_attempt
  WHERE id = '00000000-0000-4000-8000-000000008b01';

  SELECT acquired, (request_payload->>'nom' = 'REC008' AND resume_count = 1)
  INTO v_first, v_first_same
  FROM public.reprendre_tentative_rendez_vous(
    '00000000-0000-4000-8000-000000008b01',
    'rec008-8b-session-a',
    'owner-phase8b-0003'
  );

  UPDATE public.ai_appointment_attempt
  SET lease_until = clock_timestamp() - interval '1 second'
  WHERE id = '00000000-0000-4000-8000-000000008b01';

  SELECT acquired, (request_payload->>'nom' = 'REC008' AND resume_count = 2)
  INTO v_second, v_second_same
  FROM public.reprendre_tentative_rendez_vous(
    '00000000-0000-4000-8000-000000008b01',
    'rec008-8b-session-a',
    'owner-phase8b-0004'
  );

  SELECT acquired
  INTO v_blocked
  FROM public.reprendre_tentative_rendez_vous(
    '00000000-0000-4000-8000-000000008b01',
    'rec008-8b-session-a',
    'owner-phase8b-0005'
  );

  IF v_marked IS NOT TRUE OR v_kept IS NOT TRUE
     OR v_first IS NOT TRUE OR v_first_same IS NOT TRUE
     OR v_second IS NOT TRUE OR v_second_same IS NOT TRUE
     OR v_blocked IS NOT FALSE THEN
    RAISE EXCEPTION 'reprise_de_bail_incorrecte';
  END IF;
END
$resume$;

DO $close$
DECLARE
  v_closed boolean;
  v_private boolean;
  v_reference boolean;
BEGIN
  SELECT public.cloturer_tentative_rendez_vous(
    '00000000-0000-4000-8000-000000008b01',
    'rec008-8b-session-a',
    'owner-phase8b-0004',
    'CONFIRMED',
    '00000000-0000-4000-8000-000000008b99',
    'GB-2026-AABBCCDD'
  ) INTO v_closed;

  SELECT request_payload IS NULL AND idempotency_key IS NULL
  INTO v_private
  FROM public.ai_appointment_attempt
  WHERE id = '00000000-0000-4000-8000-000000008b01';

  SELECT status = 'CONFIRMED' AND appointment_reference = 'GB-2026-AABBCCDD'
  INTO v_reference
  FROM public.ai_appointment_attempt
  WHERE id = '00000000-0000-4000-8000-000000008b01';

  IF v_closed IS NOT TRUE OR v_private IS NOT TRUE OR v_reference IS NOT TRUE THEN
    RAISE EXCEPTION 'cloture_confirmee_incorrecte';
  END IF;
END
$close$;

DO $abandon$
DECLARE
  v_abandoned boolean;
  v_open integer;
BEGIN
  INSERT INTO public.ai_appointment_attempt (
    id, session_id, idempotency_key, request_payload, request_fingerprint,
    status, expires_at
  ) VALUES (
    '00000000-0000-4000-8000-000000008b03',
    'rec008-8b-session-b',
    'rec008-phase8b-cccccccccccccccccccccccc',
    jsonb_build_object(
      'slotId', '00000000-0000-4000-8000-0000000000a1',
      'nom', 'REC008',
      'prenom', 'ABANDON',
      'email', 'rec008-phase8b-b@example.test',
      'telephone', '0600000802',
      'numeroDocument', '',
      'langue', 'fr',
      'cleIdempotence', 'rec008-phase8b-cccccccccccccccccccccccc'
    ),
    repeat('ef', 32),
    'AWAITING_CONFIRMATION',
    clock_timestamp() + interval '2 hours'
  );

  SELECT public.cloturer_tentative_rendez_vous(
    '00000000-0000-4000-8000-000000008b03',
    'rec008-8b-session-b',
    NULL,
    'ABANDONED',
    NULL,
    NULL
  ) INTO v_abandoned;

  INSERT INTO public.ai_appointment_attempt (
    id, session_id, idempotency_key, request_payload, request_fingerprint,
    status, expires_at
  ) VALUES (
    '00000000-0000-4000-8000-000000008b04',
    'rec008-8b-session-b',
    'rec008-phase8b-dddddddddddddddddddddddd',
    jsonb_build_object(
      'slotId', '00000000-0000-4000-8000-0000000000a1',
      'nom', 'REC008',
      'prenom', 'SUITE',
      'email', 'rec008-phase8b-b@example.test',
      'telephone', '0600000802',
      'numeroDocument', '',
      'langue', 'fr',
      'cleIdempotence', 'rec008-phase8b-dddddddddddddddddddddddd'
    ),
    repeat('12', 32),
    'AWAITING_CONFIRMATION',
    clock_timestamp() + interval '2 hours'
  );

  SELECT count(*) INTO v_open
  FROM public.ai_appointment_attempt
  WHERE session_id = 'rec008-8b-session-b'
    AND status = 'AWAITING_CONFIRMATION';

  IF v_abandoned IS NOT TRUE OR v_open <> 1 THEN
    RAISE EXCEPTION 'nouvelle_tentative_apres_abandon_incorrecte';
  END IF;
END
$abandon$;

DO $expire$
DECLARE
  v_claimed boolean;
  v_marked boolean;
  v_expired integer;
  v_status text;
  v_body_absent boolean;
  v_uncertain_kept boolean;
  v_waiting_kept boolean;
BEGIN
  INSERT INTO public.ai_appointment_attempt (
    id, session_id, idempotency_key, request_payload, request_fingerprint,
    status, expires_at
  ) VALUES (
    '00000000-0000-4000-8000-000000008b06',
    'rec008-8b-session-d',
    'rec008-phase8b-ffffffffffffffffffffffff',
    jsonb_build_object(
      'slotId', '00000000-0000-4000-8000-0000000000a1',
      'nom', 'REC008',
      'prenom', 'INCERTAIN',
      'email', 'rec008-phase8b-d@example.test',
      'telephone', '0600000804',
      'numeroDocument', '',
      'langue', 'fr',
      'cleIdempotence', 'rec008-phase8b-ffffffffffffffffffffffff'
    ),
    repeat('56', 32),
    'AWAITING_CONFIRMATION',
    clock_timestamp() + interval '2 hours'
  );

  SELECT acquired
  INTO v_claimed
  FROM public.reclamer_tentative_rendez_vous(
    '00000000-0000-4000-8000-000000008b06',
    'rec008-8b-session-d',
    'owner-phase8b-0006'
  );

  SELECT public.marquer_tentative_incertaine(
    '00000000-0000-4000-8000-000000008b06',
    'rec008-8b-session-d',
    'owner-phase8b-0006'
  ) INTO v_marked;

  INSERT INTO public.ai_appointment_attempt (
    id, session_id, idempotency_key, request_payload, request_fingerprint,
    status, created_at, updated_at, expires_at
  ) VALUES (
    '00000000-0000-4000-8000-000000008b05',
    'rec008-8b-session-c',
    'rec008-phase8b-eeeeeeeeeeeeeeeeeeeeeeee',
    jsonb_build_object(
      'slotId', '00000000-0000-4000-8000-0000000000a1',
      'nom', 'REC008',
      'prenom', 'EXPIRE',
      'email', 'rec008-phase8b-c@example.test',
      'telephone', '0600000803',
      'numeroDocument', '',
      'langue', 'fr',
      'cleIdempotence', 'rec008-phase8b-eeeeeeeeeeeeeeeeeeeeeeee'
    ),
    repeat('34', 32),
    'AWAITING_CONFIRMATION',
    clock_timestamp() - interval '3 hours',
    clock_timestamp() - interval '3 hours',
    clock_timestamp() - interval '1 minute'
  );

  SELECT public.expirer_tentatives_en_attente() INTO v_expired;

  SELECT status, request_payload IS NULL AND idempotency_key IS NULL
  INTO v_status, v_body_absent
  FROM public.ai_appointment_attempt
  WHERE id = '00000000-0000-4000-8000-000000008b05';

  SELECT status = 'UNCERTAIN' AND request_payload IS NOT NULL AND idempotency_key IS NOT NULL
  INTO v_uncertain_kept
  FROM public.ai_appointment_attempt
  WHERE id = '00000000-0000-4000-8000-000000008b06';

  SELECT status = 'AWAITING_CONFIRMATION' AND request_payload IS NOT NULL
  INTO v_waiting_kept
  FROM public.ai_appointment_attempt
  WHERE id = '00000000-0000-4000-8000-000000008b04';

  IF v_claimed IS NOT TRUE OR v_marked IS NOT TRUE OR v_expired <> 1
     OR v_status IS DISTINCT FROM 'EXPIRED' OR v_body_absent IS NOT TRUE
     OR v_uncertain_kept IS NOT TRUE OR v_waiting_kept IS NOT TRUE THEN
    RAISE EXCEPTION 'expiration_incorrecte';
  END IF;
END
$expire$;

DO $guard$
BEGIN
  IF (SELECT count(*) FROM public.ai_conversation_state) <> 48 THEN
    RAISE EXCEPTION 'sessions_modifiees';
  END IF;
  IF (SELECT count(*) FROM public.rendez_vous) <> 13 THEN
    RAISE EXCEPTION 'rendez_vous_modifies';
  END IF;
  IF (SELECT count(*) FROM public.notifications) <> 14 THEN
    RAISE EXCEPTION 'notifications_modifiees';
  END IF;
  IF (SELECT count(*) FROM public.historique_rendez_vous) <> 12 THEN
    RAISE EXCEPTION 'historiques_modifies';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ai_appointment_attempt'
      AND column_name = 'token_gestion'
  ) THEN
    RAISE EXCEPTION 'jeton_present';
  END IF;
END
$guard$;

ROLLBACK;
