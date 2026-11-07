/**
 * Lecture seule : compare SHA des nœuds critiques live vs export 8F-2B26.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const envText = fs.readFileSync(
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-30-rec008-phase8e2b2-TEST-DEPLOY/.env.rec008-test.local',
  'utf8'
);
const v = (n) => envText.match(new RegExp('^' + n + '=(.*)$', 'm'))[1];
const base = 'http://127.0.0.1:5682';
const workflowId = 'OCD9It1uKFhOoWNF';
const exportPath =
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-31-rec008-phase8f2b26-FINALIZATION-FIX-INSTALL/after-OCD9It1uKFhOoWNF.json';
const outDir = __dirname;

function sha(s) {
  return crypto.createHash('sha256').update(s || '').digest('hex');
}
function nodeCode(n) {
  if (!n) return '';
  if (n.parameters && n.parameters.jsCode) return n.parameters.jsCode;
  if (n.parameters && n.parameters.query) {
    return (
      (n.parameters.query || '') +
      '\n' +
      ((n.parameters.options && n.parameters.options.queryReplacement) || '')
    );
  }
  return JSON.stringify(n.parameters || {});
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
  const cookie = (login.headers.getSetCookie ? login.headers.getSetCookie() : [])
    .map((i) => i.split(';')[0])
    .join('; ');
  const wfBody = await (await fetch(base + '/rest/workflows/' + workflowId, { headers: { cookie } })).json();
  const live = wfBody.data || wfBody;
  const exported = JSON.parse(fs.readFileSync(exportPath, 'utf8'));

  const names = [
    'Parser intention',
    'Fusionner état conversation',
    'Gérer collecte progressive',
    'Sauvegarder état conversation',
    'Joindre tentative de session',
    'Router intention',
    'Comprendre la demande',
    'Finaliser état création',
  ];

  const rows = names.map((name) => {
    const liveNode = (live.nodes || []).find((n) => n.name === name);
    const expNode = (exported.nodes || []).find((n) => n.name === name);
    const liveSha = sha(nodeCode(liveNode));
    const expSha = sha(nodeCode(expNode));
    return {
      name,
      livePresent: !!liveNode,
      exportPresent: !!expNode,
      liveSha,
      exportSha: expSha,
      identical: liveSha === expSha,
      liveLen: nodeCode(liveNode).length,
      exportLen: nodeCode(expNode).length,
    };
  });

  const payload = {
    phase: '8F-2B49-P4D',
    at: new Date().toISOString(),
    liveVersionId: live.versionId,
    liveVersionCounter: live.versionCounter,
    liveNodes: (live.nodes || []).length,
    exportNodes: (exported.nodes || []).length,
    rows,
    allCriticalIdentical: rows.every((r) => r.identical),
  };
  fs.writeFileSync(path.join(outDir, 'NODE_SHA_COMPARE.json'), JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
})().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
