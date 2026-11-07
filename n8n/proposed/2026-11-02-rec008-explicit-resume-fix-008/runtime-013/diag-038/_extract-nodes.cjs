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
const byName = Object.fromEntries(nodes.map((n) => [n.name, n]));

const outDir = path.join(__dirname, '_nodes');
fs.mkdirSync(outDir, { recursive: true });

const want = [
  'Parser intention',
  'Fusionner état conversation',
  'Gérer collecte progressive',
  'Préparer réponse création',
  'Demander paramètres création',
  'Décider action tentative',
  'Joindre tentative de session',
  'Préparer corps figé',
];

function sha(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

function outsOf(from) {
  const outs = conns[from];
  if (!outs) return [];
  const targets = [];
  for (const [outType, branches] of Object.entries(outs)) {
    (branches || []).forEach((branch, bi) =>
      (branch || []).forEach((t) =>
        targets.push({ outType, branch: bi, to: t.node })
      )
    );
  }
  return targets;
}

const meta = {};
for (const name of want) {
  const n = byName[name];
  if (!n) {
    meta[name] = null;
    continue;
  }
  const js = (n.parameters && n.parameters.jsCode) || '';
  if (js) {
    fs.writeFileSync(path.join(outDir, name.replace(/[^\w]+/g, '_') + '.js'), js);
  }
  meta[name] = {
    type: n.type,
    id: n.id,
    sha256: js ? sha(js) : null,
    jsLen: js.length,
    outs: outsOf(name),
    // For switch/postgres dump params summary
    paramsSummary:
      n.type.includes('switch') || n.type.includes('postgres')
        ? n.parameters
        : undefined,
  };
}

// Router intention rules
const router = byName['Router intention'];
if (router) {
  fs.writeFileSync(
    path.join(outDir, 'Router_intention.json'),
    JSON.stringify(router.parameters, null, 2)
  );
  meta['Router intention'] = {
    type: router.type,
    id: router.id,
    outs: outsOf('Router intention'),
    rulesCount:
      (router.parameters &&
        router.parameters.rules &&
        router.parameters.rules.values &&
        router.parameters.rules.values.length) ||
      null,
  };
}

// Sauvegarder query (no secrets)
const save = byName['Sauvegarder état conversation'];
if (save) {
  const q =
    (save.parameters && (save.parameters.query || save.parameters.queryReplacement)) ||
    null;
  fs.writeFileSync(
    path.join(outDir, 'Sauvegarder_etat_conversation.json'),
    JSON.stringify(
      {
        operation: save.parameters && save.parameters.operation,
        options: save.parameters && save.parameters.options,
        queryPreview: typeof q === 'string' ? q.slice(0, 4000) : q,
      },
      null,
      2
    )
  );
  meta['Sauvegarder état conversation'] = {
    type: save.type,
    id: save.id,
    outs: outsOf('Sauvegarder état conversation'),
    hasQuery: !!q,
  };
}

// Comprendre prompt snippet (no PII)
const understand = byName['Comprendre la demande'];
if (understand) {
  const p = understand.parameters || {};
  meta['Comprendre la demande'] = {
    type: understand.type,
    id: understand.id,
    outs: outsOf('Comprendre la demande'),
    keys: Object.keys(p),
    textLen: String(p.text || p.prompt || p.messages || '').length,
  };
}

// Trace full CREATE branch from Router
function walk(from, depth, seen) {
  if (depth > 8 || seen.has(from)) return { name: from, stop: true };
  seen = new Set(seen);
  seen.add(from);
  return {
    name: from,
    children: outsOf(from).map((t) => walk(t.to, depth + 1, seen)),
  };
}

meta.createBranchFromRouter = walk('Router intention', 0, new Set());
meta.upstreamToGerer = {
  Chat: outsOf("Lorsqu'un message de chat est reçu"),
  Charger: outsOf('Charger état conversation'),
  LireTentative: outsOf('Lire tentative de session'),
  Joindre: outsOf('Joindre tentative de session'),
  Comprendre: outsOf('Comprendre la demande'),
  Parser: outsOf('Parser intention'),
  Fusionner: outsOf('Fusionner état conversation'),
  Gerer: outsOf('Gérer collecte progressive'),
  Sauvegarder: outsOf('Sauvegarder état conversation'),
};

fs.writeFileSync(path.join(__dirname, '_nodes-meta.json'), JSON.stringify(meta, null, 2));
console.log('wrote', Object.keys(meta).length, 'meta entries');
console.log('gererSha', meta['Gérer collecte progressive'] && meta['Gérer collecte progressive'].sha256);
console.log('parserSha', meta['Parser intention'] && meta['Parser intention'].sha256);
