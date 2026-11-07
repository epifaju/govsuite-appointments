'use strict';
/** Offline gates for R04A-036 runner — no network. */
const assert = require('assert');
const path = require('path');
const { PROJECT_ROOT } = require('../lib/load-json.cjs');
const { installOfflineGuards } = require('../lib/security-guard.cjs');
installOfflineGuards();

const runner = require(path.join(
  PROJECT_ROOT,
  'n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/runtime-013/diag-036/run-r04a-036.js'
));

assert.strictEqual(runner.TIMEOUT_AFTER_WARM_MS, 180000);
assert.strictEqual(runner.EXPECT_VERSION_COUNTER, 11);
assert.strictEqual(
  runner.EXPECT_GERER_SHA,
  '44a7064d12755a84dd256acae90abbf67a778178f9947eec3a36dc0c9abcad3f'
);
assert.strictEqual(runner.SCENARIOS.length, 1);
assert.strictEqual(runner.SCENARIOS[0].id, 'R04-A');
assert.strictEqual(runner.SCENARIOS[0].sessionId, 'rec008-r04a-035-active-ask-email');
assert.ok(/@example\.test$/i.test(runner.R04A_EMAIL_SYNTHETIC));

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
  conversationStep: 'ASK_TELEPHONE',
  emailPresent: true,
  emailLen: 28,
  emailValide: true,
  ttlActive: true,
  nomPresent: true,
  nomLen: 6,
  prenomPresent: true,
  prenomLen: 7,
  slotIdPresent: true,
  telephonePresent: false,
};
assert.deepStrictEqual(runner.assertR04A(before, afterOk, { ok: true, status: 200, json: { type: 'ok' } }), []);

const afterBad = { ...afterOk, conversationStep: 'ASK_EMAIL', emailPresent: false };
assert.ok(runner.assertR04A(before, afterBad, { ok: true, status: 200, json: {} }).length > 0);

const red = runner.redactHttpArtifact({
  ok: true,
  status: 200,
  elapsedMs: 1,
  json: { type: 'x' },
  textPreview: 'merci camille.r04a.035@example.test',
  aborted: false,
  timeoutMs: 180000,
  retried: false,
});
assert.ok(!/@example\.test/i.test(red.textPreview));
assert.ok(red.textPreview.includes('[REDACTED_EMAIL]'));

console.log(JSON.stringify({ ok: true, offlineRunnerGates: 'PASS' }, null, 2));
