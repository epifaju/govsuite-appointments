'use strict';

const assert = require('assert');
const {
  evaluateScenarioDescriptor,
  createVc9Context,
  VERDICTS
} = require('../lib/offline-runner.cjs');
const { installOfflineGuards } = require('../lib/security-guard.cjs');

installOfflineGuards();
const ctx = createVc9Context();

function run(name, fn) {
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
function check(name, fn) {
  if (run(name, fn)) passed += 1;
  else failed += 1;
}

check('S01 PASS', () => {
  const r = evaluateScenarioDescriptor(
    { id: 'S01', mode: 'offline', handler: 'askPrenom.s01Active' },
    ctx
  );
  assert.strictEqual(r.verdict, VERDICTS.PASS);
  assert.strictEqual(r.observed.simulation, true);
  assert.strictEqual(r.observed.runtimeRequired, true);
});

check('S02 PASS', () => {
  const r = evaluateScenarioDescriptor(
    { id: 'S02', mode: 'offline', handler: 'askPrenom.s02Expired' },
    ctx
  );
  assert.strictEqual(r.verdict, VERDICTS.PASS);
});

check('S03 VC9-actual PASS (documents capture reprendre)', () => {
  const r = evaluateScenarioDescriptor(
    { id: 'S03', mode: 'offline', handler: 'askPrenom.s03ResumeVc9Actual' },
    ctx
  );
  assert.strictEqual(r.verdict, VERDICTS.PASS);
  assert.strictEqual(r.observed.divergenceFromBrief, true);
  assert.strictEqual(r.observed.vc9Observed.prenom, 'reprendre');
});

check('N02 brief divergence detected PASS', () => {
  const r = evaluateScenarioDescriptor(
    { id: 'N02', mode: 'offline', handler: 'askPrenom.s03BriefDivergence' },
    ctx
  );
  assert.strictEqual(r.verdict, VERDICTS.PASS);
  assert.strictEqual(r.observed.briefSatisfiedByVc9, false);
});

check('N01 expired no prenom PASS', () => {
  const r = evaluateScenarioDescriptor(
    { id: 'N01', mode: 'offline', handler: 'askPrenom.negativeExpiredNoPrenom' },
    ctx
  );
  assert.strictEqual(r.verdict, VERDICTS.PASS);
});

check('SHA pinned', () => {
  assert.strictEqual(
    ctx.meta.sha256,
    '6284f867054879d00292b45b5a8560f25dc778a56979ea354b18af2f5f82b889'
  );
});

console.log(JSON.stringify({ passed, failed }, null, 2));
process.exitCode = failed ? 1 : 0;
