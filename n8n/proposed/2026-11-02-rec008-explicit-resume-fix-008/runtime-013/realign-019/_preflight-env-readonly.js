'use strict';
/**
 * R013-FIXTURES-REALIGN-019 — env preflight readonly.
 * No activate, no chat, no Docker/PG mutate.
 */
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const ENV_FILE =
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-30-rec008-phase8e2b2-TEST-DEPLOY/.env.rec008-test.local';
const BASE = 'http://127.0.0.1:5682';
const LIVE = 'http://127.0.0.1:5680';
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
      ? { name: c.name || null, message: c.message ? String(c.message) : null, code: c.code || null }
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
    mission: 'R013-FIXTURES-REALIGN-019',
    ts: new Date().toISOString(),
    mode: 'readonly-preflight-env',
    dockerMutatePlanned: false,
    activationByDevops: false,
    pgMutatePlanned: false,
    issues: [],
    stop: [],
  };

  // 1) Docker compose project containers
  const ps = docker([
    'ps',
    '-a',
    '--filter',
    'label=com.docker.compose.project=' + DOCKER_PROJ,
    '--format',
    '{{.Names}}\t{{.Status}}',
  ]);
  const lines = (ps || '').trim().split(/\r?\n/).filter(Boolean);
  out.docker = {
    project: DOCKER_PROJ,
    containers: lines,
    count: lines.length,
    upCount: lines.filter((l) => /\tUp\b/.test(l) || / Up /.test(l)).length,
  };
  // format is NAME\tSTATUS — Status starts with Up
  out.docker.upCount = lines.filter((l) => {
    const status = l.split('\t')[1] || '';
    return status.startsWith('Up');
  }).length;
  if (out.docker.upCount !== 5 || out.docker.count !== 5) {
    out.issues.push('expected 5 Up containers in project ' + DOCKER_PROJ);
    out.stop.push('docker_up_count');
  }

  // 2) Postgres healthy + DB
  let pgHealth = null;
  try {
    pgHealth = docker([
      'inspect',
      '--format',
      '{{if .State.Health}}{{.State.Health.Status}}{{else}}n/a{{end}}',
      PG_CTR,
    ]).trim();
  } catch (e) {
    out.issues.push('postgres inspect: ' + e.message);
  }
  let dbMeta = null;
  try {
    dbMeta = pg('SELECT current_database() || \'|\' || pg_is_in_recovery()::text;');
  } catch (e) {
    out.issues.push('postgres query: ' + e.message);
    out.stop.push('postgres_unreachable');
  }
  out.postgres = {
    container: PG_CTR,
    health: pgHealth,
    dbMeta,
    dbExpected: 'govsuite_rec008_test',
  };
  if (pgHealth !== 'healthy') {
    out.issues.push('postgres not healthy');
    out.stop.push('postgres_unhealthy');
  }
  if (dbMeta && !String(dbMeta).startsWith('govsuite_rec008_test|')) {
    out.issues.push('unexpected database: ' + dbMeta);
    out.stop.push('wrong_database');
  }

  // 3) Isolation LIVE — LIVE up is OK if all ops stay on TEST (:5682 / govsuite_rec008_test).
  // Mission 019 + security: do NOT STOP solely because :5680 answers healthz.
  const liveProbe = await fetchOnce(LIVE + '/healthz', { method: 'GET' }, 3000);
  const testProbe = await fetchOnce(BASE + '/healthz', { method: 'GET' }, 10000);
  out.isolation = {
    n8nTestPort: 5682,
    livePortObserved: 5680,
    liveProbe: {
      status: liveProbe.status,
      transportError: liveProbe.transportError,
      bodyPreview: (liveProbe.text || '').slice(0, 40),
    },
    testHealthz: {
      status: testProbe.status,
      bodyPreview: (testProbe.text || '').slice(0, 40),
    },
    policy: 'LIVE_up_ok_if_ops_TEST_only',
    liveReachable: liveProbe.status > 0 && !liveProbe.transportError,
    liveTouched: false,
    liveMutatePlanned: false,
  };
  if (testProbe.status !== 200) {
    out.issues.push('TEST healthz failed');
    out.stop.push('test_healthz');
  }

  // 4) Fingerprint (SELECT counts only)
  let fingerprint = null;
  try {
    fingerprint = pg(
      "SELECT format('%s|%s|%s|%s', (SELECT count(*) FROM rendez_vous), (SELECT count(*) FROM ai_conversation_state), (SELECT count(*) FROM ai_appointment_attempt), (SELECT count(*) FROM notifications));",
    );
  } catch (e) {
    out.issues.push('fingerprint: ' + e.message);
  }
  out.fingerprint = {
    format: 'rendez_vous|sessions|attempts|notifs',
    value: fingerprint,
  };

  // 5) n8n executions via REST (sqlite known empty when saveData*=none)
  let cookie = '';
  try {
    const loginRes = await fetch(BASE + '/rest/login', {
      method: 'POST',
      headers: restHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({
        emailOrLdapLoginId: envValue('REC008_N8N_OWNER_EMAIL'),
        password: envValue('REC008_N8N_OWNER_PASSWORD'),
      }),
    });
    cookie = (loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [])
      .map((i) => i.split(';')[0])
      .join('; ');
    out.login = { status: loginRes.status, cookiePresent: Boolean(cookie) };
    if (loginRes.status !== 200 || !cookie) out.issues.push('n8n login failed');
  } catch (e) {
    out.login = { status: 0, error: String(e.message || e) };
    out.issues.push('n8n login transport');
  }

  const hdr = { cookie, accept: 'application/json', Connection: 'close' };

  if (cookie) {
    const wf = await fetchOnce(BASE + '/rest/workflows/' + WF_ID, { method: 'GET', headers: hdr }, 20000);
    let data = null;
    try {
      const parsed = JSON.parse(wf.text || '{}');
      data = parsed.data || parsed;
    } catch (_) {}
    out.workflow = {
      http: wf.status,
      id: data && data.id,
      active: data && data.active === true,
      activeVersionId: (data && data.activeVersionId) || null,
      versionId: data && data.versionId,
      versionCounter: data && data.versionCounter,
    };

    const act = await fetchOnce(BASE + '/rest/active-workflows', { method: 'GET', headers: hdr }, 15000);
    let ids = [];
    try {
      const j = JSON.parse(act.text || '[]');
      ids = Array.isArray(j) ? j : j.data || j;
      if (!Array.isArray(ids)) ids = [];
    } catch (_) {}
    out.activeWorkflowIds = ids;

    const exRunning = await fetchOnce(
      BASE + '/rest/executions?limit=20&status=running',
      { method: 'GET', headers: hdr },
      20000,
    );
    const exWaiting = await fetchOnce(
      BASE + '/rest/executions?limit=20&status=waiting',
      { method: 'GET', headers: hdr },
      20000,
    );
    function parseExec(res) {
      let results = [];
      let count = null;
      try {
        const j = JSON.parse(res.text || '{}');
        const payload = j.data || j;
        results = (payload && payload.results) || (Array.isArray(payload) ? payload : []) || [];
        count = payload && typeof payload.count === 'number' ? payload.count : results.length;
      } catch (_) {}
      return {
        http: res.status,
        transportError: res.transportError,
        count,
        ids: results.slice(0, 20).map((r) => ({
          id: r.id,
          workflowId: r.workflowId,
          status: r.status,
          startedAt: r.startedAt || null,
          stoppedAt: r.stoppedAt || null,
        })),
      };
    }
    out.executions = {
      note: 'sqlite execution_entity often empty (saveData*=none); REST is primary',
      sqliteOpenCountObservedSeparately: 0,
      running: parseExec(exRunning),
      waiting: parseExec(exWaiting),
    };
    const openN =
      (out.executions.running.count || 0) + (out.executions.waiting.count || 0);
    out.executions.openCount = openN;
    if (openN > 0) {
      out.issues.push('n8n open executions still present: ' + openN);
      out.stop.push('n8n_executions_running');
    }
  }

  out.ok = out.issues.length === 0;
  out.verdict = out.ok ? 'PASS' : 'FAIL';
  out.gate = out.ok ? 'GO-ENV' : 'NO-GO-ENV';

  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
})().catch((e) => {
  console.error(String((e && e.stack) || e));
  process.exit(3);
});
