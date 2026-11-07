'use strict';

const assert = require('assert');
const {
  RUNTIME_VERDICTS,
  loadCatalog,
  loadSyntheticEvidence,
  resolveCase,
  evaluateEvidence,
  catalogCompleteness,
  listOfflineAlreadyOk,
  listRuntimeRequired
} = require('../lib/assertions/readiness-005-p4g2.cjs');

function run(name, fn) {
  try {
    fn();
    console.log('PASS ' + name);
  } catch (err) {
    console.error('FAIL ' + name);
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  }
}

run('catalog completeness PASS with target session + reprendre', () => {
  const catalog = loadCatalog();
  const c = catalogCompleteness(catalog);
  assert.strictEqual(c.verdict, RUNTIME_VERDICTS.PASS);
  assert.strictEqual(c.missing.length, 0);
  assert.strictEqual(catalog.target.sessionId, 'rec008-8f2b1-slot-01');
  assert.strictEqual(catalog.target.chatInput, 'reprendre');
  assert.strictEqual(catalog.executed, false);
  assert.ok(c.runtimeRequiredCount >= 9);
  assert.ok(listOfflineAlreadyOk(catalog).length >= 5);
  assert.ok(listRuntimeRequired(catalog).includes('R005-A01-http-200'));
  assert.ok(listRuntimeRequired(catalog).includes('R005-A06-claim-zero-post-zero'));
  assert.ok(listRuntimeRequired(catalog).includes('R005-A07-deactivate'));
});

run('historicalPassShape → aggregate PASS', () => {
  const fixture = loadSyntheticEvidence();
  const ev = resolveCase(fixture, 'historicalPassShape');
  const out = evaluateEvidence(ev);
  assert.strictEqual(out.verdict, RUNTIME_VERDICTS.PASS);
  assert.strictEqual(out.executedRuntime, false);
  assert.ok(out.assertions.every((a) => a.verdict === RUNTIME_VERDICTS.PASS));
});

run('failClaimOrPost → FAIL hardStop A06', () => {
  const fixture = loadSyntheticEvidence();
  const ev = resolveCase(fixture, 'failClaimOrPost');
  const out = evaluateEvidence(ev);
  assert.strictEqual(out.verdict, RUNTIME_VERDICTS.FAIL);
  const a06 = out.assertions.find((a) => a.id === 'R005-A06-claim-zero-post-zero');
  assert.strictEqual(a06.verdict, RUNTIME_VERDICTS.FAIL);
});

run('failWrongType → FAIL A02', () => {
  const fixture = loadSyntheticEvidence();
  const ev = resolveCase(fixture, 'failWrongType');
  const out = evaluateEvidence(ev);
  assert.strictEqual(out.verdict, RUNTIME_VERDICTS.FAIL);
  const a02 = out.assertions.find((a) => a.id === 'R005-A02-response-type');
  assert.strictEqual(a02.verdict, RUNTIME_VERDICTS.FAIL);
});

run('uncertainTimeout → UNCERTAIN A01, no retry implied', () => {
  const fixture = loadSyntheticEvidence();
  const ev = resolveCase(fixture, 'uncertainTimeout');
  assert.strictEqual(ev.message.retryCount, 0);
  const out = evaluateEvidence(ev);
  assert.strictEqual(out.verdict, RUNTIME_VERDICTS.UNCERTAIN);
  const a01 = out.assertions.find((a) => a.id === 'R005-A01-http-200');
  assert.strictEqual(a01.verdict, RUNTIME_VERDICTS.UNCERTAIN);
});

run('uncertainDeactivateUnread → UNCERTAIN A07', () => {
  const fixture = loadSyntheticEvidence();
  const ev = resolveCase(fixture, 'uncertainDeactivateUnread');
  const out = evaluateEvidence(ev);
  assert.strictEqual(out.verdict, RUNTIME_VERDICTS.UNCERTAIN);
  const a07 = out.assertions.find((a) => a.id === 'R005-A07-deactivate');
  assert.strictEqual(a07.verdict, RUNTIME_VERDICTS.UNCERTAIN);
});

run('evidenceClass split documents offline vs runtimeRequired', () => {
  const catalog = loadCatalog();
  for (const a of catalog.assertions) {
    assert.strictEqual(a.evidenceClass, 'runtimeRequired');
    assert.ok(a.pass && a.fail && a.uncertain);
  }
  assert.strictEqual(catalog.evidenceClasses.offlineAlreadyOk.scenarioId, 'T03-explicit-resume');
  assert.strictEqual(catalog.goNoGo.runtimeP4G2Replay.includes('NO-GO'), true);
  assert.strictEqual(catalog.textualRuntimeProposal.executableRuntimeCode, false);
});
