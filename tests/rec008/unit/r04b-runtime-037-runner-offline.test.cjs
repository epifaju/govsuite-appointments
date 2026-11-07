'use strict';
/** Offline gates R04B-037 — ART routing, assert, no retry. No network. */
const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');
const { PROJECT_ROOT } = require('../lib/load-json.cjs');
const { installOfflineGuards } = require('../lib/security-guard.cjs');
installOfflineGuards();

const runnerPath = path.join(
  PROJECT_ROOT,
  'n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/runtime-013/diag-037/run-r04b-037.js'
);

const runner = require(runnerPath);
assert.strictEqual(runner.REQUIRED_ART, 'artifacts-r04b-037');
assert.strictEqual(runner.TIMEOUT_AFTER_WARM_MS, 180000);
assert.strictEqual(runner.EXPECT_VERSION_COUNTER, 11);
assert.strictEqual(runner.SCENARIOS.length, 1);
assert.strictEqual(runner.SCENARIOS[0].id, 'R04-B');
assert.strictEqual(runner.SCENARIOS[0].sessionId, 'rec008-r04b-035-active-ask-email');
assert.strictEqual(runner.R04B_INVALID_MESSAGE, 'pas-un-email');

const before = {
  conversationStep: 'ASK_EMAIL',
  emailPresent: false,
  emailLen: 0,
  ttlActive: true,
  nomPresent: true,
  nomLen: 6,
  prenomPresent: true,
  prenomLen: 7,
  slotIdPresent: true,
  telephonePresent: false,
};
const afterOk = {
  conversationStep: 'ASK_EMAIL',
  emailPresent: false,
  emailLen: 0,
  emailValide: false,
  ttlActive: true,
  nomPresent: true,
  nomLen: 6,
  prenomPresent: true,
  prenomLen: 7,
  slotIdPresent: true,
  telephonePresent: false,
};
assert.deepStrictEqual(
  runner.assertR04B(before, afterOk, {
    ok: true,
    status: 200,
    json: { type: 'create_appointment_question', text: 'merci de fournir une adresse email valide' },
  }),
  []
);
const afterBad = { ...afterOk, conversationStep: 'ASK_TELEPHONE', emailPresent: true, emailLen: 10 };
assert.ok(runner.assertR04B(before, afterBad, { ok: true, status: 200, json: {} }).length > 0);

// Polluted RUNTIME_ART must STOP before campaign (subprocess)
const bad = spawnSync(process.execPath, [runnerPath], {
  env: { ...process.env, RUNTIME_ART: 'artifacts-r03-026' },
  encoding: 'utf8',
});
assert.notStrictEqual(bad.status, 0);
assert.ok(/polluted-RUNTIME_ART/.test(bad.stdout + bad.stderr));

console.log(
  JSON.stringify(
    {
      ok: true,
      offlineRunnerGates: 'PASS',
      artGuard: 'PASS',
      legacy036Note: 'artifacts-r04a-036 / artifacts-r03-026 left intact',
    },
    null,
    2
  )
);
