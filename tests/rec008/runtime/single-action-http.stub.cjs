'use strict';

/**
 * Stub exécuteur HTTP à action unique — READINESS-005.
 * Ne réalise aucun fetch/http. Refuse l'exécution main.
 */

function sendSingleChatMessage(/* opts */) {
  throw new Error(
    '[READINESS-005] single-action-http.stub.cjs: HTTP sendMessage not implemented/authorized. ' +
      'No retry policy. Require explicit human authorization + TARGET=TEST verified.'
  );
}

module.exports = { sendSingleChatMessage };

if (require.main === module) {
  throw new Error('[READINESS-005] Refusing to run single-action-http.stub.cjs as main.');
}
