#!/usr/bin/env node
'use strict';

/**
 * R04A-RUNTIME-036 — R04-A ONLY on installed W-031-01 (TEST only).
 * Protocol: seed applied separately → activate → Ollama gate → exactly 1 chat (NO retry) →
 * deactivate → settle → stability classify.
 * STOP on FAIL/UNCERTAIN. No LIVE. No CreateAppointment. No Docker mutate. No workflow PUT.
 * No R04-B/C. No cleanup auto. saveData*=none (no retention window).
 * Artefacts: Present/Len only (no cleartext email/message).
 *
 * Derived from run-runtime-013.js (R01–R03).
 */

const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
  DEFAULT_MODEL: OLLAMA_MODEL,
  TIMEOUT_AFTER_WARM_MS,
  TIMEOUT_COLD_RISK_MS,
  evaluateOllamaGate,
  timeoutPolicy,
} = require('./runner-021/lib/ollama-gate.cjs');
const {
  classifyPostflight,
  correlationEvent,
  hashSessionId,
} = require('./runner-021/lib/postflight-stability.cjs');

const ROOT = path.resolve(__dirname);
const ART_DIR_NAME = String(process.env.RUNTIME_ART || 'artifacts-r04a-036').replace(
  /[^a-zA-Z0-9._-]/g,
  '',
);
const ART = path.join(ROOT, ART_DIR_NAME || 'artifacts-r04a-036');
const ENV_FILE =
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-30-rec008-phase8e2b2-TEST-DEPLOY/.env.rec008-test.local';

const BASE = 'http://127.0.0.1:5682';
const WF_ID = 'OCD9It1uKFhOoWNF';
const EXPECT_VERSION_ID = 'f5a9181f-ff8d-4301-976e-57add79badae';
const EXPECT_VERSION_COUNTER = 11;
const EXPECT_GERER_SHA =
  '44a7064d12755a84dd256acae90abbf67a778178f9947eec3a36dc0c9abcad3f';
const GERER_NAME = 'Gérer collecte progressive';
const CHAT_WEBHOOK_PATH = 'a91c4e70-6b18-4f0d-9c55-2e7d8a14b603/chat';
const CHAT_URL = `${BASE}/webhook/${CHAT_WEBHOOK_PATH}`;
const N8N_CTR = 'govsuite-rec008-test-rec008-n8n-1';
const PG_CTR = 'govsuite-rec008-test-rec008-postgres-1';
const OLLAMA_HTTP = 'http://rec008-ollama:11434';
const DOCKER_PROJ = 'govsuite-rec008-test';
/** @deprecated use TIMEOUT_AFTER_WARM_MS after /api/ps gate — never chat at 45s cold. */
const CHAT_TIMEOUT_MS_LEGACY = 45000;
const CHAT_TIMEOUT_MS = TIMEOUT_AFTER_WARM_MS;
const SETTLE_MS = Math.min(
  60000,
  Math.max(30000, Number(process.env.RUNTIME_SETTLE_MS || 45000) || 45000),
);
void CHAT_TIMEOUT_MS_LEGACY;
void TIMEOUT_COLD_RISK_MS;

/** Synthetic email — never written into artefacts (messageClass only). */
const R04A_EMAIL_SYNTHETIC = 'camille.r04a.035@example.test';
const ALL_SCENARIOS = [
  {
    id: 'R04-A',
    sessionId: 'rec008-r04a-035-active-ask-email',
    message: R04A_EMAIL_SYNTHETIC,
    messageClass: 'email_like_valid_synthetic',
  },
];
const SCENARIOS = ALL_SCENARIOS;

function ensureArt() {
  fs.mkdirSync(ART, { recursive: true });
}

function writeJson(name, value) {
  ensureArt();
  const p = path.join(ART, name);
  fs.writeFileSync(p, JSON.stringify(value, null, 2) + '\n', 'utf8');
  return p;
}

