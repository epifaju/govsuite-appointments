'use strict';
/** Offline: simulate pas-un-email turn; inspect typed fields that Sauvegarder casts. No network. */
const fs = require('fs');
const path = require('path');
const {
  runConversationTurn,
} = require('../../../../../tests/rec008/lib/node-runtime.cjs');

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
  available_slots: [
    { id: '11111111-1111-4111-8111-111111111301', slotId: '11111111-1111-4111-8111-111111111301' },
  ],
  selected_slot_index: 1,
  session_found: true,
  session_expired: false,
};

function summarize(label, obj) {
  const keys = [
    'intent',
    'pendingAction',
    'conversationStep',
    'email',
    'dateDebut',
    'dateFin',
    'slotId',
    'newSlotId',
    'token',
    'selectedSlotIndex',
    'availableSlots',
    'originalMessage',
  ];
  const out = { label };
  for (const k of keys) {
    const v = obj[k];
    if (v === undefined) {
      out[k] = { present: false };
    } else if (v === null) {
      out[k] = { present: true, null: true };
    } else if (Array.isArray(v)) {
      out[k] = { present: true, type: 'array', len: v.length };
    } else {
      out[k] = {
        present: true,
        type: typeof v,
        len: String(v).length,
        looksUuid: /^[0-9a-f-]{36}$/i.test(String(v)),
        looksDate: /^\d{4}-\d{2}-\d{2}/.test(String(v)),
        looksInt: /^-?\d+$/.test(String(v)),
      };
    }
  }
  return out;
}

const cases = [
  {
    name: 'clean_llm_CREATE',
    llmIntent: 'CREATE_APPOINTMENT',
    llmExtra: {},
  },
  {
    name: 'llm_pollutes_dateDebut_with_message',
    llmIntent: 'CREATE_APPOINTMENT',
    llmExtra: { dateDebut: 'pas-un-email', dateFin: 'pas-un-email' },
  },
  {
    name: 'llm_pollutes_slotId',
    llmIntent: 'CREATE_APPOINTMENT',
    llmExtra: { slotId: 'pas-un-email' },
  },
  {
    name: 'llm_pollutes_selectedSlotIndex',
    llmIntent: 'CREATE_APPOINTMENT',
    llmExtra: { selectedSlotIndex: 'pas-un-email' },
  },
  {
    name: 'llm_intent_GENERAL',
    llmIntent: 'GENERAL',
    llmExtra: {},
  },
];

const results = [];
for (const c of cases) {
  let err = null;
  let t = null;
  try {
    t = runConversationTurn(wf, {
      previous: prev,
      message: 'pas-un-email',
      llmIntent: c.llmIntent,
      llmExtra: c.llmExtra,
      withReply: false,
    });
  } catch (e) {
    err = String(e && e.message ? e.message : e).slice(0, 200);
  }
  results.push({
    case: c.name,
    threw: !!err,
    error: err,
    parser: t ? summarize('parser', t.parser) : null,
    fusion: t ? summarize('fusion', t.fusion) : null,
    managed: t ? summarize('managed', t.managed) : null,
  });
}

const outPath = path.join(__dirname, 'SIM-TURN-FIELDS.json');
fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
console.log(JSON.stringify({ cases: results.length, outPath: 'SIM-TURN-FIELDS.json' }, null, 2));
for (const r of results) {
  console.log(
    r.case,
    'threw=' + r.threw,
    'step=' + (r.managed && r.managed.conversationStep && r.managed.conversationStep.type
      ? 'see'
      : r.managed && r.managed.conversationStep),
    'dateDebut=' + JSON.stringify(r.managed && r.managed.dateDebut),
    'slotId=' + JSON.stringify(r.managed && r.managed.slotId),
    'selIdx=' + JSON.stringify(r.managed && r.managed.selectedSlotIndex)
  );
}
