'use strict';

const assert = require('assert');

function assertVerdict(actual, allowed) {
  const list = allowed || ['PASS', 'FAIL', 'UNCERTAIN'];
  assert.ok(list.includes(actual), 'Verdict invalide: ' + actual);
}

function assertNoPiiLeak(text, forbiddenSubstrings) {
  const hay = String(text || '');
  for (const item of forbiddenSubstrings || []) {
    assert.ok(!hay.includes(item), 'Fuite potentielle détectée');
  }
}

function assertHttpNotBusinessSuccess(httpStatus, businessOk) {
  if (httpStatus >= 200 && httpStatus < 300 && businessOk !== true) {
    return {
      ok: false,
      message: 'HTTP 2xx sans succès métier prouvé → UNCERTAIN ou FAIL'
    };
  }
  return { ok: true };
}

function assertTestNotLive(meta) {
  assert.ok(meta && meta.env === 'TEST', 'Environnement doit être TEST');
  assert.ok(meta.liveTouched !== true, 'LIVE touché');
}

module.exports = {
  assertVerdict,
  assertNoPiiLeak,
  assertHttpNotBusinessSuccess,
  assertTestNotLive
};