function sha(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function envValue(name) {
  const text = fs.readFileSync(ENV_FILE, 'utf8');
  const m = text.match(new RegExp('^' + name + '=(.*)$', 'm'));
  if (!m) throw new Error(`missing env ${name}`);
  return m[1];
}

function docker(args) {
  return execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
}

function edgesOf(connections) {
  let edges = 0;
  for (const outputs of Object.values(connections || {})) {
    for (const groups of Object.values(outputs || {})) {
      for (const group of groups || []) edges += Array.isArray(group) ? group.length : 0;
    }
  }
  return edges;
}

function pg(sql) {
  return docker([
    'exec',
    '-i',
    PG_CTR,
    'psql',
    '-U',
    'postgres',
    '-d',
    'govsuite_rec008_test',
    '-t',
    '-A',
    '-F',
    '|',
    '-c',
    sql,
  ]).trim();
}

function fingerprint() {
  return pg(
    "SELECT format('%s|%s|%s|%s', (SELECT count(*) FROM rendez_vous), (SELECT count(*) FROM ai_conversation_state), (SELECT count(*) FROM ai_appointment_attempt), (SELECT count(*) FROM notifications));",
  );
}

function openAttempts() {
  return Number(
    pg(
      "SELECT count(*) FROM ai_appointment_attempt WHERE status IN ('AWAITING_CONFIRMATION','SUBMITTING','UNCERTAIN');",
    ) || '0',
  );
}

function claimsCount() {
  return Number(
    pg(
      "SELECT count(*) FROM ai_appointment_attempt WHERE status IN ('CLAIMED','SUBMITTING') OR idempotency_key ILIKE '%CLAIM%';",
    ) || '0',
  );
}

function isTrueFlag(v) {
  return v === 't' || v === 'true' || v === '1';
}

function sessionSnap(sessionId) {
  // Present/Len only — no cleartext nom/prenom/email/telephone/last_user_message
  const sid = sessionId.replace(/'/g, "''");
  const line = pg(
    `SELECT session_id, coalesce(intent,''), coalesce(pending_action,''), coalesce(conversation_step,''), expires_at::text, updated_at::text, CASE WHEN expires_at IS NOT NULL AND expires_at > NOW() THEN 't' ELSE 'f' END, CASE WHEN expires_at IS NOT NULL AND expires_at <= NOW() THEN 't' ELSE 'f' END, CASE WHEN nom IS NOT NULL AND length(btrim(nom)) > 0 THEN 't' ELSE 'f' END, length(coalesce(nom,'')), CASE WHEN prenom IS NOT NULL AND length(btrim(prenom)) > 0 THEN 't' ELSE 'f' END, length(coalesce(prenom,'')), CASE WHEN email IS NOT NULL AND length(btrim(email)) > 0 THEN 't' ELSE 'f' END, length(coalesce(email,'')), CASE WHEN telephone IS NOT NULL AND length(btrim(telephone)) > 0 THEN 't' ELSE 'f' END, length(coalesce(telephone,'')), CASE WHEN service IS NOT NULL THEN 't' ELSE 'f' END, CASE WHEN site IS NOT NULL THEN 't' ELSE 'f' END, CASE WHEN available_slots IS NOT NULL THEN 't' ELSE 'f' END, CASE WHEN slot_id IS NOT NULL THEN 't' ELSE 'f' END, length(coalesce(last_user_message,'')) FROM ai_conversation_state WHERE session_id='${sid}';`,
  );
  if (!line) return null;
  const p = line.split('|');
  return {
    sessionIdHash: hashSessionId(p[0], (s) => sha(s)),
    intent: p[1],
    pendingAction: p[2],
    conversationStep: p[3],
    expiresAt: p[4],
    updatedAt: p[5],
    ttlActive: isTrueFlag(p[6]),
    sessionExpired: isTrueFlag(p[7]),
    sessionExpiredNow: isTrueFlag(p[7]),
    nomPresent: isTrueFlag(p[8]),
    nomLen: Number(p[9]),
    prenomPresent: isTrueFlag(p[10]),
    prenomLen: Number(p[11]),
    prenomIsNull: !isTrueFlag(p[10]),
    emailPresent: isTrueFlag(p[12]),
    emailLen: Number(p[13]),
    emailValide: isTrueFlag(p[12]) && Number(p[13]) >= 5,
    telephonePresent: isTrueFlag(p[14]),
    telephoneLen: Number(p[15]),
    hasService: isTrueFlag(p[16]),
    hasSite: isTrueFlag(p[17]),
    hasAvailableSlots: isTrueFlag(p[18]),
    slotIdPresent: isTrueFlag(p[19]),
    lastUserMessageLen: Number(p[20] || 0),
  };
}

function redactHttpArtifact(http) {
  if (!http) return http;
  const strip = (s) =>
    String(s || '')
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
      .replace(/\+?\d[\d\s.-]{7,}\d/g, '[REDACTED_PHONE]');
  return {
    ok: http.ok,
    status: http.status,
    elapsedMs: http.elapsedMs,
    type: extractType(http.json),
    textPreview: strip(http.textPreview).slice(0, 400),
    aborted: http.aborted,
    error: http.error || null,
    transportError: http.transportError || null,
    causeCode: http.causeCode || null,
    timeoutMs: http.timeoutMs,
    retried: false,
    messageClass: 'email_like_valid_synthetic',
  };
}

function mockMeta() {
  const probe =
    "const http=require('http');http.get('http://rec008-mock:8080/_meta/calls',res=>{let b='';res.on('data',c=>b+=c);res.on('end',()=>console.log(b));});";
  const tmp = path.join(ART, '_mock-probe.js');
  fs.writeFileSync(tmp, probe);
  docker(['cp', tmp, `${N8N_CTR}:/tmp/_m013.js`]);
  const t = docker(['exec', N8N_CTR, 'node', '/tmp/_m013.js']).trim();
  docker(['exec', '-u', 'root', N8N_CTR, 'rm', '-f', '/tmp/_m013.js']);
  try {
    fs.unlinkSync(tmp);
  } catch (_) {}
  return JSON.parse(t);
}

function postCreateCount(meta) {
  return Object.entries(meta.byPath || {})
    .filter(([k]) => /^POST \/appointments /.test(k) && !/cancel|reschedule/i.test(k))
    .reduce((n, [, v]) => n + Number(v || 0), 0);
}

function claimPathCount(meta) {
  return Object.entries(meta.byPath || {})
    .filter(([k]) => /CLAIM|claim/i.test(k))
    .reduce((n, [, v]) => n + Number(v || 0), 0);
}

function readWebhooks() {
  const webhookFile = path.join(ROOT, 'webhooks-probe.js');
  docker(['cp', webhookFile, `${N8N_CTR}:/tmp/rec008-r013-webhooks.js`]);
  const text = docker(['exec', N8N_CTR, 'node', '/tmp/rec008-r013-webhooks.js']);
  docker(['exec', '-u', 'root', N8N_CTR, 'rm', '-f', '/tmp/rec008-r013-webhooks.js']);
  return JSON.parse(text);
}

function gererSha(nodes) {
  const gerer = (nodes || []).find((n) => n && n.name === GERER_NAME);
  const code = (gerer && gerer.parameters && gerer.parameters.jsCode) || '';
  return { found: Boolean(gerer), sha256: sha(code), codeLen: code.length };
}

function flattenText(obj) {
  if (obj == null) return '';
  if (typeof obj === 'string') return obj;
  try {
    return JSON.stringify(obj);
  } catch {
    return String(obj);
  }
}

function extractType(json) {
  if (!json) return null;
  if (typeof json === 'object' && !Array.isArray(json)) {
    return json.type || json.data?.type || json.output?.type || null;
  }
  if (Array.isArray(json) && json[0]) {
    return json[0].type || json[0].json?.type || null;
  }
  return null;
}

function errInfo(e) {
  const c = e && e.cause;
  return {
    name: e && e.name,
    message: e && String(e.message || e),
    cause: c
      ? {
          name: c.name || null,
          message: c.message ? String(c.message) : null,
          code: c.code || null,
          errno: c.errno ?? null,
          syscall: c.syscall || null,
          address: c.address || null,
          port: c.port ?? null,
        }
      : null,
  };
}

/** Merge headers; force Connection: close to avoid stale keep-alive via TCP publish proxy. */
function restHeaders(extra) {
  return {
    Connection: 'close',
    ...(extra || {}),
  };
}

/**
 * Single fetch — NO retry (mission rule).
 * DIAG-014: capture cause.code; default Connection: close for REST stability.
 */
async function fetchOnce(url, opts, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  const merged = { ...(opts || {}) };
  merged.headers = restHeaders(merged.headers);
  merged.signal = controller.signal;
  try {
    const res = await fetch(url, merged);
    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      elapsedMs: Date.now() - started,
      text,
      headers: res.headers,
      aborted: false,
      retried: false,
      transportError: null,
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      elapsedMs: Date.now() - started,
      text: '',
      headers: null,
      aborted: String(e.name || '') === 'AbortError',
      error: String(e.message || e),
      transportError: errInfo(e),
      retried: false,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function login() {
  // Exactly one login POST — no double-login (DIAG-014).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const loginRes = await fetch(BASE + '/rest/login', {
      method: 'POST',
      headers: restHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({
        emailOrLdapLoginId: envValue('REC008_N8N_OWNER_EMAIL'),
        password: envValue('REC008_N8N_OWNER_PASSWORD'),
      }),
      signal: controller.signal,
    });
    const cookie = (loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [])
      .map((i) => i.split(';')[0])
      .join('; ');
    if (loginRes.status !== 200 || !cookie) {
      throw new Error(`login failed HTTP ${loginRes.status}`);
    }
    return {
      cookie,
      accept: 'application/json',
      'content-type': 'application/json',
      Connection: 'close',
    };
  } finally {
    clearTimeout(timer);
  }
}

async function getWorkflow(session) {
  const res = await fetchOnce(
    BASE + '/rest/workflows/' + WF_ID,
    { method: 'GET', headers: session },
    30000,
  );
  if (!res.ok && res.status === 0) {
    return {
      status: 0,
      data: null,
      transportError: res.transportError || { message: res.error },
      aborted: res.aborted,
      retried: false,
    };
  }
  let json = null;
  try {
    json = res.text ? JSON.parse(res.text) : null;
  } catch {
    json = null;
  }
  return {
    status: res.status,
    data: (json && json.data) || json,
    transportError: null,
    aborted: false,
    retried: false,
  };
}

async function getActiveIds(session) {
  const res = await fetchOnce(
    BASE + '/rest/active-workflows',
    { method: 'GET', headers: session },
    30000,
  );
  if (!res.ok && res.status === 0) {
    return { ids: [], transportError: res.transportError || { message: res.error } };
  }
  let json = null;
  try {
    json = res.text ? JSON.parse(res.text) : null;
  } catch {
    json = null;
  }
  return {
    ids: (json && (json.data || json) ? json.data || json : [])
      .map((x) => x.id || x)
      .filter(Boolean),
    transportError: null,
  };
}

async function activate(session) {
  const res = await fetchOnce(
    BASE + '/rest/workflows/' + WF_ID + '/activate',
    {
      method: 'POST',
      headers: session,
      body: JSON.stringify({ versionId: EXPECT_VERSION_ID }),
    },
    60000,
  );
  let data = null;
  try {
    data = res.text ? JSON.parse(res.text) : null;
  } catch {
    data = null;
  }
  const published = (data && data.data) || data;
  return {
    status: res.status,
    ok: res.status === 200,
    aborted: res.aborted,
    error: res.error || null,
    active: published && published.active === true,
    activeVersionId: published && published.activeVersionId,
    versionId: published && published.versionId,
    versionCounter: published && Number(published.versionCounter),
  };
}

async function deactivate(session, tag) {
  const res = await fetchOnce(
    BASE + '/rest/workflows/' + WF_ID + '/deactivate',
    { method: 'POST', headers: session, body: '{}' },
    60000,
  );
  const after = await getWorkflow(session);
  const active = await getActiveIds(session);
  let webhooks = { rows: [] };
  try {
    webhooks = readWebhooks();
  } catch (_) {}
  const out = {
    tag,
    status: res.status,
    aborted: res.aborted,
    transportError: res.transportError || after.transportError || active.transportError || null,
    active: after.data && after.data.active === true,
    activeVersionId: (after.data && after.data.activeVersionId) || null,
    versionId: after.data && after.data.versionId,
    versionCounter: after.data && Number(after.data.versionCounter),
    activeIds: active.ids || [],
    webhookRows: (webhooks.rows || []).length,
    verified: !after.transportError && !active.transportError,
  };
  writeJson(`deactivate-${tag}.json`, out);
  if (!out.verified) {
    const err = new Error(`DEACTIVATE_VERIFY_TRANSPORT_${tag}`);
    err.detail = out;
    throw err;
  }
  if (out.active || out.activeVersionId || out.activeIds.length > 0 || out.webhookRows > 0) {
    const err = new Error(`DEACTIVATE_FAILURE_${tag}`);
    err.detail = out;
    throw err;
  }
  return out;
}

async function sendMessageOnce(sessionId, message, timeoutMs) {
  const limit = Number(timeoutMs);
  if (!Number.isFinite(limit) || limit < TIMEOUT_AFTER_WARM_MS) {
    throw new Error(
      `chat timeout refused: require >= ${TIMEOUT_AFTER_WARM_MS} ms after warm gate (got ${timeoutMs})`,
    );
  }
  const res = await fetchOnce(
    CHAT_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sessionId, action: 'sendMessage', chatInput: message }),
    },
    limit,
  );
  let json = null;
  try {
    json = res.text ? JSON.parse(res.text) : null;
  } catch {
    json = null;
  }
  return {
    ok: res.ok,
    status: res.status,
    elapsedMs: res.elapsedMs,
    json,
    textPreview: (res.text || '').slice(0, 2000),
    aborted: res.aborted,
    error: res.error || null,
    transportError: res.transportError || null,
    causeCode: (res.transportError && res.transportError.cause && res.transportError.cause.code) || null,
    timeoutMs: limit,
    retried: false,
  };
}

