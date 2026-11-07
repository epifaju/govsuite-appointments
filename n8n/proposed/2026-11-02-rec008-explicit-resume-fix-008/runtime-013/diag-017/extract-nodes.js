'use strict';
const fs = require('fs');
const path = require('path');
const wfPath =
  path.resolve(__dirname, '../../install-012/after-OCD9It1uKFhOoWNF.json');
const outDir = __dirname;
const wf = JSON.parse(fs.readFileSync(wfPath, 'utf8'));
const names = [
  'Parser intention',
  'Fusionner état conversation',
  'Gérer collecte progressive',
  'Sauvegarder état conversation',
  'Joindre tentative de session',
  'Router intention',
  'Demander paramètres création',
  'Création prête ?',
];
for (const name of names) {
  const n = (wf.nodes || []).find((x) => x.name === name);
  if (!n) {
    console.log('MISSING', name);
    continue;
  }
  const safe = name.replace(/[^a-zA-Z0-9]+/g, '_');
  if (n.parameters && n.parameters.jsCode) {
    fs.writeFileSync(path.join(outDir, safe + '.js'), n.parameters.jsCode);
    console.log(name, 'jsCode', n.parameters.jsCode.length);
  } else {
    fs.writeFileSync(
      path.join(outDir, safe + '.json'),
      JSON.stringify({ type: n.type, parameters: n.parameters }, null, 2),
    );
    console.log(name, 'type', n.type);
  }
}
const interesting = new Set([
  "Lorsqu'un message de chat est reçu",
  'Charger état conversation',
  'Lire tentative de session',
  'Joindre tentative de session',
  'Comprendre la demande',
  'Parser intention',
  'Fusionner état conversation',
  'Router intention',
  'Gérer collecte progressive',
  'Sauvegarder état conversation',
  'Création prête ?',
  'Demander paramètres création',
]);
const edges = {};
for (const [from, outs] of Object.entries(wf.connections || {})) {
  if (!interesting.has(from)) continue;
  edges[from] = outs;
}
fs.writeFileSync(path.join(outDir, 'PATH-EDGES.json'), JSON.stringify(edges, null, 2));
console.log('done');
