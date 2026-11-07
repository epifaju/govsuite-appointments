'use strict';

const VERDICTS = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  ERROR: 'ERROR',
  INCONCLUSIVE: 'INCONCLUSIVE',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  SKIPPED: 'SKIPPED'
});

const PASS_EQUIVALENTS = new Set([VERDICTS.PASS]);

function isCountablePass(verdict) {
  return PASS_EQUIVALENTS.has(verdict);
}

function isBlockingFailure(verdict) {
  return verdict === VERDICTS.FAIL || verdict === VERDICTS.ERROR;
}

function normalizeVerdict(raw) {
  const v = String(raw || '').toUpperCase();
  if (!Object.values(VERDICTS).includes(v)) {
    return VERDICTS.INCONCLUSIVE;
  }
  return v;
}

module.exports = {
  VERDICTS,
  isCountablePass,
  isBlockingFailure,
  normalizeVerdict
};
