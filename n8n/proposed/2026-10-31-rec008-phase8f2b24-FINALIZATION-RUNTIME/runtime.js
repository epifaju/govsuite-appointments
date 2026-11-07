const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { randomUUID } = require('crypto');

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
function stop(reason, detail) {
  const payload = { ok: false, stopped: true, reason, detail, verdict: reason === 'mechanism-nogo' ? 'NO-GO' : 'FAIL' };
  fs.writeFileSync(path.join(outDir, 'STOP.json'), JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
  process.exit(2);
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

function buildEphemeralWorkflow(finaliserParams, finaliserCreds, scenarioPayload) {
  // scenarioPayload: { sessionId, appointmentReference, appointment }
  const idTrigger = randomUUID();
  const idChat = randomUUID();
  const idParams = randomUUID();
  const idFinal = randomUUID();
  const chatCode = `return [{ json: ${JSON.stringify({ sessionId: scenarioPayload.sessionId })} }];`;
  const paramsCode = `return [{ json: ${JSON.stringify({
    appointmentReference: scenarioPayload.appointmentReference,
    appointment: scenarioPayload.appointment,
  })} }];`;

  return {
    name: ephemeralName,
    nodes: [
      {
        id: idTrigger,
        name: 'When clicking ‘Execute workflow’',
        type: 'n8n-nodes-base.manualTrigger',
        typeVersion: 1,
        position: [0, 0],
        parameters: {},
      },
      {
        id: idChat,
        name: "Lorsqu'un message de chat est reçu",
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [220, 0],
        parameters: { jsCode: chatCode },
      },
      {
        id: idParams,
        name: 'Paramètres clôture confirmation',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [440, 0],
        parameters: { jsCode: paramsCode },
      },
      {
        id: idFinal,
        name: 'Finaliser état création',
        type: 'n8n-nodes-base.postgres',
        typeVersion: 2.7,
        position: [660, 0],
        parameters: JSON.parse(JSON.stringify(finaliserParams)),
        credentials: JSON.parse(JSON.stringify(finaliserCreds)),
      },
    ],
    connections: {
      "When clicking ‘Execute workflow’": {
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

(async () => {
  if (new URL(base).port !== '5682') throw new Error('mauvais port');

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

  const main = (await (await fetch(base + '/rest/workflows/' + mainWorkflowId, { headers: session })).json()).data;
  const listed =
    (await (await fetch(base + '/rest/workflows?limit=50', { headers: session })).json()).data || [];
  const finaliserLive = main.nodes.find((n) => n.name === 'Finaliser état création');
  const fSha = finaliserSha(finaliserLive.parameters);
  const urls = urlsOf(main.nodes);
  const edges = edgesOf(main.connections);
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
  const realSession0 = sessionSnapshot(realSessionId);
  const confirmed0 = attemptSnap(confirmedId);
  const abandoned0 = attemptSnap(abandonedId);
  const histFp0 = historicalFingerprint();
  const synExists0 = pg(`SELECT count(*) FROM ai_conversation_state WHERE session_id='${syntheticSessionId}';`);
  const gov0 = gov();

  const preflight = {
    active: main.active,
    activeVersionId: main.activeVersionId || null,
    versionId: main.versionId,
    versionCounter: main.versionCounter,
    nodes: main.nodes.length,
    edges,
    activeIds: listed.filter((r) => r.active).map((r) => r.id),
    urlsOk: urls.length === 10 && urls.every((u) => u.startsWith('http://rec008-mock:8080/')),
    networkOk: net,
    finaliserSha: fSha,
    postgresCredential: finaliserLive.credentials.postgres.id,
    pg: pg0,
    statuses,
    open,
    realSession: realSession0,
    confirmed: confirmed0,
    abandoned: abandoned0,
    histFp: histFp0,
    syntheticExists: synExists0,
    mockPosts: postCount(mock0),
    gov: gov0,
    mailpit: { messages: mail0.Messages, unread: mail0.Unread, dbSize: mail0.DatabaseSize },
  };

  const preOk =
    main.active === false &&
    (main.activeVersionId || null) === null &&
    main.versionId === expectedVersion &&
    main.versionCounter === expectedCounter &&
    main.nodes.length === 134 &&
    edges === 137 &&
    preflight.activeIds.length === 0 &&
    preflight.urlsOk &&
    net &&
    fSha === expectedFinaliserSha &&
    finaliserLive.credentials.postgres.id === 'Fs0l0058q5CEadRw' &&
    pg0 === '1|8|2|0' &&
    open === '0' &&
    synExists0 === '0' &&
    postCount(mock0) === 1 &&
    gov0 === expectedGov &&
    mail0.Messages === 5 &&
    mail0.Unread === 2 &&
    mail0.DatabaseSize === 98304;

  fs.writeFileSync(path.join(outDir, 'PREFLIGHT.json'), JSON.stringify(preflight, null, 2));
  if (!preOk) stop('preflight', preflight);

  // --- Mechanism proof: create ephemeral workflow, dry-run UPDATE 0 rows, prove $3 bound ---
  const installedQuery = finaliserLive.parameters.query;
  const installedReplacement = finaliserLive.parameters.options.queryReplacement;
  if (!installedQuery.includes("NULLIF($3::text, '')") || !installedReplacement.includes("|| ''")) {
    stop('mechanism-nogo', { reason: 'installed-finaliser-unexpected' });
  }

  async function createEphemeral(scenarioPayload) {
    const body = buildEphemeralWorkflow(
      finaliserLive.parameters,
      finaliserLive.credentials,
      scenarioPayload
    );
    // Ensure exact queryReplacement string from installed node
    const fin = body.nodes.find((n) => n.name === 'Finaliser état création');
    if (finaliserSha(fin.parameters) !== expectedFinaliserSha) {
      throw new Error('ephemeral finaliser sha mismatch');
    }
    const created = await fetch(base + '/rest/workflows', {
      method: 'POST',
      headers: session,
      body: JSON.stringify(body),
    });
    const createdText = await created.text();
    let createdJson;
    try {
      createdJson = JSON.parse(createdText);
    } catch {
      createdJson = { message: createdText.slice(0, 500) };
    }
    if (created.status !== 200 && created.status !== 201) {
      throw new Error('create ephemeral ' + created.status + ' ' + JSON.stringify(createdJson).slice(0, 400));
    }
    return createdJson.data || createdJson;
  }

  async function runEphemeral(wf) {
    // Editor manual run — does not activate webhooks
    const runBody = {
      workflowData: {
        id: wf.id,
        name: wf.name,
        nodes: wf.nodes,
        connections: wf.connections,
        settings: wf.settings || { executionOrder: 'v1' },
        pinData: wf.pinData || {},
        active: false,
      },
    };
    const run = await fetch(base + '/rest/workflows/run', {
      method: 'POST',
      headers: session,
      body: JSON.stringify(runBody),
    });
    const runText = await run.text();
    let runJson;
    try {
      runJson = JSON.parse(runText);
    } catch {
      runJson = { raw: runText.slice(0, 1000) };
    }
    return { status: run.status, body: runJson };
  }

  async function deleteEphemeral(id) {
    if (!id) return;
    // Try archive/delete patterns
    const del = await fetch(base + '/rest/workflows/' + id, {
      method: 'DELETE',
      headers: session,
    });
    return { status: del.status, text: (await del.text()).slice(0, 300) };
  }

  // Dry mechanism proof: no synthetic session yet — UPDATE matches 0 rows but must bind $3
  let ephemeralId = null;
  let mechanism = null;
  try {
    const dryWf = await createEphemeral({
      sessionId: 'rec008-8f2b24-dry-nonexistent',
      appointmentReference: 'REC008-RUNTIME-DRY-000',
      appointment: { reference: 'REC008-RUNTIME-DRY-000' },
    });
    ephemeralId = dryWf.id;
    if (dryWf.active === true) {
      await deleteEphemeral(ephemeralId);
      stop('mechanism-nogo', { reason: 'ephemeral-created-active' });
    }
    // Confirm main unchanged
    const mainCheck = (
      await (await fetch(base + '/rest/workflows/' + mainWorkflowId, { headers: session })).json()
    ).data;
    if (
      mainCheck.versionId !== expectedVersion ||
      mainCheck.versionCounter !== expectedCounter ||
      mainCheck.active !== false
    ) {
      await deleteEphemeral(ephemeralId);
      stop('mechanism-nogo', { reason: 'main-mutated-on-ephemeral-create', mainCheck });
    }

    const dryRun = await runEphemeral(dryWf);
    fs.writeFileSync(
      path.join(outDir, 'MECHANISM_DRY_RUN.json'),
      JSON.stringify(
        {
          ephemeralId,
          ephemeralActive: dryWf.active,
          runStatus: dryRun.status,
          finished: dryRun.body && (dryRun.body.data || dryRun.body).finished,
          error:
            dryRun.body &&
            dryRun.body.data &&
            dryRun.body.data.resultData &&
            dryRun.body.data.resultData.error,
          finaliserError: (() => {
            const rd =
              dryRun.body &&
              dryRun.body.data &&
              dryRun.body.data.resultData &&
              dryRun.body.data.resultData.runData;
            const runs = rd && rd['Finaliser état création'];
            return runs && runs[0] && runs[0].error ? runs[0].error : null;
          })(),
          finaliserJson: (() => {
            const rd =
              dryRun.body &&
              dryRun.body.data &&
              dryRun.body.data.resultData &&
              dryRun.body.data.resultData.runData;
            const runs = rd && rd['Finaliser état création'];
            if (!runs || !runs[0]) return null;
            return {
              executionStatus: runs[0].executionStatus,
              hasError: !!runs[0].error,
              errorMessage: runs[0].error ? String(runs[0].error.message || runs[0].error).slice(0, 400) : null,
              itemCount: (runs[0].data && runs[0].data.main && runs[0].data.main[0] && runs[0].data.main[0].length) || 0,
            };
          })(),
        },
        null,
        2
      )
    );

    const dryErr =
      (dryRun.body &&
        dryRun.body.data &&
        dryRun.body.data.resultData &&
        dryRun.body.data.resultData.error) ||
      (() => {
        const rd =
          dryRun.body &&
          dryRun.body.data &&
          dryRun.body.data.resultData &&
          dryRun.body.data.resultData.runData;
        const runs = rd && rd['Finaliser état création'];
        return runs && runs[0] && runs[0].error;
      })();

    const dryMsg = dryErr ? String(dryErr.message || dryErr) : '';
    if (dryRun.status !== 200 || /there is no parameter \$3/i.test(dryMsg)) {
      await deleteEphemeral(ephemeralId);
      stop('mechanism-nogo', {
        reason: 'dry-run-failed-or-dollar3',
        status: dryRun.status,
        message: dryMsg.slice(0, 500),
        bodyPreview: JSON.stringify(dryRun.body).slice(0, 800),
      });
    }

    // If Finaliser node itself errored for other reasons, still NO-GO
    const rd =
      dryRun.body &&
      dryRun.body.data &&
      dryRun.body.data.resultData &&
      dryRun.body.data.resultData.runData;
    const finRuns = rd && rd['Finaliser état création'];
    if (!finRuns || !finRuns[0] || finRuns[0].error) {
      await deleteEphemeral(ephemeralId);
      stop('mechanism-nogo', {
        reason: 'finaliser-node-error',
        error: finRuns && finRuns[0] && finRuns[0].error,
      });
    }

    mechanism = {
      ok: true,
      ephemeralId,
      runStatus: dryRun.status,
      evaluatedExpressions: true,
      usedInstalledSql: true,
      usedTestCredential: true,
      dollar3Error: false,
      rowsUpdated: finRuns[0].data.main[0].length,
      proof:
        'Ephemeral inactive workflow executed via POST /rest/workflows/run; Finaliser node used installed query+queryReplacement; n8n resolved $(\'Lorsqu\\\'un message de chat est reçu\') and $(\'Paramètres clôture confirmation\'); PostgreSQL accepted $1,$2,$3 (0 rows for nonexistent session).',
    };
    fs.writeFileSync(path.join(outDir, 'MECHANISM.json'), JSON.stringify(mechanism, null, 2));

    // Delete dry ephemeral before synthetic writes; recreate per scenario for clarity
    await deleteEphemeral(ephemeralId);
    ephemeralId = null;
  } catch (e) {
    if (ephemeralId) {
      try {
        await deleteEphemeral(ephemeralId);
      } catch (_) {}
    }
    stop('mechanism-nogo', { reason: 'exception', message: String(e.message || e).slice(0, 800) });
  }

  // Re-verify no synthetic / counts unchanged after dry
  if (pg(`SELECT count(*) FROM ai_conversation_state WHERE session_id='${syntheticSessionId}';`) !== '0') {
    stop('mechanism-nogo', { reason: 'synthetic-appeared-during-dry' });
  }
  if (
    pg(
      'SELECT (SELECT count(*) FROM rendez_vous),(SELECT count(*) FROM ai_conversation_state),(SELECT count(*) FROM ai_appointment_attempt),(SELECT count(*) FROM notifications);'
    ) !== '1|8|2|0'
  ) {
    stop('mechanism-nogo', { reason: 'pg-changed-during-dry' });
  }

  // --- Create synthetic session (minimal) ---
  const insertSql = `INSERT INTO ai_conversation_state (
    session_id, intent, service, site, conversation_step, pending_action,
    nom, prenom, email, telephone, last_user_message, created_at, updated_at, expires_at
  ) VALUES (
    '${syntheticSessionId}',
    'CREATE_APPOINTMENT',
    'PASSEPORT',
    'PARIS',
    'AWAIT_CREATE_CONFIRMATION',
    'CREATE_APPOINTMENT',
    'Runtime',
    'Synth',
    'runtime.synth@example.test',
    '+33000000001',
    'synthetic-init',
    NOW(),
    NOW(),
    NOW() + INTERVAL '2 hours'
  )
  RETURNING session_id, conversation_step, coalesce(reference,''), coalesce(token,'');`;
  const inserted = pg(insertSql);
  if (!inserted.startsWith(syntheticSessionId + '|')) {
    stop('synthetic-create', { inserted });
  }
  const synAfterCreate = sessionSnapshot(syntheticSessionId);
  const pgAfterCreate = pg(
    'SELECT (SELECT count(*) FROM rendez_vous),(SELECT count(*) FROM ai_conversation_state),(SELECT count(*) FROM ai_appointment_attempt),(SELECT count(*) FROM notifications);'
  );
  if (pgAfterCreate !== '1|9|2|0') {
    // cleanup attempt then fail
    pg(`DELETE FROM ai_conversation_state WHERE session_id='${syntheticSessionId}';`);
    stop('synthetic-create-counts', { pgAfterCreate });
  }
  fs.writeFileSync(
    path.join(outDir, 'SYNTHETIC_CREATED.json'),
    JSON.stringify(
      {
        sessionId: syntheticSessionId,
        initial: synAfterCreate,
        pg: pgAfterCreate,
        attemptsUnchanged: attemptSnap(confirmedId) === confirmed0 && attemptSnap(abandonedId) === abandoned0,
        histFpUnchanged: historicalFingerprint() === histFp0,
      },
      null,
      2
    )
  );

  async function runScenario(tag, payload, expect) {
    const wf = await createEphemeral(payload);
    ephemeralId = wf.id;
    // Confirm Finaliser params sha still exact
    const finNode = wf.nodes.find((n) => n.name === 'Finaliser état création');
    if (finaliserSha(finNode.parameters) !== expectedFinaliserSha) {
      await deleteEphemeral(wf.id);
      throw new Error(tag + ' sha mismatch');
    }
    const run = await runEphemeral(wf);
    const rd =
      run.body && run.body.data && run.body.data.resultData && run.body.data.resultData.runData;
    const finRuns = rd && rd['Finaliser état création'];
    const nodeError = finRuns && finRuns[0] && finRuns[0].error;
    const errMsg = nodeError ? String(nodeError.message || nodeError) : '';
    const items =
      (finRuns &&
        finRuns[0] &&
        finRuns[0].data &&
        finRuns[0].data.main &&
        finRuns[0].data.main[0]) ||
      [];
    const after = sessionSnapshot(syntheticSessionId);
    const out = {
      tag,
      runStatus: run.status,
      dollar3Error: /there is no parameter \$3/i.test(errMsg),
      nodeError: errMsg.slice(0, 400) || null,
      returnedRows: items.length,
      returnedReference: items[0] && items[0].json && items[0].json.reference,
      returnedToken: items[0] && items[0].json && items[0].json.token,
      sessionAfter: after,
      expect,
      ok: false,
    };
    out.ok =
      run.status === 200 &&
      !out.dollar3Error &&
      !nodeError &&
      after &&
      after.reference === expect.reference &&
      (expect.token === null ? !after.hasToken && after.token === '' : after.token === expect.token) &&
      after.conversation_step === '' &&
      after.pending_action === '' &&
      after.intent === '' &&
      after.nom === '' &&
      after.telephone === '';

    await deleteEphemeral(wf.id);
    ephemeralId = null;
    fs.writeFileSync(path.join(outDir, tag + '.json'), JSON.stringify(out, null, 2));
    return out;
  }

  function resetSynthetic(seedMessage) {
    pg(
      `UPDATE ai_conversation_state SET
        intent='CREATE_APPOINTMENT',
        service='PASSEPORT',
        site='PARIS',
        conversation_step='AWAIT_CREATE_CONFIRMATION',
        pending_action='CREATE_APPOINTMENT',
        nom='Runtime',
        prenom='Synth',
        email='runtime.synth@example.test',
        telephone='+33000000001',
        reference=NULL,
        token=NULL,
        slot_id=NULL,
        available_slots=NULL,
        selected_slot_index=NULL,
        last_user_message='${seedMessage}',
        updated_at=NOW(),
        expires_at=NOW()+INTERVAL '2 hours'
      WHERE session_id='${syntheticSessionId}';`
    );
  }

  // A1 — token absent
  const a1 = await runScenario(
    'A1',
    {
      sessionId: syntheticSessionId,
      appointmentReference: 'REC008-RUNTIME-NULL-001',
      appointment: { reference: 'REC008-RUNTIME-NULL-001' },
    },
    { reference: 'REC008-RUNTIME-NULL-001', token: null }
  );

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

  fs.writeFileSync(path.join(outDir, 'INTEGRITY_A1.json'), JSON.stringify(integrityA1, null, 2));
  if (!a1.ok || !integrityA1.ok) {
    // keep synthetic for diagnosis if integrity failed critically on other rows
    if (!integrityA1.ok && integrityA1.confirmed !== confirmed0) {
      stop('critical-other-row', { a1, integrityA1 });
    }
    stop('a1-fail', { a1, integrityA1 });
  }

  // A2 — reset then token present
  // Column ai_conversation_state.token is UUID: mission label TEST-TOKEN-NON-SECRET-002
  // is represented by a clearly synthetic non-secret UUID (not a real management token).
  const syntheticTokenUuid = '22222222-2222-4222-8222-222222222222';
  resetSynthetic('synthetic-reset-before-a2');
  const a2 = await runScenario(
    'A2',
    {
      sessionId: syntheticSessionId,
      appointmentReference: 'REC008-RUNTIME-TOKEN-002',
      appointment: {
        reference: 'REC008-RUNTIME-TOKEN-002',
        token: syntheticTokenUuid,
      },
    },
    { reference: 'REC008-RUNTIME-TOKEN-002', token: syntheticTokenUuid }
  );

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

  fs.writeFileSync(path.join(outDir, 'INTEGRITY_A2.json'), JSON.stringify(integrityA2, null, 2));
  if (!a2.ok || !integrityA2.ok) {
    if (!integrityA2.ok && integrityA2.confirmed !== confirmed0) {
      stop('critical-other-row', { a2, integrityA2 });
    }
    stop('a2-fail', { a2, integrityA2 });
  }

  // Cleanup synthetic only
  const beforeDelete = pg(`SELECT session_id FROM ai_conversation_state WHERE session_id='${syntheticSessionId}';`);
  if (beforeDelete !== syntheticSessionId) {
    stop('cleanup-missing', { beforeDelete });
  }
  const deleted = pg(
    `DELETE FROM ai_conversation_state WHERE session_id='${syntheticSessionId}' RETURNING session_id;`
  );
  const stillThere = pg(`SELECT count(*) FROM ai_conversation_state WHERE session_id='${syntheticSessionId}';`);
  const cleanup = {
    targetedId: syntheticSessionId,
    verifiedBeforeDelete: beforeDelete,
    deletedReturning: deleted,
    remainingCount: stillThere,
    ok: deleted === syntheticSessionId && stillThere === '0',
  };
  fs.writeFileSync(path.join(outDir, 'CLEANUP.json'), JSON.stringify(cleanup, null, 2));
  if (!cleanup.ok) stop('cleanup-fail', cleanup);

  // Ensure no leftover ephemeral workflows
  const listedEnd =
    (await (await fetch(base + '/rest/workflows?limit=100', { headers: session })).json()).data || [];
  const leftovers = listedEnd.filter((w) => w.name === ephemeralName);
  for (const w of leftovers) {
    await deleteEphemeral(w.id);
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
    activeIds: listedEnd.filter((r) => r.active).map((r) => r.id),
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
    ephemeralLeftovers: listedEnd.filter((w) => w.name === ephemeralName).length,
  };

  const pass =
    postflight.main.active === false &&
    postflight.main.activeVersionId === null &&
    postflight.main.versionId === expectedVersion &&
    postflight.main.versionCounter === expectedCounter &&
    postflight.main.nodes === 134 &&
    postflight.main.edges === 137 &&
    postflight.main.finaliserSha === expectedFinaliserSha &&
    postflight.activeIds.length === 0 &&
    postflight.pg === '1|8|2|0' &&
    postflight.syntheticRemaining === '0' &&
    JSON.stringify(postflight.realSession) === JSON.stringify(realSession0) &&
    postflight.confirmed === confirmed0 &&
    postflight.abandoned === abandoned0 &&
    postflight.histFp === histFp0 &&
    postflight.mockPosts === 1 &&
    postflight.gov === expectedGov &&
    postflight.mailpit.messages === 5 &&
    postflight.mailpit.unread === 2 &&
    postflight.mailpit.dbSize === 98304 &&
    a1.ok &&
    a2.ok &&
    mechanism.ok;

  const result = {
    phase: '8F-2B24',
    pass,
    verdict: pass ? 'PASS' : 'FAIL',
    goReconcile: pass ? 'GO' : 'NO-GO',
    mechanism,
    a1: {
      ok: a1.ok,
      dollar3Error: a1.dollar3Error,
      reference: a1.sessionAfter && a1.sessionAfter.reference,
      tokenNull: a1.sessionAfter && !a1.sessionAfter.hasToken,
      cleaned: a1.sessionAfter && a1.sessionAfter.conversation_step === '',
    },
    a2: {
      ok: a2.ok,
      dollar3Error: a2.dollar3Error,
      reference: a2.sessionAfter && a2.sessionAfter.reference,
      token: a2.sessionAfter && a2.sessionAfter.token,
      cleaned: a2.sessionAfter && a2.sessionAfter.conversation_step === '',
    },
    noClaim: true,
    noPost: postflight.mockPosts === 1,
    cleanup,
    postflight,
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
