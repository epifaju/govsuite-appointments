/**
 * P4F préflight bloquant + sauvegarde avant installation (lecture + export uniquement).
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
function nodeSha(n) {
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
  docker(['cp', tmp, 'govsuite-rec008-test-rec008-n8n-1:/tmp/_m4f.js']);
  const t = docker(['exec', 'govsuite-rec008-test-rec008-n8n-1', 'node', '/tmp/_m4f.js']).trim();
  docker(['exec', '-u', 'root', 'govsuite-rec008-test-rec008-n8n-1', 'rm', '-f', '/tmp/_m4f.js']);
  try { fs.unlinkSync(tmp); } catch (_) {}
  return JSON.parse(t);
}
function pathCount(meta, key) {
  return Number((meta.byPath && meta.byPath[key]) || 0);
}
function postCount(meta) {
  return Object.entries(meta.byPath || {})
    .filter(([k]) => /^POST \/appointments /.test(k) && !/cancel|reschedule/i.test(k))
    .reduce((n, [, v]) => n + Number(v || 0), 0);
}
function networkOk() {
  const netProbe = fs.readFileSync(path.join(outDir, 'net-probe.js'), 'utf8');
  const tmp = path.join(outDir, '_net.js');
  fs.writeFileSync(tmp, netProbe);
  docker(['cp', tmp, 'govsuite-rec008-test-rec008-n8n-1:/tmp/_net4f.js']);
  const text = docker(['exec', 'govsuite-rec008-test-rec008-n8n-1', 'node', '/tmp/_net4f.js']);
  docker(['exec', '-u', 'root', 'govsuite-rec008-test-rec008-n8n-1', 'rm', '-f', '/tmp/_net4f.js']);
  try { fs.unlinkSync(tmp); } catch (_) {}
  const net = JSON.parse(text);
  return {
    ok: !(net.results || []).some((r) => r.expect === 'forbidden' && r.tcp === 'open'),
    net,
  };
}
function stop(reason, detail) {
  const payload = { ok: false, stopped: true, phase: 'preflight', reason, detail };
  fs.writeFileSync(path.join(outDir, 'STOP.json'), JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
  process.exit(2);
}

(async () => {
  if (new URL(base).port !== '5682') stop('bad-port', {});
  const at = new Date().toISOString();

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
  const h = { cookie, accept: 'application/json' };

  const wf = ((await (await fetch(base + '/rest/workflows/' + workflowId, { headers: h })).json()).data);
  const activeList = await (await fetch(base + '/rest/active-workflows', { headers: h })).json();
  const activeIds = (activeList.data || activeList || []).map((x) => x.id || x).filter(Boolean);
  const nodes = wf.nodes || [];
  const finaliser = nodes.find((n) => n.name === 'Finaliser état création');
  const finaliserSha = finaliserCodeSha(finaliser && finaliser.parameters);
  const urls = urlsOf(nodes);
  const postgresIds = [
    ...new Set(
      nodes
        .filter((n) => n.credentials && n.credentials.postgres)
        .map((n) => n.credentials.postgres.id)
    ),
  ];
  const ollama = nodes.find((n) => n.name === 'Ollama Chat Model');
  const mock = mockMeta();
  const mail = JSON.parse(
    docker(['exec', 'govsuite-mailpit', 'wget', '-qO-', 'http://127.0.0.1:8025/api/v1/info'])
  );
  const pgCounts = pg(
    'SELECT (SELECT count(*) FROM rendez_vous),(SELECT count(*) FROM ai_conversation_state),(SELECT count(*) FROM ai_appointment_attempt),(SELECT count(*) FROM notifications);'
  );
  const open = pg(
    "SELECT count(*) FROM ai_appointment_attempt WHERE status IN ('AWAITING_CONFIRMATION','SUBMITTING','UNCERTAIN');"
  );
  const govFp = gov();
  const net = networkOk();

  const targetNames = [
    'Charger état conversation',
    'Joindre tentative de session',
    'Parser intention',
    'Gérer collecte progressive',
    'Réponse générale',
    'Sauvegarder état conversation',
    'Finaliser état création',
  ];
  const nodeShas = {};
  for (const name of targetNames) {
    const n = nodes.find((x) => x.name === name);
    nodeShas[name] = n ? nodeSha(n) : null;
  }

  const expected = {
    active: false,
    activeVersionId: null,
    versionId: expectedVersionId,
    versionCounter: expectedCounter,
    nodes: 134,
    edges: 137,
    finaliserSha: expectedFinaliserSha,
    pg: '1|11|4|0',
    open: '0',
    mockPosts: 0,
    getAvailability: 0,
    getServices: 0,
    mockScenario: 'created',
    gov: expectedGov,
    mailpit: { messages: 5, unread: 2, dbSize: 98304 },
    urlsCount: 10,
    postgresId: 'Fs0l0058q5CEadRw',
  };

  const observed = {
    active: wf.active === true,
    activeVersionId: wf.activeVersionId || null,
    versionId: wf.versionId,
    versionCounter: Number(wf.versionCounter),
    nodes: nodes.length,
    edges: edgesOf(wf.connections),
    finaliserSha,
    activeIds,
    pg: pgCounts,
    open,
    mockPosts: postCount(mock),
    getAvailability: pathCount(mock, 'GET /appointments/availability 200'),
    getServices: pathCount(mock, 'GET /services 200'),
    mockScenario: mock.scenario,
    gov: govFp,
    mailpit: { messages: mail.Messages, unread: mail.Unread, dbSize: mail.DatabaseSize },
    urls,
    urlsOk: urls.length === 10 && urls.every((u) => u.startsWith('http://rec008-mock:8080/')),
    postgresIds,
    ollamaId: ollama && ollama.credentials && ollama.credentials.ollamaApi.id,
    networkOk: net.ok,
    settings: {
      saveDataSuccessExecution: (wf.settings || {}).saveDataSuccessExecution,
      saveDataErrorExecution: (wf.settings || {}).saveDataErrorExecution,
      saveManualExecutions: (wf.settings || {}).saveManualExecutions,
      saveExecutionProgress: (wf.settings || {}).saveExecutionProgress,
    },
    nodeShas,
  };

  const checks = {
    inactive: observed.active === false && observed.activeVersionId === null,
    versionId: observed.versionId === expected.versionId,
    versionCounter: observed.versionCounter === expected.versionCounter,
    graph: observed.nodes === 134 && observed.edges === 137,
    finaliserSha: observed.finaliserSha === expected.finaliserSha,
    pg: observed.pg === expected.pg,
    open: observed.open === expected.open,
    mockPosts: observed.mockPosts === 0,
    getAvailability: observed.getAvailability === 0,
    getServices: observed.getServices === 0,
    mockScenario: observed.mockScenario === 'created',
    live: observed.gov === expected.gov,
    mailpit:
      observed.mailpit.messages === 5 &&
      observed.mailpit.unread === 2 &&
      observed.mailpit.dbSize === 98304,
    urlsOk: observed.urlsOk,
    credentialsTest:
      postgresIds.length === 1 && postgresIds[0] === 'Fs0l0058q5CEadRw',
    networkOk: observed.networkOk,
    noOtherActive: activeIds.length === 0,
  };

  const preflightOk = Object.values(checks).every(Boolean);
  const preflight = {
    phase: '8F-2B49-P4F',
    at,
    expected,
    observed,
    checks,
    preflightOk,
    stop: !preflightOk,
  };
  fs.writeFileSync(path.join(outDir, 'PREFLIGHT.json'), JSON.stringify(preflight, null, 2));
  if (!preflightOk) stop('preflight-failed', { checks, observed });

  const beforeText = JSON.stringify(wf, null, 2);
  const beforeSha = sha(beforeText);
  fs.writeFileSync(path.join(outDir, 'before-OCD9It1uKFhOoWNF.json'), beforeText);
  const backup = {
    phase: '8F-2B49-P4F',
    at,
    workflowId,
    versionId: wf.versionId,
    versionCounter: wf.versionCounter,
    active: wf.active,
    activeVersionId: wf.activeVersionId || null,
    jsonSha256: beforeSha,
    nodes: nodes.length,
    edges: edgesOf(wf.connections),
    finaliserSha,
    nodeShas,
    settings: wf.settings || {},
    credentialsReferenced: {
      postgres: postgresIds,
      ollama: observed.ollamaId,
    },
    urls,
    chatTrigger: (() => {
      const c = nodes.find((n) => n.name === "Lorsqu'un message de chat est reçu");
      return c
        ? { webhookId: c.webhookId || null, parameters: c.parameters || null }
        : null;
    })(),
  };
  fs.writeFileSync(path.join(outDir, 'BACKUP.json'), JSON.stringify(backup, null, 2));
  console.log(JSON.stringify({ preflightOk: true, beforeSha, versionId: wf.versionId, versionCounter: wf.versionCounter }, null, 2));
})().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
