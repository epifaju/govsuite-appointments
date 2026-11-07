SELECT
  id::text AS attempt_id,
  status AS attempt_status,
  appointment_reference,
  lease_until,
  expires_at,
  resume_count
FROM public.ai_appointment_attempt
WHERE session_id = $1
  AND status IN ('AWAITING_CONFIRMATION', 'SUBMITTING', 'UNCERTAIN', 'CONFIRMED')
ORDER BY created_at DESC
LIMIT 1;