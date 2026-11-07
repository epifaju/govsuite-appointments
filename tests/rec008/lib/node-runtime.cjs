'use strict';

const vm = require('vm');
const { codeOf } = require('./workflow-source.cjs');

/**
 * Exécute le jsCode d'un nœud Code n8n dans une VM isolée (simulation offline).
 * Ce n'est PAS une preuve runtime n8n/PostgreSQL.
 */
function runCodeNode(workflow, nodeName, json, store, options) {
  const opts = options || {};
  const source = codeOf(workflow, nodeName);
  const lookup = (name) => {
    if (!Object.prototype.hasOwnProperty.call(store, name)) {
      throw new Error('Noeud mock absent: ' + name);
    }
    return { item: { json: store[name] } };
  };

  const sandbox = {
    $json: json,
    $: lookup,
    console: {
      log() {},
      warn() {},
      error() {}
    },
    JSON,
    String,
    Number,
    Boolean,
    Array,
    Object,
    Date,
    Math,
    RegExp,
    Error,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    undefined,
    null: null
  };

  const wrapped = '(function(){\n' + source + '\n})()';
  let result;
  try {
    result = vm.runInNewContext(wrapped, sandbox, {
      timeout: opts.timeoutMs || 5000,
      displayErrors: true
    });
  } catch (err) {
    const e = new Error('NODE_EXEC:' + nodeName + ' — ' + err.message);
    e.code = 'NODE_EXEC';
    e.cause = err;
    throw e;
  }

  if (!result || !result[0] || !result[0].json) {
    const e = new Error('NODE_RESULT_INVALID:' + nodeName);
    e.code = 'NODE_RESULT_INVALID';
    e.raw = result;
    throw e;
  }
  return result[0].json;
}

function baseStore(trigger, previous) {
  return {
    "Lorsqu'un message de chat est reçu": trigger,
    'Charger état conversation': previous,
    'Joindre tentative de session': previous
  };
}

/**
 * Chaîne offline Parser → Fusionner → Gérer → (optionnel) Réponse générale.
 */
function runConversationTurn(workflow, input) {
  const trigger = {
    chatInput: input.message,
    sessionId: input.sessionId || (input.previous && input.previous.session_id) || 'syn-session'
  };
  const previous = Object.assign({}, input.previous || {});
  if (input.sessionExpired === true) {
    previous.session_expired = true;
    previous.sessionExpired = true;
    previous.session_found = previous.session_found !== false;
    previous.sessionFound = previous.sessionFound !== false;
  }

  const store = baseStore(trigger, previous);
  const llmPayload = input.llm || { intent: input.llmIntent || 'GENERAL' };
  const parserIn = {
    text:
      typeof llmPayload === 'string'
        ? llmPayload
        : JSON.stringify(llmPayload)
  };

  const parser = runCodeNode(workflow, 'Parser intention', parserIn, store);
  store['Parser intention'] = parser;

  const fusion = runCodeNode(workflow, 'Fusionner état conversation', parser, store);
  store['Fusionner état conversation'] = fusion;

  const managed = runCodeNode(workflow, 'Gérer collecte progressive', fusion, store);
  store['Gérer collecte progressive'] = managed;

  let reply = null;
  if (input.withReply !== false) {
    reply = runCodeNode(workflow, 'Réponse générale', {}, store);
  }

  return {
    simulation: true,
    disclaimer:
      'Simulation VM du jsCode VC9 extrait — ne prouve pas à elle seule le runtime n8n/PostgreSQL.',
    nodes: [
      'Parser intention',
      'Fusionner état conversation',
      'Gérer collecte progressive',
      input.withReply === false ? null : 'Réponse générale'
    ].filter(Boolean),
    parser,
    fusion,
    managed,
    reply,
    claimOrPost: false,
    wouldCallCreateAppointment: false
  };
}

module.exports = {
  runCodeNode,
  runConversationTurn,
  baseStore
};
