'use strict';

/**
 * TEST-INSTALL-READINESS-009 — stub préflight install FIX-008 (non exécutant).
 * Ne contient aucun appel Docker / n8n / SQL / fetch.
 * Checklist : ./PREFLIGHT.md — STOP : ./STOP-CONDITIONS.md
 */

const PHASE = 'FIX008-TEST-INSTALL';
const MISSION = 'TEST-INSTALL-READINESS-009';
const WORKFLOW_ID = 'OCD9It1uKFhOoWNF';
const CANDIDATE_SHA256 =
  '849201ddd7cb17c158de292ed5479bfd024d83ac89b9a1f135b9422ae973618c';

function preflightInstallStub() {
  throw new Error(
    `[${MISSION}] preflight-install.stub.cjs is a non-executing readiness stub for ${PHASE} ` +
      `(workflow ${WORKFLOW_ID}, candidate ${CANDIDATE_SHA256.slice(0, 8)}…). ` +
      'Use PREFLIGHT.md / INSTALL-CHECKLIST.md manually after explicit human authorization. ' +
      'No Docker/n8n/SQL from this file.'
  );
}

module.exports = {
  PHASE,
  MISSION,
  WORKFLOW_ID,
  CANDIDATE_SHA256,
  preflightInstallStub,
};

if (require.main === module) {
  throw new Error(
    `[${MISSION}] Refusing to run preflight-install.stub.cjs as main. ` +
      'Not authorized to execute install preflight.'
  );
}
