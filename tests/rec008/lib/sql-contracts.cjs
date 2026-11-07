'use strict';

const { queryOf } = require('./workflow-source.cjs');
const { VERDICTS } = require('./verdicts.cjs');

function whereClause(sql) {
  const m = String(sql).match(/WHERE[\s\S]*?(?=LIMIT|;|$)/i);
  return m ? m[0] : '';
}

function assertChargerContracts(sql) {
  const assertions = [];
  const where = whereClause(sql);

  function check(id, ok, expected, observed) {
    assertions.push({
      id,
      expected,
      observed,
      verdict: ok ? VERDICTS.PASS : VERDICTS.FAIL
    });
  }

  check(
    'C1_no_ttl_filter_where',
    !/\bexpires_at\s*>\s*NOW\s*\(/i.test(where),
    'WHERE without expires_at > NOW()',
    where.slice(0, 200)
  );
  check(
    'C3_session_found',
    /TRUE\s+AS\s+session_found/i.test(sql),
    'TRUE AS session_found',
    /session_found/.test(sql)
  );
  check(
    'C4_session_expired_flag',
    /\(\s*s\.expires_at\s+IS\s+NOT\s+NULL\s+AND\s+s\.expires_at\s*<=\s*NOW\s*\(\s*\)\s*\)\s+AS\s+session_expired/i.test(
      sql
    ),
    'session_expired computed flag',
    /session_expired/.test(sql)
  );
  check(
    'C6_from_limit',
    /FROM\s+ai_conversation_state/i.test(sql) && /LIMIT\s+1/i.test(sql),
    'FROM ai_conversation_state LIMIT 1',
    true
  );

  return assertions;
}

function assertSauvegarderContracts(sql) {
  const assertions = [];
  function check(id, ok, expected, observed) {
    assertions.push({
      id,
      expected,
      observed,
      verdict: ok ? VERDICTS.PASS : VERDICTS.FAIL
    });
  }

  check('S1_authorizedNulls', /_authorizedNulls/i.test(sql), '_authorizedNulls', true);
  check(
    'S3_any_authorized',
    /=\s*ANY\s*\(\s*p\.authorized_nulls\s*\)/i.test(sql),
    "= ANY (p.authorized_nulls)",
    true
  );
  check(
    'S4_refresh_ttl_coalesce',
    /refreshSessionTtl[\s\S]*refresh_session_ttl/i.test(sql) ||
      /refresh_session_ttl/i.test(sql),
    'refresh_session_ttl present',
    /refresh_session_ttl/i.test(sql)
  );
  check(
    'S5_plus_2h',
    /INTERVAL\s+'2 hours'/i.test(sql),
    "INTERVAL '2 hours'",
    true
  );
  check(
    'S9_for_update',
    /FOR\s+UPDATE/i.test(sql),
    'FOR UPDATE',
    true
  );
  check(
    'S10_on_conflict',
    /ON\s+CONFLICT\s*\(\s*session_id\s*\)\s+DO\s+UPDATE/i.test(sql),
    'ON CONFLICT (session_id) DO UPDATE',
    true
  );

  return assertions;
}

/**
 * Simulation documentée de la sémantique Fix C (pas une exécution PostgreSQL).
 */
function simulateSaveMerge(existing, payload) {
  const authorized = new Set(
    Array.isArray(payload._authorizedNulls) ? payload._authorizedNulls : []
  );
  const refresh =
    payload.refreshSessionTtl === undefined ? true : !!payload.refreshSessionTtl;
  const fieldMap = {
    intent: 'intent',
    service: 'service',
    site: 'site',
    nom: 'nom',
    prenom: 'prenom',
    email: 'email',
    telephone: 'telephone',
    pendingAction: 'pending_action',
    conversationStep: 'conversation_step'
  };
  const out = Object.assign({}, existing);
  for (const [payloadKey, col] of Object.entries(fieldMap)) {
    if (!Object.prototype.hasOwnProperty.call(payload, payloadKey)) continue;
    const val = payload[payloadKey];
    if (val !== null && val !== undefined && val !== '') {
      out[col] = val;
    } else if (authorized.has(payloadKey)) {
      out[col] = null;
    }
    // else: unauthorized null → keep existing
  }
  if (refresh) out.expires_at = 'REFRESHED+' + (existing.expires_at || 'NOW');
  else out.expires_at = existing.expires_at;
  return {
    simulation: true,
    disclaimer: 'Simulation sémantique SQL Fix C — pas une preuve runtime PostgreSQL.',
    row: out
  };
}

function runSqlContractSuite(workflow) {
  const charger = queryOf(workflow, 'Charger état conversation');
  const save = queryOf(workflow, 'Sauvegarder état conversation');
  return {
    nodes: ['Charger état conversation', 'Sauvegarder état conversation'],
    charger: assertChargerContracts(charger),
    sauvegarder: assertSauvegarderContracts(save)
  };
}

module.exports = {
  assertChargerContracts,
  assertSauvegarderContracts,
  simulateSaveMerge,
  runSqlContractSuite,
  whereClause
};