function fetchOllamaPsRaw() {
  // Read-only /api/ps via n8n container DNS — NOT an inference call.
  return docker([
    'exec',
    N8N_CTR,
    'wget',
    '-qO-',
    '--timeout=15',
    OLLAMA_HTTP + '/api/ps',
  ]).trim();
}

function sampleOllamaMem() {
  try {
    const raw = docker([
      'stats',
      'govsuite-rec008-test-rec008-ollama-1',
      '--no-stream',
      '--format',
      '{{.MemUsage}}',
    ]).trim();
    // e.g. "1.096GiB / 1.5GiB"
    const m = raw.match(/([\d.]+)\s*([GMK]i?B)\s*\/\s*([\d.]+)\s*([GMK]i?B)/i);
    if (!m) return { memUsageBytes: null, memLimitBytes: null, raw };
    const toBytes = (n, u) => {
      const v = Number(n);
      const uu = u.toUpperCase();
      if (uu.startsWith('G')) return v * 1024 * 1024 * 1024;
      if (uu.startsWith('M')) return v * 1024 * 1024;
      if (uu.startsWith('K')) return v * 1024;
      return v;
    };
    return {
      memUsageBytes: toBytes(m[1], m[2]),
      memLimitBytes: toBytes(m[3], m[4]),
      raw,
    };
  } catch (e) {
    return { memUsageBytes: null, memLimitBytes: null, error: String(e.message || e) };
  }
}

