'use strict';

/**
 * TEST-INSTALL-READINESS-009 — stub postflight install FIX-008 (non exécutant).
 * Ne contient aucun appel Docker / n8n / SQL / fetch.
 * Checklist : ./POSTFLIGHT.md — STOP : ./STOP-CONDITIONS.md
 */

const PHASE = 'FIX008-TEST-INSTALL';
const MISSION = 'TEST-INSTALL-READINESS-009';
const WORKFLOW_ID = 'OCD9It1uKFhOoWNF';

function postflightInstallStub() {
  throw new Error(
    `[${MISSION}] postflight-install.stub.cjs is a non-executing readiness stub for ${PHASE} ` +
      `(workflow ${WORKFLOW_ID}). ` +
      'Use POSTFLIGHT.md manually after an authorized single PUT. ' +
      'Inactive + SHA + mock/LIVE anchor checks are documentation-only here.'
  );
}

module.exports = { PHASE, MISSION, WORKFLOW_ID, postflightInstallStub };

if (require.main === module) {
  throw new Error(
    `[${MISSION}] Refusing to run postflight-install.stub.cjs as main. ` +
      'Not authorized to execute install postflight.'
  );
}
