const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const outDir =
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-31-rec008-phase8f2b24-FINALIZATION-RUNTIME';
fs.mkdirSync(outDir, { recursive: true });

const envText = fs.readFileSync(
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-30-rec008-phase8e2b2-TEST-DEPLOY/.env.rec008-test.local',
  'utf8'
);
const value = (n) => envText.match(new RegExp('^' + n + '=(.*)$', 'm'))[1];
const base = 'http://127.0.0.1:5682';

function sha(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
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

  // Load installed Finaliser from main workflow (read-only)
  const main = (await (await fetch(base + '/rest/workflows/OCD9It1uKFhOoWNF', { headers: session })).json()).data;
  const finaliser = main.nodes.find((n) => n.name === 'Finaliser état création');
  const fSha = sha(
    (finaliser.parameters.query || '') +
      '\n' +
      ((finaliser.parameters.options && finaliser.parameters.options.queryReplacement) || '')
  );

  // Probe endpoints without creating anything durable yet
  const probes = {};
  for (const [label, req] of [
    [
      'rest_run_options',
      () => fetch(base + '/rest/workflows/run', { method: 'OPTIONS', headers: session }),
    ],
    [
      'api_execute',
      () =>
        fetch(base + '/api/v1/workflows/OCD9It1uKFhOoWNF/execute', {
          method: 'POST',
          headers: { ...session, 'X-N8N-API-KEY': 'probe' },
          body: '{}',
        }),
    ],
  ]) {
    try {
      const r = await req();
      probes[label] = { status: r.status, allow: r.headers.get('allow') };
    } catch (e) {
      probes[label] = { error: String(e.message || e) };
    }
  }

  // Create ephemeral API key with create/update/delete/read for disposable workflow only
  let apiKey = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const keyResponse = await fetch(base + '/rest/api-keys', {
      method: 'POST',
      headers: session,
      body: JSON.stringify({
        label: 'rec008-8f2b24-runtime-' + attempt,
        scopes: [
          'workflow:read',
          'workflow:list',
          'workflow:create',
          'workflow:update',
          'workflow:delete',
        ],
        expiresAt: Date.now() + 2 * 60 * 60 * 1000,
      }),
    });
    const keyJson = await keyResponse.json();
    apiKey =
      keyJson.rawApiKey ||
      keyJson.apiKey ||
      (keyJson.data && (keyJson.data.rawApiKey || keyJson.data.apiKey));
    if (apiKey) break;
  }

  const result = {
    mainInactive: main.active === false,
    mainVersionId: main.versionId,
    mainCounter: main.versionCounter,
    finaliserSha: fSha,
    expectedSha: 'dfeaf3a439ea362bdf40453d27e25631274bc20ae9eb8d8aecb823a8118a741d',
    finaliserShaOk: fSha === 'dfeaf3a439ea362bdf40453d27e25631274bc20ae9eb8d8aecb823a8118a741d',
    queryReplacement: finaliser.parameters.options.queryReplacement,
    credentialId: finaliser.credentials.postgres.id,
    probes,
    apiKeyCreated: !!apiKey,
    mechanismPlan: {
      type: 'ephemeral-manual-workflow',
      description:
        'Create disposable inactive workflow with Manual Trigger + Code nodes named exactly like Finaliser queryReplacement dependencies + Postgres node copying installed Finaliser query/queryReplacement/credential. Execute via POST /rest/workflows/run (editor session). Delete ephemeral workflow after. Never PUT main OCD9It1uKFhOoWNF.',
      evaluatesRealExpressions: true,
      usesInstalledSql: true,
      usesTestCredential: true,
      traversesClaimOrCreate: false,
      activatesMain: false,
    },
  };

  fs.writeFileSync(path.join(outDir, 'MECHANISM_PROBE.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.finaliserShaOk && result.apiKeyCreated ? 0 : 2);
})().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
