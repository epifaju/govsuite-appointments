'use strict';

/**
 * MISSION 035 — Offline readiness R04 on INSTALLED W-031-01 export (diag-034).
 * No HTTP / Chat / Ollama / PUT / PG mutate / LIVE / R04-RUNTIME.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { installOfflineGuards } = require('../lib/security-guard.cjs');
const { VERDICTS } = require('../lib/verdicts.cjs');
const { PROJECT_ROOT } = require('../lib/load-json.cjs');
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
const { scanContent, loadCatalogue } = require('../lib/assertions/artifact-hygiene.cjs');

installOfflineGuards();
const catalogue = loadCatalogue();

const EXPECT_GERER =
  '44a7064d12755a84dd256acae90abbf67a778178f9947eec3a36dc0c9abcad3f';
const AFTER_REL =
  'n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/runtime-013/diag-034/after-OCD9It1uKFhOoWNF.json';
const STUB_REL =
  'n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/runtime-013/diag-035/run-r04-runtime.stub.cjs';
const SAMPLE_REL =
  'tests/rec008/fixtures/r04-runtime-readiness-035/sample-artifact-redacted.json';

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

function assertPass(r, label) {
  assert.ok(r, label + ' missing result');
  assert.strictEqual(r.verdict, VERDICTS.PASS, label + ' verdict: ' + JSON.stringify(r.reason || r.issues));
}

const afterPath = path.join(PROJECT_ROOT, AFTER_REL);
const wf = JSON.parse(fs.readFileSync(afterPath, 'utf8'));
const gerer = wf.nodes.find((n) => n.name === 'Gérer collecte progressive').parameters.jsCode;
const gererSha = crypto.createHash('sha256').update(gerer, 'utf8').digest('hex');

check('pin installed Gerer SHA 44a7064d', () => {
  assert.strictEqual(gererSha, EXPECT_GERER);
  assert.strictEqual(wf.versionCounter, 11);
  assert.strictEqual(wf.versionId, 'f5a9181f-ff8d-4301-976e-57add79badae');
  assert.strictEqual(wf.active, false);
  assert.strictEqual(wf.nodes.length, 134);
});

check('R04-A valid → ASK_TELEPHONE', () => {
  const r = runR04AValidEmail(wf);
  assertPass(r, 'R04-A');
  assert.strictEqual(r.observed.conversationStep, 'ASK_TELEPHONE');
  assert.strictEqual(r.observed.emailPresent, true);
  assert.strictEqual(r.observed.mockPostsDelta, 0);
  assert.strictEqual(r.observed.mockClaimsDelta, 0);
});

check('R04-B invalid stays ASK_EMAIL', () => {
  const r = runR04BInvalidEmail(wf);
  assertPass(r, 'R04-B');
  assert.strictEqual(r.observed.conversationStep, 'ASK_EMAIL');
  assert.strictEqual(r.observed.emailPresent, false);
});

check('R04-C expired no email capture', () => {
  const r = runR04CStrictNoEmailCapture(wf);
  assertPass(r, 'R04-C');
  assert.strictEqual(r.observed.conversationStep, 'ASK_EMAIL');
  assert.strictEqual(r.observed.emailPresent, false);
  if (r.observed.saveEmailPresent != null) {
    assert.strictEqual(r.observed.saveEmailPresent, false);
  }
});

check('R01 non-regression ASK_PRENOM active', () => {
  const r = runS01AskPrenomActive(wf);
  assertPass(r, 'R01');
});

check('R02 non-regression ASK_PRENOM expired', () => {
  const r = runS02AskPrenomExpired(wf);
  assertPass(r, 'R02');
});

check('R03 non-regression explicit resume', () => {
  const r = fix008.runS03ExpiredResumeFixed(wf, 'reprendre');
  assertPass(r, 'R03');
});

check('runner stub contract offline (no network)', () => {
  const stub = require(path.join(PROJECT_ROOT, STUB_REL));
  const c = stub.assertRunnerContractOffline();
  assert.strictEqual(c.ok, true);
  assert.strictEqual(stub.TIMEOUT_AFTER_WARM_MS, 180000);
  assert.strictEqual(stub.EXPECT.retried, false);
  assert.strictEqual(stub.EXPECT.messagesPerCampaign, 1);
  assert.strictEqual(stub.EXPECT.saveDataSuccessExecution, 'none');
  let threw = false;
  try {
    stub.runR04Runtime();
  } catch (e) {
    threw = /NOT_AUTHORIZED/.test(String(e.message));
  }
  assert.ok(threw, 'stub must refuse runtime');
});

check('hygiene scanner on redacted R04 sample', () => {
  const samplePath = path.join(PROJECT_ROOT, SAMPLE_REL);
  const sample = fs.readFileSync(samplePath, 'utf8');
  assert.ok(!/@example\.test/.test(sample));
  assert.ok(!/"email"\s*:\s*"[^"]+@/.test(sample));
  const scan = scanContent(sample, catalogue, { path: SAMPLE_REL, label: 'r04-sample' });
  assert.strictEqual(scan.verdict, VERDICTS.PASS, JSON.stringify(scan.findings));
});

const failed = results.filter((r) => !r.ok);
const outDir = path.join(PROJECT_ROOT, 'tests/rec008/reports');
fs.mkdirSync(outDir, { recursive: true });
const summary = {
  mission: 'R04-RUNTIME-READINESS-035',
  gererSha,
  expectGerer: EXPECT_GERER,
  source: AFTER_REL,
  passed: results.length - failed.length,
  failed: failed.length,
  results,
  r04Runtime: 'NOT_AUTHORIZED',
  live: 'NO-GO',
};
fs.writeFileSync(
  path.join(outDir, 'R035-offline-readiness-run.json'),
  JSON.stringify(summary, null, 2)
);
console.log(JSON.stringify({ passed: summary.passed, failed: summary.failed, gererSha }, null, 2));
process.exit(failed.length ? 1 : 0);
