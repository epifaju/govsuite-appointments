'use strict';

/**
 * MISSION 032 — Renforcement scanner (UUID token, ENCRYPTION_KEY, JSON secrets, intl).
 * Ne log jamais les valeurs détectées.
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
  VERDICTS
} = require('../lib/assertions/artifact-hygiene.cjs');
const { PROJECT_ROOT } = require('../lib/load-json.cjs');

installOfflineGuards();
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

check('HYG-S06 UUID token JSON FAIL', () => {
  const r = scanContent(
    JSON.stringify({ token: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
    catalogue,
    { label: 'S06' }
  );
  assert.strictEqual(r.verdict, VERDICTS.FAIL);
  assert.ok(r.findings.some((f) => f.patternId === 'HYG-S06'));
  assert.ok(!JSON.stringify(r.findings).includes('aaaaaaaa'));
});

check('HYG-S07 N8N_ENCRYPTION_KEY FAIL', () => {
  const r = scanContent('N8N_ENCRYPTION_KEY=not-a-real-secret-value', catalogue, { label: 'S07' });
  assert.strictEqual(r.verdict, VERDICTS.FAIL);
  assert.ok(r.findings.some((f) => f.patternId === 'HYG-S07'));
  assert.ok(!JSON.stringify(r.findings).includes('not-a-real'));
});

check('HYG-S08 JSON password/secret FAIL', () => {
  const r = scanContent('{"password":"x","secret":"y"}', catalogue, { label: 'S08' });
  assert.strictEqual(r.verdict, VERDICTS.FAIL);
  assert.ok(r.findings.some((f) => f.patternId === 'HYG-S08'));
});

check('HYG-T03 international E.164 compact FAIL', () => {
  const r = scanContent('call +14155552671 please', catalogue, { label: 'T03' });
  assert.strictEqual(r.verdict, VERDICTS.FAIL);
  assert.strictEqual(r.stopCode, 'pii-cleartext-phone');
});

check('False positive: synthetic session id UUID without token key PASS', () => {
  const r = scanContent(
    JSON.stringify({
      sessionId: 'rec008-syn-r032',
      slotId: '11111111-1111-4111-8111-111111111301',
      runToken: 'a1b2c3d4e5f6'
    }),
    catalogue,
    { label: 'fp-uuid' }
  );
  assert.strictEqual(r.verdict, VERDICTS.PASS);
});

check('False positive: tokenPresent=false PASS', () => {
  const r = scanContent(JSON.stringify({ tokenPresent: false }), catalogue, { label: 'fp-tok' });
  assert.strictEqual(r.verdict, VERDICTS.PASS);
});

check('Unreadable → UNCERTAIN', () => {
  const missing = path.join(os.tmpdir(), 'rec008-missing-' + Date.now(), 'R04-x.json');
  const r = scanFile(missing, catalogue);
  assert.strictEqual(r.verdict, 'UNCERTAIN');
});

check('Unauthorized LIVE path never scanned', () => {
  const p = path.join(PROJECT_ROOT, 'n8n', 'live-exports', 'secret.json');
  const c = classifyPath(p, catalogue);
  assert.strictEqual(c.kind, 'NEVER_READ');
});

console.log('');
console.log(
  JSON.stringify({
    suite: 'artifact-hygiene-r032',
    passed,
    failed,
    verdict: failed === 0 ? 'PASS' : 'FAIL'
  })
);
process.exit(failed === 0 ? 0 : 1);
