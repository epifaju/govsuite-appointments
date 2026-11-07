/**
 * Tests hors ligne P4D — copies locales des règles Fusionner / Gérer / Parser.
 * Aucun Ollama, chat, n8n, SQL, mock.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const outDir = __dirname;

function hasValue(value) {
  return value !== null && value !== undefined && value !== '' && value !== 'null' && value !== 'undefined';
}

const businessIntents = [
  'CREATE_APPOINTMENT',
  'GET_APPOINTMENT',
  'CANCEL_APPOINTMENT',
  'RESCHEDULE_APPOINTMENT',
];

function fuse({ previous, currentIntent, message }) {
  const previousPendingAction = previous.pending_action ?? null;
  const previousConversationStep = previous.conversation_step ?? null;
  const createFlowLocked = ['AWAIT_CREATE_CONFIRMATION', 'CREATE_UNCERTAIN', 'CREATE_IN_PROGRESS'].includes(
    previous.conversation_step
  );
  const hasExplicitBusinessIntent = businessIntents.includes(currentIntent);
  const explicitRestart = false;
  const actionChanged =
    !createFlowLocked &&
    hasExplicitBusinessIntent &&
    hasValue(previousPendingAction) &&
    (currentIntent !== previousPendingAction || explicitRestart);
  const startingNewAction =
    !createFlowLocked && hasExplicitBusinessIntent && !hasValue(previousPendingAction);
  const continuingPreviousAction =
    hasValue(previousPendingAction) && !actionChanged && !explicitRestart;

  let intent = currentIntent;
  let wiped = false;
  if ((actionChanged || startingNewAction) && !continuingPreviousAction) {
    intent = currentIntent;
    wiped = true;
  } else if (continuingPreviousAction) {
    intent = previousPendingAction;
    wiped = false;
  } else {
    intent = currentIntent;
    wiped = !hasValue(previousPendingAction);
  }
  return {
    intent,
    continuingPreviousAction,
    actionChanged,
    startingNewAction,
    wiped,
    previousPendingAction,
    previousConversationStep,
    message,
  };
}

function collect({ previous, fusionIntent, parserIntent, message }) {
  const currentIntent = fusionIntent ?? parserIntent ?? 'GENERAL';
  const previousPendingAction = previous.pending_action ?? null;
  const previousConversationStep = previous.conversation_step ?? null;
  const fusion = arguments[0].fusion || {};
  const newBusinessAction =
    fusion.actionChanged === true ||
    fusion.explicitRestart === true ||
    fusion.startingNewAction === true;

  let pendingAction = null;
  let conversationStep = null;
  if (newBusinessAction) {
    pendingAction = businessIntents.includes(currentIntent) ? currentIntent : null;
    conversationStep = null;
  } else if (previousPendingAction && businessIntents.includes(previousPendingAction)) {
    pendingAction = previousPendingAction;
    conversationStep = previousConversationStep ?? null;
  } else if (businessIntents.includes(currentIntent)) {
    pendingAction = currentIntent;
  }

  let intent = currentIntent;
  let prenom = previous.prenom || null;
  let nom = previous.nom || null;

  if (pendingAction === 'CREATE_APPOINTMENT') {
    intent = 'CREATE_APPOINTMENT';
    if (conversationStep === 'ASK_PRENOM' && message && !prenom) {
      prenom = String(message).trim();
      conversationStep = 'ASK_EMAIL';
    }
  } else if (currentIntent === 'GET_AVAILABILITY') {
    intent = 'GET_AVAILABILITY';
    pendingAction = 'GET_AVAILABILITY';
    conversationStep = null;
  } else {
    intent = currentIntent ?? 'GENERAL';
    pendingAction = null;
    conversationStep = null;
  }

  return { intent, pendingAction, conversationStep, nom, prenom };
}

function parserLocksCreateOnAskPrenom(previous, llmIntent, message) {
  // Comportement ACTUEL extrait : pas de verrou ASK_PRENOM (seulement ASK_TOKEN*).
  const previousPendingAction = previous.pending_action;
  const previousConversationStep = previous.conversation_step;
  let intent = llmIntent;
  if (previousPendingAction === 'GET_APPOINTMENT' && previousConversationStep === 'ASK_TOKEN') {
    intent = 'GET_APPOINTMENT';
  } else if (previousPendingAction === 'CANCEL_APPOINTMENT' && previousConversationStep === 'ASK_TOKEN') {
    intent = 'CANCEL_APPOINTMENT';
  } else if (
    previousPendingAction === 'RESCHEDULE_APPOINTMENT' &&
    previousConversationStep === 'ASK_TOKEN'
  ) {
    intent = 'RESCHEDULE_APPOINTMENT';
  }
  // aucune branche ASK_PRENOM
  void message;
  return intent;
}

function proposedParserLock(previous, llmIntent, message) {
  const step = previous.conversation_step;
  const pending = previous.pending_action;
  const collectionSteps = ['ASK_NOM', 'ASK_PRENOM', 'ASK_EMAIL', 'ASK_TELEPHONE', 'ASK_CREATE_SLOT'];
  const folded = String(message || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  const explicitOverride =
    /^(oui|non|stop|annuler|abandonner)$/.test(folded) ||
    folded.startsWith('modifier') ||
    folded.startsWith('changer');
  if (pending === 'CREATE_APPOINTMENT' && collectionSteps.includes(step) && !explicitOverride) {
    return 'CREATE_APPOINTMENT';
  }
  return parserLocksCreateOnAskPrenom(previous, llmIntent, message);
}

const previousAskPrenom = {
  pending_action: 'CREATE_APPOINTMENT',
  conversation_step: 'ASK_PRENOM',
  nom: 'Dupont',
  service: 'PASSEPORT',
  site: 'PARIS',
  slot_id: '33333333-3333-4333-8333-333333333333',
};

const cases = [];

// T1: mémoire présente + LLM GET_SERVICES → Fusionner continue CREATE
{
  const f = fuse({
    previous: previousAskPrenom,
    currentIntent: 'GET_SERVICES',
    message: 'Camille',
  });
  const c = collect({
    previous: previousAskPrenom,
    fusionIntent: f.intent,
    parserIntent: 'GET_SERVICES',
    message: 'Camille',
    fusion: f,
  });
  cases.push({
    id: 'T1',
    name: 'Mémoire ASK_PRENOM + LLM GET_SERVICES → conserve CREATE et capture prénom',
    expect: f.intent === 'CREATE_APPOINTMENT' && f.continuingPreviousAction === true && c.prenom === 'Camille' && c.conversationStep === 'ASK_EMAIL',
    f,
    c,
  });
}

// T2: mémoire absente (session expirée non chargée) + LLM GET_SERVICES → wipe path
{
  const f = fuse({ previous: {}, currentIntent: 'GET_SERVICES', message: 'Camille' });
  const c = collect({
    previous: {},
    fusionIntent: f.intent,
    parserIntent: 'GET_SERVICES',
    message: 'Camille',
    fusion: f,
  });
  cases.push({
    id: 'T2',
    name: 'Sans mémoire + LLM GET_SERVICES → intent services et pending null (purge UPSERT)',
    expect: f.intent === 'GET_SERVICES' && c.pendingAction === null && c.conversationStep === null && !c.prenom,
    f,
    c,
  });
}

// T3: Parser actuel ne verrouille pas ASK_PRENOM
{
  const got = parserLocksCreateOnAskPrenom(previousAskPrenom, 'GET_SERVICES', 'Camille');
  cases.push({
    id: 'T3',
    name: 'Parser actuel laisse passer GET_SERVICES en ASK_PRENOM',
    expect: got === 'GET_SERVICES',
    got,
  });
}

// T4: correctif Parser proposé verrouille
{
  const got = proposedParserLock(previousAskPrenom, 'GET_SERVICES', 'Camille');
  cases.push({
    id: 'T4',
    name: 'Parser proposé force CREATE_APPOINTMENT pour Camille en ASK_PRENOM',
    expect: got === 'CREATE_APPOINTMENT',
    got,
  });
}

// T5: correctif Parser préserve non / modifier
{
  const non = proposedParserLock(previousAskPrenom, 'GET_SERVICES', 'non');
  const locked = proposedParserLock(previousAskPrenom, 'GET_SERVICES', 'Camille');
  cases.push({
    id: 'T5',
    name: 'Parser proposé : Camille verrouillé CREATE ; non laisse l’intent LLM (pas de forçage)',
    expect: locked === 'CREATE_APPOINTMENT' && non === 'GET_SERVICES',
    non,
    locked,
    note: 'Sur override, le Parser complet applique ensuite NEGATIVE/MODIFY/AFFIRM',
  });
}

// T6: mémoire + LLM CREATE (cas P3-like Dupont déjà passé) — sanity
{
  const f = fuse({
    previous: {
      pending_action: 'CREATE_APPOINTMENT',
      conversation_step: 'ASK_NOM',
      service: 'PASSEPORT',
    },
    currentIntent: 'CREATE_APPOINTMENT',
    message: 'Dupont',
  });
  cases.push({
    id: 'T6',
    name: 'Mémoire ASK_NOM + LLM CREATE → continuation',
    expect: f.continuingPreviousAction === true && f.intent === 'CREATE_APPOINTMENT',
    f,
  });
}

const results = cases.map((c) => ({
  id: c.id,
  name: c.name,
  pass: !!c.expect,
  detail: c,
}));
const payload = {
  phase: '8F-2B49-P4D',
  at: new Date().toISOString(),
  passCount: results.filter((r) => r.pass).length,
  total: results.length,
  allPass: results.every((r) => r.pass),
  results: results.map(({ id, name, pass }) => ({ id, name, pass })),
};
fs.writeFileSync(path.join(outDir, 'OFFLINE_TEST_RESULTS.json'), JSON.stringify({ payload, results }, null, 2));
console.log(JSON.stringify(payload, null, 2));
process.exit(payload.allPass ? 0 : 1);
