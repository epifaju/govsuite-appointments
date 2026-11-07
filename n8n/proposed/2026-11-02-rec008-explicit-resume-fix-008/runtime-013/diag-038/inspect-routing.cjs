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
      (branch || []).forEach((x) =>
        t.push({ outType, bi, to: x.node, index: x.index })
      )
    );
  }
  return t;
}

const demander = wf.nodes.find((n) => n.name === 'Demander paramètres création');
const prep = wf.nodes.find((n) => n.name === 'Préparer réponse création');
const codeD = demander.parameters.jsCode;
const codeP = prep.parameters.jsCode;

const analysis = {
  demanderHasAskEmail: codeD.includes('ASK_EMAIL'),
  prepHasAskEmail: codeP.includes('ASK_EMAIL'),
  prepMentionsAppointmentCreated: codeP.includes('appointment_created'),
  routerOuts: outs('Router intention'),
  fromGerer: outs('Gérer collecte progressive'),
  fromSauvegarder: outs('Sauvegarder état conversation'),
  fromDemander: outs('Demander paramètres création'),
  fromPrep: outs('Préparer réponse création'),
  askEmailSnippet: (() => {
    const i = codeD.indexOf("case 'ASK_EMAIL'");
    return i < 0 ? null : codeD.slice(i, i + 280).replace(/\s+/g, ' ');
  })(),
};

fs.writeFileSync(
  path.join(__dirname, 'ROUTING-INSPECT.json'),
  JSON.stringify(analysis, null, 2)
);
console.log(JSON.stringify(analysis, null, 2));
