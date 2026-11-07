'use strict';

const fs = require('fs');
const path = require('path');
const { assertAllowedWrite } = require('./security-guard.cjs');
const { VERDICTS, isCountablePass, isBlockingFailure } = require('./verdicts.cjs');

function buildSuiteReport(input) {
  const results = input.results || [];
  const counts = {
    PASS: 0,
    FAIL: 0,
    ERROR: 0,
    INCONCLUSIVE: 0,
    NOT_IMPLEMENTED: 0,
    SKIPPED: 0
  };
  for (const r of results) {
    const v = r.verdict || VERDICTS.INCONCLUSIVE;
    if (counts[v] === undefined) counts[v] = 0;
    counts[v] += 1;
  }

  let suiteVerdict = VERDICTS.PASS;
  const requiredMissing = input.requiredNotImplemented || 0;
  if (counts.FAIL || counts.ERROR) suiteVerdict = VERDICTS.FAIL;
  else if (requiredMissing > 0) {
    // Scénarios obligatoires non branchés → FAIL (exit non nul côté lanceur)
    suiteVerdict = VERDICTS.FAIL;
  } else if (counts.INCONCLUSIVE > 0) {
    suiteVerdict = VERDICTS.INCONCLUSIVE;
  }
  // NOT_IMPLEMENTED optionnels (hors périmètre) ne dégradent pas un PASS
  // tant que requiredMissing === 0 et aucun FAIL/ERROR.

  return {
    suite: input.suite || 'rec008-offline',
    generatedAt: new Date().toISOString(),
    env: 'TEST',
    liveTouched: false,
    mode: 'offline',
    workflow: input.workflowMeta || null,
    counts,
    countablePass: results.filter((r) => isCountablePass(r.verdict)).length,
    blockingFailures: results.filter((r) => isBlockingFailure(r.verdict)).length,
    verdict: suiteVerdict,
    summary: input.summary || '',
    results,
    notes: input.notes || [],
    security: input.security || { guardsInstalled: true, declarativeOnly: [] }
  };
}

function writeReports(reportsDir, report) {
  assertAllowedWrite(reportsDir);
  fs.mkdirSync(reportsDir, { recursive: true });
  const stamp = report.generatedAt.replace(/[:.]/g, '-');
  const jsonPath = path.join(reportsDir, 'report-' + stamp + '.json');
  const mdPath = path.join(reportsDir, 'report-' + stamp + '.md');
  assertAllowedWrite(jsonPath);
  assertAllowedWrite(mdPath);

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');

  const lines = [
    '# Rapport REC-008 offline',
    '',
    '- Généré : ' + report.generatedAt,
    '- Mode : ' + report.mode,
    '- Environnement : ' + report.env,
    '- LIVE touché : ' + String(report.liveTouched),
    '- Verdict suite : **' + report.verdict + '**',
    ''
  ];
  if (report.workflow) {
    lines.push(
      '## Workflow',
      '',
      '- Label : ' + report.workflow.label,
      '- versionId : `' + report.workflow.versionId + '`',
      '- SHA256 : `' + report.workflow.sha256 + '`',
      '- Path : `' + report.workflow.path + '`',
      ''
    );
  }
  lines.push('## Compteurs', '');
  for (const [k, v] of Object.entries(report.counts)) {
    lines.push('- ' + k + ' : ' + v);
  }
  lines.push('', report.summary || '', '', '## Résultats', '');
  for (const item of report.results) {
    lines.push(
      '### `' +
        item.id +
        '` → **' +
        item.verdict +
        '** (' +
        (item.durationMs || 0) +
        ' ms)'
    );
    if (item.reason) lines.push('- Motif : ' + item.reason);
    if (item.nodes && item.nodes.length) {
      lines.push('- Nœuds : ' + item.nodes.join(', '));
    }
    if (item.assertions && item.assertions.length) {
      lines.push('- Assertions :');
      for (const a of item.assertions) {
        lines.push(
          '  - `' +
            a.id +
            '` ' +
            a.verdict +
            ' — attendu=`' +
            String(a.expected).slice(0, 80) +
            '` observé=`' +
            String(a.observed).slice(0, 80) +
            '`'
        );
      }
    }
    lines.push('');
  }
  if (report.notes && report.notes.length) {
    lines.push('## Notes', '');
    for (const n of report.notes) lines.push('- ' + n);
  }

  fs.writeFileSync(mdPath, lines.join('\n') + '\n', 'utf8');
  return { jsonPath, mdPath };
}

module.exports = {
  buildSuiteReport,
  writeReports
};