function checkOllamaGateLive() {
  const mem = sampleOllamaMem();
  let psBody = null;
  let psError = null;
  try {
    psBody = JSON.parse(fetchOllamaPsRaw());
  } catch (e) {
    psError = String(e.message || e);
  }
  const gate = evaluateOllamaGate({
    expectedModel: OLLAMA_MODEL,
    psBody,
    nowMs: Date.now(),
    memLimitBytes: mem.memLimitBytes,
    memUsageBytes: mem.memUsageBytes,
  });
  return {
    ...gate,
    psError,
    memSample: mem,
    timeoutPolicy: timeoutPolicy(gate),
    inferencePerformed: false,
  };
}

async function getRunningExecutions(session) {
  const res = await fetchOnce(
    BASE + '/rest/executions?status=running&limit=20',
    { method: 'GET', headers: session },
    15000,
  );
  if (!res.ok && res.status === 0) {
    return {
      available: false,
      count: null,
      transportError: res.transportError || { message: res.error },
      causeCode: (res.transportError && res.transportError.cause && res.transportError.cause.code) || null,
    };
  }
  let json = null;
  try {
    json = res.text ? JSON.parse(res.text) : null;
  } catch {
    json = null;
  }
  const rows = (json && (json.data || json.results || json)) || [];
  const list = Array.isArray(rows) ? rows : rows.results || rows.data || [];
  const arr = Array.isArray(list) ? list : [];
  return {
    available: res.status === 200,
    count: res.status === 200 ? arr.length : null,
    status: res.status,
    transportError: null,
  };
}

function assertR04A(before, after, http) {
  const issues = [];
  if (!http || !http.ok || http.status < 200 || http.status >= 300) {
    issues.push('HTTP not OK: ' + (http && http.status));
  }
  if (!after) {
    issues.push('session missing after');
    return issues;
  }
  if (!before) {
    issues.push('session missing before');
    return issues;
  }
  if (before.conversationStep !== 'ASK_EMAIL') {
    issues.push('before step expected ASK_EMAIL got ' + before.conversationStep);
  }
  if (before.emailPresent === true) issues.push('before emailPresent expected false');
  if (before.ttlActive !== true) issues.push('before ttlActive expected true');
  if (after.conversationStep !== 'ASK_TELEPHONE') {
    issues.push('step expected ASK_TELEPHONE got ' + after.conversationStep);
  }
  if (after.emailPresent !== true) issues.push('emailPresent expected true');
  if (!(after.emailLen >= 5)) issues.push('emailLen expected >=5 got ' + after.emailLen);
  if (after.emailValide !== true) issues.push('emailValide expected true');
  if (after.nomPresent !== true || after.nomLen !== before.nomLen) {
    issues.push('nom not preserved (Present/Len)');
  }
  if (after.prenomPresent !== true || after.prenomLen !== before.prenomLen) {
    issues.push('prenom not preserved (Present/Len)');
  }
  if (after.slotIdPresent !== true) issues.push('slotIdPresent expected true after');
  if (before.slotIdPresent !== true) issues.push('slotIdPresent expected true before');
  if (after.ttlActive !== true) issues.push('ttlActive expected true after');
  if (after.telephonePresent === true) issues.push('telephonePresent expected false');
  const blob = flattenText(http.json || http.textPreview).toLowerCase();
  if (blob.includes('session_expired')) issues.push('unexpected session_expired');
  return issues;
}

