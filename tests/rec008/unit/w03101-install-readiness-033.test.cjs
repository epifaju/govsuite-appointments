'use strict';

/**
 * MISSION 033 — Non-régression offline sur le candidat EXACT diag-032.
 * Ferme la lacune matrice 032 R01/R02 (VC9 harness → candidat W03101).
 * Couvre R01 R02 R03 R04-A…F + hygiene. Aucun HTTP / PUT / PG / Docker / LIVE.
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
  runR04DExpiredResume,
  runR04EPreexistingEmail,
  runR04FExpiredPhoneNoCapture
} = require('../lib/assertions/readiness-032-r04-email.cjs');
const {
  runS01AskPrenomActive,
  runS02AskPrenomExpired
} = require('../lib/assertions/readiness-007-ask-prenom.cjs');
const fix008 = require('../lib/assertions/fix-008-explicit-resume.cjs');
const { scanContent, loadCatalogue } = require('../lib/assertions/artifact-hygiene.cjs');

installOfflineGuards();

const CAND_REL =
  'n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/runtime-013/diag-032/after-OCD9It1uKFhOoWNF.W03101-candidate.json';
const CAND_PATH = path.join(PROJECT_ROOT, CAND_REL);
const SHA_META = JSON.parse(
  fs.readFileSync(
    path.join(
      PROJECT_ROOT,
      'n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/runtime-013/diag-032/SHA256.json'
    ),
    'utf8'
  )
);

const candBuf = fs.readFileSync(CAND_PATH);
const wf = JSON.parse(candBuf.toString('utf8'));
const gerer = wf.nodes.find((n) => n.name === 'Gérer collecte progressive').parameters.jsCode;
const gererSha = crypto.createHash('sha256').update(gerer, 'utf8').digest('hex');
const fileSha = crypto.createHash('sha256').update(candBuf).digest('hex');
const catalogue = loadCatalogue();

let passed = 0;
let failed = 0;
const coverage = {};

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

function assertPass(r, label) {
  assert.strictEqual(r.verdict, VERDICTS.PASS, (label || '') + ' ' + (r.reason || ''));
}

check('candidate pin SHA Gerer + file', () => {
  assert.strictEqual(wf.id, 'OCD9It1uKFhOoWNF');
  assert.strictEqual(wf.nodes.length, 134);
  assert.strictEqual(gererSha, SHA_META.gererNodeSha256.after);
  assert.strictEqual(fileSha, SHA_META.workflowFileSha256.afterCandidate);
  assert.strictEqual(SHA_META.replacements, 4);
  assert.strictEqual(wf.active, false);
  assert.ok(!/previous\.email \?\? x\.email/.test(gerer.split('// reprise explicite')[0]));
  coverage.pin = 'PASS';
});

check('R01 ASK_PRENOM actif Camille on exact candidate', () => {
  const r = runS01AskPrenomActive(wf);
  assertPass(r, 'R01');
  const byId = Object.fromEntries((r.assertions || []).map((a) => [a.id, a]));
  assert.strictEqual(byId.s01_prenom_captured && byId.s01_prenom_captured.verdict, VERDICTS.PASS);
  assert.strictEqual(byId.s01_next_ask_email && byId.s01_next_ask_email.verdict, VERDICTS.PASS);
  assert.strictEqual(byId.s01_no_claim_post && byId.s01_no_claim_post.verdict, VERDICTS.PASS);
  assert.strictEqual(byId.s01_no_create_appt && byId.s01_no_create_appt.verdict, VERDICTS.PASS);
  const hyg = scanContent(JSON.stringify(r.observed), catalogue, { label: 'r01-obs' });
  assert.strictEqual(hyg.verdict, VERDICTS.PASS);
  coverage.R01 = 'PASS';
});

check('R02 ASK_PRENOM expired Camille on exact candidate', () => {
  const r = runS02AskPrenomExpired(wf);
  assertPass(r, 'R02');
  const byId = Object.fromEntries((r.assertions || []).map((a) => [a.id, a]));
  assert.strictEqual(byId.s02_session_expired && byId.s02_session_expired.verdict, VERDICTS.PASS);
  assert.strictEqual(byId.s02_prenom_not_captured && byId.s02_prenom_not_captured.verdict, VERDICTS.PASS);
  assert.strictEqual(byId.s02_refresh_ttl_false && byId.s02_refresh_ttl_false.verdict, VERDICTS.PASS);
  assert.strictEqual(byId.s02_reply_session_expired && byId.s02_reply_session_expired.verdict, VERDICTS.PASS);
  assert.strictEqual(byId.s02_no_claim_post && byId.s02_no_claim_post.verdict, VERDICTS.PASS);
  const hyg = scanContent(JSON.stringify(r.observed), catalogue, { label: 'r02-obs' });
  assert.strictEqual(hyg.verdict, VERDICTS.PASS);
  coverage.R02 = 'PASS';
});

check('R03 FIX-008 S03 reprendre on exact candidate', () => {
  const r = fix008.runS03ExpiredResumeFixed(wf, 'reprendre');
  assertPass(r, 'R03');
  coverage.R03 = 'PASS';
});

check('R03 allowlist variants on exact candidate', () => {
  const r = fix008.runS03AllowlistVariants(wf);
  assertPass(r, 'R03-variants');
  coverage.R03_variants = 'PASS';
});

check('R04-A valid email → ASK_TELEPHONE', () => {
  const r = runR04AValidEmail(wf);
  assertPass(r, 'R04-A');
  assert.strictEqual(r.observed.conversationStep, 'ASK_TELEPHONE');
  assert.strictEqual(r.observed.emailPresent, true);
  assert.strictEqual(r.observed.mockPostsDelta, 0);
  assert.strictEqual(r.observed.mockClaimsDelta, 0);
  coverage['R04-A'] = 'PASS';
});

check('R04-B invalid stays ASK_EMAIL', () => {
  const r = runR04BInvalidEmail(wf);
  assertPass(r, 'R04-B');
  assert.strictEqual(r.observed.conversationStep, 'ASK_EMAIL');
  assert.strictEqual(r.observed.emailPresent, false);
  assert.strictEqual(r.observed.mockPostsDelta, 0);
  coverage['R04-B'] = 'PASS';
});

check('R04-C strict no email capture on expired', () => {
  const r = runR04CStrictNoEmailCapture(wf);
  assertPass(r, 'R04-C');
  assert.strictEqual(r.observed.emailPresent, false);
  assert.strictEqual(r.observed.conversationStep, 'ASK_EMAIL');
  assert.strictEqual(r.observed.refreshSessionTtl, false);
  assert.strictEqual(r.observed.saveEmailPresent, false);
  assert.strictEqual(r.observed.mockPostsDelta, 0);
  coverage['R04-C'] = 'PASS';
});

check('R04-D expired reprendre', () => {
  const r = runR04DExpiredResume(wf);
  assertPass(r, 'R04-D');
  assert.strictEqual(r.observed.refreshSessionTtl, true);
  assert.strictEqual(r.observed.emailPresent, false);
  coverage['R04-D'] = 'PASS';
});

check('R04-E preexisting email preserved', () => {
  const r = runR04EPreexistingEmail(wf);
  assertPass(r, 'R04-E');
  assert.strictEqual(r.observed.emailPresent, true);
  assert.strictEqual(scanContent(JSON.stringify(r.observed), catalogue, { label: 'r04e' }).verdict, VERDICTS.PASS);
  coverage['R04-E'] = 'PASS';
});

check('R04-F expired no phone capture', () => {
  const r = runR04FExpiredPhoneNoCapture(wf);
  assertPass(r, 'R04-F');
  assert.strictEqual(r.observed.telephonePresent, false);
  coverage['R04-F'] = 'PASS';
});

check('hygiene HYG-S06 UUID token FAIL', () => {
  const r = scanContent(
    JSON.stringify({ token: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
    catalogue,
    { label: 'S06' }
  );
  assert.strictEqual(r.verdict, VERDICTS.FAIL);
  assert.ok(r.findings.some((f) => f.patternId === 'HYG-S06'));
  assert.ok(!JSON.stringify(r.findings).includes('aaaaaaaa'));
  coverage.HYG_S06 = 'PASS';
});

check('hygiene HYG-S07 N8N_ENCRYPTION_KEY FAIL', () => {
  const r = scanContent('N8N_ENCRYPTION_KEY=not-a-real-secret-value', catalogue, { label: 'S07' });
  assert.strictEqual(r.verdict, VERDICTS.FAIL);
  assert.ok(r.findings.some((f) => f.patternId === 'HYG-S07'));
  coverage.HYG_S07 = 'PASS';
});

check('hygiene HYG-S08 JSON password/secret FAIL', () => {
  const r = scanContent('{"password":"x","secret":"y"}', catalogue, { label: 'S08' });
  assert.strictEqual(r.verdict, VERDICTS.FAIL);
  assert.ok(r.findings.some((f) => f.patternId === 'HYG-S08'));
  coverage.HYG_S08 = 'PASS';
});

check('hygiene HYG-T03 E.164 intl FAIL', () => {
  const r = scanContent('call +14155552671 please', catalogue, { label: 'T03' });
  assert.strictEqual(r.verdict, VERDICTS.FAIL);
  assert.strictEqual(r.stopCode, 'pii-cleartext-phone');
  coverage.HYG_T03 = 'PASS';
});

check('hygiene false-positive session UUID without token key PASS', () => {
  const r = scanContent(
    JSON.stringify({
      sessionId: 'rec008-syn-r033',
      slotId: '11111111-1111-4111-8111-111111111301',
      emailPresent: true,
      emailLen: 22
    }),
    catalogue,
    { label: 'fp' }
  );
  assert.strictEqual(r.verdict, VERDICTS.PASS);
  coverage.HYG_FP = 'PASS';
});

console.log('');
console.log(
  JSON.stringify({
    suite: 'w03101-install-readiness-033',
    candidate: CAND_REL,
    gererSha,
    fileSha,
    replacements: SHA_META.replacements,
    matrixGapClosed: ['R01', 'R02'],
    coverage,
    passed,
    failed,
    verdict: failed === 0 ? 'PASS' : 'FAIL',
    gates: {
      offlineCoverage: failed === 0 ? 'PASS' : 'FAIL',
      installTest: 'NO-GO',
      r04Runtime: 'NO-GO',
      live: 'NO-GO'
    }
  })
);
process.exit(failed === 0 ? 0 : 1);
