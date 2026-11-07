'use strict';

/**
 * ASK-PRENOM-READINESS-007 — stub préflight campagne ASK_PRENOM S01–S03 (non exécutant).
 * Ne contient aucun appel Docker / n8n / SQL / fetch.
 * Checklist : ./PREFLIGHT-ASK-PRENOM.md — STOP : ./STOP-CONDITIONS-ASK-PRENOM.md
 */

const PHASE = 'ASK_PRENOM-S01-S03';
const MISSION = 'ASK-PRENOM-READINESS-007';

function preflightAskPrenomStub(/* scenarioId */) {
  throw new Error(
    `[${MISSION}] preflight-ask-prenom.stub.cjs is a non-executing readiness stub for ${PHASE}. ` +
      'Use PREFLIGHT-ASK-PRENOM.md manually after explicit human authorization (one S0x). ' +
      'No Docker/n8n/SQL from this file.'
  );
}

module.exports = { PHASE, MISSION, preflightAskPrenomStub };

if (require.main === module) {
  throw new Error(
    `[${MISSION}] Refusing to run preflight-ask-prenom.stub.cjs as main. ` +
      'Not authorized to execute runtime preflight.'
  );
}
