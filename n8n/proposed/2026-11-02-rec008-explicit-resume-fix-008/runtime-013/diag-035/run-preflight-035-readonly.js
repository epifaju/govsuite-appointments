'use strict';
/**
 * MISSION 035 — préflight TEST lecture seule.
 * Cible exclusive: govsuite-rec008-test / 127.0.0.1:5682
 * Attendu post-034: VC11 / versionId f5a9181f… / Gerer SHA 44a7064d…
 * Interdit: LIVE (:5680), PUT, activate, Docker mutate, SQL write, retry réseau.
 */
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ART = path.resolve(__dirname);
const ENV_FILE =
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-30-rec008-phase8e2b2-TEST-DEPLOY/.env.rec008-test.local';
const BASE = 'http://127.0.0.1:5682';
const LIVE_FORBIDDEN = 'http://127.0.0.1:5680';
const WF_ID = 'OCD9It1uKFhOoWNF';
const EXPECT_VERSION_ID = 'f5a9181f-ff8d-4301-976e-57add79badae';
const EXPECT_VERSION_COUNTER = 11;
const EXPECT_GERER_SHA =
  '44a7064d12755a84dd256acae90abbf67a778178f9947eec3a36dc0c9abcad3f';
const EXPECT_NODES = 134;
const EXPECT_EDGES = 137;
const GERER_NAME = 'Gérer collecte progressive';
const DOCKER_PROJ = 'govsuite-rec008-test';
const N8N_CTR = 'govsuite-rec008-test-rec008-n8n-1';
const PG_CTR = 'govsuite-rec008-test-rec008-postgres-1';
const PG_DB = 'govsuite_rec008_test';

