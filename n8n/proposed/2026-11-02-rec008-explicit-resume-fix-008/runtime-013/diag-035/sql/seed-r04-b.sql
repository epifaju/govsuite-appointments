-- =============================================================================
-- MISSION 035 — seed-r04-b.sql (PROPOSITION LOCALE — NON APPLIQUÉ)
-- =============================================================================
-- Scénario   : R04-B — ASK_EMAIL + TTL actif (message invalide sera chat, hors SQL)
-- Session    : rec008-r04b-035-active-ask-email
-- Conteneur  : govsuite-rec008-test-rec008-postgres-1 (TEST only)
-- DB         : govsuite_rec008_test
-- INTERDIT   : LIVE ; psql sans autorisation runtime distincte ; truncate massif
-- Conflit    : session_id DISTINCT des R01–R03 (rec008-runtime013-r0{1,2,3}-*)
-- Chat futur : classe email_like_invalid_or_non_email (ex. pas-un-email) — hors SQL
-- openAttempts attendu : 0
-- =============================================================================
-- NOT AUTHORIZED — ne pas exécuter sans mission runtime + ordre humain explicite.
-- =============================================================================

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
  'rec008-r04b-035-active-ask-email',
  'CREATE_APPOINTMENT',
  'CREATE_APPOINTMENT',
  'ASK_EMAIL',
  'Dupont',
  'Camille',
  NULL,
  NULL,
  'PASSEPORT',
  'PARIS',
  '44444444-4444-4444-8444-444444444302'::uuid,
  '[{"id":"44444444-4444-4444-8444-444444444302","slotId":"44444444-4444-4444-8444-444444444302","index":1,"start":"2026-11-12T09:00:00+01:00","end":"2026-11-12T09:30:00+01:00","service":"PASSEPORT","site":"PARIS"}]'::jsonb,
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
-- WHERE session_id = 'rec008-r04b-035-active-ask-email';
