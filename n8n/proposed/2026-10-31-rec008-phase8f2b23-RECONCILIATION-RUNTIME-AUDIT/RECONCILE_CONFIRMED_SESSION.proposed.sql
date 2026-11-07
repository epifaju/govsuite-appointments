-- RECONCILE_CONFIRMED_SESSION (PROPOSAL ONLY — DO NOT EXECUTE IN 8F-2B23)
-- Atomic, idempotent session cleanup when attempt is already CONFIRMED.
WITH confirmed AS (
  SELECT a.id, a.session_id, a.appointment_reference, a.appointment_id
  FROM public.ai_appointment_attempt a
  WHERE a.session_id = $1::text
    AND a.id = $2::uuid
    AND a.status = 'CONFIRMED'
    AND a.appointment_reference IS NOT NULL
    AND length(a.appointment_reference) >= 1
    AND a.appointment_reference = $3::text
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
    token = NULL,  -- never invent; attempt has no token column
    updated_at = clock_timestamp(),
    expires_at = clock_timestamp() + interval '2 hours'
  FROM confirmed c
  WHERE s.session_id = c.session_id
    AND s.session_id = $1::text
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
-- Bindings: $1=session_id, $2=attempt_id, $3=expected_reference
-- Second pass: confirmed_matched=1, sessions_updated=0 (step already null / reference set) → idempotent no-op.
-- Does NOT touch ai_appointment_attempt rows (CONFIRMED or ABANDONED).
-- Does NOT call reclamer_*, CreateAppointment, or invent tokens.