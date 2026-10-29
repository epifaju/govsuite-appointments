-- Schéma observé le 28 octobre 2026 sur la base govsuite.
-- Reproduit public.ai_conversation_state sans modifier les lignes existantes.
-- Dépend de gen_random_uuid(), fourni par pgcrypto (déjà créé par postgres/init.sql).
-- CREATE TABLE IF NOT EXISTS n'aligne pas une table déjà présente :
-- si la table existe, ce script n'ajoute ni ne modifie aucune colonne.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.ai_conversation_state (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id character varying(255) NOT NULL,
    intent character varying(50),
    service character varying(50),
    site character varying(100),
    date_debut date,
    date_fin date,
    slot_id uuid,
    token uuid,
    new_slot_id uuid,
    reference character varying(100),
    nom character varying(150),
    prenom character varying(150),
    email character varying(255),
    telephone character varying(50),
    last_user_message text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    expires_at timestamp with time zone,
    available_slots jsonb,
    selected_slot_index integer,
    pending_action character varying(50),
    conversation_step character varying(50),
    CONSTRAINT ai_conversation_state_session_id_key UNIQUE (session_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_conversation_state_expires
    ON public.ai_conversation_state USING btree (expires_at);

CREATE INDEX IF NOT EXISTS idx_ai_conversation_state_session
    ON public.ai_conversation_state USING btree (session_id);