async function preflight(session) {
  const out = {
    ts: new Date().toISOString(),
    ok: false,
    issues: [],
    isolation: { n8nTestPort: 5682, livePortForbidden: 5680, liveTouched: false },
  };

  const ps = docker([
    'ps',
    '-a',
    '--filter',
    `label=com.docker.compose.project=${DOCKER_PROJ}`,
    '--format',
    '{{.Names}}\t{{.Status}}',
  ]);
  out.dockerProject = (ps || '').trim().split(/\r?\n/).filter(Boolean);
  if (!out.dockerProject.some((l) => l.includes(N8N_CTR) && l.includes('Up'))) {
    out.issues.push('n8n TEST not Up');
  }
  if (!out.dockerProject.some((l) => l.includes(PG_CTR) && l.includes('Up'))) {
    out.issues.push('postgres TEST not Up');
  }

  const health = await fetchOnce(BASE + '/healthz', { method: 'GET' }, 10000);
  out.n8nHealth = { status: health.status, body: (health.text || '').slice(0, 80) };
  if (health.status !== 200) out.issues.push('n8n healthz failed');

  const wf = await getWorkflow(session);
  if (wf.transportError) {
    out.issues.push(`getWorkflow transport: ${wf.transportError.message || 'failed'}`);
  }
  const nodes = (wf.data && wf.data.nodes) || [];
  const gerer = gererSha(nodes);
  const active = await getActiveIds(session);
  if (active.transportError) {
    out.issues.push(`active-workflows transport: ${active.transportError.message || 'failed'}`);
  }
  const activeIds = active.ids || [];
  let webhooks = { rows: [] };
  try {
    webhooks = readWebhooks();
  } catch (e) {
    out.issues.push(`webhook probe: ${e.message}`);
  }

  out.workflow = {
    http: wf.status,
    id: wf.data && wf.data.id,
    active: wf.data && wf.data.active === true,
    activeVersionId: (wf.data && wf.data.activeVersionId) || null,
    versionId: wf.data && wf.data.versionId,
    versionCounter: wf.data && Number(wf.data.versionCounter),
    nodeCount: nodes.length,
    edgeCount: edgesOf(wf.data && wf.data.connections),
    activeIds,
    webhookRows: (webhooks.rows || []).length,
    transportError: wf.transportError || null,
  };
  out.gerer = gerer;
  out.fingerprint = fingerprint();
  out.openAttempts = openAttempts();
  out.mock = mockMeta();
  out.mockPosts = postCreateCount(out.mock);
  out.mockClaims = claimPathCount(out.mock);

  if (out.workflow.active || out.workflow.activeVersionId || activeIds.length) {
    out.issues.push('workflow must be inactive at preflight');
  }
  if (out.workflow.webhookRows !== 0) out.issues.push('active webhooks present at preflight');
  if (out.workflow.versionId !== EXPECT_VERSION_ID) {
    out.issues.push(`versionId expected ${EXPECT_VERSION_ID} got ${out.workflow.versionId}`);
  }
  if (out.workflow.versionCounter !== EXPECT_VERSION_COUNTER) {
    out.issues.push(`versionCounter expected ${EXPECT_VERSION_COUNTER}`);
  }
  if (out.workflow.nodeCount !== 134) out.issues.push(`nodes=${out.workflow.nodeCount} expected 134`);
  if (out.workflow.edgeCount !== 137) out.issues.push(`edges=${out.workflow.edgeCount} expected 137`);
  if (gerer.sha256 !== EXPECT_GERER_SHA) out.issues.push(`Gérer SHA mismatch ${gerer.sha256}`);
  out.fingerprintNote = 'documented only (seed may change sessions count)';
  if (out.openAttempts !== 0) out.issues.push(`open attempts=${out.openAttempts}`);

  out.sessions = {};
  for (const sc of SCENARIOS) {
    const snap = sessionSnap(sc.sessionId);
    out.sessions[sc.id] = snap;
    if (!snap) {
      out.issues.push(`missing fixture ${sc.sessionId}`);
      continue;
    }
    if (snap.conversationStep !== 'ASK_EMAIL') out.issues.push(sc.id + ' step != ASK_EMAIL');
    if (!snap.nomPresent) out.issues.push(sc.id + ' nom missing');
    if (!snap.prenomPresent) out.issues.push(sc.id + ' prenom missing');
    if (snap.emailPresent) out.issues.push(sc.id + ' email should be absent');
    if (snap.telephonePresent) out.issues.push(sc.id + ' telephone should be absent');
    if (!snap.ttlActive || snap.sessionExpiredNow) out.issues.push(sc.id + ' must be active TTL');
    if (snap.slotIdPresent !== true) out.issues.push(sc.id + ' slot_id missing');
  }

  out.ok = out.issues.length === 0;
  writeJson('preflight.json', out);
  return out;
}

