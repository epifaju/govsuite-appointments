'use strict';
const fs = require('fs');
const wf = JSON.parse(
  fs.readFileSync(
    'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-31-rec008-phase8f2b26-FINALIZATION-FIX-INSTALL/after-OCD9It1uKFhOoWNF.json',
    'utf8'
  )
);
const c = wf.connections;
function outs(name) {
  const o = c[name];
  if (!o) return null;
  return (o.main || []).map((g) => (g || []).map((x) => x.node));
}
const start = [
  "Lorsqu'un message de chat est reçu",
  'Charger état conversation',
  'Joindre tentative de session',
  'AI Agent',
  'Ollama Chat Model',
  'Parser intention',
  'Fusionner état conversation',
  'Gérer collecte progressive',
  'Sauvegarder état conversation',
  'Router intention',
  'Appeler GetServices',
  'Préparer réponse services',
];
for (const n of start) console.log(n, '->', JSON.stringify(outs(n)));
for (const n of wf.nodes) {
  if (/agent|Basic LLM|chain|mémoire|memory|Structured/i.test(n.name) || /agent|chain/i.test(n.type)) {
    console.log('NODE', n.name, n.type);
  }
}
