'use strict';

/**
 * MISSION 038 — Offline diagnosis R04-B HTTP 500.
 * No network / chat / Ollama / PUT / PG mutate.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { installOfflineGuards } = require('../lib/security-guard.cjs');
const { VERDICTS } = require('../lib/verdicts.cjs');
const { PROJECT_ROOT } = require('../lib/load-json.cjs');
const { runConversationTurn, runCodeNode } = require('../lib/node-runtime.cjs');
const {
  runR04AValidEmail,
  runR04BInvalidEmail,
  runR04CStrictNoEmailCapture,
} = require('../lib/assertions/readiness-032-r04-email.cjs');
const {
  runS01AskPrenomActive,
  runS02AskPrenomExpired,
} = require('../lib/assertions/readiness-007-ask-prenom.cjs');
const fix008 = require('../lib/assertions/fix-008-explicit-resume.cjs');

installOfflineGuards();

const EXPECT_GERER =
  '44a7064d12755a84dd256acae90abbf67a778178f9947eec3a36dc0c9abcad3f';
const AFTER_REL =
  'n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/runtime-013/diag-034/after-OCD9It1uKFhOoWNF.json';

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
    console.log('PASS ' + name);
  } catch (e) {
    results.push({ name, ok: false, error: String(e && e.message ? e.message : e) });
    console.error('FAIL ' + name + ': ' + (e && e.message ? e.message : e));
  }
}

const wf = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, AFTER_REL), 'utf8'));
const gererCode = wf.nodes.find((n) => n.name === 'Gérer collecte progressive').parameters.jsCode;
const gererSha = crypto.createHash('sha256').update(gererCode, 'utf8').digest('hex');

const prev = {
  session_id: 'rec008-syn-r04b-diag-038',
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
  available_slots: [{ id: '11111111-1111-4111-8111-111111111301' }],
  session_found: true,
  session_expired: false,
};

const TRIGGER = "Lorsqu'un message de chat est reçu";

function storeFromTurn(message, turn) {
  const store = {};
  store[TRIGGER] = { chatInput: message, sessionId: prev.session_id };
  store['Charger état conversation'] = prev;
  store['Joindre tentative de session'] = prev;
  store['Parser intention'] = turn.parser;
  store['Fusionner état conversation'] = turn.fusion;
  store['Gérer collecte progressive'] = turn.managed;
  return store;
}

check('pin Gerer 44a7064d', () => {
  assert.strictEqual(gererSha, EXPECT_GERER);
});

check('invalid pas-un-email stays ASK_EMAIL no capture', () => {
  const t = runConversationTurn(wf, {
    previous: prev,
    message: 'pas-un-email',
    llmIntent: 'CREATE_APPOINTMENT',
    withReply: false,
  });
  assert.strictEqual(t.managed.conversationStep, 'ASK_EMAIL');
  assert.ok(!t.managed.email);
});

check('ASK_EMAIL path uses Demander not Préparer réponse création', () => {
  const t = runConversationTurn(wf, {
    previous: prev,
    message: 'pas-un-email',
    llmIntent: 'CREATE_APPOINTMENT',
    withReply: false,
  });
  const store = storeFromTurn('pas-un-email', t);
  store['Décider action tentative'] = runCodeNode(
    wf,
    'Décider action tentative',
    t.managed,
    store
  );
  assert.strictEqual(store['Décider action tentative'].attemptAction, 'COLLECT');
  const dem = runCodeNode(wf, 'Demander paramètres création', t.managed, store);
  assert.ok(dem && dem.text && /email|courriel|mail|adresse/i.test(String(dem.text)));
  assert.strictEqual(dem.type, 'create_appointment_question');
});

check('Demander paramètres création does not throw', () => {
  const t = runConversationTurn(wf, {
    previous: prev,
    message: 'pas-un-email',
    llmIntent: 'CREATE_APPOINTMENT',
    withReply: false,
  });
  const dem = runCodeNode(
    wf,
    'Demander paramètres création',
    t.managed,
    storeFromTurn('pas-un-email', t)
  );
  assert.ok(dem);
});

check('HTTP contract Demander is terminal sink', () => {
  const demNode = wf.nodes.find((n) => n.name === 'Demander paramètres création');
  assert.ok(demNode);
  const outs = (wf.connections['Demander paramètres création'] || {}).main || [];
  const flat = outs.flat().filter(Boolean);
  assert.strictEqual(flat.length, 0);
  const trigger = wf.nodes.find((n) => n.name === "Lorsqu'un message de chat est reçu");
  assert.strictEqual(trigger.parameters.options?.responseMode || trigger.parameters.responseMode, 'lastNode');
});

check('Réponse générale does not throw', () => {
  const t = runConversationTurn(wf, {
    previous: prev,
    message: 'pas-un-email',
    llmIntent: 'GENERAL',
    withReply: true,
  });
  assert.ok(t.reply);
});

check('empty message no capture', () => {
  const t = runConversationTurn(wf, {
    previous: prev,
    message: '',
    llmIntent: 'GENERAL',
    withReply: false,
  });
  assert.strictEqual(t.managed.conversationStep, 'ASK_EMAIL');
  assert.ok(!t.managed.email);
});

check('spaced non-email no capture', () => {
  const t = runConversationTurn(wf, {
    previous: prev,
    message: '  pas un email  ',
    llmIntent: 'GENERAL',
    withReply: false,
  });
  assert.ok(!t.managed.email);
  assert.strictEqual(t.managed.conversationStep, 'ASK_EMAIL');
});

check('incomplete parser object', () => {
  const t = runConversationTurn(wf, {
    previous: prev,
    message: 'pas-un-email',
    llm: {},
    withReply: false,
  });
  assert.strictEqual(t.managed.conversationStep, 'ASK_EMAIL');
});

check('valid email → ASK_TELEPHONE (R04-A path)', () => {
  const t = runConversationTurn(wf, {
    previous: prev,
    message: 'camille.diag038@example.test',
    llmIntent: 'CREATE_APPOINTMENT',
    withReply: false,
  });
  assert.strictEqual(t.managed.conversationStep, 'ASK_TELEPHONE');
  assert.ok(t.managed.email);
});

check('R04-A harness PASS', () => {
  assert.strictEqual(runR04AValidEmail(wf).verdict, VERDICTS.PASS);
});
check('R04-B harness PASS', () => {
  assert.strictEqual(runR04BInvalidEmail(wf).verdict, VERDICTS.PASS);
});
check('R04-C harness PASS', () => {
  assert.strictEqual(runR04CStrictNoEmailCapture(wf).verdict, VERDICTS.PASS);
});
check('R01 PASS', () => {
  assert.strictEqual(runS01AskPrenomActive(wf).verdict, VERDICTS.PASS);
});
check('R02 PASS', () => {
  assert.strictEqual(runS02AskPrenomExpired(wf).verdict, VERDICTS.PASS);
});
check('R03 PASS', () => {
  assert.strictEqual(fix008.runS03ExpiredResumeFixed(wf, 'reprendre').verdict, VERDICTS.PASS);
});

const failed = results.filter((r) => !r.ok);
const summary = {
  mission: 'R04B-HTTP500-DIAG-038',
  gererSha,
  passed: results.length - failed.length,
  failed: failed.length,
  results,
  implication:
    'Code-path Gerer+Décider+Demander OK offline; Sauvegarder not reached in 037 → HTTP 500 unlikely from email-validation jsCode alone; LLM/early pipeline PROBABLE',
};
fs.mkdirSync(path.join(PROJECT_ROOT, 'tests/rec008/reports'), { recursive: true });
fs.writeFileSync(
  path.join(PROJECT_ROOT, 'tests/rec008/reports/R038-offline-diag-run.json'),
  JSON.stringify(summary, null, 2)
);
fs.mkdirSync(
  path.join(
    PROJECT_ROOT,
    'n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/runtime-013/diag-038'
  ),
  { recursive: true }
);
fs.writeFileSync(
  path.join(
    PROJECT_ROOT,
    'n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/runtime-013/diag-038/OFFLINE-TESTS.json'
  ),
  JSON.stringify(summary, null, 2)
);
console.log(JSON.stringify({ passed: summary.passed, failed: summary.failed }, null, 2));
process.exit(failed.length ? 1 : 0);
