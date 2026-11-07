-- PROPOSED_FIX_C.sql
-- Phase 8F-2B49-P4E — HORS LIGNE / NON INSTALLÉ
-- Nœud cible : « Sauvegarder état conversation »
--
-- Objectif :
--   Distinguer champ absent / modifié / effacé autorisé.
--   Empêcher qu'un routage GENERAL/GET_SERVICES sans contexte
--   nullifie le brouillon encore stocké.
--
-- Sémantique retenue :
--   - clé JSON absente              → conserver la valeur existante
--   - clé présente avec valeur      → mettre à jour
--   - clé présente NULL/''         → conserver SAUF si _authorizedNulls contient le champ
--   - refreshSessionTtl=false       → ne pas prolonger expires_at (session expirée notifiée)
--   - refreshSessionTtl=true/absent → expires_at = NOW() + 2 hours (comportement actuel)
--
-- Les purges légitimes (abandon, confirmation Finaliser, expire tentative)
-- continuent d'utiliser leurs nœuds UPDATE dédiés ; elles peuvent aussi
-- passer _authorizedNulls via ce nœud si besoin.

WITH input AS (
    SELECT $1::jsonb AS data
),
prepared AS (
    SELECT
        NULLIF(data->>'sessionId', '') AS session_id,
        data AS payload,
        NULLIF(data->>'intent', '') AS intent,
        NULLIF(data->>'service', '') AS service,
        NULLIF(data->>'site', '') AS site,
        CASE
            WHEN NULLIF(data->>'dateDebut', '') IS NULL
              OR LOWER(data->>'dateDebut') IN ('null', 'undefined')
            THEN NULL
            ELSE (data->>'dateDebut')::date
        END AS date_debut,
        CASE
            WHEN NULLIF(data->>'dateFin', '') IS NULL
              OR LOWER(data->>'dateFin') IN ('null', 'undefined')
            THEN NULL
            ELSE (data->>'dateFin')::date
        END AS date_fin,
        CASE
            WHEN NULLIF(data->>'slotId', '') IS NULL
              OR LOWER(data->>'slotId') IN ('null', 'undefined')
            THEN NULL
            ELSE (data->>'slotId')::uuid
        END AS slot_id,
        CASE
            WHEN NULLIF(data->>'token', '') IS NULL
              OR LOWER(data->>'token') IN ('null', 'undefined')
            THEN NULL
            ELSE (data->>'token')::uuid
        END AS token,
        CASE
            WHEN NULLIF(data->>'newSlotId', '') IS NULL
              OR LOWER(data->>'newSlotId') IN ('null', 'undefined')
            THEN NULL
            ELSE (data->>'newSlotId')::uuid
        END AS new_slot_id,
        NULLIF(data->>'reference', '') AS reference,
        NULLIF(data->>'nom', '') AS nom,
        NULLIF(data->>'prenom', '') AS prenom,
        NULLIF(data->>'email', '') AS email,
        NULLIF(data->>'telephone', '') AS telephone,
        NULLIF(data->>'pendingAction', '') AS pending_action,
        NULLIF(data->>'conversationStep', '') AS conversation_step,
        CASE
            WHEN jsonb_typeof(data->'availableSlots') = 'array'
            THEN data->'availableSlots'
            ELSE NULL
        END AS available_slots,
        CASE
            WHEN NULLIF(data->>'selectedSlotIndex', '') IS NULL
              OR LOWER(data->>'selectedSlotIndex') IN ('null', 'undefined')
            THEN NULL
            ELSE (data->>'selectedSlotIndex')::integer
        END AS selected_slot_index,
        NULLIF(data->>'originalMessage', '') AS last_user_message,
        COALESCE((data->>'refreshSessionTtl')::boolean, true) AS refresh_session_ttl,
        COALESCE(data->'_authorizedNulls', '[]'::jsonb) AS authorized_nulls
    FROM input
),
existing AS (
    SELECT s.*
    FROM ai_conversation_state AS s
    INNER JOIN prepared AS p
        ON s.session_id = p.session_id
    FOR UPDATE
),
-- coalesce_field(key, new_typed, old) :
--   absent → old ; non-null → new ; null autorisé → NULL ; null non autorisé → old
resolved AS (
    SELECT
        p.session_id,
        CASE
            WHEN NOT (p.payload ? 'intent') THEN e.intent
            WHEN p.intent IS NOT NULL THEN p.intent
            WHEN p.authorized_nulls ? 'intent' THEN NULL
            ELSE e.intent
        END AS intent,
        CASE
            WHEN NOT (p.payload ? 'service') THEN e.service
            WHEN p.service IS NOT NULL THEN p.service
            WHEN p.authorized_nulls ? 'service' THEN NULL
            ELSE e.service
        END AS service,
        CASE
            WHEN NOT (p.payload ? 'site') THEN e.site
            WHEN p.site IS NOT NULL THEN p.site
            WHEN p.authorized_nulls ? 'site' THEN NULL
            ELSE e.site
        END AS site,
        CASE
            WHEN NOT (p.payload ? 'dateDebut') THEN e.date_debut
            WHEN p.date_debut IS NOT NULL THEN p.date_debut
            WHEN p.authorized_nulls ? 'dateDebut' THEN NULL
            ELSE e.date_debut
        END AS date_debut,
        CASE
            WHEN NOT (p.payload ? 'dateFin') THEN e.date_fin
            WHEN p.date_fin IS NOT NULL THEN p.date_fin
            WHEN p.authorized_nulls ? 'dateFin' THEN NULL
            ELSE e.date_fin
        END AS date_fin,
        CASE
            WHEN NOT (p.payload ? 'slotId') THEN e.slot_id
            WHEN p.slot_id IS NOT NULL THEN p.slot_id
            WHEN p.authorized_nulls ? 'slotId' THEN NULL
            ELSE e.slot_id
        END AS slot_id,
        CASE
            WHEN NOT (p.payload ? 'token') THEN e.token
            WHEN p.token IS NOT NULL THEN p.token
            WHEN p.authorized_nulls ? 'token' THEN NULL
            ELSE e.token
        END AS token,
        CASE
            WHEN NOT (p.payload ? 'newSlotId') THEN e.new_slot_id
            WHEN p.new_slot_id IS NOT NULL THEN p.new_slot_id
            WHEN p.authorized_nulls ? 'newSlotId' THEN NULL
            ELSE e.new_slot_id
        END AS new_slot_id,
        CASE
            WHEN NOT (p.payload ? 'reference') THEN e.reference
            WHEN p.reference IS NOT NULL THEN p.reference
            WHEN p.authorized_nulls ? 'reference' THEN NULL
            ELSE e.reference
        END AS reference,
        CASE
            WHEN NOT (p.payload ? 'nom') THEN e.nom
            WHEN p.nom IS NOT NULL THEN p.nom
            WHEN p.authorized_nulls ? 'nom' THEN NULL
            ELSE e.nom
        END AS nom,
        CASE
            WHEN NOT (p.payload ? 'prenom') THEN e.prenom
            WHEN p.prenom IS NOT NULL THEN p.prenom
            WHEN p.authorized_nulls ? 'prenom' THEN NULL
            ELSE e.prenom
        END AS prenom,
        CASE
            WHEN NOT (p.payload ? 'email') THEN e.email
            WHEN p.email IS NOT NULL THEN p.email
            WHEN p.authorized_nulls ? 'email' THEN NULL
            ELSE e.email
        END AS email,
        CASE
            WHEN NOT (p.payload ? 'telephone') THEN e.telephone
            WHEN p.telephone IS NOT NULL THEN p.telephone
            WHEN p.authorized_nulls ? 'telephone' THEN NULL
            ELSE e.telephone
        END AS telephone,
        CASE
            WHEN NOT (p.payload ? 'pendingAction') THEN e.pending_action
            WHEN p.pending_action IS NOT NULL THEN p.pending_action
            WHEN p.authorized_nulls ? 'pendingAction' THEN NULL
            ELSE e.pending_action
        END AS pending_action,
        CASE
            WHEN NOT (p.payload ? 'conversationStep') THEN e.conversation_step
            WHEN p.conversation_step IS NOT NULL THEN p.conversation_step
            WHEN p.authorized_nulls ? 'conversationStep' THEN NULL
            ELSE e.conversation_step
        END AS conversation_step,
        CASE
            WHEN NOT (p.payload ? 'availableSlots') THEN e.available_slots
            WHEN p.available_slots IS NOT NULL THEN p.available_slots
            WHEN p.authorized_nulls ? 'availableSlots' THEN NULL
            ELSE e.available_slots
        END AS available_slots,
        CASE
            WHEN NOT (p.payload ? 'selectedSlotIndex') THEN e.selected_slot_index
            WHEN p.selected_slot_index IS NOT NULL THEN p.selected_slot_index
            WHEN p.authorized_nulls ? 'selectedSlotIndex' THEN NULL
            ELSE e.selected_slot_index
        END AS selected_slot_index,
        CASE
            WHEN NOT (p.payload ? 'originalMessage') THEN e.last_user_message
            WHEN p.last_user_message IS NOT NULL THEN p.last_user_message
            WHEN p.authorized_nulls ? 'originalMessage' THEN NULL
            ELSE e.last_user_message
        END AS last_user_message,
        p.refresh_session_ttl,
        e.expires_at AS previous_expires_at
    FROM prepared AS p
    LEFT JOIN existing AS e
        ON e.session_id = p.session_id
)
INSERT INTO ai_conversation_state (
    session_id,
    intent,
    service,
    site,
    date_debut,
    date_fin,
    slot_id,
    token,
    new_slot_id,
    reference,
    nom,
    prenom,
    email,
    telephone,
    pending_action,
    conversation_step,
    available_slots,
    selected_slot_index,
    last_user_message,
    updated_at,
    expires_at
)
SELECT
    session_id,
    intent,
    service,
    site,
    date_debut,
    date_fin,
    slot_id,
    token,
    new_slot_id,
    reference,
    nom,
    prenom,
    email,
    telephone,
    pending_action,
    conversation_step,
    available_slots,
    selected_slot_index,
    last_user_message,
    NOW(),
    CASE
        WHEN refresh_session_ttl THEN NOW() + INTERVAL '2 hours'
        ELSE COALESCE(previous_expires_at, NOW())
    END
