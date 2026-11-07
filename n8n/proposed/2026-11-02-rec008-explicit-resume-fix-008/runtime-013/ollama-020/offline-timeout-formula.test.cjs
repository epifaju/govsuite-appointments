'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

const result = JSON.parse(fs.readFileSync(path.join(__dirname, 'RESULT.json'), 'utf8'));
const t = result.timeoutAnalysis;
const tests = [];
function check(name, fn) {
  try {
    fn();
    tests.push({ name, ok: true });
  } catch (e) {
    tests.push({ name, ok: false, error: String(e.message || e) });
  }
}

check('measures_present', () => {
  assert.equal(result.verdict, 'PASS');
  assert.ok(t.coldWallMs > 45000);
  assert.ok(t.warmWallMs < 45000);
});

check('two_useful_ollama_calls_cold_warm', () => {
  // Path utile reproductible : cold + warm (unload seulement si déjà chargé).
  assert.equal(result.ollamaCalls, 2);
  assert.ok(result.ollamaCalls <= result.maxOllamaCalls);
  assert.equal(result.measures.calls.length, 2);
  assert.equal(result.measures.calls[0].label, 'cold_chat');
  assert.equal(result.measures.calls[1].label, 'warm_chat');
  assert.equal(result.measures.cold.ok, true);
  assert.equal(result.measures.warm.ok, true);
  // Cold légitime sans unload : modèle absent de /api/ps avant + load >> warm.
  assert.deepEqual(result.loadedBefore, []);
  assert.equal(result.measures.unloadedForCold, false);
  assert.ok(t.coldLoadDurationMs > t.warmWallMs);
});

check('no_r01_campaign', () => {
  assert.equal(result.chatTriggerUsed, false);
  assert.equal(result.n8nActivated, false);
  assert.equal(result.pgMutated, false);
  assert.equal(result.dockerMutated, false);
  assert.equal(result.liveProbed, false);
  assert.equal(result.gate.r01Campaign, 'NO-GO');
});

check('formula_beats_45s', () => {
  assert.ok(t.recommendedClientTimeoutMs > 45000);
  // Cold wall 88s et load seul 63s rendent 45s insuffisant ; formule = cold+60s ici.
  assert.ok(t.coldWallMs > t.clientCurrentMs);
  assert.ok(t.coldLoadDurationMs > t.clientCurrentMs);
  const expected = Math.max(
    120000,
    Math.ceil(t.warmWallMs * 3 + 30000),
    Math.ceil(t.coldWallMs + 60000),
  );
  assert.equal(t.recommendedClientTimeoutMs, expected);
  assert.equal(t.formula, 'max(120s, warm*3+30s, cold+60s)');
});

check('no_retry_flag', () => {
  assert.equal(t.noRetry, true);
});

check('warmup_verified_via_ps', () => {
  assert.equal(result.warmupStrategy.stableHold, true);
  assert.equal(result.warmupStrategy.http200NotEnough, true);
  assert.ok(
    (result.measures.loadedAfterWarm || []).some((m) =>
      String(m.name).includes('qwen2.5'),
    ),
  );
});

const out = { pass: tests.every((x) => x.ok), tests };
fs.writeFileSync(path.join(__dirname, 'OFFLINE-TEST-RESULTS.json'), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
process.exit(out.pass ? 0 : 1);
