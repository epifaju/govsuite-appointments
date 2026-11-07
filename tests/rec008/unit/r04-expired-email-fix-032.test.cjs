'use strict';

/**
 * MISSION 032 — Régressions W-031-01 + R04-A…F + non-régression R01–R03 (VM).
 * Candidate = FIX-008 install-012 patched. Aucun HTTP / PG / Docker / LIVE / PUT.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { installOfflineGuards } = require('../lib/security-guard.cjs');
const { createVc9Context, evaluateScenarioDescriptor } = require('../lib/offline-runner.cjs');
const { VERDICTS } = require('../lib/verdicts.cjs');
const { applyW03101ToWorkflow } = require('../lib/w03101-patch.cjs');
const {
  runR04AValidEmail,
  runR04BInvalidEmail,
  runR04CExpiredAskEmail,
  runR04CStrictNoEmailCapture,
  runR04DExpiredResume,
  runR04EPreexistingEmail,
  runR04FExpiredPhoneNoCapture
} = require('../lib/assertions/readiness-032-r04-email.cjs');
const { scanContent, loadCatalogue } = require('../lib/assertions/artifact-hygiene.cjs');
const fix008 = require('../lib/assertions/fix-008-explicit-resume.cjs');
const { PROJECT_ROOT } = require('../lib/load-json.cjs');

installOfflineGuards();

const FIX008_PATH = path.join(
  PROJECT_ROOT,
  'n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/install-012/after-OCD9It1uKFhOoWNF.json'
);
const fix008Wf = JSON.parse(fs.readFileSync(FIX008_PATH, 'utf8'));
const patched = applyW03101ToWorkflow(fix008Wf);
const wf = patched.workflow;
const vc9 = createVc9Context();
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

check('baseline unpatched FIX-008 R04-C leaks (W-031-01)', () => {
  const r = runR04CExpiredAskEmail(fix008Wf);
  assert.ok(r.contractEmailCaptured === true || r.observed.emailPresent === true);
  assert.ok((r.anomalies || []).some((a) => a.id === 'W-031-01'));
});

check('patch applies 4 identity replacements on non-resume expired only', () => {
  assert.strictEqual(patched.replacements, 4);
  // resume branch still may use previous ?? x (intentional minimal fix)
  const zone = patched.afterCode.slice(
    patched.afterCode.indexOf('const sessionExpiredFlag'),
    patched.afterCode.indexOf('// --- P4E/P4F END GERER ---')
  );
  const nonResume = zone.slice(0, zone.indexOf('// reprise explicite'));
  assert.ok(!/previous\.email \?\? x\.email/.test(nonResume));
});

check('R04-A valid email → ASK_TELEPHONE', () => {
  const r = runR04AValidEmail(wf);
  assert.strictEqual(r.verdict, VERDICTS.PASS, r.reason);
  assert.strictEqual(r.observed.conversationStep, 'ASK_TELEPHONE');
  assert.strictEqual(r.observed.emailPresent, true);
  assert.strictEqual(r.observed.mockPostsDelta, 0);
});

check('R04-B invalid stays ASK_EMAIL', () => {
  const r = runR04BInvalidEmail(wf);
  assert.strictEqual(r.verdict, VERDICTS.PASS, r.reason);
  assert.strictEqual(r.observed.conversationStep, 'ASK_EMAIL');
  assert.strictEqual(r.observed.emailPresent, false);
});

check('R04-C strict emailPresent=false + no persist', () => {
  const r = runR04CStrictNoEmailCapture(wf);
  assert.strictEqual(r.verdict, VERDICTS.PASS, r.reason);
  assert.strictEqual(r.observed.emailPresent, false);
  assert.strictEqual(r.observed.conversationStep, 'ASK_EMAIL');
  assert.strictEqual(r.observed.refreshSessionTtl, false);
  assert.strictEqual(r.observed.saveEmailPresent, false);
});

check('R04-D expired reprendre', () => {
  const r = runR04DExpiredResume(wf);
  assert.strictEqual(r.verdict, VERDICTS.PASS, r.reason);
  assert.strictEqual(r.observed.refreshSessionTtl, true);
  assert.strictEqual(r.observed.emailPresent, false);
});

check('R04-E preexisting email preserved', () => {
  const r = runR04EPreexistingEmail(wf);
  assert.strictEqual(r.verdict, VERDICTS.PASS, r.reason);
  assert.strictEqual(r.observed.emailPresent, true);
  const hyg = scanContent(JSON.stringify(r.observed), catalogue, { label: 'r04e' });
  assert.strictEqual(hyg.verdict, VERDICTS.PASS);
});

check('R04-F expired no phone capture', () => {
  const r = runR04FExpiredPhoneNoCapture(wf);
  assert.strictEqual(r.verdict, VERDICTS.PASS, r.reason);
  assert.strictEqual(r.observed.telephonePresent, false);
});

check('R01 non-regression askPrenom.s01Active (VC9 harness)', () => {
  const r = evaluateScenarioDescriptor(
    { id: 'S01', mode: 'offline', handler: 'askPrenom.s01Active' },
    vc9
  );
  assert.strictEqual(r.verdict, VERDICTS.PASS, r.reason);
});

check('R02 non-regression askPrenom.s02Expired (VC9 harness)', () => {
  const r = evaluateScenarioDescriptor(
    { id: 'S02', mode: 'offline', handler: 'askPrenom.s02Expired' },
    vc9
  );
  assert.strictEqual(r.verdict, VERDICTS.PASS, r.reason);
});

check('R03 non-regression FIX-008 S03 reprendre on patched candidate', () => {
  const r = fix008.runS03ExpiredResumeFixed(wf, 'reprendre');
  assert.strictEqual(r.verdict, VERDICTS.PASS, r.reason);
});

check('R03 variants allowlist on patched candidate', () => {
  const r = fix008.runS03AllowlistVariants(wf);
  assert.strictEqual(r.verdict, VERDICTS.PASS, r.reason);
});

console.log('');
console.log(
  JSON.stringify({
    suite: 'r04-expired-email-fix-032',
    baseWorkflow: 'install-012/after-OCD9It1uKFhOoWNF.json',
    patchReplacements: patched.replacements,
    passed,
    failed,
    verdict: failed === 0 ? 'PASS' : 'FAIL'
  })
);

process.exit(failed === 0 ? 0 : 1);
