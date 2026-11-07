/**
 * P4F — installation unique TEST (inactif). Aucun chat / activation / métier.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const envText = fs.readFileSync(
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-30-rec008-phase8e2b2-TEST-DEPLOY/.env.rec008-test.local',
  'utf8'
);
const v = (n) => envText.match(new RegExp('^' + n + '=(.*)$', 'm'))[1];
const base = 'http://127.0.0.1:5682';
const workflowId = 'OCD9It1uKFhOoWNF';
const expectedVersionId = 'e1b32992-bc68-46af-86ce-c80af46f5305';
const expectedCounter = 8;
const expectedFinaliserSha =
  '3fc500bfed99c202156005d252a864cdc25514c93e7e47c842ae896381e8ee7a';
const expectedGov = '13|14|12|48|0|a2dea067599fd4f0a5f857551adc67cc';
const outDir = __dirname;

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

const TARGETS = [
  'Charger état conversation',
  'Joindre tentative de session',
  'Parser intention',
  'Gérer collecte progressive',
  'Réponse générale',
  'Sauvegarder état conversation',
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
function finaliserCodeSha(parameters) {
  return sha(
    ((parameters && parameters.query) || '') +
      '\n' +
      ((parameters && parameters.options && parameters.options.queryReplacement) || '')
  );
}
function nodeParamsSha(n) {
  return sha(JSON.stringify((n && n.parameters) || {}));
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
function mockMeta() {
  const probe =
    "const http=require('http');http.get('http://rec008-mock:8080/_meta/calls',res=>{let b='';res.on('data',c=>b+=c);res.on('end',()=>console.log(b));});";
  const tmp = path.join(outDir, '_mock.js');
  fs.writeFileSync(tmp, probe);
  docker(['cp', tmp, 'govsuite-rec008-test-rec008-n8n-1:/tmp/_m4fi.js']);
  const t = docker(['exec', 'govsuite-rec008-test-rec008-n8n-1', 'node', '/tmp/_m4fi.js']).trim();
  docker(['exec', '-u', 'root', 'govsuite-rec008-test-rec008-n8n-1', 'rm', '-f', '/tmp/_m4fi.js']);
  try { fs.unlinkSync(tmp); } catch (_) {}
  return JSON.parse(t);
}
function postCount(meta) {
  return Object.entries(meta.byPath || {})
    .filter(([k]) => /^POST \/appointments /.test(k) && !/cancel|reschedule/i.test(k))
    .reduce((n, [, v]) => n + Number(v || 0), 0);
}
function pathCount(meta, key) {
  return Number((meta.byPath && meta.byPath[key]) || 0);
}
function stop(reason, detail) {
  const payload = { ok: false, stopped: true, phase: 'install', reason, detail };
  fs.writeFileSync(path.join(outDir, 'STOP.json'), JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
  process.exit(2);
}

(async () => {
  if (new URL(base).port !== '5682') stop('bad-port', {});

  for (const f of [
    'PREFLIGHT.json',
    'BACKUP.json',
    'PATCH_VALIDATION.json',
    'CANDIDATE_OFFLINE_TEST_RESULTS.json',
    'candidate-OCD9It1uKFhOoWNF.json',
    'before-OCD9It1uKFhOoWNF.json',
  ]) {
    if (!fs.existsSync(path.join(outDir, f))) stop('missing-artefact', { f });
  }
  const preflight = JSON.parse(fs.readFileSync(path.join(outDir, 'PREFLIGHT.json'), 'utf8'));
  const patchVal = JSON.parse(fs.readFileSync(path.join(outDir, 'PATCH_VALIDATION.json'), 'utf8'));
  const tests = JSON.parse(
    fs.readFileSync(path.join(outDir, 'CANDIDATE_OFFLINE_TEST_RESULTS.json'), 'utf8')
  );
  if (!preflight.preflightOk) stop('preflight-not-ok', {});
  if (!patchVal.ok) stop('patch-not-ok', {});
  if (!tests.allPass) stop('tests-not-ok', tests);

  const candidate = JSON.parse(
    fs.readFileSync(path.join(outDir, 'candidate-OCD9It1uKFhOoWNF.json'), 'utf8')
  );
  const candidateSha = sha(fs.readFileSync(path.join(outDir, 'candidate-OCD9It1uKFhOoWNF.json')));
  if (candidateSha !== patchVal.candidateSha) stop('candidate-sha-mismatch', { candidateSha });

  const login = await fetch(base + '/rest/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      emailOrLdapLoginId: v('REC008_N8N_OWNER_EMAIL'),
      password: v('REC008_N8N_OWNER_PASSWORD'),
    }),
  });
  if (!login.ok) stop('login', { status: login.status });
  const cookie = (login.headers.getSetCookie ? login.headers.getSetCookie() : [])
    .map((i) => i.split(';')[0])
    .join('; ');
  const session = { cookie, accept: 'application/json', 'content-type': 'application/json' };

  const remote = (
    await (await fetch(base + '/rest/workflows/' + workflowId, { headers: session })).json()
  ).data;
  if (remote.active === true || remote.activeVersionId) {
    stop('remote-active', { active: remote.active, activeVersionId: remote.activeVersionId });
  }
  if (remote.versionId !== expectedVersionId || Number(remote.versionCounter) !== expectedCounter) {
    stop('remote-version-drift', {
      versionId: remote.versionId,
      versionCounter: remote.versionCounter,
    });
  }

  const candByName = new Map(candidate.nodes.map((n) => [n.name, n]));
  const nodes = JSON.parse(JSON.stringify(remote.nodes));
  for (const name of TARGETS) {
    const target = nodes.find((n) => n.name === name);
    const cand = candByName.get(name);
    if (!target || !cand) stop('missing-node', { name });
    target.parameters = JSON.parse(JSON.stringify(cand.parameters));
  }

  const changed = [];
  for (let i = 0; i < remote.nodes.length; i++) {
    if (JSON.stringify(remote.nodes[i].parameters) !== JSON.stringify(nodes[i].parameters)) {
      changed.push(nodes[i].name);
    }
    if (
      JSON.stringify(remote.nodes[i].credentials || null) !==
      JSON.stringify(nodes[i].credentials || null)
    ) {
      stop('credential-touch', { name: nodes[i].name });
    }
  }
  if (JSON.stringify([...changed].sort()) !== JSON.stringify([...TARGETS].sort())) {
    stop('payload-diff', { changed });
  }

  const finaliser = nodes.find((n) => n.name === 'Finaliser état création');
  if (finaliserCodeSha(finaliser.parameters) !== expectedFinaliserSha) {
    stop('finaliser-sha', {});
  }

  const settings = {};
  for (const [key, setting] of Object.entries(remote.settings || {})) {
    if (!settingsKeys.has(key)) stop('settings-key', { key });
    settings[key] = setting;
  }

  const payload = {
    name: remote.name,
    nodes,
    connections: remote.connections,
    settings,
    staticData: remote.staticData === undefined ? null : remote.staticData,
    pinData: remote.pinData === undefined ? {} : remote.pinData,
  };
  if (payload.active) stop('payload-active', {});
  const payloadText = JSON.stringify(payload);
  const payloadSha = sha(payloadText);
  fs.writeFileSync(path.join(outDir, 'update-body.json'), payloadText);

  let apiKey = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const keyResponse = await fetch(base + '/rest/api-keys', {
      method: 'POST',
      headers: session,
      body: JSON.stringify({
        label: 'rec008-8f2b49-p4f-install-' + attempt,
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
  }
  if (!apiKey) stop('api-key', {});

  // Exactly one PUT — no blind retry
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
  const afterText = JSON.stringify(after, null, 2);
  const afterSha = sha(afterText);
  fs.writeFileSync(path.join(outDir, 'after-OCD9It1uKFhOoWNF.json'), afterText);

  const activeList = await (await fetch(base + '/rest/active-workflows', { headers: session })).json();
  const activeIds = (activeList.data || activeList || []).map((x) => x.id || x).filter(Boolean);

  if (put.status !== 200) {
    stop('put-failed', {
      status: put.status,
      message: putJson.message || null,
      afterVersionId: after && after.versionId,
      afterCounter: after && after.versionCounter,
      afterActive: after && after.active,
    });
  }

  const afterNodeShas = {};
  const candNodeShas = {};
  for (const name of TARGETS) {
    const an = after.nodes.find((n) => n.name === name);
    const cn = candidate.nodes.find((n) => n.name === name);
    afterNodeShas[name] = nodeParamsSha(an);
    candNodeShas[name] = nodeParamsSha(cn);
  }
  const shasMatch = TARGETS.every((name) => afterNodeShas[name] === candNodeShas[name]);
  const afterFinaliserSha = finaliserCodeSha(
    after.nodes.find((n) => n.name === 'Finaliser état création').parameters
  );
  const urls = urlsOf(after.nodes);
  const postgresIds = [
    ...new Set(
      after.nodes
        .filter((n) => n.credentials && n.credentials.postgres)
        .map((n) => n.credentials.postgres.id)
    ),
  ];

  const hasFixA = /session_expired/.test(
    after.nodes.find((n) => n.name === 'Charger état conversation').parameters.query
  );
  const hasFixB =
    /P4E\/P4F START PARSER/.test(
      after.nodes.find((n) => n.name === 'Parser intention').parameters.jsCode
    ) &&
    /P4E\/P4F START GERER/.test(
      after.nodes.find((n) => n.name === 'Gérer collecte progressive').parameters.jsCode
    ) &&
    /session_expired/.test(
      after.nodes.find((n) => n.name === 'Réponse générale').parameters.jsCode
    );
  const hasFixC = /authorized_nulls/.test(
    after.nodes.find((n) => n.name === 'Sauvegarder état conversation').parameters.query
  );

  const pg1 = pg(
    'SELECT (SELECT count(*) FROM rendez_vous),(SELECT count(*) FROM ai_conversation_state),(SELECT count(*) FROM ai_appointment_attempt),(SELECT count(*) FROM notifications);'
  );
  const open1 = pg(
    "SELECT count(*) FROM ai_appointment_attempt WHERE status IN ('AWAITING_CONFIRMATION','SUBMITTING','UNCERTAIN');"
  );
  const gov1 = gov();
  const mock1 = mockMeta();
  const mail1 = JSON.parse(
    docker(['exec', 'govsuite-mailpit', 'wget', '-qO-', 'http://127.0.0.1:8025/api/v1/info'])
  );

  const settingsUnchanged =
    JSON.stringify(remote.settings || {}) === JSON.stringify(after.settings || {});
  const connectionsUnchanged =
    JSON.stringify(remote.connections) === JSON.stringify(after.connections);

  const result = {
    ok:
      after.active === false &&
      !after.activeVersionId &&
      activeIds.length === 0 &&
      after.nodes.length === 134 &&
      edgesOf(after.connections) === 137 &&
      shasMatch &&
      afterFinaliserSha === expectedFinaliserSha &&
      hasFixA &&
      hasFixB &&
      hasFixC &&
      urls.length === 10 &&
      urls.every((u) => u.startsWith('http://rec008-mock:8080/')) &&
      postgresIds.length === 1 &&
      postgresIds[0] === 'Fs0l0058q5CEadRw' &&
      settingsUnchanged &&
      connectionsUnchanged &&
      pg1 === '1|11|4|0' &&
      open1 === '0' &&
      gov1 === expectedGov &&
      postCount(mock1) === 0 &&
      pathCount(mock1, 'GET /appointments/availability 200') === 0 &&
      pathCount(mock1, 'GET /services 200') === 0 &&
      mock1.scenario === 'created' &&
      mail1.Messages === 5 &&
      mail1.Unread === 2 &&
      mail1.DatabaseSize === 98304,
    phase: '8F-2B49-P4F',
    putStatus: put.status,
    putCount: 1,
    putMessage: putJson.message || null,
    candidateSha,
    payloadSha,
    afterSha,
    previousVersionId: expectedVersionId,
    previousVersionCounter: expectedCounter,
    newVersionId: after.versionId,
    newVersionCounter: Number(after.versionCounter),
    after: {
      active: after.active === true,
      activeVersionId: after.activeVersionId || null,
      activeIds,
      nodes: after.nodes.length,
      edges: edgesOf(after.connections),
      finaliserSha: afterFinaliserSha,
      hasFixA,
      hasFixB,
      hasFixC,
      afterNodeShas,
      candNodeShas,
      shasMatch,
      urlsOk: urls.every((u) => u.startsWith('http://rec008-mock:8080/')),
      urlsCount: urls.length,
      postgresIds,
      settingsUnchanged,
      connectionsUnchanged,
      pg: pg1,
      open: open1,
      mockPosts: postCount(mock1),
      getAvailability: pathCount(mock1, 'GET /appointments/availability 200'),
      getServices: pathCount(mock1, 'GET /services 200'),
      mockScenario: mock1.scenario,
      gov: gov1,
      mailpit: {
        messages: mail1.Messages,
        unread: mail1.Unread,
        dbSize: mail1.DatabaseSize,
      },
    },
  };

  fs.writeFileSync(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(2);
})().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