const out = {
  mission: '035-preflight-test-readonly',
  ts: new Date().toISOString(),
  isolation: {
    n8nTestPort: 5682,
    livePortForbidden: 5680,
    liveTouched: false,
    liveProbed: false,
    putUsed: false,
    dockerMutated: false,
    pgMutated: false,
  },
  issues: [],
  stopConditions: [],
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

function pgSelect(sql) {
  return docker([
    'exec',
    '-i',
    PG_CTR,
    'psql',
    '-U',
    'postgres',
    '-d',
    PG_DB,
    '-t',
    '-A',
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
  if (String(url).includes(':5680') || String(url).startsWith(LIVE_FORBIDDEN)) {
    throw new Error('LIVE probe forbidden');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    const text = await res.text();
    return { status: res.status, text, ok: res.ok, headers: res.headers, transportError: null };
  } catch (e) {
    return {
      status: 0,
      text: '',
      ok: false,
      headers: null,
      transportError: String((e && e.message) || e).slice(0, 160),
    };
  } finally {
    clearTimeout(timer);
  }
}

function finalize(gate, verdict) {
  out.ok = out.issues.length === 0 && gate !== 'NO-GO';
  out.gate = gate;
  out.verdict = verdict;
  fs.mkdirSync(ART, { recursive: true });
  fs.writeFileSync(path.join(ART, 'PREFLIGHT.json'), JSON.stringify(out, null, 2) + '\n');
  const summary = {
    mission: out.mission,
    verdict: out.verdict,
    gate: out.gate,
    issues: out.issues,
    stopConditions: out.stopConditions,
    liveTouched: out.isolation.liveTouched,
    docker: out.docker,
    healthz: out.healthz,
    workflow: out.workflow
      ? {
          active: out.workflow.active,
          activeVersionId: out.workflow.activeVersionId,
          versionId: out.workflow.versionId,
          versionCounter: out.workflow.versionCounter,
          nodeCount: out.workflow.nodeCount,
          edgeCount: out.workflow.edgeCount,
          gererShaPrefix: out.workflow.gererSha
            ? out.workflow.gererSha.slice(0, 8) + '…'
            : null,
          webhookRows: out.workflow.webhookRows,
          runningExecutions: out.workflow.runningExecutions,
          activeIdsCount: Array.isArray(out.workflow.activeIds)
            ? out.workflow.activeIds.length
            : null,
        }
      : null,
    fingerprint: out.fingerprint || null,
    openAttempts: out.openAttempts,
  };
  console.log(JSON.stringify(summary, null, 2));
}

(async () => {
  // --- Docker inventory (read-only) ---
  let ps = '';
  try {
    ps = docker([
      'ps',
      '--filter',
      'label=com.docker.compose.project=' + DOCKER_PROJ,
      '--format',
      '{{.Names}}\t{{.Status}}\t{{.Ports}}',
    ]);
  } catch (e) {
    out.issues.push('docker-ps-failed');
    out.stopConditions.push('test-stack-down');
    finalize('NO-GO', 'NO-GO');
    process.exit(2);
  }
  out.docker = (ps || '')
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [name, status] = line.split('\t');
      return { name, status };
    });

  const n8nUp = out.docker.some((c) => c.name.includes('rec008-n8n-1') && /Up/i.test(c.status));
  const pgUp = out.docker.some(
    (c) => c.name.includes('rec008-postgres-1') && /Up/i.test(c.status),
  );
  const publishUp = out.docker.some(
    (c) => c.name.includes('rec008-publish-1') && /Up/i.test(c.status),
  );
  if (!n8nUp || !pgUp || !publishUp) {
    out.issues.push('test-containers-not-up');
    out.stopConditions.push('test-stack-down');
    finalize('NO-GO', 'NO-GO');
    process.exit(2);
  }

  // --- healthz TEST only (no LIVE) ---
  const health = await fetchOnce(BASE + '/healthz', { method: 'GET' }, 15000);
  out.healthz = {
    status: health.status,
    body: (health.text || '').slice(0, 80),
    transportError: health.transportError,
  };
  if (health.status !== 200) {
    out.issues.push('healthz');
    out.stopConditions.push('connectivity');
    finalize('NO-GO', 'NO-GO');
    process.exit(2);
  }

  // --- login + workflow GET ---
  if (!fs.existsSync(ENV_FILE)) {
    out.issues.push('env-missing');
    finalize('NO-GO', 'UNCERTAIN');
    process.exit(2);
  }
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
  const cookie = (
    loginRes.headers && loginRes.headers.getSetCookie
      ? loginRes.headers.getSetCookie()
      : []
  )
    .map((i) => i.split(';')[0])
    .join('; ');
  out.login = { status: loginRes.status, cookiePresent: Boolean(cookie) };
  if (!cookie || loginRes.status !== 200) {
    out.issues.push('login');
    finalize('NO-GO', 'FAIL');
    process.exit(1);
  }
  const hdr = {
    cookie,
    accept: 'application/json',
    'content-type': 'application/json',
    Connection: 'close',
  };

  const wfRes = await fetchOnce(
    BASE + '/rest/workflows/' + WF_ID,
    { method: 'GET', headers: hdr },
    30000,
  );
  if (wfRes.transportError || wfRes.status !== 200) {
    out.issues.push('getWorkflow');
    out.workflow = { http: wfRes.status, transportError: wfRes.transportError };
    finalize('NO-GO', 'FAIL');
    process.exit(1);
  }
  const wfJson = JSON.parse(wfRes.text);
  const wf = wfJson.data || wfJson;
  const nodes = wf.nodes || [];
  const gerer = nodes.find((n) => n && n.name === GERER_NAME);
  const gererSha = sha((gerer && gerer.parameters && gerer.parameters.jsCode) || '');

  const activeRes = await fetchOnce(
    BASE + '/rest/active-workflows',
    { method: 'GET', headers: hdr },
    15000,
  );
  let activeIds = [];
  try {
    const activeJson = JSON.parse(activeRes.text || '{}');
    const raw = activeJson.data || activeJson || [];
    activeIds = (Array.isArray(raw) ? raw : []).map((x) => x.id || x).filter(Boolean);
  } catch (_) {
    out.issues.push('active-workflows-parse');
  }

  const execRes = await fetchOnce(
    BASE + '/rest/executions?status=running&limit=20',
    { method: 'GET', headers: hdr },
    15000,
  );
  let execList = [];
  try {
    const j = JSON.parse(execRes.text || '{}');
    const d = j.data || j.results || j;
    execList = Array.isArray(d) ? d : d.data || d.results || [];
  } catch (_) {
    out.issues.push('executions-parse');
  }

  // webhooks via sqlite RO inside n8n (no docker cp / no file leave-behind)
  let webhookRows = null;
  try {
    const whOut = docker([
      'exec',
      N8N_CTR,
      'node',
      '-e',
      "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('/home/node/.n8n/database.sqlite',{readOnly:true});const c=db.prepare('select count(*) as c from webhook_entity').get().c;console.log(String(c));",
    ]).trim();
    webhookRows = Number(whOut);
  } catch (e) {
    out.issues.push('webhook-probe:' + String(e.message || e).slice(0, 80));
  }

  out.workflow = {
    http: wfRes.status,
    id: wf.id || WF_ID,
    active: wf.active === true,
    activeVersionId: wf.activeVersionId || null,
    versionId: wf.versionId || null,
    versionCounter: Number(wf.versionCounter),
    nodeCount: nodes.length,
    edgeCount: edgesOf(wf.connections),
    gererFound: Boolean(gerer),
    gererSha,
    gererShaPrefix: gererSha.slice(0, 8) + '…',
    activeIds,
    webhookRows,
    runningExecutions: Array.isArray(execList) ? execList.length : null,
  };

  if (out.workflow.active || out.workflow.activeVersionId || activeIds.length) {
    out.issues.push('workflow-active');
    out.stopConditions.push('workflow-active-unexpected');
  }
  if (out.workflow.versionId !== EXPECT_VERSION_ID) {
    out.issues.push('versionId');
    out.stopConditions.push('versionId-mismatch');
  }
  if (out.workflow.versionCounter !== EXPECT_VERSION_COUNTER) {
    out.issues.push('versionCounter');
    out.stopConditions.push('vc-mismatch');
  }
  if (gererSha !== EXPECT_GERER_SHA) {
    out.issues.push('gererSha');
    out.stopConditions.push('gerer-sha-drift');
  }
  if (out.workflow.nodeCount !== EXPECT_NODES) {
    out.issues.push('nodeCount');
    out.stopConditions.push('nodes-mismatch');
  }
  if (out.workflow.edgeCount !== EXPECT_EDGES) {
    out.issues.push('edgeCount');
    out.stopConditions.push('edges-mismatch');
  }
  if (webhookRows !== 0 && webhookRows !== null) {
    out.issues.push('webhooks');
    out.stopConditions.push('webhooks-unexpected');
  }
  if (out.workflow.runningExecutions !== 0) {
    out.issues.push('running');
    out.stopConditions.push('running-executions');
  }

  // PG SELECT-only fingerprint + open attempts
  try {
    out.fingerprint = pgSelect(
      "SELECT format('%s|%s|%s|%s', (SELECT count(*) FROM rendez_vous), (SELECT count(*) FROM ai_conversation_state), (SELECT count(*) FROM ai_appointment_attempt), (SELECT count(*) FROM notifications));",
    );
  } catch (e) {
    out.issues.push('fingerprint:' + String(e.message || e).slice(0, 80));
    out.fingerprint = null;
  }
  try {
    out.openAttempts = Number(
      pgSelect(
        "SELECT count(*) FROM ai_appointment_attempt WHERE status IN ('AWAITING_CONFIRMATION','SUBMITTING','UNCERTAIN');",
      ) || '0',
    );
  } catch (e) {
    out.issues.push('openAttempts:' + String(e.message || e).slice(0, 80));
    out.openAttempts = null;
  }
  if (out.openAttempts !== 0 && out.openAttempts !== null) {
    out.issues.push('openAttempts');
    out.stopConditions.push('open-attempts-unexpected');
  }

  out.expect = {
    versionId: EXPECT_VERSION_ID,
    versionCounter: EXPECT_VERSION_COUNTER,
    gererSha: EXPECT_GERER_SHA,
    nodeCount: EXPECT_NODES,
    edgeCount: EXPECT_EDGES,
    active: false,
    webhookRows: 0,
    running: 0,
    openAttempts: 0,
  };

  if (out.issues.length === 0) {
    finalize('GO-PREFLIGHT', 'PASS');
    process.exit(0);
  }
  finalize('NO-GO', 'FAIL');
  process.exit(1);
})().catch((e) => {
  out.fatal = String((e && e.message) || e).slice(0, 200);
  out.issues.push('fatal');
  finalize('NO-GO', 'UNCERTAIN');
  process.exit(3);
});
