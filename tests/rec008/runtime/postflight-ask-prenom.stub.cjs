'use strict';

/**
 * ASK-PRENOM-READINESS-007 — stub postflight campagne ASK_PRENOM S01–S03 (non exécutant).
 * Ne contient aucun appel Docker / n8n / SQL / fetch.
 * Checklist : ./POSTFLIGHT-ASK-PRENOM.md — STOP : ./STOP-CONDITIONS-ASK-PRENOM.md
 */

const PHASE = 'ASK_PRENOM-S01-S03';
const MISSION = 'ASK-PRENOM-READINESS-007';

function postflightAskPrenomStub(/* scenarioId */) {
  throw new Error(
    `[${MISSION}] postflight-ask-prenom.stub.cjs is a non-executing readiness stub for ${PHASE}. ` +
      'Use POSTFLIGHT-ASK-PRENOM.md manually after the authorized single action. ' +
      'Deactivate + mock + LIVE anchor checks are documentation-only here.'
  );
}

module.exports = { PHASE, MISSION, postflightAskPrenomStub };

if (require.main === module) {
  throw new Error(
    `[${MISSION}] Refusing to run postflight-ask-prenom.stub.cjs as main. ` +
      'Not authorized to execute runtime postflight.'
  );
}
