'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const wfPath = path.join(
  __dirname,
  '..',
  'diag-034',
  'after-OCD9It1uKFhOoWNF.json'
);
const wf = JSON.parse(fs.readFileSync(wfPath, 'utf8'));
const nodes = wf.nodes || [];
const conns = wf.connections || {};

const keywords = [
  'Chat',
  'Comprendre',
  'Parser',
  'Fusionner',
  'Gérer',
  'Sauvegarder',
  'Router',
  'Préparer',
  'Demander',
  'Respond',
  'Répond',
  'intention',
  'collecte',
  'LLM',
  'Ollama',
  'Basic LLM',
  'Lorsqu',
  'Charger',
  'Joindre',
  'Décider',
  'Appeler Create',
  'Switch',
];

const matched = nodes
  .filter((n) => keywords.some((k) => n.name.includes(k)))
  .map((n) => ({
    name: n.name,
    type: n.type,
    id: n.id,
    typeVersion: n.typeVersion,
  }));

function outsOf(from) {
  const outs = conns[from];
  if (!outs) return [];
  const targets = [];
  for (const [outType, branches] of Object.entries(outs)) {
    (branches || []).forEach((branch, bi) =>
      (branch || []).forEach((t) =>
        targets.push({
          outType,
          branch: bi,
          to: t.node,
          type: t.type,
          index: t.index,
        })
      )
    );
  }
  return targets;
}

const focus = [
  "Lorsqu'un message de chat est reçu",
  'Charger état conversation',
  'Joindre tentative de session',
  'Comprendre la demande',
  'Basic LLM Chain',
  'Ollama Chat Model',
  'Parser réponse LLM',
  'Fusionner état conversation',
  'Gérer collecte progressive',
  'Sauvegarder état conversation',
  'Router intention',
  'Préparer réponse création',
  'Demander information manquante',
  'Respond to Chat',
  'Répondre au chat',
];

const byName = Object.fromEntries(nodes.map((n) => [n.name, n]));

function shaJs(name) {
  const n = byName[name];
  if (!n || !n.parameters || !n.parameters.jsCode) return null;
  return crypto.createHash('sha256').update(n.parameters.jsCode, 'utf8').digest('hex');
}

const chain = [];
for (const name of Object.keys(conns).sort()) {
  if (keywords.some((k) => name.includes(k))) {
    chain.push({ from: name, to: outsOf(name) });
  }
}

const criticalCodeNodes = [
  'Parser réponse LLM',
  'Fusionner état conversation',
  'Gérer collecte progressive',
  'Sauvegarder état conversation',
  'Préparer réponse création',
  'Demander information manquante',
];

const codeMeta = {};
for (const name of criticalCodeNodes) {
  const n = byName[name];
  codeMeta[name] = n
    ? {
        type: n.type,
        id: n.id,
        sha256: shaJs(name),
        jsLen: (n.parameters && n.parameters.jsCode && n.parameters.jsCode.length) || 0,
        hasThrow: !!(n.parameters && n.parameters.jsCode && /\bthrow\b/.test(n.parameters.jsCode)),
        throwSnippets: extractThrows(n.parameters && n.parameters.jsCode),
      }
    : null;
}

function extractThrows(js) {
  if (!js) return [];
  const lines = js.split('\n');
  const hits = [];
  lines.forEach((line, i) => {
    if (/\bthrow\b/.test(line) || /new Error\(/.test(line)) {
      hits.push({ line: i + 1, text: line.trim().slice(0, 160) });
    }
  });
  return hits;
}

// Also find ALL code nodes with throw on path-related names
const allThrows = [];
for (const n of nodes) {
  const js = n.parameters && n.parameters.jsCode;
  if (!js) continue;
  if (!/\bthrow\b/.test(js) && !/new Error\(/.test(js)) continue;
  allThrows.push({
    name: n.name,
    type: n.type,
    throws: extractThrows(js),
  });
}

// Find expression errors risk: nodes with expressions referencing email / undefined
const exprRisk = [];
for (const n of nodes) {
  const raw = JSON.stringify(n.parameters || {});
  if (/\$json\.email|\$\(.*\)\.item\.json\.email/.test(raw)) {
    exprRisk.push({ name: n.name, type: n.type });
  }
}

// Router node details
const routerCandidates = nodes.filter(
  (n) =>
    /router|switch|intention|décider|decider/i.test(n.name) ||
    n.type.includes('switch') ||
    n.type.includes('if')
);

console.log(
  JSON.stringify(
    {
      versionId: wf.versionId || wf.id,
      versionCounter: wf.versionCounter,
      nodeCount: nodes.length,
      matchedCount: matched.length,
      matched,
      focusPresent: Object.fromEntries(focus.map((n) => [n, !!byName[n]])),
      connectionsFocus: focus.map((n) => ({ from: n, to: outsOf(n) })),
      allKeywordConnections: chain,
      codeMeta,
      allThrows,
      exprRisk,
      routerCandidates: routerCandidates.map((n) => ({
        name: n.name,
        type: n.type,
        paramsKeys: Object.keys(n.parameters || {}),
      })),
      gererSha: shaJs('Gérer collecte progressive'),
    },
    null,
    2
  )
);
