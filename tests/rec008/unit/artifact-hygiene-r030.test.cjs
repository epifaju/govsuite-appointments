'use strict';

/**
 * MISSION 031 — Tests offline H-01…H-09 + faux positifs / formats internationaux.
 * Aucun HTTP / PG / Docker / LIVE.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { installOfflineGuards } = require('../lib/security-guard.cjs');
const {
  loadCatalogue,
  scanContent,
  scanFile,
  classifyPath,
  aggregateResults,
  EXIT,
  VERDICTS
} = require('../lib/assertions/artifact-hygiene.cjs');
const { REC008_ROOT, PROJECT_ROOT } = require('../lib/load-json.cjs');

installOfflineGuards();

const catalogue = loadCatalogue();
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rec008-hyg-031-'));

function writeTmp(rel, content) {
  const full = path.join(tmpRoot, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  return full;
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

// --- H-01…H-09 ---

check('H-01 FAIL email clair dans rapport', () => {
  const r = scanContent(
    JSON.stringify({ email: 'user.r04@example.test', step: 'ASK_EMAIL' }),
    catalogue,
    { label: 'H-01', path: 'tests/rec008/reports/R04-synth-report.json' }
  );
  assert.strictEqual(r.verdict, VERDICTS.FAIL);
  assert.strictEqual(r.stopCode, 'pii-cleartext-email');
  assert.ok(r.findings[0].patternId === 'HYG-E01');
  assert.strictEqual(r.findings[0].matchedValue, undefined);
});

check('H-02 PASS emailPresent + emailLen', () => {
  const r = scanContent(
    JSON.stringify({ emailPresent: true, emailLen: 22, conversationStep: 'ASK_TELEPHONE' }),
    catalogue,
    { label: 'H-02' }
  );
  assert.strictEqual(r.verdict, VERDICTS.PASS);
});

check('H-03 FAIL téléphone clair E.164', () => {
  const r = scanContent(
    JSON.stringify({ telephone: '+33612345678' }),
    catalogue,
    { label: 'H-03' }
  );
  assert.strictEqual(r.verdict, VERDICTS.FAIL);
  assert.strictEqual(r.stopCode, 'pii-cleartext-phone');
});

check('H-04 PASS telephoneLen sans clair', () => {
  const r = scanContent(
    JSON.stringify({ telephoneIsNull: false, telephoneLen: 12, telephonePresent: true }),
    catalogue,
    { label: 'H-04' }
  );
  assert.strictEqual(r.verdict, VERDICTS.PASS);
});

check('H-05 FAIL Bearer + JWT', () => {
  const jwt =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signaturepart';
  const r = scanContent('Authorization: Bearer ' + jwt, catalogue, { label: 'H-05' });
  assert.strictEqual(r.verdict, VERDICTS.FAIL);
  assert.ok(
    r.findings.some((f) => f.patternId === 'HYG-S01' || f.patternId === 'HYG-S02'),
    'expected HYG-S01 or HYG-S02'
  );
});

check('H-06 PASS corrélation runToken/sessionIdHash', () => {
  const r = scanContent(
    JSON.stringify({
      runToken: 'a1b2c3d4e5f6',
      sessionIdHash: '0123456789abcdef',
      scenarioId: 'R04-A'
    }),
    catalogue,
    { label: 'H-06' }
  );
  assert.strictEqual(r.verdict, VERDICTS.PASS);
});

check('H-07 PASS email synthétique sous fixtures/', () => {
  const fixturePath = path.join(
    REC008_ROOT,
    'fixtures',
    'r04-offline-readiness-031',
    'r04-a-valid-email-state.json'
  );
  // File may be created in parallel; if missing, write a temp under fixtures-like path via classify
  const classy = classifyPath(
    path.join(PROJECT_ROOT, 'tests/rec008/fixtures/r04-offline-readiness-031/demo.json'),
    catalogue
  );
  assert.strictEqual(classy.kind, 'FIXTURE_ALLOW');
  if (fs.existsSync(fixturePath)) {
    const r = scanFile(fixturePath, catalogue);
    assert.strictEqual(r.verdict, VERDICTS.PASS);
    assert.strictEqual(r.classification, 'FIXTURE_ALLOW');
  }
});

check('H-08 FAIL même email dans reports/R04-*', () => {
  const reportPath = writeTmp(
    'reports-sim/R04-leak.md',
    '# leak\ncontact: user.r04@example.test\n'
  );
  // Force scan as report content (tmp not under allowlist)
  const r = scanContent(fs.readFileSync(reportPath, 'utf8'), catalogue, {
    path: 'tests/rec008/reports/R04-leak.md',
    label: 'H-08'
  });
  assert.strictEqual(r.verdict, VERDICTS.FAIL);
  assert.strictEqual(r.stopCode, 'pii-cleartext-email');
});

check('H-09 SKIP historique dette B9 / R01–R03', () => {
  const hist = classifyPath(
    path.join(PROJECT_ROOT, 'tests/rec008/readiness/R024-r01-runtime-qa-verdict.json'),
    catalogue
  );
  assert.ok(hist.skip === true || hist.kind === 'HISTORICAL_B9');
  const art = classifyPath(
    path.join(
      PROJECT_ROOT,
      'n8n/proposed/x/runtime-013/artifacts-r01-024/R01-result.json'
    ),
    catalogue
  );
  assert.ok(art.skip === true || art.kind === 'HISTORICAL_R0X');
});

// --- Extra: secrets, international phones, false positives, unreadable ---

check('HYG-S03/S04 password + api_key FAIL', () => {
  const r = scanContent('api_key: sk_test_abc123\npassword=hunter2', catalogue, {
    label: 'S-extra'
  });
  assert.strictEqual(r.verdict, VERDICTS.FAIL);
  assert.strictEqual(r.stopCode, 'secret-or-token-cleartext');
});

check('Phone national FR HYG-T02', () => {
  const r = scanContent('Appelez le 0612345678 demain', catalogue, { label: 'T02' });
  assert.strictEqual(r.verdict, VERDICTS.FAIL);
  assert.strictEqual(r.stopCode, 'pii-cleartext-phone');
});

check('False positive: emailPresent field name only PASS', () => {
  const r = scanContent(
    '{"emailPresent":false,"emailLen":0,"emailHash":"deadbeefcafebabe"}',
    catalogue,
    { label: 'fp-email' }
  );
  assert.strictEqual(r.verdict, VERDICTS.PASS);
});

check('False positive: pattern doc string with example.test in allowlist path', () => {
  const classy = classifyPath('tests/rec008/fixtures/doc-note.json', catalogue);
  assert.strictEqual(classy.kind, 'FIXTURE_ALLOW');
});

check('International US-like number may not match FR patterns (no false FR fail)', () => {
  // +1 202 555 0123 — not HYG-T01/T02; should PASS on phone patterns alone
  // (still must not contain email)
  const r = scanContent('callback +1 202 555 0123', catalogue, { label: 'intl' });
  assert.strictEqual(r.verdict, VERDICTS.PASS);
});

check('Unusual path with spaces still classifiable', () => {
  const p = path.join(PROJECT_ROOT, 'tests', 'rec008', 'fixtures', 'odd path', 'x.json');
  const c = classifyPath(p, catalogue);
  assert.strictEqual(c.kind, 'FIXTURE_ALLOW');
});

check('Unreadable file → UNCERTAIN', () => {
  const missing = path.join(tmpRoot, 'no-such', 'missing-report-R04.json');
  const r = scanFile(missing, catalogue);
  // not under fixture; unreadable
  assert.strictEqual(r.verdict, 'UNCERTAIN');
  assert.strictEqual(r.incomplete, true);
});

check('NEVER_READ .env skipped without scanning', () => {
  const envPath = path.join(PROJECT_ROOT, '.env.rec008-test.local');
  const r = scanFile(envPath, catalogue);
  assert.ok(r.classification === 'NEVER_READ' || r.verdict === VERDICTS.PASS);
  assert.strictEqual(r.scanned, false);
});

check('aggregate FAIL wins over PASS', () => {
  const agg = aggregateResults([
    { verdict: VERDICTS.PASS, findings: [] },
    { verdict: VERDICTS.FAIL, findings: [{ patternId: 'HYG-E01', stopCode: 'pii-cleartext-email' }] }
  ]);
  assert.strictEqual(agg.verdict, VERDICTS.FAIL);
  assert.strictEqual(agg.exitCode, EXIT.FAIL);
});

check('aggregate UNCERTAIN when incomplete and no FAIL', () => {
  const agg = aggregateResults([
    { verdict: VERDICTS.PASS, findings: [] },
    { verdict: 'UNCERTAIN', incomplete: true, findings: [] }
  ]);
  assert.strictEqual(agg.verdict, 'UNCERTAIN');
  assert.strictEqual(agg.exitCode, EXIT.UNCERTAIN);
});

check('safe findings omit plaintext', () => {
  const r = scanContent('user.r04@example.test', catalogue, { label: 'omit' });
  const dumped = JSON.stringify(r.findings);
  assert.ok(!dumped.includes('user.r04@example.test'));
});

console.log('');
console.log(
  JSON.stringify({
    suite: 'artifact-hygiene-r030',
    passed,
    failed,
    verdict: failed === 0 ? 'PASS' : 'FAIL',
    exitCode: failed === 0 ? EXIT.PASS : EXIT.FAIL
  })
);

process.exit(failed === 0 ? EXIT.PASS : EXIT.FAIL);
