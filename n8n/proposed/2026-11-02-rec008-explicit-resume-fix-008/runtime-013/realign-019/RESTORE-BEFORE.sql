-- restore rec008-runtime013-r01-active
UPDATE ai_conversation_state SET
  intent = 'CREATE_APPOINTMENT',
  pending_action = 'CREATE_APPOINTMENT',
  conversation_step = 'ASK_PRENOM',
  service = 'PASSEPORT',
  site = 'PARIS',
  date_debut = '2026-11-10'::date,
  date_fin = '2026-11-14'::date,
  slot_id = '33333333-3333-4333-8333-333333333301'::uuid,
  selected_slot_index = 1,
  available_slots = '[{"id":"33333333-3333-4333-8333-333333333301","end":"2026-11-10T09:30:00+01:00","site":"PARIS","index":1,"start":"2026-11-10T09:00:00+01:00","slotId":"33333333-3333-4333-8333-333333333301","service":"PASSEPORT"}]'::jsonb,
  nom = 'Dupont',
  prenom = NULL,
  email = NULL,
  telephone = NULL,
  last_user_message = NULL,
  expires_at = '2026-11-06 01:04:42.112791+01'::timestamptz,
  updated_at = '2026-11-05 23:04:42.112791+01'::timestamptz
WHERE session_id = 'rec008-runtime013-r01-active';

-- restore rec008-runtime013-r02-expired
UPDATE ai_conversation_state SET
  intent = 'GENERAL',
  pending_action = 'CREATE_APPOINTMENT',
  conversation_step = 'ASK_PRENOM',
  service = 'PASSEPORT',
  site = 'PARIS',
  date_debut = '2026-11-10'::date,
  date_fin = '2026-11-14'::date,
  slot_id = '33333333-3333-4333-8333-333333333302'::uuid,
  selected_slot_index = 1,
  available_slots = '[{"id":"33333333-3333-4333-8333-333333333302","end":"2026-11-10T09:30:00+01:00","site":"PARIS","index":1,"start":"2026-11-10T09:00:00+01:00","slotId":"33333333-3333-4333-8333-333333333302","service":"PASSEPORT"}]'::jsonb,
  nom = 'Dupont',
  prenom = NULL,
  email = NULL,
  telephone = NULL,
  last_user_message = NULL,
  expires_at = '2026-11-05 22:04:42.112791+01'::timestamptz,
  updated_at = '2026-11-05 23:04:42.112791+01'::timestamptz
WHERE session_id = 'rec008-runtime013-r02-expired';

-- restore rec008-runtime013-r03-resume
UPDATE ai_conversation_state SET
  intent = 'GENERAL',
  pending_action = 'CREATE_APPOINTMENT',
  conversation_step = 'ASK_PRENOM',
  service = 'PASSEPORT',
  site = 'PARIS',
  date_debut = '2026-11-10'::date,
  date_fin = '2026-11-14'::date,
  slot_id = '33333333-3333-4333-8333-333333333303'::uuid,
  selected_slot_index = 1,
  available_slots = '[{"id":"33333333-3333-4333-8333-333333333303","end":"2026-11-10T09:30:00+01:00","site":"PARIS","index":1,"start":"2026-11-10T09:00:00+01:00","slotId":"33333333-3333-4333-8333-333333333303","service":"PASSEPORT"}]'::jsonb,
  nom = 'Dupont',
  prenom = NULL,
  email = NULL,
  telephone = NULL,
  last_user_message = NULL,
  expires_at = '2026-11-05 22:04:42.112791+01'::timestamptz,
  updated_at = '2026-11-05 23:04:42.112791+01'::timestamptz
WHERE session_id = 'rec008-runtime013-r03-resume';
