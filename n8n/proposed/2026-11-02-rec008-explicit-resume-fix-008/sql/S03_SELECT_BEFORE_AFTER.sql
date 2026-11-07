-- =============================================================================
-- EXPLICIT-RESUME-FIX-008 — Contrat SELECT avant / après S03
-- =============================================================================
-- Mode : PROPOSITION LOCALE UNIQUEMENT.
-- INTERDIT sans autorisation runtime dédiée :
--   exécution psql, Docker, BEGIN métier, mutation, LIVE, POST CreateAppointment.
-- Session synthétique : rec008-syn-s03-ask-prenom-resume
-- Aucune PII réelle : valeurs synthétiques / masquage uniquement.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A) SELECT AVANT S03 — préflight (session expirée, draft ASK_PRENOM)
-- Aligné Charger : pas de filtre WHERE expires_at > NOW() (lecture directe).
-- -----------------------------------------------------------------------------
-- Attendu préflight (assertions booléennes, pas de dump PII) :
--   session_found          = true
--   session_expired        = true   (expires_at <= NOW())
--   pending_action         = 'CREATE_APPOINTMENT'
--   conversation_step      = 'ASK_PRENOM'
--   nom_present            = true
--   prenom_is_null         = true
--   email_is_null          = true
--   telephone_is_null      = true
--   open_attempts          = 0
-- -----------------------------------------------------------------------------

WITH target AS (
  SELECT 'rec008-syn-s03-ask-prenom-resume'::text AS session_id
)
SELECT
  s.session_id,
  TRUE AS session_found,
  (s.expires_at IS NOT NULL AND s.expires_at <= NOW()) AS session_expired,
  s.expires_at,
  s.pending_action,
  s.conversation_step,
  s.intent,
  -- Empreintes sans PII
  (s.nom IS NOT NULL AND length(btrim(s.nom)) > 0) AS nom_present,
  length(COALESCE(s.nom, '')) AS nom_len,
  (s.prenom IS NULL) AS prenom_is_null,
  (s.email IS NULL) AS email_is_null,
  (s.telephone IS NULL) AS telephone_is_null,
  s.service,
  s.site,
  s.updated_at,
  (
    SELECT count(*)::int
    FROM public.ai_appointment_attempt a
    WHERE a.session_id = s.session_id
      AND a.status IN ('AWAITING_CONFIRMATION', 'SUBMITTING', 'UNCERTAIN', 'CONFIRMED')
  ) AS open_attempts
FROM public.ai_conversation_state AS s
INNER JOIN target AS t ON t.session_id = s.session_id;

-- -----------------------------------------------------------------------------
-- B) SELECT APRÈS S03 — postflight (contrat FIX-008, pas VC9-ACTUAL)
-- Après message allowlist « reprendre » + early return Gérer + Sauvegarder.
-- -----------------------------------------------------------------------------
-- Attendu postflight FIX-008 :
--   session_expired_now    = false  (expires_at > NOW())
--   ttl_refreshed          = true   (expires_at >= NOW() + interval '1 hour 50 min'
--                                    heuristique +2h ± marge horloge)
--   pending_action         = 'CREATE_APPOINTMENT'
--   conversation_step      = 'ASK_PRENOM'     -- I4 conservé
--   nom_present            = true              -- draft
--   prenom_is_null         = true              -- I3 pas « reprendre »
--   prenom_is_reprendre    = false
--   email_is_null          = true
--   telephone_is_null      = true
--   open_attempts          = 0                 -- pas de CLAIM
-- -----------------------------------------------------------------------------
-- Contre-exemple VC9-ACTUAL (BUG, avant FIX-008) à NE PAS accepter :
--   conversation_step = 'ASK_EMAIL' AND prenom ILIKE 'reprendre'
-- -----------------------------------------------------------------------------

