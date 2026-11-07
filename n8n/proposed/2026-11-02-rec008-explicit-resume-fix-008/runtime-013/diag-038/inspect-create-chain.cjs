'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../../../../../');
const wf = JSON.parse(
  fs.readFileSync(
    path.join(
      root,
      'n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/runtime-013/diag-034/after-OCD9It1uKFhOoWNF.json'
    ),
    'utf8'
  )
);

function outs(from) {
  const c = wf.connections[from];
  if (!c) return [];
  const t = [];
  for (const [outType, branches] of Object.entries(c)) {
    (branches || []).forEach((branch, bi) =>
      (branch || []).forEach((x) => t.push({ outType, bi, to: x.node }))
    );
  }
  return t;
}

function inbound(target) {
  const hits = [];
  for (const [from, c] of Object.entries(wf.connections || {})) {
    for (const branches of Object.values(c || {})) {
      (branches || []).forEach((branch, bi) =>
        (branch || []).forEach((x) => {
          if (x.node === target) hits.push({ from, bi });
        })
      );
    }
  }
  return hits;
}

const chain = [
  'Décider action tentative',
  'Demander paramètres création',
  'Préparer réponse création',
  'Finaliser état création',
  'Appeler CreateAppointment',
  'Créer rendez-vous',
  'HTTP Request',
];

const report = {
  createRouterTarget: outs('Router intention').find((x) => x.bi === 2),
  nodes: {},
};
for (const name of chain) {
  const node = wf.nodes.find((n) => n.name === name);
  report.nodes[name] = {
    exists: Boolean(node),
    type: node && node.type,
    inbound: inbound(name),
    outs: outs(name),
  };
}

// Also list any node with Create in name
report.createLike = wf.nodes
  .filter((n) => /cr[eé]at|Create|tentative|Demander param/i.test(n.name))
  .map((n) => n.name);

fs.writeFileSync(path.join(__dirname, 'CREATE-CHAIN.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
