'use strict';
const fs = require('fs');
const path = require('path');
const { runConversationTurn } = require('../../../../../tests/rec008/lib/node-runtime.cjs');

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
  session_id: 'rec008-r04b-035-active-ask-email',
  intent: 'CREATE_APPOINTMENT',
  pending_action: 'CREATE_APPOINTMENT',
  conversation_step: 'ASK_EMAIL',
  nom: 'Dupont',
  prenom: 'Camille',
  email: null,
  telephone: null,
  service: 'PASSEPORT',
  site: 'PARIS',
  date_debut: '2026-11-10',
  date_fin: '2026-11-14',
  slot_id: '11111111-1111-4111-8111-111111111301',
  available_slots: [{ id: '11111111-1111-4111-8111-111111111301' }],
  selected_slot_index: 1,
  session_found: true,
  session_expired: false,
};

function snap(o) {
  return {
    intent: o.intent ?? null,
    step: o.conversationStep ?? null,
    email: o.email ?? null,
    dateDebut: o.dateDebut ?? null,
    slotId: o.slotId ?? null,
    selectedSlotIndex: o.selectedSlotIndex ?? null,
    originalMessageLen: o.originalMessage ? String(o.originalMessage).length : 0,
  };
}

const cases = [
  { name: 'clean', llm: { intent: 'CREATE_APPOINTMENT' } },
  {
    name: 'pollute_dates',
    llm: { intent: 'CREATE_APPOINTMENT', dateDebut: 'pas-un-email', dateFin: 'pas-un-email' },
  },
  { name: 'pollute_slot', llm: { intent: 'CREATE_APPOINTMENT', slotId: 'pas-un-email' } },
  {
    name: 'pollute_sel',
    llm: { intent: 'CREATE_APPOINTMENT', selectedSlotIndex: 'pas-un-email' },
  },
  { name: 'intent_GENERAL', llm: { intent: 'GENERAL' } },
  { name: 'llm_empty_object', llm: {} },
  { name: 'llm_non_json_via_text', llmRaw: 'not-json <<<pas-un-email>>>' },
];

const out = [];
for (const c of cases) {
  let err = null;
  let t = null;
  try {
    const input = {
      previous: prev,
      message: 'pas-un-email',
      withReply: false,
    };
    if (c.llmRaw) input.llm = c.llmRaw;
    else input.llm = c.llm;
    t = runConversationTurn(wf, input);
  } catch (e) {
    err = String(e && e.message ? e.message : e).slice(0, 240);
  }
  out.push({
    case: c.name,
    threw: !!err,
    error: err,
    parser: t ? snap(t.parser) : null,
    fusion: t ? snap(t.fusion) : null,
    managed: t ? snap(t.managed) : null,
  });
}

fs.writeFileSync(path.join(__dirname, 'SIM-POLLUTE.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
