'use strict';

/**
 * Classify postflight stability after a single chat attempt (no retry).
 * Client timeout is NEVER proof that the server stopped processing.
 */

const CLASSES = {
  BUSINESS_OK: 'execution_finished_business_conformant',
  BUSINESS_FAIL: 'execution_finished_business_nonconformant',
  STILL_ACTIVE: 'execution_still_active',
  UNOBSERVABLE: 'execution_unobservable',
  TIMEOUT_LATE_WRITE: 'timeout_with_late_pg_write',
  INDETERMINATE: 'final_state_indeterminate',
};

/**
 * @param {object} i
 * @param {boolean} i.httpAborted
 * @param {boolean} i.httpOk
 * @param {number} i.httpStatus
 * @param {string|null} i.updatedAtBefore
 * @param {string|null} i.updatedAtImmediate
 * @param {string|null} i.updatedAtSettled
 * @param {number|null} i.runningCountBeforeDeactivate
 * @param {number|null} i.runningCountAfterSettle
 * @param {boolean} i.executionsApiAvailable
 * @param {boolean} i.deactivateOk
 * @param {boolean} i.deactivateError
 * @param {number|null} i.webhookRows
 * @param {string[]} [i.assertIssues]
 * @param {boolean} [i.postflightVerifyFailed]
 */
function classifyPostflight(i) {
  const assertIssues = Array.isArray(i.assertIssues) ? i.assertIssues : [];
  const webhooksClear = i.webhookRows === 0;
  const deactivateOk = i.deactivateOk === true && i.deactivateError !== true;

  // Hard: still running after settle → never PASS / never safeDeclared
  if (
    i.executionsApiAvailable === true &&
    Number.isFinite(i.runningCountAfterSettle) &&
    i.runningCountAfterSettle > 0
  ) {
    return {
      class: CLASSES.STILL_ACTIVE,
      verdict: 'UNCERTAIN',
      safeDeclared: false,
      reason: 'running_executions_after_settle',
      webhooksClear,
      note: 'Webhooks off is not sufficient while executions remain running',
    };
  }

  if (i.deactivateError === true || i.postflightVerifyFailed === true) {
    return {
      class: CLASSES.INDETERMINATE,
      verdict: 'UNCERTAIN',
      safeDeclared: false,
      reason: i.deactivateError ? 'deactivate_error' : 'postflight_verify_failed',
      webhooksClear,
    };
  }

  if (i.executionsApiAvailable === false) {
    // Cannot prove server stopped — even if webhooks cleared
    const late = isLateWrite(i.updatedAtBefore, i.updatedAtImmediate, i.updatedAtSettled);
    if (i.httpAborted || i.httpStatus === 0) {
      return {
        class: late ? CLASSES.TIMEOUT_LATE_WRITE : CLASSES.UNOBSERVABLE,
        verdict: 'UNCERTAIN',
        safeDeclared: false,
        reason: late ? 'abort_late_write_exec_api_down' : 'exec_api_unavailable_after_abort',
        webhooksClear,
        lateWriteSuspected: late,
      };
    }
    return {
      class: CLASSES.UNOBSERVABLE,
      verdict: 'UNCERTAIN',
      safeDeclared: false,
      reason: 'executions_api_unavailable',
      webhooksClear,
      lateWriteSuspected: late,
    };
  }

  const late = isLateWrite(i.updatedAtBefore, i.updatedAtImmediate, i.updatedAtSettled);

  if (i.httpAborted || i.httpStatus === 0) {
    return {
      class: late ? CLASSES.TIMEOUT_LATE_WRITE : CLASSES.INDETERMINATE,
      verdict: 'UNCERTAIN',
      safeDeclared: false,
      reason: late ? 'client_timeout_late_pg_write' : 'client_timeout_no_proof_server_idle',
      webhooksClear,
      lateWriteSuspected: late,
      note: 'Client timeout ≠ absence of server processing',
    };
  }

  if (!deactivateOk || !webhooksClear) {
    return {
      class: CLASSES.INDETERMINATE,
      verdict: 'UNCERTAIN',
      safeDeclared: false,
      reason: !deactivateOk ? 'deactivate_not_ok' : 'webhooks_not_clear',
      webhooksClear,
    };
  }

  // HTTP OK path — business assertions decide PASS/FAIL only if idle + observable
  const runningIdle =
    Number.isFinite(i.runningCountAfterSettle) && i.runningCountAfterSettle === 0;
  if (!runningIdle) {
    return {
      class: CLASSES.INDETERMINATE,
      verdict: 'UNCERTAIN',
      safeDeclared: false,
      reason: 'running_count_unknown',
      webhooksClear,
    };
  }

  if (assertIssues.length > 0) {
    return {
      class: CLASSES.BUSINESS_FAIL,
      verdict: 'FAIL',
      safeDeclared: true,
      reason: 'business_assertions_failed',
      webhooksClear,
      assertIssues,
    };
  }

  if (i.httpOk && i.httpStatus >= 200 && i.httpStatus < 300) {
    return {
      class: CLASSES.BUSINESS_OK,
      verdict: 'PASS',
      safeDeclared: true,
      reason: 'business_conformant_idle',
      webhooksClear,
    };
  }

  return {
    class: CLASSES.INDETERMINATE,
    verdict: 'UNCERTAIN',
    safeDeclared: false,
    reason: 'http_not_ok_indeterminate',
    webhooksClear,
  };
}

function isLateWrite(before, immediate, settled) {
  const b = parseTs(before);
  const imm = parseTs(immediate);
  const set = parseTs(settled);
  if (b == null || set == null) return false;
  // Settled advanced vs before, and either immediate still equals before (write after abort)
  // or settled > immediate (write during settle window)
  if (set <= b) return false;
  if (imm != null && imm <= b && set > b) return true;
  if (imm != null && set > imm) return true;
  if (imm == null && set > b) return true;
  return false;
}

function parseTs(v) {
  if (v == null || v === '') return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
}

/** Correlation event — no PII (message content forbidden). */
function correlationEvent(type, fields) {
  const allowed = {
    type: String(type),
    ts: (fields && fields.ts) || new Date().toISOString(),
    runToken: fields && fields.runToken ? String(fields.runToken) : null,
    scenarioId: fields && fields.scenarioId ? String(fields.scenarioId) : null,
    sessionIdHash: fields && fields.sessionIdHash ? String(fields.sessionIdHash) : null,
    elapsedMs: fields && Number.isFinite(fields.elapsedMs) ? fields.elapsedMs : null,
    httpStatus: fields && fields.httpStatus != null ? fields.httpStatus : null,
    aborted: fields && fields.aborted === true,
    causeCode: fields && fields.causeCode ? String(fields.causeCode) : null,
    ollamaModelPresent: fields && fields.ollamaModelPresent === true,
    runningCount: fields && Number.isFinite(fields.runningCount) ? fields.runningCount : null,
    webhookRows: fields && Number.isFinite(fields.webhookRows) ? fields.webhookRows : null,
    updatedAtChanged: fields && fields.updatedAtChanged === true,
    note: fields && fields.note ? String(fields.note).slice(0, 120) : null,
  };
  return allowed;
}

function hashSessionId(sessionId, cryptoSha256Hex) {
  if (typeof cryptoSha256Hex !== 'function') {
    throw new Error('hashSessionId requires sha256 hex function');
  }
  return cryptoSha256Hex(String(sessionId || '')).slice(0, 16);
}

module.exports = {
  CLASSES,
  classifyPostflight,
  isLateWrite,
  correlationEvent,
  hashSessionId,
};
