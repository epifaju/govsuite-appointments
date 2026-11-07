const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { execFileSync } = require('child_process');

const envText = fs.readFileSync(
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-30-rec008-phase8e2b2-TEST-DEPLOY/.env.rec008-test.local',
  'utf8'
);
const value = (name) => envText.match(new RegExp('^' + name + '=(.*)$', 'm'))[1];

const base = 'http://127.0.0.1:5682';
const workflowId = 'OCD9It1uKFhOoWNF';
const expectedVersion = 'e84ee0d2-7af9-417e-8d47-0a28580dccac';
const expectedCounter = 6;
const expectedCandidateSha =
  '2263c4bbe906129e89b8ac6b860299d523042c455897c5f7f8426dabcde43c72';
const expectedFinaliserBeforeSha =
  '27b731befac7d1877cbf75b4ad9195089ea6d5bf353409665f07733716e78766';
const expectedFinaliserAfterSha =
  'dfeaf3a439ea362bdf40453d27e25631274bc20ae9eb8d8aecb823a8118a741d';
const expectedGov = '13|14|12|48|0|a2dea067599fd4f0a5f857551adc67cc';
const sessionId = 'rec008-8f2b14-new-01';
const confirmedAttemptId = 'ad71a155-4d3a-45b9-8445-2ec98377feaa';
const abandonedAttemptId = '8ae63b62-9f87-4a15-9011-4554b7766918';
const targetNodeName = 'Finaliser état création';
const candidatePath =
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-31-rec008-phase8f2b21-NON-PUBLIE/candidate-OCD9It1uKFhOoWNF.json';
const outDir =
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-31-rec008-phase8f2b22-FINALIZATION-FIX-INSTALL';

const settingsKeys = new Set([
  'saveExecutionProgress',
  'saveManualExecutions',
  'saveDataErrorExecution',
  'saveDataSuccessExecution',
  'executionTimeout',
  'errorWorkflow',
  'timezone',
  'executionOrder',
  'callerPolicy',
  'callerIds',
  'timeSavedPerExecution',
  'redactionPolicy',
  'availableInMCP',
  'customTelemetryTags',
]);

const protectedNodes = [
  'Décider action tentative',
  'Aiguiller tentative',
  'Réclamer tentative',
  'Appliquer corps gagnant',
  'Appeler CreateAppointment',
  'Classer réponse HTTP',
  'Classer délai HTTP',
  'Paramètres clôture confirmation',
  'Clôturer confirmation',
  'Préparer réponse création',
  'Préparer corps figé',
  'Calculer empreinte du corps',
  'Marquer tentative incertaine',
  "Lorsqu'un message de chat est reçu",
];

