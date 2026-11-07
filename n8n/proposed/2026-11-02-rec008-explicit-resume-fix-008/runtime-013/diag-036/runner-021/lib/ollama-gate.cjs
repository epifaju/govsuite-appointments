'use strict';

/**
 * Pure Ollama readiness gate (no network).
 * Warm-up /api/chat is NOT performed here — campaign auth required for real warm.
 */

const DEFAULT_MODEL = 'qwen2.5:1.5b';
const TIMEOUT_AFTER_WARM_MS = 180000;
const TIMEOUT_COLD_RISK_MS = 300000;
const MIN_EXPIRES_HEADROOM_MS = 120000;
const MIN_FREE_MEM_BYTES = 200 * 1024 * 1024; // soft check ~200 MiB free under limit

function parsePsModels(psBody) {
  if (psBody == null) return [];
  let data = psBody;
  if (typeof psBody === 'string') {
    try {
      data = JSON.parse(psBody);
    } catch {
      return [];
    }
  }
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.models)) return data.models;
  return [];
}

/**
 * @param {object} input
 * @param {string} [input.expectedModel]
 * @param {object|string|null} input.psBody — /api/ps JSON
 * @param {number} [input.nowMs]
 * @param {number} [input.minExpiresHeadroomMs]
 * @param {number|null} [input.memLimitBytes]
 * @param {number|null} [input.memUsageBytes]
 * @param {number} [input.minFreeMemBytes]
 * @param {boolean} [input.warmVerified] — true only after verified warm (/api/ps post-warm)
 */
function evaluateOllamaGate(input) {
  const expectedModel = input.expectedModel || DEFAULT_MODEL;
  const nowMs = Number.isFinite(input.nowMs) ? input.nowMs : Date.now();
  const headroom = Number.isFinite(input.minExpiresHeadroomMs)
    ? input.minExpiresHeadroomMs
    : MIN_EXPIRES_HEADROOM_MS;
  const models = parsePsModels(input.psBody);
  const entry = models.find((m) => String(m.name || m.model || '') === expectedModel) || null;

  const out = {
    ready: false,
    reason: null,
    expectedModel,
    modelPresent: Boolean(entry),
    expiresAt: entry && entry.expires_at ? String(entry.expires_at) : null,
    expiresInMs: null,
    memOk: true,
    memNote: null,
    warmVerified: input.warmVerified === true,
    chatTimeoutMs: null,
    http200NotEnough: true,
  };

  if (!entry) {
    out.reason = 'model_absent_from_api_ps';
    out.chatTimeoutMs = null;
    return out;
  }

  if (entry.expires_at) {
    const exp = Date.parse(entry.expires_at);
    if (Number.isNaN(exp)) {
      out.reason = 'expires_at_unparseable';
      return out;
    }
    out.expiresInMs = exp - nowMs;
    if (out.expiresInMs < headroom) {
      out.reason = 'expires_too_soon';
      return out;
    }
  } else {
    out.reason = 'expires_at_missing';
    return out;
  }

  if (
    Number.isFinite(input.memLimitBytes) &&
    Number.isFinite(input.memUsageBytes) &&
    input.memLimitBytes > 0
  ) {
    const free = input.memLimitBytes - input.memUsageBytes;
    const minFree = Number.isFinite(input.minFreeMemBytes)
      ? input.minFreeMemBytes
      : MIN_FREE_MEM_BYTES;
    if (free < minFree) {
      out.memOk = false;
      out.memNote = `free_mem_low:${free}`;
      out.reason = 'insufficient_free_memory';
      return out;
    }
    out.memNote = `free_mem_ok:${free}`;
  }

  // Presence in /api/ps with future expires_at IS the warm proof (020).
  // HTTP 200 on /api/chat alone is never enough — callers must feed /api/ps here.
  out.warmVerified = true;
  out.ready = true;
  out.reason = 'ok';
  out.chatTimeoutMs = TIMEOUT_AFTER_WARM_MS;
  if (input.warmVerified === false) {
    out.warmVerified = false;
    out.ready = false;
    out.reason = 'warm_explicitly_unverified';
    out.chatTimeoutMs = null;
  }
  return out;
}

function timeoutPolicy(gate) {
  if (gate && gate.ready && gate.warmVerified) {
    return { chatTimeoutMs: TIMEOUT_AFTER_WARM_MS, basis: 'warm_verified_via_api_ps' };
  }
  return {
    chatTimeoutMs: null,
    basis: 'blocked_model_not_ready',
    coldRiskMs: TIMEOUT_COLD_RISK_MS,
    note: 'Do not chat; 300s cold-risk is documentation only until /api/ps proves model loaded',
  };
}

module.exports = {
  DEFAULT_MODEL,
  TIMEOUT_AFTER_WARM_MS,
  TIMEOUT_COLD_RISK_MS,
  MIN_EXPIRES_HEADROOM_MS,
  MIN_FREE_MEM_BYTES,
  parsePsModels,
  evaluateOllamaGate,
  timeoutPolicy,
};
