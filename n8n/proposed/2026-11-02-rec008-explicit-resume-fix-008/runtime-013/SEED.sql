-- =============================================================================
-- ASK-PRENOM-RUNTIME-013 / REALIGN-019 — SEED fixtures (TEST only, OPTION A)
-- =============================================================================
-- Conteneur : govsuite-rec008-test-rec008-postgres-1
-- DB        : govsuite_rec008_test
-- Mode      : UPSERT ON CONFLICT (session_id) DO UPDATE — 3 ids uniquement
-- Contrat   : PRD §6.2 — ASK_PRENOM avec slot_id + dates + available_slots
-- INTERDIT  : LIVE, truncate, DELETE massif, mutation rdv / notifications / attempts
-- Empreinte typique après fixtures présentes : 1|14|4|0
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0) Préflight — counts + collision (empreinte typique fixtures présentes : 1|14|4|0)
-- -----------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM public.rendez_vous) AS rendez_vous,
  (SELECT count(*) FROM public.ai_conversation_state) AS ai_conversation_state,
  (SELECT count(*) FROM public.ai_appointment_attempt) AS ai_appointment_attempt,
  (SELECT count(*) FROM public.notifications) AS notifications,
  format(
    '%s|%s|%s|%s',
    (SELECT count(*) FROM public.rendez_vous),
    (SELECT count(*) FROM public.ai_conversation_state),
    (SELECT count(*) FROM public.ai_appointment_attempt),
    (SELECT count(*) FROM public.notifications)
  ) AS fingerprint;

SELECT session_id
FROM public.ai_conversation_state
WHERE session_id IN (
  'rec008-runtime013-r01-active',
  'rec008-runtime013-r02-expired',
  'rec008-runtime013-r03-resume'
)
ORDER BY session_id;

-- -----------------------------------------------------------------------------
-- 1) UPSERT — 3 sessions synthétiques ASK_PRENOM (nom=Dupont, prenom NULL)
-- -----------------------------------------------------------------------------
INSERT INTO public.ai_conversation_state AS s (
  session_id,
  intent,
  pending_action,
  conversation_step,
  nom,
  prenom,
  email,
  telephone,
  service,
  site,
  slot_id,
  available_slots,
  selected_slot_index,
  last_user_message,
  reference,
  token,
  new_slot_id,
  date_debut,
  date_fin,
  expires_at,
  updated_at
)
VALUES
  (
    'rec008-runtime013-r01-active',
    'CREATE_APPOINTMENT',
    'CREATE_APPOINTMENT',
    'ASK_PRENOM',
    'Dupont',
    NULL,
    NULL,
    NULL,
    'PASSEPORT',
    'PARIS',
    '33333333-3333-4333-8333-333333333301'::uuid,
    '[{"id":"33333333-3333-4333-8333-333333333301","slotId":"33333333-3333-4333-8333-333333333301","index":1,"start":"2026-11-10T09:00:00+01:00","end":"2026-11-10T09:30:00+01:00","service":"PASSEPORT","site":"PARIS"}]'::jsonb,
    1,
    NULL,
    NULL,
    NULL,
    NULL,
    DATE '2026-11-10',
    DATE '2026-11-14',
    NOW() + INTERVAL '2 hours',
    NOW()
  ),
  (
    'rec008-runtime013-r02-expired',
    'GENERAL',
    'CREATE_APPOINTMENT',
    'ASK_PRENOM',
    'Dupont',
    NULL,
    NULL,
    NULL,
    'PASSEPORT',
    'PARIS',
    '33333333-3333-4333-8333-333333333302'::uuid,
    '[{"id":"33333333-3333-4333-8333-333333333302","slotId":"33333333-3333-4333-8333-333333333302","index":1,"start":"2026-11-10T09:00:00+01:00","end":"2026-11-10T09:30:00+01:00","service":"PASSEPORT","site":"PARIS"}]'::jsonb,
    1,
    NULL,
    NULL,
    NULL,
    NULL,
    DATE '2026-11-10',
    DATE '2026-11-14',
    NOW() - INTERVAL '1 hour',
    NOW()
  ),
  (
    'rec008-runtime013-r03-resume',
    'GENERAL',
    'CREATE_APPOINTMENT',
    'ASK_PRENOM',
    'Dupont',
    NULL,
    NULL,
    NULL,
    'PASSEPORT',
    'PARIS',
    '33333333-3333-4333-8333-333333333303'::uuid,
    '[{"id":"33333333-3333-4333-8333-333333333303","slotId":"33333333-3333-4333-8333-333333333303","index":1,"start":"2026-11-10T09:00:00+01:00","end":"2026-11-10T09:30:00+01:00","service":"PASSEPORT","site":"PARIS"}]'::jsonb,
    1,
    NULL,
    NULL,
    NULL,
    NULL,
    DATE '2026-11-10',
    DATE '2026-11-14',
    NOW() - INTERVAL '1 hour',
    NOW()
  )
ON CONFLICT (session_id) DO UPDATE
SET
  intent = EXCLUDED.intent,
  pending_action = EXCLUDED.pending_action,
  conversation_step = EXCLUDED.conversation_step,
  nom = EXCLUDED.nom,
  prenom = EXCLUDED.prenom,
  email = EXCLUDED.email,
  telephone = EXCLUDED.telephone,
  service = EXCLUDED.service,
  site = EXCLUDED.site,
  slot_id = EXCLUDED.slot_id,
  available_slots = EXCLUDED.available_slots,
  selected_slot_index = EXCLUDED.selected_slot_index,
  last_user_message = EXCLUDED.last_user_message,
  reference = EXCLUDED.reference,
  token = EXCLUDED.token,
  new_slot_id = EXCLUDED.new_slot_id,
  date_debut = EXCLUDED.date_debut,
  date_fin = EXCLUDED.date_fin,
  expires_at = EXCLUDED.expires_at,
  updated_at = EXCLUDED.updated_at;

-- -----------------------------------------------------------------------------
-- 2) Postflight — preuve sans PII (booléens / longueurs)
-- -----------------------------------------------------------------------------
SELECT
  s.session_id,
  s.intent,
  s.pending_action,
  s.conversation_step,
  (s.nom IS NOT NULL AND length(btrim(s.nom)) > 0) AS nom_present,
  length(COALESCE(s.nom, '')) AS nom_len,
  (s.prenom IS NULL) AS prenom_is_null,
  (s.expires_at IS NOT NULL AND s.expires_at > NOW()) AS ttl_in_future,
  (s.expires_at IS NOT NULL AND s.expires_at <= NOW()) AS session_expired_now,
  s.expires_at
FROM public.ai_conversation_state AS s
WHERE s.session_id IN (
  'rec008-runtime013-r01-active',
  'rec008-runtime013-r02-expired',
  'rec008-runtime013-r03-resume'
)
ORDER BY s.session_id;

SELECT
  format(
    '%s|%s|%s|%s',
    (SELECT count(*) FROM public.rendez_vous),
    (SELECT count(*) FROM public.ai_conversation_state),
    (SELECT count(*) FROM public.ai_appointment_attempt),
    (SELECT count(*) FROM public.notifications)
  ) AS fingerprint_after;

-- -----------------------------------------------------------------------------
-- ROLLBACK ciblé (3 ids seulement — NE PAS exécuter en chaîne avec le seed)
-- -----------------------------------------------------------------------------
-- DELETE FROM public.ai_conversation_state
-- WHERE session_id IN (
--   'rec008-runtime013-r01-active',
--   'rec008-runtime013-r02-expired',
--   'rec008-runtime013-r03-resume'
-- );
