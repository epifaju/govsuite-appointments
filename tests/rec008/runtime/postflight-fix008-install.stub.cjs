'use strict';

/**
 * TEST-INSTALL-READINESS-009 — stub postflight (runtime mirror, non exécutant).
 * Canonique : n8n/proposed/.../install-readiness/postflight-install.stub.cjs
 */

const PHASE = 'FIX008-TEST-INSTALL';
const MISSION = 'TEST-INSTALL-READINESS-009';

function postflightFix008InstallStub() {
  throw new Error(
    `[${MISSION}] postflight-fix008-install.stub.cjs is a non-executing readiness stub for ${PHASE}. ` +
      'See POSTFLIGHT-FIX008-INSTALL.md. No Docker/n8n/SQL from this file.'
  );
}

module.exports = { PHASE, MISSION, postflightFix008InstallStub };

if (require.main === module) {
  throw new Error(
    `[${MISSION}] Refusing to run postflight-fix008-install.stub.cjs as main. ` +
      'Not authorized to execute install postflight.'
  );
}