function sha(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
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
function urlsOf(nodes) {
  const urls = [];
  const walk = (v) => {
    if (typeof v === 'string' && /^https?:\/\//.test(v)) urls.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  for (const n of nodes || []) walk(n.parameters);
  return urls;
}
function stop(reason, detail) {
  const payload = { ok: false, stopped: true, reason, detail };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'STOP.json'), JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
  process.exit(2);
}
function paramsOf(nodes, name) {
  const n = nodes.find((x) => x.name === name);
  return n ? n.parameters : null;
}
function finaliserCodeSha(parameters) {
  const q = (parameters && parameters.query) || '';
  const r =
    (parameters && parameters.options && parameters.options.queryReplacement) || '';
  return sha(q + '\n' + r);
}
function mockMeta() {
  const probe = `const http=require('http');http.get('http://rec008-mock:8080/_meta/calls',res=>{let b='';res.on('data',c=>b+=c);res.on('end',()=>console.log(b));}).on('error',e=>{console.error(e.code||e.message);process.exit(1);});`;
  const tmp = path.join(outDir, '_mock.js');
  fs.writeFileSync(tmp, probe);
  docker(['cp', tmp, 'govsuite-rec008-test-rec008-n8n-1:/tmp/_mock.js']);
  const text = docker(['exec', 'govsuite-rec008-test-rec008-n8n-1', 'node', '/tmp/_mock.js']).trim();
  docker(['exec', '-u', 'root', 'govsuite-rec008-test-rec008-n8n-1', 'rm', '-f', '/tmp/_mock.js']);
  return JSON.parse(text);
}
function postAppointmentsCount(meta) {
  return Object.entries(meta.byPath || {})
    .filter(([k]) => /^POST \/appointments /.test(k) && !/cancel|reschedule/i.test(k))
    .reduce((n, [, v]) => n + Number(v || 0), 0);
}
function networkOk() {
  const netProbe = fs.readFileSync('C:/Users/epifa/AppData/Local/Temp/rec008-8f1-net.js', 'utf8');
  const tmp = path.join(outDir, '_net.js');
  fs.writeFileSync(tmp, netProbe);
  docker(['cp', tmp, 'govsuite-rec008-test-rec008-n8n-1:/tmp/_net.js']);
  const text = docker(['exec', 'govsuite-rec008-test-rec008-n8n-1', 'node', '/tmp/_net.js']);
  docker(['exec', '-u', 'root', 'govsuite-rec008-test-rec008-n8n-1', 'rm', '-f', '/tmp/_net.js']);
  const net = JSON.parse(text);
  return !(net.results || []).some((r) => r.expect === 'forbidden' && r.tcp === 'open');
}
function pg(sql) {
  return docker([
    'exec', '-i', 'govsuite-rec008-test-rec008-postgres-1',
    'psql', '-U', 'postgres', '-d', 'govsuite_rec008_test',
    '-t', '-A', '-F', '|', '-c', sql,
  ]).trim();
}
function gov() {
  return docker([
    'exec', '-i', 'govsuite-postgres',
    'psql', '-U', 'govsuite', '-d', 'govsuite', '-t', '-A', '-c',
    "SELECT (SELECT count(*) FROM rendez_vous)||'|'||(SELECT count(*) FROM notifications)||'|'||(SELECT count(*) FROM historique_rendez_vous)||'|'||(SELECT count(*) FROM ai_conversation_state)||'|'||(SELECT count(*) FROM ai_appointment_attempt)||'|'||(SELECT md5(string_agg(id::text || '|' || reference || '|' || statut || '|' || creneau_id::text || '|' || updated_at::text, ',' ORDER BY id)) FROM rendez_vous);",
  ]).trim();
}

(async () => {
  if (new URL(base).port !== '5682') throw new Error('mauvais port');
  fs.mkdirSync(outDir, { recursive: true });

  // --- Candidate verification ---
  const candidateRaw = fs.readFileSync(candidatePath);
  const candidateSha = sha(candidateRaw);
  if (candidateSha !== expectedCandidateSha) {
    stop('candidate-sha', { candidateSha, expectedCandidateSha });
  }
  const candidate = JSON.parse(candidateRaw.toString('utf8'));
  if (candidate.nodes.length !== 134 || edgesOf(candidate.connections) !== 137) {
    stop('candidate-graph', {
      nodes: candidate.nodes.length,
      edges: edgesOf(candidate.connections),
    });
  }
  const candFinaliser = candidate.nodes.find((n) => n.name === targetNodeName);
  const candFinaliserSha = finaliserCodeSha(candFinaliser.parameters);
  if (candFinaliserSha !== expectedFinaliserAfterSha) {
    stop('candidate-finaliser-sha', { candFinaliserSha, expectedFinaliserAfterSha });
  }
  const candQuery = candFinaliser.parameters.query || '';
  const candReplacement =
    (candFinaliser.parameters.options && candFinaliser.parameters.options.queryReplacement) || '';
  if (!/NULLIF\(\$3::text,\s*''\)/.test(candQuery) || !/\|\|\s*''\s*\}\}$/.test(candReplacement.replace(/\s+/g, ' '))) {
    // softer check for expected patterns
    if (!candQuery.includes("NULLIF($3::text, '')") || !candReplacement.includes("|| ''")) {
      stop('candidate-finaliser-content', {
        hasNullif3: candQuery.includes("NULLIF($3::text, '')"),
        hasEmptyCoerce: candReplacement.includes("|| ''"),
      });
    }
  }

  // --- Login + live export ---
  const login = await fetch(base + '/rest/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      emailOrLdapLoginId: value('REC008_N8N_OWNER_EMAIL'),
      password: value('REC008_N8N_OWNER_PASSWORD'),
    }),
  });
  const cookie = (login.headers.getSetCookie ? login.headers.getSetCookie() : [])
    .map((i) => i.split(';')[0])
    .join('; ');
  if (login.status !== 200 || !cookie) stop('login', { status: login.status });
  const session = { cookie, accept: 'application/json', 'content-type': 'application/json' };

  let before = null;
  for (let i = 1; i <= 3; i++) {
    const wfJson = await (await fetch(base + '/rest/workflows/' + workflowId, { headers: session })).json();
    before = wfJson.data || null;
    if (before && before.nodes) break;
    await new Promise((r) => setTimeout(r, 1000 * i));
  }
  if (!before || !before.nodes) stop('workflow-fetch', {});

  const beforeText = JSON.stringify(before, null, 2);
  const beforeSha = sha(beforeText);
  fs.writeFileSync(path.join(outDir, 'before-OCD9It1uKFhOoWNF.json'), beforeText);

  const listed =
    (await (await fetch(base + '/rest/workflows?limit=50', { headers: session })).json()).data || [];
  const chat = before.nodes.find((n) => n.name === "Lorsqu'un message de chat est reçu");
  const ollama = before.nodes.find((n) => n.name === 'Ollama Chat Model');
  const postgres = [
    ...new Set(
      before.nodes
        .filter((n) => n.credentials && n.credentials.postgres)
        .map((n) => n.credentials.postgres.id)
    ),
  ];
  const urls = urlsOf(before.nodes);
  const edges = edgesOf(before.connections);
  const mock0 = mockMeta();
  const net = networkOk();
  const pg0 = pg(
    'SELECT (SELECT count(*) FROM rendez_vous),(SELECT count(*) FROM ai_conversation_state),(SELECT count(*) FROM ai_appointment_attempt),(SELECT count(*) FROM notifications);'
  );
  const statuses = pg('SELECT status, count(*) FROM ai_appointment_attempt GROUP BY 1 ORDER BY 1;');
  const open = pg(
    "SELECT count(*) FROM ai_appointment_attempt WHERE status IN ('AWAITING_CONFIRMATION','SUBMITTING','UNCERTAIN');"
  );
  const sessionRow = pg(
    `SELECT coalesce(conversation_step,''), coalesce(last_user_message,''), coalesce(reference,''), coalesce(intent,'') FROM ai_conversation_state WHERE session_id='${sessionId}';`
  );
  const attemptRow = pg(
    `SELECT status, coalesce(appointment_reference,''), (idempotency_key IS NOT NULL), (request_payload IS NOT NULL), coalesce(lease_owner,'') FROM ai_appointment_attempt WHERE id='${confirmedAttemptId}'::uuid;`
  );
  const abandonedRow = pg(
    `SELECT status FROM ai_appointment_attempt WHERE id='${abandonedAttemptId}'::uuid;`
  );
  const gov0 = gov();
  const mail0 = JSON.parse(
    docker(['exec', 'govsuite-mailpit', 'wget', '-qO-', 'http://127.0.0.1:8025/api/v1/info'])
  );

  const liveFinaliser = before.nodes.find((n) => n.name === targetNodeName);
  const liveFinaliserBeforeSha = finaliserCodeSha(liveFinaliser.parameters);

  const preflight = {
    active: before.active,
    activeVersionId: before.activeVersionId || null,
    versionId: before.versionId,
    versionCounter: before.versionCounter,
    nodes: before.nodes.length,
    edges,
    activeIds: listed.filter((r) => r.active).map((r) => r.id),
    chatPublic: chat && chat.parameters && chat.parameters.public === true,
    webhookId: chat && chat.webhookId,
    postgres,
    ollama: ollama && ollama.credentials.ollamaApi.id,
    urlsOk: urls.length === 10 && urls.every((u) => u.startsWith('http://rec008-mock:8080/')),
    networkOk: net,
    liveFinaliserBeforeSha,
    pg: pg0,
    statuses,
    open,
    session: sessionRow,
    attempt: attemptRow,
    abandoned: abandonedRow,
    mock: mock0,
    postAppointments: postAppointmentsCount(mock0),
    gov: gov0,
    mailpit: { messages: mail0.Messages, unread: mail0.Unread, dbSize: mail0.DatabaseSize },
    beforeSha,
  };
  fs.writeFileSync(path.join(outDir, 'PREFLIGHT.json'), JSON.stringify(preflight, null, 2));

  const preOk =
    before.active === false &&
    (before.activeVersionId || null) === null &&
    before.versionId === expectedVersion &&
    before.versionCounter === expectedCounter &&
    before.nodes.length === 134 &&
    edges === 137 &&
    preflight.activeIds.length === 0 &&
    preflight.chatPublic &&
    chat.webhookId === 'a91c4e70-6b18-4f0d-9c55-2e7d8a14b603' &&
    postgres.join() === 'Fs0l0058q5CEadRw' &&
    preflight.ollama === 'dxzHqBq8Q60R8BOz' &&
    preflight.urlsOk &&
    net &&
    liveFinaliserBeforeSha === expectedFinaliserBeforeSha &&
    pg0 === '1|8|2|0' &&
    open === '0' &&
    sessionRow === 'AWAIT_CREATE_CONFIRMATION|oui||CREATE_APPOINTMENT' &&
    attemptRow === 'CONFIRMED|REC008-MOCK-0001|f|f|' &&
    abandonedRow === 'ABANDONED' &&
    postAppointmentsCount(mock0) === 1 &&
    gov0 === expectedGov &&
    mail0.Messages === 5 &&
    mail0.Unread === 2 &&
    mail0.DatabaseSize === 98304;

  if (!preOk) stop('preflight', preflight);

  // --- Diff candidate vs live: only Finaliser parameters allowed ---
  const liveByName = new Map(before.nodes.map((n) => [n.name, n]));
  const candByName = new Map(candidate.nodes.map((n) => [n.name, n]));
  const changed = [];
  const unexpected = [];
  for (const [name, live] of liveByName) {
    const cand = candByName.get(name);
    if (!cand) {
      unexpected.push({ name, issue: 'missing-in-candidate' });
      continue;
    }
    const liveCmp = JSON.stringify({
      type: live.type,
      typeVersion: live.typeVersion,
      webhookId: live.webhookId,
      credentials: live.credentials || null,
      parameters: live.parameters,
      disabled: live.disabled || false,
    });
    const candCmp = JSON.stringify({
      type: cand.type,
      typeVersion: cand.typeVersion,
      webhookId: cand.webhookId,
      credentials: cand.credentials || null,
      parameters: cand.parameters,
      disabled: cand.disabled || false,
    });
    if (liveCmp !== candCmp) {
      changed.push(name);
      if (name !== targetNodeName) {
        unexpected.push({ name, issue: 'unauthorized-diff' });
      } else {
        // Only query + queryReplacement may differ
        const liveP = JSON.parse(JSON.stringify(live.parameters));
        const candP = JSON.parse(JSON.stringify(cand.parameters));
        const liveQ = liveP.query;
        const candQ = candP.query;
        const liveR = liveP.options && liveP.options.queryReplacement;
        const candR = candP.options && candP.options.queryReplacement;
        delete liveP.query;
        delete candP.query;
        if (liveP.options) delete liveP.options.queryReplacement;
        if (candP.options) delete candP.options.queryReplacement;
        // options object may become empty {}
        if (JSON.stringify(liveP) !== JSON.stringify(candP)) {
          unexpected.push({ name, issue: 'non-query-param-diff', liveP, candP });
        }
        if (finaliserCodeSha(live.parameters) !== expectedFinaliserBeforeSha) {
          unexpected.push({ name, issue: 'live-finaliser-before-sha-mismatch' });
        }
        if (finaliserCodeSha(cand.parameters) !== expectedFinaliserAfterSha) {
          unexpected.push({ name, issue: 'cand-finaliser-after-sha-mismatch' });
        }
        if (liveQ === candQ && liveR === candR) {
          unexpected.push({ name, issue: 'no-actual-query-diff' });
        }
      }
    }
  }
  for (const name of candByName.keys()) {
    if (!liveByName.has(name)) unexpected.push({ name, issue: 'extra-in-candidate' });
  }
  if (JSON.stringify(before.connections) !== JSON.stringify(candidate.connections)) {
    stop('connections-changed', {});
  }
  if (unexpected.length) stop('unauthorized-diff', { unexpected, changed });
  if (changed.length !== 1 || changed[0] !== targetNodeName) {
    stop('changed-set', { changed });
  }

  // Protected nodes unchanged between live and candidate
  for (const name of protectedNodes) {
    if (JSON.stringify(paramsOf(before.nodes, name)) !== JSON.stringify(paramsOf(candidate.nodes, name))) {
      stop('protected-changed', { name });
    }
  }

  // Backup metadata + rollback procedure (not executed)
  const backupMeta = {
    exportedAt: new Date().toISOString(),
    path: path.join(outDir, 'before-OCD9It1uKFhOoWNF.json'),
    sha256: beforeSha,
    versionId: before.versionId,
    versionCounter: before.versionCounter,
    active: before.active,
    activeVersionId: before.activeVersionId || null,
    nodes: before.nodes.length,
    edges,
    rollbackProcedure: [
      '1. Keep before-OCD9It1uKFhOoWNF.json as restore source.',
      '2. Under distinct authorization: PUT workflow TEST with nodes/connections/settings from the backup export (name preserved, active false).',
      '3. Verify versionCounter advances, Finaliser SHA returns to ' + expectedFinaliserBeforeSha + '.',
      '4. Do not activate. Do not touch LIVE. Do not reconcile session.',
    ],
  };
  fs.writeFileSync(path.join(outDir, 'BACKUP.json'), JSON.stringify(backupMeta, null, 2));

  // --- Build PUT payload from LIVE + Finaliser params from candidate ---
  const nodes = JSON.parse(JSON.stringify(before.nodes));
  const target = nodes.find((n) => n.name === targetNodeName);
  target.parameters = JSON.parse(JSON.stringify(candByName.get(targetNodeName).parameters));

  const diffs = [];
  for (let i = 0; i < before.nodes.length; i++) {
    if (JSON.stringify(before.nodes[i]) !== JSON.stringify(nodes[i])) {
      diffs.push(nodes[i].name);
    }
  }
  if (diffs.length !== 1 || diffs[0] !== targetNodeName) stop('payload-diff', { diffs });
  if (finaliserCodeSha(target.parameters) !== expectedFinaliserAfterSha) {
    stop('payload-finaliser-sha', { sha: finaliserCodeSha(target.parameters) });
  }
  for (const name of protectedNodes) {
    if (JSON.stringify(paramsOf(before.nodes, name)) !== JSON.stringify(paramsOf(nodes, name))) {
      stop('payload-touched-protected', { name });
    }
  }

  const settings = {};
  for (const [key, setting] of Object.entries(before.settings || {})) {
    if (!settingsKeys.has(key)) stop('settings-key', { key });
    settings[key] = setting;
  }

  const payload = {
    name: before.name,
    nodes,
    connections: before.connections,
    settings,
    staticData: before.staticData === undefined ? null : before.staticData,
    pinData: before.pinData === undefined ? {} : before.pinData,
  };
  if (payload.active) stop('payload-active-true', {});
  const payloadText = JSON.stringify(payload);
  const payloadSha = sha(payloadText);
  fs.writeFileSync(path.join(outDir, 'update-body.json'), payloadText);
  fs.writeFileSync(
    path.join(outDir, 'DIFF.json'),
    JSON.stringify(
      {
        changed: diffs,
        finaliserBeforeSha: liveFinaliserBeforeSha,
        finaliserAfterSha: expectedFinaliserAfterSha,
        candidateSha,
        beforeSha,
        payloadSha,
        queryReplacementBefore:
          liveFinaliser.parameters.options && liveFinaliser.parameters.options.queryReplacement,
        queryReplacementAfter: candReplacement,
        queryTokenLinesBefore: ['reference = $2,', 'token = $3,'],
        queryTokenLinesAfter: ["reference = NULLIF($2::text, ''),", "token = NULLIF($3::text, ''),"],
      },
      null,
      2
    )
  );

  // API key (retry ok) + single PUT (no retry)
  let apiKey = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const keyResponse = await fetch(base + '/rest/api-keys', {
        method: 'POST',
        headers: session,
        body: JSON.stringify({
          label: 'rec008-8f2b22-finaliser-install-' + attempt,
          scopes: ['workflow:read', 'workflow:update'],
          expiresAt: Date.now() + 2 * 60 * 60 * 1000,
        }),
      });
      const keyJson = await keyResponse.json();
      apiKey =
        keyJson.rawApiKey ||
        keyJson.apiKey ||
        (keyJson.data && (keyJson.data.rawApiKey || keyJson.data.apiKey));
      if (apiKey) break;
    } catch (e) {
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  if (!apiKey) stop('api-key', {});

  const put = await fetch(base + '/api/v1/workflows/' + workflowId, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': apiKey,
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: payloadText,
  });
  const putText = await put.text();
  let putJson = {};
  try {
    putJson = JSON.parse(putText);
  } catch {
    putJson = { message: putText.slice(0, 400) };
  }
  fs.writeFileSync(
    path.join(outDir, 'put-response.json'),
    JSON.stringify({ status: put.status, body: putJson }, null, 2)
  );

  const after = (
    await (await fetch(base + '/rest/workflows/' + workflowId, { headers: session })).json()
  ).data;
  const afterListed =
    (await (await fetch(base + '/rest/workflows?limit=50', { headers: session })).json()).data || [];
  const afterText = JSON.stringify(after, null, 2);
  const afterSha = sha(afterText);
  fs.writeFileSync(path.join(outDir, 'after-OCD9It1uKFhOoWNF.json'), afterText);

  if (put.status !== 200) {
    stop('put-failed', {
      status: put.status,
      message: putJson.message || null,
      afterActive: after && after.active,
      afterVersionId: after && after.versionId,
      afterCounter: after && after.versionCounter,
    });
  }

  const afterFinaliser = after.nodes.find((n) => n.name === targetNodeName);
  const afterFinaliserSha = finaliserCodeSha(afterFinaliser.parameters);
  const parameterDiffs = [];
  const credentialDiffs = [];
  for (let i = 0; i < before.nodes.length; i++) {
    const bn = before.nodes[i];
    const an = after.nodes.find((n) => n.name === bn.name) || after.nodes[i];
    if (JSON.stringify(bn.parameters) !== JSON.stringify(an.parameters)) {
      parameterDiffs.push(an.name);
    }
    if (JSON.stringify(bn.credentials || null) !== JSON.stringify(an.credentials || null)) {
      credentialDiffs.push(an.name);
    }
    if (bn.webhookId !== an.webhookId) {
      credentialDiffs.push('webhook ' + an.name);
    }
  }

  let webhooks = null;
  const webhookFile = 'C:/Users/epifa/AppData/Local/Temp/rec008-8f1-webhooks.js';
  if (fs.existsSync(webhookFile)) {
    docker(['cp', webhookFile, 'govsuite-rec008-test-rec008-n8n-1:/tmp/rec008-8f1-webhooks.js']);
    try {
      webhooks = JSON.parse(
        docker(['exec', 'govsuite-rec008-test-rec008-n8n-1', 'node', '/tmp/rec008-8f1-webhooks.js'])
      );
    } catch (e) {
      webhooks = { error: String(e.message || e).slice(0, 200) };
    }
    docker([
      'exec', '-u', 'root', 'govsuite-rec008-test-rec008-n8n-1',
      'rm', '-f', '/tmp/rec008-8f1-webhooks.js',
    ]);
  }

  const pg1 = pg(
    'SELECT (SELECT count(*) FROM rendez_vous),(SELECT count(*) FROM ai_conversation_state),(SELECT count(*) FROM ai_appointment_attempt),(SELECT count(*) FROM notifications);'
  );
  const session1 = pg(
    `SELECT coalesce(conversation_step,''), coalesce(last_user_message,''), coalesce(reference,''), coalesce(intent,'') FROM ai_conversation_state WHERE session_id='${sessionId}';`
  );
  const attempt1 = pg(
    `SELECT status, coalesce(appointment_reference,''), (idempotency_key IS NOT NULL), (request_payload IS NOT NULL), coalesce(lease_owner,'') FROM ai_appointment_attempt WHERE id='${confirmedAttemptId}'::uuid;`
  );
  const gov1 = gov();
  const mock1 = mockMeta();
  const mail1 = JSON.parse(
    docker(['exec', 'govsuite-mailpit', 'wget', '-qO-', 'http://127.0.0.1:8025/api/v1/info'])
  );

  const afterChat = after.nodes.find((n) => n.name === "Lorsqu'un message de chat est reçu");
  const installedMatchesCandidate =
    afterFinaliserSha === expectedFinaliserAfterSha &&
    (afterFinaliser.parameters.query || '') === candQuery &&
    ((afterFinaliser.parameters.options && afterFinaliser.parameters.options.queryReplacement) ||
      '') === candReplacement;

  const settingsUnchanged =
    JSON.stringify(before.settings || {}) === JSON.stringify(after.settings || {});

  const result = {
    ok: true,
    phase: '8F-2B22',
    putStatus: put.status,
    putMessage: putJson.message || null,
    putCount: 1,
    candidateSha,
    beforeSha,
    payloadSha,
    afterSha,
    afterFinaliserSha,
    finaliserMatch: installedMatchesCandidate,
    newVersionId: after.versionId,
    newVersionCounter: after.versionCounter,
    preflight,
    after: {
      active: after.active,
      activeVersionId: after.activeVersionId || null,
      versionId: after.versionId,
      versionCounter: after.versionCounter,
      nodes: after.nodes.length,
      edges: edgesOf(after.connections),
      activeIds: afterListed.filter((r) => r.active).map((r) => r.id),
      chatPublic: afterChat && afterChat.parameters && afterChat.parameters.public,
      webhookId: afterChat && afterChat.webhookId,
      postgres: [
        ...new Set(
          after.nodes
            .filter((n) => n.credentials && n.credentials.postgres)
            .map((n) => n.credentials.postgres.id)
        ),
      ],
      ollama: after.nodes.find((n) => n.name === 'Ollama Chat Model').credentials.ollamaApi.id,
      urlsOk: urlsOf(after.nodes).every((u) => u.startsWith('http://rec008-mock:8080/')),
      urlsCount: urlsOf(after.nodes).length,
      parameterDiffs,
      credentialDiffs,
      connectionsUnchanged:
        JSON.stringify(before.connections) === JSON.stringify(after.connections),
      settingsUnchanged,
      webhooksRows: webhooks && webhooks.rows ? webhooks.rows.length : null,
      queryHasNullif3: /NULLIF\(\$3::text,\s*''\)/.test(afterFinaliser.parameters.query || ''),
      queryReplacementHasEmptyCoerce: ((afterFinaliser.parameters.options &&
        afterFinaliser.parameters.options.queryReplacement) ||
        ''
      ).includes("|| ''"),
    },
    postflight: {
      pg: pg1,
      session: session1,
      attempt: attempt1,
      gov: gov1,
      mock: mock1,
      postAppointments: postAppointmentsCount(mock1),
      mailpit: {
        messages: mail1.Messages,
        unread: mail1.Unread,
        dbSize: mail1.DatabaseSize,
      },
    },
  };

  try {
    fs.unlinkSync(path.join(outDir, '_mock.js'));
  } catch {}
  try {
    fs.unlinkSync(path.join(outDir, '_net.js'));
  } catch {}

  const pass =
    put.status === 200 &&
    after.active === false &&
    (after.activeVersionId || null) === null &&
    after.versionId !== expectedVersion &&
    after.versionCounter === expectedCounter + 1 &&
    after.nodes.length === 134 &&
    edgesOf(after.connections) === 137 &&
    parameterDiffs.length === 1 &&
    parameterDiffs[0] === targetNodeName &&
    credentialDiffs.length === 0 &&
    installedMatchesCandidate &&
    result.after.activeIds.length === 0 &&
    result.after.webhooksRows === 0 &&
    result.after.urlsOk &&
    result.after.postgres.join() === 'Fs0l0058q5CEadRw' &&
    settingsUnchanged &&
    result.after.connectionsUnchanged &&
    pg1 === '1|8|2|0' &&
    session1 === sessionRow &&
    attempt1 === attemptRow &&
    gov1 === expectedGov &&
    postAppointmentsCount(mock1) === 1 &&
    mail1.Messages === 5 &&
    mail1.Unread === 2 &&
    mail1.DatabaseSize === 98304;

  result.pass = !!pass;
  result.verdict = pass ? 'PASS' : 'FAIL';
  result.goRuntime = pass ? 'GO' : 'NO-GO';

  fs.writeFileSync(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  process.exit(pass ? 0 : 4);
})().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
