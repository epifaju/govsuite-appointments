'use strict';
/** READINESS-009 — stub non exécutant. */
const MISSION = 'TEST-INSTALL-READINESS-009';
function installFix008Stub() {
  throw new Error(
    '[' +
      MISSION +
      '] install-fix008.stub.cjs refuses execution. Use INSTALL-PLAN.md only after explicit human authorization.'
  );
}
module.exports = { MISSION, installFix008Stub };
if (require.main === module) {
  installFix008Stub();
}
