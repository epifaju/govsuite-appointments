/**
 * Simulation hors ligne de PROPOSED_FIX_C.sql (sémantique UPSERT).
 * Aucune base réelle.
 */
'use strict';

const FIELD_MAP = {
  intent: 'intent',
  service: 'service',
  site: 'site',
  dateDebut: 'date_debut',
  dateFin: 'date_fin',
  slotId: 'slot_id',
  token: 'token',
  newSlotId: 'new_slot_id',
  reference: 'reference',
  nom: 'nom',
  prenom: 'prenom',
  email: 'email',
  telephone: 'telephone',
  pendingAction: 'pending_action',
  conversationStep: 'conversation_step',
  availableSlots: 'available_slots',
  selectedSlotIndex: 'selected_slot_index',
  originalMessage: 'last_user_message',
};

function hasMeaningful(value) {
  return value !== null && value !== undefined && value !== '' && value !== 'null' && value !== 'undefined';
}

/**
 * @param {object|null} existing row snake_case
 * @param {object} payload camelCase JSON as Sauvegarder would receive
 */
function applySaveGuard(existing, payload) {
  const prev = existing ? { ...existing } : {};
  const authorized = new Set(
    Array.isArray(payload._authorizedNulls) ? payload._authorizedNulls : []
  );
  const refresh =
    payload.refreshSessionTtl === undefined ? true : !!payload.refreshSessionTtl;
  const now = payload.__now ? new Date(payload.__now) : new Date();
  const out = { ...prev };

  for (const [jsonKey, col] of Object.entries(FIELD_MAP)) {
    if (!Object.prototype.hasOwnProperty.call(payload, jsonKey)) {
      continue; // absent → keep
    }
    const val = payload[jsonKey];
    if (hasMeaningful(val)) {
      out[col] = val;
    } else if (authorized.has(jsonKey)) {
      out[col] = null;
    }
    // else null non autorisé → keep previous
  }

  out.updated_at = now.toISOString();
  if (refresh) {
    out.expires_at = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
  } else if (prev.expires_at) {
    out.expires_at = prev.expires_at;
  } else {
    out.expires_at = now.toISOString();
  }

  return out;
}

module.exports = { applySaveGuard, FIELD_MAP, hasMeaningful };
