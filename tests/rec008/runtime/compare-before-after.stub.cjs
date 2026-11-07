'use strict';

/**
 * Stub comparaison avant/après — READINESS-005 (aucune I/O).
 */

function compareSnapshots(/* before, after, expectations */) {
  throw new Error(
    '[READINESS-005] compare-before-after.stub.cjs is non-executing. ' +
      'Implement under authorized runtime mission only.'
  );
}

module.exports = { compareSnapshots };

if (require.main === module) {
  throw new Error('[READINESS-005] Refusing to run compare-before-after.stub.cjs as main.');
}
