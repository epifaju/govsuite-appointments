/* MISSION 030 — API lecture seule TEST — aucun PUT / activate / chat */
const fs = require('fs');
const path = require('path');

const ENV_FILE =
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-30-rec008-phase8e2b2-TEST-DEPLOY/.env.rec008-test.local';
const BASE = process.env.REC008_N8N_BASE || 'http://127.0.0.1:5682';
const WF_ID = 'OCD9It1uKFhOoWNF';

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    out[t.slice(0, i)] = t.slice(i + 1);
  }
  return out;
}

function pick(obj, keys) {
  const o = {};
  for (const k of keys) o[k] = obj[k];
  return o;
}

(async () => {
  const env = loadEnv(ENV_FILE);
  const email = env.REC008_N8N_OWNER_EMAIL;
  const password = env.REC008_N8N_OWNER_PASSWORD;
  const out = {
    mission: '030-retention-diag',
    liveProbed: false,
    retentionMutated: false,
    base: BASE,
    envFilePresent: fs.existsSync(ENV_FILE),
    credentialsPresent: Boolean(email && password),
  };

  if (!email || !password) {
    out.verdict = 'UNCERTAIN';
    out.issue = 'missing credentials env';
    console.log(JSON.stringify(out, null, 2));
    process.exit(1);
  }

  const loginRes = await fetch(BASE + '/rest/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ emailOrLdapLoginId: email, password }),
  });
  const setCookie = loginRes.headers.getSetCookie
    ? loginRes.headers.getSetCookie()
    : [];
  const cookie = (setCookie.join(';') || loginRes.headers.get('set-cookie') || '')
    .split(',')
    .map((s) => s.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
  out.login = { status: loginRes.status, cookiePresent: Boolean(cookie) };
  if (loginRes.status !== 200 || !cookie) {
    out.verdict = 'FAIL';
    console.log(JSON.stringify(out, null, 2));
    process.exit(1);
  }

  const headers = { cookie, accept: 'application/json' };

  const settingsRes = await fetch(BASE + '/rest/settings', { headers });
  const settingsBody = await settingsRes.json();
  const settings = settingsBody.data || settingsBody || {};
  out.settingsHttp = settingsRes.status;
  out.settings = pick(settings, [
    'saveDataSuccessExecution',
    'saveDataErrorExecution',
    'saveExecutionProgress',
    'saveManualExecutions',
    'executionTimeout',
    'maxExecutionTimeout',
    'timezone',
  ]);
  // capture any prune-related keys if present without dumping full settings
  const pruneKeys = Object.keys(settings).filter((k) =>
    /prune|execution|saveData|retention|binary/i.test(k),
  );
  out.settingsPruneRelatedKeys = pruneKeys;
  out.settingsPruneRelated = pick(settings, pruneKeys);

  const wfRes = await fetch(BASE + '/rest/workflows/' + WF_ID, { headers });
  const wf = ((await wfRes.json()).data) || {};
  out.workflow = {
    http: wfRes.status,
    id: wf.id || WF_ID,
    active: wf.active === true,
    activeVersionId: wf.activeVersionId || null,
    versionId: wf.versionId || null,
    versionCounter: wf.versionCounter,
    saveDataSuccessExecution: wf.settings?.saveDataSuccessExecution ?? null,
    saveDataErrorExecution: wf.settings?.saveDataErrorExecution ?? null,
    saveExecutionProgress: wf.settings?.saveExecutionProgress ?? null,
    saveManualExecutions: wf.settings?.saveManualExecutions ?? null,
    executionOrder: wf.settings?.executionOrder ?? null,
    timezone: wf.settings?.timezone ?? null,
    settingsKeys: wf.settings ? Object.keys(wf.settings).sort() : [],
  };

  async function listExec(qs) {
    const r = await fetch(BASE + '/rest/executions?' + qs, { headers });
    let count = null;
    let sample = [];
    try {
      const j = await r.json();
      const d = j.data || j.results || j;
      const arr = Array.isArray(d) ? d : d.data || d.results || [];
      count = Array.isArray(arr) ? arr.length : null;
      sample = (arr || []).slice(0, 3).map((e) => ({
        id: e.id,
        status: e.status,
        finished: e.finished,
        mode: e.mode,
        workflowId: e.workflowId,
        startedAt: e.startedAt,
        stoppedAt: e.stoppedAt,
      }));
    } catch (_) {}
    return { status: r.status, count, sample };
  }

  out.executions = {
    running: await listExec('status=running&limit=20'),
    all: await listExec('limit=20'),
    workflow: await listExec('workflowId=' + WF_ID + '&limit=20'),
  };

  out.verdict = 'PASS';
  console.log(JSON.stringify(out, null, 2));
})().catch((e) => {
  console.log(
    JSON.stringify(
      {
        mission: '030-retention-diag',
        verdict: 'UNCERTAIN',
        error: String(e.message || e).slice(0, 200),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
