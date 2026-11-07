-- =============================================================================
-- MISSION 035 — seed-r04-c.sql (PROPOSITION LOCALE — NON APPLIQUÉ)
-- =============================================================================
-- Scénario   : R04-C — ASK_EMAIL + TTL EXPIRÉ (expires_at < NOW())
-- Session    : rec008-r04c-035-expired-ask-email
-- Conteneur  : govsuite-rec008-test-rec008-postgres-1 (TEST only)
-- DB         : govsuite_rec008_test
-- INTERDIT   : LIVE ; psql sans autorisation runtime distincte ; truncate massif
-- Conflit    : session_id DISTINCT des R01–R03 (rec008-runtime013-r0{1,2,3}-*)
-- Chat futur : email synthétique valide camille.r04c.035@example.test (ne doit PAS capturer)
-- openAttempts attendu : 0
-- Analogie   : R02 ASK_PRENOM expiré — early-return session_expired ; TTL figé
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
  'rec008-r04c-035-expired-ask-email',
  'CREATE_APPOINTMENT',
  'CREATE_APPOINTMENT',
  'ASK_EMAIL',
  'Dupont',
  'Camille',
  NULL,
  NULL,
  'PASSEPORT',
  'PARIS',
  '44444444-4444-4444-8444-444444444303'::uuid,
  '[{"id":"44444444-4444-4444-8444-444444444303","slotId":"44444444-4444-4444-8444-444444444303","index":1,"start":"2026-11-12T09:00:00+01:00","end":"2026-11-12T09:30:00+01:00","service":"PASSEPORT","site":"PARIS"}]'::jsonb,
  1,
  NULL,
  NULL,
  NULL,
  NULL,
  DATE '2026-11-10',
  DATE '2026-11-20',
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

-- ROLLBACK ciblé (séparé — voir cleanup-r04.sql) :
-- DELETE FROM public.ai_conversation_state
-- WHERE session_id = 'rec008-r04c-035-expired-ask-email';
