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
const expectedGov = '13|14|12|48|0|a2dea067599fd4f0a5f857551adc67cc';
const outDir =
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-31-rec008-phase8f2b35-EXPIRATION-AUDIT';

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
  docker(['cp', tmp, 'govsuite-rec008-test-rec008-n8n-1:/tmp/_m35.js']);
  const t = docker(['exec', 'govsuite-rec008-test-rec008-n8n-1', 'node', '/tmp/_m35.js']).trim();
  docker(['exec', '-u', 'root', 'govsuite-rec008-test-rec008-n8n-1', 'rm', '-f', '/tmp/_m35.js']);
  return JSON.parse(t);
}
function networkOk() {
  const netProbe = fs.readFileSync('C:/Users/epifa/AppData/Local/Temp/rec008-8f1-net.js', 'utf8');
  const tmp = path.join(outDir, '_net.js');
  fs.writeFileSync(tmp, netProbe);
  docker(['cp', tmp, 'govsuite-rec008-test-rec008-n8n-1:/tmp/_n35.js']);
  const text = docker(['exec', 'govsuite-rec008-test-rec008-n8n-1', 'node', '/tmp/_n35.js']);
  docker(['exec', '-u', 'root', 'govsuite-rec008-test-rec008-n8n-1', 'rm', '-f', '/tmp/_n35.js']);
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
  if (!cookie) throw new Error('login failed');
  const headers = { cookie, accept: 'application/json', 'content-type': 'application/json' };

  const main = (await (await fetch(base + '/rest/workflows/' + workflowId, { headers })).json()).data;
  const listed =
    (await (await fetch(base + '/rest/workflows?limit=50', { headers })).json()).data || [];
  const chat = main.nodes.find((n) => n.name === "Lorsqu'un message de chat est reçu");
  const finaliser = main.nodes.find((n) => n.name === 'Finaliser état création');
  const expireNode = main.nodes.find((n) => n.name === 'Expirer tentatives en attente');
  const decideNode = main.nodes.find((n) => n.name === 'Décider action tentative');
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

  const beforeFp = {
    pg: pg(
      'SELECT (SELECT count(*) FROM rendez_vous),(SELECT count(*) FROM ai_conversation_state),(SELECT count(*) FROM ai_appointment_attempt),(SELECT count(*) FROM notifications);'
    ),
    open: pg(
      "SELECT count(*) FROM ai_appointment_attempt WHERE status IN ('AWAITING_CONFIRMATION','SUBMITTING','UNCERTAIN');"
    ),
    statusCounts: pg(
      "SELECT status || '|' || count(*)::text FROM ai_appointment_attempt GROUP BY status ORDER BY status;"
    )
      .split(/\r?\n/)
      .filter(Boolean),
    otherSessions: pg(
      `SELECT md5(string_agg(session_id || '|' || coalesce(conversation_step,'') || '|' || coalesce(reference,'') || '|' || coalesce(token::text,'') || '|' || coalesce(intent,'') || '|' || coalesce(updated_at::text,''), ',' ORDER BY session_id)) FROM ai_conversation_state WHERE session_id <> '${sessionId}';`
    ),
    allAttempts: pg(
      `SELECT md5(string_agg(id::text || '|' || session_id || '|' || status || '|' || coalesce(appointment_reference,'') || '|' || coalesce(updated_at::text,''), ',' ORDER BY id)) FROM ai_appointment_attempt;`
    ),
    targetSession: pg(
      `SELECT md5(session_id || '|' || coalesce(conversation_step,'') || '|' || coalesce(pending_action,'') || '|' || coalesce(reference,'') || '|' || coalesce(telephone,'') || '|' || coalesce(updated_at::text,'')) FROM ai_conversation_state WHERE session_id='${sessionId}';`
    ),
    targetAttempt: pg(
      `SELECT md5(id::text || '|' || status || '|' || expires_at::text || '|' || coalesce(updated_at::text,'') || '|' || (idempotency_key IS NOT NULL)::text || '|' || (request_payload IS NOT NULL)::text) FROM ai_appointment_attempt WHERE id='${targetAttemptId}'::uuid;`
    ),
    rdv: pg(
      `SELECT md5(string_agg(id::text || '|' || coalesce(reference,'') || '|' || coalesce(updated_at::text,''), ',' ORDER BY id)) FROM rendez_vous;`
    ),
    gov: gov(),
    mailpit: JSON.parse(
      docker(['exec', 'govsuite-mailpit', 'wget', '-qO-', 'http://127.0.0.1:8025/api/v1/info'])
    ),
    mock: {
      scenario: mock0.scenario,
      total: mock0.total,
      posts: postCount(mock0),
      getAvailability: pathCount(mock0, 'GET /appointments/availability 200'),
      byPath: mock0.byPath,
      distinctKeys: mock0.distinctKeys,
    },
  };

  const attemptLine = pg(
    `SELECT id::text, session_id, status, expires_at::text, clock_timestamp()::text, EXTRACT(EPOCH FROM (clock_timestamp() - expires_at))::int, EXTRACT(EPOCH FROM (expires_at - created_at))::int, (expires_at > clock_timestamp()), (idempotency_key IS NOT NULL), length(coalesce(idempotency_key::text,'')), left(md5(coalesce(idempotency_key::text,'')),12), (request_payload IS NOT NULL), (request_fingerprint IS NOT NULL AND request_fingerprint ~ '^[0-9a-f]{64}$'), left(coalesce(request_fingerprint,''),12), coalesce(lease_owner,''), coalesce(lease_until::text,''), coalesce(appointment_reference,''), coalesce(appointment_id::text,''), coalesce(submitted_at::text,''), coalesce(confirmed_at::text,''), coalesce(request_payload->>'slotId',''), (request_payload->>'cleIdempotence' = idempotency_key::text), created_at::text, updated_at::text FROM ai_appointment_attempt WHERE id='${targetAttemptId}'::uuid;`
  );
  const ap = attemptLine.split('|');
  const sessionLine = pg(
    `SELECT coalesce(conversation_step,''), coalesce(pending_action,''), coalesce(service,''), coalesce(site,''), coalesce(date_debut::text,''), coalesce(slot_id::text,''), coalesce(nom,''), coalesce(prenom,''), coalesce(email,''), (telephone IS NOT NULL AND telephone <> ''), coalesce(reference,''), coalesce(intent,'') FROM ai_conversation_state WHERE session_id='${sessionId}';`
  );
  const sp = sessionLine.split('|');
  const fnDefs = pg(
    `SELECT p.proname, md5(pg_get_functiondef(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('expirer_tentatives_en_attente','reclamer_tentative_rendez_vous','reprendre_tentative_rendez_vous') ORDER BY 1;`
  )
    .split(/\r?\n/)
    .filter(Boolean);
  const fnExpireBody = pg(
    `SELECT pg_get_functiondef('public.expirer_tentatives_en_attente()'::regprocedure);`
  );
  const indexes = pg(
    `SELECT indexname || '|' || indexdef FROM pg_indexes WHERE tablename='ai_appointment_attempt' AND indexname LIKE 'uq_%' ORDER BY 1;`
  )
    .split(/\r?\n/)
    .filter(Boolean);
  const confirmed0 = pg(
    `SELECT status, coalesce(appointment_reference,''), (idempotency_key IS NOT NULL), (request_payload IS NOT NULL), coalesce(updated_at::text,'') FROM ai_appointment_attempt WHERE id='${confirmedAttemptId}'::uuid;`
  );
  const abandoned0 = pg(
    `SELECT status, coalesce(appointment_reference,''), (idempotency_key IS NOT NULL), (request_payload IS NOT NULL), coalesce(updated_at::text,'') FROM ai_appointment_attempt WHERE id='${abandonedAttemptId}'::uuid;`
  );
  const histSession = pg(
    `SELECT coalesce(conversation_step,''), coalesce(pending_action,''), coalesce(reference,'') FROM ai_conversation_state WHERE session_id='${historicalSessionId}';`
  );
  const openSameSession = pg(
    `SELECT count(*) FROM ai_appointment_attempt WHERE session_id='${sessionId}' AND status IN ('AWAITING_CONFIRMATION','SUBMITTING','UNCERTAIN');`
  );
  const cronLike = main.nodes
    .filter((n) => /cron|schedule|interval/i.test(n.type) || /cron|schedule/i.test(n.name || ''))
    .map((n) => ({ name: n.name, type: n.type }));

  const expireInbound = [];
  for (const [from, outs] of Object.entries(main.connections || {})) {
    for (const groups of Object.values(outs || {})) {
      for (const g of groups || []) {
        for (const edge of g || []) {
          if (edge.node === 'Expirer tentatives en attente') expireInbound.push(from);
        }
      }
    }
  }

  const attempt = {
    id: ap[0],
    session_id: ap[1],
    status: ap[2],
    expiresAt: ap[3],
    dbNow: ap[4],
    secondsSinceExpiry: Number(ap[5] || 0),
    ttlSecondsAtCreate: Number(ap[6] || 0),
    stillValid: ap[7] === 't' || ap[7] === 'true',
    hasIdempotencyKey: ap[8] === 't' || ap[8] === 'true',
    idempotencyKeyLength: Number(ap[9] || 0),
    idempotencyKeyFp12: ap[10],
    hasRequestPayload: ap[11] === 't' || ap[11] === 'true',
    hasFingerprint: ap[12] === 't' || ap[12] === 'true',
    fingerprintFp12: ap[13],
    hasLeaseOwner: !!(ap[14] && ap[14].trim()),
    hasLeaseUntil: !!(ap[15] && ap[15].trim()),
    appointmentReference: ap[16] || '',
    appointmentId: ap[17] || '',
    submittedAt: ap[18] || '',
    confirmedAt: ap[19] || '',
    payloadSlotId: ap[20],
    keyMatchesPayload: ap[21] === 't' || ap[21] === 'true',
    createdAt: ap[22],
    updatedAt: ap[23],
  };

  // Simulate decide logic offline (no chat)
  const waitExpired = !attempt.stillValid;
  const simulatedOuiAction =
    attempt.status === 'AWAITING_CONFIRMATION' && waitExpired
      ? 'EXPIRE'
      : attempt.status === 'AWAITING_CONFIRMATION'
        ? 'CLAIM'
        : 'OTHER';

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
      expireNodePresent: !!expireNode,
      expireQuery: expireNode && expireNode.parameters && expireNode.parameters.query,
      expireInbound,
      decidePresent: !!decideNode,
      cronLikeNodes: cronLike,
    },
    beforeFp,
    attempt,
    session: {
      conversation_step: sp[0],
      pending_action: sp[1],
      service: sp[2],
      site: sp[3],
      date_debut: sp[4],
      slot_id: sp[5],
      nomPresent: !!sp[6],
      prenomPresent: !!sp[7],
      emailPresent: !!sp[8],
      telephonePresent: sp[9] === 't' || sp[9] === 'true',
      reference: sp[10],
      intent: sp[11],
    },
    historical: {
      confirmed: confirmed0,
      abandoned: abandoned0,
      histSession,
      openSameSession,
    },
    sql: {
      functionDigests: fnDefs,
      expireFunctionPresent: /status = 'EXPIRED'/.test(fnExpireBody),
      expirePurgesSecrets: /idempotency_key = NULL/.test(fnExpireBody) && /request_payload = NULL/.test(fnExpireBody),
      expireTouchesConversation: /ai_conversation_state/.test(fnExpireBody),
      uniqueIndexes: indexes,
    },
    lateOuiSimulation: {
      waitExpired,
      simulatedAttemptAction: simulatedOuiAction,
      claimBlockedBySql: true,
      note: 'Décider action tentative prioritise waitExpired → EXPIRE avant AFFIRM → CLAIM',
    },
  };

  // Integrity after read-only audit (same queries)
  const afterFp = {
    pg: pg(
      'SELECT (SELECT count(*) FROM rendez_vous),(SELECT count(*) FROM ai_conversation_state),(SELECT count(*) FROM ai_appointment_attempt),(SELECT count(*) FROM notifications);'
    ),
    open: pg(
      "SELECT count(*) FROM ai_appointment_attempt WHERE status IN ('AWAITING_CONFIRMATION','SUBMITTING','UNCERTAIN');"
    ),
    otherSessions: pg(
      `SELECT md5(string_agg(session_id || '|' || coalesce(conversation_step,'') || '|' || coalesce(reference,'') || '|' || coalesce(token::text,'') || '|' || coalesce(intent,'') || '|' || coalesce(updated_at::text,''), ',' ORDER BY session_id)) FROM ai_conversation_state WHERE session_id <> '${sessionId}';`
    ),
    allAttempts: pg(
      `SELECT md5(string_agg(id::text || '|' || session_id || '|' || status || '|' || coalesce(appointment_reference,'') || '|' || coalesce(updated_at::text,''), ',' ORDER BY id)) FROM ai_appointment_attempt;`
    ),
    targetSession: pg(
      `SELECT md5(session_id || '|' || coalesce(conversation_step,'') || '|' || coalesce(pending_action,'') || '|' || coalesce(reference,'') || '|' || coalesce(telephone,'') || '|' || coalesce(updated_at::text,'')) FROM ai_conversation_state WHERE session_id='${sessionId}';`
    ),
    targetAttempt: pg(
      `SELECT md5(id::text || '|' || status || '|' || expires_at::text || '|' || coalesce(updated_at::text,'') || '|' || (idempotency_key IS NOT NULL)::text || '|' || (request_payload IS NOT NULL)::text) FROM ai_appointment_attempt WHERE id='${targetAttemptId}'::uuid;`
    ),
    rdv: pg(
      `SELECT md5(string_agg(id::text || '|' || coalesce(reference,'') || '|' || coalesce(updated_at::text,''), ',' ORDER BY id)) FROM rendez_vous;`
    ),
    gov: gov(),
    mailpit: JSON.parse(
      docker(['exec', 'govsuite-mailpit', 'wget', '-qO-', 'http://127.0.0.1:8025/api/v1/info'])
    ),
    mock: mockMeta(),
  };

  const workflowOk =
    main.active === false &&
    (main.activeVersionId || null) === null &&
    main.versionId === versionId &&
    main.versionCounter === expectedCounter &&
    main.nodes.length === 134 &&
    edgesOf(main.connections) === 137 &&
    listed.filter((r) => r.active).length === 0 &&
    postgres.join() === 'Fs0l0058q5CEadRw' &&
    ollama &&
    ollama.credentials.ollamaApi.id === 'dxzHqBq8Q60R8BOz' &&
    preflight.workflow.urlsOk &&
    finaliserSha === expectedFinaliserSha &&
    netOk;

  const pgOk = beforeFp.pg === '1|9|3|0' && beforeFp.open === '1';
  const liveOk =
    beforeFp.gov === expectedGov &&
    beforeFp.mailpit.Messages === 5 &&
    beforeFp.mailpit.Unread === 2 &&
    beforeFp.mailpit.DatabaseSize === 98304;

  const integrityOk =
    afterFp.pg === beforeFp.pg &&
    afterFp.open === beforeFp.open &&
    afterFp.otherSessions === beforeFp.otherSessions &&
    afterFp.allAttempts === beforeFp.allAttempts &&
    afterFp.targetSession === beforeFp.targetSession &&
    afterFp.targetAttempt === beforeFp.targetAttempt &&
    afterFp.rdv === beforeFp.rdv &&
    afterFp.gov === beforeFp.gov &&
    afterFp.mailpit.Messages === beforeFp.mailpit.Messages &&
    afterFp.mailpit.Unread === beforeFp.mailpit.Unread &&
    afterFp.mailpit.DatabaseSize === beforeFp.mailpit.DatabaseSize &&
    postCount(afterFp.mock) === beforeFp.mock.posts &&
    afterFp.mock.total === beforeFp.mock.total;

  const pass = workflowOk && pgOk && liveOk && integrityOk && !!attempt.id && !attempt.stillValid;

  const result = {
    phase: '8F-2B35',
    readOnly: true,
    executedMutations: false,
    messageSent: false,
    activationPerformed: false,
    expirationFunctionCalled: false,
    pass,
    verdict: pass ? 'PASS' : 'FAIL',
    goCorrectivePhase: pass ? 'GO' : 'NO-GO',
    recommendedOption: 'A',
    preflight,
    afterFp: {
      pg: afterFp.pg,
      open: afterFp.open,
      otherSessions: afterFp.otherSessions,
      allAttempts: afterFp.allAttempts,
      targetSession: afterFp.targetSession,
      targetAttempt: afterFp.targetAttempt,
      rdv: afterFp.rdv,
      gov: afterFp.gov,
      mailpit: {
        messages: afterFp.mailpit.Messages,
        unread: afterFp.mailpit.Unread,
        dbSize: afterFp.mailpit.DatabaseSize,
      },
      mock: {
        scenario: afterFp.mock.scenario,
        total: afterFp.mock.total,
        posts: postCount(afterFp.mock),
        getAvailability: pathCount(afterFp.mock, 'GET /appointments/availability 200'),
      },
    },
    integrityOk,
    checks: { workflowOk, pgOk, liveOk, integrityOk },
  };

  fs.writeFileSync(path.join(outDir, 'PREFLIGHT.json'), JSON.stringify(preflight, null, 2));
  fs.writeFileSync(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2));
  try {
    fs.unlinkSync(path.join(outDir, '_mock.js'));
  } catch {}
  try {
    fs.unlinkSync(path.join(outDir, '_net.js'));
  } catch {}
  console.log(JSON.stringify(result, null, 2));
  process.exit(pass ? 0 : 4);
})().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