WITH target AS (
  SELECT 'rec008-syn-s03-ask-prenom-resume'::text AS session_id
),
before_snapshot AS (
  -- Remplacer par expires_at capturé au SELECT A (preuve runtime autorisée).
  -- Placeholder offline : NULL → colonne ttl_delta_seconds reste NULL hors runtime.
  SELECT NULL::timestamptz AS expires_at_before
)
SELECT
  s.session_id,
  TRUE AS session_found,
  (s.expires_at IS NOT NULL AND s.expires_at <= NOW()) AS session_expired_now,
  s.expires_at,
  b.expires_at_before,
  CASE
    WHEN b.expires_at_before IS NULL OR s.expires_at IS NULL THEN NULL
    ELSE EXTRACT(EPOCH FROM (s.expires_at - b.expires_at_before))::bigint
  END AS ttl_delta_seconds,
  (s.expires_at IS NOT NULL AND s.expires_at > NOW()) AS ttl_in_future,
  (
    s.expires_at IS NOT NULL
    AND s.expires_at >= NOW() + INTERVAL '1 hour 50 minutes'
    AND s.expires_at <= NOW() + INTERVAL '2 hours 10 minutes'
  ) AS ttl_approx_plus_2h,
  s.pending_action,
  s.conversation_step,
  s.intent,
  (s.nom IS NOT NULL AND length(btrim(s.nom)) > 0) AS nom_present,
  length(COALESCE(s.nom, '')) AS nom_len,
  (s.prenom IS NULL) AS prenom_is_null,
  (lower(COALESCE(s.prenom, '')) = 'reprendre') AS prenom_is_reprendre,
  (s.email IS NULL) AS email_is_null,
  (s.telephone IS NULL) AS telephone_is_null,
  s.service,
  s.site,
  s.updated_at,
  (
    SELECT count(*)::int
    FROM public.ai_appointment_attempt a
    WHERE a.session_id = s.session_id
      AND a.status IN ('AWAITING_CONFIRMATION', 'SUBMITTING', 'UNCERTAIN', 'CONFIRMED')
  ) AS open_attempts,
  -- Verdicts booléens dérivés (contrat FIX-008)
  (
    s.conversation_step = 'ASK_PRENOM'
    AND s.pending_action = 'CREATE_APPOINTMENT'
    AND s.prenom IS NULL
    AND lower(COALESCE(s.prenom, '')) <> 'reprendre'
    AND (s.expires_at IS NOT NULL AND s.expires_at > NOW())
  ) AS fix008_s03_contract_ok,
  (
    s.conversation_step = 'ASK_EMAIL'
    AND lower(COALESCE(s.prenom, '')) = 'reprendre'
  ) AS vc9_bug_signature
FROM public.ai_conversation_state AS s
INNER JOIN target AS t ON t.session_id = s.session_id
CROSS JOIN before_snapshot AS b;

-- -----------------------------------------------------------------------------
-- C) Contrat SQL Sauvegarder — lecture seule des invariants (pas d'exécution)
-- Documenté aussi dans extracted/Sauvegarder_tat_conversation.sql (P4F) et
-- tests/rec008/lib/sql-contracts.cjs (assertSauvegarderContracts).
-- Sémantique attendue pour payload resume FIX-008 :
--
--   payload = {
--     sessionId, intent: 'CREATE_APPOINTMENT',
--     pendingAction, conversationStep: 'ASK_PRENOM',
--     nom: <previous>, prenom: null|previous, email, telephone, … draft,
--     refreshSessionTtl: true,
--     preserveDraft: true,          -- flag JS ; IGNORÉ par SQL
--     -- _authorizedNulls: ABSENT
--     originalMessage: 'reprendre'
--   }
--
-- Résolution colonnes identité (Fix C) :
--   clé absente            → retain existing
--   valeur non-null        → write
--   null SANS authorized   → retain existing   ← cas prenom null + preserveDraft
--   null AVEC authorized   → write NULL        ← abandon seulement
--
-- TTL :
--   refresh_session_ttl = COALESCE((data->>'refreshSessionTtl')::boolean, true)
--   expires_at = CASE WHEN refresh_session_ttl THEN NOW()+2h ELSE previous END
-- -----------------------------------------------------------------------------

-- ROLLBACK : N/A (SELECT only). Aucune migration proposée.
