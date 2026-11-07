'use strict';

/**
 * TEST-INSTALL-READINESS-009 — stub install PUT (runtime mirror, non exécutant).
 * Canonique : n8n/proposed/.../install-readiness/install.stub.cjs
 */

const PHASE = 'FIX008-TEST-INSTALL';
const MISSION = 'TEST-INSTALL-READINESS-009';
const WORKFLOW_ID = 'OCD9It1uKFhOoWNF';
const CANDIDATE_SHA256 =
  '849201ddd7cb17c158de292ed5479bfd024d83ac89b9a1f135b9422ae973618c';

function installFix008Stub() {
  throw new Error(
    `[${MISSION}] install-fix008.stub.cjs is a non-executing readiness stub for ${PHASE} ` +
      `(${WORKFLOW_ID}, candidate ${CANDIDATE_SHA256.slice(0, 8)}…). Refuses PUT/activate.`
  );
}

module.exports = {
  PHASE,
  MISSION,
  WORKFLOW_ID,
  CANDIDATE_SHA256,
  installFix008Stub,
};

if (require.main === module) {
  throw new Error(
    `[${MISSION}] Refusing to run install-fix008.stub.cjs as main. ` +
      'Not authorized to execute TEST workflow install.'
  );
}
