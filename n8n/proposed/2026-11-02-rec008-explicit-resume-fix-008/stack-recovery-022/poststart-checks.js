'use strict';
/**
 * STACK-RECOVERY-022 — post-start integrity (TEST only).
 * No activate, no chat, no Ollama inference, no PG mutate, no LIVE.
 */
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('path');

const ART = path.resolve(__dirname);
const ENV_FILE =
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-30-rec008-phase8e2b2-TEST-DEPLOY/.env.rec008-test.local';
const BASE = 'http://127.0.0.1:5682';
const WF_ID = 'OCD9It1uKFhOoWNF';
const EXPECT_VERSION_ID = 'fd75ba32-f018-40e4-9f79-8f2a5400320b';
const EXPECT_VERSION_COUNTER = 10;
const EXPECT_GERER_SHA =
  'f75d49849231f956bb9ae5383111ea84b362dc58de6711cc75d2e7e2a26917fe';
const GERER_NAME = 'Gérer collecte progressive';
const N8N_CTR = 'govsuite-rec008-test-rec008-n8n-1';
const PG_CTR = 'govsuite-rec008-test-rec008-postgres-1';
const EXPECT_RUNNER_SHA =
  '1ab9465a720aa64925e633e5665eea3bafbe42225ac3e728bceea9f177ac5826';
const SESSIONS = [
  'rec008-runtime013-r01-active',
  'rec008-runtime013-r02-expired',
  'rec008-runtime013-r03-resume',
];

const out = {
  mission: 'TEST-STACK-RECOVERY-022',
  ts: new Date().toISOString(),
  liveProbed: false,
  pgMutated: false,
  n8nActivated: false,
  chatTriggerUsed: false,
  ollamaInference: false,
  issues: [],
};

function envValue(name) {
  const text = fs.readFileSync(ENV_FILE, 'utf8');
  const m = text.match(new RegExp('^' + name + '=(.*)$', 'm'));
  if (!m) throw new Error('missing env ' + name);
  return m[1];
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
    '-F',
    '|',
    '-c',
    sql,
  ]).trim();
}

