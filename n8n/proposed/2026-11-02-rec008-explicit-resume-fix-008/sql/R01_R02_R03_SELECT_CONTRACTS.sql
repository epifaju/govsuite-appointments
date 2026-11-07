-- =============================================================================
-- TEST-INSTALL-READINESS-009 — Contrats SELECT R01 / R02 / R03 (proposition)
-- =============================================================================
-- Mode : PROPOSITION LOCALE UNIQUEMENT.
-- INTERDIT sans autorisation runtime dédiée :
--   psql, Docker, BEGIN métier, mutation, LIVE, POST CreateAppointment.
-- Réutilise le pattern S03_SELECT_BEFORE_AFTER.sql (empreintes, pas de filtre TTL).
-- Aucune PII réelle : booléens / longueurs uniquement.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- R01 — APRÈS message Camille (session ACTIVE)
-- Session : rec008-syn-r009-r01-active-camille
-- Attendu : prenom capturé, step ASK_EMAIL, TTL futur, draft nom présent, 0 attempt
-- -----------------------------------------------------------------------------
WITH target AS (
  SELECT 'rec008-syn-r009-r01-active-camille'::text AS session_id
)
SELECT
  s.session_id,
  (s.expires_at IS NOT NULL AND s.expires_at > NOW()) AS ttl_in_future,
  (
    s.expires_at IS NOT NULL
    AND s.expires_at >= NOW() + INTERVAL '1 hour 50 minutes'
    AND s.expires_at <= NOW() + INTERVAL '2 hours 10 minutes'
  ) AS ttl_approx_plus_2h,
  s.pending_action,
  s.conversation_step,
  (s.nom IS NOT NULL AND length(btrim(s.nom)) > 0) AS nom_present,
  (s.prenom IS NOT NULL AND length(btrim(s.prenom)) > 0) AS prenom_present,
  length(COALESCE(s.prenom, '')) AS prenom_len,
  (lower(COALESCE(s.prenom, '')) = 'camille') AS prenom_is_camille,
  (
    s.conversation_step = 'ASK_EMAIL'
    AND s.pending_action = 'CREATE_APPOINTMENT'
    AND s.prenom IS NOT NULL
    AND (s.expires_at IS NOT NULL AND s.expires_at > NOW())
  ) AS r01_contract_ok,
  (
    SELECT count(*)::int
    FROM public.ai_appointment_attempt a
    WHERE a.session_id = s.session_id
      AND a.status IN ('AWAITING_CONFIRMATION', 'SUBMITTING', 'UNCERTAIN', 'CONFIRMED')
  ) AS open_attempts
FROM public.ai_conversation_state AS s
INNER JOIN target AS t ON t.session_id = s.session_id;

-- -----------------------------------------------------------------------------
-- R02 — APRÈS message Camille (session EXPIRÉE, free-text non-reprise)
-- Session : rec008-syn-r009-r02-expired-camille
-- Attendu : TTL non renouvelé, prenom null, step ASK_PRENOM, draft conservé
-- -----------------------------------------------------------------------------
WITH target AS (
  SELECT 'rec008-syn-r009-r02-expired-camille'::text AS session_id
),
before_snapshot AS (
  -- Remplacer par expires_at préflight si runtime autorisé ; NULL hors runtime.
  SELECT NULL::timestamptz AS expires_at_before
)
SELECT
  s.session_id,
  (s.expires_at IS NOT NULL AND s.expires_at <= NOW()) AS session_expired_now,
  s.expires_at,
  b.expires_at_before,
  CASE
    WHEN b.expires_at_before IS NULL OR s.expires_at IS NULL THEN NULL
    ELSE EXTRACT(EPOCH FROM (s.expires_at - b.expires_at_before))::bigint
  END AS ttl_delta_seconds,
  (s.expires_at IS NOT NULL AND s.expires_at > NOW()) AS ttl_was_refreshed_bug,
  s.pending_action,
  s.conversation_step,
  (s.nom IS NOT NULL AND length(btrim(s.nom)) > 0) AS nom_present,
  (s.prenom IS NULL) AS prenom_is_null,
  (lower(COALESCE(s.prenom, '')) = 'camille') AS prenom_is_camille_bug,
  (
    s.conversation_step = 'ASK_PRENOM'
    AND s.pending_action = 'CREATE_APPOINTMENT'
    AND s.prenom IS NULL
    AND (s.expires_at IS NOT NULL AND s.expires_at <= NOW())
  ) AS r02_contract_ok,
  (
    SELECT count(*)::int
    FROM public.ai_appointment_attempt a
    WHERE a.session_id = s.session_id
      AND a.status IN ('AWAITING_CONFIRMATION', 'SUBMITTING', 'UNCERTAIN', 'CONFIRMED')
  ) AS open_attempts
FROM public.ai_conversation_state AS s
INNER JOIN target AS t ON t.session_id = s.session_id
CROSS JOIN before_snapshot AS b;

-- -----------------------------------------------------------------------------
-- R03 — APRÈS message reprendre (contrat FIX-008)
-- Session : rec008-syn-r009-r03-expired-resume
-- Détail complet + vc9_bug_signature : voir S03_SELECT_BEFORE_AFTER.sql section B
-- -----------------------------------------------------------------------------
WITH target AS (
  SELECT 'rec008-syn-r009-r03-expired-resume'::text AS session_id
)
SELECT
  s.session_id,
  (s.expires_at IS NOT NULL AND s.expires_at > NOW()) AS ttl_in_future,
  (
    s.expires_at IS NOT NULL
    AND s.expires_at >= NOW() + INTERVAL '1 hour 50 minutes'
    AND s.expires_at <= NOW() + INTERVAL '2 hours 10 minutes'
  ) AS ttl_approx_plus_2h,
  s.pending_action,
  s.conversation_step,
  (s.nom IS NOT NULL AND length(btrim(s.nom)) > 0) AS nom_present,
  (s.prenom IS NULL) AS prenom_is_null,
  (lower(COALESCE(s.prenom, '')) = 'reprendre') AS prenom_is_reprendre,
  (
    s.conversation_step = 'ASK_PRENOM'
    AND s.pending_action = 'CREATE_APPOINTMENT'
    AND s.prenom IS NULL
    AND (s.expires_at IS NOT NULL AND s.expires_at > NOW())
  ) AS r03_fix008_contract_ok,
  (
    s.conversation_step = 'ASK_EMAIL'
    AND lower(COALESCE(s.prenom, '')) = 'reprendre'
  ) AS vc9_bug_signature,
  (
    SELECT count(*)::int
    FROM public.ai_appointment_attempt a
    WHERE a.session_id = s.session_id
      AND a.status IN ('AWAITING_CONFIRMATION', 'SUBMITTING', 'UNCERTAIN', 'CONFIRMED')
  ) AS open_attempts
FROM public.ai_conversation_state AS s
INNER JOIN target AS t ON t.session_id = s.session_id;

-- ROLLBACK : N/A (SELECT only). Aucune migration proposée.
