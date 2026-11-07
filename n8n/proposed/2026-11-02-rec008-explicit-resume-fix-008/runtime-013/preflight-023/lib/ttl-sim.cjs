'use strict';

/**
 * Offline simulator for TTL-REFRESH-R01.sql — no PostgreSQL.
 */

const R01 = 'rec008-runtime013-r01-active';
const R02 = 'rec008-runtime013-r02-expired';
const R03 = 'rec008-runtime013-r03-resume';

function matchesR01Guard(row) {
  if (!row || row.session_id !== R01) return false;
  if (row.pending_action !== 'CREATE_APPOINTMENT') return false;
  if (row.conversation_step !== 'ASK_PRENOM') return false;
  if (row.prenom != null && row.prenom !== '') return false;
  if (!row.slot_id) return false;
  if (!Array.isArray(row.available_slots) || row.available_slots.length < 1) return false;
  if (!row.nom || !String(row.nom).trim()) return false;
  if (!row.date_debut || !row.date_fin) return false;
  const msg = row.last_user_message;
  if (msg && /Camille/i.test(String(msg))) return false;
  return true;
}

/**
 * @param {object[]} rows — mutable copies of sessions
 * @returns {{ ok: boolean, reason?: string, rowsAffected?: number, rows: object[] }}
 */
function applyTtlRefreshR01(rows) {
  const copy = rows.map((r) => ({ ...r, available_slots: Array.isArray(r.available_slots) ? [...r.available_slots] : r.available_slots }));
  const matching = copy.filter(matchesR01Guard);
  if (matching.length !== 1) {
    return { ok: false, reason: `TTL_R01_GUARD_FAIL expected 1 matching row got ${matching.length}`, rows: copy, rowsAffected: 0 };
  }
  const others = copy.filter((r) => r.session_id === R02 || r.session_id === R03);
  if (others.length !== 2) {
    return { ok: false, reason: `TTL_R01_R02R03_MISSING expected 2 got ${others.length}`, rows: copy, rowsAffected: 0 };
  }

  let affected = 0;
  for (const r of copy) {
    if (
      r.session_id === R01 &&
      r.pending_action === 'CREATE_APPOINTMENT' &&
      r.conversation_step === 'ASK_PRENOM' &&
      (r.prenom == null || r.prenom === '') &&
      r.slot_id &&
      r.available_slots &&
      r.nom
    ) {
      const beforeSlot = r.slot_id;
      const beforeDates = [r.date_debut, r.date_fin];
      const beforeNom = r.nom;
      r.expires_at = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
      r.ttl_future = true;
      r.updated_at = new Date().toISOString();
      // identity / slot / dates must not change
      if (r.slot_id !== beforeSlot || r.nom !== beforeNom || r.date_debut !== beforeDates[0] || r.date_fin !== beforeDates[1]) {
        return { ok: false, reason: 'identity_drift', rows: copy, rowsAffected: 0 };
      }
      affected += 1;
    }
  }
  if (affected !== 1) {
    return { ok: false, reason: `ROWS expected 1 got ${affected}`, rows: copy, rowsAffected: affected };
  }

  const r01 = copy.find((r) => r.session_id === R01);
  if (!r01 || !r01.ttl_future) {
    return { ok: false, reason: 'TTL_R01_POSTCHECK_FAIL', rows: copy, rowsAffected: affected };
  }
  const leak = copy.filter(
    (r) => (r.session_id === R02 || r.session_id === R03) && r.ttl_future === true,
  );
  if (leak.length) {
    return { ok: false, reason: `TTL_R01_LEAK_R02R03 count=${leak.length}`, rows: copy, rowsAffected: affected };
  }

  // R02/R03 expires_at unchanged
  for (const id of [R02, R03]) {
    const before = rows.find((r) => r.session_id === id);
    const after = copy.find((r) => r.session_id === id);
    if (before && after && before.expires_at !== after.expires_at) {
      return { ok: false, reason: 'R02R03_expires_mutated', rows: copy, rowsAffected: affected };
    }
  }

  return { ok: true, rowsAffected: affected, rows: copy };
}

function fixtureCompliant() {
  return [
    {
      session_id: R01,
      pending_action: 'CREATE_APPOINTMENT',
      conversation_step: 'ASK_PRENOM',
      prenom: null,
      slot_id: '33333333-3333-4333-8333-333333333301',
      available_slots: [{ id: '33333333-3333-4333-8333-333333333301' }],
      nom: 'Dupont',
      date_debut: '2026-11-10',
      date_fin: '2026-11-14',
      last_user_message: null,
      expires_at: '2026-11-06T00:05:47.000Z',
      ttl_future: false,
    },
    {
      session_id: R02,
      pending_action: 'CREATE_APPOINTMENT',
      conversation_step: 'ASK_PRENOM',
      prenom: null,
      slot_id: '33333333-3333-4333-8333-333333333302',
      available_slots: [{ id: 'x' }],
      nom: 'Dupont',
      date_debut: '2026-11-10',
      date_fin: '2026-11-14',
      last_user_message: null,
      expires_at: '2026-11-05T21:05:47.000Z',
      ttl_future: false,
    },
    {
      session_id: R03,
      pending_action: 'CREATE_APPOINTMENT',
      conversation_step: 'ASK_PRENOM',
      prenom: null,
      slot_id: '33333333-3333-4333-8333-333333333303',
      available_slots: [{ id: 'y' }],
      nom: 'Dupont',
      date_debut: '2026-11-10',
      date_fin: '2026-11-14',
      last_user_message: null,
      expires_at: '2026-11-05T21:05:47.000Z',
      ttl_future: false,
    },
  ];
}

module.exports = {
  R01,
  R02,
  R03,
  matchesR01Guard,
  applyTtlRefreshR01,
  fixtureCompliant,
};
