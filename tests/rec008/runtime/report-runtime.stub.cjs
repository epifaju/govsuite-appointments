'use strict';

/**
 * Stub rapports runtime JSON/Markdown — READINESS-005.
 */

function writeRuntimeReport(/* report */) {
  throw new Error(
    '[READINESS-005] report-runtime.stub.cjs: report writer not authorized in readiness mission.'
  );
}

module.exports = { writeRuntimeReport };

if (require.main === module) {
  throw new Error('[READINESS-005] Refusing to run report-runtime.stub.cjs as main.');
}
