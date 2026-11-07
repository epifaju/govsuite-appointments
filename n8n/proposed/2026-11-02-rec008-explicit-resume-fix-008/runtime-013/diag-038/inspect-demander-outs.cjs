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

const keys = Object.keys(wf.connections || {}).filter((k) =>
  /Demander param|paramètres création|Respond|Répond|chat/i.test(k)
);
const report = {
  matchingConnectionKeys: keys,
  demanderExact: wf.connections['Demander paramètres création'] || null,
  // who points to Respond / chat response nodes
  respondLike: wf.nodes
    .filter((n) => /respond|répond|chat.*out|Retour/i.test(n.name) || /respondToChat|chat/i.test(n.type))
    .map((n) => ({ name: n.name, type: n.type })),
};

// Find nodes that connect TO any respond
const respondNames = report.respondLike.map((x) => x.name);
const inboundRespond = [];
for (const [from, c] of Object.entries(wf.connections || {})) {
  for (const branches of Object.values(c || {})) {
    (branches || []).forEach((branch) =>
      (branch || []).forEach((x) => {
        if (respondNames.includes(x.node)) inboundRespond.push({ from, to: x.node });
      })
    );
  }
}
report.inboundRespond = inboundRespond;

// Aiguiller tentative outputs (all branches)
const aigu = wf.connections['Aiguiller tentative'];
report.aiguiller = aigu || null;

fs.writeFileSync(path.join(__dirname, 'DEMANDER-OUTS.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
