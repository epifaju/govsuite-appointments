'use strict';

/**
 * TEST-INSTALL-READINESS-009 — stub rollback install FIX-008 (non exécutant).
 * Ne contient aucun appel Docker / n8n / SQL / fetch.
 * Procédure : ./BACKUP-SHA-ROLLBACK.md — STOP : ./STOP-CONDITIONS.md
 */

const PHASE = 'FIX008-TEST-INSTALL';
const MISSION = 'TEST-INSTALL-READINESS-009';
const WORKFLOW_ID = 'OCD9It1uKFhOoWNF';
const ROLLBACK_SHA256 =
  '6284f867054879d00292b45b5a8560f25dc778a56979ea354b18af2f5f82b889';

function rollbackStub() {
  throw new Error(
    `[${MISSION}] rollback.stub.cjs is a non-executing readiness stub for ${PHASE}. ` +
      `Would restore workflow ${WORKFLOW_ID} toward SHA ${ROLLBACK_SHA256.slice(0, 8)}… ` +
      'but refuses to PUT. Use BACKUP-SHA-ROLLBACK.md only after an explicit rollback order. ' +
      'No Docker/n8n/SQL from this file.'
  );
}

module.exports = {
  PHASE,
  MISSION,
  WORKFLOW_ID,
  ROLLBACK_SHA256,
  rollbackStub,
};

if (require.main === module) {
  throw new Error(
    `[${MISSION}] Refusing to run rollback.stub.cjs as main. ` +
      'Not authorized to execute TEST workflow rollback.'
  );
}