async function runScenario(sc, session) {
  const runToken = crypto.randomBytes(6).toString('hex');
  const sessionIdHash = hashSessionId(sc.sessionId, (s) => sha(s));
  const corr = [];
  const pushCorr = (type, fields) => {
    corr.push(
      correlationEvent(type, { runToken, scenarioId: sc.id, sessionIdHash, ...(fields || {}) }),
    );
  };

  const result = {
    id: sc.id,
    sessionId: sc.sessionId,
    sessionIdHash,
    runToken,
    messageClass: sc.messageClass || 'email_like_valid_synthetic',
    verdict: 'UNCERTAIN',
    issues: [],
    retried: false,
    correlation: corr,
    settleMs: SETTLE_MS,
  };

  result.before = sessionSnap(sc.sessionId);
  result.fingerprintBefore = fingerprint();
  result.mockBefore = mockMeta();
  result.mockPostsBefore = postCreateCount(result.mockBefore);
  result.mockClaimsBefore = claimPathCount(result.mockBefore);
  result.openBefore = openAttempts();
  writeJson(`${sc.id}-before.json`, {
    session: result.before,
    fingerprint: result.fingerprintBefore,
    mockPosts: result.mockPostsBefore,
    mockClaims: result.mockClaimsBefore,
    open: result.openBefore,
  });
  pushCorr('scenario_start', { note: 'before_snap' });

  if (!result.before) {
    result.issues.push('session fixture missing');
    result.verdict = 'FAIL';
    writeJson(`${sc.id}-result.json`, result);
    return result;
  }

  const preWf = await getWorkflow(session);
  if (preWf.transportError || preWf.status === 0) {
    result.issues.push(
      `pre-activate transport UNCERTAIN: ${JSON.stringify(preWf.transportError || { message: 'status 0' })}`,
    );
    result.verdict = 'UNCERTAIN';
    result.activationPerformed = false;
    result.messageSent = false;
    result.retried = false;
    writeJson(`${sc.id}-result.json`, result);
    return result;
  }
  if (preWf.data && preWf.data.active === true) {
    result.issues.push('workflow already active before scenario');
    result.verdict = 'FAIL';
    writeJson(`${sc.id}-result.json`, result);
    return result;
  }

  console.error(`[${sc.id}] activate`);
  result.activate = await activate(session);
  writeJson(`${sc.id}-activate.json`, result.activate);
  pushCorr('activate', {
    httpStatus: result.activate.status,
    note: result.activate.ok ? 'ok' : 'fail',
  });
  if (
    !result.activate.ok ||
    !result.activate.active ||
    result.activate.activeVersionId !== EXPECT_VERSION_ID
  ) {
    result.issues.push(`activate failed: ${JSON.stringify(result.activate)}`);
    result.verdict = 'FAIL';
    try {
      await deactivate(session, `${sc.id}-activate-fail`);
    } catch (_) {}
    writeJson(`${sc.id}-result.json`, result);
    return result;
  }

  // settle webhook registration
  await new Promise((r) => setTimeout(r, 3000));
  const wh = readWebhooks();
  result.webhooksAfterActivate = (wh.rows || []).map((row) => ({
    workflowId: row.workflowId,
    path: row.webhookPath || row.path || null,
    method: row.method || null,
  }));
  const chatWh = (wh.rows || []).find(
    (r) =>
      String(r.workflowId) === WF_ID &&
      String(r.method || '').toUpperCase() === 'POST' &&
      String(r.webhookPath || r.path || '') === CHAT_WEBHOOK_PATH,
  );
  if (!chatWh) {
    result.issues.push('chat webhook not registered after activate');
    result.verdict = 'FAIL';
    try {
      await deactivate(session, `${sc.id}-no-webhook`);
    } catch (e) {
      result.deactivateEscalation = true;
      result.issues.push(String(e.message));
      writeJson(`${sc.id}-result.json`, result);
      throw e;
    }
    writeJson(`${sc.id}-result.json`, result);
    return result;
  }

  // Ollama gate — /api/ps only (no inference). STOP before chat if not ready.
  console.error(`[${sc.id}] ollama gate (/api/ps, no inference)`);
  result.ollamaGate = checkOllamaGateLive();
  writeJson(`${sc.id}-ollama-gate.json`, result.ollamaGate);
  pushCorr('ollama_gate', {
    ollamaModelPresent: result.ollamaGate.modelPresent === true,
    note: result.ollamaGate.reason,
  });
  if (!result.ollamaGate.ready || !result.ollamaGate.chatTimeoutMs) {
    result.issues.push(`ollama gate blocked chat: ${result.ollamaGate.reason}`);
    result.verdict = 'UNCERTAIN';
    result.messageSent = false;
    try {
      result.deactivate = await deactivate(session, `${sc.id}-ollama-gate`);
    } catch (e) {
      result.deactivateEscalation = true;
      result.issues.push(String(e.message));
    }
    writeJson(`${sc.id}-result.json`, result);
    return result;
  }
  result.chatTimeoutMs = result.ollamaGate.chatTimeoutMs;

  const runningBefore = await getRunningExecutions(session);
  result.runningBeforeChat = runningBefore;
  pushCorr('executions_poll', {
    runningCount: runningBefore.count,
    note: runningBefore.available ? 'before_chat' : 'api_down_before_chat',
  });

  console.error(
    `[${sc.id}] sendMessage once (no retry) timeoutMs=${result.chatTimeoutMs} class=${result.messageClass}`,
  );
  result.http = await sendMessageOnce(sc.sessionId, sc.message, result.chatTimeoutMs);
  result.messageSent = true;
  writeJson(sc.id + '-http.json', redactHttpArtifact(result.http));
  pushCorr('chat_http', {
    elapsedMs: result.http.elapsedMs,
    httpStatus: result.http.status,
    aborted: result.http.aborted === true,
    causeCode: result.http.causeCode,
  });

  result.afterImmediate = sessionSnap(sc.sessionId);
  const runningBeforeDeactivate = await getRunningExecutions(session);
  result.runningBeforeDeactivate = runningBeforeDeactivate;

  console.error(`[${sc.id}] deactivate`);
  let deactivateError = false;
  try {
    result.deactivate = await deactivate(session, `${sc.id}-post`);
    pushCorr('deactivate', {
      webhookRows: result.deactivate.webhookRows,
      httpStatus: result.deactivate.status,
      note: 'ok',
    });
  } catch (e) {
    deactivateError = true;
    result.issues.push(`deactivate: ${e.message}`);
    result.deactivateEscalation = true;
    result.deactivateErrorDetail = errInfo(e);
    pushCorr('deactivate', {
      note: 'error',
      causeCode: e.detail && e.detail.transportError && e.detail.transportError.cause
        ? e.detail.transportError.cause.code
        : null,
    });
  }

  // Deferred observation — client abort ≠ server idle
  console.error(`[${sc.id}] settle ${SETTLE_MS}ms (late-write window)`);
  await new Promise((r) => setTimeout(r, SETTLE_MS));
  result.after = sessionSnap(sc.sessionId);
  result.fingerprintAfter = fingerprint();
  result.mockAfter = mockMeta();
  result.mockPostsAfter = postCreateCount(result.mockAfter);
  result.mockClaimsAfter = claimPathCount(result.mockAfter);
  result.openAfter = openAttempts();
  const runningAfterSettle = await getRunningExecutions(session);
  result.runningAfterSettle = runningAfterSettle;
  pushCorr('settle', {
    runningCount: runningAfterSettle.count,
    updatedAtChanged:
      Boolean(result.before && result.after) &&
      String(result.before.updatedAt) !== String(result.after.updatedAt),
    note: 'post_settle_snap',
  });
  writeJson(`${sc.id}-after.json`, {
    sessionImmediate: result.afterImmediate,
    session: result.after,
    fingerprint: result.fingerprintAfter,
    mockPosts: result.mockPostsAfter,
    mockClaims: result.mockClaimsAfter,
    open: result.openAfter,
    runningAfterSettle,
  });

  let assertIssues = [];
  if (!(result.http.aborted || result.http.status === 0)) {
    if (sc.id === 'R04-A') assertIssues = assertR04A(result.before, result.after, result.http);
  }

  // Integrity: rendez_vous + attempts + notifications unchanged; sessions count may stay 14
  const partsB = String(result.fingerprintBefore).split('|');
  const partsA = String(result.fingerprintAfter).split('|');
  if (partsB[0] !== partsA[0]) assertIssues.push('rendez_vous count changed');
  if (partsB[2] !== partsA[2]) assertIssues.push('ai_appointment_attempt count changed');
  if (partsB[3] !== partsA[3]) assertIssues.push('notifications count changed');
  if (partsB[1] !== partsA[1]) {
      // warn only — seed already applied; chat must not create new sessions
      assertIssues.push('sessions count changed ' + partsB[1] + '→' + partsA[1]);
    }

  if (result.mockPostsAfter > result.mockPostsBefore) {
    assertIssues.push('CreateAppointment POST counter increased');
  }
  if (result.mockClaimsAfter > result.mockClaimsBefore) {
    assertIssues.push('CLAIM counter increased');
  }
  if (result.openAfter > result.openBefore) {
    assertIssues.push('open attempts increased');
  }

  if (result.deactivate && result.deactivate.versionCounter !== EXPECT_VERSION_COUNTER) {
    assertIssues.push(`versionCounter drifted to ${result.deactivate.versionCounter}`);
  }
  if (result.deactivate && result.deactivate.versionId !== EXPECT_VERSION_ID) {
    assertIssues.push(`versionId drifted to ${result.deactivate.versionId}`);
  }

  result.stability = classifyPostflight({
    httpAborted: result.http.aborted === true,
    httpOk: result.http.ok === true,
    httpStatus: result.http.status,
    updatedAtBefore: result.before && result.before.updatedAt,
    updatedAtImmediate: result.afterImmediate && result.afterImmediate.updatedAt,
    updatedAtSettled: result.after && result.after.updatedAt,
    runningCountBeforeDeactivate: runningBeforeDeactivate.count,
    runningCountAfterSettle: runningAfterSettle.count,
    executionsApiAvailable: runningAfterSettle.available === true,
    deactivateOk: Boolean(result.deactivate) && result.deactivate.active === false,
    deactivateError,
    webhookRows: result.deactivate ? result.deactivate.webhookRows : null,
    assertIssues,
    postflightVerifyFailed: false,
  });

  result.issues.push(...assertIssues);
  if (result.http.aborted || result.http.status === 0) {
    result.issues.push(
      'HTTP transport UNCERTAIN (timeout/abort) — no retry performed; client timeout ≠ server idle',
    );
  }
  if (result.stability && result.stability.reason) {
    result.issues.push(`stability:${result.stability.class}:${result.stability.reason}`);
  }

  // Stability classifier owns verdict when UNCERTAIN/FAIL from transport; else assert list
  if (result.stability.verdict === 'UNCERTAIN') {
    result.verdict = 'UNCERTAIN';
  } else if (result.stability.verdict === 'FAIL' || assertIssues.length > 0) {
    result.verdict = 'FAIL';
  } else if (result.stability.verdict === 'PASS' && assertIssues.length === 0) {
    result.verdict = 'PASS';
  } else {
    result.verdict = 'UNCERTAIN';
  }

  result.safeDeclared = false; // only safetyPostflight may declare safe after full checks
  writeJson(`${sc.id}-result.json`, result);
  console.error(
    `[${sc.id}] verdict=${result.verdict} class=${result.stability.class} issues=${result.issues.length}`,
  );
  return result;
}

