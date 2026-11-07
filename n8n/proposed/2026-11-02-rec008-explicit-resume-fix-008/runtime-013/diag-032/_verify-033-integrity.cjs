'use strict';
/**
 * MISSION 033 — lecture seule: intégrité candidat W03101 vs FIX-008.
 * Aucun PUT. STOP si écart.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const base = path.resolve(__dirname, '../..');
const srcPath = path.join(base, 'after-OCD9It1uKFhOoWNF.json');
const candPath = path.join(__dirname, 'after-OCD9It1uKFhOoWNF.W03101-candidate.json');
const shaPath = path.join(__dirname, 'SHA256.json');
const beforeJsPath = path.join(__dirname, 'Gerer_collecte_progressive.BEFORE.js');
const afterJsPath = path.join(__dirname, 'Gerer_collecte_progressive.AFTER.js');
const diffPath = path.join(__dirname, 'PROPOSED_FIX.diff.txt');

const sha = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
const countConn = (wf) => {
  let n = 0;
  for (const ports of Object.values(wf.connections || {})) {
    for (const arr of Object.values(ports || {})) {
      for (const outputs of arr || []) n += (outputs || []).length;
    }
  }
  return n;
};

const shaMeta = JSON.parse(fs.readFileSync(shaPath, 'utf8'));
const src = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
const cand = JSON.parse(fs.readFileSync(candPath, 'utf8'));
const beforeJs = fs.readFileSync(beforeJsPath, 'utf8');
const afterJs = fs.readFileSync(afterJsPath, 'utf8');
const diffTxt = fs.existsSync(diffPath) ? fs.readFileSync(diffPath, 'utf8') : null;

const findings = [];
const ok = (name, pass, detail) => findings.push({ name, pass: !!pass, detail });

ok(
  'workflow.id',
  cand.id === 'OCD9It1uKFhOoWNF' && src.id === cand.id,
  { src: src.id, cand: cand.id, expected: 'OCD9It1uKFhOoWNF' }
);

ok(
  'nodeCount',
  (cand.nodes || []).length === 134 &&
    (src.nodes || []).length === 134 &&
    shaMeta.nodeCount === 134,
  {
    src: (src.nodes || []).length,
    cand: (cand.nodes || []).length,
    expected: 134,
    meta: shaMeta.nodeCount,
  }
);

const srcConn = countConn(src);
const candConn = countConn(cand);
ok('connectionsCount', srcConn === candConn, { src: srcConn, cand: candConn });
ok(
  'connectionsDeepEqual',
  JSON.stringify(src.connections) === JSON.stringify(cand.connections),
  {}
);

const srcByName = Object.fromEntries((src.nodes || []).map((n) => [n.name, n]));
const candByName = Object.fromEntries((cand.nodes || []).map((n) => [n.name, n]));
const srcNames = new Set(Object.keys(srcByName));
const candNames = new Set(Object.keys(candByName));
const onlySrc = [...srcNames].filter((n) => !candNames.has(n));
const onlyCand = [...candNames].filter((n) => !srcNames.has(n));
const modified = [];
for (const name of srcNames) {
  if (!candNames.has(name)) continue;
  if (JSON.stringify(srcByName[name]) !== JSON.stringify(candByName[name])) {
    modified.push(name);
  }
}
ok(
  'onlyGererModified',
  modified.length === 1 &&
    modified[0] === 'Gérer collecte progressive' &&
    onlySrc.length === 0 &&
    onlyCand.length === 0,
  { modified, onlySrc, onlyCand }
);

const gererCand = (cand.nodes || []).find((n) => n.name === 'Gérer collecte progressive');
const gererSrc = (src.nodes || []).find((n) => n.name === 'Gérer collecte progressive');
const gererJsCand = gererCand?.parameters?.jsCode || '';
const gererJsSrc = gererSrc?.parameters?.jsCode || '';
const gererShaCand = sha(gererJsCand);
const gererShaSrc = sha(gererJsSrc);

ok(
  'gererShaBefore',
  gererShaSrc === shaMeta.gererNodeSha256.before && gererShaSrc === sha(beforeJs),
  {
    computed: gererShaSrc,
    meta: shaMeta.gererNodeSha256.before,
    beforeFile: sha(beforeJs),
  }
);
ok(
  'gererShaAfter',
  gererShaCand === shaMeta.gererNodeSha256.after &&
    gererShaCand === sha(afterJs) &&
    gererShaCand.startsWith('44a7064d'),
  {
    computed: gererShaCand,
    meta: shaMeta.gererNodeSha256.after,
    afterFile: sha(afterJs),
  }
);

const bl = beforeJs.split('\n');
const al = afterJs.split('\n');
const replDetails = [];
if (bl.length === al.length) {
  for (let i = 0; i < bl.length; i++) {
    if (bl[i] !== al[i]) {
      replDetails.push({ line: i + 1, before: bl[i].trim(), after: al[i].trim() });
    }
  }
}
ok(
  'replacements',
  bl.length === al.length && replDetails.length === 4 && shaMeta.replacements === 4,
  {
    changedLines: replDetails.length,
    lineCountMismatch: bl.length !== al.length,
    beforeLines: bl.length,
    afterLines: al.length,
    meta: shaMeta.replacements,
    details: replDetails,
  }
);

ok('candidateJsEqualsAfterFile', gererJsCand === afterJs, {});
ok('srcJsEqualsBeforeFile', gererJsSrc === beforeJs, {});

const topDiff = {};
for (const k of new Set([...Object.keys(src), ...Object.keys(cand)])) {
  if (k === 'nodes' || k === 'connections') continue;
  if (JSON.stringify(src[k]) !== JSON.stringify(cand[k])) {
    topDiff[k] = true;
  }
}
ok('topLevelUnchanged', Object.keys(topDiff).length === 0, { topDiff: Object.keys(topDiff) });

const credDiff = [];
for (const name of srcNames) {
  if (
    JSON.stringify(srcByName[name]?.credentials || null) !==
    JSON.stringify(candByName[name]?.credentials || null)
  ) {
    credDiff.push(name);
  }
}
ok('noCredsChange', credDiff.length === 0, { credDiff });

const triggerDiff = [];
for (const name of srcNames) {
  const sa = srcByName[name];
  const ca = candByName[name];
  if (!sa || !ca) continue;
  const isTrig = /trigger|webhook/i.test(sa.type || '');
  if (isTrig && JSON.stringify(sa) !== JSON.stringify(ca)) triggerDiff.push(name);
}
ok('noTriggerChange', triggerDiff.length === 0, { triggerDiff });

const gererNonJsDiff = [];
{
  const { parameters: sp, ...srest } = gererSrc || {};
  const { parameters: cp, ...crest } = gererCand || {};
  const { jsCode: _sj, ...spRest } = sp || {};
  const { jsCode: _cj, ...cpRest } = cp || {};
  if (
    JSON.stringify({ ...srest, parameters: spRest }) !==
    JSON.stringify({ ...crest, parameters: cpRest })
  ) {
    gererNonJsDiff.push('non-jsCode fields differ');
  }
}
ok('gererOnlyJsCodeChanged', gererNonJsDiff.length === 0, { gererNonJsDiff });

const candFileSha = sha(fs.readFileSync(candPath));
const srcFileSha = sha(fs.readFileSync(srcPath));
ok(
  'workflowFileSha',
  candFileSha === shaMeta.workflowFileSha256.afterCandidate &&
    srcFileSha === shaMeta.workflowFileSha256.before,
  {
    candComputed: candFileSha,
    candMeta: shaMeta.workflowFileSha256.afterCandidate,
    srcComputed: srcFileSha,
    srcMeta: shaMeta.workflowFileSha256.before,
  }
);

ok(
  'versionId',
  cand.versionId === shaMeta.versionId && cand.versionId === src.versionId,
  { cand: cand.versionId, src: src.versionId, meta: shaMeta.versionId }
);

ok('activeUnchanged', cand.active === src.active, { src: src.active, cand: cand.active });

// Canonical node-level diff (name + type + typeVersion + position + credentials + parameters sans jsCode dump length)
const canonical = {
  id: { src: src.id, cand: cand.id },
  name: { src: src.name, cand: cand.name },
  active: { src: src.active, cand: cand.active },
  versionId: { src: src.versionId, cand: cand.versionId },
  nodeCount: { src: (src.nodes || []).length, cand: (cand.nodes || []).length },
  connectionsCount: { src: srcConn, cand: candConn },
  modifiedNodes: modified,
  gerer: {
    shaBefore: gererShaSrc,
    shaAfter: gererShaCand,
    metaAfter: shaMeta.gererNodeSha256.after,
    replacements: replDetails,
  },
  topLevelDiffKeys: Object.keys(topDiff),
  putForbidden: true,
  installedMeta: shaMeta.installed,
};

const allPass = findings.every((f) => f.pass);
const out = {
  mission: '033',
  verdict: allPass ? 'PASS' : 'FAIL',
  put: false,
  canonical,
  findings,
  artefacts: {
    source: path.relative(process.cwd(), srcPath).replace(/\\/g, '/'),
    candidate: path.relative(process.cwd(), candPath).replace(/\\/g, '/'),
    sha256: path.relative(process.cwd(), shaPath).replace(/\\/g, '/'),
    beforeJs: path.relative(process.cwd(), beforeJsPath).replace(/\\/g, '/'),
    afterJs: path.relative(process.cwd(), afterJsPath).replace(/\\/g, '/'),
    diff: diffTxt
      ? path.relative(process.cwd(), diffPath).replace(/\\/g, '/')
      : null,
  },
};

const outPath = path.join(__dirname, 'MISSION-033-INTEGRITY.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(out, null, 2));
if (!allPass) process.exitCode = 1;
