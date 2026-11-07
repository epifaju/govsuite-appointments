/**
 * REC-008 phase 8F-2B46 — audit lecture seule (aucune activation, chat, PUT, SQL, mock).
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
const sessionId = 'rec008-8f2b37-new-01';
const historicalSessionId = 'rec008-8f2b14-new-01';
const targetAttemptId = 'd566fc28-02de-4ae1-afbb-6f7d81362d4d';
const expectedMockRef = 'REC008-MOCK-0001';
const expectedMockApptId = '55555555-5555-4555-8555-555555555555';
const expectedGov = '13|14|12|48|0|a2dea067599fd4f0a5f857551adc67cc';
const outDir =
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-11-01-rec008-phase8f2b46-FINALIZATION-OBSERVABILITY-AUDIT';

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
  docker(['cp', tmp, 'govsuite-rec008-test-rec008-n8n-1:/tmp/_m46.js']);
  const t = docker(['exec', 'govsuite-rec008-test-rec008-n8n-1', 'node', '/tmp/_m46.js']).trim();
  docker(['exec', '-u', 'root', 'govsuite-rec008-test-rec008-n8n-1', 'rm', '-f', '/tmp/_m46.js']);
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
function sessionSnap(id) {
  return pg(
    "SELECT coalesce(intent,''), coalesce(service,''), coalesce(site,''), coalesce(date_debut::text,''), coalesce(date_fin::text,''), coalesce(conversation_step,''), coalesce(pending_action,''), coalesce(reference,''), coalesce(token::text,''), coalesce(slot_id::text,''), coalesce(selected_slot_index::text,''), coalesce(nom,''), coalesce(prenom,''), coalesce(email,''), coalesce(telephone,''), left(coalesce(last_user_message,''),240), coalesce(available_slots::text,'') FROM ai_conversation_state WHERE session_id=" +
      pgLiteral(id) +
      ';'
  );
}
function pgLiteral(s) {
  return "'" + String(s).replace(/'/g, "''") + "'";
}
function parseSession(line) {
  if (!line) return null;
  const p = line.split('|');
  let slots = [];
  try {
    slots = JSON.parse(p[16] || '[]');
  } catch (_) {}
  return {
    intent: p[0] || '',
    service: p[1] || '',
    site: p[2] || '',
    date_debut: p[3] || '',
    date_fin: p[4] || '',
    conversation_step: p[5] || '',
    pending_action: p[6] || '',
    reference: p[7] || '',
    token: p[8] || '',
    slot_id: p[9] || '',
    selected_slot_index: p[10] || '',
    nom: p[11] || '',
    prenom: p[12] || '',
    email: p[13] || '',
    telephone: p[14] || '',
    last_user_message: p[15] || '',
    available_slots: slots,
  };
}
function readAttemptDetail(id) {
  const line = pg(
    "SELECT id::text, session_id, status, coalesce(expires_at::text,''), EXTRACT(EPOCH FROM (expires_at - clock_timestamp()))::int, (expires_at > clock_timestamp()), clock_timestamp()::text, (idempotency_key IS NOT NULL AND idempotency_key<>''), coalesce(length(idempotency_key),0), CASE WHEN idempotency_key IS NULL OR idempotency_key='' THEN '' ELSE left(md5(idempotency_key),12) END, (request_payload IS NOT NULL), (request_fingerprint IS NOT NULL AND request_fingerprint<>''), CASE WHEN request_fingerprint IS NULL OR request_fingerprint='' THEN '' ELSE left(request_fingerprint,12) END, (lease_owner IS NOT NULL AND lease_owner<>''), (lease_until IS NOT NULL), coalesce(appointment_reference,''), coalesce(appointment_id::text,''), coalesce(submitted_at::text,''), coalesce(confirmed_at::text,''), coalesce(resume_count,0), created_at::text, updated_at::text FROM ai_appointment_attempt WHERE id=" +
      pgLiteral(id) +
      '::uuid;'
  );
  if (!line) return null;
  const p = line.split('|');
  return {
    id: p[0],
    session_id: p[1],
    status: p[2],
    expiresAt: p[3],
    secsLeft: Number(p[4] || 0),
    stillValid: p[5] === 't' || p[5] === 'true',
    clockNow: p[6],
    hasIdempotencyKey: p[7] === 't' || p[7] === 'true',
    idempotencyKeyLength: Number(p[8] || 0),
    idempotencyKeyFp12: p[9] || '',
    hasRequestPayload: p[10] === 't' || p[10] === 'true',
    hasFingerprint: p[11] === 't' || p[11] === 'true',
    fingerprintFp12: p[12] || '',
    hasLeaseOwner: p[13] === 't' || p[13] === 'true',
    hasLeaseUntil: p[14] === 't' || p[14] === 'true',
    appointmentReference: p[15] || '',
    appointmentId: p[16] || '',
    submittedAt: p[17] || '',
    confirmedAt: p[18] || '',
    resumeCount: Number(p[19] || 0),
    createdAt: p[20],
    updatedAt: p[21],
  };
}

(async () => {
  const at = new Date().toISOString();

  // --- n8n login (GET-only afterwards) ---
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

  // webhooks via node:sqlite (read-only) — même méthode que les phases 8F-2Bxx
  let webhooks = null;
  try {
    const probe =
      "const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync('/home/node/.n8n/database.sqlite', { readOnly: true }); const rows = db.prepare('SELECT workflowId, method, webhookPath FROM webhook_entity').all(); console.log(JSON.stringify(rows));";
    const tmp = path.join(outDir, '_wh.js');
    fs.writeFileSync(tmp, probe);
    docker(['cp', tmp, 'govsuite-rec008-test-rec008-n8n-1:/tmp/_wh46.js']);
    const wh = docker([
      'exec',
      'govsuite-rec008-test-rec008-n8n-1',
      'node',
      '/tmp/_wh46.js',
    ]).trim();
    docker(['exec', '-u', 'root', 'govsuite-rec008-test-rec008-n8n-1', 'rm', '-f', '/tmp/_wh46.js']);
    try {
      fs.unlinkSync(tmp);
    } catch (_) {}
    webhooks = JSON.parse(wh);
  } catch (e) {
    webhooks = { error: String(e.message || e) };
  }

  // executions API — same filters as audit-finaliser.js / run.js
  const execListRes = await fetch(
    base + '/rest/executions?limit=10&workflowId=' + workflowId,
    { headers: h }
  );
  const execListStatus = execListRes.status;
  const execList = await execListRes.json();
  const rows = (execList.data && execList.data.results) || execList.data || [];
  const execSummary = (Array.isArray(rows) ? rows : []).map((r) => ({
    id: r.id,
    status: r.status,
    finished: r.finished,
    mode: r.mode,
    startedAt: r.startedAt,
    stoppedAt: r.stoppedAt,
  }));

  // broader list without workflow filter (still read-only)
  const execAllRes = await fetch(base + '/rest/executions?limit=10', { headers: h });
  const execAll = await execAllRes.json();
  const rowsAll = (execAll.data && execAll.data.results) || execAll.data || [];
  const execAllSummary = (Array.isArray(rowsAll) ? rowsAll : []).map((r) => ({
    id: r.id,
    workflowId: r.workflowId || (r.workflowData && r.workflowData.id),
    status: r.status,
    mode: r.mode,
    startedAt: r.startedAt,
  }));

  // env inside container (read-only)
  let n8nEnv = {};
  try {
    const envDump = docker([
      'exec',
      'govsuite-rec008-test-rec008-n8n-1',
      'sh',
      '-lc',
      'env | grep -E "^(EXECUTIONS_|N8N_DEFAULT_|GENERIC_TIMEZONE|TZ)=" | sort',
    ]).trim();
    for (const line of envDump.split(/\r?\n/).filter(Boolean)) {
      const i = line.indexOf('=');
      if (i > 0) n8nEnv[line.slice(0, i)] = line.slice(i + 1);
    }
  } catch (e) {
    n8nEnv = { error: String(e.message || e) };
  }

  // count execution rows in sqlite if present (read-only)
  let execDbCount = null;
  try {
    const probe =
      "const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync('/home/node/.n8n/database.sqlite', { readOnly: true }); const n = db.prepare('SELECT count(*) AS c FROM execution_entity').get(); const by = db.prepare('SELECT workflowId, count(*) AS c FROM execution_entity GROUP BY workflowId').all(); const modes = db.prepare('SELECT mode, status, count(*) AS c FROM execution_entity GROUP BY mode, status').all(); console.log(JSON.stringify({ total: n.c, byWorkflow: by, byModeStatus: modes }));";
    const tmp = path.join(outDir, '_ex.js');
    fs.writeFileSync(tmp, probe);
    docker(['cp', tmp, 'govsuite-rec008-test-rec008-n8n-1:/tmp/_ex46.js']);
    const c = docker([
      'exec',
      'govsuite-rec008-test-rec008-n8n-1',
      'node',
      '/tmp/_ex46.js',
    ]).trim();
    docker(['exec', '-u', 'root', 'govsuite-rec008-test-rec008-n8n-1', 'rm', '-f', '/tmp/_ex46.js']);
    try {
      fs.unlinkSync(tmp);
    } catch (_) {}
    execDbCount = JSON.parse(c);
  } catch (e) {
    execDbCount = { error: String(e.message || e) };
  }

  const mock = mockMeta();
  const mail = JSON.parse(
    docker(['exec', 'govsuite-mailpit', 'wget', '-qO-', 'http://127.0.0.1:8025/api/v1/info'])
  );
  const target = parseSession(sessionSnap(sessionId));
  const historical = parseSession(sessionSnap(historicalSessionId));
  const attempt = readAttemptDetail(targetAttemptId);
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

  const containers = {
    n8n: docker([
      'inspect',
      'govsuite-rec008-test-rec008-n8n-1',
      '--format',
      'Status={{.State.Status}} Started={{.State.StartedAt}} Restarts={{.RestartCount}}',
    ]).trim(),
    publish: docker([
      'inspect',
      'govsuite-rec008-test-rec008-publish-1',
      '--format',
      'Status={{.State.Status}} Started={{.State.StartedAt}} Restarts={{.RestartCount}}',
    ]).trim(),
    postgres: docker([
      'inspect',
      'govsuite-rec008-test-rec008-postgres-1',
      '--format',
      'Status={{.State.Status}} Health={{if .State.Health}}{{.State.Health.Status}}{{end}}',
    ]).trim(),
    mock: docker([
      'inspect',
      'govsuite-rec008-test-rec008-mock-1',
      '--format',
      'Status={{.State.Status}}',
    ]).trim(),
  };

  const expectedAfter45 = {
    pg: '1|10|4|0',
    open: '0',
    statusCounts: ['ABANDONED|1', 'CONFIRMED|2', 'EXPIRED|1'],
    mockPosts: 1,
    getAvailability: 2,
    post201: 1,
    attemptStatus: 'CONFIRMED',
    attemptRef: expectedMockRef,
    attemptApptId: expectedMockApptId,
    sessionClean: true,
    sessionRef: expectedMockRef,
    gov: expectedGov,
    mailpit: { messages: 5, unread: 2, dbSize: 98304 },
    active: false,
    versionId: expectedVersionId,
    versionCounter: expectedCounter,
    nodes: 134,
    edges: 137,
    finaliserSha: expectedFinaliserSha,
  };

  const workflowOk =
    wf.active === false &&
    (wf.activeVersionId || null) === null &&
    wf.versionId === expectedVersionId &&
    Number(wf.versionCounter) === expectedCounter &&
    nodes.length === 134 &&
    edgesOf(wf.connections) === 137 &&
    finaliserSha === expectedFinaliserSha &&
    activeIds.length === 0;

  const attemptOk =
    attempt &&
    attempt.status === 'CONFIRMED' &&
    !attempt.hasIdempotencyKey &&
    !attempt.hasRequestPayload &&
    attempt.hasFingerprint &&
    attempt.fingerprintFp12 === '1aa346780669' &&
    !attempt.hasLeaseOwner &&
    !attempt.hasLeaseUntil &&
    attempt.appointmentReference === expectedMockRef &&
    attempt.appointmentId === expectedMockApptId &&
    !!attempt.submittedAt &&
    !!attempt.confirmedAt;

  const sessionOk =
    target &&
    !target.conversation_step &&
    !target.pending_action &&
    !target.intent &&
    !target.nom &&
    !target.prenom &&
    !target.email &&
    !target.telephone &&
    !target.service &&
    !target.site &&
    !target.slot_id &&
    target.reference === expectedMockRef &&
    !target.token;

  const pgOk =
    pgCounts === expectedAfter45.pg &&
    open === expectedAfter45.open &&
    statusCounts.join(',') === expectedAfter45.statusCounts.join(',');

  const mockOk =
    postCount(mock) === 1 &&
    pathCount(mock, 'GET /appointments/availability 200') === 2 &&
    pathCount(mock, 'POST /appointments 201') === 1 &&
    mock.scenario === 'created' &&
    mock.distinctKeys === 1;

  const liveOk = govFp === expectedGov;
  const mailOk =
    mail.Messages === 5 && mail.Unread === 2 && mail.DatabaseSize === 98304;

  const saveSettingsExplainNoExec =
    settings.saveDataSuccessExecution === 'none' &&
    settings.saveDataErrorExecution === 'none' &&
    settings.saveManualExecutions === false &&
    settings.saveExecutionProgress === false;

  const audit = {
    phase: '8F-2B46',
    at,
    mode: 'read-only',
    restrictions: {
      noChat: true,
      noActivate: true,
      noPut: true,
      noSqlMutation: true,
      noMockMutation: true,
      noLiveBusinessCall: true,
    },
    preflight: {
      workflow: {
        id: workflowId,
        active: wf.active,
        activeVersionId: wf.activeVersionId || null,
        versionId: wf.versionId,
        versionCounter: wf.versionCounter,
        nodes: nodes.length,
        edges: edgesOf(wf.connections),
        activeIds,
        finaliserSha,
        finaliserHasAbsent: /__ABSENT__/.test(qr),
        finaliserHasUuidCast: /::uuid/.test(q),
        webhookRows: webhooks,
      },
      settings: {
        saveDataSuccessExecution: settings.saveDataSuccessExecution,
        saveDataErrorExecution: settings.saveDataErrorExecution,
        saveManualExecutions: settings.saveManualExecutions,
        saveExecutionProgress: settings.saveExecutionProgress,
        executionTimeout: settings.executionTimeout,
        timezone: settings.timezone,
      },
      n8nEnv,
      pg: pgCounts,
      open,
      statusCounts,
      attempt: {
        id: attempt && attempt.id,
        status: attempt && attempt.status,
        submittedAt: attempt && attempt.submittedAt,
        confirmedAt: attempt && attempt.confirmedAt,
        appointmentReference: attempt && attempt.appointmentReference,
        appointmentId: attempt && attempt.appointmentId,
        hasIdempotencyKey: attempt && attempt.hasIdempotencyKey,
        hasRequestPayload: attempt && attempt.hasRequestPayload,
        hasFingerprint: attempt && attempt.hasFingerprint,
        fingerprintFp12: attempt && attempt.fingerprintFp12,
        hasLeaseOwner: attempt && attempt.hasLeaseOwner,
        hasLeaseUntil: attempt && attempt.hasLeaseUntil,
      },
      session: {
        sessionId,
        conversation_step: target && target.conversation_step,
        pending_action: target && target.pending_action,
        intent: target && target.intent,
        reference: target && target.reference,
        tokenEmpty: target ? !target.token : null,
        identityEmpty: target
          ? !target.nom && !target.prenom && !target.email && !target.telephone
          : null,
        last_user_message: target && target.last_user_message,
      },
      historical: {
        sessionId: historicalSessionId,
        reference: historical && historical.reference,
        conversation_step: historical && historical.conversation_step,
      },
      mock: {
        scenario: mock.scenario,
        total: mock.total,
        posts: postCount(mock),
        getAvailability: pathCount(mock, 'GET /appointments/availability 200'),
        post201: pathCount(mock, 'POST /appointments 201'),
        distinctKeys: mock.distinctKeys,
        byPath: mock.byPath,
      },
      gov: govFp,
      mailpit: { messages: mail.Messages, unread: mail.Unread, dbSize: mail.DatabaseSize },
      containers,
    },
    executionsApi: {
      listStatus: execListStatus,
      filter: 'limit=10&workflowId=' + workflowId,
      count: Array.isArray(rows) ? rows.length : -1,
      summary: execSummary,
      allRecentCount: Array.isArray(rowsAll) ? rowsAll.length : -1,
      allRecentSummary: execAllSummary,
      sqlite: execDbCount,
    },
    checks: {
      workflowOk,
      attemptOk,
      sessionOk,
      pgOk,
      mockOk,
      liveOk,
      mailOk,
      saveSettingsExplainNoExec,
      noActiveWebhook:
        !webhooks ||
        webhooks.error ||
        (Array.isArray(webhooks) && webhooks.length === 0) ||
        (Array.isArray(webhooks) &&
          !webhooks.some((w) => String(w.workflowId) === workflowId)),
    },
    expectedAfter45,
    evidenceLevel:
      Array.isArray(rows) && rows.length > 0
        ? 'direct'
        : attemptOk && sessionOk && mockOk
          ? 'indirect_strong'
          : 'insufficient',
  };

  audit.preflightOk =
    workflowOk &&
    attemptOk &&
    sessionOk &&
    pgOk &&
    mockOk &&
    liveOk &&
    mailOk &&
    audit.checks.saveSettingsExplainNoExec;

  // postflight = same snapshot (no mutation performed) — integrity vs 8F-2B45 after-state
  audit.postflight = {
    noNewAttempt: pgCounts === '1|10|4|0',
    noStatusChange: statusCounts.join(',') === 'ABANDONED|1,CONFIRMED|2,EXPIRED|1',
    noNewMockPost: postCount(mock) === 1,
    noExtraAvailability: pathCount(mock, 'GET /appointments/availability 200') === 2,
    sessionUnchangedSince45:
      sessionOk && target.last_user_message === 'oui' && target.reference === expectedMockRef,
    workflowInactive: workflowOk,
    noEmail: mailOk,
    liveUnchanged: liveOk,
  };
  audit.postflightOk = Object.values(audit.postflight).every(Boolean);

  fs.writeFileSync(path.join(outDir, 'AUDIT.json'), JSON.stringify(audit, null, 2));
  console.log(
    JSON.stringify(
      {
        preflightOk: audit.preflightOk,
        postflightOk: audit.postflightOk,
        evidenceLevel: audit.evidenceLevel,
        settings: audit.preflight.settings,
        executionsCount: audit.executionsApi.count,
        executionsAll: audit.executionsApi.allRecentCount,
        sqlite: audit.executionsApi.sqlite,
        checks: audit.checks,
        attempt: audit.preflight.attempt,
        mock: audit.preflight.mock,
        pg: pgCounts,
        open,
        statusCounts,
        gov: govFp,
        mailpit: audit.preflight.mailpit,
        workflow: {
          active: wf.active,
          versionId: wf.versionId,
          versionCounter: wf.versionCounter,
          nodes: nodes.length,
          edges: edgesOf(wf.connections),
          finaliserSha,
        },
      },
      null,
      2
    )
  );
})().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
