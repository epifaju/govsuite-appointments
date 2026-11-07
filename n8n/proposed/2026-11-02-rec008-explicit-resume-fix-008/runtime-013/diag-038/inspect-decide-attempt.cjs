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

function runCase(message, llmIntent) {
  const t = runConversationTurn(wf, {
    previous: prev,
    message,
    llmIntent,
    withReply: false,
  });
  const TRIGGER = "Lorsqu'un message de chat est reçu";
  const store = {
    [TRIGGER]: { chatInput: message },
    'Charger état conversation': prev,
    'Joindre tentative de session': prev,
    'Parser intention': t.parser,
    'Fusionner état conversation': t.fusion,
    'Gérer collecte progressive': t.managed,
  };
  let decide = null;
  let decideErr = null;
  try {
    decide = runCodeNode(wf, 'Décider action tentative', t.managed, store);
  } catch (e) {
    decideErr = String(e.message || e).slice(0, 200);
  }
  let dem = null;
  let demErr = null;
  try {
    dem = runCodeNode(wf, 'Demander paramètres création', t.managed, store);
  } catch (e) {
    demErr = String(e.message || e).slice(0, 200);
  }
  return {
    messageClass: /@/.test(message) ? 'email_like' : 'non_email',
    llmIntent,
    step: t.managed.conversationStep,
    emailPresent: Boolean(t.managed.email),
    decideErr,
    decideKeys: decide ? Object.keys(decide) : null,
    decideAction: decide && (decide.action || decide.attemptAction || decide.decision || decide.next),
    decideRedacted: decide
      ? {
          action: decide.action || null,
          attemptAction: decide.attemptAction || null,
          decision: decide.decision || null,
          next: decide.next || null,
          branch: decide.branch || null,
          route: decide.route || null,
          createDecision: decide.createDecision || null,
          conversationStep: decide.conversationStep || null,
        }
      : null,
    demErr,
    demTextHasEmailWord: dem && dem.text ? /email|courriel|mail/i.test(String(dem.text)) : false,
    demTextLen: dem && dem.text ? String(dem.text).length : 0,
  };
}

const out = {
  invalidCreate: runCase('pas-un-email', 'CREATE_APPOINTMENT'),
  invalidGeneral: runCase('pas-un-email', 'GENERAL'),
  validCreate: runCase('camille.diag038@example.test', 'CREATE_APPOINTMENT'),
};

fs.writeFileSync(path.join(__dirname, 'DECIDE-DEMAND.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
