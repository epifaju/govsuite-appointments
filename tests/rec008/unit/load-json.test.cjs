'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {
  loadJson,
  LoadJsonError,
  REC008_ROOT,
  PROJECT_ROOT
} = require('../lib/load-json.cjs');

const tmpDir = path.join(REC008_ROOT, 'tmp');
fs.mkdirSync(tmpDir, { recursive: true });

function ok(name, fn) {
  try {
    fn();
    console.log('PASS', name);
    return true;
  } catch (err) {
    console.error('FAIL', name, err.message);
    return false;
  }
}

let passed = 0;
let failed = 0;

function check(name, fn) {
  if (ok(name, fn)) passed += 1;
  else failed += 1;
}

const sampleRel = path.join('fixtures', 'synthetic-slots.json');
const sampleAbs = path.join(REC008_ROOT, sampleRel);

check('absolute path', () => {
  const r = loadJson(sampleAbs);
  assert.ok(r.data.slots);
  assert.strictEqual(path.resolve(r.path), path.resolve(sampleAbs));
});

check('relative from project root tests/rec008/...', () => {
  const r = loadJson(path.join('tests', 'rec008', 'fixtures', 'synthetic-slots.json'));
  assert.ok(r.data.slots);
});

check('relative from tests/rec008/', () => {
  const r = loadJson(sampleRel);
  assert.ok(r.data.slots);
});

check('missing file', () => {
  let threw = false;
  try {
    loadJson(path.join(tmpDir, 'does-not-exist-' + Date.now() + '.json'));
  } catch (err) {
    threw = true;
    assert.ok(err instanceof LoadJsonError);
    assert.strictEqual(err.code, 'NOT_FOUND');
  }
  assert.ok(threw);
});

check('invalid json', () => {
  const bad = path.join(tmpDir, 'invalid.json');
  fs.writeFileSync(bad, '{not-json', 'utf8');
  let threw = false;
  try {
    loadJson(bad);
  } catch (err) {
    threw = true;
    assert.ok(err instanceof LoadJsonError);
    assert.strictEqual(err.code, 'INVALID_JSON');
  } finally {
    fs.unlinkSync(bad);
  }
  assert.ok(threw);
});

check('project root constant', () => {
  assert.ok(fs.existsSync(PROJECT_ROOT));
  assert.ok(fs.existsSync(path.join(PROJECT_ROOT, 'AGENTS.md')));
});

console.log(JSON.stringify({ passed, failed }, null, 2));
process.exitCode = failed ? 1 : 0;
