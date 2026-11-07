'use strict';

/**
 * RUNTIME-R01-RETRY-015 — readonly preflight gate only.
 * No activate, no chat, no Docker mutate, no SQL write.
 */

const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const ENV_FILE =
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-30-rec008-phase8e2b2-TEST-DEPLOY/.env.rec008-test.local';
const BASE = 'http://127.0.0.1:5682';
const WF_ID = 'OCD9It1uKFhOoWNF';
const PG_CTR = 'govsuite-rec008-test-rec008-postgres-1';
const DOCKER_PROJ = 'govsuite-rec008-test';

function envValue(name) {
  const text = fs.readFileSync(ENV_FILE, 'utf8');
  const m = text.match(new RegExp('^' + name + '=(.*)$', 'm'));
  if (!m) throw new Error('missing env ' + name);
  return m[1];
}

function restHeaders(extra) {
  return Object.assign({ Connection: 'close' }, extra || {});
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
        }
      : null,
  };
}

async function fetchOnce(url, opts, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const merged = Object.assign({}, opts || {});
  merged.headers = restHeaders(merged.headers);
  merged.signal = controller.signal;
  try {
    const res = await fetch(url, merged);
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, transportError: null };
  } catch (e) {
    return { ok: false, status: 0, text: '', transportError: errInfo(e) };
  } finally {
    clearTimeout(timer);
  }
}

function docker(args) {
  return execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
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
    '-c',
    sql,
  ]).trim();
}

(async () => {
  const out = {
    mission: 'RUNTIME-R01-RETRY-015',
    ts: new Date().toISOString(),
    mode: 'readonly-preflight',
    dockerMutatePlanned: false,
    activationByDevops: false,
    isolation: { n8nTestPort: 5682, livePortForbidden: 5680, liveTouched: false },
    issues: [],
  };

  const ps = docker([
    'ps',
    '-a',
    '--filter',
    'label=com.docker.compose.project=' + DOCKER_PROJ,
    '--format',
    '{{.Names}}\t{{.Status}}',
  ]);
  out.dockerProject = (ps || '').trim().split(/\r?\n/).filter(Boolean);
  if (!out.dockerProject.some((l) => l.includes('rec008-n8n-1') && l.includes('Up'))) {
    out.issues.push('n8n TEST not Up');
  }
  if (!out.dockerProject.some((l) => l.includes('rec008-postgres-1') && l.includes('Up'))) {
    out.issues.push('postgres TEST not Up');
  }

  const health = await fetchOnce(BASE + '/healthz', { method: 'GET' }, 10000);
  out.healthz = { status: health.status, body: (health.text || '').slice(0, 80) };
  if (health.status !== 200) out.issues.push('healthz failed');

  const loginRes = await fetch(BASE + '/rest/login', {
    method: 'POST',
    headers: restHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      emailOrLdapLoginId: envValue('REC008_N8N_OWNER_EMAIL'),
      password: envValue('REC008_N8N_OWNER_PASSWORD'),
    }),
  });
  const cookie = (loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [])
    .map((i) => i.split(';')[0])
    .join('; ');
  out.login = { status: loginRes.status, cookiePresent: Boolean(cookie) };
  if (loginRes.status !== 200 || !cookie) {
    out.issues.push('login failed');
    out.ok = false;
    out.gate = 'NO-GO';
    console.log(JSON.stringify(out, null, 2));
    process.exit(2);
  }

  const hdr = { cookie, accept: 'application/json', Connection: 'close' };
  const wf = await fetchOnce(BASE + '/rest/workflows/' + WF_ID, { method: 'GET', headers: hdr }, 20000);
  let data = null;
  try {
    const parsed = JSON.parse(wf.text || '{}');
    data = parsed.data || parsed;
  } catch (_) {}
  out.workflow = {
    http: wf.status,
    transportError: wf.transportError,
    id: data && data.id,
    active: data && data.active === true,
    activeVersionId: (data && data.activeVersionId) || null,
    versionId: data && data.versionId,
    versionCounter: data && data.versionCounter,
    nodeCount: data && Array.isArray(data.nodes) ? data.nodes.length : null,
  };
  if (wf.transportError) out.issues.push('getWorkflow transport: ' + (wf.transportError.message || 'failed'));
  if (wf.status !== 200) out.issues.push('getWorkflow http ' + wf.status);

  const act = await fetchOnce(BASE + '/rest/active-workflows', { method: 'GET', headers: hdr }, 15000);
  let ids = [];
  try {
    const j = JSON.parse(act.text || '[]');
    ids = Array.isArray(j) ? j : j.data || j;
    if (!Array.isArray(ids)) ids = [];
  } catch (_) {}
  out.activeWorkflowIds = ids;
  if (act.transportError) out.issues.push('active-workflows transport');

  let webhookRows = null;
  try {
    webhookRows = Number(pg('SELECT count(*) FROM webhook_entity;'));
  } catch (e) {
    out.issues.push('webhook probe: ' + e.message);
  }
  out.webhookRows = webhookRows;

  let fingerprint = null;
  try {
    fingerprint = pg(
      "SELECT format('%s|%s|%s|%s', (SELECT count(*) FROM rendez_vous), (SELECT count(*) FROM ai_conversation_state), (SELECT count(*) FROM ai_appointment_attempt), (SELECT count(*) FROM notifications));",
    );
  } catch (e) {
    out.issues.push('fingerprint: ' + e.message);
  }
  out.fingerprint = fingerprint;

  if (out.workflow.active || out.workflow.activeVersionId || (ids && ids.length)) {
    out.issues.push('workflow must be inactive at preflight');
  }
  if (webhookRows !== 0 && webhookRows !== null) {
    out.issues.push('active webhooks present at preflight');
  }

  out.ok = out.issues.length === 0;
  out.gate = out.ok ? 'GO' : 'NO-GO';
  out.parentPlan = {
    activateOnceFor: 'R01',
    deactivateAfter: true,
    devopsActivates: false,
  };
  out.verdict = out.ok ? 'PASS' : 'FAIL';

  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
})().catch((e) => {
  console.error(String((e && e.stack) || e));
  process.exit(3);
});
