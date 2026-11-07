/**
 * REC-008 phase 8F-2B49 — préflight lecture seule (aucune activation, chat, PUT, SQL, mock).
 */
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
const outDir =
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-11-01-rec008-phase8f2b49-EDIT-SCENARIO-PREPARATION';

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
function finaliserCodeSha(parameters) {
  return sha(
    ((parameters && parameters.query) || '') +
      '\n' +
      ((parameters && parameters.options && parameters.options.queryReplacement) || '')
  );
}
function pg(sql) {
  return docker([
    'exec',
    '-i',
    'govsuite-rec008-test-rec008-postgres-1',
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
function gov() {
  return docker([
    'exec',
    '-i',
    'govsuite-postgres',
    'psql',
    '-U',
    'govsuite',
    '-d',
    'govsuite',
    '-t',
    '-A',
    '-c',
    "SELECT (SELECT count(*) FROM rendez_vous)||'|'||(SELECT count(*) FROM notifications)||'|'||(SELECT count(*) FROM historique_rendez_vous)||'|'||(SELECT count(*) FROM ai_conversation_state)||'|'||(SELECT count(*) FROM ai_appointment_attempt)||'|'||(SELECT md5(string_agg(id::text || '|' || reference || '|' || statut || '|' || creneau_id::text || '|' || updated_at::text, ',' ORDER BY id)) FROM rendez_vous);",
  ]).trim();
}
function mockMeta() {
  const probe =
    "const http=require('http');http.get('http://rec008-mock:8080/_meta/calls',res=>{let b='';res.on('data',c=>b+=c);res.on('end',()=>console.log(b));});";
  const tmp = path.join(outDir, '_mock.js');
  fs.writeFileSync(tmp, probe);
  docker(['cp', tmp, 'govsuite-rec008-test-rec008-n8n-1:/tmp/_m48.js']);
  const t = docker(['exec', 'govsuite-rec008-test-rec008-n8n-1', 'node', '/tmp/_m48.js']).trim();
  docker(['exec', '-u', 'root', 'govsuite-rec008-test-rec008-n8n-1', 'rm', '-f', '/tmp/_m48.js']);
  try {
    fs.unlinkSync(tmp);
  } catch (_) {}
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

(async () => {
  const at = new Date().toISOString();

  const login = await fetch(base + '/rest/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      emailOrLdapLoginId: v('REC008_N8N_OWNER_EMAIL'),
      password: v('REC008_N8N_OWNER_PASSWORD'),
    }),
  });
  if (!login.ok) throw new Error('login failed ' + login.status);
  const cookie = (login.headers.getSetCookie ? login.headers.getSetCookie() : [])
    .map((i) => i.split(';')[0])
    .join('; ');
  const h = { cookie, accept: 'application/json' };

  const wfRes = await fetch(base + '/rest/workflows/' + workflowId, { headers: h });
  const wfBody = await wfRes.json();
  const wf = wfBody.data || wfBody;
  const nodes = wf.nodes || [];
  const finaliser = nodes.find((n) => n.name === 'Finaliser état création');
  const finaliserSha = finaliserCodeSha(finaliser && finaliser.parameters);
  const qr =
    (finaliser &&
      finaliser.parameters &&
      finaliser.parameters.options &&
      finaliser.parameters.options.queryReplacement) ||
    '';
  const q = (finaliser && finaliser.parameters && finaliser.parameters.query) || '';
  const settings = wf.settings || {};
  const activeList = await (await fetch(base + '/rest/active-workflows', { headers: h })).json();
  const activeIds = (activeList.data || activeList || []).map((x) => x.id || x).filter(Boolean);

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
  const statusCounts = pg(
    "SELECT status || '|' || count(*)::text FROM ai_appointment_attempt GROUP BY status ORDER BY status;"
  )
    .split(/\r?\n/)
    .filter(Boolean);
  const govFp = gov();

  const expected = {
    active: false,
    activeVersionId: null,
    versionId: expectedVersionId,
    versionCounter: expectedCounter,
    nodes: 134,
    edges: 137,
    finaliserSha: expectedFinaliserSha,
    pg: '1|10|4|0',
    open: '0',
    mockPosts: 1,
    gov: expectedGov,
    mailpit: { messages: 5, unread: 2, dbSize: 98304 },
  };

  const observed = {
    active: wf.active === true,
    activeVersionId: wf.activeVersionId || null,
    versionId: wf.versionId,
    versionCounter: Number(wf.versionCounter),
    nodes: nodes.length,
    edges: edgesOf(wf.connections),
    finaliserSha,
    finaliserHasAbsent: /__ABSENT__/.test(qr),
    finaliserHasUuidCast: /::uuid/.test(q),
    activeIds,
    pg: pgCounts,
    open,
    statusCounts,
    mockPosts: postCount(mock),
    getAvailability: pathCount(mock, 'GET /appointments/availability 200'),
    post201: pathCount(mock, 'POST /appointments 201'),
    mockScenario: mock.scenario,
    gov: govFp,
    mailpit: {
      messages: mail.Messages,
      unread: mail.Unread,
      dbSize: mail.DatabaseSize,
    },
    saveDataSuccessExecution: settings.saveDataSuccessExecution,
    saveDataErrorExecution: settings.saveDataErrorExecution,
    saveManualExecutions: settings.saveManualExecutions,
    saveExecutionProgress: settings.saveExecutionProgress,
  };

  const checks = {
    inactive: observed.active === false && observed.activeVersionId === null,
    versionId: observed.versionId === expected.versionId,
    versionCounter: observed.versionCounter === expected.versionCounter,
    graph: observed.nodes === expected.nodes && observed.edges === expected.edges,
    finaliserSha: observed.finaliserSha === expected.finaliserSha,
    pg: observed.pg === expected.pg,
    open: observed.open === expected.open,
    mockPosts: observed.mockPosts === expected.mockPosts,
    live: observed.gov === expected.gov,
    mailpit:
      observed.mailpit.messages === expected.mailpit.messages &&
      observed.mailpit.unread === expected.mailpit.unread &&
      observed.mailpit.dbSize === expected.mailpit.dbSize,
    noOtherActive: activeIds.length === 0,
  };

  const preflightOk = Object.values(checks).every(Boolean);
  const payload = {
    phase: '8F-2B49',
    at,
    mode: 'read-only',
    expected,
    observed,
    checks,
    preflightOk,
    stop: !preflightOk,
  };

  fs.writeFileSync(path.join(outDir, 'PREFLIGHT.json'), JSON.stringify(payload, null, 2));
  console.log(JSON.stringify({ preflightOk, stop: payload.stop, checks, observed }, null, 2));
  if (!preflightOk) process.exit(2);
})().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