async function cleanupIfSafe() {
  return { cleaned: false, reason: 'R04A-036 forbids auto cleanup' };
}

async function safetyPostflight(session, tag, activatedFlag) {
  const out = {
    tag,
    ts: new Date().toISOString(),
    activatedFlag: Boolean(activatedFlag),
    verified: false,
    safeDeclared: false,
    note: 'Webhooks cleared alone never proves server idle',
  };
  try {
    if (activatedFlag && session) {
      try {
        out.deactivate = await deactivate(session, `safety-${tag}`);
      } catch (e) {
        out.deactivateError = String(e.message || e);
        out.deactivateDetail = e.detail || null;
      }
    }
    if (session) {
      const wf = await getWorkflow(session);
      const active = await getActiveIds(session);
      const running = await getRunningExecutions(session);
      out.workflow = {
        status: wf.status,
        active: wf.data && wf.data.active === true,
        activeVersionId: (wf.data && wf.data.activeVersionId) || null,
        versionId: wf.data && wf.data.versionId,
        versionCounter: wf.data && Number(wf.data.versionCounter),
        transportError: wf.transportError || null,
      };
      out.activeIds = active.ids || [];
      out.activeTransportError = active.transportError || null;
      out.running = running;
      let webhookRows = -1;
      try {
        webhookRows = (readWebhooks().rows || []).length;
      } catch (e) {
        out.webhookProbeError = String(e.message || e);
      }
      out.webhookRows = webhookRows;
      const webhooksClear =
        !wf.transportError &&
        !active.transportError &&
        webhookRows >= 0 &&
        out.workflow.active === false &&
        !out.workflow.activeVersionId &&
        out.activeIds.length === 0 &&
        webhookRows === 0;
      out.webhooksClear = webhooksClear;
      // Require observable idle executions — else UNCERTAIN / not safe
      const execIdle =
        running.available === true && Number.isFinite(running.count) && running.count === 0;
      out.verified = webhooksClear && execIdle;
      out.safeDeclared = out.verified === true;
      if (webhooksClear && !execIdle) {
        out.uncertainReason =
          running.available === false
            ? 'executions_api_unobservable'
            : 'executions_still_running_or_unknown';
      }
    } else {
      out.issues = ['no session — cannot verify REST state'];
    }
  } catch (e) {
    out.catchError = errInfo(e);
  }
  writeJson(`safety-postflight-${tag}.json`, out);
  return out;
}

