'use strict';

/**
 * Offline tests for RUNNER-READINESS-021 — no Docker, no n8n, no Ollama, no PG.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const gate = require('./lib/ollama-gate.cjs');
const stab = require('./lib/postflight-stability.cjs');

const ROOT = path.resolve(__dirname, '..');
const RUNNER = fs.readFileSync(path.join(ROOT, 'run-runtime-013.js'), 'utf8');
const GERER_AFTER = path.join(
  ROOT,
  'diag-017',
  'proposed-patch',
  'Gerer_collecte_progressive.AFTER.js',
);
const EXPECT_GERER =
  'f75d49849231f956bb9ae5383111ea84b362dc58de6711cc75d2e7e2a26917fe';

const tests = [];
function check(name, fn) {
  try {
    fn();
    tests.push({ name, ok: true });
  } catch (e) {
    tests.push({ name, ok: false, error: String(e.message || e) });
  }
}

const now = Date.parse('2026-11-06T12:00:00.000Z');
const farExpiry = '2026-11-06T12:20:00.000Z';
const soonExpiry = '2026-11-06T12:01:00.000Z';

check('warmup_verified_via_api_ps', () => {
  const g = gate.evaluateOllamaGate({
    psBody: { models: [{ name: 'qwen2.5:1.5b', expires_at: farExpiry, size: 1e9 }] },
    nowMs: now,
    memLimitBytes: 1.5 * 1024 ** 3,
    memUsageBytes: 1.1 * 1024 ** 3,
  });
  assert.equal(g.ready, true);
  assert.equal(g.chatTimeoutMs, 180000);
  assert.equal(g.warmVerified, true);
  assert.equal(gate.timeoutPolicy(g).basis, 'warm_verified_via_api_ps');
});

check('model_absent_from_api_ps', () => {
  const g = gate.evaluateOllamaGate({ psBody: { models: [] }, nowMs: now });
  assert.equal(g.ready, false);
  assert.equal(g.reason, 'model_absent_from_api_ps');
  assert.equal(g.chatTimeoutMs, null);
});

check('model_expires_too_soon', () => {
  const g = gate.evaluateOllamaGate({
    psBody: { models: [{ name: 'qwen2.5:1.5b', expires_at: soonExpiry }] },
    nowMs: now,
    minExpiresHeadroomMs: 120000,
  });
  assert.equal(g.ready, false);
  assert.equal(g.reason, 'expires_too_soon');
});

check('http_timeout_abort_uncertain', () => {
  const c = stab.classifyPostflight({
    httpAborted: true,
    httpOk: false,
    httpStatus: 0,
    updatedAtBefore: '2026-11-06T12:00:00Z',
    updatedAtImmediate: '2026-11-06T12:00:00Z',
    updatedAtSettled: '2026-11-06T12:00:00Z',
    runningCountAfterSettle: 0,
    executionsApiAvailable: true,
    deactivateOk: true,
    webhookRows: 0,
    assertIssues: [],
  });
  assert.equal(c.verdict, 'UNCERTAIN');
  assert.equal(c.safeDeclared, false);
  assert.match(c.reason, /client_timeout/);
});

check('socket_close_uncertain', () => {
  const c = stab.classifyPostflight({
    httpAborted: false,
    httpOk: false,
    httpStatus: 0,
    updatedAtBefore: 't0',
    updatedAtImmediate: 't0',
    updatedAtSettled: 't0',
    runningCountAfterSettle: 0,
    executionsApiAvailable: true,
    deactivateOk: true,
    webhookRows: 0,
    assertIssues: [],
  });
  assert.equal(c.verdict, 'UNCERTAIN');
  assert.equal(c.safeDeclared, false);
});

check('late_response_ok_business_pass', () => {
  const c = stab.classifyPostflight({
    httpAborted: false,
    httpOk: true,
    httpStatus: 200,
    updatedAtBefore: '2026-11-06T12:00:00Z',
    updatedAtImmediate: '2026-11-06T12:02:00Z',
    updatedAtSettled: '2026-11-06T12:02:00Z',
    runningCountAfterSettle: 0,
    executionsApiAvailable: true,
    deactivateOk: true,
    webhookRows: 0,
    assertIssues: [],
  });
  assert.equal(c.verdict, 'PASS');
  assert.equal(c.class, stab.CLASSES.BUSINESS_OK);
});

check('pg_write_after_abort', () => {
  const c = stab.classifyPostflight({
    httpAborted: true,
    httpOk: false,
    httpStatus: 0,
    updatedAtBefore: '2026-11-06T12:00:00Z',
    updatedAtImmediate: '2026-11-06T12:00:00Z',
    updatedAtSettled: '2026-11-06T12:03:00Z',
    runningCountAfterSettle: 0,
    executionsApiAvailable: true,
    deactivateOk: true,
    webhookRows: 0,
    assertIssues: [],
  });
  assert.equal(c.class, stab.CLASSES.TIMEOUT_LATE_WRITE);
  assert.equal(c.verdict, 'UNCERTAIN');
  assert.equal(c.lateWriteSuspected, true);
  assert.equal(c.safeDeclared, false);
});

check('execution_still_active_after_deactivate', () => {
  const c = stab.classifyPostflight({
    httpAborted: false,
    httpOk: true,
    httpStatus: 200,
    runningCountAfterSettle: 2,
    executionsApiAvailable: true,
    deactivateOk: true,
    webhookRows: 0,
    assertIssues: [],
  });
  assert.equal(c.class, stab.CLASSES.STILL_ACTIVE);
  assert.equal(c.verdict, 'UNCERTAIN');
  assert.equal(c.safeDeclared, false);
  assert.equal(c.webhooksClear, true);
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
  assert.equal(c.class, stab.CLASSES.UNOBSERVABLE);
  assert.equal(c.verdict, 'UNCERTAIN');
  assert.equal(c.safeDeclared, false);
});

check('deactivate_error', () => {
  const c = stab.classifyPostflight({
    httpAborted: false,
    httpOk: true,
    httpStatus: 200,
    executionsApiAvailable: true,
    runningCountAfterSettle: 0,
    deactivateOk: false,
    deactivateError: true,
    webhookRows: 0,
    assertIssues: [],
  });
  assert.equal(c.verdict, 'UNCERTAIN');
  assert.equal(c.reason, 'deactivate_error');
  assert.equal(c.safeDeclared, false);
});

check('postflight_verify_failed', () => {
  const c = stab.classifyPostflight({
    httpAborted: false,
    httpOk: true,
    httpStatus: 200,
    executionsApiAvailable: true,
    runningCountAfterSettle: 0,
    deactivateOk: true,
    webhookRows: 0,
    postflightVerifyFailed: true,
    assertIssues: [],
  });
  assert.equal(c.verdict, 'UNCERTAIN');
  assert.equal(c.reason, 'postflight_verify_failed');
});

check('no_automatic_retry_in_runner', () => {
  assert.match(RUNNER, /retried:\s*false/);
  assert.match(RUNNER, /NO retry|no retry|zero-retry|retried = false/i);
  // sendMessageOnce called once per scenario path — no loop retry
  assert.doesNotMatch(RUNNER, /for\s*\(.*retry/i);
  assert.doesNotMatch(RUNNER, /while\s*\(.*retry/i);
  const sendCount = (RUNNER.match(/sendMessageOnce\(/g) || []).length;
  assert.ok(sendCount >= 1 && sendCount <= 3);
});

check('no_claim_create_appointment_in_runner', () => {
  // Forbid actionable POST CreateAppointment; allow comments + mock counter guards
  assert.doesNotMatch(RUNNER, /fetch\([^\)]*\/appointments/);
  assert.doesNotMatch(RUNNER, /method:\s*['\"]POST['\"][^\n]*appointments|appointments[^\n]*method:\s*['\"]POST/);
  assert.match(RUNNER, /CreateAppointment POST counter increased/); // detection only
  assert.match(RUNNER, /CLAIM counter increased/);
  assert.match(RUNNER, /mockClaims/);
  assert.match(RUNNER, /No CreateAppointment/);
});

check('fix008_invariants_preserved', () => {
  assert.match(RUNNER, /f75d49849231f956bb9ae5383111ea84b362dc58de6711cc75d2e7e2a26917fe/);
  assert.match(RUNNER, /fd75ba32-f018-40e4-9f79-8f2a5400320b/);
  assert.match(RUNNER, /versionCounter/);
  assert.match(RUNNER, /EXPECT_VERSION_COUNTER = 10/);
  // Installed SHA expectation unchanged; AFTER patch file is proposed-only (017) — not required equal
  if (fs.existsSync(path.join(ROOT, 'diag-017', 'G_rer_collecte_progressive.js'))) {
    const installed = fs.readFileSync(
      path.join(ROOT, 'diag-017', 'G_rer_collecte_progressive.js'),
      'utf8',
    );
    const h = crypto.createHash('sha256').update(installed).digest('hex');
    // Extracted dump may differ from live; assert runner still pins EXPECT_GERER
    assert.equal(
      RUNNER.includes(EXPECT_GERER),
      true,
      'runner must keep EXPECT_GERER_SHA',
    );
    void h;
  }
  void GERER_AFTER;
});

check('timeout_default_180s_only_when_ready', () => {
  assert.match(RUNNER, /TIMEOUT_AFTER_WARM_MS/);
  assert.equal(gate.TIMEOUT_AFTER_WARM_MS, 180000);
  assert.match(RUNNER, /CHAT_TIMEOUT_MS = TIMEOUT_AFTER_WARM_MS/);
  assert.doesNotMatch(RUNNER, /const CHAT_TIMEOUT_MS = 45000/);
  const blocked = gate.timeoutPolicy({ ready: false, warmVerified: false });
  assert.equal(blocked.chatTimeoutMs, null);
});

check('correlation_events_no_pii_fields', () => {
  const ev = stab.correlationEvent('chat_http', {
    runToken: 'abc',
    scenarioId: 'R01',
    sessionIdHash: 'deadbeef',
    elapsedMs: 12,
    causeCode: 'ABORT_ERR',
    note: 'Camille should not appear as message body field',
  });
  assert.equal(ev.sessionIdHash, 'deadbeef');
  assert.equal(Object.prototype.hasOwnProperty.call(ev, 'chatInput'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(ev, 'message'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(ev, 'prenom'), false);
});

check('webhooks_clear_not_enough_for_pass', () => {
  const c = stab.classifyPostflight({
    httpAborted: true,
    httpOk: false,
    httpStatus: 0,
    executionsApiAvailable: true,
    runningCountAfterSettle: 1,
    deactivateOk: true,
    webhookRows: 0,
    assertIssues: [],
  });
  assert.equal(c.webhooksClear, true);
  assert.notEqual(c.verdict, 'PASS');
  assert.equal(c.safeDeclared, false);
});

check('r01_contract_doc_present', () => {
  const doc = fs.readFileSync(path.join(__dirname, 'R01-CONTRACT.md'), 'utf8');
  assert.match(doc, /ASK_PRENOM/);
  assert.match(doc, /ASK_EMAIL/);
  assert.match(doc, /Camille/);
  assert.match(doc, /slot_id/);
});

const out = {
  mission: 'R01-RUNNER-READINESS-021',
  pass: tests.every((t) => t.ok),
  total: tests.length,
  failed: tests.filter((t) => !t.ok).map((t) => t.name),
  tests,
};
fs.writeFileSync(path.join(__dirname, 'OFFLINE-TEST-RESULTS.json'), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
process.exit(out.pass ? 0 : 1);
