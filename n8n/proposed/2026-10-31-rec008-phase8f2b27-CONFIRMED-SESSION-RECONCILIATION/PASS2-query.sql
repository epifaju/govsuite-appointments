
WITH confirmed AS (
  SELECT a.id, a.session_id, a.appointment_reference, a.appointment_id
  FROM public.ai_appointment_attempt a
  WHERE a.session_id = 'rec008-8f2b14-new-01'::text
    AND a.id = 'ad71a155-4d3a-45b9-8445-2ec98377feaa'::uuid
    AND a.status = 'CONFIRMED'
    AND a.appointment_reference IS NOT NULL
    AND length(a.appointment_reference) >= 1
    AND a.appointment_reference = 'REC008-MOCK-0001'::text
),
updated AS (
  UPDATE public.ai_conversation_state s
  SET
    intent = NULL,
    service = NULL,
    site = NULL,
    date_debut = NULL,
    date_fin = NULL,
    slot_id = NULL,
    new_slot_id = NULL,
    available_slots = NULL,
    selected_slot_index = NULL,
    pending_action = NULL,
    conversation_step = NULL,
    nom = NULL,
    prenom = NULL,
    email = NULL,
    telephone = NULL,
    reference = c.appointment_reference,
    token = NULL,
    updated_at = clock_timestamp(),
    expires_at = clock_timestamp() + interval '2 hours'
  FROM confirmed c
  WHERE s.session_id = c.session_id
    AND s.session_id = 'rec008-8f2b14-new-01'::text
    AND (
      s.conversation_step = 'AWAIT_CREATE_CONFIRMATION'
      OR s.pending_action = 'CREATE_APPOINTMENT'
      OR coalesce(s.reference, '') = ''
    )
  RETURNING s.session_id, s.reference, s.conversation_step, s.pending_action, s.token
)
SELECT
  (SELECT count(*) FROM confirmed) AS confirmed_matched,
  (SELECT count(*) FROM updated) AS sessions_updated,
  (SELECT reference FROM updated LIMIT 1) AS reference_set,
  (SELECT conversation_step FROM updated LIMIT 1) AS step_after;
