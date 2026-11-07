const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { randomUUID } = require('crypto');
const { execFileSync } = require('child_process');

const outDir =
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-31-rec008-phase8f2b25-NON-PUBLIE';
const runtimeDir = path.join(outDir, 'runtime');
fs.mkdirSync(runtimeDir, { recursive: true });

const envText = fs.readFileSync(
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-30-rec008-phase8e2b2-TEST-DEPLOY/.env.rec008-test.local',
  'utf8'
);
const value = (n) => envText.match(new RegExp('^' + n + '=(.*)$', 'm'))[1];

const base = 'http://127.0.0.1:5682';
const mainWorkflowId = 'OCD9It1uKFhOoWNF';
const expectedVersion = '32f405ee-424e-49af-8d4a-60598393849e';
const expectedCounter = 7;
const installedFinaliserSha =
  'dfeaf3a439ea362bdf40453d27e25631274bc20ae9eb8d8aecb823a8118a741d';
const expectedGov = '13|14|12|48|0|a2dea067599fd4f0a5f857551adc67cc';
const syntheticSessionId = 'rec008-8f2b25-runtime-01';
const realSessionId = 'rec008-8f2b14-new-01';
const confirmedId = 'ad71a155-4d3a-45b9-8445-2ec98377feaa';
const abandonedId = '8ae63b62-9f87-4a15-9011-4554b7766918';
const ephemeralName = 'REC008-8F2B25-FINALISER-RUNTIME-EPHEMERAL';
const syntheticTokenUuid = '22222222-2222-4222-8222-222222222222';
const SENTINEL = '__ABSENT__';

const AFTER_QUERY = `UPDATE ai_conversation_state
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

    reference = NULLIF($2::text, ''),
    token = NULLIF(NULLIF($3::text, ''), '${SENTINEL}')::uuid,

    updated_at = NOW(),
    expires_at = NOW() + INTERVAL '2 hours'

WHERE session_id = $1

RETURNING *;`;