async function main() {
  if (new URL(BASE).hostname !== '127.0.0.1' || new URL(BASE).port !== '5682') {
    throw new Error('bad base URL — TEST only');
  }
  ensureArt();
  let session = null;
  let activated = false;
  try {
    console.error('=== RUNTIME-013 login ===');
    session = await login();
    console.error('=== RUNTIME-013 preflight ===');
    const pf = await preflight(session);
    if (!pf.ok) {
      writeJson('campaign-result.json', { verdict: 'FAIL', phase: 'preflight', issues: pf.issues });
      console.error('PREFLIGHT FAIL', pf.issues);
      await safetyPostflight(session, 'preflight-fail', false);
      process.exit(1);
    }
    console.error('preflight PASS');

    const results = [];
    for (const sc of SCENARIOS) {
      const r = await runScenario(sc, session);
      results.push(r);
      if (r.activate && r.activate.active) activated = true;
      if (r.deactivate && r.deactivate.active === false) activated = false;
      if (r.verdict !== 'PASS') {
        writeJson('campaign-result.json', {
          verdict: r.verdict,
          stoppedAfter: sc.id,
          results: results.map((x) => ({ id: x.id, verdict: x.verdict, issues: x.issues })),
        });
        console.error(`STOP after ${sc.id}: ${r.verdict}`);
        if (activated) {
          try {
            await deactivate(session, 'campaign-stop');
            activated = false;
          } catch (e) {
            console.error('ESCALATION deactivate:', e.message);
          }
        }
        await safetyPostflight(session, `stop-${sc.id}`, activated);
        process.exit(r.verdict === 'UNCERTAIN' ? 3 : 1);
      }
    }

    // Mission 015+: never auto-delete fixtures unless explicitly allowed.
    const allowCleanup = String(process.env.RUNTIME_ALLOW_CLEANUP || '') === '1';
    const cleanup = allowCleanup
      ? await cleanupIfSafe(results)
      : { cleaned: false, reason: 'RUNTIME_ALLOW_CLEANUP not set — fixtures preserved' };
    const summary = {
      mission: 'R04A-RUNTIME-036',
      runtimeOnly: ['R04-A'],
      ts: new Date().toISOString(),
      versionId: EXPECT_VERSION_ID,
      versionCounter: EXPECT_VERSION_COUNTER,
      gererSha: EXPECT_GERER_SHA,
      liveTouched: false,
      retentionUnchanged: true,
      results: results.map((r) => ({
        id: r.id,
        verdict: r.verdict,
        issues: r.issues,
        retried: r.retried === true,
        httpStatus: r.http && r.http.status,
        httpType: extractType(r.http && r.http.json),
        beforeStep: r.before && r.before.conversationStep,
        afterStep: r.after && r.after.conversationStep,
        emailPresent: r.after && r.after.emailPresent,
        emailLen: r.after && r.after.emailLen,
        nomPresent: r.after && r.after.nomPresent,
        prenomPresent: r.after && r.after.prenomPresent,
        slotIdPresent: r.after && r.after.slotIdPresent,
        ttlAfter: r.after && r.after.ttlActive,
        mockPostsDelta: (r.mockPostsAfter || 0) - (r.mockPostsBefore || 0),
        mockClaimsDelta: (r.mockClaimsAfter || 0) - (r.mockClaimsBefore || 0),
      })),
      cleanup,
      fingerprintFinal: fingerprint(),
      globalVerdict: results.every((r) => r.verdict === 'PASS') ? 'PASS' : 'FAIL',
      r04b: 'NOT_AUTHORIZED',
      r04c: 'NOT_AUTHORIZED',
      live: 'NO-GO',
    };
    writeJson('campaign-result.json', summary);
    await safetyPostflight(session, 'success', false);
    console.error(JSON.stringify(summary, null, 2));
    process.exit(summary.globalVerdict === 'PASS' ? 0 : 1);
  } catch (e) {
    console.error('FATAL', e);
    writeJson('campaign-fatal.json', {
      error: String(e.message || e),
      stack: String(e.stack || ''),
      detail: e.detail || null,
      transportError: errInfo(e),
      retried: false,
    });
    try {
      await safetyPostflight(session, 'fatal', activated);
    } catch (_) {}
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  evaluateOllamaGate,
  timeoutPolicy,
  classifyPostflight,
  correlationEvent,
  hashSessionId,
  assertR04A,
  redactHttpArtifact,
  TIMEOUT_AFTER_WARM_MS,
  CHAT_TIMEOUT_MS,
  SETTLE_MS,
  EXPECT_GERER_SHA,
  EXPECT_VERSION_ID,
  EXPECT_VERSION_COUNTER,
  SCENARIOS,
  R04A_EMAIL_SYNTHETIC,
};
