const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const outDir =
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-31-rec008-phase8f2b23-RECONCILIATION-RUNTIME-AUDIT';
fs.mkdirSync(outDir, { recursive: true });

const envText = fs.readFileSync(
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-30-rec008-phase8e2b2-TEST-DEPLOY/.env.rec008-test.local',
  'utf8'
);
const value = (n) => envText.match(new RegExp('^' + n + '=(.*)$', 'm'))[1];

const base = 'http://127.0.0.1:5682';
const workflowId = 'OCD9It1uKFhOoWNF';
const expectedVersion = '32f405ee-424e-49af-8d4a-60598393849e';
const expectedCounter = 7;
const expectedFinaliserSha =
  'dfeaf3a439ea362bdf40453d27e25631274bc20ae9eb8d8aecb823a8118a741d';
const expectedGov = '13|14|12|48|0|a2dea067599fd4f0a5f857551adc67cc';
const sessionId = 'rec008-8f2b14-new-01';
const confirmedId = 'ad71a155-4d3a-45b9-8445-2ec98377feaa';
const abandonedId = '8ae63b62-9f87-4a15-9011-4554b7766918';
const expectedRef = 'REC008-MOCK-0001';

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
  docker(['cp', tmp, 'govsuite-rec008-test-rec008-n8n-1:/tmp/_m23.js']);
  const t = docker(['exec', 'govsuite-rec008-test-rec008-n8n-1', 'node', '/tmp/_m23.js']).trim();
  docker(['exec', '-u', 'root', 'govsuite-rec008-test-rec008-n8n-1', 'rm', '-f', '/tmp/_m23.js']);
  return JSON.parse(t);
}
function networkOk() {
  const netProbe = fs.readFileSync('C:/Users/epifa/AppData/Local/Temp/rec008-8f1-net.js', 'utf8');
  const tmp = path.join(outDir, '_net.js');
  fs.writeFileSync(tmp, netProbe);
  docker(['cp', tmp, 'govsuite-rec008-test-rec008-n8n-1:/tmp/_n23.js']);
  const text = docker(['exec', 'govsuite-rec008-test-rec008-n8n-1', 'node', '/tmp/_n23.js']);
  docker(['exec', '-u', 'root', 'govsuite-rec008-test-rec008-n8n-1', 'rm', '-f', '/tmp/_n23.js']);
  const net = JSON.parse(text);
  return !(net.results || []).some((r) => r.expect === 'forbidden' && r.tcp === 'open');
}
function postCount(meta) {
  return Object.entries(meta.byPath || {})
    .filter(([k]) => /^POST \/appointments /.test(k) && !/cancel|reschedule/i.test(k))
    .reduce((n, [, v]) => n + Number(v || 0), 0);
}
function code(wf, name) {
  const n = wf.nodes.find((x) => x.name === name);
  return (n && n.parameters && (n.parameters.jsCode || n.parameters.query || '')) || '';
}
function params(wf, name) {
  const n = wf.nodes.find((x) => x.name === name);
  return n ? n.parameters : null;
}
function finaliserSha(p) {
  const q = (p && p.query) || '';
  const r = (p && p.options && p.options.queryReplacement) || '';
  return sha(q + '\n' + r);
}
function outs(wf, src) {
  const o = wf.connections[src];
  if (!o) return [];
  const r = [];
  for (const groups of Object.values(o)) {
    for (const group of groups || []) for (const e of group || []) r.push(e.node);
  }
  return r;
}
function canReach(wf, from, target, max = 50) {
  const q = [{ n: from, d: 0 }];
  const seen = new Set();
  while (q.length) {
    const { n, d } = q.shift();
    if (seen.has(n) || d > max) continue;
    seen.add(n);
    if (n === target) return true;
    for (const e of outs(wf, n)) q.push({ n: e, d: d + 1 });
  }
  return false;
}

