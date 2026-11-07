'use strict';

const { runCodeNode } = require('./node-runtime.cjs');

/**
 * Exécute les nœuds VC9 « Classer réponse HTTP » / « Classer délai HTTP »
 * avec un $json synthétique (pas d'HTTP réel).
 */
function classifyHttpResponse(workflow, statusCode, body, prep) {
  const store = {
    'Appliquer corps gagnant': prep || {
      attemptId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      sessionId: 'rec008-syn-http-01',
      leaseOwner: 'owner-syn-00000001'
    }
  };
  return runCodeNode(
    workflow,
    'Classer réponse HTTP',
    { statusCode, body },
    store
  );
}

function classifyHttpTimeout(workflow, prep) {
  const store = {
    'Appliquer corps gagnant': prep || {
      attemptId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      sessionId: 'rec008-syn-http-01',
      leaseOwner: 'owner-syn-00000001'
    }
  };
  return runCodeNode(workflow, 'Classer délai HTTP', {}, store);
}

function decideAttemptAction(workflow, collected, joined, saved) {
  const store = {
    'Gérer collecte progressive': collected || {},
    'Joindre tentative de session': joined || {}
  };
  return runCodeNode(
    workflow,
    'Décider action tentative',
    saved || {
      sessionId: (joined && joined.sessionId) || 'rec008-syn-decide-01',
      conversationStep:
        (collected && collected.conversationStep) || 'AWAIT_CREATE_CONFIRMATION'
    },
    store
  );
}

module.exports = {
  classifyHttpResponse,
  classifyHttpTimeout,
  decideAttemptAction
};
