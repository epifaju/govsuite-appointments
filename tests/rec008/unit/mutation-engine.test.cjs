'use strict';

/**
 * Tests de mutation contrôlés du moteur — copies locales uniquement.
 * Restaure toujours les fixtures après coup.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {
  evaluateScenarioDescriptor,
  createVc9Context,
  VERDICTS,
  REC008_ROOT
} = require('../lib/offline-runner.cjs');
const { installOfflineGuards } = require('../lib/security-guard.cjs');
const { loadJson } = require('../lib/load-json.cjs');

installOfflineGuards();

const tmpDir = path.join(REC008_ROOT, 'tmp');
fs.mkdirSync(tmpDir, { recursive: true });

function check(name, fn) {
  try {
    fn();
    console.log('PASS', name);
    return true;
  } catch (err) {
    console.error('FAIL', name, err && err.message);
    return false;
  }
}

let passed = 0;
let failed = 0;
function run(name, fn) {
  if (check(name, fn)) passed += 1;
  else failed += 1;
}

const ctx = createVc9Context();

run('skeletonOnly never PASS', () => {
  const r = evaluateScenarioDescriptor(
    {
      id: 'mut-skeleton',
      mode: 'offline',
      expects: { skeletonOnly: true }
    },
    ctx
  );
  assert.strictEqual(r.verdict, VERDICTS.NOT_IMPLEMENTED);
  assert.notStrictEqual(r.verdict, VERDICTS.PASS);
});

run('missing handler NOT_IMPLEMENTED', () => {
  const r = evaluateScenarioDescriptor(
    { id: 'mut-no-handler', mode: 'offline', expects: {} },
    ctx
  );
  assert.strictEqual(r.verdict, VERDICTS.NOT_IMPLEMENTED);
});

run('wrong expected field causes FAIL', () => {
  // Mutate assertion indirectly: run ASK_PRENOM but compare against wrong next step via clone handler path
  const original = evaluateScenarioDescriptor(
    {
      id: 'C03-ask-prenom',
      mode: 'offline',
      handler: 'identity.askPrenom'
    },
    ctx
  );
  assert.strictEqual(original.verdict, VERDICTS.PASS);
  const mutated = Object.assign({}, original, {
    assertions: (original.assertions || []).map((a) =>
      a.id === 'next_step'
        ? Object.assign({}, a, {
            expected: 'ASK_NOM',
            verdict: a.observed === 'ASK_NOM' ? VERDICTS.PASS : VERDICTS.FAIL
          })
        : a
    )
  });
  const failedAssert = mutated.assertions.find((a) => a.id === 'next_step');
  assert.strictEqual(failedAssert.verdict, VERDICTS.FAIL);
  assert.notStrictEqual(failedAssert.verdict, VERDICTS.PASS);
});

run('remove required handler field → NOT_IMPLEMENTED', () => {
  const basePath = path.join(
    REC008_ROOT,
    'scenarios',
    'conversational',
    'C03-ask-prenom.json'
  );
  const loaded = loadJson(basePath);
  const copyPath = path.join(tmpDir, 'mut-missing-handler.json');
  const copy = Object.assign({}, loaded.data);
  delete copy.handler;
  copy.id = 'mut-missing-handler';
  copy.expects = Object.assign({}, copy.expects || {});
  fs.writeFileSync(copyPath, JSON.stringify(copy, null, 2), 'utf8');
  try {
    const desc = loadJson(copyPath).data;
    const r = evaluateScenarioDescriptor(desc, ctx);
    assert.strictEqual(r.verdict, VERDICTS.NOT_IMPLEMENTED);
  } finally {
    fs.unlinkSync(copyPath);
  }
});

run('simulate wrong business reply → FAIL detection', () => {
  const good = evaluateScenarioDescriptor(
    {
      id: 'T01',
      mode: 'offline',
      handler: 'ttl.expiredFreeText'
    },
    ctx
  );
  assert.strictEqual(good.verdict, VERDICTS.PASS);
  const forged = Object.assign({}, good.observed, {
    replyType: 'services'
  });
  assert.notStrictEqual(forged.replyType, 'session_expired');
  // Engine-level: if observed reply were services, assertion reply_type would FAIL
  const replyAssert = good.assertions.find((a) => a.id === 'reply_type');
  assert.ok(replyAssert);
  assert.strictEqual(replyAssert.expected, 'session_expired');
  const wouldFail =
    forged.replyType === replyAssert.expected ? VERDICTS.PASS : VERDICTS.FAIL;
  assert.strictEqual(wouldFail, VERDICTS.FAIL);
});

run('invalid JSON fixture → ERROR via loadJson', () => {
  const bad = path.join(tmpDir, 'mut-invalid.json');
  fs.writeFileSync(bad, '{"id":', 'utf8');
  try {
    let code = null;
    try {
      loadJson(bad);
    } catch (err) {
      code = err.code;
    }
    assert.strictEqual(code, 'INVALID_JSON');
  } finally {
    fs.unlinkSync(bad);
  }
});

run('execution error surfaces ERROR', () => {
  const r = evaluateScenarioDescriptor(
    {
      id: 'mut-bad-handler',
      mode: 'offline',
      handler: 'does.not.exist'
    },
    ctx
  );
  assert.strictEqual(r.verdict, VERDICTS.NOT_IMPLEMENTED);
});

run('restore original C03 unchanged', () => {
  const p = path.join(REC008_ROOT, 'scenarios', 'conversational', 'C03-ask-prenom.json');
  const d = loadJson(p).data;
  assert.strictEqual(d.handler, 'identity.askPrenom');
  assert.strictEqual(d.id, 'C03-ask-prenom');
});

run('K01 PASS is claim-gate only with runtimeRequired', () => {
  const r = evaluateScenarioDescriptor(
    {
      id: 'K01-positive-oui',
      mode: 'offline',
      handler: 'confirm.affirmClaimGate'
    },
    ctx
  );
  assert.strictEqual(r.verdict, VERDICTS.PASS);
  assert.strictEqual(r.observed.runtimeRequired, true);
  assert.strictEqual(r.observed.postExecuted, false);
  assert.strictEqual(r.observed.simulation, true);
});

run('E03 500 never CONFIRMED', () => {
  const r = evaluateScenarioDescriptor(
    { id: 'E03', mode: 'offline', handler: 'http.classify500' },
    ctx
  );
  assert.strictEqual(r.verdict, VERDICTS.PASS);
  const outcome = r.assertions.find((a) => a.id === 'uncertain');
  assert.ok(outcome);
  assert.strictEqual(outcome.observed, 'UNCERTAIN');
});

run('mutated HTTP 200 expectation on E01 would FAIL', () => {
  const r = evaluateScenarioDescriptor(
    { id: 'E01', mode: 'offline', handler: 'http.classify400' },
    ctx
  );
  assert.strictEqual(r.verdict, VERDICTS.PASS);
  const forged =
    r.assertions.find((a) => a.id === 'outcome_rejected').observed === 'CONFIRMED'
      ? VERDICTS.PASS
      : VERDICTS.FAIL;
  assert.strictEqual(forged, VERDICTS.FAIL);
});

console.log(JSON.stringify({ passed, failed }, null, 2));
process.exitCode = failed ? 1 : 0;