FROM resolved
ON CONFLICT (session_id) DO UPDATE SET
    intent = EXCLUDED.intent,
    service = EXCLUDED.service,
    site = EXCLUDED.site,
    date_debut = EXCLUDED.date_debut,
    date_fin = EXCLUDED.date_fin,
    slot_id = EXCLUDED.slot_id,
    token = EXCLUDED.token,
    new_slot_id = EXCLUDED.new_slot_id,
    reference = EXCLUDED.reference,
    nom = EXCLUDED.nom,
    prenom = EXCLUDED.prenom,
    email = EXCLUDED.email,
    telephone = EXCLUDED.telephone,
    pending_action = EXCLUDED.pending_action,
    conversation_step = EXCLUDED.conversation_step,
    available_slots = EXCLUDED.available_slots,
    selected_slot_index = EXCLUDED.selected_slot_index,
    last_user_message = EXCLUDED.last_user_message,
    updated_at = NOW(),
    expires_at = EXCLUDED.expires_at
RETURNING
    session_id AS "sessionId",
    intent,
    service,
    site,
    date_debut AS "dateDebut",
    date_fin AS "dateFin",
    slot_id AS "slotId",
    token,
    new_slot_id AS "newSlotId",
    reference,
    nom,
    prenom,
    email,
    telephone,
    pending_action AS "pendingAction",
    conversation_step AS "conversationStep",
    available_slots AS "availableSlots",
    selected_slot_index AS "selectedSlotIndex",
    last_user_message AS "originalMessage",
    created_at AS "createdAt",
    updated_at AS "updatedAt",
    expires_at AS "expiresAt";

-- queryReplacement inchangé : {{ JSON.stringify($json) }}
--
-- Contrat JS amont (Gérer / Fusionner) proposé :
--   preserveDraft=true  → omettre les clés métier null OU ne pas les mettre dans _authorizedNulls
--   authorizedClear     → _authorizedNulls: ["nom","prenom",...,"pendingAction","conversationStep"]
--   sessionExpired notify → refreshSessionTtl: false
