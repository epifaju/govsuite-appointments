/**
 * REC-008 phase 8F-2B49-P3 — session rec008-8f2b49-edit-01, un seul message collecte nom.
 * Aucun retry chat. Désactivation immédiate. Pas de CLAIM / POST CreateAppointment.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const net = require('net');
const { execFileSync } = require('child_process');

const envText = fs.readFileSync(
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-30-rec008-phase8e2b2-TEST-DEPLOY/.env.rec008-test.local',
  'utf8'
);
const value = (name) => envText.match(new RegExp('^' + name + '=(.*)$', 'm'))[1];

const base = 'http://127.0.0.1:5682';
const workflowId = 'OCD9It1uKFhOoWNF';
const versionId = 'e1b32992-bc68-46af-86ce-c80af46f5305';
const expectedCounter = 8;
const expectedFinaliserSha =
  '3fc500bfed99c202156005d252a864cdc25514c93e7e47c842ae896381e8ee7a';
const sessionId = 'rec008-8f2b49-edit-01';
const historicalSessionId = 'rec008-8f2b14-new-01';
const priorSession37 = 'rec008-8f2b37-new-01';
const priorSession28 = 'rec008-8f2b28-new-01';
const confirmedAttemptId = 'ad71a155-4d3a-45b9-8445-2ec98377feaa';
const confirmedAttemptId2 = 'd566fc28-02de-4ae1-afbb-6f7d81362d4d';
const abandonedAttemptId = '8ae63b62-9f87-4a15-9011-4554b7766918';
const expiredAttemptId = '57bf7de8-9a5e-469d-858a-a6bd389223e6';
const expectedSlotId = '33333333-3333-4333-8333-333333333333';
const chatWebhookPath = 'a91c4e70-6b18-4f0d-9c55-2e7d8a14b603/chat';
const chatWebhookUrl = base + '/webhook/' + chatWebhookPath;
const chatInput = 'Dupont';
const webhookFile = 'C:/Users/epifa/AppData/Local/Temp/rec008-8f1-webhooks.js';
const outDir =
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-11-01-rec008-phase8f2b49-P3-NAME-COLLECTION';
const expectedGov = '13|14|12|48|0|a2dea067599fd4f0a5f857551adc67cc';

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
function errInfo(e) {
  const c = e && e.cause;
  return {
    name: e && e.name,
    message: e && e.message,
    cause: c
      ? {
          name: c.name,
          message: c.message,
          code: c.code,
          errno: c.errno,
          syscall: c.syscall,
          address: c.address,
          port: c.port,
        }
      : null,
  };
}
function tcpProbe(host, port, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const sock = net.connect({ host, port }, () => {
      const elapsedMs = Date.now() - t0;
      sock.end();
      resolve({
        ok: true,
        elapsedMs,
        localAddress: sock.localAddress,
        remoteAddress: sock.remoteAddress,
      });
    });
    sock.setTimeout(timeoutMs);
    sock.on('timeout', () => {
      sock.destroy();
      resolve({ ok: false, elapsedMs: Date.now() - t0, error: 'timeout' });
    });
    sock.on('error', (e) =>
      resolve({
        ok: false,
        elapsedMs: Date.now() - t0,
        error: e.code || e.message,
        address: e.address,
        port: e.port,
      })
    );
  });
}
async function httpGetProbe(url, timeoutMs = 15000) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    return {
      ok: res.status === 200,
      status: res.status,
      elapsedMs: Date.now() - t0,
      len: text.length,
      preview: text.slice(0, 160),
      targetUrl: url,
    };
  } catch (e) {
    return {
      ok: false,
      elapsedMs: Date.now() - t0,
      targetUrl: url,
      ...errInfo(e),
    };
  }
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
  docker(['cp', tmp, 'govsuite-rec008-test-rec008-n8n-1:/tmp/_m49p3.js']);
  const t = docker(['exec', 'govsuite-rec008-test-rec008-n8n-1', 'node', '/tmp/_m49p3.js']).trim();
  docker(['exec', '-u', 'root', 'govsuite-rec008-test-rec008-n8n-1', 'rm', '-f', '/tmp/_m49p3.js']);
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
function hasCancel(meta) {
  return Object.keys(meta.byPath || {}).some((k) => /cancel|reschedule/i.test(k));
}
function networkOk() {
  const netProbe = fs.readFileSync('C:/Users/epifa/AppData/Local/Temp/rec008-8f1-net.js', 'utf8');
  const tmp = path.join(outDir, '_net.js');
  fs.writeFileSync(tmp, netProbe);
  docker(['cp', tmp, 'govsuite-rec008-test-rec008-n8n-1:/tmp/_n49p3.js']);
  const text = docker(['exec', 'govsuite-rec008-test-rec008-n8n-1', 'node', '/tmp/_n49p3.js']);
  docker(['exec', '-u', 'root', 'govsuite-rec008-test-rec008-n8n-1', 'rm', '-f', '/tmp/_n49p3.js']);
  const netRes = JSON.parse(text);
  return !(netRes.results || []).some((r) => r.expect === 'forbidden' && r.tcp === 'open');
}
function readWebhooks() {
  docker(['cp', webhookFile, 'govsuite-rec008-test-rec008-n8n-1:/tmp/rec008-8f1-webhooks.js']);
  const text = docker(['exec', 'govsuite-rec008-test-rec008-n8n-1', 'node', '/tmp/rec008-8f1-webhooks.js']);
  docker(['exec', '-u', 'root', 'govsuite-rec008-test-rec008-n8n-1', 'rm', '-f', '/tmp/rec008-8f1-webhooks.js']);
  return JSON.parse(text);
}
function sessionSnap(id) {
  return pg(
    `SELECT coalesce(intent,''), coalesce(service,''), coalesce(site,''), coalesce(date_debut::text,''), coalesce(date_fin::text,''), coalesce(conversation_step,''), coalesce(pending_action,''), coalesce(reference,''), coalesce(token::text,''), coalesce(slot_id::text,''), coalesce(selected_slot_index::text,''), coalesce(nom,''), coalesce(prenom,''), coalesce(email,''), coalesce(telephone,''), left(coalesce(last_user_message,''),240), coalesce(available_slots::text,'') FROM ai_conversation_state WHERE session_id='${id}';`
  );
}
function parseSession(line) {
  if (!line) return null;
  const p = line.split('|');
  let slots = [];
  try {
    slots = JSON.parse(p[16] || '[]');
  } catch (_) {
    slots = [];
  }
  return {
    intent: p[0],
    service: p[1],
    site: p[2],
    date_debut: p[3],
    date_fin: p[4],
    conversation_step: p[5],
    pending_action: p[6],
    reference: p[7],
    token: p[8],
    slot_id: p[9],
    selected_slot_index: p[10],
    nom: p[11],
    prenom: p[12],
    email: p[13],
    telephone: p[14],
    last_user_message: p[15],
    available_slots: slots,
  };
}
function attemptSnap(id) {
  return pg(
    `SELECT status, coalesce(appointment_reference,''), (idempotency_key IS NOT NULL), (request_payload IS NOT NULL), coalesce(lease_owner,''), coalesce(updated_at::text,'') FROM ai_appointment_attempt WHERE id='${id}'::uuid;`
  );
}
function histFp() {
  return pg(
    `SELECT md5(string_agg(session_id || '|' || coalesce(conversation_step,'') || '|' || coalesce(reference,'') || '|' || coalesce(token::text,'') || '|' || coalesce(intent,'') || '|' || coalesce(updated_at::text,''), ',' ORDER BY session_id)) FROM ai_conversation_state WHERE session_id <> '${sessionId}';`
  );
}
function attemptsFp() {
  return pg(
    `SELECT md5(string_agg(id::text || '|' || session_id || '|' || status || '|' || coalesce(appointment_reference,'') || '|' || coalesce(updated_at::text,''), ',' ORDER BY id)) FROM ai_appointment_attempt;`
  );
}
function rdvFp() {
  return pg(
    `SELECT md5(string_agg(id::text || '|' || coalesce(reference,'') || '|' || coalesce(updated_at::text,''), ',' ORDER BY id)) FROM rendez_vous;`
  );
}
function stop(reason, detail, extra) {
  const payload = { ok: false, stopped: true, reason, detail, ...(extra || {}), verdict: 'FAIL' };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'STOP.json'), JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
  process.exit(2);
}
async function fetchRetry(url, opts, tries = 5) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try {
      const controller = new AbortController();
      const outer = setTimeout(() => controller.abort(), (opts && opts.timeoutMs) || 120000);
      const merged = { ...opts };
      delete merged.timeoutMs;
      if (!merged.signal) merged.signal = controller.signal;
      try {
        const res = await fetch(url, merged);
        clearTimeout(outer);
        return res;
      } catch (e) {
        clearTimeout(outer);
        throw e;
      }
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
  throw last;
}

(async () => {
  if (new URL(base).hostname !== '127.0.0.1') throw new Error('host must be 127.0.0.1');
  if (new URL(base).port !== '5682') throw new Error('mauvais port');
  fs.mkdirSync(outDir, { recursive: true });

  const login = await fetchRetry(base + '/rest/login', {
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

  const main = (await (await fetchRetry(base + '/rest/workflows/' + workflowId, { headers: session })).json()).data;
  const listed =
    (await (await fetchRetry(base + '/rest/workflows?limit=50', { headers: session })).json()).data || [];
  const chat = main.nodes.find((n) => n.name === "Lorsqu'un message de chat est reçu");
  const finaliser = main.nodes.find((n) => n.name === 'Finaliser état création');
  const ollama = main.nodes.find((n) => n.name === 'Ollama Chat Model');
  const postgres = [
    ...new Set(
      main.nodes
        .filter((n) => n.credentials && n.credentials.postgres)
        .map((n) => n.credentials.postgres.id)
    ),
  ];

  const tcpProbe0 = await tcpProbe('127.0.0.1', 5682);
  const healthz0 = await httpGetProbe(base + '/healthz');
  const readiness0 = await httpGetProbe(base + '/healthz/readiness');
  const connectivityOk =
    tcpProbe0.ok === true &&
    healthz0.ok === true &&
    healthz0.status === 200 &&
    readiness0.ok === true &&
    readiness0.status === 200;

  const webhooks0 = readWebhooks();
  const mock0 = mockMeta();
  const netOk = networkOk();
  const pg0 = pg(
    'SELECT (SELECT count(*) FROM rendez_vous),(SELECT count(*) FROM ai_conversation_state),(SELECT count(*) FROM ai_appointment_attempt),(SELECT count(*) FROM notifications);'
  );
  const open0 = pg(
    "SELECT count(*) FROM ai_appointment_attempt WHERE status IN ('AWAITING_CONFIRMATION','SUBMITTING','UNCERTAIN');"
  );
  const targetExists0 = pg(`SELECT count(*) FROM ai_conversation_state WHERE session_id='${sessionId}';`);
  const priorPresent = pg(
    `SELECT count(*) FROM ai_conversation_state WHERE session_id IN ('${priorSession37}','${priorSession28}','${historicalSessionId}');`
  );
  const status0 = pg(
    "SELECT status || '|' || count(*)::text FROM ai_appointment_attempt GROUP BY status ORDER BY status;"
  )
    .split(/\r?\n/)
    .filter(Boolean);
  const target0 = parseSession(sessionSnap(sessionId));
  const hist0 = parseSession(sessionSnap(historicalSessionId));
  const confirmed0 = attemptSnap(confirmedAttemptId);
  const confirmed20 = attemptSnap(confirmedAttemptId2);
  const abandoned0 = attemptSnap(abandonedAttemptId);
  const expired0 = attemptSnap(expiredAttemptId);
  const sessionAttempts0 = pg(
    `SELECT count(*) FROM ai_appointment_attempt WHERE session_id='${sessionId}';`
  );
  const histFp0 = histFp();
  const attemptsFp0 = attemptsFp();
  const rdvFp0 = rdvFp();
  const gov0 = gov();
  const mail0 = JSON.parse(
    docker(['exec', 'govsuite-mailpit', 'wget', '-qO-', 'http://127.0.0.1:8025/api/v1/info'])
  );
  const finaliserSha = finaliserCodeSha(finaliser.parameters);
  const getAvail0 = pathCount(mock0, 'GET /appointments/availability 200');
  const posts0 = postCount(mock0);
  const slot0 = target0 && target0.available_slots && target0.available_slots[0];

  const sessionReady =
    targetExists0 === '1' &&
    target0 &&
    target0.intent === 'CREATE_APPOINTMENT' &&
    target0.pending_action === 'CREATE_APPOINTMENT' &&
    target0.conversation_step === 'ASK_NOM' &&
    target0.service === 'PASSEPORT' &&
    target0.site === 'PARIS' &&
    target0.date_debut === '2026-11-03' &&
    target0.date_fin === '2026-11-03' &&
    target0.slot_id === expectedSlotId &&
    (target0.selected_slot_index === '1' || Number(target0.selected_slot_index) === 1) &&
    Array.isArray(target0.available_slots) &&
    target0.available_slots.length === 1 &&
    Number(target0.available_slots[0].index) === 1 &&
    String(target0.available_slots[0].id) === expectedSlotId &&
    String(target0.available_slots[0].debut || '').includes('09:00') &&
    String(target0.available_slots[0].fin || '').includes('09:30') &&
    !target0.nom &&
    !target0.prenom &&
    !target0.email &&
    !target0.telephone &&
    sessionAttempts0 === '0';

  const preflight = {
    active: main.active,
    activeVersionId: main.activeVersionId || null,
    versionId: main.versionId,
    versionCounter: main.versionCounter,
    nodes: main.nodes.length,
    edges: edgesOf(main.connections),
    activeIds: listed.filter((r) => r.active).map((r) => r.id),
    chatPublic: chat && chat.parameters && chat.parameters.public === true,
    webhookId: chat && chat.webhookId,
    postgres,
    ollama: ollama && ollama.credentials.ollamaApi.id,
    urlsOk:
      urlsOf(main.nodes).length === 10 &&
      urlsOf(main.nodes).every((u) => u.startsWith('http://rec008-mock:8080/')),
    networkOk: netOk,
    connectivity: {
      tcp: tcpProbe0,
      healthz: healthz0,
      readiness: readiness0,
      ok: connectivityOk,
      note: '127.0.0.1 only; no chat webhook during connectivity probes',
    },
    webhooksBefore: (webhooks0.rows || []).length,
    finaliserSha,
    pg: pg0,
    open: open0,
    statusCounts: status0,
    targetExists: targetExists0,
    sessionReady,
    target: target0
      ? {
          intent: target0.intent,
          pending_action: target0.pending_action,
          conversation_step: target0.conversation_step,
          service: target0.service,
          site: target0.site,
          date_debut: target0.date_debut,
          date_fin: target0.date_fin,
          slot_id: target0.slot_id,
          selected_slot_index: target0.selected_slot_index,
          hasIdentity: !!(target0.nom || target0.prenom || target0.email || target0.telephone),
        }
      : null,
    slotPreview: slot0
      ? {
          id: slot0.id,
          index: slot0.index,
          debut: slot0.debut,
          fin: slot0.fin,
          placesDisponibles: slot0.placesDisponibles,
        }
      : null,
    priorSessionsPresent: priorPresent,
    historical: hist0
      ? {
          reference: hist0.reference,
          conversation_step: hist0.conversation_step,
          pending_action: hist0.pending_action,
        }
      : null,
    confirmed: confirmed0,
    confirmed2: confirmed20,
    abandoned: abandoned0,
    expired: expired0,
    sessionAttempts: sessionAttempts0,
    histFp: histFp0,
    attemptsFp: attemptsFp0,
    rdvFp: rdvFp0,
    mockBaseline: {
      scenario: mock0.scenario,
      total: mock0.total,
      posts: posts0,
      getAvailability: getAvail0,
      byPath: mock0.byPath,
      distinctKeys: mock0.distinctKeys,
    },
    gov: gov0,
    mailpit: { messages: mail0.Messages, unread: mail0.Unread, dbSize: mail0.DatabaseSize },
  };
  fs.writeFileSync(path.join(outDir, 'PREFLIGHT.json'), JSON.stringify(preflight, null, 2));

  const preOk =
    connectivityOk &&
    main.active === false &&
    (main.activeVersionId || null) === null &&
    main.versionId === versionId &&
    main.versionCounter === expectedCounter &&
    main.nodes.length === 134 &&
    edgesOf(main.connections) === 137 &&
    preflight.activeIds.length === 0 &&
    preflight.webhooksBefore === 0 &&
    preflight.chatPublic &&
    chat.webhookId === 'a91c4e70-6b18-4f0d-9c55-2e7d8a14b603' &&
    postgres.join() === 'Fs0l0058q5CEadRw' &&
    preflight.ollama === 'dxzHqBq8Q60R8BOz' &&
    preflight.urlsOk &&
    netOk &&
    finaliserSha === expectedFinaliserSha &&
    pg0 === '1|11|4|0' &&
    open0 === '0' &&
    status0.join(',') === 'ABANDONED|1,CONFIRMED|2,EXPIRED|1' &&
    sessionReady &&
    priorPresent === '3' &&
    hist0 &&
    hist0.reference === 'REC008-MOCK-0001' &&
    confirmed0.startsWith('CONFIRMED|REC008-MOCK-0001|') &&
    confirmed20.startsWith('CONFIRMED|REC008-MOCK-0001|') &&
    abandoned0.startsWith('ABANDONED|') &&
    expired0.startsWith('EXPIRED|') &&
    mock0.scenario === 'created' &&
    posts0 === 1 &&
    getAvail0 === 3 &&
    gov0 === expectedGov &&
    mail0.Messages === 5 &&
    mail0.Unread === 2 &&
    mail0.DatabaseSize === 98304;

  if (!connectivityOk) stop('connectivity', preflight.connectivity);
  if (!preOk) stop('preflight', preflight, { sessionReady });

  let activated = false;
  async function deactivateAndCollect(tag) {
    let deactivate;
    try {
      deactivate = await fetchRetry(base + '/rest/workflows/' + workflowId + '/deactivate', {
        method: 'POST',
        headers: session,
        body: '{}',
        timeoutMs: 60000,
      });
    } catch (e) {
      deactivate = { status: 0, text: async () => String(e.message) };
    }
    const after = (
      await (await fetchRetry(base + '/rest/workflows/' + workflowId, { headers: session })).json()
    ).data;
    const afterListed =
      (await (await fetchRetry(base + '/rest/workflows?limit=50', { headers: session })).json()).data ||
      [];
    const webhooksAfter = readWebhooks();
    activated = false;
    return {
      tag,
      status: deactivate.status,
      active: after.active,
      activeVersionId: after.activeVersionId || null,
      versionId: after.versionId,
      versionCounter: after.versionCounter,
      nodes: after.nodes.length,
      edges: edgesOf(after.connections),
      finaliserSha: finaliserCodeSha(
        after.nodes.find((n) => n.name === 'Finaliser état création').parameters
      ),
      activeIds: afterListed.filter((r) => r.active).map((r) => r.id),
      webhooks: (webhooksAfter.rows || []).length,
    };
  }

  const result = {
    phase: '8F-2B49-P3',
    sessionId,
    chatInput,
    preflight,
    messageSent: false,
    executed: false,
  };

  try {
    const activate = await fetchRetry(base + '/rest/workflows/' + workflowId + '/activate', {
      method: 'POST',
      headers: session,
      body: JSON.stringify({ versionId }),
      timeoutMs: 60000,
    });
    const activateJson = JSON.parse(await activate.text());
    const published = activateJson.data || activateJson;
    result.activate = {
      status: activate.status,
      active: published.active,
      activeVersionId: published.activeVersionId || null,
    };
    if (
      activate.status !== 200 ||
      published.active !== true ||
      published.activeVersionId !== versionId
    ) {
      stop('activate', result.activate);
    }
    activated = true;

    const liveListed =
      (await (await fetchRetry(base + '/rest/workflows?limit=50', { headers: session })).json()).data ||
      [];
    result.activate.activeIds = liveListed.filter((r) => r.active).map((r) => r.id);
    if (result.activate.activeIds.join() !== workflowId) {
      const deact = await deactivateAndCollect('other-active');
      stop('other-active', { activate: result.activate, deact });
    }

    const webhooks = readWebhooks();
    result.activate.webhooks = (webhooks.rows || []).map((row) => ({
      workflowId: row.workflowId,
      method: row.method,
      webhookPath: row.webhookPath,
    }));
    const chatWebhook = (webhooks.rows || []).find(
      (row) =>
        row.workflowId === workflowId &&
        String(row.method).toUpperCase() === 'POST' &&
        row.webhookPath === chatWebhookPath
    );
    if (!chatWebhook || result.activate.webhooks.some((r) => r.workflowId !== workflowId)) {
      const deact = await deactivateAndCollect('webhook');
      stop('webhook', { webhooks: result.activate.webhooks, deact });
    }

    await new Promise((r) => setTimeout(r, 5000));

    const warmupStarted = Date.now();
    let warmup = null;
    try {
      const warmupRes = await fetch(chatWebhookUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });
      const warmupText = await warmupRes.text();
      warmup = {
        ok: true,
        status: warmupRes.status,
        elapsedMs: Date.now() - warmupStarted,
        targetUrl: chatWebhookUrl,
        bodyLen: (warmupText || '').length,
      };
    } catch (warmupErr) {
      warmup = {
        ok: false,
        elapsedMs: Date.now() - warmupStarted,
        targetUrl: chatWebhookUrl,
        ...errInfo(warmupErr),
      };
    }
    result.warmup = warmup;
    if (!warmup.ok) {
      const deact = await deactivateAndCollect('warmup-failed');
      stop('warmup-failed', { warmup, deact }, { activationPerformed: true, messageSent: false });
    }

    await new Promise((r) => setTimeout(r, 1000));

    const mockBefore = mockMeta();
    const started = Date.now();
    let response;
    let responseText;
    let transportFailure = null;
    try {
      response = await fetch(chatWebhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ action: 'sendMessage', sessionId, chatInput }),
        signal: AbortSignal.timeout(180000),
      });
      responseText = await response.text();
    } catch (chatErr) {
      transportFailure = {
        ...errInfo(chatErr),
        elapsedMs: Date.now() - started,
        targetUrl: chatWebhookUrl,
        method: 'POST',
      };
      response = { status: 0 };
      responseText = '';
    }
    const elapsedMs = Date.now() - started;
    result.messageSent = true;
    result.executed = true;
    const mockAfter = mockMeta();
    fs.writeFileSync(path.join(outDir, 'response.txt'), responseText || '');

    let responseJson = null;
    try {
      responseJson = JSON.parse(responseText);
    } catch (_) {}

    result.message = {
      status: response.status,
      elapsedMs,
      targetUrl: chatWebhookUrl,
      transportFailure,
      responsePreview: (responseText || '').slice(0, 1200),
      responseJson,
      mockBefore: {
        scenario: mockBefore.scenario,
        posts: postCount(mockBefore),
        getAvailability: pathCount(mockBefore, 'GET /appointments/availability 200'),
      },
      mockAfter: {
        scenario: mockAfter.scenario,
        posts: postCount(mockAfter),
        getAvailability: pathCount(mockAfter, 'GET /appointments/availability 200'),
        byPath: mockAfter.byPath,
      },
      getServicesDelta:
        pathCount(mockAfter, 'GET /services 200') - pathCount(mockBefore, 'GET /services 200'),
      getAvailabilityDelta:
        pathCount(mockAfter, 'GET /appointments/availability 200') -
        pathCount(mockBefore, 'GET /appointments/availability 200'),
      postBefore: postCount(mockBefore),
      postAfter: postCount(mockAfter),
      postDelta: postCount(mockAfter) - postCount(mockBefore),
      cancelSeen: hasCancel(mockAfter),
    };

    result.deactivate = await deactivateAndCollect(
      transportFailure ? 'after-transport-failure' : 'after-message'
    );

    const target1 = parseSession(sessionSnap(sessionId));
    const hist1 = parseSession(sessionSnap(historicalSessionId));
    const confirmed1 = attemptSnap(confirmedAttemptId);
    const confirmed21 = attemptSnap(confirmedAttemptId2);
    const abandoned1 = attemptSnap(abandonedAttemptId);
    const expired1 = attemptSnap(expiredAttemptId);
    const pg1 = pg(
      'SELECT (SELECT count(*) FROM rendez_vous),(SELECT count(*) FROM ai_conversation_state),(SELECT count(*) FROM ai_appointment_attempt),(SELECT count(*) FROM notifications);'
    );
    const open1 = pg(
      "SELECT count(*) FROM ai_appointment_attempt WHERE status IN ('AWAITING_CONFIRMATION','SUBMITTING','UNCERTAIN');"
    );
    const status1 = pg(
      "SELECT status || '|' || count(*)::text FROM ai_appointment_attempt GROUP BY status ORDER BY status;"
    )
      .split(/\r?\n/)
      .filter(Boolean);
    const sessionAttempts1 = pg(
      `SELECT count(*) FROM ai_appointment_attempt WHERE session_id='${sessionId}';`
    );
    const histFp1 = histFp();
    const attemptsFp1 = attemptsFp();
    const rdvFp1 = rdvFp();
    const gov1 = gov();
    const mail1 = JSON.parse(
      docker(['exec', 'govsuite-mailpit', 'wget', '-qO-', 'http://127.0.0.1:8025/api/v1/info'])
    );
    const mockEnd = mockMeta();

    result.after = {
      target: target1,
      historical: hist1
        ? {
            reference: hist1.reference,
            conversation_step: hist1.conversation_step,
            pending_action: hist1.pending_action,
          }
        : null,
      confirmed: confirmed1,
      confirmed2: confirmed21,
      abandoned: abandoned1,
      expired: expired1,
      pg: pg1,
      open: open1,
      statusCounts: status1,
      sessionAttempts: sessionAttempts1,
      histFp: histFp1,
      attemptsFp: attemptsFp1,
      rdvFp: rdvFp1,
      mockPosts: postCount(mockEnd),
      getAvailability: pathCount(mockEnd, 'GET /appointments/availability 200'),
      mockScenario: mockEnd.scenario,
      gov: gov1,
      mailpit: { messages: mail1.Messages, unread: mail1.Unread, dbSize: mail1.DatabaseSize },
    };

    const text = String((responseJson && responseJson.text) || responseText || '');
    const type = responseJson && responseJson.type;
    const step = responseJson && responseJson.conversationStep;
    const claimAcquired = !!(responseJson && responseJson.claimAcquired === true);
    const ready = !!(responseJson && responseJson.ready === true);
    const asksPrenom =
      /pr[eé]nom/i.test(text) || type === 'ask_prenom' || step === 'ASK_PRENOM';
    const asksEmailOrPhone = /e-?mail/i.test(text) || /t[eé]l[eé]phone/i.test(text);
    const reasksNomOnly =
      step === 'ASK_NOM' ||
      (/quel est votre \*\*nom\*\*/i.test(text) && !/pr[eé]nom/i.test(text));
    const reasksService = /quel\s+service|passeport ou|choisir.*service/i.test(text);
    const reasksSite = /quelle\s+ville|quel\s+site|choisir.*site/i.test(text);
    const reasksAvailability =
      /disponibilit|cr[eé]neaux disponibles/i.test(text) && type === 'availability';
    const asksConfirmCreate =
      /confirmez.*(cr[eé]ation|rendez-vous)|souhaitez-vous confirmer|r[eé]pondez exactement\s+\*?\*?oui/i.test(
        text
      );
    const claimsCreated =
      /rendez-vous\s+(a|est)\s+[eé]t[eé]\s+(cr[eé][eé]|confirm)/i.test(text) ||
      /GB-\d{4}-/i.test(text) ||
      /REC008-MOCK/i.test(text);

    const functionalOk =
      !transportFailure &&
      response.status === 200 &&
      type === 'create_appointment_question' &&
      step === 'ASK_PRENOM' &&
      asksPrenom &&
      !asksEmailOrPhone &&
      !reasksNomOnly &&
      !reasksService &&
      !reasksSite &&
      !reasksAvailability &&
      !asksConfirmCreate &&
      !claimsCreated &&
      !claimAcquired &&
      !ready;

    const sessionOk =
      target1 &&
      target1.intent === 'CREATE_APPOINTMENT' &&
      target1.pending_action === 'CREATE_APPOINTMENT' &&
      target1.conversation_step === 'ASK_PRENOM' &&
      target1.service === 'PASSEPORT' &&
      target1.site === 'PARIS' &&
      target1.date_debut === '2026-11-03' &&
      target1.date_fin === '2026-11-03' &&
      target1.slot_id === expectedSlotId &&
      (target1.selected_slot_index === '1' || Number(target1.selected_slot_index) === 1) &&
      target1.nom === 'Dupont' &&
      !target1.prenom &&
      !target1.email &&
      !target1.telephone &&
      !target1.reference &&
      !target1.token &&
      Array.isArray(target1.available_slots) &&
      target1.available_slots.length === 1 &&
      String(target1.available_slots[0].id) === expectedSlotId;

    const integrityOk =
      pg1 === '1|11|4|0' &&
      open1 === '0' &&
      status1.join(',') === 'ABANDONED|1,CONFIRMED|2,EXPIRED|1' &&
      sessionAttempts1 === '0' &&
      histFp1 === histFp0 &&
      attemptsFp1 === attemptsFp0 &&
      rdvFp1 === rdvFp0 &&
      confirmed1 === confirmed0 &&
      confirmed21 === confirmed20 &&
      abandoned1 === abandoned0 &&
      expired1 === expired0 &&
      hist1 &&
      hist1.reference === 'REC008-MOCK-0001' &&
      postCount(mockEnd) === posts0 &&
      result.message.postDelta === 0 &&
      !hasCancel(mockEnd) &&
      result.message.getAvailabilityDelta === 0 &&
      pathCount(mockEnd, 'GET /appointments/availability 200') === getAvail0 &&
      mockEnd.scenario === 'created' &&
      gov1 === expectedGov &&
      mail1.Messages === 5 &&
      mail1.Unread === 2 &&
      mail1.DatabaseSize === 98304;

    const deactivateOk =
      result.deactivate.active === false &&
      (result.deactivate.activeVersionId || null) === null &&
      result.deactivate.versionId === versionId &&
      result.deactivate.versionCounter === expectedCounter &&
      result.deactivate.nodes === 134 &&
      result.deactivate.edges === 137 &&
      result.deactivate.finaliserSha === expectedFinaliserSha &&
      result.deactivate.activeIds.length === 0 &&
      result.deactivate.webhooks === 0;

    const pass = functionalOk && sessionOk && integrityOk && deactivateOk && !transportFailure;
    const uncertain =
      !!transportFailure ||
      (response.status !== 200 &&
        !claimsCreated &&
        postCount(mockEnd) === posts0 &&
        sessionAttempts1 === '0');

    result.checks = {
      functionalOk,
      sessionOk,
      integrityOk,
      deactivateOk,
      asksPrenom,
      asksEmailOrPhone,
      reasksNomOnly,
      reasksService,
      reasksSite,
      reasksAvailability,
      asksConfirmCreate,
      claimsCreated,
      claimAcquired,
      ready,
      type,
      conversationStep: step,
      nom: target1 && target1.nom,
    };
    result.pass = !!pass;
    result.uncertain = !!uncertain && !pass;
    result.verdict = pass ? 'PASS' : uncertain ? 'UNCERTAIN' : 'FAIL';
    result.goP4 = pass ? 'GO' : 'NO-GO';
    result.noClaim = sessionAttempts1 === '0' && open1 === '0' && !claimAcquired;
    result.noPost = postCount(mockEnd) === posts0;
    result.noPut = true;
    result.singleMessage = true;

    try {
      fs.unlinkSync(path.join(outDir, '_mock.js'));
    } catch (_) {}
    try {
      fs.unlinkSync(path.join(outDir, '_net.js'));
    } catch (_) {}

    fs.writeFileSync(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2));
    console.log(
      JSON.stringify(
        {
          verdict: result.verdict,
          pass: result.pass,
          goP4: result.goP4,
          status: result.message && result.message.status,
          elapsedMs: result.message && result.message.elapsedMs,
          pg: result.after && result.after.pg,
          getAvailabilityDelta: result.message && result.message.getAvailabilityDelta,
          postDelta: result.message && result.message.postDelta,
          conversationStep: result.checks && result.checks.conversationStep,
          slot_id: result.after && result.after.target && result.after.target.slot_id,
          nom: result.after && result.after.target && result.after.target.nom,
          checks: result.checks,
          transportFailure: result.message && result.message.transportFailure,
        },
        null,
        2
      )
    );
    process.exit(pass ? 0 : uncertain ? 3 : 4);
  } catch (e) {
    if (activated) {
      try {
        result.deactivate = await deactivateAndCollect('catch');
      } catch (_) {}
    }
    result.error = String(e.stack || e.message);
    fs.writeFileSync(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2));
    console.error(e.stack || e.message);
    process.exit(1);
  }
})();
