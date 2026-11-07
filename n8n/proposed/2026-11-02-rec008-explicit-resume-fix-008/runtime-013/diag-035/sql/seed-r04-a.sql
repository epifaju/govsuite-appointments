-- =============================================================================
-- MISSION 035 — seed-r04-a.sql (PROPOSITION LOCALE — NON APPLIQUÉ)
-- =============================================================================
-- Scénario   : R04-A — ASK_EMAIL + TTL actif + OPTION A slot
-- Session    : rec008-r04a-035-active-ask-email
-- Conteneur  : govsuite-rec008-test-rec008-postgres-1 (TEST only)
-- DB         : govsuite_rec008_test
-- INTERDIT   : LIVE ; psql sans autorisation runtime distincte ; truncate massif
-- Conflit    : session_id DISTINCT des R01–R03 (rec008-runtime013-r0{1,2,3}-*)
-- Chat futur : message synthétique valide camille.r04a.035@example.test (hors SQL)
-- openAttempts attendu : 0 (aucune ligne ai_appointment_attempt pour cet id)
-- =============================================================================
-- NOT AUTHORIZED — ne pas exécuter sans mission runtime + ordre humain explicite.
-- =============================================================================

-- Préflight collision (lecture seule si auth ultérieure) :
-- SELECT session_id FROM public.ai_conversation_state
-- WHERE session_id IN (
--   'rec008-runtime013-r01-active',
--   'rec008-runtime013-r02-expired',
--   'rec008-runtime013-r03-resume',
--   'rec008-r04a-035-active-ask-email',
--   'rec008-r04b-035-active-ask-email',
--   'rec008-r04c-035-expired-ask-email'
-- );

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
VALUES (
  'rec008-r04a-035-active-ask-email',
  'CREATE_APPOINTMENT',
  'CREATE_APPOINTMENT',
  'ASK_EMAIL',
  'Dupont',
  'Camille',
  NULL,
  NULL,
  'PASSEPORT',
  'PARIS',
  '44444444-4444-4444-8444-444444444301'::uuid,
  '[{"id":"44444444-4444-4444-8444-444444444301","slotId":"44444444-4444-4444-8444-444444444301","index":1,"start":"2026-11-12T09:00:00+01:00","end":"2026-11-12T09:30:00+01:00","service":"PASSEPORT","site":"PARIS"}]'::jsonb,
  1,
  NULL,
  NULL,
  NULL,
  NULL,
  DATE '2026-11-10',
  DATE '2026-11-20',
  NOW() + INTERVAL '2 hours',
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

-- ROLLBACK ciblé (séparé — voir cleanup-r04.sql) :
-- DELETE FROM public.ai_conversation_state
-- WHERE session_id = 'rec008-r04a-035-active-ask-email';
