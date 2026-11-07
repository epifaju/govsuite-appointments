-- =============================================================================
-- MISSION 035 — verify-r04-select.sql (LECTURE SEULE — Present/Len)
-- =============================================================================
-- Contrat : tests/rec008/readiness/R031-r04-abc-sql-contract.json
--           preflightSelectContract.sharedTemplate + attemptsSideCheck
-- INTERDIT dans preuves : nom/prenom/email/telephone/last_user_message en clair
-- Autorisé : Present / Len / ttlActive / sessionExpired / openAttempts / step
-- Remplacer :session_id par l'id cible (A/B/C) — pas de $1 psql implicite ici
-- =============================================================================
-- NOT AUTHORIZED — ne pas exécuter sans autorisation runtime lecture TEST.
-- Aucun INSERT/UPDATE/DELETE dans ce fichier.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- R04-A
-- -----------------------------------------------------------------------------
SELECT
  conversation_step,
  (nom IS NOT NULL AND btrim(nom) <> '') AS "nomPresent",
  COALESCE(length(nom), 0) AS "nomLen",
  (prenom IS NOT NULL AND btrim(prenom) <> '') AS "prenomPresent",
  COALESCE(length(prenom), 0) AS "prenomLen",
  (email IS NOT NULL AND btrim(email) <> '') AS "emailPresent",
  COALESCE(length(email), 0) AS "emailLen",
  (telephone IS NOT NULL AND btrim(telephone) <> '') AS "telephonePresent",
  COALESCE(length(telephone), 0) AS "telephoneLen",
  (slot_id IS NOT NULL) AS "slotIdPresent",
  (expires_at IS NOT NULL AND expires_at > NOW()) AS "ttlActive",
  (expires_at IS NOT NULL AND expires_at <= NOW()) AS "sessionExpired",
  expires_at,
  updated_at
FROM public.ai_conversation_state
WHERE session_id = 'rec008-r04a-035-active-ask-email'
LIMIT 1;

SELECT COUNT(*)::int AS "openAttempts"
FROM public.ai_appointment_attempt
WHERE session_id = 'rec008-r04a-035-active-ask-email'
  AND status IN ('AWAITING_CONFIRMATION', 'SUBMITTING', 'UNCERTAIN', 'CONFIRMED');

-- -----------------------------------------------------------------------------
-- R04-B
-- -----------------------------------------------------------------------------
SELECT
  conversation_step,
  (nom IS NOT NULL AND btrim(nom) <> '') AS "nomPresent",
  COALESCE(length(nom), 0) AS "nomLen",
  (prenom IS NOT NULL AND btrim(prenom) <> '') AS "prenomPresent",
  COALESCE(length(prenom), 0) AS "prenomLen",
  (email IS NOT NULL AND btrim(email) <> '') AS "emailPresent",
  COALESCE(length(email), 0) AS "emailLen",
  (telephone IS NOT NULL AND btrim(telephone) <> '') AS "telephonePresent",
  COALESCE(length(telephone), 0) AS "telephoneLen",
  (slot_id IS NOT NULL) AS "slotIdPresent",
  (expires_at IS NOT NULL AND expires_at > NOW()) AS "ttlActive",
  (expires_at IS NOT NULL AND expires_at <= NOW()) AS "sessionExpired",
  expires_at,
  updated_at
FROM public.ai_conversation_state
WHERE session_id = 'rec008-r04b-035-active-ask-email'
LIMIT 1;

SELECT COUNT(*)::int AS "openAttempts"
FROM public.ai_appointment_attempt
WHERE session_id = 'rec008-r04b-035-active-ask-email'
  AND status IN ('AWAITING_CONFIRMATION', 'SUBMITTING', 'UNCERTAIN', 'CONFIRMED');

-- -----------------------------------------------------------------------------
-- R04-C
-- -----------------------------------------------------------------------------
SELECT
  conversation_step,
  (nom IS NOT NULL AND btrim(nom) <> '') AS "nomPresent",
  COALESCE(length(nom), 0) AS "nomLen",
  (prenom IS NOT NULL AND btrim(prenom) <> '') AS "prenomPresent",
  COALESCE(length(prenom), 0) AS "prenomLen",
  (email IS NOT NULL AND btrim(email) <> '') AS "emailPresent",
  COALESCE(length(email), 0) AS "emailLen",
  (telephone IS NOT NULL AND btrim(telephone) <> '') AS "telephonePresent",
  COALESCE(length(telephone), 0) AS "telephoneLen",
  (slot_id IS NOT NULL) AS "slotIdPresent",
  (expires_at IS NOT NULL AND expires_at > NOW()) AS "ttlActive",
  (expires_at IS NOT NULL AND expires_at <= NOW()) AS "sessionExpired",
  expires_at,
  updated_at
FROM public.ai_conversation_state
WHERE session_id = 'rec008-r04c-035-expired-ask-email'
LIMIT 1;

SELECT COUNT(*)::int AS "openAttempts"
FROM public.ai_appointment_attempt
WHERE session_id = 'rec008-r04c-035-expired-ask-email'
  AND status IN ('AWAITING_CONFIRMATION', 'SUBMITTING', 'UNCERTAIN', 'CONFIRMED');

-- -----------------------------------------------------------------------------
-- Attendu AFTER seed (docs) — ne pas SELECT clair :
-- A/B : step=ASK_EMAIL ; nomPresent/prenomPresent/slotIdPresent=true ;
--       emailPresent=false ; emailLen=0 ; telephonePresent=false ;
--       ttlActive=true ; sessionExpired=false ; openAttempts=0
-- C   : idem identité/slot/email absents ; ttlActive=false ; sessionExpired=true ;
--       openAttempts=0
-- -----------------------------------------------------------------------------
