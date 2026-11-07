/**
 * TEST-INSTALL-RETRY-012 — 1 PUT FIX-008 (inactive). No activation / chat / métier.
 * DO NOT reuse P4F/install.js.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const outDir = __dirname;
const root = path.resolve(__dirname, '../../../..');
const envPath = path.join(
  root,
  'n8n/proposed/2026-10-30-rec008-phase8e2b2-TEST-DEPLOY/.env.rec008-test.local'
);
const candidatePath = path.join(
  root,
  'n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/after-OCD9It1uKFhOoWNF.json'
);

const envText = fs.readFileSync(envPath, 'utf8');
const v = (n) => {
  const m = envText.match(new RegExp('^' + n + '=(.*)$', 'm'));
  if (!m) throw new Error('missing env ' + n);
  return m[1];
};

const base = 'http://127.0.0.1:5682';
const workflowId = 'OCD9It1uKFhOoWNF';
const expectedVersionId = 'e7867799-2a18-4aec-9ee5-3ba9cbc40766';
const expectedCounter = 9;
const expectedCandidateSha =
  '849201ddd7cb17c158de292ed5479bfd024d83ac89b9a1f135b9422ae973618c';
const expectedGererJsAfter =
  'f75d49849231f956bb9ae5383111ea84b362dc58de6711cc75d2e7e2a26917fe';
const expectedGererJsBefore =
  '16c3d063dee7f32df970e1d7c0d8ad81eee56f6dd603a6949c1a89622b36c961';
const expectedPgFingerprint = '1|11|4|0';
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
  docker(['cp', tmp, 'govsuite-rec008-test-rec008-n8n-1:/tmp/_m012.js']);
  const t = docker([
    'exec',
    'govsuite-rec008-test-rec008-n8n-1',
    'node',
    '/tmp/_m012.js',
  ]).trim();
  docker([
    'exec',
    '-u',
    'root',
    'govsuite-rec008-test-rec008-n8n-1',
    'rm',
    '-f',
    '/tmp/_m012.js',
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
function stop(reason, detail) {
  const payload = {
    ok: false,
    stopped: true,
    mission: 'TEST-INSTALL-RETRY-012',
    phase: 'install',
    reason,
    detail,
    putAttempted: false,
  };
  fs.writeFileSync(path.join(outDir, 'STOP.json'), JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
  process.exit(2);
}

(async () => {
  if (new URL(base).port !== '5682') stop('bad-port', {});

  // --- candidate SHA before any transform ---
  const candidateBuf = fs.readFileSync(candidatePath);
  const candidateSha = sha(candidateBuf);
  if (candidateSha !== expectedCandidateSha) {
    stop('candidate-sha-mismatch', { candidateSha });
  }
  const candidate = JSON.parse(candidateBuf.toString('utf8'));
  if (candidate.active === true) stop('candidate-active', {});
  const candGerer = (candidate.nodes || []).find(
    (n) => n.id === GERER_ID || n.name === TARGET
  );
  if (!candGerer) stop('candidate-missing-gerer', {});
  const candJsSha = jsSha(candGerer.parameters && candGerer.parameters.jsCode);
  if (candJsSha !== expectedGererJsAfter) {
    stop('candidate-gerer-js-sha', { candJsSha });
  }

  // --- stack containers ---
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
  if (pgFp !== expectedPgFingerprint) stop('pg-fingerprint-drift', { pgFp });
  if (open !== '0') stop('open-attempts', { open });

  const mock0 = mockMeta();
  if (postCount(mock0) !== 0) stop('mock-post-drift', { mock0 });

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
    stop('remote-gerer-not-vc9', { remoteJsSha });
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

  const finaliser = remote.nodes.find((n) => n.name === 'Finaliser état création');
  if (
    !finaliser ||
    finaliserCodeSha(finaliser.parameters) !== expectedFinaliserSha
  ) {
    stop('finaliser-sha', {});
  }

  // --- backup ---
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = 'backup-pre-fix008-' + ts + '.json';
  const backupPath = path.join(outDir, backupName);
  const backupText = JSON.stringify(remote, null, 2);
  fs.writeFileSync(backupPath, backupText);
  const backupSha = sha(fs.readFileSync(backupPath));
  const reread = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  if (reread.id !== workflowId || reread.versionId !== expectedVersionId) {
    stop('backup-invalid', { backupSha });
  }
  const backupMeta = {
    mission: 'TEST-INSTALL-RETRY-012',
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
    candidateSha,
    candidatePath:
      'n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/after-OCD9It1uKFhOoWNF.json',
    pgFingerprint: pgFp,
    openAttempts: open,
    mockPostCreate: postCount(mock0),
  };
  fs.writeFileSync(
    path.join(outDir, 'BACKUP.json'),
    JSON.stringify(backupMeta, null, 2)
  );
  fs.writeFileSync(
    path.join(outDir, 'PREFLIGHT.json'),
    JSON.stringify(
      {
        mission: 'TEST-INSTALL-RETRY-012',
        preflightOk: true,
        at: backupMeta.at,
        base,
        workflowId,
        versionId: remote.versionId,
        versionCounter: remote.versionCounter,
        active: false,
        nodes: 134,
        edges: 137,
        candidateSha,
        gererJsBefore: remoteJsSha,
        pgFingerprint: pgFp,
        openAttempts: open,
        mock: { scenario: mock0.scenario, total: mock0.total, postCreate: 0 },
        containersUp: need,
        dockerMutate: false,
      },
      null,
      2
    )
  );

  // --- payload: patch only Gérer parameters from candidate ---
  const nodes = JSON.parse(JSON.stringify(remote.nodes));
  const target = nodes.find((n) => n.id === GERER_ID || n.name === TARGET);
  if (!target) stop('payload-missing-gerer', {});
  const beforeParams = JSON.stringify(target.parameters);
  target.parameters = JSON.parse(JSON.stringify(candGerer.parameters));
  if (JSON.stringify(target.credentials || null) !== JSON.stringify(remoteGerer.credentials || null)) {
    stop('credential-touch', {});
  }

  const changed = [];
  for (let i = 0; i < remote.nodes.length; i++) {
    if (
      JSON.stringify(remote.nodes[i].parameters) !==
      JSON.stringify(nodes[i].parameters)
    ) {
      changed.push(nodes[i].name);
    }
    if (
      JSON.stringify(remote.nodes[i].credentials || null) !==
      JSON.stringify(nodes[i].credentials || null)
    ) {
      stop('credential-touch', { name: nodes[i].name });
    }
  }
  if (changed.length !== 1 || changed[0] !== TARGET) {
    stop('payload-diff', { changed, beforeParamsLen: beforeParams.length });
  }
  const patchedGerer = nodes.find((n) => n.id === GERER_ID);
  if (jsSha(patchedGerer.parameters.jsCode) !== expectedGererJsAfter) {
    stop('payload-gerer-js', {});
  }
  if (!String(patchedGerer.parameters.jsCode).includes('EXPLICIT-RESUME-FIX-008')) {
    stop('payload-missing-marker', {});
  }

  const settings = {};
  for (const [key, setting] of Object.entries(remote.settings || {})) {
    if (!settingsKeys.has(key)) stop('settings-key', { key });
    settings[key] = setting;
  }

  const payload = {
    name: remote.name,
    nodes,
    connections: remote.connections,
    settings,
    staticData: remote.staticData === undefined ? null : remote.staticData,
    pinData: remote.pinData === undefined ? {} : remote.pinData,
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
        gererJsAfter: expectedGererJsAfter,
        omitActive: true,
      },
      null,
      2
    )
  );

  // --- API key once (no PUT retry; key create is not PUT) ---
  const keyResponse = await fetch(base + '/rest/api-keys', {
    method: 'POST',
    headers: session,
    body: JSON.stringify({
      label: 'rec008-fix008-install-012',
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
      mission: 'TEST-INSTALL-RETRY-012',
      verdict: 'UNCERTAIN',
      reason: 'timeout-or-transport',
      putAttempted: true,
      putCount: 1,
      detail: { error: String(e && e.message ? e.message : e) },
    };
    fs.writeFileSync(path.join(outDir, 'RESULT.json'), JSON.stringify(payloadU, null, 2));
    console.log(JSON.stringify(payloadU, null, 2));
    process.exit(3);
  }

  fs.writeFileSync(
    path.join(outDir, 'put-response.json'),
    JSON.stringify({ status: put.status, body: putJson }, null, 2)
  );

  // --- postflight GET (read-only) ---
  const after = (
    await (
      await fetch(base + '/rest/workflows/' + workflowId, { headers: session })
    ).json()
  ).data;
  const afterText = JSON.stringify(after, null, 2);
  fs.writeFileSync(path.join(outDir, 'after-OCD9It1uKFhOoWNF.json'), afterText);

  const afterActiveList = await (
    await fetch(base + '/rest/active-workflows', { headers: session })
  ).json();
  const afterActiveIds = (afterActiveList.data || afterActiveList || [])
    .map((x) => x.id || x)
    .filter(Boolean);

  if (putAmbiguous || put.status !== 200) {
    const payloadFail = {
      ok: false,
      mission: 'TEST-INSTALL-RETRY-012',
      verdict: putAmbiguous ? 'UNCERTAIN' : 'FAIL',
      reason: putAmbiguous ? 'ambiguous-put-body' : 'put-failed',
      putStatus: put.status,
      putCount: 1,
      afterVersionId: after && after.versionId,
      afterCounter: after && after.versionCounter,
      afterActive: after && after.active,
    };
    fs.writeFileSync(path.join(outDir, 'RESULT.json'), JSON.stringify(payloadFail, null, 2));
    console.log(JSON.stringify(payloadFail, null, 2));
    process.exit(putAmbiguous ? 3 : 2);
  }

  // unexpected activation → deactivate once
  if (after.active === true || after.activeVersionId) {
    try {
      await fetch(base + '/rest/workflows/' + workflowId + '/deactivate', {
        method: 'POST',
        headers: session,
      });
    } catch (_) {}
    stop('activated-unexpected', {
      active: after.active,
      activeVersionId: after.activeVersionId,
    });
  }

  const afterGerer = after.nodes.find((n) => n.id === GERER_ID);
  const afterJsSha = jsSha(afterGerer && afterGerer.parameters && afterGerer.parameters.jsCode);
  const changedAfter = [];
  for (let i = 0; i < remote.nodes.length; i++) {
    const rn = remote.nodes[i];
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
  const mock1 = mockMeta();
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
    marker: String(afterGerer.parameters.jsCode).includes('EXPLICIT-RESUME-FIX-008'),
    connectionsUnchanged:
      JSON.stringify(remote.connections) === JSON.stringify(after.connections),
    settingsUnchanged:
      JSON.stringify(remote.settings || {}) === JSON.stringify(after.settings || {}),
    inactive: after.active === false && !after.activeVersionId,
    noActiveWorkflows: afterActiveIds.length === 0,
    urlsMock: afterUrls.every((u) => u.startsWith('http://rec008-mock:8080/')),
    pgCred: afterPgIds.length === 1 && afterPgIds[0] === 'Fs0l0058q5CEadRw',
    finaliserUnchanged:
      finaliserCodeSha(afterFinaliser && afterFinaliser.parameters) ===
      expectedFinaliserSha,
    pgUnchanged: pg1 === expectedPgFingerprint,
    openZero: open1 === '0',
    mockPostUnchanged: postCount(mock1) === 0,
    versionBumped:
      after.versionId !== expectedVersionId ||
      Number(after.versionCounter) !== expectedCounter,
  };

  const result = {
    ok: Object.values(checks).every(Boolean),
    mission: 'TEST-INSTALL-RETRY-012',
    verdict: null,
    putStatus: put.status,
    putCount: 1,
    putAttempted: true,
    candidateSha,
    backupSha,
    backupFile: backupName,
    payloadSha,
    before: {
      versionId: remote.versionId,
      versionCounter: remote.versionCounter,
      gererJsSha: remoteJsSha,
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
    pg: { before: pgFp, after: pg1, openBefore: open, openAfter: open1 },
    mock: {
      beforeTotal: mock0.total,
      afterTotal: mock1.total,
      postCreateBefore: postCount(mock0),
      postCreateAfter: postCount(mock1),
    },
    dockerMutate: false,
    activation: false,
    chat: false,
    liveTouch: false,
  };
  result.verdict = result.ok ? 'PASS' : 'FAIL';
  fs.writeFileSync(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2));
  fs.writeFileSync(
    path.join(outDir, 'POSTFLIGHT.json'),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        checks,
        afterVersionId: after.versionId,
        afterVersionCounter: after.versionCounter,
        activeIds: afterActiveIds,
      },
      null,
      2
    )
  );
  console.log(
    JSON.stringify(
      {
        verdict: result.verdict,
        putStatus: put.status,
        versionId: after.versionId,
        versionCounter: after.versionCounter,
        gererJsSha: afterJsSha,
        checks,
      },
      null,
      2
    )
  );
  process.exit(result.ok ? 0 : 2);
})().catch((e) => {
  const payload = {
    ok: false,
    mission: 'TEST-INSTALL-RETRY-012',
    verdict: 'UNCERTAIN',
    reason: 'uncaught',
    error: String(e && e.stack ? e.stack : e),
  };
  fs.writeFileSync(path.join(outDir, 'RESULT.json'), JSON.stringify(payload, null, 2));
  console.error(JSON.stringify(payload, null, 2));
  process.exit(3);
});
