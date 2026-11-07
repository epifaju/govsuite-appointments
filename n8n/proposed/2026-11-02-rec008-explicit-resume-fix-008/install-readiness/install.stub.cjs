'use strict';

/**
 * TEST-INSTALL-READINESS-009 — stub PUT install FIX-008 (non exécutant).
 * Ne contient aucun appel Docker / n8n / SQL / fetch.
 * Procédure : ./INSTALL-CHECKLIST.md — STOP : ./STOP-CONDITIONS.md
 */

const PHASE = 'FIX008-TEST-INSTALL';
const MISSION = 'TEST-INSTALL-READINESS-009';
const WORKFLOW_ID = 'OCD9It1uKFhOoWNF';
const CANDIDATE_SHA256 =
  '849201ddd7cb17c158de292ed5479bfd024d83ac89b9a1f135b9422ae973618c';

function installStub() {
  throw new Error(
    `[${MISSION}] install.stub.cjs is a non-executing readiness stub for ${PHASE}. ` +
      `Would target workflow ${WORKFLOW_ID} with candidate SHA ${CANDIDATE_SHA256.slice(0, 8)}… ` +
      'but refuses to PUT/activate. Follow INSTALL-CHECKLIST.md only after explicit authorization. ' +
      'No Docker/n8n/SQL from this file.'
  );
}

module.exports = {
  PHASE,
  MISSION,
  WORKFLOW_ID,
  CANDIDATE_SHA256,
  installStub,
};

if (require.main === module) {
  throw new Error(
    `[${MISSION}] Refusing to run install.stub.cjs as main. ` +
      'Not authorized to execute TEST workflow install.'
  );
}
