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
const sessionId = 'rec008-8f2b37-new-01';
const historicalSessionId = 'rec008-8f2b14-new-01';
const targetAttemptId = 'd566fc28-02de-4ae1-afbb-6f7d81362d4d';
const confirmedAttemptId = 'ad71a155-4d3a-45b9-8445-2ec98377feaa';
const abandonedAttemptId = '8ae63b62-9f87-4a15-9011-4554b7766918';
const expiredAttemptId = '57bf7de8-9a5e-469d-858a-a6bd389223e6';
const expectedSlotId = '33333333-3333-4333-8333-333333333333';
const expectedMockRef = 'REC008-MOCK-0001';
const expectedMockApptId = '55555555-5555-4555-8555-555555555555';
const expectedPhone = '+33000000000';
const expectedEmail = 'camille.essai@example.test';
const chatInput = 'oui';
const minMarginSecs = 300;
const chatWebhookPath = 'a91c4e70-6b18-4f0d-9c55-2e7d8a14b603/chat';
const chatWebhookUrl = base + '/webhook/' + chatWebhookPath;
const webhookFile = 'C:/Users/epifa/AppData/Local/Temp/rec008-8f1-webhooks.js';
const outDir =
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-11-01-rec008-phase8f2b45-POSITIVE-CONFIRMATION-RETRY';
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
  docker(['cp', tmp, 'govsuite-rec008-test-rec008-n8n-1:/tmp/_m45.js']);
  const t = docker(['exec', 'govsuite-rec008-test-rec008-n8n-1', 'node', '/tmp/_m45.js']).trim();
  docker(['exec', '-u', 'root', 'govsuite-rec008-test-rec008-n8n-1', 'rm', '-f', '/tmp/_m45.js']);
  return JSON.parse(t);
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
      ok: res.status >= 200 && res.status < 500,
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
function dockerInspectRestarts() {
  try {
    const text = execFileSync(
      'docker',
      [
        'inspect',
        'govsuite-rec008-test-rec008-n8n-1',
        'govsuite-rec008-test-rec008-publish-1',
        '--format',
        '{{.Name}}|{{.RestartCount}}|{{.State.StartedAt}}|{{.State.Status}}',
      ],
      { encoding: 'utf8' }
    ).trim();
    return text.split(/\r?\n/).filter(Boolean).map((line) => {
      const p = line.split('|');
      return {
        name: p[0],
        restartCount: Number(p[1] || 0),
        startedAt: p[2],
        status: p[3],
      };
    });
  } catch (e) {
    return { error: String(e.message || e) };
  }
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
  docker(['cp', tmp, 'govsuite-rec008-test-rec008-n8n-1:/tmp/_n45.js']);
  const text = docker(['exec', 'govsuite-rec008-test-rec008-n8n-1', 'node', '/tmp/_n45.js']);
  docker(['exec', '-u', 'root', 'govsuite-rec008-test-rec008-n8n-1', 'rm', '-f', '/tmp/_n45.js']);
  const net = JSON.parse(text);
  return !(net.results || []).some((r) => r.expect === 'forbidden' && r.tcp === 'open');
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
function readAttemptDetail(id) {
  const line = pg(
    `SELECT id::text, session_id, status, expires_at::text, EXTRACT(EPOCH FROM (expires_at - clock_timestamp()))::int, (expires_at > clock_timestamp()), clock_timestamp()::text, (idempotency_key IS NOT NULL), length(coalesce(idempotency_key::text,'')), (request_payload IS NOT NULL), (request_fingerprint IS NOT NULL AND request_fingerprint ~ '^[0-9a-f]{64}$'), left(coalesce(request_fingerprint,''), 12), left(md5(coalesce(idempotency_key::text,'')), 12), coalesce(lease_owner,''), coalesce(lease_until::text,''), coalesce(appointment_reference,''), coalesce(appointment_id::text,''), coalesce(submitted_at::text,''), coalesce(confirmed_at::text,''), coalesce(request_payload->>'slotId',''), coalesce(request_payload->>'nom',''), coalesce(request_payload->>'prenom',''), coalesce(request_payload->>'email',''), coalesce(request_payload->>'telephone',''), ((request_payload ? 'cleIdempotence') OR (request_payload ? 'idempotencyKey')), (request_payload->>'cleIdempotence' = idempotency_key::text OR request_payload->>'idempotencyKey' = idempotency_key::text), created_at::text, updated_at::text, EXTRACT(EPOCH FROM (expires_at - created_at))::int, coalesce(resume_count::text,'0') FROM ai_appointment_attempt WHERE id='${id}'::uuid;`
  );
  if (!line) return null;
  const ap = line.split('|');
  return {
    id: ap[0],
    session_id: ap[1],
    status: ap[2],
    expiresAt: ap[3],
    secsLeft: Number(ap[4] || 0),
    stillValid: ap[5] === 't' || ap[5] === 'true',
    clockNow: ap[6],
    hasIdempotencyKey: ap[7] === 't' || ap[7] === 'true',
    idempotencyKeyLength: Number(ap[8] || 0),
    hasRequestPayload: ap[9] === 't' || ap[9] === 'true',
    hasFingerprint: ap[10] === 't' || ap[10] === 'true',
    fingerprintFp12: ap[11],
    idempotencyKeyFp12: ap[12],
    hasLeaseOwner: !!(ap[13] && ap[13].trim()),
    hasLeaseUntil: !!(ap[14] && ap[14].trim()),
    appointmentReference: ap[15] || '',
    appointmentId: ap[16] || '',
    submittedAt: ap[17] || '',
    confirmedAt: ap[18] || '',
    payloadSlotId: ap[19],
    payloadNom: ap[20],
    payloadPrenom: ap[21],
    payloadEmail: ap[22],
    payloadTelephone: ap[23],
    payloadHasIdempotencyField: ap[24] === 't' || ap[24] === 'true',
    keyMatchesPayload: ap[25] === 't' || ap[25] === 'true',
    createdAt: ap[26],
    updatedAt: ap[27],
    ttlSecondsAtCreate: Number(ap[28] || 0),
    resumeCount: Number(ap[29] || 0),
  };
}
function otherSessionsFp() {
  return pg(
    `SELECT md5(string_agg(session_id || '|' || coalesce(conversation_step,'') || '|' || coalesce(reference,'') || '|' || coalesce(token::text,'') || '|' || coalesce(intent,'') || '|' || coalesce(updated_at::text,''), ',' ORDER BY session_id)) FROM ai_conversation_state WHERE session_id <> '${sessionId}';`
  );
}
function historicalAttemptsFp() {
  return pg(
    `SELECT md5(string_agg(id::text || '|' || session_id || '|' || status || '|' || coalesce(appointment_reference,'') || '|' || coalesce(updated_at::text,''), ',' ORDER BY id)) FROM ai_appointment_attempt WHERE id <> '${targetAttemptId}'::uuid;`
  );
}
function rdvFp() {
  return pg(
    `SELECT md5(string_agg(id::text || '|' || coalesce(reference,'') || '|' || coalesce(updated_at::text,''), ',' ORDER BY id)) FROM rendez_vous;`
  );
}
function openOnSession() {
  return pg(
    `SELECT count(*) FROM ai_appointment_attempt WHERE session_id='${sessionId}' AND status IN ('AWAITING_CONFIRMATION','SUBMITTING','UNCERTAIN');`
  );
}
function stop(reason, detail, extra) {
  const payload = {
    ok: false,
    stopped: true,
    reason,
    detail,
    ...(extra || {}),
    executed: false,
    messageSent: false,
    activationPerformed: !!(extra && extra.activationPerformed),
    postCreateAppointmentPerformed: false,
    verdict: 'STOP',
    goNoGo: 'NO-GO',
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'STOP.json'), JSON.stringify(payload, null, 2));
  fs.writeFileSync(path.join(outDir, 'RESULT.json'), JSON.stringify(payload, null, 2));
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
  const dockerRestarts0 = dockerInspectRestarts();
  const tcpProbe0 = await tcpProbe('127.0.0.1', 5682);
  const healthz0 = await httpGetProbe(base + '/healthz');
  const readiness0 = await httpGetProbe(base + '/healthz/readiness');
  const connectivityOk =
    tcpProbe0.ok === true &&
    healthz0.ok === true &&
    (healthz0.status === 200 || healthz0.status === 204);
  const mock0 = mockMeta();
  const net = networkOk();
  const pg0 = pg(
    'SELECT (SELECT count(*) FROM rendez_vous),(SELECT count(*) FROM ai_conversation_state),(SELECT count(*) FROM ai_appointment_attempt),(SELECT count(*) FROM notifications);'
  );
  const open0 = pg(
    "SELECT count(*) FROM ai_appointment_attempt WHERE status IN ('AWAITING_CONFIRMATION','SUBMITTING','UNCERTAIN');"
  );
  const status0 = pg(
    "SELECT status || '|' || count(*)::text FROM ai_appointment_attempt GROUP BY status ORDER BY status;"
  )
    .split(/\r?\n/)
    .filter(Boolean);
  const target0 = parseSession(sessionSnap(sessionId));
  const hist0 = parseSession(sessionSnap(historicalSessionId));
  const attempt0 = readAttemptDetail(targetAttemptId);
  const confirmed0 = attemptSnap(confirmedAttemptId);
  const abandoned0 = attemptSnap(abandonedAttemptId);
  const expired0 = attemptSnap(expiredAttemptId);
  const otherFp0 = otherSessionsFp();
  const histAttemptsFp0 = historicalAttemptsFp();
  const rdvFp0 = rdvFp();
  const openSession0 = openOnSession();
  const gov0 = gov();
  const mail0 = JSON.parse(
    docker(['exec', 'govsuite-mailpit', 'wget', '-qO-', 'http://127.0.0.1:8025/api/v1/info'])
  );
  const finaliserSha = finaliserCodeSha(finaliser.parameters);
  const finaliserQuery = (finaliser.parameters && finaliser.parameters.query) || '';
  const finaliserReplacement =
    (finaliser.parameters &&
      finaliser.parameters.options &&
      finaliser.parameters.options.queryReplacement) ||
    '';
  const posts0 = postCount(mock0);
  const getAvail0 = pathCount(mock0, 'GET /appointments/availability 200');

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
    networkOk: net,
    dockerRestarts: dockerRestarts0,
    connectivity: {
      tcp127: tcpProbe0,
      healthz: healthz0,
      readiness: readiness0,
      ok: connectivityOk,
      baseUsed: base,
      note: '127.0.0.1 only; no chat webhook called during connectivity probes',
    },
    finaliserSha,
    finaliserHasAbsent:
      finaliserQuery.includes("__ABSENT__") && finaliserReplacement.includes("__ABSENT__"),
    finaliserHasUuidCast: /::uuid/.test(finaliserQuery),
    pg: pg0,
    open: open0,
    openSession: openSession0,
    statusCounts: status0,
    target: target0,
    historical: hist0,
    attempt: attempt0
      ? {
          id: attempt0.id,
          session_id: attempt0.session_id,
          status: attempt0.status,
          expiresAt: attempt0.expiresAt,
          secsLeft: attempt0.secsLeft,
          stillValid: attempt0.stillValid,
          clockNow: attempt0.clockNow,
          hasIdempotencyKey: attempt0.hasIdempotencyKey,
          idempotencyKeyLength: attempt0.idempotencyKeyLength,
          idempotencyKeyFp12: attempt0.idempotencyKeyFp12,
          hasRequestPayload: attempt0.hasRequestPayload,
          hasFingerprint: attempt0.hasFingerprint,
          fingerprintFp12: attempt0.fingerprintFp12,
          hasLeaseOwner: attempt0.hasLeaseOwner,
          hasLeaseUntil: attempt0.hasLeaseUntil,
          appointmentReference: attempt0.appointmentReference,
          appointmentId: attempt0.appointmentId,
          submittedAt: attempt0.submittedAt,
          confirmedAt: attempt0.confirmedAt,
          ttlSecondsAtCreate: attempt0.ttlSecondsAtCreate,
          payload: {
            slotId: attempt0.payloadSlotId,
            nom: attempt0.payloadNom,
            prenom: attempt0.payloadPrenom,
            email: attempt0.payloadEmail,
            telephone: attempt0.payloadTelephone,
            hasIdempotencyField: attempt0.payloadHasIdempotencyField,
          },
          keyMatchesPayload: attempt0.keyMatchesPayload,
          createdAt: attempt0.createdAt,
          updatedAt: attempt0.updatedAt,
        }
      : null,
    confirmed: confirmed0,
    abandoned: abandoned0,
    expired: expired0,
    otherFp: otherFp0,
    histAttemptsFp: histAttemptsFp0,
    rdvFp: rdvFp0,
    mockBaseline: {
      scenario: mock0.scenario,
      total: mock0.total,
      posts: posts0,
      getAvailability: getAvail0,
      distinctKeys: mock0.distinctKeys,
      byPath: mock0.byPath,
    },
    gov: gov0,
    mailpit: { messages: mail0.Messages, unread: mail0.Unread, dbSize: mail0.DatabaseSize },
  };
  fs.writeFileSync(path.join(outDir, 'PREFLIGHT.json'), JSON.stringify(preflight, null, 2));

  const temporalOk =
    attempt0 &&
    attempt0.id === targetAttemptId &&
    attempt0.session_id === sessionId &&
    attempt0.status === 'AWAITING_CONFIRMATION' &&
    attempt0.stillValid &&
    attempt0.secsLeft > minMarginSecs &&
    attempt0.hasIdempotencyKey &&
    attempt0.hasRequestPayload &&
    attempt0.hasFingerprint &&
    !attempt0.hasLeaseOwner &&
    !attempt0.hasLeaseUntil &&
    !attempt0.submittedAt &&
    !attempt0.confirmedAt &&
    !attempt0.appointmentReference &&
    !attempt0.appointmentId &&
    attempt0.keyMatchesPayload &&
    openSession0 === '1';

  const sessionReady =
    target0 &&
    target0.intent === 'CREATE_APPOINTMENT' &&
    target0.pending_action === 'CREATE_APPOINTMENT' &&
    target0.conversation_step === 'AWAIT_CREATE_CONFIRMATION' &&
    target0.service === 'PASSEPORT' &&
    target0.site === 'PARIS' &&
    target0.date_debut === '2026-11-03' &&
    target0.date_fin === '2026-11-03' &&
    target0.slot_id === expectedSlotId &&
    (target0.selected_slot_index === '1' || Number(target0.selected_slot_index) === 1) &&
    target0.nom === 'Dupont' &&
    target0.prenom === 'Camille' &&
    target0.email === expectedEmail &&
    target0.telephone === expectedPhone &&
    !target0.reference &&
    !target0.token;

  const attemptPayloadOk =
    attempt0 &&
    attempt0.payloadSlotId === expectedSlotId &&
    attempt0.payloadNom === 'Dupont' &&
    attempt0.payloadPrenom === 'Camille' &&
    attempt0.payloadEmail === expectedEmail &&
    attempt0.payloadTelephone === expectedPhone;

  const preOk =
    main.active === false &&
    (main.activeVersionId || null) === null &&
    main.versionId === versionId &&
    main.versionCounter === expectedCounter &&
    main.nodes.length === 134 &&
    edgesOf(main.connections) === 137 &&
    preflight.activeIds.length === 0 &&
    preflight.chatPublic &&
    chat.webhookId === 'a91c4e70-6b18-4f0d-9c55-2e7d8a14b603' &&
    postgres.join() === 'Fs0l0058q5CEadRw' &&
    preflight.ollama === 'dxzHqBq8Q60R8BOz' &&
    preflight.urlsOk &&
    net &&
    connectivityOk &&
    finaliserSha === expectedFinaliserSha &&
    preflight.finaliserHasAbsent &&
    preflight.finaliserHasUuidCast &&
    pg0 === '1|10|4|0' &&
    open0 === '1' &&
    status0.join(',') === 'ABANDONED|1,AWAITING_CONFIRMATION|1,CONFIRMED|1,EXPIRED|1' &&
    temporalOk &&
    sessionReady &&
    attemptPayloadOk &&
    hist0 &&
    hist0.reference === expectedMockRef &&
    hist0.conversation_step === '' &&
    hist0.pending_action === '' &&
    confirmed0.startsWith('CONFIRMED|' + expectedMockRef + '|') &&
    abandoned0.startsWith('ABANDONED|') &&
    expired0.startsWith('EXPIRED|') &&
    mock0.scenario === 'created' &&
    posts0 === 0 &&
    getAvail0 === 2 &&
    gov0 === expectedGov &&
    mail0.Messages === 5 &&
    mail0.Unread === 2 &&
    mail0.DatabaseSize === 98304;

  if (!connectivityOk) {
    stop('connectivity', preflight, {
      temporalOk,
      sessionReady,
      attemptPayloadOk,
      connectivityOk,
    });
  }
  if (!temporalOk) {
    stop(
      attempt0 && attempt0.stillValid && attempt0.secsLeft <= minMarginSecs
        ? 'attempt-margin-too-low'
        : 'attempt-expired-or-invalid',
      preflight,
      { temporalOk, sessionReady, attemptPayloadOk }
    );
  }
  if (!preOk) stop('preflight', preflight, { temporalOk, sessionReady, attemptPayloadOk });

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
      deactivate = { status: 0, error: String(e.message || e) };
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
    phase: '8F-2B45',
    sessionId,
    targetAttemptId,
    chatInput,
    chatWebhookUrl,
    preflight,
    executed: false,
    messageSent: false,
    activationPerformed: false,
    postCreateAppointmentPerformed: false,
    transportInstrumentation: {
      capturesCause: true,
      warmupMustSucceed: true,
      ipv4LiteralOnly: true,
      noAutoRetry: true,
    },
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
      stop('activate', result.activate, { activationPerformed: false });
    }
    activated = true;
    result.activationPerformed = true;

    const liveListed =
      (await (await fetchRetry(base + '/rest/workflows?limit=50', { headers: session })).json()).data ||
      [];
    result.activate.activeIds = liveListed.filter((r) => r.active).map((r) => r.id);
    if (result.activate.activeIds.join() !== workflowId) {
      const deact = await deactivateAndCollect('other-active');
      stop('other-active', { activate: result.activate, deact }, { activationPerformed: true });
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
        row.webhookPath === 'a91c4e70-6b18-4f0d-9c55-2e7d8a14b603/chat'
    );
    if (!chatWebhook || result.activate.webhooks.some((r) => r.workflowId !== workflowId)) {
      const deact = await deactivateAndCollect('webhook');
      stop('webhook', { webhooks: result.activate.webhooks, deact }, { activationPerformed: true });
    }

    // Recontrôle expiration obligatoire juste avant l'envoi.
    const attemptPreSend = readAttemptDetail(targetAttemptId);
    result.attemptPreSend = attemptPreSend
      ? {
          status: attemptPreSend.status,
          expiresAt: attemptPreSend.expiresAt,
          secsLeft: attemptPreSend.secsLeft,
          stillValid: attemptPreSend.stillValid,
          clockNow: attemptPreSend.clockNow,
          hasLeaseOwner: attemptPreSend.hasLeaseOwner,
          submittedAt: attemptPreSend.submittedAt,
          appointmentReference: attemptPreSend.appointmentReference,
        }
      : null;
    if (
      !attemptPreSend ||
      attemptPreSend.status !== 'AWAITING_CONFIRMATION' ||
      !attemptPreSend.stillValid ||
      !(attemptPreSend.secsLeft > minMarginSecs)
    ) {
      const deact = await deactivateAndCollect('pre-send-expiration');
      stop(
        'pre-send-expiration',
        { attemptPreSend, deact },
        { activationPerformed: true, messageSent: false }
      );
    }

    await new Promise((r) => setTimeout(r, 5000));

    // Warmup GET non métier — ne pas avaler l'erreur ; STOP si échec.
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
      stop(
        'warmup-failed',
        { warmup, deact, attemptPreSend: result.attemptPreSend },
        { activationPerformed: true, messageSent: false }
      );
    }

    await new Promise((r) => setTimeout(r, 1000));

    // Recontrôle secsLeft > 300 immédiatement avant POST chat.
    const attemptImmediate = readAttemptDetail(targetAttemptId);
    result.attemptImmediate = attemptImmediate
      ? {
          status: attemptImmediate.status,
          expiresAt: attemptImmediate.expiresAt,
          secsLeft: attemptImmediate.secsLeft,
          stillValid: attemptImmediate.stillValid,
          clockNow: attemptImmediate.clockNow,
        }
      : null;
    if (
      !attemptImmediate ||
      attemptImmediate.status !== 'AWAITING_CONFIRMATION' ||
      !attemptImmediate.stillValid ||
      !(attemptImmediate.secsLeft > minMarginSecs)
    ) {
      const deact = await deactivateAndCollect('immediate-expiration');
      stop(
        'immediate-expiration',
        { attemptImmediate, deact, warmup },
        { activationPerformed: true, messageSent: false }
      );
    }

    const mockBefore = mockMeta();
    const fingerprintBefore = attemptImmediate.fingerprintFp12;
    const keyFpBefore = attemptImmediate.idempotencyKeyFp12;
    const started = Date.now();
    let response;
    let responseText;
    let transportFailure = null;
    try {
      // Un seul POST chat — aucun retry.
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
      method: 'POST',
      transportFailure,
      responsePreview: (responseText || '').slice(0, 2000),
      responseJson,
      mockBefore,
      mockAfter,
      getAvailabilityDelta:
        pathCount(mockAfter, 'GET /appointments/availability 200') -
        pathCount(mockBefore, 'GET /appointments/availability 200'),
      postBefore: postCount(mockBefore),
      postAfter: postCount(mockAfter),
      postDelta: postCount(mockAfter) - postCount(mockBefore),
      post201: pathCount(mockAfter, 'POST /appointments 201'),
      distinctKeysAfter: mockAfter.distinctKeys,
      cancelSeen: hasCancel(mockAfter),
      fingerprintBefore,
      keyFpBefore,
    };
    result.postCreateAppointmentPerformed = result.message.postDelta > 0;

    result.deactivate = await deactivateAndCollect(
      transportFailure ? 'after-transport-failure' : 'after-message'
    );
    if (
      result.deactivate.active !== false ||
      (result.deactivate.activeVersionId || null) !== null ||
      result.deactivate.webhooks !== 0
    ) {
      // Incident désactivation : continuer les contrôles puis FAIL.
      result.deactivateIncident = true;
    }

    const target1 = parseSession(sessionSnap(sessionId));
    const hist1 = parseSession(sessionSnap(historicalSessionId));
    const attempt1 = readAttemptDetail(targetAttemptId);
    const confirmed1 = attemptSnap(confirmedAttemptId);
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
    const otherFp1 = otherSessionsFp();
    const histAttemptsFp1 = historicalAttemptsFp();
    const rdvFp1 = rdvFp();
    const gov1 = gov();
    const mail1 = JSON.parse(
      docker(['exec', 'govsuite-mailpit', 'wget', '-qO-', 'http://127.0.0.1:8025/api/v1/info'])
    );
    const mockEnd = mockMeta();

    // Lecture exécution n8n récente (Finaliser) — lecture seule.
    let finaliserExec = null;
    try {
      const execList = await (
        await fetchRetry(base + '/rest/executions?limit=5&workflowId=' + workflowId, {
          headers: session,
          timeoutMs: 30000,
        })
      ).json();
      const rows = (execList.data && execList.data.results) || execList.data || [];
      const latest = Array.isArray(rows) ? rows[0] : null;
      if (latest && latest.id) {
        const detail = await (
          await fetchRetry(base + '/rest/executions/' + latest.id + '?includeData=true', {
            headers: session,
            timeoutMs: 60000,
          })
        ).json();
        const exec = detail.data || detail;
        const runData =
          (exec.data && exec.data.resultData && exec.data.resultData.runData) || {};
        const finRuns = runData['Finaliser état création'] || [];
        const lastFin = finRuns[finRuns.length - 1];
        const finError =
          lastFin && lastFin.error
            ? String(lastFin.error.message || lastFin.error)
            : null;
        const finItems =
          lastFin && lastFin.data && lastFin.data.main && lastFin.data.main[0]
            ? lastFin.data.main[0].length
            : 0;
        finaliserExec = {
          executionId: latest.id,
          finished: !!exec.finished,
          status: exec.status || latest.status,
          finaliserRan: finRuns.length > 0,
          finaliserItems: finItems,
          finaliserError: finError,
          hasParam3Error: !!(finError && /no parameter \$3/i.test(finError)),
          hasUuidConflict: !!(
            finError &&
            (/uuid/i.test(finError) || /text.*uuid|uuid.*text/i.test(finError))
          ),
        };
      }
    } catch (e) {
      finaliserExec = { error: String(e.message || e) };
    }

    result.after = {
      target: target1,
      historical: hist1,
      attempt: attempt1
        ? {
            id: attempt1.id,
            status: attempt1.status,
            hasIdempotencyKey: attempt1.hasIdempotencyKey,
            hasRequestPayload: attempt1.hasRequestPayload,
            hasFingerprint: attempt1.hasFingerprint,
            fingerprintFp12: attempt1.fingerprintFp12,
            hasLeaseOwner: attempt1.hasLeaseOwner,
            hasLeaseUntil: attempt1.hasLeaseUntil,
            appointmentReference: attempt1.appointmentReference,
            appointmentId: attempt1.appointmentId,
            submittedAt: attempt1.submittedAt,
            confirmedAt: attempt1.confirmedAt,
            resumeCount: attempt1.resumeCount,
          }
        : null,
      confirmed: confirmed1,
      abandoned: abandoned1,
      expired: expired1,
      pg: pg1,
      open: open1,
      statusCounts: status1,
      otherFp: otherFp1,
      histAttemptsFp: histAttemptsFp1,
      rdvFp: rdvFp1,
      mockPosts: postCount(mockEnd),
      getAvailability: pathCount(mockEnd, 'GET /appointments/availability 200'),
      post201: pathCount(mockEnd, 'POST /appointments 201'),
      distinctKeys: mockEnd.distinctKeys,
      gov: gov1,
      mailpit: { messages: mail1.Messages, unread: mail1.Unread, dbSize: mail1.DatabaseSize },
      finaliserExec,
    };

    const text = String((responseJson && responseJson.text) || responseText || '');
    const type = responseJson && responseJson.type;
    const httpOk = !transportFailure && response.status === 200;
    const notWorkflowError =
      response.status !== 500 &&
      !/error in workflow/i.test(text) &&
      !(responseJson && responseJson.message && /error in workflow/i.test(responseJson.message));
    const confirmsAppointment =
      /confirm/i.test(text) ||
      /cr[eé][eé]/i.test(text) ||
      /rendez-vous/i.test(text);
    const showsReference = new RegExp(expectedMockRef, 'i').test(text);
    const falseSuccessWithoutFinalize =
      showsReference &&
      (!target1 || target1.conversation_step === 'AWAIT_CREATE_CONFIRMATION') &&
      response.status === 500;

    const claimCount =
      attempt1 &&
      attempt1.status === 'CONFIRMED' &&
      attempt1.submittedAt &&
      attempt1.confirmedAt &&
      result.message.postDelta === 1
        ? 1
        : 0;

    const functionalOk =
      httpOk &&
      notWorkflowError &&
      confirmsAppointment &&
      showsReference &&
      !falseSuccessWithoutFinalize &&
      type !== 'create_expired' &&
      type !== 'create_close_uncertain';

    const attemptOk =
      attempt1 &&
      attempt1.status === 'CONFIRMED' &&
      !attempt1.hasIdempotencyKey &&
      !attempt1.hasRequestPayload &&
      attempt1.hasFingerprint &&
      attempt1.fingerprintFp12 === fingerprintBefore &&
      !attempt1.hasLeaseOwner &&
      !attempt1.hasLeaseUntil &&
      attempt1.appointmentReference === expectedMockRef &&
      attempt1.appointmentId === expectedMockApptId &&
      !!attempt1.submittedAt &&
      !!attempt1.confirmedAt;

    const sessionOk =
      target1 &&
      !target1.conversation_step &&
      !target1.pending_action &&
      !target1.intent &&
      !target1.nom &&
      !target1.prenom &&
      !target1.email &&
      !target1.telephone &&
      !target1.service &&
      !target1.site &&
      !target1.slot_id &&
      target1.reference === expectedMockRef &&
      !target1.token;

    const finaliserOk =
      finaliserExec &&
      finaliserExec.finaliserRan &&
      !finaliserExec.finaliserError &&
      !finaliserExec.hasParam3Error &&
      !finaliserExec.hasUuidConflict &&
      sessionOk;

    const postOk =
      result.message.postDelta === 1 &&
      pathCount(mockEnd, 'POST /appointments 201') === posts0 + 1 &&
      mockEnd.distinctKeys === 1 &&
      result.message.getAvailabilityDelta === 0 &&
      !hasCancel(mockEnd);

    const integrityOk =
      pg1 === '1|10|4|0' &&
      open1 === '0' &&
      status1.join(',') === 'ABANDONED|1,CONFIRMED|2,EXPIRED|1' &&
      otherFp1 === otherFp0 &&
      histAttemptsFp1 === histAttemptsFp0 &&
      rdvFp1 === rdvFp0 &&
      confirmed1 === confirmed0 &&
      abandoned1 === abandoned0 &&
      expired1 === expired0 &&
      hist1 &&
      hist1.reference === expectedMockRef &&
      hist1.conversation_step === '' &&
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
      result.deactivate.webhooks === 0 &&
      !result.deactivateIncident;

    const pass =
      functionalOk &&
      attemptOk &&
      sessionOk &&
      finaliserOk &&
      postOk &&
      integrityOk &&
      deactivateOk &&
      claimCount === 1;

    result.checks = {
      functionalOk,
      attemptOk,
      sessionOk,
      finaliserOk,
      postOk,
      integrityOk,
      deactivateOk,
      httpOk,
      notWorkflowError,
      confirmsAppointment,
      showsReference,
      falseSuccessWithoutFinalize,
      claimCount,
      postDelta: result.message.postDelta,
    };
    result.pass = !!pass;
    result.verdict = pass ? 'PASS' : transportFailure ? 'UNCERTAIN' : 'FAIL';
    result.goNoGo = pass ? 'GO' : 'NO-GO';
    result.singleMessage = true;
    result.noPut = true;
    result.noLive = true;

    try {
      fs.unlinkSync(path.join(outDir, '_mock.js'));
    } catch {}
    try {
      fs.unlinkSync(path.join(outDir, '_net.js'));
    } catch {}

    fs.writeFileSync(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    process.exit(pass ? 0 : transportFailure ? 3 : 4);
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
