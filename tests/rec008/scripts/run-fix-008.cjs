'use strict';

/**
 * Suite offline EXPLICIT-RESUME-FIX-008.
 * Exécute le jsCode du candidat — pas d'activation n8n / SQL / LIVE.
 */

const fs = require('fs');
const path = require('path');
const { installOfflineGuards, getViolations } = require('../lib/security-guard.cjs');
const { runAllFix008 } = require('../lib/assertions/fix-008-explicit-resume.cjs');
const { VERDICTS } = require('../lib/verdicts.cjs');
const { REC008_ROOT } = require('../lib/load-json.cjs');

installOfflineGuards();

const started = Date.now();
let suite;
try {
  suite = runAllFix008();
} catch (err) {
  suite = {
    verdict: VERDICTS.ERROR,
    error: err.message,
    results: [],
    failedIds: ['bootstrap']
  };
}

const report = {
  suite: 'explicit-resume-fix-008',
  at: new Date().toISOString(),
  durationMs: Date.now() - started,
  verdict: suite.verdict,
  candidateSha256: suite.candidateSha256,
  expectedCandidateSha256: suite.expectedCandidateSha256,
  originalSha256: suite.originalSha256,
  failedIds: suite.failedIds || [],
  counts: (suite.results || []).reduce(
    (acc, r) => {
      acc[r.verdict] = (acc[r.verdict] || 0) + 1;
      return acc;
    },
    {}
  ),
  results: (suite.results || []).map((r) => ({
    id: r.id,
    verdict: r.verdict,
    reason: r.reason,
    assertionFails: (r.assertions || [])
      .filter((a) => a.verdict === VERDICTS.FAIL)
      .map((a) => a.id),
    observed: r.observed
  })),
  securityViolations: getViolations(),
  notes: [
    'simulation:true — PASS technique offline ≠ PASS runtime',
    'Candidat non installé TEST',
    'Workflow VC9 original inchangé'
  ]
};

const reportsDir = path.join(REC008_ROOT, 'reports');
fs.mkdirSync(reportsDir, { recursive: true });
const stamp = report.at.replace(/[:.]/g, '-');
const jsonPath = path.join(reportsDir, 'fix-008-' + stamp + '.json');
const mdPath = path.join(reportsDir, 'fix-008-' + stamp + '.md');
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

const lines = [
  '# EXPLICIT-RESUME-FIX-008 — rapport offline',
  '',
  'Verdict: **' + report.verdict + '**',
  '',
  '- Candidate SHA: `' + report.candidateSha256 + '`',
  '- Expected: `' + report.expectedCandidateSha256 + '`',
  '- Original VC9: `' + report.originalSha256 + '`',
  '- Counts: ' + JSON.stringify(report.counts),
  '',
  '| ID | Verdict | Reason |',
  '| --- | --- | --- |'
];
for (const r of report.results) {
  lines.push('| ' + r.id + ' | ' + r.verdict + ' | ' + String(r.reason || '').replace(/\|/g, '/') + ' |');
}
fs.writeFileSync(mdPath, lines.join('\n') + '\n');

process.stdout.write(
  JSON.stringify(
    {
      verdict: report.verdict,
      counts: report.counts,
      failedIds: report.failedIds,
      jsonPath,
      mdPath,
      candidateSha256: report.candidateSha256
    },
    null,
    2
  ) + '\n'
);
process.exitCode = report.verdict === VERDICTS.PASS ? 0 : 1;
