'use strict';

/**
 * Lanceur offline REC-008 (TEST-RUNNER-003).
 * Aucune activation n8n, aucun webhook, aucun SQL réel, aucun LIVE.
 */

const path = require('path');
const {
  listScenarioFiles,
  loadScenario,
  evaluateScenarioDescriptor,
  createVc9Context,
  REC008_ROOT,
  VERDICTS
} = require('../lib/offline-runner.cjs');
const { buildSuiteReport, writeReports } = require('../lib/report.cjs');
const { installOfflineGuards, getViolations } = require('../lib/security-guard.cjs');
const { isBlockingFailure } = require('../lib/verdicts.cjs');

installOfflineGuards();

const scenariosRoot = path.join(REC008_ROOT, 'scenarios');
const reportsDir = path.join(REC008_ROOT, 'reports');

let ctx;
try {
  ctx = createVc9Context();
} catch (err) {
  const report = buildSuiteReport({
    suite: 'rec008-offline-vc9',
    summary: 'Échec chargement VC9: ' + err.message,
    results: [
      {
        id: 'bootstrap.vc9',
        verdict: VERDICTS.ERROR,
        reason: err.message,
        durationMs: 0,
        assertions: [],
        nodes: []
      }
    ],
    failOnNotImplemented: true,
    notes: ['VC9 after- JSON requis sous n8n/proposed/...P4F.../after-OCD9It1uKFhOoWNF.json']
  });
  const paths = writeReports(reportsDir, report);
  process.stdout.write(JSON.stringify({ verdict: report.verdict, paths }, null, 2) + '\n');
  process.exitCode = 1;
  process.exit();
}

const files = listScenarioFiles(scenariosRoot).sort();
const results = [];

for (const file of files) {
  const loaded = loadScenario(file);
  if (!loaded.ok) {
    results.push(loaded.result);
    continue;
  }
  results.push(evaluateScenarioDescriptor(loaded.descriptor, ctx));
}

let requiredMissing = 0;
for (const file of files) {
  const loaded = loadScenario(file);
  if (!loaded.ok) continue;
  const d = loaded.descriptor;
  if (!d.required) continue;
  const res = results.find((r) => r.id === d.id);
  if (
    res &&
    (res.verdict === VERDICTS.NOT_IMPLEMENTED || res.verdict === VERDICTS.SKIPPED)
  ) {
    requiredMissing += 1;
  }
}

const report = buildSuiteReport({
  suite: 'rec008-offline-vc9',
  workflowMeta: ctx.meta,
  summary:
    'Suite offline VC9. PASS uniquement sur assertions exécutées. skeletonOnly → NOT_IMPLEMENTED.',
  results,
  requiredNotImplemented: requiredMissing,
  notes: [
    'Simulations VM jsCode + contrats SQL statiques / merge simulé.',
    'Ne prouve pas à elle seule le runtime n8n ou PostgreSQL.',
    'Guards: fetch/http/pg module blocked; write allowlist reports/tmp.',
    'Violations sécurité: ' + getViolations().length
  ],
  security: {
    guardsInstalled: true,
    violations: getViolations(),
    declarativeOnly: [
      'Allowlist path agents Cursor',
      'Interdiction LIVE agents (rules)',
      'Absence d’activation n8n (process)'
    ]
  }
});

const paths = writeReports(reportsDir, report);
const summary = {
  verdict: report.verdict,
  counts: report.counts,
  countablePass: report.countablePass,
  requiredMissing,
  jsonPath: paths.jsonPath,
  mdPath: paths.mdPath,
  workflowSha256: ctx.meta.sha256,
  versionId: ctx.meta.versionId
};
process.stdout.write(JSON.stringify(summary, null, 2) + '\n');

const hasBlock = results.some((r) => isBlockingFailure(r.verdict));
if (hasBlock || requiredMissing > 0 || report.verdict === VERDICTS.FAIL) {
  process.exitCode = 1;
}
