/**
 * MISSION 034 — W-031-01 TEST install (jsCode-only, 1 PUT, no activate).
 * Pattern: install-012 ; method: patch Gerer jsCode from AFTER.js only.
 * LIVE / retry PUT / chat / CLAIM / POST / Docker mutate : FORBIDDEN.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const outDir = __dirname;
const root = path.resolve(__dirname, '../../../../../');
const envPath = path.join(
  root,
  'n8n/proposed/2026-10-30-rec008-phase8e2b2-TEST-DEPLOY/.env.rec008-test.local'
);
const afterJsPath = path.join(
  root,
  'n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/runtime-013/diag-032/Gerer_collecte_progressive.AFTER.js'
);
const candidatePath = path.join(
  root,
  'n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/runtime-013/diag-032/after-OCD9It1uKFhOoWNF.W03101-candidate.json'
);

const envText = fs.readFileSync(envPath, 'utf8');
const v = (n) => {
  const m = envText.match(new RegExp('^' + n + '=(.*)$', 'm'));
  if (!m) throw new Error('missing env ' + n);
  return m[1];
};

const base = 'http://127.0.0.1:5682';
const workflowId = 'OCD9It1uKFhOoWNF';
const expectedVersionId = 'fd75ba32-f018-40e4-9f79-8f2a5400320b';
const expectedCounter = 10;
const expectedGererJsBefore =
  'f75d49849231f956bb9ae5383111ea84b362dc58de6711cc75d2e7e2a26917fe';
const expectedGererJsAfter =
  '44a7064d12755a84dd256acae90abbf67a778178f9947eec3a36dc0c9abcad3f';
const expectedCandidateFileSha =
  '57e08d2281247cf2030ae2734d6c096cdad9c049a53a120cce796fcb11c7d8af';
const expectedPgFingerprint = '1|14|4|0';
const expectedFinaliserSha =
  '3fc500bfed99c202156005d252a864cdc25514c93e7e47c842ae896381e8ee7a';
const TARGET = 'Gérer collecte progressive';
const GERER_ID = 'cc3403f1-6f07-4ab5-ab26-b0fee396a46d';

const settingsKeys = new Set([
  'saveExecutionProgress',
  'saveManualExecutions',
  'saveDataErrorExecution',
  'saveDataSuccessExecution',
  'executionTimeout',
  'errorWorkflow',
  'timezone',
  'executionOrder',
  'callerPolicy',
  'callerIds',
  'timeSavedPerExecution',
  'redactionPolicy',
  'availableInMCP',
  'customTelemetryTags',
]);

function sha(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}
function docker(args) {
  return execFileSync('docker', args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
}
function edgesOf(connections) {
  let edges = 0;
  for (const outputs of Object.values(connections || {})) {
    for (const groups of Object.values(outputs || {})) {
      for (const group of groups || []) {
        edges += Array.isArray(group) ? group.length : 0;
      }
    }
  }
  return edges;
}
function urlsOf(nodes) {
  const urls = [];
  const walk = (val) => {
    if (typeof val === 'string' && /^https?:\/\//.test(val)) urls.push(val);
    else if (Array.isArray(val)) val.forEach(walk);
    else if (val && typeof val === 'object') Object.values(val).forEach(walk);
  };
  for (const n of nodes || []) walk(n.parameters);
  return urls;
}
function finaliserCodeSha(parameters) {
  return sha(
    ((parameters && parameters.query) || '') +
      '\n' +
      ((parameters && parameters.options && parameters.options.queryReplacement) ||
        '')
  );
}
function jsSha(code) {
  return sha(Buffer.from(code || '', 'utf8'));
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
function mockMeta() {
  const probe =
    "const http=require('http');http.get('http://rec008-mock:8080/_meta/calls',res=>{let b='';res.on('data',c=>b+=c);res.on('end',()=>console.log(b));});";
  const tmp = path.join(outDir, '_mock-probe.js');
  fs.writeFileSync(tmp, probe);
  docker(['cp', tmp, 'govsuite-rec008-test-rec008-n8n-1:/tmp/_m034.js']);
  const t = docker([
    'exec',
    'govsuite-rec008-test-rec008-n8n-1',
    'node',
    '/tmp/_m034.js',
  ]).trim();
  docker([
    'exec',
    '-u',
    'root',
    'govsuite-rec008-test-rec008-n8n-1',
    'rm',
    '-f',
    '/tmp/_m034.js',
  ]);
  try {
    fs.unlinkSync(tmp);
  } catch (_) {}
  return JSON.parse(t);
}
function postCount(meta) {
  return Object.entries(meta.byPath || {})
    .filter(
      ([k]) => /^POST \/appointments /.test(k) && !/cancel|reschedule/i.test(k)
    )
    .reduce((n, [, v]) => n + Number(v || 0), 0);
}
function claimCount(meta) {
  return Object.entries(meta.byPath || {})
    .filter(([k]) => /claim/i.test(k))
    .reduce((n, [, v]) => n + Number(v || 0), 0);
}
function webhookCount() {
  // n8n stores webhooks in sqlite inside the n8n container (not Postgres métier)
  const whOut = docker([
    'exec',
    'govsuite-rec008-test-rec008-n8n-1',
    'node',
    '-e',
    "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('/home/node/.n8n/database.sqlite',{readOnly:true});const c=db.prepare('select count(*) as c from webhook_entity').get().c;console.log(String(c));",
  ]).trim();
  return Number(whOut);
}
function stop(reason, detail) {
  const payload = {
    ok: false,
    stopped: true,
    mission: 'W03101-TEST-INSTALL-034',
    phase: 'install',
    reason,
    detail,
    putAttempted: false,
    putCount: 0,
    liveTouched: false,
  };
  fs.writeFileSync(path.join(outDir, 'STOP.json'), JSON.stringify(payload, null, 2));
  fs.writeFileSync(path.join(outDir, 'RESULT.json'), JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
  process.exit(2);
}

(async () => {
  if (new URL(base).port !== '5682') stop('bad-port', {});

  // --- candidate AFTER.js + file integrity ---
  const afterJsBuf = fs.readFileSync(afterJsPath);
  const afterJsShaLocal = sha(afterJsBuf);
  if (afterJsShaLocal !== expectedGererJsAfter) {
    stop('after-js-sha-mismatch', { afterJsShaLocal });
  }
  const candidateBuf = fs.readFileSync(candidatePath);
  const candidateFileSha = sha(candidateBuf);
  if (candidateFileSha !== expectedCandidateFileSha) {
    stop('candidate-file-sha-mismatch', { candidateFileSha });
  }
  const candidate = JSON.parse(candidateBuf.toString('utf8'));
  if (candidate.active === true) stop('candidate-active', {});
  if ((candidate.nodes || []).length !== 134) {
    stop('candidate-node-count', { n: (candidate.nodes || []).length });
  }
  const candGerer = (candidate.nodes || []).find(
    (n) => n.id === GERER_ID || n.name === TARGET
  );
  if (!candGerer) stop('candidate-missing-gerer', {});
  if (jsSha(candGerer.parameters && candGerer.parameters.jsCode) !== expectedGererJsAfter) {
    stop('candidate-gerer-js-sha', {});
  }
  const afterJsText = afterJsBuf.toString('utf8');
  if (afterJsText !== candGerer.parameters.jsCode) {
    stop('after-js-ne-candidate-js', {});
  }

  // --- stack ---
  const ps = docker([
    'ps',
    '--filter',
    'name=govsuite-rec008-test',
    '--format',
    '{{.Names}}\t{{.Status}}',
  ]);
  const need = [
    'govsuite-rec008-test-rec008-postgres-1',
    'govsuite-rec008-test-rec008-mock-1',
    'govsuite-rec008-test-rec008-n8n-1',
    'govsuite-rec008-test-rec008-publish-1',
    'govsuite-rec008-test-rec008-ollama-1',
  ];
  for (const name of need) {
    if (!ps.includes(name) || !/Up/i.test(ps.split('\n').find((l) => l.includes(name)) || '')) {
      stop('container-not-up', { name, ps });
    }
  }

  const healthz = await fetch(base + '/healthz');
  if (!healthz.ok) stop('healthz', { status: healthz.status });

  const pgFp = pg(
    'SELECT (SELECT count(*) FROM rendez_vous),(SELECT count(*) FROM ai_conversation_state),(SELECT count(*) FROM ai_appointment_attempt),(SELECT count(*) FROM notifications);'
  );
  const open = pg(
    "SELECT count(*) FROM ai_appointment_attempt WHERE status IN ('AWAITING_CONFIRMATION','SUBMITTING','UNCERTAIN');"
  );
  const pgDriftDocumented =
    pgFp !== expectedPgFingerprint
      ? { expected: expectedPgFingerprint, actual: pgFp }
      : null;
  if (open !== '0') stop('open-attempts', { open });

  const mock0 = mockMeta();
  const mockPosts0 = postCount(mock0);
  const mockClaims0 = claimCount(mock0);

  // --- login ---
  const login = await fetch(base + '/rest/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      emailOrLdapLoginId: v('REC008_N8N_OWNER_EMAIL'),
      password: v('REC008_N8N_OWNER_PASSWORD'),
    }),
  });
  if (!login.ok) stop('login', { status: login.status });
  const cookie = (login.headers.getSetCookie
    ? login.headers.getSetCookie()
    : []
  )
    .map((i) => i.split(';')[0])
    .join('; ');
  const session = {
    cookie,
    accept: 'application/json',
    'content-type': 'application/json',
  };

  const remote = (
    await (
      await fetch(base + '/rest/workflows/' + workflowId, { headers: session })
    ).json()
  ).data;
  if (!remote || remote.id !== workflowId) stop('wrong-workflow', { id: remote && remote.id });
  if (remote.active === true || remote.activeVersionId) {
    stop('remote-active', {
      active: remote.active,
      activeVersionId: remote.activeVersionId,
    });
  }
  if (
    remote.versionId !== expectedVersionId ||
    Number(remote.versionCounter) !== expectedCounter
  ) {
    stop('remote-version-drift', {
      versionId: remote.versionId,
      versionCounter: remote.versionCounter,
    });
  }
  if ((remote.nodes || []).length !== 134 || edgesOf(remote.connections) !== 137) {
    stop('graph-drift', {
      nodes: (remote.nodes || []).length,
      edges: edgesOf(remote.connections),
    });
  }

  const remoteGerer = remote.nodes.find(
    (n) => n.id === GERER_ID || n.name === TARGET
  );
  if (!remoteGerer) stop('remote-missing-gerer', {});
  const remoteJsSha = jsSha(remoteGerer.parameters && remoteGerer.parameters.jsCode);
  if (remoteJsSha !== expectedGererJsBefore) {
    stop('remote-gerer-not-fix008', { remoteJsSha });
  }

  const urls = urlsOf(remote.nodes);
  if (
    urls.length === 0 ||
    !urls.every((u) => u.startsWith('http://rec008-mock:8080/'))
  ) {
    stop('urls-or-credentials', { urls });
  }
  const postgresIds = [
    ...new Set(
      remote.nodes
        .filter((n) => n.credentials && n.credentials.postgres)
        .map((n) => n.credentials.postgres.id)
    ),
  ];
  if (postgresIds.length !== 1 || postgresIds[0] !== 'Fs0l0058q5CEadRw') {
    stop('postgres-cred', { postgresIds });
  }

  const activeList = await (
    await fetch(base + '/rest/active-workflows', { headers: session })
  ).json();
  const activeIds = (activeList.data || activeList || [])
    .map((x) => x.id || x)
    .filter(Boolean);
  if (activeIds.length !== 0) stop('other-active', { activeIds });

  const webhookRows = webhookCount();
  if (webhookRows !== 0) stop('webhooks-present', { webhookRows });

  const runningRaw = await fetch(base + '/rest/executions?status=running&limit=5', {
    headers: session,
  });
  let runningCount = 0;
  if (runningRaw.ok) {
    const rj = await runningRaw.json();
    const data = rj.data || rj;
    runningCount = Array.isArray(data)
      ? data.length
      : Array.isArray(data.results)
        ? data.results.length
        : Number(data.count || 0);
  }
  if (runningCount !== 0) stop('running-executions', { runningCount });

  const finaliser = remote.nodes.find((n) => n.name === 'Finaliser état création');
  if (
    !finaliser ||
    finaliserCodeSha(finaliser.parameters) !== expectedFinaliserSha
  ) {
    stop('finaliser-sha', {});
  }

  // --- backup ---
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = 'backup-pre-w03101-' + ts + '.json';
  const backupPath = path.join(outDir, backupName);
  const backupText = JSON.stringify(remote, null, 2);
  fs.writeFileSync(backupPath, backupText);
  const backupSha = sha(fs.readFileSync(backupPath));
  const reread = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  if (
    reread.id !== workflowId ||
    reread.versionId !== expectedVersionId ||
    jsSha(
      (reread.nodes.find((n) => n.id === GERER_ID) || {}).parameters &&
        reread.nodes.find((n) => n.id === GERER_ID).parameters.jsCode
    ) !== expectedGererJsBefore
  ) {
    stop('backup-invalid', { backupSha });
  }
  const backupMeta = {
    mission: 'W03101-TEST-INSTALL-034',
    at: new Date().toISOString(),
    workflowId,
    versionId: remote.versionId,
    versionCounter: remote.versionCounter,
    active: remote.active,
    activeVersionId: remote.activeVersionId || null,
    nodes: remote.nodes.length,
    edges: edgesOf(remote.connections),
    backupFile: backupName,
    backupSha256: backupSha,
    gererJsSha: remoteJsSha,
    afterJsSha: expectedGererJsAfter,
    candidateFileSha,
    pgFingerprint: pgFp,
    pgDriftDocumented,
    openAttempts: open,
    mockPostCreate: mockPosts0,
    mockClaims: mockClaims0,
    webhooks: webhookRows,
    running: runningCount,
  };
  fs.writeFileSync(
    path.join(outDir, 'BACKUP.json'),
    JSON.stringify(backupMeta, null, 2)
  );
  fs.writeFileSync(
    path.join(outDir, 'PREFLIGHT.json'),
    JSON.stringify(
      {
        mission: 'W03101-TEST-INSTALL-034',
        preflightOk: true,
        gate: 'GO-INSTALL',
        at: backupMeta.at,
        base,
        workflowId,
        versionId: remote.versionId,
        versionCounter: remote.versionCounter,
        active: false,
        nodes: 134,
        edges: 137,
        gererJsBefore: remoteJsSha,
        gererJsAfterTarget: expectedGererJsAfter,
        candidateFileSha,
        pgFingerprint: pgFp,
        pgDriftDocumented,
        openAttempts: open,
        webhooks: webhookRows,
        running: runningCount,
        mock: {
          scenario: mock0.scenario,
          total: mock0.total,
          postCreate: mockPosts0,
          claims: mockClaims0,
        },
        containersUp: need,
        dockerMutate: false,
        liveTouched: false,
        method: 'jsCode-only',
      },
      null,
      2
    )
  );

  // --- fresh GET immediately before PUT ---
  const remote2 = (
    await (
      await fetch(base + '/rest/workflows/' + workflowId, { headers: session })
    ).json()
  ).data;
  if (
    remote2.versionId !== expectedVersionId ||
    Number(remote2.versionCounter) !== expectedCounter
  ) {
    stop('pre-put-version-drift', {
      versionId: remote2.versionId,
      versionCounter: remote2.versionCounter,
    });
  }
  const remote2Gerer = remote2.nodes.find(
    (n) => n.id === GERER_ID || n.name === TARGET
  );
  if (jsSha(remote2Gerer.parameters.jsCode) !== expectedGererJsBefore) {
    stop('pre-put-gerer-sha-drift', {
      sha: jsSha(remote2Gerer.parameters.jsCode),
    });
  }
  if (remote2.active === true || remote2.activeVersionId) {
    stop('pre-put-active', {});
  }

  // --- payload: jsCode ONLY ---
  const nodes = JSON.parse(JSON.stringify(remote2.nodes));
  const target = nodes.find((n) => n.id === GERER_ID || n.name === TARGET);
  if (!target) stop('payload-missing-gerer', {});
  const beforeParams = JSON.parse(JSON.stringify(target.parameters));
  target.parameters = { ...beforeParams, jsCode: afterJsText };

  if (
    JSON.stringify(target.credentials || null) !==
    JSON.stringify(remote2Gerer.credentials || null)
  ) {
    stop('credential-touch', {});
  }

  const changed = [];
  for (let i = 0; i < remote2.nodes.length; i++) {
    if (
      JSON.stringify(remote2.nodes[i].parameters) !==
      JSON.stringify(nodes[i].parameters)
    ) {
      changed.push(nodes[i].name);
    }
    if (
      JSON.stringify(remote2.nodes[i].credentials || null) !==
      JSON.stringify(nodes[i].credentials || null)
    ) {
      stop('credential-touch', { name: nodes[i].name });
    }
  }
  if (changed.length !== 1 || changed[0] !== TARGET) {
    stop('payload-diff', { changed });
  }
  const patchedGerer = nodes.find((n) => n.id === GERER_ID);
  if (jsSha(patchedGerer.parameters.jsCode) !== expectedGererJsAfter) {
    stop('payload-gerer-js', { sha: jsSha(patchedGerer.parameters.jsCode) });
  }
  // ensure only jsCode key differs inside parameters
  const paramKeysBefore = Object.keys(beforeParams).sort();
  const paramKeysAfter = Object.keys(patchedGerer.parameters).sort();
  if (JSON.stringify(paramKeysBefore) !== JSON.stringify(paramKeysAfter)) {
    stop('parameters-keys-changed', { paramKeysBefore, paramKeysAfter });
  }
  for (const k of paramKeysBefore) {
    if (k === 'jsCode') continue;
    if (
      JSON.stringify(beforeParams[k]) !==
      JSON.stringify(patchedGerer.parameters[k])
    ) {
      stop('non-jscode-param-changed', { key: k });
    }
  }

  const settings = {};
  for (const [key, setting] of Object.entries(remote2.settings || {})) {
    if (!settingsKeys.has(key)) stop('settings-key', { key });
    settings[key] = setting;
  }

  const payload = {
    name: remote2.name,
    nodes,
    connections: remote2.connections,
    settings,
    staticData: remote2.staticData === undefined ? null : remote2.staticData,
    pinData: remote2.pinData === undefined ? {} : remote2.pinData,
  };
  if (payload.active) stop('payload-active', {});
  const payloadText = JSON.stringify(payload);
  const payloadSha = sha(payloadText);
  fs.writeFileSync(path.join(outDir, 'update-body.json'), payloadText);
  fs.writeFileSync(
    path.join(outDir, 'PAYLOAD-META.json'),
    JSON.stringify(
      {
        payloadSha256: payloadSha,
        changedNodes: changed,
        method: 'jsCode-only',
        gererJsAfter: expectedGererJsAfter,
        omitActive: true,
        fullCandidateImport: false,
      },
      null,
      2
    )
  );

  // --- API key once ---
  const keyResponse = await fetch(base + '/rest/api-keys', {
    method: 'POST',
    headers: session,
    body: JSON.stringify({
      label: 'rec008-w03101-install-034',
      scopes: ['workflow:read', 'workflow:update'],
      expiresAt: Date.now() + 2 * 60 * 60 * 1000,
    }),
  });
  const keyJson = await keyResponse.json();
  const apiKey =
    keyJson.rawApiKey ||
    keyJson.apiKey ||
    (keyJson.data && (keyJson.data.rawApiKey || keyJson.data.apiKey));
  if (!apiKey) stop('api-key', { status: keyResponse.status });

  // Exactly one PUT — no retry
  let put;
  let putText;
  let putJson = {};
  let putAmbiguous = false;
  try {
    put = await fetch(base + '/api/v1/workflows/' + workflowId, {
      method: 'PUT',
      headers: {
        'X-N8N-API-KEY': apiKey,
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: payloadText,
    });
    putText = await put.text();
    try {
      putJson = JSON.parse(putText);
    } catch {
      putJson = { message: putText.slice(0, 400) };
      putAmbiguous = true;
    }
  } catch (e) {
    fs.writeFileSync(
      path.join(outDir, 'put-response.json'),
      JSON.stringify(
        {
          status: null,
          uncertain: true,
          error: String(e && e.message ? e.message : e),
        },
        null,
        2
      )
    );
    const payloadU = {
      ok: false,
      stopped: true,
      mission: 'W03101-TEST-INSTALL-034',
      verdict: 'UNCERTAIN',
      reason: 'timeout-or-transport',
      putAttempted: true,
      putCount: 1,
      liveTouched: false,
      detail: { error: String(e && e.message ? e.message : e) },
    };
    fs.writeFileSync(path.join(outDir, 'RESULT.json'), JSON.stringify(payloadU, null, 2));
    console.log(JSON.stringify(payloadU, null, 2));
    process.exit(3);
  }

  // redact any accidental secrets in saved put response
  const putSave = { status: put.status, body: putJson };
  fs.writeFileSync(path.join(outDir, 'put-response.json'), JSON.stringify(putSave, null, 2));

  // --- postflight GET ---
  const after = (
    await (
      await fetch(base + '/rest/workflows/' + workflowId, { headers: session })
    ).json()
  ).data;
  const afterText = JSON.stringify(after, null, 2);
  fs.writeFileSync(path.join(outDir, 'after-OCD9It1uKFhOoWNF.json'), afterText);
  const afterFileSha = sha(Buffer.from(afterText, 'utf8'));

  const afterActiveList = await (
    await fetch(base + '/rest/active-workflows', { headers: session })
  ).json();
  const afterActiveIds = (afterActiveList.data || afterActiveList || [])
    .map((x) => x.id || x)
    .filter(Boolean);

  if (putAmbiguous || put.status !== 200) {
    const payloadFail = {
      ok: false,
      mission: 'W03101-TEST-INSTALL-034',
      verdict: putAmbiguous ? 'UNCERTAIN' : 'FAIL',
      reason: putAmbiguous ? 'ambiguous-put-body' : 'put-failed',
      putStatus: put.status,
      putCount: 1,
      afterVersionId: after && after.versionId,
      afterCounter: after && after.versionCounter,
      afterActive: after && after.active,
      liveTouched: false,
      rollbackExecuted: false,
    };
    fs.writeFileSync(path.join(outDir, 'RESULT.json'), JSON.stringify(payloadFail, null, 2));
    console.log(JSON.stringify(payloadFail, null, 2));
    process.exit(putAmbiguous ? 3 : 2);
  }

  if (after.active === true || after.activeVersionId) {
    try {
      await fetch(base + '/rest/workflows/' + workflowId + '/deactivate', {
        method: 'POST',
        headers: session,
      });
    } catch (_) {}
    const payloadAct = {
      ok: false,
      mission: 'W03101-TEST-INSTALL-034',
      verdict: 'FAIL',
      reason: 'activated-unexpected',
      putCount: 1,
      afterActive: after.active,
      afterActiveVersionId: after.activeVersionId,
      liveTouched: false,
    };
    fs.writeFileSync(path.join(outDir, 'RESULT.json'), JSON.stringify(payloadAct, null, 2));
    console.log(JSON.stringify(payloadAct, null, 2));
    process.exit(2);
  }

  const afterGerer = after.nodes.find((n) => n.id === GERER_ID);
  const afterJsSha = jsSha(afterGerer && afterGerer.parameters && afterGerer.parameters.jsCode);
  const changedAfter = [];
  for (let i = 0; i < remote2.nodes.length; i++) {
    const rn = remote2.nodes[i];
    const an = after.nodes.find((n) => n.id === rn.id);
    if (!an) {
      changedAfter.push({ id: rn.id, kind: 'missing' });
      continue;
    }
    if (JSON.stringify(rn.parameters) !== JSON.stringify(an.parameters)) {
      changedAfter.push({ id: rn.id, name: an.name });
    }
  }

  const pg1 = pg(
    'SELECT (SELECT count(*) FROM rendez_vous),(SELECT count(*) FROM ai_conversation_state),(SELECT count(*) FROM ai_appointment_attempt),(SELECT count(*) FROM notifications);'
  );
  const open1 = pg(
    "SELECT count(*) FROM ai_appointment_attempt WHERE status IN ('AWAITING_CONFIRMATION','SUBMITTING','UNCERTAIN');"
  );
  const webhookRows1 = webhookCount();
  const mock1 = mockMeta();
  const mockPosts1 = postCount(mock1);
  const mockClaims1 = claimCount(mock1);
  const afterUrls = urlsOf(after.nodes);
  const afterPgIds = [
    ...new Set(
      after.nodes
        .filter((n) => n.credentials && n.credentials.postgres)
        .map((n) => n.credentials.postgres.id)
    ),
  ];
  const afterFinaliser = after.nodes.find((n) => n.name === 'Finaliser état création');

  const checks = {
    putStatus200: put.status === 200,
    sameId: after.id === workflowId,
    nodes134: after.nodes.length === 134,
    edges137: edgesOf(after.connections) === 137,
    onlyGererChanged:
      changedAfter.length === 1 && changedAfter[0].name === TARGET,
    gererJsSha: afterJsSha === expectedGererJsAfter,
    connectionsUnchanged:
      JSON.stringify(remote2.connections) === JSON.stringify(after.connections),
    settingsUnchanged:
      JSON.stringify(remote2.settings || {}) === JSON.stringify(after.settings || {}),
    inactive: after.active === false && !after.activeVersionId,
    noActiveWorkflows: afterActiveIds.length === 0,
    webhooksZero: webhookRows1 === 0,
    urlsMock: afterUrls.every((u) => u.startsWith('http://rec008-mock:8080/')),
    pgCred: afterPgIds.length === 1 && afterPgIds[0] === 'Fs0l0058q5CEadRw',
    finaliserUnchanged:
      finaliserCodeSha(afterFinaliser && afterFinaliser.parameters) ===
      expectedFinaliserSha,
    pgStable: pg1 === pgFp,
    openZero: open1 === '0',
    mockPostDelta0: mockPosts1 === mockPosts0,
    mockClaimDelta0: mockClaims1 === mockClaims0,
    versionBumped:
      after.versionId !== expectedVersionId ||
      Number(after.versionCounter) !== expectedCounter,
    versionCounter11Preferred: Number(after.versionCounter) === 11,
  };

  const hardChecks = { ...checks };
  delete hardChecks.versionCounter11Preferred;
  const hardOk = Object.values(hardChecks).every(Boolean);

  const result = {
    ok: hardOk,
    mission: 'W03101-TEST-INSTALL-034',
    verdict: hardOk ? 'PASS' : 'FAIL',
    fixInstalled: afterJsSha === expectedGererJsAfter ? 'YES' : 'NO',
    putStatus: put.status,
    putCount: 1,
    putAttempted: true,
    method: 'jsCode-only',
    fullCandidateImport: false,
    candidateFileSha,
    backupSha,
    backupFile: backupName,
    payloadSha,
    afterFileSha,
    before: {
      versionId: remote2.versionId,
      versionCounter: remote2.versionCounter,
      gererJsSha: expectedGererJsBefore,
    },
    after: {
      versionId: after.versionId,
      versionCounter: after.versionCounter,
      gererJsSha: afterJsSha,
      active: after.active,
      activeVersionId: after.activeVersionId || null,
    },
    changedAfter,
    checks,
    pg: {
      before: pgFp,
      after: pg1,
      openBefore: open,
      openAfter: open1,
      driftDocumented: pgDriftDocumented,
    },
    mock: {
      beforeTotal: mock0.total,
      afterTotal: mock1.total,
      postCreateBefore: mockPosts0,
      postCreateAfter: mockPosts1,
      claimsBefore: mockClaims0,
      claimsAfter: mockClaims1,
      mockPostsDelta: mockPosts1 - mockPosts0,
      mockClaimsDelta: mockClaims1 - mockClaims0,
    },
    webhooks: { before: webhookRows, after: webhookRows1 },
    dockerMutate: false,
    activation: false,
    chat: false,
    liveTouched: false,
    rollbackExecuted: false,
    r04Runtime: 'NO-GO',
    r05r07: 'NO-GO',
    live: 'NO-GO',
  };
  fs.writeFileSync(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2));
  fs.writeFileSync(
    path.join(outDir, 'POSTFLIGHT.json'),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        checks,
        afterVersionId: after.versionId,
        afterVersionCounter: after.versionCounter,
        afterGererSha: afterJsSha,
        active: after.active,
        activeIds: afterActiveIds,
        webhooks: webhookRows1,
        liveTouched: false,
        mockPostsDelta: result.mock.mockPostsDelta,
        mockClaimsDelta: result.mock.mockClaimsDelta,
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(outDir, 'SHA256.json'),
    JSON.stringify(
      {
        mission: 'W03101-TEST-INSTALL-034',
        gererJsBefore: expectedGererJsBefore,
        gererJsAfter: afterJsSha,
        expectedGererJsAfter,
        candidateFileSha,
        backupSha256: backupSha,
        payloadSha256: payloadSha,
        afterExportSha256: afterFileSha,
        putCount: 1,
        installed: afterJsSha === expectedGererJsAfter,
      },
      null,
      2
    )
  );

  console.log(
    JSON.stringify(
      {
        verdict: result.verdict,
        fixInstalled: result.fixInstalled,
        putStatus: put.status,
        putCount: 1,
        versionId: after.versionId,
        versionCounter: after.versionCounter,
        gererJsSha: afterJsSha,
        liveTouched: false,
        checks,
      },
      null,
      2
    )
  );
  process.exit(hardOk ? 0 : 2);
})().catch((e) => {
  const payload = {
    ok: false,
    mission: 'W03101-TEST-INSTALL-034',
    verdict: 'UNCERTAIN',
    reason: 'uncaught',
    error: String(e && e.stack ? e.stack : e).slice(0, 800),
    putAttempted: false,
    liveTouched: false,
  };
  fs.writeFileSync(path.join(outDir, 'RESULT.json'), JSON.stringify(payload, null, 2));
  console.error(JSON.stringify(payload, null, 2));
  process.exit(3);
});