const AFTER_REPLACEMENT =
  "={{ $('Lorsqu\\'un message de chat est reçu').item.json.sessionId }},{{ $('Paramètres clôture confirmation').item.json.appointmentReference || '' }},{{ (($('Paramètres clôture confirmation').item.json.appointment || {}).token_gestion || ($('Paramètres clôture confirmation').item.json.appointment || {}).token || '__ABSENT__') }}";

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
  const tmp = path.join(runtimeDir, '_mock.js');
  fs.writeFileSync(tmp, probe);
  docker(['cp', tmp, 'govsuite-rec008-test-rec008-n8n-1:/tmp/_m25.js']);
  const t = docker(['exec', 'govsuite-rec008-test-rec008-n8n-1', 'node', '/tmp/_m25.js']).trim();
  docker(['exec', '-u', 'root', 'govsuite-rec008-test-rec008-n8n-1', 'rm', '-f', '/tmp/_m25.js']);
  return JSON.parse(t);
}
function postCount(meta) {
  return Object.entries(meta.byPath || {})
    .filter(([k]) => /^POST \/appointments /.test(k) && !/cancel|reschedule/i.test(k))
    .reduce((n, [, v]) => n + Number(v || 0), 0);
}
function networkOk() {
  const netProbe = fs.readFileSync('C:/Users/epifa/AppData/Local/Temp/rec008-8f1-net.js', 'utf8');
  const tmp = path.join(runtimeDir, '_net.js');
  fs.writeFileSync(tmp, netProbe);
  docker(['cp', tmp, 'govsuite-rec008-test-rec008-n8n-1:/tmp/_n25.js']);
  const text = docker(['exec', 'govsuite-rec008-test-rec008-n8n-1', 'node', '/tmp/_n25.js']);
  docker(['exec', '-u', 'root', 'govsuite-rec008-test-rec008-n8n-1', 'rm', '-f', '/tmp/_n25.js']);
  const net = JSON.parse(text);
  return !(net.results || []).some((r) => r.expect === 'forbidden' && r.tcp === 'open');
}
function finaliserCodeSha(query, replacement) {
  return sha(query + '\n' + replacement);
}
function sessionSnapshot(id) {
  const line = pg(
    `SELECT coalesce(conversation_step,''), coalesce(pending_action,''), coalesce(intent,''), coalesce(reference,''), coalesce(token::text,''), coalesce(nom,''), coalesce(telephone,''), coalesce(service,''), coalesce(site,''), coalesce(last_user_message,'') FROM ai_conversation_state WHERE session_id='${id}';`
  );
  if (!line) return null;
  const p = line.split('|');
  return {
    conversation_step: p[0],
    pending_action: p[1],
    intent: p[2],
    reference: p[3],
    token: p[4],
    hasToken: !!(p[4] && p[4].length),
    nom: p[5],
    telephone: p[6],
    service: p[7],
    site: p[8],
    last_user_message: p[9],
  };
}
function attemptSnap(id) {
  return pg(
    `SELECT status, coalesce(appointment_reference,''), (idempotency_key IS NOT NULL), (request_payload IS NOT NULL), coalesce(lease_owner,''), coalesce(updated_at::text,'') FROM ai_appointment_attempt WHERE id='${id}'::uuid;`
  );
}
function historicalFingerprint() {
  return pg(
    `SELECT md5(string_agg(session_id || '|' || coalesce(conversation_step,'') || '|' || coalesce(reference,'') || '|' || coalesce(token::text,'') || '|' || coalesce(updated_at::text,''), ',' ORDER BY session_id)) FROM ai_conversation_state WHERE session_id <> '${syntheticSessionId}';`
  );
}
function stop(reason, detail) {
  const payload = { ok: false, stopped: true, reason, detail, verdict: 'FAIL' };
  fs.writeFileSync(path.join(outDir, 'STOP.json'), JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
  process.exit(2);
}

function buildEphemeral(finaliserParams, finaliserCreds, scenarioPayload) {
  return {
    name: ephemeralName,
    nodes: [
      {
        id: randomUUID(),
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        typeVersion: 1,
        position: [0, 0],
        parameters: {},
      },
      {
        id: randomUUID(),
        name: "Lorsqu'un message de chat est reçu",
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [220, 0],
        parameters: {
          jsCode: `return [{ json: ${JSON.stringify({ sessionId: scenarioPayload.sessionId })} }];`,
        },
      },
      {
        id: randomUUID(),
        name: 'Paramètres clôture confirmation',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [440, 0],
        parameters: {
          jsCode: `return [{ json: ${JSON.stringify({
            appointmentReference: scenarioPayload.appointmentReference,
            appointment: scenarioPayload.appointment,
          })} }];`,
        },
      },
      {
        id: randomUUID(),
        name: 'Finaliser état création',
        type: 'n8n-nodes-base.postgres',
        typeVersion: 2.7,
        position: [660, 0],
        parameters: JSON.parse(JSON.stringify(finaliserParams)),
        credentials: JSON.parse(JSON.stringify(finaliserCreds)),
      },
    ],
    connections: {
      'Manual Trigger': {
        main: [[{ node: "Lorsqu'un message de chat est reçu", type: 'main', index: 0 }]],
      },
      "Lorsqu'un message de chat est reçu": {
        main: [[{ node: 'Paramètres clôture confirmation', type: 'main', index: 0 }]],
      },
      'Paramètres clôture confirmation': {
        main: [[{ node: 'Finaliser état création', type: 'main', index: 0 }]],
      },
    },
    settings: { executionOrder: 'v1' },
  };
}

function extractExecInfo(execJson) {
  const raw = typeof (execJson.data && execJson.data.data) === 'string'
    ? execJson.data.data
    : null;
  let messages = [];
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      messages = arr.filter((v) => typeof v === 'string');
    } catch (_) {}
  }
  const blob = JSON.stringify(execJson);
  const dollar3 = /there is no parameter \$3/i.test(blob);
  const uuidType = /of type uuid but expression is of type text/i.test(blob);
  const invalidUuid = /invalid input syntax for type uuid/i.test(blob);
  const status = (execJson.data && execJson.data.status) || execJson.status;
  const errMsg =
    messages.find((m) => /parameter \$3|uuid|invalid input|Failed query/i.test(m)) || null;
  return { status, dollar3, uuidType, invalidUuid, errMsg, success: status === 'success' };
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
  const session = { cookie, accept: 'application/json', 'content-type': 'application/json' };

  // cleanup leftover ephemeral from 8F-2B24/25
  const listed0 =
    (await (await fetch(base + '/rest/workflows?limit=100', { headers: session })).json()).data || [];
  for (const w of listed0) {
    if (/REC008-8F2B2[45]/.test(w.name)) {
      if (!w.isArchived) {
        await fetch(base + '/rest/workflows/' + w.id + '/archive', { method: 'POST', headers: session });
      }
      await fetch(base + '/rest/workflows/' + w.id, { method: 'DELETE', headers: session });
    }
  }

  const main = (await (await fetch(base + '/rest/workflows/' + mainWorkflowId, { headers: session })).json()).data;
  const listed =
    (await (await fetch(base + '/rest/workflows?limit=50', { headers: session })).json()).data || [];
  const finaliserLive = main.nodes.find((n) => n.name === 'Finaliser état création');
  const liveSha = finaliserCodeSha(
    finaliserLive.parameters.query,
    finaliserLive.parameters.options.queryReplacement
  );
  const mock0 = mockMeta();
  const mail0 = JSON.parse(
    docker(['exec', 'govsuite-mailpit', 'wget', '-qO-', 'http://127.0.0.1:8025/api/v1/info'])
  );
  const pg0 = pg(
    'SELECT (SELECT count(*) FROM rendez_vous),(SELECT count(*) FROM ai_conversation_state),(SELECT count(*) FROM ai_appointment_attempt),(SELECT count(*) FROM notifications);'
  );
  const real0 = sessionSnapshot(realSessionId);
  const confirmed0 = attemptSnap(confirmedId);
  const abandoned0 = attemptSnap(abandonedId);
  const histFp0 = historicalFingerprint();
  const synExists0 = pg(`SELECT count(*) FROM ai_conversation_state WHERE session_id='${syntheticSessionId}';`);
  const gov0 = gov();
  const net = networkOk();

  const schema = {
    columns: pg(
      `SELECT column_name||':'||udt_name||':nullable='||is_nullable FROM information_schema.columns WHERE table_name='ai_conversation_state' AND column_name IN ('session_id','reference','token') ORDER BY 1;`
    ),
    constraints: pg(
      `SELECT conname||':'||pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.ai_conversation_state'::regclass AND contype IN ('c','u','p');`
    ),
  };

  const preOk =
    main.active === false &&
    (main.activeVersionId || null) === null &&
    main.versionId === expectedVersion &&
    main.versionCounter === expectedCounter &&
    main.nodes.length === 134 &&
    edgesOf(main.connections) === 137 &&
    listed.filter((r) => r.active).length === 0 &&
    urlsOf(main.nodes).length === 10 &&
    urlsOf(main.nodes).every((u) => u.startsWith('http://rec008-mock:8080/')) &&
    net &&
    liveSha === installedFinaliserSha &&
    pg0 === '1|8|2|0' &&
    synExists0 === '0' &&
    postCount(mock0) === 1 &&
    gov0 === expectedGov &&
    mail0.Messages === 5 &&
    mail0.Unread === 2 &&
    mail0.DatabaseSize === 98304;

  const preflight = {
    ok: preOk,
    versionId: main.versionId,
    versionCounter: main.versionCounter,
    active: main.active,
    liveFinaliserSha: liveSha,
    pg: pg0,
    synExists: synExists0,
    mockPosts: postCount(mock0),
    gov: gov0,
    schema,
  };
  fs.writeFileSync(path.join(outDir, 'PREFLIGHT.json'), JSON.stringify(preflight, null, 2));
  fs.writeFileSync(path.join(outDir, 'SCHEMA.json'), JSON.stringify(schema, null, 2));
  if (!preOk) stop('preflight', preflight);

  // --- Build NON-PUBLISHED candidate from LIVE export (no PUT) ---
  const candidate = JSON.parse(JSON.stringify(main));
  candidate.name = (main.name || 'REC008') + ' [8F-2B25 NON-PUBLIE candidature]';
  const candFinaliser = candidate.nodes.find((n) => n.name === 'Finaliser état création');
  const beforeQuery = candFinaliser.parameters.query;
  const beforeReplacement = candFinaliser.parameters.options.queryReplacement;
  const beforeSha = finaliserCodeSha(beforeQuery, beforeReplacement);

  candFinaliser.parameters.query = AFTER_QUERY;
  candFinaliser.parameters.options.queryReplacement = AFTER_REPLACEMENT;
  const afterSha = finaliserCodeSha(AFTER_QUERY, AFTER_REPLACEMENT);

  // ensure only Finaliser parameters differ among nodes
  const modified = [];
  for (let i = 0; i < main.nodes.length; i++) {
    const a = main.nodes[i];
    const b = candidate.nodes.find((n) => n.name === a.name);
    if (JSON.stringify(a.parameters) !== JSON.stringify(b.parameters)) modified.push(a.name);
  }
  if (modified.length !== 1 || modified[0] !== 'Finaliser état création') {
    stop('candidate-diff', { modified });
  }
  if (JSON.stringify(main.connections) !== JSON.stringify(candidate.connections)) {
    stop('candidate-connections', {});
  }

  const candidatePath = path.join(outDir, 'candidate-OCD9It1uKFhOoWNF.json');
  const candidateRaw = Buffer.from(JSON.stringify(candidate, null, 2), 'utf8');
  fs.writeFileSync(candidatePath, candidateRaw);
  const candidateSha = sha(candidateRaw);
  const sourceSha = sha(JSON.stringify(main, null, 2));

  fs.writeFileSync(
    path.join(outDir, 'DIFF_FINALISER.txt'),
    [
      '--- queryReplacement BEFORE',
      beforeReplacement,
      '--- queryReplacement AFTER',
      AFTER_REPLACEMENT,
      '',
      '--- token/reference SQL BEFORE',
      "    reference = NULLIF($2::text, ''),",
      "    token = NULLIF($3::text, ''),",
      '--- token/reference SQL AFTER',
      "    reference = NULLIF($2::text, ''),",
      "    token = NULLIF(NULLIF($3::text, ''), '__ABSENT__')::uuid,",
    ].join('\n')
  );
  fs.writeFileSync(
    path.join(outDir, 'FINGERPRINTS.json'),
    JSON.stringify(
      {
        sourceLiveSha256: sourceSha,
        candidateSha256: candidateSha,
        finaliserBeforeSha256: beforeSha,
        finaliserAfterSha256: afterSha,
        modifiedNodes: modified,
        nodes: 134,
        edges: 137,
        published: false,
        putOnMain: false,
      },
      null,
      2
    )
  );

  const fixedParams = JSON.parse(JSON.stringify(candFinaliser.parameters));
  const fixedCreds = JSON.parse(JSON.stringify(finaliserLive.credentials));

  async function fetchRetry(url, opts, tries = 4) {
    let last;
    for (let i = 1; i <= tries; i++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 120000);
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

  async function createAndRun(scenarioPayload, tag) {
    const body = buildEphemeral(fixedParams, fixedCreds, scenarioPayload);
    const fin = body.nodes.find((n) => n.name === 'Finaliser état création');
    if (finaliserCodeSha(fin.parameters.query, fin.parameters.options.queryReplacement) !== afterSha) {
      throw new Error('ephemeral sha mismatch');
    }
    const createdRes = await fetchRetry(base + '/rest/workflows', {
      method: 'POST',
      headers: session,
      body: JSON.stringify(body),
    });
    const created = JSON.parse(await createdRes.text());
    const wf = created.data || created;
    if (!wf.id) throw new Error('create failed ' + JSON.stringify(created).slice(0, 400));
    if (wf.active) throw new Error('ephemeral active');

    const run = await fetchRetry(base + '/rest/workflows/' + wf.id + '/run', {
      method: 'POST',
      headers: session,
      body: JSON.stringify({
        triggerToStartFrom: { name: 'Manual Trigger' },
        destinationNode: { nodeName: 'Finaliser état création', mode: 'inclusive' },
      }),
    });
    const runJson = JSON.parse(await run.text());
    const executionId = runJson.data && runJson.data.executionId;
    let execJson = null;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 400));
      const ex = await fetchRetry(base + '/rest/executions/' + executionId + '?includeData=true', {
        headers: session,
      });
      execJson = JSON.parse(await ex.text());
      const st = (execJson.data && execJson.data.status) || execJson.status;
      if (st && st !== 'running' && st !== 'new' && st !== 'waiting') break;
    }
    fs.writeFileSync(path.join(runtimeDir, tag + '-exec.json'), JSON.stringify(execJson).slice(0, 80000));

    try {
      await fetchRetry(base + '/rest/workflows/' + wf.id + '/archive', {
        method: 'POST',
        headers: session,
      });
      await fetchRetry(base + '/rest/workflows/' + wf.id, { method: 'DELETE', headers: session });
    } catch (_) {}

    const info = extractExecInfo(execJson || {});
    return {
      tag,
      runStatus: run.status,
      executionId,
      ...info,
      sessionAfter: sessionSnapshot(scenarioPayload.sessionId),
      usedCandidateSql: true,
      usedTestCredential: fixedCreds.postgres.id === 'Fs0l0058q5CEadRw',
      expectedBound:
        scenarioPayload.expectedBound || {
          p1: scenarioPayload.sessionId,
          p2: scenarioPayload.appointmentReference,
          p3:
            (scenarioPayload.appointment &&
              (scenarioPayload.appointment.token_gestion || scenarioPayload.appointment.token)) ||
            SENTINEL,
        },
    };
  }

  function integrityCheck(label) {
    const out = {
      label,
      pg: pg(
        'SELECT (SELECT count(*) FROM rendez_vous),(SELECT count(*) FROM ai_conversation_state),(SELECT count(*) FROM ai_appointment_attempt),(SELECT count(*) FROM notifications);'
      ),
      confirmed: attemptSnap(confirmedId),
      abandoned: attemptSnap(abandonedId),
      realSession: sessionSnapshot(realSessionId),
      histFp: historicalFingerprint(),
      mockPosts: postCount(mockMeta()),
      gov: gov(),
    };
    out.ok =
      out.pg === '1|9|2|0' &&
      out.confirmed === confirmed0 &&
      out.abandoned === abandoned0 &&
      JSON.stringify(out.realSession) === JSON.stringify(real0) &&
      out.histFp === histFp0 &&
      out.mockPosts === 1 &&
      out.gov === expectedGov;
    return out;
  }

  function resetSynthetic(msg) {
    pg(
      `UPDATE ai_conversation_state SET
        intent='CREATE_APPOINTMENT', service='PASSEPORT', site='PARIS',
        conversation_step='AWAIT_CREATE_CONFIRMATION', pending_action='CREATE_APPOINTMENT',
        nom='Runtime', prenom='Synth', email='runtime.synth@example.test', telephone='+33000000001',
        reference=NULL, token=NULL, last_user_message='${msg}',
        updated_at=NOW(), expires_at=NOW()+INTERVAL '2 hours'
       WHERE session_id='${syntheticSessionId}';`
    );
  }

  // Create synthetic session
  if (synExists0 !== '0') stop('synthetic-exists', { synExists0 });
  pg(
    `INSERT INTO ai_conversation_state (
      session_id, intent, service, site, conversation_step, pending_action,
      nom, prenom, email, telephone, last_user_message, created_at, updated_at, expires_at
    ) VALUES (
      '${syntheticSessionId}', 'CREATE_APPOINTMENT', 'PASSEPORT', 'PARIS',
      'AWAIT_CREATE_CONFIRMATION', 'CREATE_APPOINTMENT',
      'Runtime', 'Synth', 'runtime.synth@example.test', '+33000000001',
      'synthetic-init', NOW(), NOW(), NOW() + INTERVAL '2 hours'
    );`
  );
  fs.writeFileSync(
    path.join(runtimeDir, 'SYNTHETIC_CREATED.json'),
    JSON.stringify({ sessionId: syntheticSessionId, initial: sessionSnapshot(syntheticSessionId) }, null, 2)
  );

  // A1 — token absent → sentinel __ABSENT__ → NULL
  const a1 = await createAndRun(
    {
      sessionId: syntheticSessionId,
      appointmentReference: 'REC008-RUNTIME-NULL-003',
      appointment: { reference: 'REC008-RUNTIME-NULL-003' },
    },
    'A1'
  );
  a1.ok =
    a1.runStatus === 200 &&
    a1.success === true &&
    !a1.dollar3 &&
    !a1.uuidType &&
    a1.sessionAfter &&
    a1.sessionAfter.reference === 'REC008-RUNTIME-NULL-003' &&
    !a1.sessionAfter.hasToken &&
    a1.sessionAfter.conversation_step === '' &&
    a1.sessionAfter.pending_action === '' &&
    a1.sessionAfter.intent === '' &&
    a1.expectedBound.p3 === SENTINEL;
  const intA1 = integrityCheck('A1');
  fs.writeFileSync(path.join(runtimeDir, 'A1.json'), JSON.stringify({ a1, integrity: intA1 }, null, 2));
  if (!intA1.ok) stop('critical-a1-integrity', { a1, intA1 });

  // A2 — UUID token present
  resetSynthetic('reset-before-a2');
  const a2 = await createAndRun(
    {
      sessionId: syntheticSessionId,
      appointmentReference: 'REC008-RUNTIME-TOKEN-004',
      appointment: {
        reference: 'REC008-RUNTIME-TOKEN-004',
        token: syntheticTokenUuid,
      },
    },
    'A2'
  );
  a2.ok =
    a2.runStatus === 200 &&
    a2.success === true &&
    !a2.dollar3 &&
    !a2.uuidType &&
    a2.sessionAfter &&
    a2.sessionAfter.reference === 'REC008-RUNTIME-TOKEN-004' &&
    a2.sessionAfter.token === syntheticTokenUuid &&
    a2.sessionAfter.conversation_step === '' &&
    a2.sessionAfter.pending_action === '' &&
    a2.sessionAfter.intent === '';
  const intA2 = integrityCheck('A2');
  fs.writeFileSync(path.join(runtimeDir, 'A2.json'), JSON.stringify({ a2, integrity: intA2 }, null, 2));
  if (!intA2.ok) stop('critical-a2-integrity', { a2, intA2 });

  // A3 — invalid non-UUID token
  resetSynthetic('reset-before-a3');
  const beforeA3 = sessionSnapshot(syntheticSessionId);
  const a3 = await createAndRun(
    {
      sessionId: syntheticSessionId,
      appointmentReference: 'REC008-RUNTIME-INVALID-005',
      appointment: {
        reference: 'REC008-RUNTIME-INVALID-005',
        token: 'NOT-A-UUID-TOKEN',
      },
    },
    'A3'
  );
  a3.before = beforeA3;
  a3.ok =
    a3.runStatus === 200 &&
    a3.success === false &&
    a3.invalidUuid === true &&
    a3.sessionAfter &&
    a3.sessionAfter.conversation_step === 'AWAIT_CREATE_CONFIRMATION' &&
    a3.sessionAfter.reference === '' &&
    !a3.sessionAfter.hasToken &&
    a3.sessionAfter.last_user_message === 'reset-before-a3';
  a3.upstreamValidationRecommended =
    'Validate UUID format before Finaliser (or in Paramètres clôture) so invalid tokens never reach PostgreSQL cast.';
  const intA3 = integrityCheck('A3');
  fs.writeFileSync(path.join(runtimeDir, 'A3.json'), JSON.stringify({ a3, integrity: intA3 }, null, 2));
  if (!intA3.ok) stop('critical-a3-integrity', { a3, intA3 });

  // Cleanup synthetic
  const beforeDelete = pg(
    `SELECT session_id FROM ai_conversation_state WHERE session_id='${syntheticSessionId}';`
  );
  pg(`DELETE FROM ai_conversation_state WHERE session_id='${syntheticSessionId}';`);
  const remaining = pg(
    `SELECT count(*) FROM ai_conversation_state WHERE session_id='${syntheticSessionId}';`
  );
  const cleanup = {
    targetedId: syntheticSessionId,
    beforeDelete,
    remaining,
    ok: beforeDelete === syntheticSessionId && remaining === '0',
  };
  fs.writeFileSync(path.join(runtimeDir, 'CLEANUP.json'), JSON.stringify(cleanup, null, 2));

  // cleanup ephemeral leftovers
  const listedEnd =
    (await (await fetch(base + '/rest/workflows?limit=100', { headers: session })).json()).data || [];
  for (const w of listedEnd) {
    if (/REC008-8F2B2[45]/.test(w.name)) {
      if (!w.isArchived) {
        await fetch(base + '/rest/workflows/' + w.id + '/archive', { method: 'POST', headers: session });
      }
      await fetch(base + '/rest/workflows/' + w.id, { method: 'DELETE', headers: session });
    }
  }

  const mainEnd = (
    await (await fetch(base + '/rest/workflows/' + mainWorkflowId, { headers: session })).json()
  ).data;
  const mail1 = JSON.parse(
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
      finaliserSha: finaliserCodeSha(
        mainEnd.nodes.find((n) => n.name === 'Finaliser état création').parameters.query,
        mainEnd.nodes.find((n) => n.name === 'Finaliser état création').parameters.options
          .queryReplacement
      ),
      unchangedFromInstalled: true,
    },
    pg: pg(
      'SELECT (SELECT count(*) FROM rendez_vous),(SELECT count(*) FROM ai_conversation_state),(SELECT count(*) FROM ai_appointment_attempt),(SELECT count(*) FROM notifications);'
    ),
    syntheticRemaining: pg(
      `SELECT count(*) FROM ai_conversation_state WHERE session_id='${syntheticSessionId}';`
    ),
    realSession: sessionSnapshot(realSessionId),
    confirmed: attemptSnap(confirmedId),
    abandoned: attemptSnap(abandonedId),
    histFp: historicalFingerprint(),
    mockPosts: postCount(mockMeta()),
    gov: gov(),
    mailpit: { messages: mail1.Messages, unread: mail1.Unread, dbSize: mail1.DatabaseSize },
  };
  postflight.main.unchangedFromInstalled =
    postflight.main.finaliserSha === installedFinaliserSha &&
    postflight.main.versionId === expectedVersion &&
    postflight.main.versionCounter === expectedCounter;

  const pass =
    a1.ok &&
    a2.ok &&
    a3.ok &&
    cleanup.ok &&
    postflight.main.active === false &&
    postflight.main.unchangedFromInstalled &&
    postflight.pg === '1|8|2|0' &&
    postflight.syntheticRemaining === '0' &&
    postflight.mockPosts === 1 &&
    postflight.gov === expectedGov &&
    JSON.stringify(postflight.realSession) === JSON.stringify(real0);

  const result = {
    phase: '8F-2B25',
    pass,
    verdict: pass ? 'PASS' : 'FAIL',
    goInstall: pass ? 'GO' : 'NO-GO',
    candidateSha256: candidateSha,
    finaliserAfterSha256: afterSha,
    a1: {
      ok: a1.ok,
      success: a1.success,
      dollar3: a1.dollar3,
      reference: a1.sessionAfter && a1.sessionAfter.reference,
      tokenNull: a1.sessionAfter && !a1.sessionAfter.hasToken,
      boundP3: a1.expectedBound.p3,
    },
    a2: {
      ok: a2.ok,
      success: a2.success,
      dollar3: a2.dollar3,
      uuidType: a2.uuidType,
      reference: a2.sessionAfter && a2.sessionAfter.reference,
      token: a2.sessionAfter && a2.sessionAfter.token,
    },
    a3: {
      ok: a3.ok,
      success: a3.success,
      invalidUuid: a3.invalidUuid,
      errMsg: a3.errMsg,
      noPersist: a3.ok,
      upstreamValidationRecommended: a3.upstreamValidationRecommended,
    },
    noClaim: true,
    noPost: true,
    noMainPut: true,
    cleanup,
    postflight,
  };

  try {
    fs.unlinkSync(path.join(runtimeDir, '_mock.js'));
  } catch {}
  try {
    fs.unlinkSync(path.join(runtimeDir, '_net.js'));
  } catch {}

  fs.writeFileSync(path.join(outDir, 'POSTFLIGHT.json'), JSON.stringify(postflight, null, 2));
  fs.writeFileSync(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  process.exit(pass ? 0 : 4);
})().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
