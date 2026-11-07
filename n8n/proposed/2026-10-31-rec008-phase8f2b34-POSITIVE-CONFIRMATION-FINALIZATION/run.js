const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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
const sessionId = 'rec008-8f2b28-new-01';
const historicalSessionId = 'rec008-8f2b14-new-01';
const targetAttemptId = '57bf7de8-9a5e-469d-858a-a6bd389223e6';
const confirmedAttemptId = 'ad71a155-4d3a-45b9-8445-2ec98377feaa';
const abandonedAttemptId = '8ae63b62-9f87-4a15-9011-4554b7766918';
const expectedSlotId = '33333333-3333-4333-8333-333333333333';
const expectedGov = '13|14|12|48|0|a2dea067599fd4f0a5f857551adc67cc';
const outDir =
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-31-rec008-phase8f2b34-POSITIVE-CONFIRMATION-FINALIZATION';
const mockPath =
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-30-rec008-phase8e2b2-TEST-DEPLOY/mock/server.mjs';

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
  docker(['cp', tmp, 'govsuite-rec008-test-rec008-n8n-1:/tmp/_m34.js']);
  const t = docker(['exec', 'govsuite-rec008-test-rec008-n8n-1', 'node', '/tmp/_m34.js']).trim();
  docker(['exec', '-u', 'root', 'govsuite-rec008-test-rec008-n8n-1', 'rm', '-f', '/tmp/_m34.js']);
  return JSON.parse(t);
}
function networkOk() {
  const netProbe = fs.readFileSync('C:/Users/epifa/AppData/Local/Temp/rec008-8f1-net.js', 'utf8');
  const tmp = path.join(outDir, '_net.js');
  fs.writeFileSync(tmp, netProbe);
  docker(['cp', tmp, 'govsuite-rec008-test-rec008-n8n-1:/tmp/_n34.js']);
  const text = docker(['exec', 'govsuite-rec008-test-rec008-n8n-1', 'node', '/tmp/_n34.js']);
  docker(['exec', '-u', 'root', 'govsuite-rec008-test-rec008-n8n-1', 'rm', '-f', '/tmp/_n34.js']);
  const net = JSON.parse(text);
  return !(net.results || []).some((r) => r.expect === 'forbidden' && r.tcp === 'open');
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
  if (new URL(base).port !== '5682') throw new Error('mauvais port');
  fs.mkdirSync(outDir, { recursive: true });

  let login;
  let cookie = '';
  for (let i = 1; i <= 8; i++) {
    try {
      login = await fetch(base + '/rest/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          emailOrLdapLoginId: value('REC008_N8N_OWNER_EMAIL'),
          password: value('REC008_N8N_OWNER_PASSWORD'),
        }),
      });
      cookie = (login.headers.getSetCookie ? login.headers.getSetCookie() : [])
        .map((x) => x.split(';')[0])
        .join('; ');
      if (login.status === 200 && cookie) break;
    } catch (e) {
      if (i === 8) throw e;
    }
    await new Promise((r) => setTimeout(r, 1500 * i));
  }
  if (!cookie) throw new Error('login failed ' + (login && login.status));
  const headers = { cookie, accept: 'application/json', 'content-type': 'application/json' };

  const main = (await (await fetch(base + '/rest/workflows/' + workflowId, { headers })).json()).data;
  const listed =
    (await (await fetch(base + '/rest/workflows?limit=50', { headers })).json()).data || [];
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
  const finaliserSha = finaliserCodeSha(finaliser.parameters);
  const mock0 = mockMeta();
  const netOk = networkOk();
  const pg0 = pg(
    'SELECT (SELECT count(*) FROM rendez_vous),(SELECT count(*) FROM ai_conversation_state),(SELECT count(*) FROM ai_appointment_attempt),(SELECT count(*) FROM notifications);'
  );
  const open0 = pg(
    "SELECT count(*) FROM ai_appointment_attempt WHERE status IN ('AWAITING_CONFIRMATION','SUBMITTING','UNCERTAIN');"
  );
  const statusCounts = pg(
    "SELECT status || '|' || count(*)::text FROM ai_appointment_attempt GROUP BY status ORDER BY status;"
  )
    .split(/\r?\n/)
    .filter(Boolean);

  const sessionLine = pg(
    `SELECT coalesce(intent,''), coalesce(service,''), coalesce(site,''), coalesce(date_debut::text,''), coalesce(date_fin::text,''), coalesce(conversation_step,''), coalesce(pending_action,''), coalesce(reference,''), coalesce(token::text,''), coalesce(slot_id::text,''), coalesce(selected_slot_index::text,''), coalesce(nom,''), coalesce(prenom,''), coalesce(email,''), coalesce(telephone,''), left(coalesce(last_user_message,''),240) FROM ai_conversation_state WHERE session_id='${sessionId}';`
  );
  const histLine = pg(
    `SELECT coalesce(conversation_step,''), coalesce(pending_action,''), coalesce(reference,''), coalesce(token::text,''), left(coalesce(last_user_message,''),80) FROM ai_conversation_state WHERE session_id='${historicalSessionId}';`
  );
  const attemptLine = pg(
    `SELECT id::text, session_id, status, expires_at::text, EXTRACT(EPOCH FROM (expires_at - clock_timestamp()))::int, (expires_at > clock_timestamp()), (idempotency_key IS NOT NULL), length(coalesce(idempotency_key::text,'')), (request_payload IS NOT NULL), (request_fingerprint IS NOT NULL AND request_fingerprint ~ '^[0-9a-f]{64}$'), left(coalesce(request_fingerprint,''), 12), left(md5(coalesce(idempotency_key::text,'')), 12), coalesce(lease_owner,''), coalesce(lease_until::text,''), coalesce(appointment_reference,''), coalesce(appointment_id::text,''), coalesce(submitted_at::text,''), coalesce(confirmed_at::text,''), coalesce(request_payload->>'slotId',''), coalesce(request_payload->>'nom',''), coalesce(request_payload->>'prenom',''), coalesce(request_payload->>'email',''), coalesce(request_payload->>'telephone',''), ((request_payload ? 'cleIdempotence') OR (request_payload ? 'idempotencyKey')), (request_payload->>'cleIdempotence' = idempotency_key::text OR request_payload->>'idempotencyKey' = idempotency_key::text), created_at::text, updated_at::text FROM ai_appointment_attempt WHERE id='${targetAttemptId}'::uuid;`
  );
  const confirmed0 = pg(
    `SELECT status, coalesce(appointment_reference,''), (idempotency_key IS NOT NULL), (request_payload IS NOT NULL), coalesce(lease_owner,''), coalesce(updated_at::text,'') FROM ai_appointment_attempt WHERE id='${confirmedAttemptId}'::uuid;`
  );
  const abandoned0 = pg(
    `SELECT status, coalesce(appointment_reference,''), (idempotency_key IS NOT NULL), (request_payload IS NOT NULL), coalesce(lease_owner,''), coalesce(updated_at::text,'') FROM ai_appointment_attempt WHERE id='${abandonedAttemptId}'::uuid;`
  );
  const otherFp = pg(
    `SELECT md5(string_agg(session_id || '|' || coalesce(conversation_step,'') || '|' || coalesce(reference,'') || '|' || coalesce(token::text,'') || '|' || coalesce(intent,'') || '|' || coalesce(updated_at::text,''), ',' ORDER BY session_id)) FROM ai_conversation_state WHERE session_id <> '${sessionId}';`
  );
  const histAttemptsFp = pg(
    `SELECT md5(string_agg(id::text || '|' || session_id || '|' || status || '|' || coalesce(appointment_reference,'') || '|' || coalesce(updated_at::text,''), ',' ORDER BY id)) FROM ai_appointment_attempt WHERE session_id <> '${sessionId}';`
  );
  const rdvFp = pg(
    `SELECT md5(string_agg(id::text || '|' || coalesce(reference,'') || '|' || coalesce(updated_at::text,''), ',' ORDER BY id)) FROM rendez_vous;`
  );
  const gov0 = gov();
  const mail0 = JSON.parse(
    docker(['exec', 'govsuite-mailpit', 'wget', '-qO-', 'http://127.0.0.1:8025/api/v1/info'])
  );
  const mockSha = sha(fs.readFileSync(mockPath));

  const ap = attemptLine.split('|');
  const sp = sessionLine.split('|');
  const hp = histLine.split('|');

  const attempt = {
    id: ap[0],
    session_id: ap[1],
    status: ap[2],
    expiresAt: ap[3],
    secsLeft: Number(ap[4] || 0),
    stillValid: ap[5] === 't' || ap[5] === 'true',
    hasIdempotencyKey: ap[6] === 't' || ap[6] === 'true',
    idempotencyKeyLength: Number(ap[7] || 0),
    hasRequestPayload: ap[8] === 't' || ap[8] === 'true',
    hasFingerprint: ap[9] === 't' || ap[9] === 'true',
    fingerprintFp12: ap[10],
    idempotencyKeyFp12: ap[11],
    hasLeaseOwner: !!(ap[12] && ap[12].trim()),
    hasLeaseUntil: !!(ap[13] && ap[13].trim()),
    appointmentReference: ap[14] || '',
    appointmentId: ap[15] || '',
    submittedAt: ap[16] || '',
    confirmedAt: ap[17] || '',
    payloadSlotId: ap[18],
    payloadNom: ap[19],
    payloadPrenom: ap[20],
    payloadEmail: ap[21],
    payloadTelephone: ap[22],
    payloadHasIdempotencyField: ap[23] === 't' || ap[23] === 'true',
    keyMatchesPayload: ap[24] === 't' || ap[24] === 'true',
    createdAt: ap[25],
    updatedAt: ap[26],
  };

  const target = {
    intent: sp[0],
    service: sp[1],
    site: sp[2],
    date_debut: sp[3],
    date_fin: sp[4],
    conversation_step: sp[5],
    pending_action: sp[6],
    reference: sp[7],
    token: sp[8],
    slot_id: sp[9],
    selected_slot_index: sp[10],
    nom: sp[11],
    prenom: sp[12],
    email: sp[13],
    telephone: sp[14],
    last_user_message: sp[15],
  };

  const historical = {
    conversation_step: hp[0],
    pending_action: hp[1],
    reference: hp[2],
    token: hp[3],
    last_user_message: hp[4],
  };

  const sessionOk =
    target.intent === 'CREATE_APPOINTMENT' &&
    target.pending_action === 'CREATE_APPOINTMENT' &&
    target.conversation_step === 'AWAIT_CREATE_CONFIRMATION' &&
    target.service === 'PASSEPORT' &&
    target.site === 'PARIS' &&
    target.date_debut === '2026-11-03' &&
    target.date_fin === '2026-11-03' &&
    target.slot_id === expectedSlotId &&
    (target.selected_slot_index === '1' || Number(target.selected_slot_index) === 1) &&
    target.nom === 'Dupont' &&
    target.prenom === 'Camille' &&
    target.email === 'camille.essai@example.test' &&
    target.telephone === '+33000000000' &&
    !target.reference &&
    !target.token;

  const attemptFieldsOk =
    attempt.id === targetAttemptId &&
    attempt.session_id === sessionId &&
    attempt.status === 'AWAITING_CONFIRMATION' &&
    attempt.hasIdempotencyKey &&
    attempt.idempotencyKeyLength >= 16 &&
    attempt.hasRequestPayload &&
    attempt.hasFingerprint &&
    attempt.keyMatchesPayload &&
    attempt.payloadHasIdempotencyField &&
    !attempt.hasLeaseOwner &&
    !attempt.hasLeaseUntil &&
    !attempt.appointmentReference &&
    !attempt.appointmentId &&
    !attempt.submittedAt &&
    !attempt.confirmedAt &&
    attempt.payloadSlotId === expectedSlotId &&
    attempt.payloadNom === 'Dupont' &&
    attempt.payloadPrenom === 'Camille' &&
    attempt.payloadEmail === 'camille.essai@example.test' &&
    attempt.payloadTelephone === '+33000000000';

  const temporalOk = attempt.stillValid && attempt.secsLeft >= 90;
  const mockExpectedOk =
    mock0.scenario === 'created' &&
    postCount(mock0) === 1 &&
    pathCount(mock0, 'GET /appointments/availability 200') === 2;

  const workflowOk =
    main.active === false &&
    (main.activeVersionId || null) === null &&
    main.versionId === versionId &&
    main.versionCounter === expectedCounter &&
    main.nodes.length === 134 &&
    edgesOf(main.connections) === 137 &&
    listed.filter((r) => r.active).length === 0 &&
    !!(chat && chat.parameters && chat.parameters.public === true) &&
    chat.webhookId === 'a91c4e70-6b18-4f0d-9c55-2e7d8a14b603' &&
    postgres.join() === 'Fs0l0058q5CEadRw' &&
    ollama &&
    ollama.credentials.ollamaApi.id === 'dxzHqBq8Q60R8BOz' &&
    urlsOf(main.nodes).length === 10 &&
    urlsOf(main.nodes).every((u) => u.startsWith('http://rec008-mock:8080/')) &&
    finaliserSha === expectedFinaliserSha &&
    netOk;

  const pgOk =
    pg0 === '1|9|3|0' &&
    open0 === '1' &&
    statusCounts.join(',') === 'ABANDONED|1,AWAITING_CONFIRMATION|1,CONFIRMED|1';
  const liveOk =
    gov0 === expectedGov &&
    mail0.Messages === 5 &&
    mail0.Unread === 2 &&
    mail0.DatabaseSize === 98304;

  const stopReasons = [];
  if (!temporalOk) stopReasons.push('attempt-expired');
  if (!mockExpectedOk) stopReasons.push('mock-counters-reset-after-stack-restart');
  if (!sessionOk) stopReasons.push('session-mismatch');
  if (!attemptFieldsOk) stopReasons.push('attempt-fields-mismatch');
  if (!workflowOk) stopReasons.push('workflow-preflight');
  if (!pgOk) stopReasons.push('pg-counts');
  if (!liveOk) stopReasons.push('live-or-mailpit');

  const preflight = {
    workflow: {
      active: main.active,
      activeVersionId: main.activeVersionId || null,
      versionId: main.versionId,
      versionCounter: main.versionCounter,
      nodes: main.nodes.length,
      edges: edgesOf(main.connections),
      activeIds: listed.filter((r) => r.active).map((r) => r.id),
      chatPublic: !!(chat && chat.parameters && chat.parameters.public),
      webhookId: chat && chat.webhookId,
      postgres,
      ollama: ollama && ollama.credentials.ollamaApi.id,
      urlsOk:
        urlsOf(main.nodes).length === 10 &&
        urlsOf(main.nodes).every((u) => u.startsWith('http://rec008-mock:8080/')),
      finaliserSha,
      networkOk: netOk,
    },
    pg: pg0,
    open: open0,
    statusCounts,
    target,
    historical,
    attempt: {
      id: attempt.id,
      session_id: attempt.session_id,
      status: attempt.status,
      expiresAt: attempt.expiresAt,
      secsLeft: attempt.secsLeft,
      stillValid: attempt.stillValid,
      hasIdempotencyKey: attempt.hasIdempotencyKey,
      idempotencyKeyLength: attempt.idempotencyKeyLength,
      idempotencyKeyFp12: attempt.idempotencyKeyFp12,
      hasRequestPayload: attempt.hasRequestPayload,
      hasFingerprint: attempt.hasFingerprint,
      fingerprintFp12: attempt.fingerprintFp12,
      hasLeaseOwner: attempt.hasLeaseOwner,
      hasLeaseUntil: attempt.hasLeaseUntil,
      appointmentReference: attempt.appointmentReference,
      appointmentId: attempt.appointmentId,
      submittedAt: attempt.submittedAt,
      confirmedAt: attempt.confirmedAt,
      payload: {
        slotId: attempt.payloadSlotId,
        nom: attempt.payloadNom,
        prenom: attempt.payloadPrenom,
        email: attempt.payloadEmail,
        telephone: attempt.payloadTelephone,
        hasIdempotencyField: attempt.payloadHasIdempotencyField,
      },
      keyMatchesPayload: attempt.keyMatchesPayload,
      createdAt: attempt.createdAt,
      updatedAt: attempt.updatedAt,
    },
    confirmed: confirmed0,
    abandoned: abandoned0,
    otherFp,
    histAttemptsFp,
    rdvFp,
    mock: {
      scenario: mock0.scenario,
      posts: postCount(mock0),
      getAvailability: pathCount(mock0, 'GET /appointments/availability 200'),
      total: mock0.total,
      byPath: mock0.byPath,
      distinctKeys: mock0.distinctKeys,
    },
    mockSha,
    gov: gov0,
    mailpit: { messages: mail0.Messages, unread: mail0.Unread, dbSize: mail0.DatabaseSize },
    checks: {
      workflowOk,
      pgOk,
      sessionOk,
      attemptFieldsOk,
      temporalOk,
      mockExpectedOk,
      liveOk,
    },
  };

  const result = {
    phase: '8F-2B34',
    sessionId,
    targetAttemptId,
    chatInputAuthorized: 'oui',
    executed: false,
    messageSent: false,
    activationPerformed: false,
    postCreateAppointmentPerformed: false,
    stopped: true,
    stopReasons,
    verdict: 'FAIL',
    goNoGo: 'NO-GO',
    note:
      'STOP bloquant avant activation: tentative AWAITING_CONFIRMATION expirée (secsLeft négatif). Aucun TTL prolongé. Aucun message oui. Aucun POST. Conteneurs TEST redémarrés pour accès lecture seule (compteurs mock remis à 0 — écart expliqué).',
    preflight,
  };

  fs.writeFileSync(path.join(outDir, 'PREFLIGHT.json'), JSON.stringify(preflight, null, 2));
  fs.writeFileSync(path.join(outDir, 'STOP.json'), JSON.stringify(result, null, 2));
  fs.writeFileSync(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2));
  try {
    fs.unlinkSync(path.join(outDir, '_mock.js'));
  } catch {}
  try {
    fs.unlinkSync(path.join(outDir, '_net.js'));
  } catch {}

  console.log(JSON.stringify(result, null, 2));
  process.exit(2);
})().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
