'use strict';
const fs = require('fs');
const path = require('path');
const wf = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '..', 'diag-034', 'after-OCD9It1uKFhOoWNF.json'),
    'utf8'
  )
);
const n = wf.nodes.find((x) => x.name === 'Comprendre la demande');
const ollama = wf.nodes.find((x) => x.name === 'Ollama Chat Model');
const chat = wf.nodes.find((x) => x.name === "Lorsqu'un message de chat est reçu");
const out = {
  chatTrigger: {
    responseMode: chat && chat.parameters && chat.parameters.options && chat.parameters.options.responseMode,
    rawOptions: chat && chat.parameters && chat.parameters.options,
  },
  comprendre: {
    type: n.type,
    keys: Object.keys(n.parameters || {}),
    promptType: n.parameters && n.parameters.promptType,
    text: n.parameters && n.parameters.text,
    hasMessages: !!(n.parameters && n.parameters.messages),
    messagesPreview: n.parameters && n.parameters.messages,
    batching: n.parameters && n.parameters.batching,
  },
  ollama: {
    type: ollama.type,
    model: ollama.parameters && ollama.parameters.model,
    options: ollama.parameters && ollama.parameters.options,
  },
  settings: wf.settings || null,
};
fs.writeFileSync(path.join(__dirname, 'COMPRENDRE-META.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
