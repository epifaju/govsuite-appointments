'use strict';
/**
 * R01-PREFLIGHT-023 — lecture seule. Pas d'activate/chat/Ollama infer/PG mutate/TTL exec/LIVE.
 */
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('path');
const { evaluateOllamaGate } = require('../runner-021/lib/ollama-gate.cjs');

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
const RUNNER_SHA_021 =
  '1ab9465a720aa64925e633e5665eea3bafbe42225ac3e728bceea9f177ac5826';

const out = {
  mission: 'R01-PREFLIGHT-023',
  ts: new Date().toISOString(),
  liveProbed: false,
  pgMutated: false,
  ttlSqlExecuted: false,
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
    'exec', '-i', PG_CTR, 'psql', '-U', 'postgres', '-d', 'govsuite_rec008_test',
    '-t', '-A', '-F', '|', '-c', sql,
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

function snapSession(sid) {
  const esc = sid.replace(/'/g, "''");
  const line = pg(
    `SELECT session_id, coalesce(conversation_step,''), coalesce(pending_action,''), CASE WHEN slot_id IS NOT NULL THEN 't' ELSE 'f' END, CASE WHEN prenom IS NULL THEN 't' ELSE 'f' END, length(coalesce(last_user_message,'')), CASE WHEN last_user_message ILIKE '%Camille%' THEN 't' ELSE 'f' END, CASE WHEN expires_at > NOW() THEN 't' ELSE 'f' END, expires_at::text, CASE WHEN available_slots IS NOT NULL THEN jsonb_array_length(available_slots::jsonb) ELSE 0 END, coalesce(date_debut::text,''), coalesce(date_fin::text,''), CASE WHEN nom IS NOT NULL AND length(btrim(nom))>0 THEN 't' ELSE 'f' END FROM ai_conversation_state WHERE session_id='${esc}';`,
  );
  if (!line) return null;
  const p = line.split('|');
  return {
    session_id: p[0],
    conversation_step: p[1],
    pending_action: p[2],
    slot_id_present: p[3] === 't',
    prenom_null: p[4] === 't',
    last_user_message_len: Number(p[5]),
    has_camille: p[6] === 't',
    ttl_future: p[7] === 't',
    expires_at: p[8],
    available_slots_len: Number(p[9]),
    date_debut: p[10],
    date_fin: p[11],
    nom_present: p[12] === 't',
  };
}

async function main() {
  const ps = docker([
    'ps', '--filter', 'label=com.docker.compose.project=govsuite-rec008-test',
    '--format', '{{.Names}}\t{{.Status}}',
  ]);
  out.docker = (ps || '').trim().split(/\r?\n/).filter(Boolean);
  if (out.docker.length < 5) out.issues.push('expected 5 TEST containers Up');

  const health = await fetchOnce(BASE + '/healthz', { method: 'GET' }, 15000);
  out.healthz = { status: health.status };
  if (health.status !== 200) out.issues.push('healthz');

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
  if (!cookie) {
    out.issues.push('login');
    fs.writeFileSync(path.join(ART, 'PREFLIGHT.json'), JSON.stringify(out, null, 2) + '\n');
    process.exit(1);
  }
  const session = {
    cookie, accept: 'application/json', 'content-type': 'application/json', Connection: 'close',
  };

  const wfRes = await fetchOnce(BASE + '/rest/workflows/' + WF_ID, { method: 'GET', headers: session }, 30000);
  const wfJson = JSON.parse(wfRes.text);
  const wf = wfJson.data || wfJson;
  const nodes = wf.nodes || [];
  const gerer = nodes.find((n) => n && n.name === GERER_NAME);
  const gererSha = sha((gerer && gerer.parameters && gerer.parameters.jsCode) || '');

  const activeRes = await fetchOnce(BASE + '/rest/active-workflows', { method: 'GET', headers: session }, 15000);
  const activeJson = JSON.parse(activeRes.text);
  const activeIds = ((activeJson.data || activeJson) || []).map((x) => x.id || x).filter(Boolean);

  const execRes = await fetchOnce(
    BASE + '/rest/executions?status=running&limit=20',
    { method: 'GET', headers: session },
    15000,
  );
  let execList = [];
  try {
    const j = JSON.parse(execRes.text);
    const d = j.data || j.results || j;
    execList = Array.isArray(d) ? d : d.data || d.results || [];
  } catch (_) {}

  const settingsRes = await fetchOnce(BASE + '/rest/settings', { method: 'GET', headers: session }, 15000);
  const settings = (JSON.parse(settingsRes.text).data) || {};

  let webhookRows = -1;
  try {
    const probeSrc = path.join(ART, '..', 'webhooks-probe.js');
    docker(['cp', probeSrc, N8N_CTR + ':/tmp/r023-wh.js']);
    webhookRows = (JSON.parse(docker(['exec', N8N_CTR, 'node', '/tmp/r023-wh.js'])).rows || []).length;
    docker(['exec', '-u', 'root', N8N_CTR, 'rm', '-f', '/tmp/r023-wh.js']);
  } catch (e) {
    out.issues.push('webhook:' + String(e.message || e).slice(0, 80));
  }

  let executionEntityCount = null;
  try {
    executionEntityCount = Number(
      docker([
        'exec', N8N_CTR, 'node', '-e',
        "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('/home/node/.n8n/database.sqlite',{readOnly:true});console.log(db.prepare('select count(*) as c from execution_entity').get().c);",
      ]).trim(),
    );
  } catch (e) {
    out.executionEntityError = String(e.message || e).slice(0, 120);
  }

  out.workflow = {
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
  };
  out.observability = {
    saveDataSuccessExecution: settings.saveDataSuccessExecution || null,
    saveDataErrorExecution: settings.saveDataErrorExecution || null,
    saveExecutionProgress: settings.saveExecutionProgress,
    saveManualExecutions: settings.saveManualExecutions,
    executionEntityCount,
    executionsApiStatus: execRes.status,
    retentionCause: 'INCONCLUSIVE',
    alternativeProofs: [
      'PG updated_at triplet + classifyPostflight',
      'Ollama /api/ps snapshots',
      'running executions poll',
      'webhook deactivate verify',
    ],
    retentionBlocksR01: false,
    note: 'saveData*=all but entity=0 historically; accept alternatives — do not PUT in 023',
  };

  if (out.workflow.active || out.workflow.activeVersionId || activeIds.length) out.issues.push('workflow active');
  if (out.workflow.versionId !== EXPECT_VERSION_ID) out.issues.push('versionId');
  if (out.workflow.versionCounter !== EXPECT_VERSION_COUNTER) out.issues.push('versionCounter');
  if (gererSha !== EXPECT_GERER_SHA) out.issues.push('gererSha');
  if (out.workflow.nodeCount !== 134 || out.workflow.edgeCount !== 137) out.issues.push('graph');
  if (webhookRows !== 0) out.issues.push('webhooks');
  if (out.workflow.runningExecutions !== 0) out.issues.push('running');

  out.fingerprint = pg(
    "SELECT format('%s|%s|%s|%s', (SELECT count(*) FROM rendez_vous), (SELECT count(*) FROM ai_conversation_state), (SELECT count(*) FROM ai_appointment_attempt), (SELECT count(*) FROM notifications));",
  );
  out.openAttempts = Number(
    pg(
      "SELECT count(*) FROM ai_appointment_attempt WHERE status IN ('AWAITING_CONFIRMATION','SUBMITTING','UNCERTAIN');",
    ) || '0',
  );
  if (out.openAttempts !== 0) out.issues.push('openAttempts');

  out.r01 = snapSession('rec008-runtime013-r01-active');
  out.r02 = snapSession('rec008-runtime013-r02-expired');
  out.r03 = snapSession('rec008-runtime013-r03-resume');
  for (const [label, row] of [['r01', out.r01], ['r02', out.r02], ['r03', out.r03]]) {
    if (!row) {
      out.issues.push(label + '_missing');
      continue;
    }
    if (row.conversation_step !== 'ASK_PRENOM') out.issues.push(label + '_step');
    if (row.pending_action !== 'CREATE_APPOINTMENT') out.issues.push(label + '_pending');
    if (!row.slot_id_present) out.issues.push(label + '_slot');
    if (!row.prenom_null) out.issues.push(label + '_prenom');
    if (row.has_camille) out.issues.push(label + '_camille');
    if (!row.nom_present) out.issues.push(label + '_nom');
  }
  out.ttl = {
    r01_ttl_future: out.r01 && out.r01.ttl_future === true,
    TTL_REFRESH_REQUIRED: !(out.r01 && out.r01.ttl_future === true),
    ttlSqlPrepared: true,
    ttlSqlPath: 'preflight-023/TTL-REFRESH-R01.sql',
    executedIn023: false,
  };

  // Ollama RO — no inference
  let psBody = { models: [] };
  let tagsOk = false;
  try {
    psBody = JSON.parse(
      docker(['exec', N8N_CTR, 'wget', '-qO-', '--timeout=10', 'http://rec008-ollama:11434/api/ps']),
    );
  } catch (e) {
    out.issues.push('ollama_ps:' + String(e.message || e).slice(0, 60));
  }
  try {
    const tags = JSON.parse(
      docker(['exec', N8N_CTR, 'wget', '-qO-', '--timeout=10', 'http://rec008-ollama:11434/api/tags']),
    );
    tagsOk = (tags.models || []).some((m) => m.name === 'qwen2.5:1.5b');
  } catch (e) {
    out.issues.push('ollama_tags');
  }
  let mem = { raw: null };
  try {
    mem.raw = docker([
      'stats', 'govsuite-rec008-test-rec008-ollama-1', '--no-stream', '--format', '{{.MemUsage}}',
    ]).trim();
  } catch (_) {}
  const gateEval = evaluateOllamaGate({
    expectedModel: 'qwen2.5:1.5b',
    psBody,
    nowMs: Date.now(),
  });
  out.ollama = {
    modelListed: tagsOk,
    apiPs: psBody,
    gateReady: gateEval.ready,
    gateReason: gateEval.reason,
    memSample: mem.raw,
    inferencePerformed: false,
    warmupRequiredBeforeR01: gateEval.ready !== true,
    warmupProcedure: 'preflight-023/WARMUP-PROCEDURE.md',
  };

  const runnerBuf = fs.readFileSync(path.join(ART, '..', 'run-runtime-013.js'));
  const runnerSha = sha(runnerBuf);
  out.runner = {
    sha256: runnerSha,
    sha021: RUNNER_SHA_021,
    changedSince021: runnerSha !== RUNNER_SHA_021,
    changeNote: 'assertR01 +slotIdPresent before/after (023)',
    hasGate: /evaluateOllamaGate|checkOllamaGate/.test(runnerBuf.toString('utf8')),
    has180: /TIMEOUT_AFTER_WARM_MS/.test(runnerBuf.toString('utf8')),
    hasNoRetry: /retried:\s*false/.test(runnerBuf.toString('utf8')),
    hasClassify: /classifyPostflight/.test(runnerBuf.toString('utf8')),
    hasSlotAssert: /slotIdPresent expected true after R01/.test(runnerBuf.toString('utf8')),
  };

  out.ok = out.issues.length === 0;
  out.gateR01Campaign = 'NO-GO';
  out.gateR01PrepNext = out.ok
    ? out.ttl.TTL_REFRESH_REQUIRED
      ? 'GO-CONDITIONAL-need-TTL-and-warm'
      : out.ollama.warmupRequiredBeforeR01
        ? 'GO-CONDITIONAL-need-warm'
        : 'GO-CONDITIONAL-preflight-fresh'
    : 'NO-GO';

  fs.writeFileSync(path.join(ART, 'PREFLIGHT.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(
    JSON.stringify(
      {
        ok: out.ok,
        issues: out.issues,
        ttl: out.ttl,
        ollama: { gateReady: out.ollama.gateReady, warmupRequired: out.ollama.warmupRequiredBeforeR01 },
        runnerSha: out.runner.sha256,
        gateR01Campaign: out.gateR01Campaign,
      },
      null,
      2,
    ),
  );
  process.exit(out.ok ? 0 : 1);
}

main().catch((e) => {
  out.fatal = String(e.message || e);
  fs.writeFileSync(path.join(ART, 'PREFLIGHT.json'), JSON.stringify(out, null, 2) + '\n');
  console.error(e);
  process.exit(1);
});