function sha(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
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

async function fetchOnce(url, opts, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    const text = await res.text();
    return { status: res.status, text, ok: res.ok, headers: res.headers };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const health = await fetchOnce(BASE + '/healthz', { method: 'GET' }, 15000);
  out.healthz = { status: health.status };

  const loginRes = await fetchOnce(
    BASE + '/rest/login',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', Connection: 'close' },
      body: JSON.stringify({
        emailOrLdapLoginId: envValue('REC008_N8N_OWNER_EMAIL'),
        password: envValue('REC008_N8N_OWNER_PASSWORD'),
      }),
    },
    30000,
  );
  const cookie = (loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [])
    .map((i) => i.split(';')[0])
    .join('; ');
  out.login = { status: loginRes.status, cookiePresent: Boolean(cookie) };
  if (loginRes.status !== 200 || !cookie) {
    out.issues.push('login failed');
    fs.writeFileSync(path.join(ART, 'POSTSTART.json'), JSON.stringify(out, null, 2) + '\n');
    process.exit(1);
  }
  const session = {
    cookie,
    accept: 'application/json',
    'content-type': 'application/json',
    Connection: 'close',
  };

  const wfRes = await fetchOnce(
    BASE + '/rest/workflows/' + WF_ID,
    { method: 'GET', headers: session },
    30000,
  );
  let wfJson = null;
  try {
    wfJson = JSON.parse(wfRes.text);
  } catch {
    wfJson = null;
  }
  const wf = (wfJson && wfJson.data) || wfJson || {};
  const nodes = wf.nodes || [];
  const gerer = nodes.find((n) => n && n.name === GERER_NAME);
  const gererCode = (gerer && gerer.parameters && gerer.parameters.jsCode) || '';
  const gererSha = sha(gererCode);

  const activeRes = await fetchOnce(
    BASE + '/rest/active-workflows',
    { method: 'GET', headers: session },
    15000,
  );
  let activeJson = null;
  try {
    activeJson = JSON.parse(activeRes.text);
  } catch {
    activeJson = null;
  }
  const activeIds = ((activeJson && (activeJson.data || activeJson)) || [])
    .map((x) => x.id || x)
    .filter(Boolean);

  const execRes = await fetchOnce(
    BASE + '/rest/executions?status=running&limit=20',
    { method: 'GET', headers: session },
    15000,
  );
  let execJson = null;
  try {
    execJson = JSON.parse(execRes.text);
  } catch {
    execJson = null;
  }
  const execData = (execJson && (execJson.data || execJson.results || execJson)) || [];
  const execList = Array.isArray(execData) ? execData : execData.data || execData.results || [];

  const settingsRes = await fetchOnce(
    BASE + '/rest/settings',
    { method: 'GET', headers: session },
    15000,
  );
  let settingsJson = null;
  try {
    settingsJson = JSON.parse(settingsRes.text);
  } catch {
    settingsJson = null;
  }
  const settings = (settingsJson && settingsJson.data) || settingsJson || {};

  // webhooks via sqlite probe
  const probeSrc = path.join(ART, '..', 'runtime-013', 'webhooks-probe.js');
  let webhookRows = -1;
  try {
    docker(['cp', probeSrc, N8N_CTR + ':/tmp/rec008-r022-webhooks.js']);
    const whText = docker(['exec', N8N_CTR, 'node', '/tmp/rec008-r022-webhooks.js']);
    docker(['exec', '-u', 'root', N8N_CTR, 'rm', '-f', '/tmp/rec008-r022-webhooks.js']);
    webhookRows = (JSON.parse(whText).rows || []).length;
  } catch (e) {
    out.issues.push('webhook probe: ' + String(e.message || e));
  }

  let executionEntityCount = null;
  try {
    const cnt = docker([
      'exec',
      N8N_CTR,
      'node',
      '-e',
      "const Database=require('better-sqlite3');const db=new Database('/home/node/.n8n/database.sqlite',{readonly:true});console.log(db.prepare('select count(*) as c from execution_entity').get().c);",
    ]).trim();
    executionEntityCount = Number(cnt);
  } catch (e) {
    out.executionEntityError = String(e.message || e).slice(0, 200);
  }

  out.workflow = {
    http: wfRes.status,
    id: wf.id,
    active: wf.active === true,
    activeVersionId: wf.activeVersionId || null,
    versionId: wf.versionId,
    versionCounter: Number(wf.versionCounter),
    nodeCount: nodes.length,
    edgeCount: edgesOf(wf.connections),
    gererSha,
    activeIds,
    webhookRows,
    runningExecutions: Array.isArray(execList) ? execList.length : null,
    executionsApiStatus: execRes.status,
  };

  out.observability = {
    settingsHttp: settingsRes.status,
    saveDataErrorExecution: settings.saveDataErrorExecution || null,
    saveDataSuccessExecution: settings.saveDataSuccessExecution || null,
    saveExecutionProgress: settings.saveExecutionProgress,
    saveManualExecutions: settings.saveManualExecutions,
    executionEntityCount,
    note: 'readonly — not modified',
  };

  if (out.workflow.active || out.workflow.activeVersionId || activeIds.length) {
    out.issues.push('workflow must be inactive');
  }
  if (out.workflow.versionId !== EXPECT_VERSION_ID) out.issues.push('versionId mismatch');
  if (out.workflow.versionCounter !== EXPECT_VERSION_COUNTER) out.issues.push('versionCounter mismatch');
  if (gererSha !== EXPECT_GERER_SHA) out.issues.push('gerer SHA mismatch');
  if (out.workflow.nodeCount !== 134) out.issues.push('nodeCount != 134');
  if (out.workflow.edgeCount !== 137) out.issues.push('edgeCount != 137');
  if (webhookRows !== 0) out.issues.push('webhooks != 0');
  if (out.workflow.runningExecutions !== 0 && out.workflow.runningExecutions != null) {
    out.issues.push('running executions > 0');
  }

  out.fingerprint = pg(
    "SELECT format('%s|%s|%s|%s', (SELECT count(*) FROM rendez_vous), (SELECT count(*) FROM ai_conversation_state), (SELECT count(*) FROM ai_appointment_attempt), (SELECT count(*) FROM notifications));",
  );
  out.openAttempts = Number(
    pg(
      "SELECT count(*) FROM ai_appointment_attempt WHERE status IN ('AWAITING_CONFIRMATION','SUBMITTING','UNCERTAIN');",
    ) || '0',
  );

  out.fixtures = [];
  for (const sid of SESSIONS) {
    const esc = sid.replace(/'/g, "''");
    const line = pg(
      `SELECT session_id, coalesce(conversation_step,''), coalesce(pending_action,''), CASE WHEN slot_id IS NOT NULL THEN 't' ELSE 'f' END, CASE WHEN prenom IS NULL THEN 't' ELSE 'f' END, length(coalesce(prenom,'')), length(coalesce(last_user_message,'')), CASE WHEN last_user_message ILIKE '%Camille%' THEN 't' ELSE 'f' END, CASE WHEN expires_at > NOW() THEN 't' ELSE 'f' END, expires_at::text, CASE WHEN available_slots IS NOT NULL THEN jsonb_array_length(available_slots::jsonb) ELSE 0 END, coalesce(date_debut::text,''), coalesce(date_fin::text,''), CASE WHEN nom IS NOT NULL AND length(btrim(nom))>0 THEN 't' ELSE 'f' END FROM ai_conversation_state WHERE session_id='${esc}';`,
    );
    if (!line) {
      out.issues.push('missing fixture ' + sid);
      out.fixtures.push({ session_id: sid, missing: true });
      continue;
    }
    const p = line.split('|');
    const row = {
      session_id: p[0],
      conversation_step: p[1],
      pending_action: p[2],
      slot_id_present: p[3] === 't',
      prenom_null: p[4] === 't',
      prenom_len: Number(p[5]),
      last_user_message_len: Number(p[6]),
      last_user_message_has_camille: p[7] === 't',
      ttl_future: p[8] === 't',
      expires_at: p[9],
      available_slots_len: Number(p[10]),
      date_debut: p[11],
      date_fin: p[12],
      nom_present: p[13] === 't',
    };
    out.fixtures.push(row);
    if (row.conversation_step !== 'ASK_PRENOM') out.issues.push(sid + ' step');
    if (row.pending_action !== 'CREATE_APPOINTMENT') out.issues.push(sid + ' pending');
    if (!row.slot_id_present) out.issues.push(sid + ' slot');
    if (!row.prenom_null) out.issues.push(sid + ' prenom');
    if (row.last_user_message_has_camille) out.issues.push(sid + ' Camille residue');
    if (!row.nom_present) out.issues.push(sid + ' nom');
    if (!(row.available_slots_len >= 1)) out.issues.push(sid + ' slots');
  }

  const r01 = out.fixtures.find((f) => f.session_id === SESSIONS[0]);
  out.ttl = {
    r01_ttl_future: r01 && r01.ttl_future === true,
    r02_ttl_future: out.fixtures[1] && out.fixtures[1].ttl_future === true,
    r03_ttl_future: out.fixtures[2] && out.fixtures[2].ttl_future === true,
    TTL_REFRESH_REQUIRED: r01 ? r01.ttl_future !== true : true,
  };
  if (out.openAttempts !== 0) out.issues.push('openAttempts=' + out.openAttempts);

  // runner 021 offline integrity
  const runnerPath = path.join(ART, '..', 'runtime-013', 'run-runtime-013.js');
  const runnerBuf = fs.readFileSync(runnerPath);
  const runnerSha = sha(runnerBuf);
  out.runner021 = {
    sha256: runnerSha,
    expect: EXPECT_RUNNER_SHA,
    shaMatch: runnerSha === EXPECT_RUNNER_SHA,
    hasGate: /evaluateOllamaGate|checkOllamaGate/.test(runnerBuf.toString('utf8')),
    has180s: /TIMEOUT_AFTER_WARM_MS|180000/.test(runnerBuf.toString('utf8')),
    hasNoRetry: /retried:\s*false/.test(runnerBuf.toString('utf8')),
    hasClassify: /classifyPostflight/.test(runnerBuf.toString('utf8')),
    hasSettle: /SETTLE_MS/.test(runnerBuf.toString('utf8')),
    hasRunningExec: /getRunningExecutions/.test(runnerBuf.toString('utf8')),
  };
  if (!out.runner021.shaMatch) out.issues.push('runner SHA mismatch');

  out.ok = out.issues.length === 0;
  fs.writeFileSync(path.join(ART, 'POSTSTART.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify({ ok: out.ok, issues: out.issues, ttl: out.ttl, fingerprint: out.fingerprint }, null, 2));
  process.exit(out.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  out.fatal = String(e.message || e);
  fs.writeFileSync(path.join(ART, 'POSTSTART.json'), JSON.stringify(out, null, 2) + '\n');
  process.exit(1);
});
