'use strict';

/**
 * READINESS-005 — stub postflight P4G2 (non exécutant).
 * Ne contient aucun appel Docker / n8n / SQL / fetch.
 * Checklist : ./POSTFLIGHT-P4G2.md — STOP : ./STOP-CONDITIONS.md
 */

const PHASE = '8F-2B49-P4G2';
const MISSION = 'READINESS-005';

function postflightP4G2Stub() {
  throw new Error(
    `[${MISSION}] postflight-p4g2.stub.cjs is a non-executing readiness stub for ${PHASE}. ` +
      'Use POSTFLIGHT-P4G2.md manually after the authorized single action. No Docker/n8n/SQL from this file.'
  );
}

module.exports = { PHASE, MISSION, postflightP4G2Stub };

if (require.main === module) {
  throw new Error(
    `[${MISSION}] Refusing to run postflight-p4g2.stub.cjs as main. Not authorized to execute runtime postflight.`
  );
}
