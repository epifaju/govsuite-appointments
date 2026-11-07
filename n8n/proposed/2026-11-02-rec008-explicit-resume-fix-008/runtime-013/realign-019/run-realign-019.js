'use strict';

/**
 * R013-FIXTURES-REALIGN-019 — Option A fixtures R01–R03.
 * TEST PG mutate only on 3 session_ids after preflight PASS.
 * No activate / chat / Ollama / PUT / Docker / LIVE.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = __dirname;
const ENV_FILE =
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-30-rec008-phase8e2b2-TEST-DEPLOY/.env.rec008-test.local';
const BASE = 'http://127.0.0.1:5682';
const LIVE_BASE = 'http://127.0.0.1:5680';
const WF_ID = 'OCD9It1uKFhOoWNF';
const PG_CTR = 'govsuite-rec008-test-rec008-postgres-1';
const DOCKER_PROJ = 'govsuite-rec008-test';
const EXPECT_VERSION_ID = 'fd75ba32-f018-40e4-9f79-8f2a5400320b';
const EXPECT_COUNTER = 10;
const EXPECT_GERER_SHA =
  'f75d49849231f956bb9ae5383111ea84b362dc58de6711cc75d2e7e2a26917fe';

const SIDS = [
  'rec008-runtime013-r01-active',
  'rec008-runtime013-r02-expired',
  'rec008-runtime013-r03-resume',
];

const SLOT = {
  r01: '33333333-3333-4333-8333-333333333301',
  r02: '33333333-3333-4333-8333-333333333302',
  r03: '33333333-3333-4333-8333-333333333303',
};

function envValue(name) {
  const text = fs.readFileSync(ENV_FILE, 'utf8');
  const m = text.match(new RegExp('^' + name + '=(.*)$', 'm'));
  if (!m) throw new Error('missing env ' + name);
  return m[1];
}

function restHeaders(extra) {
  return Object.assign({ Connection: 'close' }, extra || {});
}

function docker(args) {
  return execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
}

function pg(sql) {
  return docker([
    'exec',
    '-i',
    PG_CTR,
    'psql',
    '-U',
    'postgres',
    '-d',
    'govsuite_rec008_test',
    '-t',
    '-A',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    sql,
  ]).trim();
}

function pgSql(sql) {
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
      PG_CTR,
      'psql',
      '-U',
      'postgres',
      '-d',
      'govsuite_rec008_test',
      '-t',
      '-A',
      '-v',
      'ON_ERROR_STOP=1',
      '-f',
      '-',
    ],
    {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      input: sql,
    },
  ).trim();
}

async function fetchOnce(url, opts, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const merged = Object.assign({}, opts || {});
  merged.headers = restHeaders(merged.headers);
  merged.signal = controller.signal;
  try {
    const res = await fetch(url, merged);
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      text: '',
      error: String(e && e.message ? e.message : e),
    };
  } finally {
    clearTimeout(timer);
  }
}

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function slotsJson(slotId) {
  return JSON.stringify([
    {
      id: slotId,
      slotId: slotId,
      index: 1,
      start: '2026-11-10T09:00:00+01:00',
      end: '2026-11-10T09:30:00+01:00',
      service: 'PASSEPORT',
      site: 'PARIS',
    },
  ]);
}

function redactSession(row) {
  return {
    sessionId: row.session_id,
    intent: row.intent,
    pendingAction: row.pending_action,
    conversationStep: row.conversation_step,
    service: row.service,
    site: row.site,
    dateDebut: row.date_debut,
    dateFin: row.date_fin,
    slotIdPresent: row.slot_id != null,
    slotId: row.slot_id,
    selectedSlotIndex: row.selected_slot_index,
    availableSlotsLen: Array.isArray(row.available_slots)
      ? row.available_slots.length
      : row.available_slots
        ? JSON.parse(JSON.stringify(row.available_slots)).length
        : 0,
    nomPresent: !!(row.nom && String(row.nom).trim()),
    nomLen: row.nom ? String(row.nom).trim().length : 0,
    prenomIsNull: row.prenom == null,
    emailIsNull: row.email == null,
    telephoneIsNull: row.telephone == null,
    lastUserMessageLen: row.last_user_message
      ? String(row.last_user_message).length
      : 0,
    lastUserMessageIsCamille: String(row.last_user_message || '') === 'Camille',
    expiresAt: row.expires_at,
    ttlFuture: row.ttl_future === true || row.ttl_future === 't',
    updatedAt: row.updated_at,
  };
}

function loadSessionsJson() {
  const sql = `
SELECT json_agg(row_to_json(t) ORDER BY session_id)
FROM (
  SELECT
    session_id, intent, pending_action, conversation_step,
    service, site, date_debut::text, date_fin::text,
    slot_id::text, selected_slot_index, available_slots,
    nom, prenom, email, telephone, last_user_message,
    expires_at::text, updated_at::text,
    (expires_at IS NOT NULL AND expires_at > NOW()) AS ttl_future
  FROM ai_conversation_state
  WHERE session_id IN (
    'rec008-runtime013-r01-active',
    'rec008-runtime013-r02-expired',
    'rec008-runtime013-r03-resume'
  )
) t;
`;
  const raw = pg(sql);
  if (!raw || raw === '') return [];
  return JSON.parse(raw);
}

(async () => {
  const report = {
    mission: 'R013-FIXTURES-REALIGN-019',
    ts: new Date().toISOString(),
    option: 'A',
    mutated: false,
    liveTouched: false,
    issues: [],
  };

  // --- Docker ---
  const ps = docker([
    'ps',
    '-a',
    '--filter',
    'label=com.docker.compose.project=' + DOCKER_PROJ,
    '--format',
    '{{.Names}}\t{{.Status}}',
  ]);
  report.docker = (ps || '').trim().split(/\r?\n/).filter(Boolean);
  if (!report.docker.some((l) => /rec008-postgres-1.*Up/.test(l))) {
    report.issues.push('postgres not Up');
  }
  if (!report.docker.some((l) => /rec008-n8n-1.*Up/.test(l))) {
    report.issues.push('n8n not Up');
  }

  const health = await fetchOnce(BASE + '/healthz', { method: 'GET' }, 10000);
  report.healthz = { status: health.status };
  if (health.status !== 200) report.issues.push('healthz failed');

  const live = await fetchOnce(LIVE_BASE + '/healthz', { method: 'GET' }, 3000);
  report.liveProbe = {
    status: live.status,
    error: live.error || null,
    note: 'LIVE may be up; isolation = TEST-only mutate (5682 / govsuite_rec008_test)',
  };
  // Do not FAIL solely because LIVE answers — FAIL only if LIVE were targeted (never here).

  // --- n8n login + workflow ---
  const loginRes = await fetch(BASE + '/rest/login', {
    method: 'POST',
    headers: restHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      emailOrLdapLoginId: envValue('REC008_N8N_OWNER_EMAIL'),
      password: envValue('REC008_N8N_OWNER_PASSWORD'),
    }),
  });
  const cookie = (loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [])
    .map((i) => i.split(';')[0])
    .join('; ');
  report.login = { status: loginRes.status, cookiePresent: Boolean(cookie) };
  if (loginRes.status !== 200 || !cookie) {
    report.issues.push('login failed');
    report.preflightOk = false;
    fs.writeFileSync(path.join(OUT, 'PREFLIGHT.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    process.exit(2);
  }

  const hdr = { cookie, accept: 'application/json', Connection: 'close' };
  const wf = await fetchOnce(BASE + '/rest/workflows/' + WF_ID, { method: 'GET', headers: hdr }, 20000);
  let data = null;
  try {
    const parsed = JSON.parse(wf.text || '{}');
    data = parsed.data || parsed;
  } catch (_) {}

  let gererSha = null;
  if (data && Array.isArray(data.nodes)) {
    const n = data.nodes.find((x) => x.name === 'Gérer collecte progressive');
    if (n && n.parameters && n.parameters.jsCode) {
      gererSha = sha256(n.parameters.jsCode);
    }
  }

  report.workflow = {
    http: wf.status,
    id: data && data.id,
    active: data && data.active === true,
    activeVersionId: (data && data.activeVersionId) || null,
    versionId: data && data.versionId,
    versionCounter: data && data.versionCounter,
    gererSha,
  };

  if (wf.status !== 200) report.issues.push('getWorkflow http ' + wf.status);
  if (report.workflow.active || report.workflow.activeVersionId) {
    report.issues.push('workflow must be inactive');
  }
  if (report.workflow.versionId !== EXPECT_VERSION_ID) {
    report.issues.push('versionId mismatch');
  }
  if (Number(report.workflow.versionCounter) !== EXPECT_COUNTER) {
    report.issues.push('versionCounter mismatch');
  }
  if (gererSha !== EXPECT_GERER_SHA) {
    report.issues.push('Gérer SHA mismatch');
  }

  const act = await fetchOnce(BASE + '/rest/active-workflows', { method: 'GET', headers: hdr }, 15000);
  let ids = [];
  try {
    const j = JSON.parse(act.text || '[]');
    ids = Array.isArray(j) ? j : j.data || j;
    if (!Array.isArray(ids)) ids = [];
  } catch (_) {}
  report.activeWorkflowIds = ids;
  if (ids.length) report.issues.push('active workflows present');

  let webhookRows = null;
  try {
    const probe = path.join(ROOT, 'webhooks-probe.js');
    docker(['cp', probe, 'govsuite-rec008-test-rec008-n8n-1:/tmp/rec008-r019-webhooks.js']);
    const whText = docker([
      'exec',
      'govsuite-rec008-test-rec008-n8n-1',
      'node',
      '/tmp/rec008-r019-webhooks.js',
    ]);
    docker([
      'exec',
      '-u',
      'root',
      'govsuite-rec008-test-rec008-n8n-1',
      'rm',
      '-f',
      '/tmp/rec008-r019-webhooks.js',
    ]);
    const whJson = JSON.parse(whText || '{}');
    webhookRows = Array.isArray(whJson.rows) ? whJson.rows.length : 0;
  } catch (e) {
    report.issues.push('webhook probe: ' + e.message);
  }
  report.webhookRows = webhookRows;
  if (webhookRows !== 0 && webhookRows !== null) {
    report.issues.push('active webhooks present');
  }

  // Active executions (API)
  const execList = await fetchOnce(
    BASE + '/rest/executions?limit=20&status=running',
    { method: 'GET', headers: hdr },
    15000,
  );
  let runningCount = 0;
  try {
    const j = JSON.parse(execList.text || '{}');
    const results = j.data && j.data.results ? j.data.results : j.data || j;
    if (Array.isArray(results)) runningCount = results.length;
    else if (j.count != null) runningCount = Number(j.count) || 0;
  } catch (_) {}
  report.runningExecutionsApi = { http: execList.status, count: runningCount };
  if (runningCount > 0) report.issues.push('n8n executions still running');

  // Fingerprint + open attempts on target sessions
  report.fingerprintBefore = pg(
    "SELECT format('%s|%s|%s|%s', (SELECT count(*) FROM rendez_vous), (SELECT count(*) FROM ai_conversation_state), (SELECT count(*) FROM ai_appointment_attempt), (SELECT count(*) FROM notifications));",
  );

  const openAttempts = Number(
    pg(`
SELECT count(*) FROM ai_appointment_attempt
WHERE session_id IN (
  'rec008-runtime013-r01-active',
  'rec008-runtime013-r02-expired',
  'rec008-runtime013-r03-resume'
)
AND status IN ('AWAITING_CONFIRMATION','SUBMITTING','UNCERTAIN','CLAIMED');
`),
  );
  report.openAttemptsTarget = openAttempts;
  if (openAttempts > 0) report.issues.push('open attempts on target sessions');

  // FK check: slot_id has no FK
  const fkCount = Number(
    pg(`
SELECT count(*) FROM information_schema.table_constraints
WHERE table_name = 'ai_conversation_state'
  AND constraint_type = 'FOREIGN KEY';
`),
  );
  report.conversationStateFkCount = fkCount;

  report.preflightOk = report.issues.length === 0;
  fs.writeFileSync(path.join(OUT, 'PREFLIGHT.json'), JSON.stringify(report, null, 2) + '\n');

  if (!report.preflightOk) {
    report.verdict = 'FAIL';
    report.gate = 'NO-GO';
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  // --- Backup ---
  const beforeRows = loadSessionsJson();
  const backup = {
    ts: new Date().toISOString(),
    fingerprint: report.fingerprintBefore,
    sessions: beforeRows.map(redactSession),
    rawProtected: true,
  };
  fs.writeFileSync(path.join(OUT, 'BACKUP-BEFORE.json'), JSON.stringify(backup, null, 2) + '\n');
  // Full restore SQL (local only; may contain synthetic PII Dupont — note in report as synthetic)
  const restoreSql = beforeRows
    .map((r) => {
      const avail =
        r.available_slots == null
          ? 'NULL'
          : "'" + JSON.stringify(r.available_slots).replace(/'/g, "''") + "'::jsonb";
      return `-- restore ${r.session_id}
UPDATE ai_conversation_state SET
  intent = ${r.intent ? "'" + r.intent + "'" : 'NULL'},
  pending_action = ${r.pending_action ? "'" + r.pending_action + "'" : 'NULL'},
  conversation_step = ${r.conversation_step ? "'" + r.conversation_step + "'" : 'NULL'},
  service = ${r.service ? "'" + r.service.replace(/'/g, "''") + "'" : 'NULL'},
  site = ${r.site ? "'" + r.site.replace(/'/g, "''") + "'" : 'NULL'},
  date_debut = ${r.date_debut ? "'" + r.date_debut + "'::date" : 'NULL'},
  date_fin = ${r.date_fin ? "'" + r.date_fin + "'::date" : 'NULL'},
  slot_id = ${r.slot_id ? "'" + r.slot_id + "'::uuid" : 'NULL'},
  selected_slot_index = ${r.selected_slot_index == null ? 'NULL' : Number(r.selected_slot_index)},
  available_slots = ${avail},
  nom = ${r.nom ? "'" + String(r.nom).replace(/'/g, "''") + "'" : 'NULL'},
  prenom = ${r.prenom ? "'" + String(r.prenom).replace(/'/g, "''") + "'" : 'NULL'},
  email = ${r.email ? "'" + String(r.email).replace(/'/g, "''") + "'" : 'NULL'},
  telephone = ${r.telephone ? "'" + String(r.telephone).replace(/'/g, "''") + "'" : 'NULL'},
  last_user_message = ${r.last_user_message ? "'" + String(r.last_user_message).replace(/'/g, "''") + "'" : 'NULL'},
  expires_at = ${r.expires_at ? "'" + r.expires_at + "'::timestamptz" : 'NULL'},
  updated_at = ${r.updated_at ? "'" + r.updated_at + "'::timestamptz" : 'updated_at'}
WHERE session_id = '${r.session_id}';`;
    })
    .join('\n\n');
  fs.writeFileSync(path.join(OUT, 'RESTORE-BEFORE.sql'), restoreSql + '\n');

  // --- Mutate ---
  const mutateSql = `
BEGIN;

WITH tgt AS (
  SELECT unnest(ARRAY[
    'rec008-runtime013-r01-active',
    'rec008-runtime013-r02-expired',
    'rec008-runtime013-r03-resume'
  ]) AS session_id
),
upd AS (
  UPDATE ai_conversation_state AS s SET
    intent = CASE s.session_id
      WHEN 'rec008-runtime013-r01-active' THEN 'CREATE_APPOINTMENT'
      ELSE 'GENERAL'
    END,
    pending_action = 'CREATE_APPOINTMENT',
    conversation_step = 'ASK_PRENOM',
    service = 'PASSEPORT',
    site = 'PARIS',
    date_debut = DATE '2026-11-10',
    date_fin = DATE '2026-11-14',
    slot_id = CASE s.session_id
      WHEN 'rec008-runtime013-r01-active' THEN '33333333-3333-4333-8333-333333333301'::uuid
      WHEN 'rec008-runtime013-r02-expired' THEN '33333333-3333-4333-8333-333333333302'::uuid
      WHEN 'rec008-runtime013-r03-resume' THEN '33333333-3333-4333-8333-333333333303'::uuid
    END,
    selected_slot_index = 1,
    available_slots = CASE s.session_id
      WHEN 'rec008-runtime013-r01-active' THEN '${slotsJson(SLOT.r01).replace(/'/g, "''")}'::jsonb
      WHEN 'rec008-runtime013-r02-expired' THEN '${slotsJson(SLOT.r02).replace(/'/g, "''")}'::jsonb
      WHEN 'rec008-runtime013-r03-resume' THEN '${slotsJson(SLOT.r03).replace(/'/g, "''")}'::jsonb
    END,
    nom = 'Dupont',
    prenom = NULL,
    email = NULL,
    telephone = NULL,
    last_user_message = NULL,
    reference = NULL,
    token = NULL,
    new_slot_id = NULL,
    expires_at = CASE s.session_id
      WHEN 'rec008-runtime013-r01-active' THEN NOW() + INTERVAL '2 hours'
      ELSE NOW() - INTERVAL '1 hour'
    END,
    updated_at = NOW()
  FROM tgt
  WHERE s.session_id = tgt.session_id
  RETURNING s.session_id
)
SELECT 'ROWS=' || count(*)::text FROM upd;

COMMIT;
`;

  fs.writeFileSync(path.join(OUT, 'REALIGN.sql'), mutateSql);

  let affected = null;
  try {
    const out = pgSql(mutateSql);
    const m = String(out).match(/ROWS=(\d+)/);
    affected = m ? Number(m[1]) : null;
  } catch (e) {
    report.issues.push('mutate failed: ' + e.message);
    report.mutated = false;
    report.verdict = 'FAIL';
    fs.writeFileSync(path.join(OUT, 'RESULT.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  report.mutated = true;
  report.rowsAffected = affected;
  if (affected !== 3) {
    report.issues.push('expected 3 rows affected, got ' + affected);
  }

  // --- Postflight PG ---
  const afterRows = loadSessionsJson();
  const afterRedacted = afterRows.map(redactSession);
  fs.writeFileSync(
    path.join(OUT, 'BACKUP-AFTER.json'),
    JSON.stringify({ ts: new Date().toISOString(), sessions: afterRedacted }, null, 2) + '\n',
  );

  report.fingerprintAfter = pg(
    "SELECT format('%s|%s|%s|%s', (SELECT count(*) FROM rendez_vous), (SELECT count(*) FROM ai_conversation_state), (SELECT count(*) FROM ai_appointment_attempt), (SELECT count(*) FROM notifications));",
  );

  const byId = Object.fromEntries(afterRedacted.map((s) => [s.sessionId, s]));
  function assertSession(id, expect) {
    const s = byId[id];
    if (!s) {
      report.issues.push(id + ' missing');
      return;
    }
    if (s.conversationStep !== 'ASK_PRENOM') report.issues.push(id + ' step');
    if (s.pendingAction !== 'CREATE_APPOINTMENT') report.issues.push(id + ' pending');
    if (!s.prenomIsNull) report.issues.push(id + ' prenom not null');
    if (!s.nomPresent || s.nomLen < 2) report.issues.push(id + ' nom');
    if (!s.slotIdPresent) report.issues.push(id + ' slot missing');
    if (s.availableSlotsLen < 1) report.issues.push(id + ' available_slots');
    if (s.lastUserMessageLen !== 0) report.issues.push(id + ' last_user_message not cleared');
    if (s.lastUserMessageIsCamille) report.issues.push(id + ' Camille residual');
    if (expect.ttlFuture !== s.ttlFuture) report.issues.push(id + ' ttl');
    if (s.service !== 'PASSEPORT' || s.site !== 'PARIS') report.issues.push(id + ' service/site');
    if (!s.dateDebut || !s.dateFin) report.issues.push(id + ' dates');
  }

  assertSession('rec008-runtime013-r01-active', { ttlFuture: true });
  assertSession('rec008-runtime013-r02-expired', { ttlFuture: false });
  assertSession('rec008-runtime013-r03-resume', { ttlFuture: false });

  if (byId['rec008-runtime013-r01-active']?.slotId !== SLOT.r01) {
    report.issues.push('R01 slot uuid');
  }
  if (byId['rec008-runtime013-r02-expired']?.slotId !== SLOT.r02) {
    report.issues.push('R02 slot uuid');
  }
  if (byId['rec008-runtime013-r03-resume']?.slotId !== SLOT.r03) {
    report.issues.push('R03 slot uuid');
  }

  if (report.fingerprintAfter !== report.fingerprintBefore) {
    // sessions count unchanged expected; allow same fingerprint
    report.issues.push(
      'fingerprint changed: ' + report.fingerprintBefore + ' → ' + report.fingerprintAfter,
    );
  }

  const openAfter = Number(
    pg(`
SELECT count(*) FROM ai_appointment_attempt
WHERE session_id IN (
  'rec008-runtime013-r01-active',
  'rec008-runtime013-r02-expired',
  'rec008-runtime013-r03-resume'
)
AND status IN ('AWAITING_CONFIRMATION','SUBMITTING','UNCERTAIN','CLAIMED');
`),
  );
  if (openAfter !== 0) report.issues.push('open attempts after mutate');

  // n8n integrity recheck
  const wf2 = await fetchOnce(BASE + '/rest/workflows/' + WF_ID, { method: 'GET', headers: hdr }, 20000);
  let data2 = null;
  try {
    const parsed = JSON.parse(wf2.text || '{}');
    data2 = parsed.data || parsed;
  } catch (_) {}
  report.postflightWorkflow = {
    active: data2 && data2.active === true,
    versionId: data2 && data2.versionId,
    versionCounter: data2 && data2.versionCounter,
  };
  if (report.postflightWorkflow.active) report.issues.push('workflow activated');
  if (report.postflightWorkflow.versionId !== EXPECT_VERSION_ID) {
    report.issues.push('versionId changed');
  }
  if (Number(report.postflightWorkflow.versionCounter) !== EXPECT_COUNTER) {
    report.issues.push('versionCounter changed');
  }

  report.postflightOk = report.issues.length === 0;
  report.verdict = report.postflightOk ? 'PASS' : 'FAIL';
  report.gate = {
    ollamaWarmPrep: report.postflightOk ? 'GO-CONDITIONAL' : 'NO-GO',
    r01Campaign: 'NO-GO',
  };

  fs.writeFileSync(path.join(OUT, 'RESULT.json'), JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(
    path.join(OUT, 'POSTFLIGHT.json'),
    JSON.stringify(
      {
        fingerprintBefore: report.fingerprintBefore,
        fingerprintAfter: report.fingerprintAfter,
        sessions: afterRedacted,
        workflow: report.postflightWorkflow,
        openAttempts: openAfter,
        ok: report.postflightOk,
      },
      null,
      2,
    ) + '\n',
  );

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.postflightOk ? 0 : 1);
})().catch((e) => {
  console.error(String((e && e.stack) || e));
  process.exit(3);
});
