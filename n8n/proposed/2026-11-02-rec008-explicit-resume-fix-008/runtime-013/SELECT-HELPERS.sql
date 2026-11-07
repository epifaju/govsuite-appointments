-- =============================================================================
-- ASK-PRENOM-RUNTIME-013 — SELECT helpers (preuve / contrats, lecture seule)
-- =============================================================================
-- Aucune mutation. Empreintes sans PII (pas de nom/prénom/email en clair).
-- Lecture SQL directe : pas de filtre TTL n8n — session_expired calculé ici.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A) Empreinte globale + open attempts (autres tables non mutées)
-- -----------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM public.rendez_vous) AS rendez_vous,
  (SELECT count(*) FROM public.ai_conversation_state) AS ai_conversation_state,
  (SELECT count(*) FROM public.ai_appointment_attempt) AS ai_appointment_attempt,
  (SELECT count(*) FROM public.notifications) AS notifications,
  format(
    '%s|%s|%s|%s',
    (SELECT count(*) FROM public.rendez_vous),
    (SELECT count(*) FROM public.ai_conversation_state),
    (SELECT count(*) FROM public.ai_appointment_attempt),
    (SELECT count(*) FROM public.notifications)
  ) AS fingerprint;

SELECT count(*)::int AS open_attempts
FROM public.ai_appointment_attempt
WHERE status IN ('AWAITING_CONFIRMATION', 'SUBMITTING', 'UNCERTAIN');

-- -----------------------------------------------------------------------------
-- B) État des 3 fixtures RUNTIME-013 (preflight / post-message)
-- -----------------------------------------------------------------------------
SELECT
  s.session_id,
  s.intent,
  s.pending_action,
  s.conversation_step,
  (s.nom IS NOT NULL AND length(btrim(s.nom)) > 0) AS nom_present,
  length(COALESCE(s.nom, '')) AS nom_len,
  (lower(COALESCE(s.nom, '')) = 'dupont') AS nom_is_dupont,
  (s.prenom IS NULL) AS prenom_is_null,
  length(COALESCE(s.prenom, '')) AS prenom_len,
  (s.expires_at IS NOT NULL AND s.expires_at > NOW()) AS ttl_in_future,
  (s.expires_at IS NOT NULL AND s.expires_at <= NOW()) AS session_expired_now,
  s.expires_at,
  (
    SELECT count(*)::int
    FROM public.ai_appointment_attempt a
    WHERE a.session_id = s.session_id
      AND a.status IN ('AWAITING_CONFIRMATION', 'SUBMITTING', 'UNCERTAIN', 'CONFIRMED')
  ) AS open_attempts_for_session
FROM public.ai_conversation_state AS s
WHERE s.session_id IN (
  'rec008-runtime013-r01-active',
  'rec008-runtime013-r02-expired',
  'rec008-runtime013-r03-resume'
)
ORDER BY s.session_id;

-- -----------------------------------------------------------------------------
-- C) Contrats seed (avant message runtime)
-- -----------------------------------------------------------------------------
-- R01 active
WITH target AS (
  SELECT 'rec008-runtime013-r01-active'::text AS session_id
)
SELECT
  s.session_id,
  (
    s.intent = 'CREATE_APPOINTMENT'
    AND s.pending_action = 'CREATE_APPOINTMENT'
    AND s.conversation_step = 'ASK_PRENOM'
    AND s.prenom IS NULL
    AND s.nom IS NOT NULL
    AND s.expires_at IS NOT NULL
    AND s.expires_at > NOW()
  ) AS r01_seed_ok
FROM public.ai_conversation_state AS s
INNER JOIN target AS t ON t.session_id = s.session_id;

-- R02 expired (intent GENERAL — free-text non-reprise)
WITH target AS (
  SELECT 'rec008-runtime013-r02-expired'::text AS session_id
)
SELECT
  s.session_id,
  (
    s.intent = 'GENERAL'
    AND s.pending_action = 'CREATE_APPOINTMENT'
    AND s.conversation_step = 'ASK_PRENOM'
    AND s.prenom IS NULL
    AND s.nom IS NOT NULL
    AND s.expires_at IS NOT NULL
    AND s.expires_at <= NOW()
  ) AS r02_seed_ok
FROM public.ai_conversation_state AS s
INNER JOIN target AS t ON t.session_id = s.session_id;

-- R03 resume (indépendant ; expired ASK_PRENOM)
WITH target AS (
  SELECT 'rec008-runtime013-r03-resume'::text AS session_id
)
SELECT
  s.session_id,
  (
    s.pending_action = 'CREATE_APPOINTMENT'
    AND s.conversation_step = 'ASK_PRENOM'
    AND s.prenom IS NULL
    AND s.nom IS NOT NULL
    AND s.expires_at IS NOT NULL
    AND s.expires_at <= NOW()
  ) AS r03_seed_ok
FROM public.ai_conversation_state AS s
INNER JOIN target AS t ON t.session_id = s.session_id;

-- -----------------------------------------------------------------------------
-- D) Isolation — les 3 ids n'ont pas d'attempts ouverts
-- -----------------------------------------------------------------------------
SELECT
  a.session_id,
  a.status,
  count(*)::int AS n
FROM public.ai_appointment_attempt a
WHERE a.session_id IN (
  'rec008-runtime013-r01-active',
  'rec008-runtime013-r02-expired',
  'rec008-runtime013-r03-resume'
)
GROUP BY a.session_id, a.status
ORDER BY a.session_id, a.status;
