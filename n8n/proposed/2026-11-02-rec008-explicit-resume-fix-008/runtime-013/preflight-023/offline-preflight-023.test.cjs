'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');
const crypto = require('node:crypto');

const ttl = require('./lib/ttl-sim.cjs');
const gate = require('../runner-021/lib/ollama-gate.cjs');
const stab = require('../runner-021/lib/postflight-stability.cjs');

const ROOT = path.resolve(__dirname, '..');
const RUNNER = fs.readFileSync(path.join(ROOT, 'run-runtime-013.js'), 'utf8');
const SQL = fs.readFileSync(path.join(__dirname, 'TTL-REFRESH-R01.sql'), 'utf8');

const tests = [];
function check(name, fn) {
  try {
    fn();
    tests.push({ name, ok: true });
  } catch (e) {
    tests.push({ name, ok: false, error: String(e.message || e) });
  }
}

check('ttl_sql_single_session_only', () => {
  assert.match(SQL, /rec008-runtime013-r01-active/);
  assert.match(SQL, /expires_at = NOW\(\) \+ INTERVAL '2 hours'/);
  // UPDATE block must target R01 only (R02/R03 appear in SELECT guards only)
  const upd = SQL.match(/WITH upd AS \([\s\S]*?\)\s*SELECT/i);
  assert.ok(upd, 'upd CTE missing');
  assert.match(upd[0], /WHERE session_id = 'rec008-runtime013-r01-active'/);
  assert.doesNotMatch(upd[0], /r02-expired|r03-resume/);
  assert.match(SQL, /TTL_R01_LEAK_R02R03/);
  assert.match(SQL, /BEGIN;/);
  assert.match(SQL, /COMMIT;/);
});

check('ttl_compliant_session', () => {
  const r = ttl.applyTtlRefreshR01(ttl.fixtureCompliant());
  assert.equal(r.ok, true);
  assert.equal(r.rowsAffected, 1);
  const r01 = r.rows.find((x) => x.session_id === ttl.R01);
  assert.equal(r01.ttl_future, true);
  assert.equal(r01.slot_id, '33333333-3333-4333-8333-333333333301');
  assert.equal(r01.prenom, null);
});

check('ttl_incoherent_session_rejected', () => {
  const rows = ttl.fixtureCompliant();
  rows[0].conversation_step = 'ASK_EMAIL';
  const r = ttl.applyTtlRefreshR01(rows);
  assert.equal(r.ok, false);
  assert.match(r.reason, /GUARD_FAIL/);
});

check('ttl_unknown_session_rejected', () => {
  const rows = ttl.fixtureCompliant().filter((x) => x.session_id !== ttl.R01);
  const r = ttl.applyTtlRefreshR01(rows);
  assert.equal(r.ok, false);
});

check('ttl_no_r02_r03_mutation', () => {
  const before = ttl.fixtureCompliant();
  const r = ttl.applyTtlRefreshR01(before);
  assert.equal(r.ok, true);
  for (const id of [ttl.R02, ttl.R03]) {
    const b = before.find((x) => x.session_id === id);
    const a = r.rows.find((x) => x.session_id === id);
    assert.equal(a.expires_at, b.expires_at);
    assert.equal(a.ttl_future, false);
  }
});

check('ollama_gate_ready', () => {
  const now = Date.parse('2026-11-06T18:00:00Z');
  const g = gate.evaluateOllamaGate({
    psBody: { models: [{ name: 'qwen2.5:1.5b', expires_at: '2026-11-06T18:20:00Z' }] },
    nowMs: now,
    memLimitBytes: 1.5e9,
    memUsageBytes: 1.1e9,
  });
  assert.equal(g.ready, true);
  assert.equal(g.chatTimeoutMs, 180000);
});

check('ollama_gate_not_ready', () => {
  const g = gate.evaluateOllamaGate({ psBody: { models: [] }, nowMs: Date.now() });
  assert.equal(g.ready, false);
});

check('execution_still_active', () => {
  const c = stab.classifyPostflight({
    httpOk: true,
    httpStatus: 200,
    httpAborted: false,
    executionsApiAvailable: true,
    runningCountAfterSettle: 1,
    deactivateOk: true,
    webhookRows: 0,
    assertIssues: [],
  });
  assert.equal(c.verdict, 'UNCERTAIN');
  assert.equal(c.safeDeclared, false);
});

check('executions_api_unavailable', () => {
  const c = stab.classifyPostflight({
    httpAborted: true,
    httpOk: false,
    httpStatus: 0,
    executionsApiAvailable: false,
    runningCountAfterSettle: null,
    deactivateOk: true,
    webhookRows: 0,
    updatedAtBefore: 'a',
    updatedAtImmediate: 'a',
    updatedAtSettled: 'a',
    assertIssues: [],
  });
  assert.equal(c.verdict, 'UNCERTAIN');
  assert.equal(c.safeDeclared, false);
});

check('timeout_late_write', () => {
  const c = stab.classifyPostflight({
    httpAborted: true,
    httpOk: false,
    httpStatus: 0,
    executionsApiAvailable: true,
    runningCountAfterSettle: 0,
    deactivateOk: true,
    webhookRows: 0,
    updatedAtBefore: '2026-11-06T12:00:00Z',
    updatedAtImmediate: '2026-11-06T12:00:00Z',
    updatedAtSettled: '2026-11-06T12:03:00Z',
    assertIssues: [],
  });
  assert.equal(c.class, stab.CLASSES.TIMEOUT_LATE_WRITE);
  assert.equal(c.verdict, 'UNCERTAIN');
});

check('postflight_unobservable', () => {
  const c = stab.classifyPostflight({
    httpOk: true,
    httpStatus: 200,
    httpAborted: false,
    executionsApiAvailable: false,
    deactivateOk: true,
    webhookRows: 0,
    assertIssues: [],
  });
  assert.equal(c.verdict, 'UNCERTAIN');
  assert.equal(c.safeDeclared, false);
});

check('no_automatic_retry', () => {
  assert.match(RUNNER, /retried:\s*false/);
  assert.doesNotMatch(RUNNER, /while\s*\(.*retry/i);
});

check('assertR01_slotIdPresent_after', () => {
  assert.match(RUNNER, /slotIdPresent expected true after R01/);
  assert.match(RUNNER, /slotIdPresent expected true before R01/);
});

check('runner_timeout_180_warm', () => {
  assert.match(RUNNER, /TIMEOUT_AFTER_WARM_MS/);
  assert.equal(gate.TIMEOUT_AFTER_WARM_MS, 180000);
});

const out = {
  mission: 'R01-PREFLIGHT-023',
  pass: tests.every((t) => t.ok),
  total: tests.length,
  failed: tests.filter((t) => !t.ok).map((t) => t.name),
  tests,
  runnerSha256: crypto.createHash('sha256').update(RUNNER).digest('hex'),
};
fs.writeFileSync(path.join(__dirname, 'OFFLINE-TEST-RESULTS.json'), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
process.exit(out.pass ? 0 : 1);
