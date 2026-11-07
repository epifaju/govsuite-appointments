
BEGIN;

WITH tgt AS (
  SELECT unnest(ARRAY[
    'rec008-runtime013-r01-active',
    'rec008-runtime013-r02-expired',
    'rec008-runtime013-r03-resume'
  ]) AS session_id
),
upd AS (
  UPDATE ai_conversation_state AS s SET
    intent = CASE s.session_id
      WHEN 'rec008-runtime013-r01-active' THEN 'CREATE_APPOINTMENT'
      ELSE 'GENERAL'
    END,
    pending_action = 'CREATE_APPOINTMENT',
    conversation_step = 'ASK_PRENOM',
    service = 'PASSEPORT',
    site = 'PARIS',
    date_debut = DATE '2026-11-10',
    date_fin = DATE '2026-11-14',
    slot_id = CASE s.session_id
      WHEN 'rec008-runtime013-r01-active' THEN '33333333-3333-4333-8333-333333333301'::uuid
      WHEN 'rec008-runtime013-r02-expired' THEN '33333333-3333-4333-8333-333333333302'::uuid
      WHEN 'rec008-runtime013-r03-resume' THEN '33333333-3333-4333-8333-333333333303'::uuid
    END,
    selected_slot_index = 1,
    available_slots = CASE s.session_id
      WHEN 'rec008-runtime013-r01-active' THEN '[{"id":"33333333-3333-4333-8333-333333333301","slotId":"33333333-3333-4333-8333-333333333301","index":1,"start":"2026-11-10T09:00:00+01:00","end":"2026-11-10T09:30:00+01:00","service":"PASSEPORT","site":"PARIS"}]'::jsonb
      WHEN 'rec008-runtime013-r02-expired' THEN '[{"id":"33333333-3333-4333-8333-333333333302","slotId":"33333333-3333-4333-8333-333333333302","index":1,"start":"2026-11-10T09:00:00+01:00","end":"2026-11-10T09:30:00+01:00","service":"PASSEPORT","site":"PARIS"}]'::jsonb
      WHEN 'rec008-runtime013-r03-resume' THEN '[{"id":"33333333-3333-4333-8333-333333333303","slotId":"33333333-3333-4333-8333-333333333303","index":1,"start":"2026-11-10T09:00:00+01:00","end":"2026-11-10T09:30:00+01:00","service":"PASSEPORT","site":"PARIS"}]'::jsonb
    END,
    nom = 'Dupont',
    prenom = NULL,
    email = NULL,
    telephone = NULL,
    last_user_message = NULL,
    reference = NULL,
    token = NULL,
    new_slot_id = NULL,
    expires_at = CASE s.session_id
      WHEN 'rec008-runtime013-r01-active' THEN NOW() + INTERVAL '2 hours'
      ELSE NOW() - INTERVAL '1 hour'
    END,
    updated_at = NOW()
  FROM tgt
  WHERE s.session_id = tgt.session_id
  RETURNING s.session_id
)
SELECT 'ROWS=' || count(*)::text FROM upd;

COMMIT;
