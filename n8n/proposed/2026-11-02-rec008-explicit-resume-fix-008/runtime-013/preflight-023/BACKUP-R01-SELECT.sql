-- PREFLIGHT-023 — backup lecture seule avant TTL (campagne future).
-- Expurgé : pas de dump email/téléphone ; booléens + longueurs + ids synthétiques.

SELECT
  session_id,
  conversation_step,
  pending_action,
  CASE WHEN slot_id IS NOT NULL THEN true ELSE false END AS slot_id_present,
  slot_id::text AS slot_id_synth,
  CASE WHEN prenom IS NULL THEN true ELSE false END AS prenom_null,
  length(coalesce(prenom, '')) AS prenom_len,
  CASE WHEN nom IS NOT NULL AND length(btrim(nom)) > 0 THEN true ELSE false END AS nom_present,
  length(coalesce(nom, '')) AS nom_len,
  length(coalesce(last_user_message, '')) AS last_user_message_len,
  CASE WHEN last_user_message ILIKE '%Camille%' THEN true ELSE false END AS has_camille,
  expires_at::text,
  CASE WHEN expires_at > NOW() THEN true ELSE false END AS ttl_future,
  date_debut::text,
  date_fin::text,
  CASE WHEN available_slots IS NOT NULL THEN jsonb_array_length(available_slots::jsonb) ELSE 0 END AS slots_len,
  updated_at::text
FROM ai_conversation_state
WHERE session_id = 'rec008-runtime013-r01-active';
