const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const net = require('net');

const envText = fs.readFileSync(
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-30-rec008-phase8e2b2-TEST-DEPLOY/.env.rec008-test.local',
  'utf8'
);
const value = (name) => envText.match(new RegExp('^' + name + '=(.*)$', 'm'))[1];
const base = 'http://127.0.0.1:5682';
const workflowId = 'OCD9It1uKFhOoWNF';
const versionId = 'e1b32992-bc68-46af-86ce-c80af46f5305';
const expectedCounter = 8;
const expectedFinaliserSha = '3fc500bfed99c202156005d252a864cdc25514c93e7e47c842ae896381e8ee7a';
const targetAttemptId = 'd566fc28-02de-4ae1-afbb-6f7d81362d4d';
const expectedGov = '13|14|12|48|0|a2dea067599fd4f0a5f857551adc67cc';
const webhookFile = 'C:/Users/epifa/AppData/Local/Temp/rec008-8f1-webhooks.js';
const outDir = 'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-31-rec008-phase8f2b44-WEBHOOK-TRANSPORT-DIAGNOSTIC';

function sha(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
function docker(args) {
  return execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
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
  return sha(((parameters && parameters.query) || '') + '\n' + ((parameters && parameters.options && parameters.options.queryReplacement) || ''));
}
function pg(sql) {
  return docker(['exec','-i','govsuite-rec008-test-rec008-postgres-1','psql','-U','postgres','-d','govsuite_rec008_test','-t','-A','-F','|','-c',sql]).trim();
}
function gov() {
  return docker(['exec','-i','govsuite-postgres','psql','-U','govsuite','-d','govsuite','-t','-A','-c',
    "SELECT (SELECT count(*) FROM rendez_vous)||'|'||(SELECT count(*) FROM notifications)||'|'||(SELECT count(*) FROM historique_rendez_vous)||'|'||(SELECT count(*) FROM ai_conversation_state)||'|'||(SELECT count(*) FROM ai_appointment_attempt)||'|'||(SELECT md5(string_agg(id::text || '|' || reference || '|' || statut || '|' || creneau_id::text || '|' || updated_at::text, ',' ORDER BY id)) FROM rendez_vous);"]).trim();
}
function mockMeta() {
  const probe = "const http=require('http');http.get('http://rec008-mock:8080/_meta/calls',res=>{let b='';res.on('data',c=>b+=c);res.on('end',()=>console.log(b));});";
  const tmp = path.join(outDir, '_mock.js');
  fs.writeFileSync(tmp, probe);
  docker(['cp', tmp, 'govsuite-rec008-test-rec008-n8n-1:/tmp/_m44.js']);
  const t = docker(['exec','govsuite-rec008-test-rec008-n8n-1','node','/tmp/_m44.js']).trim();
  docker(['exec','-u','root','govsuite-rec008-test-rec008-n8n-1','rm','-f','/tmp/_m44.js']);
  try { fs.unlinkSync(tmp); } catch {}
  return JSON.parse(t);
}
function pathCount(meta, key) { return Number((meta.byPath && meta.byPath[key]) || 0); }
function postCount(meta) {
  return Object.entries(meta.byPath || {}).filter(([k]) => /^POST \/appointments /.test(k) && !/cancel|reschedule/i.test(k)).reduce((n,[,v]) => n + Number(v||0), 0);
}
function readWebhooks() {
  docker(['cp', webhookFile, 'govsuite-rec008-test-rec008-n8n-1:/tmp/rec008-8f1-webhooks.js']);
  const text = docker(['exec','govsuite-rec008-test-rec008-n8n-1','node','/tmp/rec008-8f1-webhooks.js']);
  docker(['exec','-u','root','govsuite-rec008-test-rec008-n8n-1','rm','-f','/tmp/rec008-8f1-webhooks.js']);
  return JSON.parse(text);
}
function errInfo(e) {
  const c = e && e.cause;
  return {
    name: e && e.name,
    message: e && e.message,
    cause: c ? {
      name: c.name,
      message: c.message,
      code: c.code,
      errno: c.errno,
      syscall: c.syscall,
      address: c.address,
      port: c.port
    } : null,
    stack: String((e && e.stack) || '').split('\n').slice(0, 6)
  };
}
function tcpProbe(host, port, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const sock = net.connect({ host, port }, () => {
      const elapsedMs = Date.now() - t0;
      sock.end();
      resolve({ ok: true, elapsedMs, localAddress: sock.localAddress, remoteAddress: sock.remoteAddress });
    });
    sock.setTimeout(timeoutMs);
    sock.on('timeout', () => { sock.destroy(); resolve({ ok: false, elapsedMs: Date.now()-t0, error: 'timeout' }); });
    sock.on('error', (e) => resolve({ ok: false, elapsedMs: Date.now()-t0, error: e.code || e.message, address: e.address, port: e.port }));
  });
}
async function httpGet(url, opts = {}) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(opts.timeoutMs || 15000), headers: opts.headers || {} });
    const text = await res.text();
    return { ok: true, status: res.status, elapsedMs: Date.now()-t0, len: text.length, preview: text.slice(0, 160) };
  } catch (e) {
    return { ok: false, elapsedMs: Date.now()-t0, ...errInfo(e) };
  }
}

