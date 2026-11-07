'use strict';
const fs = require('fs');
const path = require('path');
const env = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../2026-10-30-rec008-phase8e2b2-TEST-DEPLOY/.env.rec008-test.local'
  ),
  'utf8'
);
const v = (n) => env.match(new RegExp('^' + n + '=(.*)$', 'm'))[1];
const base = 'http://127.0.0.1:5682';
const wid = 'OCD9It1uKFhOoWNF';

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

(async () => {
  const login = await fetch(base + '/rest/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      emailOrLdapLoginId: v('REC008_N8N_OWNER_EMAIL'),
      password: v('REC008_N8N_OWNER_PASSWORD'),
    }),
  });
  if (!login.ok) {
    console.log(JSON.stringify({ ok: false, login: login.status }));
    process.exit(2);
  }
  const cookie = (login.headers.getSetCookie
    ? login.headers.getSetCookie()
    : []
  )
    .map((i) => i.split(';')[0])
    .join('; ');
  const h = { cookie, accept: 'application/json' };
  const wf = (
    await (await fetch(base + '/rest/workflows/' + wid, { headers: h })).json()
  ).data;
  const active = await (
    await fetch(base + '/rest/active-workflows', { headers: h })
  ).json();
  const activeIds = (active.data || active || [])
    .map((x) => x.id || x)
    .filter(Boolean);
  const urls = urlsOf(wf.nodes);
  const pgIds = [
    ...new Set(
      (wf.nodes || [])
        .filter((n) => n.credentials && n.credentials.postgres)
        .map((n) => n.credentials.postgres.id)
    ),
  ];
  const edges = edgesOf(wf.connections);
  const out = {
    mission: 'TEST-STACK-RECOVERY-011',
    at: new Date().toISOString(),
    ok: true,
    id: wf.id,
    name: wf.name,
    active: wf.active,
    activeVersionId: wf.activeVersionId || null,
    versionId: wf.versionId,
    versionCounter: wf.versionCounter,
    nodes: (wf.nodes || []).length,
    edges,
    activeIds,
    pgCredentialIds: pgIds,
    urlCount: urls.length,
    urlsAllMock: urls.every((u) =>
      u.startsWith('http://rec008-mock:8080/')
    ),
    expected: {
      versionId: 'e7867799-2a18-4aec-9ee5-3ba9cbc40766',
      versionCounter: 9,
      nodes: 134,
      edges: 137,
      active: false,
    },
  };
  out.checks = {
    idOk: wf.id === wid,
    inactive: wf.active === false && !wf.activeVersionId,
    versionIdOk: wf.versionId === out.expected.versionId,
    counterOk: Number(wf.versionCounter) === 9,
    graphOk: out.nodes === 134 && edges === 137,
    noActive: activeIds.length === 0,
    pgTestOnly:
      pgIds.length === 1 && pgIds[0] === 'Fs0l0058q5CEadRw',
    urlsMock: out.urlsAllMock,
  };
  out.allPass = Object.values(out.checks).every(Boolean);
  fs.writeFileSync(
    path.join(__dirname, 'N8N-CHECK.json'),
    JSON.stringify(out, null, 2)
  );
  console.log(
    JSON.stringify(
      {
        allPass: out.allPass,
        checks: out.checks,
        versionId: out.versionId,
        versionCounter: out.versionCounter,
        nodes: out.nodes,
        edges: out.edges,
        active: out.active,
        activeIds,
      },
      null,
      2
    )
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
