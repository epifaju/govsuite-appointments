'use strict';
const fs = require('fs');
const path = require('path');
const { runConversationTurn, runCodeNode } = require('../../../../../tests/rec008/lib/node-runtime.cjs');

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
const prev = {
  session_id: 's',
  intent: 'CREATE_APPOINTMENT',
  pending_action: 'CREATE_APPOINTMENT',
  conversation_step: 'ASK_EMAIL',
  nom: 'Dupont',
  prenom: 'Camille',
  email: null,
  telephone: null,
  service: 'PASSEPORT',
  site: 'PARIS',
  slot_id: '11111111-1111-4111-8111-111111111301',
  available_slots: [{ id: '11111111-1111-4111-8111-111111111301' }],
  session_found: true,
};
const t = runConversationTurn(wf, {
  previous: prev,
  message: 'pas-un-email',
  llmIntent: 'CREATE_APPOINTMENT',
  withReply: false,
});
const TRIGGER = "Lorsqu'un message de chat est reçu";
const store = {
  [TRIGGER]: { chatInput: 'pas-un-email' },
  'Charger état conversation': prev,
  'Joindre tentative de session': prev,
  'Parser intention': t.parser,
  'Fusionner état conversation': t.fusion,
  'Gérer collecte progressive': t.managed,
};
const prep = runCodeNode(wf, 'Préparer réponse création', t.managed, store);
const text = prep.text == null ? null : String(prep.text);
const out = {
  managedStep: t.managed.conversationStep,
  managedEmailPresent: Boolean(t.managed.email),
  prepKeys: Object.keys(prep),
  textPresent: Boolean(text),
  textLen: text ? text.length : 0,
  // redacted: only class, never dump full citizen-like content if any
  textHasEmailWord: text ? /email|courriel|mail|adresse/i.test(text) : false,
  textHasTelephoneWord: text ? /t[ée]l[ée]phone|phone/i.test(text) : false,
  type: prep.type || null,
};
fs.writeFileSync(path.join(__dirname, 'PREP-INSPECT.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
