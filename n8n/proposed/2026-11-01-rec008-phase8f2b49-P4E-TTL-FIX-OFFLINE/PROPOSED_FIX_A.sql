-- PROPOSED_FIX_A.sql
-- Phase 8F-2B49-P4E — HORIZONTAL ONLY / NON INSTALLÉ
-- Nœud cible : « Charger état conversation »
--
-- Objectif :
--   Identifier une session (active OU expirée) sans la traiter automatiquement
--   comme active. Exposer des drapeaux techniques pour Parser / Fusionner / Gérer.
--   Ne pas exposer ces drapeaux dans une réponse publique.
--
-- Politique :
--   TTL conversationnel ≠ TTL tentative (ai_appointment_attempt).

-- AVANT (VC8) :
-- SELECT *
-- FROM ai_conversation_state
-- WHERE session_id = $1
--   AND (
--       expires_at IS NULL
--       OR expires_at > NOW()
--   )
-- LIMIT 1;

-- APRÈS (proposé) :
SELECT
    s.session_id,
    s.intent,
    s.service,
    s.site,
    s.date_debut,
    s.date_fin,
    s.slot_id,
    s.token,
    s.new_slot_id,
    s.reference,
    s.nom,
    s.prenom,
    s.email,
    s.telephone,
    s.pending_action,
    s.conversation_step,
    s.available_slots,
    s.selected_slot_index,
    s.last_user_message,
    s.created_at,
    s.updated_at,
    s.expires_at,
    TRUE AS session_found,
    (s.expires_at IS NOT NULL AND s.expires_at <= NOW()) AS session_expired,
    s.expires_at AS session_expires_at,
    s.conversation_step AS "conversationStep",
    s.pending_action AS "pendingAction"
FROM ai_conversation_state AS s
WHERE s.session_id = $1
LIMIT 1;

-- Remplacement n8n (inchangé) :
-- queryReplacement = {{ $json.sessionId }}
-- alwaysOutputData = true
--
-- Si aucune ligne : n8n émet un objet vide → Joindre doit poser
--   sessionFound=false, sessionExpired=false, sessionExpiresAt=null.
--
-- Interdit :
--   - prolonger expires_at dans ce nœud ;
--   - filtrer hors les lignes expirées ;
--   - appeler CreateAppointment.
