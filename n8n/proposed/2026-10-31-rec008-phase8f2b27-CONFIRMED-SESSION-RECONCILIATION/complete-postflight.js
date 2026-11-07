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
const sessionId = 'rec008-8f2b14-new-01';
const confirmedId = 'ad71a155-4d3a-45b9-8445-2ec98377feaa';
const abandonedId = '8ae63b62-9f87-4a15-9011-4554b7766918';
const expectedReference = 'REC008-MOCK-0001';
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
function pgJson(sql) {
  const text = docker([
    'exec', '-i', 'govsuite-rec008-test-rec008-postgres-1',
    'psql', '-U', 'postgres', '-d', 'govsuite_rec008_test',
    '-t', '-A', '-c', sql,
  ]).trim();
  return text ? JSON.parse(text) : null;
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
  docker(['cp', tmp, 'govsuite-rec008-test-rec008-n8n-1:/tmp/_m27b.js']);
  const t = docker(['exec', 'govsuite-rec008-test-rec008-n8n-1', 'node', '/tmp/_m27b.js']).trim();
  docker(['exec', '-u', 'root', 'govsuite-rec008-test-rec008-n8n-1', 'rm', '-f', '/tmp/_m27b.js']);
  return JSON.parse(t);
}
function postCount(meta) {
  return Object.entries(meta.byPath || {})
    .filter(([k]) => /^POST \/appointments /.test(k) && !/cancel|reschedule/i.test(k))
    .reduce((n, [, v]) => n + Number(v || 0), 0);
}
async function fetchRetry(url, opts, tries = 5) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60000);
      try {
        const res = await fetch(url, { ...opts, signal: controller.signal });
        clearTimeout(timer);
        return res;
      } catch (e) {
        clearTimeout(timer);
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
  const preflight = JSON.parse(fs.readFileSync(path.join(outDir, 'PREFLIGHT.json'), 'utf8'));
  const backup = JSON.parse(fs.readFileSync(path.join(outDir, 'BACKUP.json'), 'utf8'));
  const pass1 = JSON.parse(fs.readFileSync(path.join(outDir, 'PASS1.json'), 'utf8'));
  const pass2 = JSON.parse(fs.readFileSync(path.join(outDir, 'PASS2.json'), 'utf8'));
  const sqlAudit = JSON.parse(fs.readFileSync(path.join(outDir, 'SQL_AUDIT.json'), 'utf8'));

  if (pass1.sessions_updated !== 1 || pass1.reference_set !== expectedReference) {
    throw new Error('PASS1 artifact invalid');
  }
  if (pass2.sessions_updated !== 0 || pass2.confirmed_matched !== 1) {
    throw new Error('PASS2 artifact invalid');
  }

  const sessionNow = pgJson(
    `SELECT row_to_json(s) FROM ai_conversation_state s WHERE session_id='${sessionId}';`
  );
  const confirmedNow = pgJson(
    `SELECT row_to_json(a) FROM ai_appointment_attempt a WHERE id='${confirmedId}'::uuid;`
  );
  const abandonedNow = pgJson(
    `SELECT row_to_json(a) FROM ai_appointment_attempt a WHERE id='${abandonedId}'::uuid;`
  );

  const otherFp = pg(
    `SELECT md5(string_agg(session_id || '|' || coalesce(conversation_step,'') || '|' || coalesce(reference,'') || '|' || coalesce(token::text,'') || '|' || coalesce(updated_at::text,''), ',' ORDER BY session_id))
     FROM ai_conversation_state WHERE session_id <> '${sessionId}';`
  );
  const attemptsFp = pg(
    `SELECT md5(string_agg(id::text || '|' || session_id || '|' || status || '|' || coalesce(appointment_reference,'') || '|' || coalesce(updated_at::text,''), ',' ORDER BY id))
     FROM ai_appointment_attempt;`
  );
  const rdvFp = pg(
    `SELECT md5(string_agg(id::text || '|' || coalesce(reference,'') || '|' || coalesce(updated_at::text,''), ',' ORDER BY id)) FROM rendez_vous;`
  );

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
  const headers = { cookie, accept: 'application/json', 'content-type': 'application/json' };
  const main = (await (await fetchRetry(base + '/rest/workflows/' + workflowId, { headers })).json()).data;
  const listed =
    (await (await fetchRetry(base + '/rest/workflows?limit=50', { headers })).json()).data || [];
  const finaliser = main.nodes.find((n) => n.name === 'Finaliser état création');
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

  const postflight = {
    main: {
      active: main.active,
      activeVersionId: main.activeVersionId || null,
      versionId: main.versionId,
      versionCounter: main.versionCounter,
      nodes: main.nodes.length,
      edges: edgesOf(main.connections),
      finaliserSha: finaliserCodeSha(finaliser.parameters),
      activeIds: listed.filter((r) => r.active).map((r) => r.id),
    },
    pg: pgCounts,
    open,
    sessionFinal: {
      session_id: sessionNow.session_id,
      reference: sessionNow.reference,
      token: sessionNow.token,
      conversation_step: sessionNow.conversation_step,
      pending_action: sessionNow.pending_action,
      intent: sessionNow.intent,
      service: sessionNow.service,
      nom: sessionNow.nom,
      last_user_message: sessionNow.last_user_message,
    },
    confirmedAttemptUnchanged: JSON.stringify(confirmedNow) === JSON.stringify(backup.confirmedAttempt),
    abandonedAttemptUnchanged: JSON.stringify(abandonedNow) === JSON.stringify(backup.abandonedAttempt),
    otherSessionsFpUnchanged: otherFp === backup.otherSessionsFp,
    attemptsFpUnchanged: attemptsFp === backup.attemptsFp,
    rendezVousFpUnchanged: rdvFp === backup.rendezVousFp,
    mockPosts: postCount(mock),
    gov: gov(),
    mailpit: { messages: mail.Messages, unread: mail.Unread, dbSize: mail.DatabaseSize },
  };

  const pass =
    pass1.sessions_updated === 1 &&
    pass2.sessions_updated === 0 &&
    postflight.sessionFinal.reference === expectedReference &&
    postflight.sessionFinal.token === null &&
    postflight.sessionFinal.conversation_step === null &&
    postflight.sessionFinal.pending_action === null &&
    postflight.sessionFinal.intent === null &&
    postflight.confirmedAttemptUnchanged &&
    postflight.abandonedAttemptUnchanged &&
    postflight.otherSessionsFpUnchanged &&
    postflight.attemptsFpUnchanged &&
    postflight.rendezVousFpUnchanged &&
    postflight.main.active === false &&
    postflight.main.versionId === expectedVersion &&
    postflight.main.versionCounter === expectedCounter &&
    postflight.main.finaliserSha === expectedFinaliserSha &&
    postflight.main.nodes === 134 &&
    postflight.main.edges === 137 &&
    postflight.main.activeIds.length === 0 &&
    postflight.pg === '1|8|2|0' &&
    postflight.open === '0' &&
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
    note: 'PASS1/PASS2 executed in reconcile.js (exactly two SQL executions). complete-postflight.js only re-read state and finished n8n postflight after a transient fetch failure — no third UPDATE.',
    identities: {
      sessionId,
      confirmedAttemptId: confirmedId,
      abandonedAttemptId: abandonedId,
      reference: expectedReference,
    },
    preflight,
    sqlAudit,
    pass1,
    pass2,
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
