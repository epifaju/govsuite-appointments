'use strict';

/**
 * TEST-INSTALL-READINESS-009 — stub préflight (runtime mirror, non exécutant).
 * Canonique : n8n/proposed/.../install-readiness/preflight-install.stub.cjs
 */

const PHASE = 'FIX008-TEST-INSTALL';
const MISSION = 'TEST-INSTALL-READINESS-009';

function preflightFix008InstallStub() {
  throw new Error(
    `[${MISSION}] preflight-fix008-install.stub.cjs is a non-executing readiness stub for ${PHASE}. ` +
      'See PREFLIGHT-FIX008-INSTALL.md and n8n/proposed/.../install-readiness/PREFLIGHT.md. ' +
      'No Docker/n8n/SQL from this file.'
  );
}

module.exports = { PHASE, MISSION, preflightFix008InstallStub };

if (require.main === module) {
  throw new Error(
    `[${MISSION}] Refusing to run preflight-fix008-install.stub.cjs as main. ` +
      'Not authorized to execute install preflight.'
  );
}