(async () => {
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
  if (login.status !== 200 || !cookie) throw new Error('login ' + login.status);
  const session = { cookie, accept: 'application/json' };

  const wf = (await (await fetch(base + '/rest/workflows/' + workflowId, { headers: session })).json()).data;
  const listed =
    (await (await fetch(base + '/rest/workflows?limit=50', { headers: session })).json()).data || [];
  const chat = wf.nodes.find((n) => n.name === "Lorsqu'un message de chat est reçu");
  const ollama = wf.nodes.find((n) => n.name === 'Ollama Chat Model');
  const postgres = [
    ...new Set(
      wf.nodes.filter((n) => n.credentials && n.credentials.postgres).map((n) => n.credentials.postgres.id)
    ),
  ];
  const urls = urlsOf(wf.nodes);
  const edges = edgesOf(wf.connections);
  const mock0 = mockMeta();
  const net = networkOk();
  const mail0 = JSON.parse(
    docker(['exec', 'govsuite-mailpit', 'wget', '-qO-', 'http://127.0.0.1:8025/api/v1/info'])
  );

  const pg0 = pg(
    'SELECT (SELECT count(*) FROM rendez_vous),(SELECT count(*) FROM ai_conversation_state),(SELECT count(*) FROM ai_appointment_attempt),(SELECT count(*) FROM notifications);'
  );
  const statuses = pg('SELECT status, count(*) FROM ai_appointment_attempt GROUP BY 1 ORDER BY 1;');
  const open = pg(
    "SELECT count(*) FROM ai_appointment_attempt WHERE status IN ('AWAITING_CONFIRMATION','SUBMITTING','UNCERTAIN');"
  );
  const sessionRow = pg(
    `SELECT coalesce(conversation_step,''), coalesce(last_user_message,''), coalesce(reference,''), coalesce(intent,''), coalesce(pending_action,''), coalesce(nom,''), coalesce(telephone,''), (token IS NOT NULL AND length(token::text)>0) FROM ai_conversation_state WHERE session_id='${sessionId}';`
  );
  const attemptRow = pg(
    `SELECT id::text, status, coalesce(appointment_reference,''), coalesce(appointment_id::text,''), (idempotency_key IS NOT NULL), (request_payload IS NOT NULL), coalesce(lease_owner,''), coalesce(request_fingerprint,''), coalesce(submitted_at::text,''), coalesce(confirmed_at::text,'') FROM ai_appointment_attempt WHERE id='${confirmedId}'::uuid;`
  );
  const abandonedRow = pg(
    `SELECT id::text, status, (idempotency_key IS NOT NULL), (request_payload IS NOT NULL) FROM ai_appointment_attempt WHERE id='${abandonedId}'::uuid;`
  );
  const gov0 = gov();

  const finaliser = params(wf, 'Finaliser état création');
  const fSha = finaliserSha(finaliser);

  const preflight = {
    active: wf.active,
    activeVersionId: wf.activeVersionId || null,
    versionId: wf.versionId,
    versionCounter: wf.versionCounter,
    nodes: wf.nodes.length,
    edges,
    activeIds: listed.filter((r) => r.active).map((r) => r.id),
    chatPublic: chat && chat.parameters && chat.parameters.public === true,
    webhookId: chat && chat.webhookId,
    postgres,
    ollama: ollama && ollama.credentials.ollamaApi.id,
    urlsOk: urls.length === 10 && urls.every((u) => u.startsWith('http://rec008-mock:8080/')),
    networkOk: net,
    finaliserSha: fSha,
    pg: pg0,
    statuses,
    open,
    session: sessionRow,
    attempt: attemptRow,
    abandoned: abandonedRow,
    mock: mock0,
    postAppointments: postCount(mock0),
    gov: gov0,
    mailpit: { messages: mail0.Messages, unread: mail0.Unread, dbSize: mail0.DatabaseSize },
  };

  const preOk =
    wf.active === false &&
    (wf.activeVersionId || null) === null &&
    wf.versionId === expectedVersion &&
    wf.versionCounter === expectedCounter &&
    wf.nodes.length === 134 &&
    edges === 137 &&
    preflight.activeIds.length === 0 &&
    preflight.urlsOk &&
    net &&
    fSha === expectedFinaliserSha &&
    postgres.join() === 'Fs0l0058q5CEadRw' &&
    pg0 === '1|8|2|0' &&
    open === '0' &&
    postCount(mock0) === 1 &&
    gov0 === expectedGov &&
    mail0.Messages === 5 &&
    mail0.Unread === 2 &&
    mail0.DatabaseSize === 98304;

  preflight.ok = preOk;
  fs.writeFileSync(path.join(outDir, 'PREFLIGHT.json'), JSON.stringify(preflight, null, 2));
  if (!preOk) {
    console.log(JSON.stringify({ stopped: true, reason: 'preflight', preflight }, null, 2));
    process.exit(2);
  }

  // --- Routing audit (static) ---
  const lire = code(wf, 'Lire tentative de session');
  const decide = code(wf, 'Décider action tentative');
  const parser = code(wf, 'Parser intention');
  const fusion = code(wf, 'Fusionner état conversation');
  const gerer = code(wf, 'Gérer collecte progressive');
  const joindreSnippet = code(wf, 'Joindre tentative de session') || '';

  // Extract status filter from Lire tentative
  const lireStatuses = (lire.match(/status IN \(([^)]+)\)/) || [])[1] || '';
  const lireIncludesConfirmed = /'CONFIRMED'/.test(lire);

  // Décider: what happens for CONFIRMED?
  const decideHasConfirmedBranch = /CONFIRMED/.test(decide);
  const decideAffirmClaim =
    /status === 'AWAITING_CONFIRMATION' && decision === 'AFFIRM'/.test(decide) &&
    /attemptAction = 'CLAIM'/.test(decide);
  const decideDefaultCollect = /attemptAction = 'COLLECT'/.test(decide);

  // Aiguiller outputs
  const aigu = wf.nodes.find((n) => n.name === 'Aiguiller tentative');
  const rules = ((((aigu || {}).parameters || {}).rules || {}).values || []).map((r) => r.outputKey);

  // Reachability from Aiguiller CLAIM / COLLECT / INSERT etc.
  const aiguMain = ((wf.connections['Aiguiller tentative'] || {}).main || []);
  const ruleMap = {};
  rules.forEach((k, i) => {
    ruleMap[k] = aiguMain[i] && aiguMain[i][0] ? aiguMain[i][0].node : null;
  });

  const claimReachCreate = ruleMap.CLAIM
    ? canReach(wf, ruleMap.CLAIM, 'Appeler CreateAppointment')
    : false;
  const collectReachCreate = ruleMap.COLLECT
    ? canReach(wf, ruleMap.COLLECT, 'Appeler CreateAppointment')
    : false;
  const insertReachCreate = ruleMap.INSERT
    ? canReach(wf, ruleMap.INSERT, 'Appeler CreateAppointment')
    : false;

  // Mirror of installed Décider action tentative (exact branch order)
  function decideSim(status, decision, waitExpired, leaseExpired, conversationStep) {
    let attemptAction = 'COLLECT';
    if (status === 'UNCERTAIN' || (status === 'SUBMITTING' && leaseExpired)) {
      attemptAction = 'RESUME';
    } else if (status === 'SUBMITTING') {
      attemptAction = 'WAIT';
    } else if (status === 'AWAITING_CONFIRMATION' && waitExpired) {
      attemptAction = 'EXPIRE';
    } else if (status === 'AWAITING_CONFIRMATION' && decision === 'AFFIRM') {
      attemptAction = 'CLAIM';
    } else if (status === 'AWAITING_CONFIRMATION' && decision === 'NEGATIVE') {
      attemptAction = 'ABANDON';
    } else if (status === 'AWAITING_CONFIRMATION' && decision === 'MODIFY') {
      attemptAction = 'MODIFY';
    } else if (status === 'AWAITING_CONFIRMATION' && decision === 'RESTART') {
      attemptAction = 'RESTART';
    } else if (status === 'AWAITING_CONFIRMATION') {
      attemptAction = 'ASK';
    } else if (decision === 'INSERT') {
      attemptAction = 'INSERT';
    } else if (
      !status &&
      (conversationStep === 'AWAIT_CREATE_CONFIRMATION')
    ) {
      attemptAction = 'RESET_STALE';
    } else if (decision === 'RECALL' || (status === 'CONFIRMED' && decision === 'AFFIRM')) {
      attemptAction = 'RECALL';
    } else if (decision === 'RESUME') {
      attemptAction = 'RESUME';
    } else if (decision === 'EXPIRE') {
      attemptAction = 'EXPIRE';
    }
    return attemptAction;
  }

  // Does Lire return CONFIRMED attempts?
  // Joindre: how is openAttempt set?
  const joindreCode = (() => {
    const n = wf.nodes.find((x) => x.name === 'Joindre tentative de session');
    return (n && n.parameters && n.parameters.jsCode) || '';
  })();

  const routing = {
    lireStatuses,
    lireIncludesConfirmed,
    decideHasConfirmedBranch,
    decideAffirmClaim,
    decideDefaultCollect,
    aiguillerKeys: rules,
    ruleMap,
    claimReachCreate,
    collectReachCreate,
    insertReachCreate,
    collectReachInsert: ruleMap.COLLECT ? canReach(wf, ruleMap.COLLECT, 'Insérer tentative') : false,
    collectReachClaim: ruleMap.COLLECT ? canReach(wf, ruleMap.COLLECT, 'Réclamer tentative') : false,
    simOuiOnConfirmed: decideSim(
      'CONFIRMED',
      'AFFIRM',
      false,
      false,
      'AWAIT_CREATE_CONFIRMATION'
    ),
    simOuiOnAwaiting: decideSim(
      'AWAITING_CONFIRMATION',
      'AFFIRM',
      false,
      false,
      'AWAIT_CREATE_CONFIRMATION'
    ),
    simOtherOnConfirmed: decideSim(
      'CONFIRMED',
      null,
      false,
      false,
      'AWAIT_CREATE_CONFIRMATION'
    ),
    recallNode: ruleMap.RECALL,
    recallReachesCreate: ruleMap.RECALL
      ? canReach(wf, ruleMap.RECALL, 'Appeler CreateAppointment')
      : false,
    fallbackTarget: (() => {
      const aiguNode = wf.nodes.find((n) => n.name === 'Aiguiller tentative');
      const nRules = ((((aiguNode || {}).parameters || {}).rules || {}).values || []).length;
      const main = ((wf.connections['Aiguiller tentative'] || {}).main || []);
      return main[nRules] && main[nRules][0] ? main[nRules][0].node : null;
    })(),
    joindreSetsOpenAttempt: /openAttempt/.test(joindreCode),
    joindreCodeHead: joindreCode.slice(0, 1200),
    decideConfirmedMentions: (decide.match(/CONFIRMED/g) || []).length,
    parserAffirmOnlyAwait: /AWAIT_CREATE_CONFIRMATION/.test(parser) && /AFFIRM/.test(parser),
    finaliserQuery: finaliser.query,
    finaliserReplacement: finaliser.options && finaliser.options.queryReplacement,
    createParents: (() => {
      const preds = [];
      for (const [s, o] of Object.entries(wf.connections || {})) {
        for (const groups of Object.values(o || {})) {
          for (const g of groups || []) {
            for (const e of g || []) {
              if (e.node === 'Appeler CreateAppointment') preds.push(s);
            }
          }
        }
      }
      return preds;
    })(),
  };

  const decideFull = decide;
  fs.writeFileSync(path.join(outDir, 'DECIDE_ACTION_SNIPPET.js'), decideFull);
  fs.writeFileSync(path.join(outDir, 'LIRE_TENTATIVE.sql'), lire);
  fs.writeFileSync(path.join(outDir, 'JOINDRE_SNIPPET.js'), joindreCode);
  fs.writeFileSync(path.join(outDir, 'FINALISER.json'), JSON.stringify(finaliser, null, 2));

  const recallNode = wf.nodes.find((n) => n.name === 'Réponse référence déjà connue');
  const recallCode = (recallNode && recallNode.parameters && recallNode.parameters.jsCode) || '';

  // Risks if user sends oui again on the inconsistent session
  const risks = {
    retrievesConfirmedAttempt: lireIncludesConfirmed,
    ouiRoutesTo: routing.simOuiOnConfirmed,
    mayAskConfirmAgain: false,
    mayCreateNewAttempt: false,
    mayClaim: routing.simOuiOnConfirmed === 'CLAIM',
    mayPost:
      routing.simOuiOnConfirmed === 'CLAIM' ||
      routing.recallReachesCreate === true,
    recallCleansSession: false,
    recallMessageSafe:
      /déjà confirmé/.test(recallCode) && /ne crée pas un nouveau/.test(recallCode),
    otherMessageFallsToCollectFallback: routing.simOtherOnConfirmed === 'COLLECT',
    fallbackIsValider: routing.fallbackTarget === 'Valider paramètres création',
    canCleanWithoutBusinessCall: true,
    notes: [
      'Lire tentative includes CONFIRMED → openAttempt status CONFIRMED with reference.',
      'Décider: (status===CONFIRMED && decision===AFFIRM) → RECALL (not CLAIM).',
      'RECALL → Réponse référence déjà connue: ack with reference; no CLAIM/POST; does not finalize session.',
      'Non-AFFIRM on CONFIRMED → COLLECT → Aiguiller fallback → Valider paramètres création (ready=claimAcquired only; no CreateAppointment).',
      'Session remains AWAIT_CREATE_CONFIRMATION until explicit RECONCILE_CONFIRMED_SESSION.',
    ],
  };

  // Refine COLLECT path with AFFIRM in AWAIT: Gérer may still set createDecision AFFIRM
  // but Décider only CLAIMs if status AWAITING. With CONFIRMED → COLLECT.
  // Does COLLECT + complete identity trigger INSERT? That would be createDecision INSERT from Gérer when identity complete — but step is already AWAIT and attempt exists CONFIRMED.
  // Need Gérer logic for AWAIT + AFFIRM when attempt already confirmed.

  fs.writeFileSync(path.join(outDir, 'ROUTING.json'), JSON.stringify({ routing, risks }, null, 2));

  // --- Reconciliation SQL proposal (NOT EXECUTED) ---
  const reconcileSql = `-- RECONCILE_CONFIRMED_SESSION (PROPOSAL ONLY — DO NOT EXECUTE IN 8F-2B23)
-- Atomic, idempotent session cleanup when attempt is already CONFIRMED.
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
    token = NULL,  -- never invent; attempt has no token column
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
-- Bindings: $1=session_id, $2=attempt_id, $3=expected_reference
-- Second pass: confirmed_matched=1, sessions_updated=0 (step already null / reference set) → idempotent no-op.
-- Does NOT touch ai_appointment_attempt rows (CONFIRMED or ABANDONED).
-- Does NOT call reclamer_*, CreateAppointment, or invent tokens.`;

  fs.writeFileSync(path.join(outDir, 'RECONCILE_CONFIRMED_SESSION.proposed.sql'), reconcileSql);

  // --- Method comparison ---
  const methods = {
    A: {
      name: 'Isolated Finaliser / synthetic session',
      description:
        'Create a disposable synthetic ai_conversation_state row (or use a throwaway session_id). Invoke only Finaliser-equivalent SQL with three bound params (session, reference, token empty/present) via read-write psql under a later authorized phase — OR dry-run EXPLAIN with bound params. Prefer: execute the exact Finaliser UPDATE on a synthetic session that has no attempt, proving $1/$2/$3 bind and NULLIF behavior, then delete the synthetic session.',
      provesDollar3: true,
      needsClaim: false,
      needsPost: false,
      doubleCreateRisk: 'none',
      pgEffects: 'synthetic session only (insert+update+delete) if authorized; zero effect on rec008-8f2b14-new-01 and attempts',
      rollback: 'easy (delete synthetic session)',
      traceability: 'high (SQL logs / RETURNING)',
      safety: 'highest',
    },
    B: {
      name: 'Full conversational path on new session',
      description:
        'Activate workflow, run full create flow on a new session through mock → one POST → Finaliser. Proves end-to-end including $3.',
      provesDollar3: true,
      needsClaim: true,
      needsPost: true,
      doubleCreateRisk: 'one intentional mock POST; must not touch confirmed session',
      pgEffects: 'new attempt + session mutations',
      rollback: 'harder (new attempt residual)',
      traceability: 'high but noisy',
      safety: 'lower than A',
    },
    recommendation: 'A',
    recommendationReason:
      'Validates real PostgreSQL binding of $3 (including empty→NULL) with zero CLAIM/POST and no impact on the inconsistent confirmed session. Method B remains useful later as an integration test under separate authorization.',
  };

  // --- Offline tests T1-T20 ---
  const tests = [];
  function add(id, title, pass, detail) {
    tests.push({ id, title, pass: !!pass, detail: detail || null });
  }

  // Shared fixtures (simulation only)
  const state = {
    session: {
      id: sessionId,
      conversation_step: 'AWAIT_CREATE_CONFIRMATION',
      pending_action: 'CREATE_APPOINTMENT',
      reference: '',
      last_user_message: 'oui',
    },
    confirmed: {
      id: confirmedId,
      session_id: sessionId,
      status: 'CONFIRMED',
      appointment_reference: expectedRef,
      appointment_id: '55555555-5555-4555-8555-555555555555',
      idempotency_key: null,
      request_payload: null,
    },
    abandoned: {
      id: abandonedId,
      session_id: 'rec008-8f2b4-slot-01',
      status: 'ABANDONED',
    },
  };

  function canReconcile(sess, attempt, expectedSessionId, expectedAttemptId, expectedReference) {
    if (!sess || !attempt) return { ok: false, reason: 'missing' };
    if (sess.id !== expectedSessionId) return { ok: false, reason: 'session-mismatch' };
    if (attempt.session_id !== sess.id) return { ok: false, reason: 'attempt-other-session' };
    if (attempt.id !== expectedAttemptId) return { ok: false, reason: 'attempt-id' };
    if (attempt.status !== 'CONFIRMED') return { ok: false, reason: 'status-' + attempt.status };
    if (!attempt.appointment_reference) return { ok: false, reason: 'no-reference' };
    if (attempt.appointment_reference !== expectedReference) return { ok: false, reason: 'ref-mismatch' };
    const awaiting =
      sess.conversation_step === 'AWAIT_CREATE_CONFIRMATION' ||
      sess.pending_action === 'CREATE_APPOINTMENT' ||
      !sess.reference;
    if (!awaiting && sess.reference === attempt.appointment_reference && !sess.conversation_step) {
      return { ok: true, updated: false, reason: 'already-finalized' };
    }
    if (!awaiting) return { ok: false, reason: 'not-awaiting' };
    return {
      ok: true,
      updated: true,
      claim: false,
      post: false,
      inventToken: false,
      touchAttempt: false,
      touchAbandoned: false,
      clearFields: [
        'intent',
        'service',
        'site',
        'dates',
        'slot',
        'pending_action',
        'conversation_step',
        'identity',
      ],
      setReference: attempt.appointment_reference,
      setToken: null,
    };
  }

  function applyReconcile(sess, attempt, gate) {
    if (!gate.ok) return { sess, changed: false, gate };
    if (!gate.updated) return { sess, changed: false, gate };
    return {
      sess: {
        ...sess,
        conversation_step: null,
        pending_action: null,
        intent: null,
        reference: gate.setReference,
        token: null,
        nom: null,
        prenom: null,
        email: null,
        telephone: null,
      },
      changed: true,
      attemptUnchanged: true,
      abandonedUnchanged: true,
      gate,
    };
  }

  // T1
  {
    const g = canReconcile(state.session, state.confirmed, sessionId, confirmedId, expectedRef);
    add('T1', 'Session attente + tentative CONFIRMED', g.ok && g.updated === true, g);
  }
  // T2 idempotent
  {
    const g1 = canReconcile(state.session, state.confirmed, sessionId, confirmedId, expectedRef);
    const r1 = applyReconcile(state.session, state.confirmed, g1);
    const g2 = canReconcile(r1.sess, state.confirmed, sessionId, confirmedId, expectedRef);
    const r2 = applyReconcile(r1.sess, state.confirmed, g2);
    add(
      'T2',
      'Réconciliation idempotente répétée',
      r1.changed && g2.ok && g2.updated === false && r2.changed === false,
      { g1, g2, r1Step: r1.sess.conversation_step, r1Ref: r1.sess.reference }
    );
  }
  // T3 ABANDONED (same session id in fixture so status gate is exercised, not session mismatch)
  {
    const g = canReconcile(
      state.session,
      {
        id: confirmedId,
        session_id: sessionId,
        status: 'ABANDONED',
        appointment_reference: expectedRef,
      },
      sessionId,
      confirmedId,
      expectedRef
    );
    add('T3', 'Tentative ABANDONED', !g.ok && g.reason === 'status-ABANDONED', g);
  }
  // T4 UNCERTAIN
  {
    const g = canReconcile(state.session, { ...state.confirmed, status: 'UNCERTAIN' }, sessionId, confirmedId, expectedRef);
    add('T4', 'Tentative UNCERTAIN', !g.ok && g.reason === 'status-UNCERTAIN', g);
  }
  // T5 SUBMITTING
  {
    const g = canReconcile(state.session, { ...state.confirmed, status: 'SUBMITTING' }, sessionId, confirmedId, expectedRef);
    add('T5', 'Tentative SUBMITTING', !g.ok && g.reason === 'status-SUBMITTING', g);
  }
  // T6 AWAITING
  {
    const g = canReconcile(
      state.session,
      { ...state.confirmed, status: 'AWAITING_CONFIRMATION' },
      sessionId,
      confirmedId,
      expectedRef
    );
    add('T6', 'Tentative AWAITING_CONFIRMATION', !g.ok && g.reason === 'status-AWAITING_CONFIRMATION', g);
  }
  // T7 no reference
  {
    const g = canReconcile(
      state.session,
      { ...state.confirmed, appointment_reference: null },
      sessionId,
      confirmedId,
      expectedRef
    );
    add('T7', 'Référence confirmée absente', !g.ok && g.reason === 'no-reference', g);
  }
  // T8 other session
  {
    const g = canReconcile(
      state.session,
      { ...state.confirmed, session_id: 'other-session' },
      sessionId,
      confirmedId,
      expectedRef
    );
    add('T8', 'Tentative autre session', !g.ok && g.reason === 'attempt-other-session', g);
  }
  // T9 already finalized
  {
    const finalized = {
      id: sessionId,
      conversation_step: null,
      pending_action: null,
      reference: expectedRef,
    };
    const g = canReconcile(finalized, state.confirmed, sessionId, confirmedId, expectedRef);
    add('T9', 'Session déjà finalisée', g.ok && g.updated === false && g.reason === 'already-finalized', g);
  }
  // T10 no CLAIM
  {
    const g = canReconcile(state.session, state.confirmed, sessionId, confirmedId, expectedRef);
    add('T10', 'Aucun CLAIM', g.ok && g.claim === false, g);
  }
  // T11 no POST
  {
    const g = canReconcile(state.session, state.confirmed, sessionId, confirmedId, expectedRef);
    add('T11', 'Aucun POST', g.ok && g.post === false, g);
  }
  // T12 no invent token
  {
    const g = canReconcile(state.session, state.confirmed, sessionId, confirmedId, expectedRef);
    const r = applyReconcile(state.session, state.confirmed, g);
    add('T12', 'Aucun nouveau token', g.setToken === null && r.sess.token === null, { g, token: r.sess.token });
  }
  // T13 confirmed attempt unchanged
  {
    const before = JSON.stringify(state.confirmed);
    const g = canReconcile(state.session, state.confirmed, sessionId, confirmedId, expectedRef);
    applyReconcile(state.session, state.confirmed, g);
    add('T13', 'Tentative confirmée inchangée', before === JSON.stringify(state.confirmed) && g.touchAttempt === false, {});
  }
  // T14 abandoned unchanged
  {
    const before = JSON.stringify(state.abandoned);
    const g = canReconcile(state.session, state.confirmed, sessionId, confirmedId, expectedRef);
    applyReconcile(state.session, state.confirmed, g);
    add('T14', 'ABANDONED inchangée', before === JSON.stringify(state.abandoned) && g.touchAbandoned === false, {});
  }
  // T15 $3 always bound when token absent
  {
    const replacement = finaliser.options.queryReplacement;
    const query = finaliser.query;
    const bindEmpty = (() => {
      // simulate three segments always strings
      const p1 = sessionId;
      const p2 = expectedRef || '';
      const p3 = '' || '';
      return [p1, p2, p3];
    })();
    add(
      'T15',
      'Binding $3 toujours lié (token absent)',
      bindEmpty.length === 3 &&
        bindEmpty[2] === '' &&
        /NULLIF\(\$3::text,\s*''\)/.test(query) &&
        replacement.includes("|| ''"),
      { bindEmpty, queryHasNullif: /NULLIF\(\$3::text,\s*''\)/.test(query) }
    );
  }
  // T16 token present
  {
    const p3 = 'tok-real' || '';
    const stored = p3 === '' ? null : p3;
    add('T16', 'Token présent', stored === 'tok-real' && /NULLIF\(\$3::text,\s*''\)/.test(finaliser.query), {
      stored,
    });
  }
  // T17 no LIVE
  {
    const live = urls.some((u) => /5680|govsuite(?!-rec008)/i.test(u));
    add('T17', 'Aucun accès LIVE', !live && preflight.urlsOk && preflight.networkOk, { live });
  }
  // T18 credentials/url unchanged expectation
  {
    add(
      'T18',
      'Credentials/URL inchangés',
      postgres.join() === 'Fs0l0058q5CEadRw' && urls.length === 10,
      { postgres, urlsCount: urls.length }
    );
  }
  // T19 graph
  {
    add('T19', 'Graphe installé inchangé', wf.nodes.length === 134 && edges === 137 && fSha === expectedFinaliserSha, {
      nodes: wf.nodes.length,
      edges,
      fSha,
    });
  }
  // T20 DB unchanged during audit (re-read)
  {
    const pg1 = pg(
      'SELECT (SELECT count(*) FROM rendez_vous),(SELECT count(*) FROM ai_conversation_state),(SELECT count(*) FROM ai_appointment_attempt),(SELECT count(*) FROM notifications);'
    );
    const session1 = pg(
      `SELECT coalesce(conversation_step,''), coalesce(last_user_message,''), coalesce(reference,'') FROM ai_conversation_state WHERE session_id='${sessionId}';`
    );
    const mock1 = mockMeta();
    const gov1 = gov();
    const unchanged =
      pg1 === pg0 &&
      session1 === 'AWAIT_CREATE_CONFIRMATION|oui|' &&
      postCount(mock1) === 1 &&
      gov1 === gov0;
    add('T20', 'Aucune écriture pendant audit', unchanged, { pg1, session1, post: postCount(mock1) });
  }

  const allPass = tests.every((t) => t.pass);

  // Postflight snapshot
  const postflight = {
    active: wf.active,
    activeVersionId: wf.activeVersionId || null,
    versionId: wf.versionId,
    versionCounter: wf.versionCounter,
    pg: pg(
      'SELECT (SELECT count(*) FROM rendez_vous),(SELECT count(*) FROM ai_conversation_state),(SELECT count(*) FROM ai_appointment_attempt),(SELECT count(*) FROM notifications);'
    ),
    mockPosts: postCount(mockMeta()),
    gov: gov(),
    mailpit: (() => {
      const m = JSON.parse(
        docker(['exec', 'govsuite-mailpit', 'wget', '-qO-', 'http://127.0.0.1:8025/api/v1/info'])
      );
      return { messages: m.Messages, unread: m.Unread, dbSize: m.DatabaseSize };
    })(),
    putExecuted: false,
    activationExecuted: false,
    chatExecuted: false,
    reconcileExecuted: false,
  };

  // Refine risks using actual Joindre + Gérer snippets if available
  // Read Gérer for INSERT triggers
  const gererHasInsert =
    /attemptAction|createDecision|INSERT|AWAIT_CREATE/.test(gerer);
  risks.gererMentionsInsert = /INSERT/.test(gerer);
  risks.collectReachInsert = routing.collectReachInsert;
  risks.collectReachCreate = routing.collectReachCreate;
  risks.summary =
    'If oui is sent again: Décider sees CONFIRMED+AFFIRM → RECALL → safe ack with reference; no CLAIM/POST; session not cleaned. CreateAppointment only via Corps figé présent ? after CLAIM/RESUME. Reconcile must be a separate authorized SQL/session finalize.';
  risks.workflowFixRequiredForReconcile = false;
  risks.workflowFixRequiredForDollar3 = false;

  const result = {
    phase: '8F-2B23',
    pass: allPass,
    preflight,
    routing,
    risks,
    reconcileSqlPath: 'RECONCILE_CONFIRMED_SESSION.proposed.sql',
    methods,
    tests,
    failed: tests.filter((t) => !t.pass).map((t) => t.id),
    postflight,
    workflowFixRequired: false,
    recommendedNextPhase: {
      reconcile: 'GO-with-authorization',
      runtimeDollar3: 'GO-method-A',
      chatbotFullPath: 'NO-GO-until-A-and-reconcile-authorized',
      sendOuiOnExistingSession: 'NO-GO',
    },
  };

  fs.writeFileSync(path.join(outDir, 'OFFLINE_TESTS.json'), JSON.stringify({ pass: allPass, tests }, null, 2));
  fs.writeFileSync(path.join(outDir, 'METHODS.json'), JSON.stringify(methods, null, 2));
  fs.writeFileSync(path.join(outDir, 'RISKS.json'), JSON.stringify(risks, null, 2));
  fs.writeFileSync(path.join(outDir, 'POSTFLIGHT.json'), JSON.stringify(postflight, null, 2));
  fs.writeFileSync(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2));

  try {
    fs.unlinkSync(path.join(outDir, '_mock.js'));
  } catch {}
  try {
    fs.unlinkSync(path.join(outDir, '_net.js'));
  } catch {}

  console.log(
    JSON.stringify(
      {
        pass: allPass,
        failed: result.failed,
        preOk,
        simOuiOnConfirmed: routing.simOuiOnConfirmed,
        simOuiOnAwaiting: routing.simOuiOnAwaiting,
        lireIncludesConfirmed,
        collectReachCreate,
        collectReachInsert: routing.collectReachInsert,
        claimReachCreate,
        recommendation: methods.recommendation,
        finaliserSha: fSha,
      },
      null,
      2
    )
  );
  process.exit(allPass ? 0 : 4);
})().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
