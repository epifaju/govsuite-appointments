const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { execFileSync } = require('child_process');

const envText = fs.readFileSync(
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-30-rec008-phase8e2b2-TEST-DEPLOY/.env.rec008-test.local',
  'utf8'
);
const value = (n) => envText.match(new RegExp('^' + n + '=(.*)$', 'm'))[1];

const base = 'http://127.0.0.1:5682';
const workflowId = 'OCD9It1uKFhOoWNF';
const expectedVersion = 'e1b32992-bc68-46af-86ce-c80af46f5305';
const expectedCounter = 8;
const expectedFinaliserSha =
  '3fc500bfed99c202156005d252a864cdc25514c93e7e47c842ae896381e8ee7a';
const expectedGov = '13|14|12|48|0|a2dea067599fd4f0a5f857551adc67cc';
const expectedSessionId = 'rec008-8f2b14-new-01';
const expectedAttemptHint = 'ad71a155';
const expectedReference = 'REC008-MOCK-0001';
const expectedAbandonedHint = '8ae63b62';
const sqlProposalPath =
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-31-rec008-phase8f2b23-RECONCILIATION-RUNTIME-AUDIT/RECONCILE_CONFIRMED_SESSION.proposed.sql';
const outDir =
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-31-rec008-phase8f2b27-CONFIRMED-SESSION-RECONCILIATION';

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
  const q = (parameters && parameters.query) || '';
  const r =
    (parameters && parameters.options && parameters.options.queryReplacement) || '';
  return sha(q + '\n' + r);
}
function stop(reason, detail) {
  const payload = { ok: false, stopped: true, reason, detail, verdict: 'FAIL' };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'STOP.json'), JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
  process.exit(2);
}
function pg(sql) {
  return docker([
    'exec', '-i', 'govsuite-rec008-test-rec008-postgres-1',
    'psql', '-U', 'postgres', '-d', 'govsuite_rec008_test',
    '-t', '-A', '-F', '|', '-c', sql,
  ]).trim();
}
function pgJson(sql) {
  const text = docker([
    'exec', '-i', 'govsuite-rec008-test-rec008-postgres-1',
    'psql', '-U', 'postgres', '-d', 'govsuite_rec008_test',
    '-t', '-A', '-c', sql,
  ]).trim();
  if (!text) return null;
  return JSON.parse(text);
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
  docker(['cp', tmp, 'govsuite-rec008-test-rec008-n8n-1:/tmp/_m27.js']);
  const t = docker(['exec', 'govsuite-rec008-test-rec008-n8n-1', 'node', '/tmp/_m27.js']).trim();
  docker(['exec', '-u', 'root', 'govsuite-rec008-test-rec008-n8n-1', 'rm', '-f', '/tmp/_m27.js']);
  return JSON.parse(t);
}
function postCount(meta) {
  return Object.entries(meta.byPath || {})
    .filter(([k]) => /^POST \/appointments /.test(k) && !/cancel|reschedule/i.test(k))
    .reduce((n, [, v]) => n + Number(v || 0), 0);
}
function networkOk() {
  const netProbe = fs.readFileSync('C:/Users/epifa/AppData/Local/Temp/rec008-8f1-net.js', 'utf8');
  const tmp = path.join(outDir, '_net.js');
  fs.writeFileSync(tmp, netProbe);
  docker(['cp', tmp, 'govsuite-rec008-test-rec008-n8n-1:/tmp/_n27.js']);
  const text = docker(['exec', 'govsuite-rec008-test-rec008-n8n-1', 'node', '/tmp/_n27.js']);
  docker(['exec', '-u', 'root', 'govsuite-rec008-test-rec008-n8n-1', 'rm', '-f', '/tmp/_n27.js']);
  const net = JSON.parse(text);
  return !(net.results || []).some((r) => r.expect === 'forbidden' && r.tcp === 'open');
}
function esc(s) {
  return String(s).replace(/'/g, "''");
}

const RECONCILE_SQL = `
WITH confirmed AS (
  SELECT a.id, a.session_id, a.appointment_reference, a.appointment_id
  FROM public.ai_appointment_attempt a
  WHERE a.session_id = $1::text
    AND a.id = $2::uuid
    AND a.status = 'CONFIRMED'
    AND a.appointment_reference IS NOT NULL
    AND length(a.appointment_reference) >= 1
    AND a.appointment_reference = $3::text
),
updated AS (
  UPDATE public.ai_conversation_state s
  SET
    intent = NULL,
    service = NULL,
    site = NULL,
    date_debut = NULL,
    date_fin = NULL,
    slot_id = NULL,
    new_slot_id = NULL,
    available_slots = NULL,
    selected_slot_index = NULL,
    pending_action = NULL,
    conversation_step = NULL,
    nom = NULL,
    prenom = NULL,
    email = NULL,
    telephone = NULL,
    reference = c.appointment_reference,
    token = NULL,
    updated_at = clock_timestamp(),
    expires_at = clock_timestamp() + interval '2 hours'
  FROM confirmed c
  WHERE s.session_id = c.session_id
    AND s.session_id = $1::text
    AND (
      s.conversation_step = 'AWAIT_CREATE_CONFIRMATION'
      OR s.pending_action = 'CREATE_APPOINTMENT'
      OR coalesce(s.reference, '') = ''
    )
  RETURNING s.session_id, s.reference, s.conversation_step, s.pending_action, s.token
)
SELECT
  (SELECT count(*) FROM confirmed) AS confirmed_matched,
  (SELECT count(*) FROM updated) AS sessions_updated,
  (SELECT reference FROM updated LIMIT 1) AS reference_set,
  (SELECT conversation_step FROM updated LIMIT 1) AS step_after;
`;

function bindSql(sessionId, attemptId, reference) {
  // Literal substitution only after IDs were read from PG and validated (no generic wildcards).
  return RECONCILE_SQL
    .replace(/\$1::text/g, "'" + esc(sessionId) + "'::text")
    .replace(/\$2::uuid/g, "'" + esc(attemptId) + "'::uuid")
    .replace(/\$3::text/g, "'" + esc(reference) + "'::text");
}

function runReconcile(label, sessionId, attemptId, reference) {
  const sql = bindSql(sessionId, attemptId, reference);
  const sqlPath = path.join(outDir, label + '-query.sql');
  fs.writeFileSync(sqlPath, sql);
  const containerPath = '/tmp/' + label + '-query.sql';
  docker(['cp', sqlPath, 'govsuite-rec008-test-rec008-postgres-1:' + containerPath]);
  const out = docker([
    'exec', '-i', 'govsuite-rec008-test-rec008-postgres-1',
    'psql', '-U', 'postgres', '-d', 'govsuite_rec008_test',
    '-t', '-A', '-F', '|', '-f', containerPath,
  ]).trim();
  docker([
    'exec', 'govsuite-rec008-test-rec008-postgres-1',
    'rm', '-f', containerPath,
  ]);
  const parts = out.split('|');
  return {
    label,
    raw: out,
    confirmed_matched: Number(parts[0] || 0),
    sessions_updated: Number(parts[1] || 0),
    reference_set: parts[2] === '' || parts[2] === undefined ? null : parts[2],
    step_after: parts[3] === '' || parts[3] === undefined ? null : parts[3],
  };
}

(async () => {
  if (new URL(base).port !== '5682') throw new Error('mauvais port');
  fs.mkdirSync(outDir, { recursive: true });

  const proposal = fs.readFileSync(sqlProposalPath, 'utf8');
  fs.writeFileSync(path.join(outDir, 'RECONCILE_CONFIRMED_SESSION.executed.sql'), RECONCILE_SQL);

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

  const main = (await (await fetch(base + '/rest/workflows/' + workflowId, { headers: session })).json()).data;
  const listed =
    (await (await fetch(base + '/rest/workflows?limit=50', { headers: session })).json()).data || [];
  const finaliser = main.nodes.find((n) => n.name === 'Finaliser état création');
  const finaliserSha = finaliserCodeSha(finaliser.parameters);
  const chat = main.nodes.find((n) => n.name === "Lorsqu'un message de chat est reçu");
  const postgres = [
    ...new Set(
      main.nodes
        .filter((n) => n.credentials && n.credentials.postgres)
        .map((n) => n.credentials.postgres.id)
    ),
  ];
  const mock0 = mockMeta();
  const net = networkOk();
  const pg0 = pg(
    'SELECT (SELECT count(*) FROM rendez_vous),(SELECT count(*) FROM ai_conversation_state),(SELECT count(*) FROM ai_appointment_attempt),(SELECT count(*) FROM notifications);'
  );
  const statuses = pg('SELECT status, count(*) FROM ai_appointment_attempt GROUP BY 1 ORDER BY 1;');
  const open = pg(
    "SELECT count(*) FROM ai_appointment_attempt WHERE status IN ('AWAITING_CONFIRMATION','SUBMITTING','UNCERTAIN');"
  );
  const gov0 = gov();
  const mail0 = JSON.parse(
    docker(['exec', 'govsuite-mailpit', 'wget', '-qO-', 'http://127.0.0.1:8025/api/v1/info'])
  );

  const preflight = {
    active: main.active,
    activeVersionId: main.activeVersionId || null,
    versionId: main.versionId,
    versionCounter: main.versionCounter,
    nodes: main.nodes.length,
    edges: edgesOf(main.connections),
    activeIds: listed.filter((r) => r.active).map((r) => r.id),
    postgres,
    urlsOk:
      urlsOf(main.nodes).length === 10 &&
      urlsOf(main.nodes).every((u) => u.startsWith('http://rec008-mock:8080/')),
    networkOk: net,
    finaliserSha,
    chatWebhook: chat && chat.webhookId,
    pg: pg0,
    statuses,
    open,
    mockPosts: postCount(mock0),
    gov: gov0,
    mailpit: { messages: mail0.Messages, unread: mail0.Unread, dbSize: mail0.DatabaseSize },
  };
  fs.writeFileSync(path.join(outDir, 'PREFLIGHT.json'), JSON.stringify(preflight, null, 2));

  const preOk =
    main.active === false &&
    (main.activeVersionId || null) === null &&
    main.versionId === expectedVersion &&
    main.versionCounter === expectedCounter &&
    main.nodes.length === 134 &&
    edgesOf(main.connections) === 137 &&
    preflight.activeIds.length === 0 &&
    postgres.join() === 'Fs0l0058q5CEadRw' &&
    preflight.urlsOk &&
    net &&
    finaliserSha === expectedFinaliserSha &&
    pg0 === '1|8|2|0' &&
    open === '0' &&
    statuses === 'ABANDONED|1\nCONFIRMED|1' &&
    postCount(mock0) === 1 &&
    gov0 === expectedGov &&
    mail0.Messages === 5 &&
    mail0.Unread === 2 &&
    mail0.DatabaseSize === 98304;

  if (!preOk) stop('preflight', preflight);

  // --- Exact identities from PG (no abbreviation deduction) ---
  const confirmedRows = pgJson(`
    SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.id), '[]'::json)
    FROM (
      SELECT id::text AS id, session_id, status, appointment_reference,
             (idempotency_key IS NOT NULL) AS has_idempotency_key,
             (request_payload IS NOT NULL) AS has_request_payload,
             coalesce(lease_owner,'') AS lease_owner,
             updated_at::text AS updated_at
      FROM ai_appointment_attempt
      WHERE status = 'CONFIRMED'
    ) t;
  `);
  if (!Array.isArray(confirmedRows) || confirmedRows.length !== 1) {
    stop('confirmed-count', { confirmedRows });
  }
  const confirmed = confirmedRows[0];
  if (confirmed.session_id !== expectedSessionId) {
    stop('confirmed-session-mismatch', { confirmed });
  }
  if (!String(confirmed.id).toLowerCase().startsWith(expectedAttemptHint)) {
    stop('confirmed-id-hint-mismatch', { id: confirmed.id, hint: expectedAttemptHint });
  }
  if (confirmed.appointment_reference !== expectedReference) {
    stop('confirmed-reference', { confirmed });
  }
  if (
    confirmed.has_idempotency_key ||
    confirmed.has_request_payload ||
    (confirmed.lease_owner && confirmed.lease_owner.length > 0)
  ) {
    stop('confirmed-not-purged', { confirmed });
  }

  const abandonedRows = pgJson(`
    SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.id), '[]'::json)
    FROM (
      SELECT id::text AS id, session_id, status, coalesce(appointment_reference,'') AS appointment_reference,
             updated_at::text AS updated_at
      FROM ai_appointment_attempt WHERE status = 'ABANDONED'
    ) t;
  `);
  if (!Array.isArray(abandonedRows) || abandonedRows.length !== 1) {
    stop('abandoned-count', { abandonedRows });
  }
  const abandoned = abandonedRows[0];
  if (!String(abandoned.id).toLowerCase().startsWith(expectedAbandonedHint)) {
    stop('abandoned-id-hint-mismatch', { id: abandoned.id });
  }

  const sessionBefore = pgJson(`
    SELECT row_to_json(s) FROM ai_conversation_state s WHERE session_id = '${esc(expectedSessionId)}';
  `);
  if (!sessionBefore) stop('session-missing', {});
  if (sessionBefore.conversation_step !== 'AWAIT_CREATE_CONFIRMATION') {
    stop('session-step', { step: sessionBefore.conversation_step });
  }
  if (sessionBefore.reference !== null && sessionBefore.reference !== '') {
    stop('session-reference-not-empty', { reference: sessionBefore.reference });
  }
  if (sessionBefore.pending_action !== 'CREATE_APPOINTMENT') {
    stop('session-pending', { pending: sessionBefore.pending_action });
  }

  // Schema audit
  const columns = pg(
    `SELECT column_name||':'||udt_name||':null='||is_nullable
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name='ai_conversation_state'
       AND column_name IN (
         'session_id','intent','service','site','date_debut','date_fin','slot_id','new_slot_id',
         'available_slots','selected_slot_index','pending_action','conversation_step',
         'nom','prenom','email','telephone','reference','token','updated_at','expires_at'
       )
     ORDER BY 1;`
  );
  const attemptCols = pg(
    `SELECT column_name||':'||udt_name
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name='ai_appointment_attempt'
       AND column_name IN ('id','session_id','status','appointment_reference','appointment_id','idempotency_key','request_payload','lease_owner')
     ORDER BY 1;`
  );
  const requiredSessionCols = [
    'session_id', 'intent', 'service', 'site', 'date_debut', 'date_fin', 'slot_id', 'new_slot_id',
    'available_slots', 'selected_slot_index', 'pending_action', 'conversation_step',
    'nom', 'prenom', 'email', 'telephone', 'reference', 'token', 'updated_at', 'expires_at',
  ];
  for (const c of requiredSessionCols) {
    if (!columns.includes(c + ':')) {
      // columns lines are name:type:null=...
      if (!columns.split('\n').some((line) => line.startsWith(c + ':'))) {
        stop('schema-missing-column', { c, columns });
      }
    }
  }
  if (!columns.includes('token:uuid')) stop('token-not-uuid', { columns });

  const sqlAudit = {
    proposalPath: sqlProposalPath,
    proposalSha256: sha(proposal),
    executedFormMatchesProposalCore: proposal.includes('WITH confirmed AS') &&
      proposal.includes("status = 'CONFIRMED'") &&
      proposal.includes('RETURNING s.session_id') &&
      !/UPDATE\s+public\.ai_appointment_attempt/i.test(proposal),
    columns,
    attemptCols,
    bindings: {
      $1: expectedSessionId,
      $2: confirmed.id,
      $3: expectedReference,
    },
    securityConditions: [
      'session_id exact match on attempt and state',
      'attempt id exact uuid',
      'status = CONFIRMED',
      'appointment_reference = expected reference',
      'UPDATE only when step AWAIT OR pending CREATE OR empty reference',
      'no write to ai_appointment_attempt',
      'token forced NULL (never invent)',
      'RETURNING for atomic row count',
    ],
  };
  fs.writeFileSync(path.join(outDir, 'SQL_AUDIT.json'), JSON.stringify(sqlAudit, null, 2));
  if (!sqlAudit.executedFormMatchesProposalCore) stop('sql-audit', sqlAudit);

  // Fingerprints of other rows
  const otherSessionsFp = pg(
    `SELECT md5(string_agg(session_id || '|' || coalesce(conversation_step,'') || '|' || coalesce(reference,'') || '|' || coalesce(token::text,'') || '|' || coalesce(updated_at::text,''), ',' ORDER BY session_id))
     FROM ai_conversation_state WHERE session_id <> '${esc(expectedSessionId)}';`
  );
  const attemptsFp = pg(
    `SELECT md5(string_agg(id::text || '|' || session_id || '|' || status || '|' || coalesce(appointment_reference,'') || '|' || coalesce(updated_at::text,''), ',' ORDER BY id))
     FROM ai_appointment_attempt;`
  );
  const rendezVousFp = pg(
    `SELECT md5(string_agg(id::text || '|' || coalesce(reference,'') || '|' || coalesce(updated_at::text,''), ',' ORDER BY id)) FROM rendez_vous;`
  );

  const attemptFull = pgJson(`
    SELECT row_to_json(a) FROM ai_appointment_attempt a WHERE id = '${esc(confirmed.id)}'::uuid;
  `);
  const abandonedFull = pgJson(`
    SELECT row_to_json(a) FROM ai_appointment_attempt a WHERE id = '${esc(abandoned.id)}'::uuid;
  `);

  const backup = {
    exportedAt: new Date().toISOString(),
    sessionId: expectedSessionId,
    sessionRow: sessionBefore,
    sessionSha256: sha(JSON.stringify(sessionBefore)),
    confirmedAttempt: attemptFull,
    confirmedAttemptSha256: sha(JSON.stringify(attemptFull)),
    abandonedAttempt: abandonedFull,
    abandonedAttemptSha256: sha(JSON.stringify(abandonedFull)),
    otherSessionsFp,
    attemptsFp,
    rendezVousFp,
    rollbackProcedure: [
      '1. Under distinct authorization only.',
      '2. Restore ai_conversation_state row for ' + expectedSessionId + ' from BACKUP.json sessionRow (column-by-column UPDATE or DELETE+INSERT matching backup).',
      '3. Do NOT modify ai_appointment_attempt.',
      '4. Verify otherSessionsFp / attemptsFp / rendezVousFp unchanged vs backup fingerprints.',
      '5. Do not activate n8n. Do not POST. Do not touch LIVE.',
    ],
  };
  fs.writeFileSync(path.join(outDir, 'BACKUP.json'), JSON.stringify(backup, null, 2));

  // --- Pass 1 ---
  const pass1 = runReconcile('PASS1', expectedSessionId, confirmed.id, expectedReference);
  fs.writeFileSync(path.join(outDir, 'PASS1.json'), JSON.stringify(pass1, null, 2));

  if (pass1.confirmed_matched !== 1) {
    stop('pass1-confirmed-matched', pass1);
  }
  if (pass1.sessions_updated === 0) {
    stop('pass1-zero-rows', {
      pass1,
      sessionNow: pgJson(
        `SELECT row_to_json(s) FROM ai_conversation_state s WHERE session_id='${esc(expectedSessionId)}';`
      ),
      diagnosis:
        'First pass updated 0 rows despite CONFIRMED match — check conversation_step/pending_action/reference gates without retry.',
    });
  }
  if (pass1.sessions_updated !== 1) {
    stop('pass1-multi-rows-CRITICAL', pass1);
  }
  if (pass1.reference_set !== expectedReference) {
    stop('pass1-reference', pass1);
  }

  const sessionAfter1 = pgJson(
    `SELECT row_to_json(s) FROM ai_conversation_state s WHERE session_id='${esc(expectedSessionId)}';`
  );
  const after1Checks = {
    reference: sessionAfter1.reference === expectedReference,
    tokenNull: sessionAfter1.token === null,
    stepNull: sessionAfter1.conversation_step === null,
    pendingNull: sessionAfter1.pending_action === null,
    intentNull: sessionAfter1.intent === null,
    nomNull: sessionAfter1.nom === null,
    serviceNull: sessionAfter1.service === null,
  };
  if (!Object.values(after1Checks).every(Boolean)) {
    stop('pass1-session-state', { after1Checks, sessionAfter1 });
  }

  const attemptAfter1 = pg(
    `SELECT status, coalesce(appointment_reference,''), (idempotency_key IS NOT NULL), (request_payload IS NOT NULL), coalesce(lease_owner,''), coalesce(updated_at::text,'')
     FROM ai_appointment_attempt WHERE id='${esc(confirmed.id)}'::uuid;`
  );
  const abandonedAfter1 = pg(
    `SELECT status, coalesce(appointment_reference,''), coalesce(updated_at::text,'')
     FROM ai_appointment_attempt WHERE id='${esc(abandoned.id)}'::uuid;`
  );
  const attemptBeforeSnap =
    confirmed.status +
    '|' +
    confirmed.appointment_reference +
    '|f|f|' +
    (confirmed.lease_owner || '') +
    '|' +
    confirmed.updated_at;
  // Compare attempt fields excluding updated_at drift — attempt must be byte-identical via full JSON
  const attemptFullAfter1 = pgJson(
    `SELECT row_to_json(a) FROM ai_appointment_attempt a WHERE id='${esc(confirmed.id)}'::uuid;`
  );
  const abandonedFullAfter1 = pgJson(
    `SELECT row_to_json(a) FROM ai_appointment_attempt a WHERE id='${esc(abandoned.id)}'::uuid;`
  );
  if (JSON.stringify(attemptFullAfter1) !== JSON.stringify(attemptFull)) {
    stop('pass1-attempt-mutated', { before: attemptFull, after: attemptFullAfter1 });
  }
  if (JSON.stringify(abandonedFullAfter1) !== JSON.stringify(abandonedFull)) {
    stop('pass1-abandoned-mutated', { before: abandonedFull, after: abandonedFullAfter1 });
  }

  const otherFpAfter1 = pg(
    `SELECT md5(string_agg(session_id || '|' || coalesce(conversation_step,'') || '|' || coalesce(reference,'') || '|' || coalesce(token::text,'') || '|' || coalesce(updated_at::text,''), ',' ORDER BY session_id))
     FROM ai_conversation_state WHERE session_id <> '${esc(expectedSessionId)}';`
  );
  const attemptsFpAfter1 = pg(
    `SELECT md5(string_agg(id::text || '|' || session_id || '|' || status || '|' || coalesce(appointment_reference,'') || '|' || coalesce(updated_at::text,''), ',' ORDER BY id))
     FROM ai_appointment_attempt;`
  );
  const rdvFpAfter1 = pg(
    `SELECT md5(string_agg(id::text || '|' || coalesce(reference,'') || '|' || coalesce(updated_at::text,''), ',' ORDER BY id)) FROM rendez_vous;`
  );
  if (otherFpAfter1 !== otherSessionsFp) stop('pass1-other-sessions', { otherFpAfter1, otherSessionsFp });
  if (attemptsFpAfter1 !== attemptsFp) stop('pass1-attempts-fp', { attemptsFpAfter1, attemptsFp });
  if (rdvFpAfter1 !== rendezVousFp) stop('pass1-rdv', { rdvFpAfter1, rendezVousFp });

  const mockAfter1 = mockMeta();
  if (postCount(mockAfter1) !== 1) stop('pass1-mock-post', { mockAfter1 });

  // --- Pass 2 (idempotence) ---
  const pass2 = runReconcile('PASS2', expectedSessionId, confirmed.id, expectedReference);
  fs.writeFileSync(path.join(outDir, 'PASS2.json'), JSON.stringify(pass2, null, 2));

  if (pass2.confirmed_matched !== 1) stop('pass2-confirmed-matched', pass2);
  if (pass2.sessions_updated !== 0) {
    stop('pass2-not-idempotent', pass2);
  }

  const sessionAfter2 = pgJson(
    `SELECT row_to_json(s) FROM ai_conversation_state s WHERE session_id='${esc(expectedSessionId)}';`
  );
  // updated_at/expires_at should be unchanged on no-op; compare meaningful fields
  const meaningful = (s) => ({
    session_id: s.session_id,
    intent: s.intent,
    service: s.service,
    site: s.site,
    conversation_step: s.conversation_step,
    pending_action: s.pending_action,
    nom: s.nom,
    prenom: s.prenom,
    email: s.email,
    telephone: s.telephone,
    reference: s.reference,
    token: s.token,
    last_user_message: s.last_user_message,
  });
  if (JSON.stringify(meaningful(sessionAfter2)) !== JSON.stringify(meaningful(sessionAfter1))) {
    stop('pass2-session-changed', { after1: sessionAfter1, after2: sessionAfter2 });
  }
  if (
    sessionAfter2.updated_at !== sessionAfter1.updated_at ||
    sessionAfter2.expires_at !== sessionAfter1.expires_at
  ) {
    stop('pass2-timestamps-changed', {
      updated_at: [sessionAfter1.updated_at, sessionAfter2.updated_at],
      expires_at: [sessionAfter1.expires_at, sessionAfter2.expires_at],
    });
  }

  const attemptFullAfter2 = pgJson(
    `SELECT row_to_json(a) FROM ai_appointment_attempt a WHERE id='${esc(confirmed.id)}'::uuid;`
  );
  const abandonedFullAfter2 = pgJson(
    `SELECT row_to_json(a) FROM ai_appointment_attempt a WHERE id='${esc(abandoned.id)}'::uuid;`
  );
  if (JSON.stringify(attemptFullAfter2) !== JSON.stringify(attemptFull)) {
    stop('pass2-attempt-mutated', {});
  }
  if (JSON.stringify(abandonedFullAfter2) !== JSON.stringify(abandonedFull)) {
    stop('pass2-abandoned-mutated', {});
  }

  // Postflight
  const mainEnd = (
    await (await fetch(base + '/rest/workflows/' + workflowId, { headers: session })).json()
  ).data;
  const listedEnd =
    (await (await fetch(base + '/rest/workflows?limit=50', { headers: session })).json()).data || [];
  const finaliserEnd = mainEnd.nodes.find((n) => n.name === 'Finaliser état création');
  const pgEnd = pg(
    'SELECT (SELECT count(*) FROM rendez_vous),(SELECT count(*) FROM ai_conversation_state),(SELECT count(*) FROM ai_appointment_attempt),(SELECT count(*) FROM notifications);'
  );
  const openEnd = pg(
    "SELECT count(*) FROM ai_appointment_attempt WHERE status IN ('AWAITING_CONFIRMATION','SUBMITTING','UNCERTAIN');"
  );
  const mockEnd = mockMeta();
  const govEnd = gov();
  const mailEnd = JSON.parse(
    docker(['exec', 'govsuite-mailpit', 'wget', '-qO-', 'http://127.0.0.1:8025/api/v1/info'])
  );

  const postflight = {
    main: {
      active: mainEnd.active,
      activeVersionId: mainEnd.activeVersionId || null,
      versionId: mainEnd.versionId,
      versionCounter: mainEnd.versionCounter,
      nodes: mainEnd.nodes.length,
      edges: edgesOf(mainEnd.connections),
      finaliserSha: finaliserCodeSha(finaliserEnd.parameters),
      activeIds: listedEnd.filter((r) => r.active).map((r) => r.id),
    },
    pg: pgEnd,
    open: openEnd,
    sessionFinal: meaningful(sessionAfter2),
    sessionFinalFull: {
      reference: sessionAfter2.reference,
      token: sessionAfter2.token,
      conversation_step: sessionAfter2.conversation_step,
      pending_action: sessionAfter2.pending_action,
      intent: sessionAfter2.intent,
      last_user_message: sessionAfter2.last_user_message,
    },
    confirmedAttemptUnchanged: JSON.stringify(attemptFullAfter2) === JSON.stringify(attemptFull),
    abandonedAttemptUnchanged: JSON.stringify(abandonedFullAfter2) === JSON.stringify(abandonedFull),
    otherSessionsFpUnchanged: otherFpAfter1 === otherSessionsFp,
    mockPosts: postCount(mockEnd),
    gov: govEnd,
    mailpit: { messages: mailEnd.Messages, unread: mailEnd.Unread, dbSize: mailEnd.DatabaseSize },
  };

  const pass =
    pass1.sessions_updated === 1 &&
    pass1.reference_set === expectedReference &&
    pass2.sessions_updated === 0 &&
    pass2.confirmed_matched === 1 &&
    postflight.main.active === false &&
    postflight.main.versionId === expectedVersion &&
    postflight.main.versionCounter === expectedCounter &&
    postflight.main.finaliserSha === expectedFinaliserSha &&
    postflight.main.nodes === 134 &&
    postflight.main.edges === 137 &&
    postflight.main.activeIds.length === 0 &&
    postflight.pg === '1|8|2|0' &&
    postflight.open === '0' &&
    postflight.sessionFinal.reference === expectedReference &&
    postflight.sessionFinal.token === null &&
    postflight.sessionFinal.conversation_step === null &&
    postflight.sessionFinal.pending_action === null &&
    postflight.confirmedAttemptUnchanged &&
    postflight.abandonedAttemptUnchanged &&
    postflight.mockPosts === 1 &&
    postflight.gov === expectedGov &&
    postflight.mailpit.messages === 5 &&
    postflight.mailpit.unread === 2 &&
    postflight.mailpit.dbSize === 98304;

  const result = {
    phase: '8F-2B27',
    pass: !!pass,
    verdict: pass ? 'PASS' : 'FAIL',
    goNewConversationalSession: pass ? 'GO' : 'NO-GO',
    identities: {
      sessionId: expectedSessionId,
      confirmedAttemptId: confirmed.id,
      abandonedAttemptId: abandoned.id,
      reference: expectedReference,
    },
    pass1,
    pass2,
    after1Checks,
    attemptAfter1,
    abandonedAfter1,
    postflight,
    noPut: true,
    noClaim: true,
    noPost: true,
    noActivation: true,
  };

  try {
    fs.unlinkSync(path.join(outDir, '_mock.js'));
  } catch {}
  try {
    fs.unlinkSync(path.join(outDir, '_net.js'));
  } catch {}

  fs.writeFileSync(path.join(outDir, 'POSTFLIGHT.json'), JSON.stringify(postflight, null, 2));
  fs.writeFileSync(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  process.exit(pass ? 0 : 4);
})().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
