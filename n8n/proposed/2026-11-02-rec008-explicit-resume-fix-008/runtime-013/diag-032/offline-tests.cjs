'use strict';

/**
 * MISSION 032 — offline tests W-031-01 (no n8n PUT / activate / PG / HTTP métier).
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROJECT_ROOT = path.resolve(__dirname, '../../../../../');
const ws = require(path.join(PROJECT_ROOT, 'tests/rec008/lib/workflow-source.cjs'));
const { runConversationTurn } = require(path.join(
  PROJECT_ROOT,
  'tests/rec008/lib/node-runtime.cjs'
));
const { simulateSaveMerge } = require(path.join(
  PROJECT_ROOT,
  'tests/rec008/lib/sql-contracts.cjs'
));
const {
  runR04CExpiredAskEmail
} = require(path.join(
  PROJECT_ROOT,
  'tests/rec008/lib/assertions/readiness-031-r04-email.cjs'
));
const { VERDICTS } = require(path.join(PROJECT_ROOT, 'tests/rec008/lib/verdicts.cjs'));

const FIX_REL = path.join(
  'n8n',
  'proposed',
  '2026-11-02-rec008-explicit-resume-fix-008',
  'after-OCD9It1uKFhOoWNF.json'
);
const EXPECTED_BEFORE =
  'f75d49849231f956bb9ae5383111ea84b362dc58de6711cc75d2e7e2a26917fe';
const EXPECTED_AFTER =
  '44a7064d12755a84dd256acae90abbf67a778178f9947eec3a36dc0c9abcad3f';

function sha(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

function basePrevious(overrides) {
  return Object.assign(
    {
      session_id: 'rec008-syn-r032-w03101',
      intent: 'CREATE_APPOINTMENT',
      pending_action: 'CREATE_APPOINTMENT',
      conversation_step: 'ASK_EMAIL',
      nom: 'Dupont',
      prenom: 'Camille',
      email: null,
      telephone: null,
      service: 'PASSEPORT',
      site: 'PARIS',
      slot_id: '11111111-1111-4111-8111-111111111301',
      expires_at: '2026-10-31T00:00:00.000Z',
      session_expired: true,
      sessionExpired: true,
      session_found: true,
      sessionFound: true
    },
    overrides || {}
  );
}

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    console.log('PASS', name);
    passed += 1;
  } catch (err) {
    console.error('FAIL', name, err && err.message);
    failed += 1;
  }
}

const beforeJs = fs.readFileSync(
  path.join(__dirname, 'Gerer_collecte_progressive.BEFORE.js'),
  'utf8'
);
const afterJs = fs.readFileSync(
  path.join(__dirname, 'Gerer_collecte_progressive.AFTER.js'),
  'utf8'
);

check('BEFORE SHA matches FIX-008 Gerer', () => {
  const loaded = ws.loadVc9Workflow({
    relativePath: FIX_REL,
    skipShaCheck: true,
    skipVersionCheck: true
  });
  const live = ws.codeOf(loaded.workflow, 'Gérer collecte progressive');
  assert.strictEqual(sha(beforeJs), EXPECTED_BEFORE);
  assert.strictEqual(sha(live), EXPECTED_BEFORE);
});

check('AFTER SHA pinned + resume fallback retained', () => {
  assert.strictEqual(sha(afterJs), EXPECTED_AFTER);
  assert.strictEqual((afterJs.match(/previous\.email \?\? x\.email/g) || []).length, 1);
  assert.strictEqual(
    (afterJs.match(/email: previous\.email \?\? null,/g) || []).length,
    1
  );
});

const candidate = ws.loadVc9Workflow({
  relativePath: path.relative(
    PROJECT_ROOT,
    path.join(__dirname, 'after-OCD9It1uKFhOoWNF.W03101-candidate.json')
  ),
  skipShaCheck: true,
  skipVersionCheck: true
});

check('R04-C contrat email PASS (plus d’anomalie W-031-01)', () => {
  const r = runR04CExpiredAskEmail(candidate.workflow);
  assert.strictEqual(r.verdict, VERDICTS.PASS, r.reason);
  assert.strictEqual(r.contractEmailCaptured, false);
  assert.ok(!r.anomalies || r.anomalies.length === 0);
  const a = r.assertions.find((x) => x.id === 'r04c_email_not_captured');
  assert.strictEqual(a.verdict, VERDICTS.PASS);
});

check('expired email-shaped : managed + save sim sans email', () => {
  const previous = basePrevious();
  const turn = runConversationTurn(candidate.workflow, {
    previous,
    message: 'camille.r04c@example.test',
    llmIntent: 'GENERAL',
    sessionExpired: true,
    withReply: true
  });
  assert.ok(turn.managed.email == null || turn.managed.email === '');
  assert.strictEqual(turn.managed.sessionExpired, true);
  assert.strictEqual(turn.managed.refreshSessionTtl, false);
  assert.notStrictEqual(turn.managed.conversationStep, 'ASK_TELEPHONE');
  assert.strictEqual(turn.reply && turn.reply.type, 'session_expired');
  const saved = simulateSaveMerge(previous, turn.managed);
  assert.ok(saved.row.email == null || saved.row.email === '');
  assert.strictEqual(saved.row.expires_at, previous.expires_at);
});

check('même bug téléphone corrigé sur expired', () => {
  const turn = runConversationTurn(candidate.workflow, {
    previous: basePrevious({ conversation_step: 'ASK_TELEPHONE' }),
    message: '0612345678',
    llmIntent: 'GENERAL',
    sessionExpired: true,
    withReply: true
  });
  assert.ok(turn.managed.telephone == null || turn.managed.telephone === '');
  assert.strictEqual(turn.managed.sessionExpired, true);
});

check('reprendre avant capture (FIX-008) non régressé', () => {
  const turn = runConversationTurn(candidate.workflow, {
    previous: basePrevious(),
    message: 'reprendre',
    llmIntent: 'GENERAL',
    sessionExpired: true,
    withReply: false
  });
  assert.strictEqual(turn.managed.sessionExpired, false);
  assert.strictEqual(turn.managed.refreshSessionTtl, true);
  assert.strictEqual(turn.managed.conversationStep, 'ASK_EMAIL');
  assert.strictEqual(turn.managed.intent, 'CREATE_APPOINTMENT');
  assert.strictEqual(turn.managed.nom, 'Dupont');
  assert.ok(turn.managed.email == null || turn.managed.email === '');
});

const summary = {
  suite: 'diag-032-w03101-offline',
  passed,
  failed,
  verdict: failed === 0 ? 'PASS' : 'FAIL',
  installed: false
};
fs.writeFileSync(
  path.join(__dirname, 'OFFLINE-TEST-RESULTS.json'),
  JSON.stringify(summary, null, 2) + '\n'
);
console.log('');
console.log(JSON.stringify(summary));
process.exit(failed === 0 ? 0 : 1);