(async () => {
  const report = {
    phase: '8F-2B44',
    startedAt: new Date().toISOString(),
    runtime: {
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      cwd: process.cwd(),
      httpProxy: process.env.HTTP_PROXY || process.env.http_proxy || null,
      httpsProxy: process.env.HTTPS_PROXY || process.env.https_proxy || null,
      noProxy: process.env.NO_PROXY || process.env.no_proxy || null
    }
  };

  // DNS / resolution
  const dns = require('dns');
  report.resolution = {
    literal127: '127.0.0.1',
    localhost: await new Promise((resolve) => dns.lookup('localhost', { all: true }, (err, addrs) => resolve(err ? { error: String(err) } : addrs))),
    lookup127: await new Promise((resolve) => dns.lookup('127.0.0.1', { all: true }, (err, addrs) => resolve(err ? { error: String(err) } : addrs)))
  };

  report.hostTcp5682 = await tcpProbe('127.0.0.1', 5682);
  report.hostTcpIpv6 = await tcpProbe('::1', 5682);
  report.hostHealthz = await httpGet(base + '/healthz');
  report.hostReadiness = await httpGet(base + '/healthz/readiness');
  report.hostRestSettings = await httpGet(base + '/rest/settings');

  // Login + workflow read (no activate)
  const login = await fetch(base + '/rest/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ emailOrLdapLoginId: value('REC008_N8N_OWNER_EMAIL'), password: value('REC008_N8N_OWNER_PASSWORD') }),
    signal: AbortSignal.timeout(60000)
  });
  const cookie = (login.headers.getSetCookie ? login.headers.getSetCookie() : []).map((i) => i.split(';')[0]).join('; ');
  report.login = { status: login.status, hasCookie: !!cookie };
  if (login.status !== 200 || !cookie) {
    fs.writeFileSync(path.join(outDir, 'DIAG.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ stop: 'login', report }, null, 2));
    process.exit(2);
  }
  const session = { cookie, accept: 'application/json', 'content-type': 'application/json' };
  const main = (await (await fetch(base + '/rest/workflows/' + workflowId, { headers: session, signal: AbortSignal.timeout(60000) })).json()).data;
  const listed = (await (await fetch(base + '/rest/workflows?limit=50', { headers: session, signal: AbortSignal.timeout(60000) })).json()).data || [];
  const chat = main.nodes.find((n) => n.name === "Lorsqu'un message de chat est reçu");
  const finaliser = main.nodes.find((n) => n.name === 'Finaliser état création');
  const finaliserSha = finaliserCodeSha(finaliser.parameters);
  const webhooks = readWebhooks();

  report.workflow = {
    active: main.active,
    activeVersionId: main.activeVersionId || null,
    versionId: main.versionId,
    versionCounter: main.versionCounter,
    nodes: main.nodes.length,
    edges: edgesOf(main.connections),
    activeIds: listed.filter((r) => r.active).map((r) => r.id),
    chatPublic: chat && chat.parameters && chat.parameters.public === true,
    webhookId: chat && chat.webhookId,
    finaliserSha,
    webhooksCount: (webhooks.rows || []).length,
    webhooks: (webhooks.rows || []).map((r) => ({ workflowId: r.workflowId, method: r.method, webhookPath: r.webhookPath }))
  };

  // Keep-alive stress on non-business endpoints (same host:port as failed webhook)
  const sequential = [];
  for (let i = 0; i < 8; i++) {
    sequential.push(await httpGet(base + '/healthz'));
  }
  report.sequentialHealthz = sequential;
  const parallel = await Promise.all([
    httpGet(base + '/healthz'),
    httpGet(base + '/healthz/readiness'),
    httpGet(base + '/rest/settings'),
    httpGet(base + '/healthz')
  ]);
  report.parallelHealth = parallel;

  // Container TCP/HTTP from publish and n8n
  const containerProbe = `
const net=require('net'); const http=require('http');
function tcp(host,port){return new Promise(r=>{const t0=Date.now();const s=net.connect({host,port},()=>{const e=Date.now()-t0;s.end();r({ok:true,elapsedMs:e});});s.setTimeout(3000);s.on('timeout',()=>{s.destroy();r({ok:false,error:'timeout',elapsedMs:Date.now()-t0});});s.on('error',e=>r({ok:false,error:e.code||e.message,elapsedMs:Date.now()-t0,address:e.address,port:e.port}));});}
function get(url){return new Promise(r=>{const t0=Date.now();const req=http.get(url,{timeout:10000},res=>{let b='';res.on('data',c=>b+=c);res.on('end',()=>r({ok:true,status:res.statusCode,elapsedMs:Date.now()-t0,len:b.length,preview:b.slice(0,80)}));});req.on('error',e=>r({ok:false,error:e.code||e.message,elapsedMs:Date.now()-t0}));req.on('timeout',()=>{req.destroy();r({ok:false,error:'timeout',elapsedMs:Date.now()-t0});});});}
(async()=>{
  const out={};
  out.tcp_n8n_5678=await tcp('rec008-n8n',5678);
  out.tcp_publish_5682=await tcp('rec008-publish',5682).catch(e=>({ok:false,error:String(e)}));
  out.get_n8n_healthz=await get('http://rec008-n8n:5678/healthz');
  out.get_publish_healthz=await get('http://rec008-publish:5682/healthz');
  console.log(JSON.stringify(out));
})().catch(e=>{console.log(JSON.stringify({fatal:String(e)})); process.exit(1);});
`;
  const tmpC = path.join(outDir, '_conn.js');
  fs.writeFileSync(tmpC, containerProbe);
  docker(['cp', tmpC, 'govsuite-rec008-test-rec008-n8n-1:/tmp/_c44.js']);
  report.fromN8nContainer = JSON.parse(docker(['exec','govsuite-rec008-test-rec008-n8n-1','node','/tmp/_c44.js']).trim());
  docker(['exec','-u','root','govsuite-rec008-test-rec008-n8n-1','rm','-f','/tmp/_c44.js']);
  docker(['cp', tmpC, 'govsuite-rec008-test-rec008-publish-1:/tmp/_c44.js']);
  report.fromPublishContainer = JSON.parse(docker(['exec','govsuite-rec008-test-rec008-publish-1','node','/tmp/_c44.js']).trim());
  docker(['exec','-u','root','govsuite-rec008-test-rec008-publish-1','rm','-f','/tmp/_c44.js']);
  try { fs.unlinkSync(tmpC); } catch {}

  // Listen check inside n8n
  report.n8nListen = docker(['exec','govsuite-rec008-test-rec008-n8n-1','sh','-lc','(ss -lntp 2>/dev/null || netstat -lntp 2>/dev/null || true) | head -n 40']).trim();

  // PG / attempt / counters
  const pg0 = pg('SELECT (SELECT count(*) FROM rendez_vous),(SELECT count(*) FROM ai_conversation_state),(SELECT count(*) FROM ai_appointment_attempt),(SELECT count(*) FROM notifications);');
  const open0 = pg("SELECT count(*) FROM ai_appointment_attempt WHERE status IN ('AWAITING_CONFIRMATION','SUBMITTING','UNCERTAIN');");
  const status0 = pg("SELECT status || '|' || count(*)::text FROM ai_appointment_attempt GROUP BY status ORDER BY status;").split(/\r?\n/).filter(Boolean);
  const attemptLine = pg(`SELECT id::text, session_id, status, expires_at::text, EXTRACT(EPOCH FROM (expires_at - clock_timestamp()))::int, (expires_at > clock_timestamp()), clock_timestamp()::text, (idempotency_key IS NOT NULL), length(coalesce(idempotency_key::text,'')), (request_payload IS NOT NULL), (request_fingerprint IS NOT NULL AND request_fingerprint ~ '^[0-9a-f]{64}$'), left(coalesce(request_fingerprint,''), 12), left(md5(coalesce(idempotency_key::text,'')), 12), coalesce(lease_owner,''), coalesce(lease_until::text,''), coalesce(appointment_reference,''), coalesce(appointment_id::text,''), coalesce(submitted_at::text,''), coalesce(confirmed_at::text,''), created_at::text, updated_at::text FROM ai_appointment_attempt WHERE id='${targetAttemptId}'::uuid;`);
  const ap = attemptLine.split('|');
  report.pg = { counts: pg0, open: open0, statusCounts: status0 };
  report.attempt = {
    id: ap[0], session_id: ap[1], status: ap[2], expiresAt: ap[3], secsLeft: Number(ap[4]||0), stillValid: ap[5]==='t'||ap[5]==='true',
    clockNow: ap[6], hasIdempotencyKey: ap[7]==='t'||ap[7]==='true', idempotencyKeyLength: Number(ap[8]||0),
    hasRequestPayload: ap[9]==='t'||ap[9]==='true', hasFingerprint: ap[10]==='t'||ap[10]==='true',
    fingerprintFp12: ap[11], idempotencyKeyFp12: ap[12],
    hasLeaseOwner: !!(ap[13]&&ap[13].trim()), hasLeaseUntil: !!(ap[14]&&ap[14].trim()),
    appointmentReference: ap[15]||'', appointmentId: ap[16]||'', submittedAt: ap[17]||'', confirmedAt: ap[18]||'',
    createdAt: ap[19], updatedAt: ap[20]
  };

  const mock0 = mockMeta();
  report.mock = { scenario: mock0.scenario, total: mock0.total, posts: postCount(mock0), getAvailability: pathCount(mock0,'GET /appointments/availability 200'), distinctKeys: mock0.distinctKeys, byPath: mock0.byPath };
  report.gov = gov();
  const mail0 = JSON.parse(docker(['exec','govsuite-mailpit','wget','-qO-','http://127.0.0.1:8025/api/v1/info']));
  report.mailpit = { messages: mail0.Messages, unread: mail0.Unread, dbSize: mail0.DatabaseSize };

  report.expected = {
    workflowInactive: report.workflow.active === false && report.workflow.activeVersionId === null,
    versionIdOk: report.workflow.versionId === versionId,
    versionCounterOk: report.workflow.versionCounter === expectedCounter,
    graphOk: report.workflow.nodes === 134 && report.workflow.edges === 137,
    finaliserShaOk: report.workflow.finaliserSha === expectedFinaliserSha,
    noActiveWorkflows: report.workflow.activeIds.length === 0,
    noWebhooks: report.workflow.webhooksCount === 0,
    pgOk: pg0 === '1|10|4|0',
    openOk: open0 === '1',
    mockOk: report.mock.scenario === 'created' && report.mock.posts === 0 && report.mock.getAvailability === 2,
    govOk: report.gov === expectedGov,
    mailOk: report.mailpit.messages === 5 && report.mailpit.unread === 2 && report.mailpit.dbSize === 98304
  };
  report.preflightOk = Object.values(report.expected).every(Boolean);
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, 'DIAG.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    preflightOk: report.preflightOk,
    expected: report.expected,
    workflow: report.workflow,
    pg: report.pg,
    attempt: { status: report.attempt.status, secsLeft: report.attempt.secsLeft, stillValid: report.attempt.stillValid, expiresAt: report.attempt.expiresAt, clockNow: report.attempt.clockNow, hasLease: report.attempt.hasLeaseOwner, hasRef: !!report.attempt.appointmentReference, hasKey: report.attempt.hasIdempotencyKey, hasPayload: report.attempt.hasRequestPayload },
    mock: report.mock,
    gov: report.gov,
    mailpit: report.mailpit,
    hostTcp5682: report.hostTcp5682,
    hostHealthz: report.hostHealthz,
    sequentialFail: report.sequentialHealthz.filter(x => !x.ok).length,
    parallelFail: report.parallelHealth.filter(x => !x.ok).length,
    fromN8n: report.fromN8nContainer,
    fromPublish: report.fromPublishContainer
  }, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
