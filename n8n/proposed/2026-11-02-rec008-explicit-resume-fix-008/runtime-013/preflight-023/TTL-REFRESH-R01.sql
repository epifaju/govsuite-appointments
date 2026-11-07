-- PREFLIGHT-023 — TTL refresh R01 ONLY (NOT executed in mission 023).
-- Execute ONLY under a future authorized R01 campaign, immediately before activate/chat.
-- Single session_id. Touches expires_at (+ updated_at) only. Rollback on assertion fail.
-- No PII in RAISE notices (counts / session_id synthétique only).

BEGIN;

-- Guard: exactly one target row matching R01 contract invariants
DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n
  FROM ai_conversation_state
  WHERE session_id = 'rec008-runtime013-r01-active'
    AND pending_action = 'CREATE_APPOINTMENT'
    AND conversation_step = 'ASK_PRENOM'
    AND prenom IS NULL
    AND slot_id IS NOT NULL
    AND available_slots IS NOT NULL
    AND jsonb_typeof(available_slots::jsonb) = 'array'
    AND jsonb_array_length(available_slots::jsonb) >= 1
    AND nom IS NOT NULL
    AND length(btrim(nom)) > 0
    AND date_debut IS NOT NULL
    AND date_fin IS NOT NULL
    AND (last_user_message IS NULL OR btrim(last_user_message) = '' OR last_user_message NOT ILIKE '%Camille%');

  IF n <> 1 THEN
    RAISE EXCEPTION 'TTL_R01_GUARD_FAIL expected 1 matching row got %', n;
  END IF;
END $$;

-- Ensure R02/R03 untouched counts pre-update (baseline fingerprint of targets)
DO $$
DECLARE
  n_other int;
BEGIN
  SELECT count(*) INTO n_other
  FROM ai_conversation_state
  WHERE session_id IN ('rec008-runtime013-r02-expired', 'rec008-runtime013-r03-resume');
  IF n_other <> 2 THEN
    RAISE EXCEPTION 'TTL_R01_R02R03_MISSING expected 2 got %', n_other;
  END IF;
END $$;

WITH upd AS (
  UPDATE ai_conversation_state
  SET
    expires_at = NOW() + INTERVAL '2 hours',
    updated_at = NOW()
  WHERE session_id = 'rec008-runtime013-r01-active'
    AND pending_action = 'CREATE_APPOINTMENT'
    AND conversation_step = 'ASK_PRENOM'
    AND prenom IS NULL
    AND slot_id IS NOT NULL
    AND available_slots IS NOT NULL
    AND nom IS NOT NULL
    AND length(btrim(nom)) > 0
  RETURNING session_id, expires_at > NOW() AS ttl_future
)
SELECT 'ROWS=' || count(*)::text || '|TTL_OK=' || bool_and(ttl_future)::text
FROM upd;

-- Assert exactly one row updated (parse by operator / wrapper)
DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n
  FROM ai_conversation_state
  WHERE session_id = 'rec008-runtime013-r01-active'
    AND expires_at > NOW();
  IF n <> 1 THEN
    RAISE EXCEPTION 'TTL_R01_POSTCHECK_FAIL ttl not future count=%', n;
  END IF;
END $$;

-- R02/R03 must remain expired (no accidental touch of expires_at)
DO $$
DECLARE
  n_live int;
BEGIN
  SELECT count(*) INTO n_live
  FROM ai_conversation_state
  WHERE session_id IN ('rec008-runtime013-r02-expired', 'rec008-runtime013-r03-resume')
    AND expires_at > NOW();
  IF n_live <> 0 THEN
    RAISE EXCEPTION 'TTL_R01_LEAK_R02R03 unexpected future ttl count=%', n_live;
  END IF;
END $$;

COMMIT;
