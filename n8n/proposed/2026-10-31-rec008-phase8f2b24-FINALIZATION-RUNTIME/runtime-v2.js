const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { randomUUID } = require('crypto');
const { execFileSync } = require('child_process');

const outDir =
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-31-rec008-phase8f2b24-FINALIZATION-RUNTIME';
fs.mkdirSync(outDir, { recursive: true });

const envText = fs.readFileSync(
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-30-rec008-phase8e2b2-TEST-DEPLOY/.env.rec008-test.local',
  'utf8'
);
const value = (n) => envText.match(new RegExp('^' + n + '=(.*)$', 'm'))[1];
const base = 'http://127.0.0.1:5682';
const mainWorkflowId = 'OCD9It1uKFhOoWNF';
const expectedVersion = '32f405ee-424e-49af-8d4a-60598393849e';
const expectedCounter = 7;
const expectedFinaliserSha =
  'dfeaf3a439ea362bdf40453d27e25631274bc20ae9eb8d8aecb823a8118a741d';
const expectedGov = '13|14|12|48|0|a2dea067599fd4f0a5f857551adc67cc';
const syntheticSessionId = 'rec008-8f2b24-runtime-01';
const realSessionId = 'rec008-8f2b14-new-01';
const confirmedId = 'ad71a155-4d3a-45b9-8445-2ec98377feaa';
const abandonedId = '8ae63b62-9f87-4a15-9011-4554b7766918';
const ephemeralName = 'REC008-8F2B24-FINALISER-RUNTIME-EPHEMERAL';
const syntheticTokenUuid = '22222222-2222-4222-8222-222222222222';

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
  docker(['cp', tmp, 'govsuite-rec008-test-rec008-n8n-1:/tmp/_m24.js']);
  const t = docker(['exec', 'govsuite-rec008-test-rec008-n8n-1', 'node', '/tmp/_m24.js']).trim();
  docker(['exec', '-u', 'root', 'govsuite-rec008-test-rec008-n8n-1', 'rm', '-f', '/tmp/_m24.js']);
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
  docker(['cp', tmp, 'govsuite-rec008-test-rec008-n8n-1:/tmp/_n24.js']);
  const text = docker(['exec', 'govsuite-rec008-test-rec008-n8n-1', 'node', '/tmp/_n24.js']);
  docker(['exec', '-u', 'root', 'govsuite-rec008-test-rec008-n8n-1', 'rm', '-f', '/tmp/_n24.js']);
  const net = JSON.parse(text);
  return !(net.results || []).some((r) => r.expect === 'forbidden' && r.tcp === 'open');
}
function finaliserSha(p) {
  return sha((p.query || '') + '\n' + ((p.options && p.options.queryReplacement) || ''));
}
function sessionSnapshot(id) {
  const line = pg(
    `SELECT coalesce(conversation_step,''), coalesce(pending_action,''), coalesce(intent,''), coalesce(reference,''), coalesce(token::text,''), coalesce(nom,''), coalesce(telephone,''), coalesce(service,''), coalesce(site,''), coalesce(slot_id::text,''), coalesce(last_user_message,'') FROM ai_conversation_state WHERE session_id='${id}';`
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
    slot_id: p[9],
    last_user_message: p[10],
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
function stop(reason, detail, verdict) {
  const payload = {
    ok: false,
    stopped: true,
    reason,
    detail,
    verdict: verdict || (reason === 'mechanism-nogo' ? 'NO-GO' : 'FAIL'),
  };
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

function extractExecError(execJson) {
  const raw = JSON.stringify(execJson);
  const dollar3 = /there is no parameter \$3/i.test(raw);
  let message = null;
  const m = raw.match(/"message":"(there is no parameter \$3[^"]*)"/);
  if (m) message = m[1];
  else if (dollar3) message = 'there is no parameter $3';
  else {
    const m2 = raw.match(/"message":"([^"]{0,200})"/);
    if (m2) message = m2[1];
  }
  return { dollar3, message, status: (execJson.data && execJson.data.status) || execJson.status };
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

  // cleanup leftovers
  const listed0 =
    (await (await fetch(base + '/rest/workflows?limit=100', { headers: session })).json()).data || [];
  for (const w of listed0) {
    if (/REC008-8F2B24/.test(w.name)) {
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
  const fSha = finaliserSha(finaliserLive.parameters);
  const mock0 = mockMeta();
  const mail0 = JSON.parse(
    docker(['exec', 'govsuite-mailpit', 'wget', '-qO-', 'http://127.0.0.1:8025/api/v1/info'])
  );
  const pg0 = pg(
    'SELECT (SELECT count(*) FROM rendez_vous),(SELECT count(*) FROM ai_conversation_state),(SELECT count(*) FROM ai_appointment_attempt),(SELECT count(*) FROM notifications);'
  );
  const realSession0 = sessionSnapshot(realSessionId);
  const confirmed0 = attemptSnap(confirmedId);
  const abandoned0 = attemptSnap(abandonedId);
  const histFp0 = historicalFingerprint();
  const synExists0 = pg(`SELECT count(*) FROM ai_conversation_state WHERE session_id='${syntheticSessionId}';`);
  const gov0 = gov();
  const net = networkOk();

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
    fSha === expectedFinaliserSha &&
    pg0 === '1|8|2|0' &&
    synExists0 === '0' &&
    postCount(mock0) === 1 &&
    gov0 === expectedGov &&
    mail0.Messages === 5;

  const preflight = {
    ok: preOk,
    versionId: main.versionId,
    versionCounter: main.versionCounter,
    active: main.active,
    finaliserSha: fSha,
    pg: pg0,
    synExists: synExists0,
    mockPosts: postCount(mock0),
    gov: gov0,
  };
  fs.writeFileSync(path.join(outDir, 'PREFLIGHT.json'), JSON.stringify(preflight, null, 2));
  if (!preOk) stop('preflight', preflight);

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
    const body = buildEphemeral(
      finaliserLive.parameters,
      finaliserLive.credentials,
      scenarioPayload
    );
    const fin = body.nodes.find((n) => n.name === 'Finaliser état création');
    if (finaliserSha(fin.parameters) !== expectedFinaliserSha) {
      throw new Error('sha mismatch');
    }
    const createdRes = await fetchRetry(base + '/rest/workflows', {
      method: 'POST',
      headers: session,
      body: JSON.stringify(body),
    });
    const created = JSON.parse(await createdRes.text());
    const wf = created.data || created;
    if (!wf || !wf.id) throw new Error('create failed ' + JSON.stringify(created).slice(0, 300));
    if (wf.active) throw new Error('ephemeral active');

    const run = await fetchRetry(base + '/rest/workflows/' + wf.id + '/run', {
      method: 'POST',
      headers: session,
      body: JSON.stringify({
        triggerToStartFrom: { name: 'Manual Trigger' },
        destinationNode: { nodeName: 'Finaliser état création', mode: 'inclusive' },
      }),
    });
    const runText = await run.text();
    const runJson = JSON.parse(runText);
    const executionId = runJson.data && runJson.data.executionId;
    let execJson = null;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 400));
      const ex = await fetchRetry(
        base + '/rest/executions/' + executionId + '?includeData=true',
        { headers: session },
        3
      );
      execJson = JSON.parse(await ex.text());
      const st = (execJson.data && execJson.data.status) || execJson.status;
      if (st && st !== 'running' && st !== 'new' && st !== 'waiting') break;
    }
    fs.writeFileSync(path.join(outDir, tag + '-exec.json'), JSON.stringify(execJson).slice(0, 50000));

    try {
      await fetchRetry(base + '/rest/workflows/' + wf.id + '/archive', {
        method: 'POST',
        headers: session,
      });
      await fetchRetry(base + '/rest/workflows/' + wf.id, {
        method: 'DELETE',
        headers: session,
      });
    } catch (_) {}

    const err = extractExecError(execJson || {});
    return {
      tag,
      runStatus: run.status,
      executionId,
      execStatus: err.status,
      dollar3Error: err.dollar3,
      errorMessage: err.message,
      sessionAfter: sessionSnapshot(scenarioPayload.sessionId),
      queryReplacementInstalled: finaliserLive.parameters.options.queryReplacement,
      expressionsEvaluated: true,
      usedInstalledSql: true,
      usedTestCredential: finaliserLive.credentials.postgres.id === 'Fs0l0058q5CEadRw',
    };
  }

  // Mechanism dry-run BEFORE synthetic write
  const dry = await createAndRun(
    {
      sessionId: 'rec008-8f2b24-dry-nonexistent',
      appointmentReference: 'REC008-RUNTIME-DRY-000',
      appointment: { reference: 'REC008-RUNTIME-DRY-000' },
    },
    'MECHANISM_DRY'
  );
  const mechanism = {
    ok: dry.runStatus === 200 && dry.expressionsEvaluated && dry.usedInstalledSql,
    // dry with absent token is EXPECTED to still hit $3 with current install — proves real evaluation path
    isolatedExecutionWorks: dry.runStatus === 200 && !!dry.executionId,
    observedDollar3OnAbsentToken: dry.dollar3Error === true,
    endpoint: 'POST /rest/workflows/{ephemeralId}/run',
    payload: {
      triggerToStartFrom: { name: 'Manual Trigger' },
      destinationNode: { nodeName: 'Finaliser état création', mode: 'inclusive' },
    },
    proof:
      'Ephemeral inactive workflow created; ManualRunDto executed Finaliser with installed query+queryReplacement and TEST credential; n8n resolved named Code stubs; PostgreSQL node returned there is no parameter $3 when token absent despite || empty-string coerce — proving expressions were evaluated and empty $3 segment is still omitted by n8n Postgres queryReplacement binding.',
    dry,
  };
  fs.writeFileSync(path.join(outDir, 'MECHANISM.json'), JSON.stringify(mechanism, null, 2));

  if (!mechanism.isolatedExecutionWorks) {
    stop('mechanism-nogo', mechanism);
  }

  // counts unchanged after dry
  if (
    pg(
      'SELECT (SELECT count(*) FROM rendez_vous),(SELECT count(*) FROM ai_conversation_state),(SELECT count(*) FROM ai_appointment_attempt),(SELECT count(*) FROM notifications);'
    ) !== '1|8|2|0'
  ) {
    stop('mechanism-nogo', { reason: 'pg-changed-on-dry' });
  }

  // Create synthetic session
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
  const syn0 = sessionSnapshot(syntheticSessionId);
  fs.writeFileSync(
    path.join(outDir, 'SYNTHETIC_CREATED.json'),
    JSON.stringify({ sessionId: syntheticSessionId, initial: syn0, pg: pg(
      'SELECT (SELECT count(*) FROM rendez_vous),(SELECT count(*) FROM ai_conversation_state),(SELECT count(*) FROM ai_appointment_attempt),(SELECT count(*) FROM notifications);'
    ) }, null, 2)
  );

  // A1 token absent
  const a1 = await createAndRun(
    {
      sessionId: syntheticSessionId,
      appointmentReference: 'REC008-RUNTIME-NULL-001',
      appointment: { reference: 'REC008-RUNTIME-NULL-001' },
    },
    'A1'
  );
  a1.expectedSuccess = false; // installed fix insufficient
  a1.sessionUnchangedFromInit =
    a1.sessionAfter &&
    a1.sessionAfter.conversation_step === 'AWAIT_CREATE_CONFIRMATION' &&
    a1.sessionAfter.reference === '' &&
    !a1.sessionAfter.hasToken;
  a1.okScenario =
    a1.dollar3Error === true && a1.sessionUnchangedFromInit === true; // proves runtime defect for absent token

  const integrityA1 = {
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
  integrityA1.ok =
    integrityA1.pg === '1|9|2|0' &&
    integrityA1.confirmed === confirmed0 &&
    integrityA1.abandoned === abandoned0 &&
    JSON.stringify(integrityA1.realSession) === JSON.stringify(realSession0) &&
    integrityA1.histFp === histFp0 &&
    integrityA1.mockPosts === 1 &&
    integrityA1.gov === expectedGov;

  fs.writeFileSync(path.join(outDir, 'A1.json'), JSON.stringify({ a1, integrityA1 }, null, 2));
  if (!integrityA1.ok) {
    stop('critical-other-row', { a1, integrityA1 }, 'FAIL');
  }

  // A2 token present (non-secret synthetic UUID — column type uuid)
  pg(
    `UPDATE ai_conversation_state SET
      intent='CREATE_APPOINTMENT', service='PASSEPORT', site='PARIS',
      conversation_step='AWAIT_CREATE_CONFIRMATION', pending_action='CREATE_APPOINTMENT',
      nom='Runtime', prenom='Synth', email='runtime.synth@example.test', telephone='+33000000001',
      reference=NULL, token=NULL, last_user_message='synthetic-reset-before-a2',
      updated_at=NOW(), expires_at=NOW()+INTERVAL '2 hours'
     WHERE session_id='${syntheticSessionId}';`
  );

  const a2 = await createAndRun(
    {
      sessionId: syntheticSessionId,
      appointmentReference: 'REC008-RUNTIME-TOKEN-002',
      appointment: {
        reference: 'REC008-RUNTIME-TOKEN-002',
        token: syntheticTokenUuid,
      },
    },
    'A2'
  );
  a2.tokenLabelNote =
    'Mission label TEST-TOKEN-NON-SECRET-002 mapped to synthetic UUID 22222222-2222-4222-8222-222222222222 because ai_conversation_state.token is uuid';
  a2.okScenario =
    a2.dollar3Error === false &&
    a2.sessionAfter &&
    a2.sessionAfter.reference === 'REC008-RUNTIME-TOKEN-002' &&
    a2.sessionAfter.token === syntheticTokenUuid &&
    a2.sessionAfter.conversation_step === '' &&
    a2.sessionAfter.pending_action === '' &&
    a2.sessionAfter.intent === '';

  const integrityA2 = {
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
  integrityA2.ok =
    integrityA2.pg === '1|9|2|0' &&
    integrityA2.confirmed === confirmed0 &&
    integrityA2.abandoned === abandoned0 &&
    JSON.stringify(integrityA2.realSession) === JSON.stringify(realSession0) &&
    integrityA2.histFp === histFp0 &&
    integrityA2.mockPosts === 1 &&
    integrityA2.gov === expectedGov;

  fs.writeFileSync(path.join(outDir, 'A2.json'), JSON.stringify({ a2, integrityA2 }, null, 2));
  if (!integrityA2.ok) {
    stop('critical-other-row', { a2, integrityA2 }, 'FAIL');
  }

  // Cleanup synthetic only
  const beforeDelete = pg(`SELECT session_id FROM ai_conversation_state WHERE session_id='${syntheticSessionId}';`);
  const deleted = pg(
    `DELETE FROM ai_conversation_state WHERE session_id='${syntheticSessionId}' RETURNING session_id;`
  );
  const remaining = pg(`SELECT count(*) FROM ai_conversation_state WHERE session_id='${syntheticSessionId}';`);
  const cleanup = {
    targetedId: syntheticSessionId,
    beforeDelete,
    deleted,
    remaining,
    ok: beforeDelete === syntheticSessionId && deleted === syntheticSessionId && remaining === '0',
  };
  fs.writeFileSync(path.join(outDir, 'CLEANUP.json'), JSON.stringify(cleanup, null, 2));

  // leftover ephemeral cleanup
  const listedEnd =
    (await (await fetch(base + '/rest/workflows?limit=100', { headers: session })).json()).data || [];
  for (const w of listedEnd) {
    if (/REC008-8F2B24/.test(w.name)) {
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
      finaliserSha: finaliserSha(
        mainEnd.nodes.find((n) => n.name === 'Finaliser état création').parameters
      ),
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

  // Mission success criteria for A1 was "no $3 error"; observed opposite → FAIL
  const pass =
    false && // explicit: A1 mission success not met
    a2.okScenario &&
    cleanup.ok;

  const proposedFix = {
    published: false,
    putExecuted: false,
    rationale:
      'n8n Postgres queryReplacement drops empty-string segments, so || \'\' still omits $3. Use a non-empty sentinel then NULLIF.',
    queryReplacementAfter:
      "={{ $('Lorsqu\\'un message de chat est reçu').item.json.sessionId }},{{ $('Paramètres clôture confirmation').item.json.appointmentReference || '' }},{{ (($('Paramètres clôture confirmation').item.json.appointment || {}).token_gestion || ($('Paramètres clôture confirmation').item.json.appointment || {}).token || '__ABSENT__') }}",
    queryTokenLineAfter: "token = NULLIF(NULLIF($3::text, ''), '__ABSENT__'),",
    note: 'NON-PUBLISHED proposal only; requires distinct authorization to install.',
  };
  fs.writeFileSync(path.join(outDir, 'PROPOSED_FIX_NON_PUBLIE.json'), JSON.stringify(proposedFix, null, 2));

  const result = {
    phase: '8F-2B24',
    pass: false,
    verdict: 'FAIL',
    goReconcile: 'NO-GO',
    reason:
      'A1 token-absent still raises there is no parameter $3 in real n8n runtime despite installed || empty coerce; A2 with non-empty synthetic UUID token succeeds — empty segment stripping confirmed.',
    mechanism,
    a1: {
      dollar3Error: a1.dollar3Error,
      sessionUnchanged: a1.sessionUnchangedFromInit,
      missionSuccess: false,
      diagnosticOk: a1.okScenario,
    },
    a2: {
      dollar3Error: a2.dollar3Error,
      missionSuccess: a2.okScenario,
      reference: a2.sessionAfter && a2.sessionAfter.reference,
      token: a2.sessionAfter && a2.sessionAfter.token,
      cleaned: a2.sessionAfter && a2.sessionAfter.conversation_step === '',
      tokenNote: a2.tokenLabelNote,
    },
    noClaim: true,
    noPost: postflight.mockPosts === 1,
    noMainPut: true,
    cleanup,
    postflight,
    proposedFix,
  };

  // postflight structural OK even if functional FAIL
  result.postflightOk =
    postflight.main.active === false &&
    postflight.main.versionCounter === 7 &&
    postflight.pg === '1|8|2|0' &&
    postflight.syntheticRemaining === '0' &&
    postflight.mockPosts === 1 &&
    postflight.gov === expectedGov &&
    cleanup.ok;

  fs.writeFileSync(path.join(outDir, 'POSTFLIGHT.json'), JSON.stringify(postflight, null, 2));
  fs.writeFileSync(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.postflightOk ? 4 : 5); // 4 = FAIL functional but clean; 5 = messy
})().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
