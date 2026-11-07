'use strict';

/**
 * MISSION 031 — Tests offline R04-A/B/C (VM FIX-008).
 * Aucun HTTP n8n / Ollama / PG / Docker / LIVE / CLAIM / POST.
 */

const assert = require('assert');
const { installOfflineGuards } = require('../lib/security-guard.cjs');
const { createVc9Context } = require('../lib/offline-runner.cjs');
const { VERDICTS } = require('../lib/verdicts.cjs');
const {
  runR04AValidEmail,
  runR04BInvalidEmail,
  runR04CExpiredAskEmail
} = require('../lib/assertions/readiness-031-r04-email.cjs');
const { scanContent, loadCatalogue } = require('../lib/assertions/artifact-hygiene.cjs');

installOfflineGuards();
const ctx = createVc9Context();
const catalogue = loadCatalogue();

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

check('R04-A valid email → ASK_TELEPHONE', () => {
  const r = runR04AValidEmail(ctx.workflow);
  assert.strictEqual(r.verdict, VERDICTS.PASS, r.reason);
  assert.strictEqual(r.observed.conversationStep, 'ASK_TELEPHONE');
  assert.strictEqual(r.observed.emailPresent, true);
  assert.ok(r.observed.emailLen > 0);
  assert.strictEqual(r.observed.mockPostsDelta, 0);
  assert.strictEqual(r.observed.mockClaimsDelta, 0);
  assert.strictEqual(r.observed.retried, false);
  // observed must be hygiene-clean (no cleartext email)
  const hyg = scanContent(JSON.stringify(r.observed), catalogue, { label: 'r04a-observed' });
  assert.strictEqual(hyg.verdict, VERDICTS.PASS);
});

check('R04-B invalid email stays ASK_EMAIL', () => {
  const r = runR04BInvalidEmail(ctx.workflow);
  assert.strictEqual(r.verdict, VERDICTS.PASS, r.reason);
  assert.strictEqual(r.observed.conversationStep, 'ASK_EMAIL');
  assert.strictEqual(r.observed.emailPresent, false);
  assert.strictEqual(r.observed.mockPostsDelta, 0);
  const hyg = scanContent(JSON.stringify(r.observed), catalogue, { label: 'r04b-observed' });
  assert.strictEqual(hyg.verdict, VERDICTS.PASS);
});

check('R04-C expired safety OK + detect W-031-01 if email leaked', () => {
  const r = runR04CExpiredAskEmail(ctx.workflow);
  assert.strictEqual(r.verdict, VERDICTS.PASS, r.reason);
  assert.notStrictEqual(r.observed.conversationStep, 'ASK_TELEPHONE');
  assert.strictEqual(r.observed.sessionExpired, true);
  assert.strictEqual(r.observed.refreshSessionTtl, false);
  assert.strictEqual(r.observed.mockPostsDelta, 0);
  // Contrat strict : email ne doit pas être capturé. VM actuelle fuit → W-031-01.
  const emailAssert = r.assertions.find((a) => a.id === 'r04c_email_not_captured');
  assert.ok(emailAssert);
  if (emailAssert.verdict === VERDICTS.FAIL) {
    assert.ok(Array.isArray(r.anomalies) && r.anomalies.some((a) => a.id === 'W-031-01'));
    assert.strictEqual(r.contractEmailCaptured, true);
  } else {
    assert.strictEqual(r.observed.emailPresent, false);
    assert.ok(!r.anomalies || r.anomalies.length === 0);
  }
  // observed redacted remains hygiene-clean even if emailPresent true (no cleartext)
  const hyg = scanContent(JSON.stringify(r.observed), catalogue, { label: 'r04c-observed' });
  assert.strictEqual(hyg.verdict, VERDICTS.PASS);
});

check('SHA workflow pinned in context', () => {
  assert.ok(ctx.meta && ctx.meta.sha256);
  assert.strictEqual(typeof ctx.meta.sha256, 'string');
  assert.ok(ctx.meta.sha256.length === 64);
});

console.log('');
console.log(
  JSON.stringify({
    suite: 'r04-offline-readiness-031',
    passed,
    failed,
    verdict: failed === 0 ? 'PASS' : 'FAIL'
  })
);

process.exit(failed === 0 ? 0 : 1);
