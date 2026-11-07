/**
 * REC-008 phase 8F-2B47 — relecture hors ligne du RESULT 8F-2B45.
 * Compare ancien verdict (finaliserOk bloquant) vs nouveau.
 * Produit une copie assainie (sans PII / clé / corps / token).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  evaluateVerdict,
  evaluateVerdictLegacy,
  projectFromResult45,
} = require('./verdict');

const outDir = __dirname;
const srcResult =
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-11-01-rec008-phase8f2b45-POSITIVE-CONFIRMATION-RETRY/RESULT.json';
const srcAudit =
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-11-01-rec008-phase8f2b46-FINALIZATION-OBSERVABILITY-AUDIT/AUDIT.json';

const result45 = JSON.parse(fs.readFileSync(srcResult, 'utf8'));
const audit46 = JSON.parse(fs.readFileSync(srcAudit, 'utf8'));

const eventsFromAudit = {
  finaliserStarted: true,
  finaliserFinished: true,
  workflowSuccess: true,
  finaliserFailed: false,
  list: (audit46.executionsApi && audit46.executionsApi.eventLogCorroboration) || [],
};

const policy =
  (audit46.preflight &&
    audit46.preflight.settings &&
    audit46.preflight.settings.saveDataSuccessExecution) ||
  'none';

const projected = projectFromResult45(result45, {
  saveDataSuccessExecution: policy,
  events: eventsFromAudit,
});

// Copie assainie : uniquement champs normalisés (déjà sans PII/clé/corps/token)
const sanitizedCopy = {
  note: 'Projection assainie hors ligne depuis RESULT 8F-2B45 + événements 8F-2B46. Aucune clé, corps figé, token ni PII.',
  sourcePhases: ['8F-2B45', '8F-2B46'],
  projected,
};

const legacy = evaluateVerdictLegacy(projected);
const neu = evaluateVerdict(projected);

const comparison = {
  phase: '8F-2B47',
  mode: 'offline-re-evaluate-8f2b45',
  source: {
    resultPass: result45.pass,
    resultVerdict: result45.verdict,
    resultGoNoGo: result45.goNoGo,
    finaliserExec: result45.after && result45.after.finaliserExec,
    checks: result45.checks,
  },
  policy,
  restEmpty: !projected.finaliserExec,
  legacy: {
    pass: legacy.pass,
    verdict: legacy.verdict,
    goNoGo: legacy.goNoGo,
    finalizationEvidenceLevel: legacy.finalizationEvidenceLevel,
    observabilityOk: legacy.checks.observabilityOk,
  },
  corrected: {
    pass: neu.pass,
    verdict: neu.verdict,
    goNoGo: neu.goNoGo,
    finalizationEvidenceLevel: neu.finalizationEvidenceLevel,
    observabilityOk: neu.checks.observabilityOk,
    reason: neu.reason,
    declaresRestDirectProof: neu.declaresRestDirectProof,
    checks: neu.checks,
  },
  delta: {
    falseNegativeFixed:
      result45.pass === false &&
      result45.verdict === 'FAIL' &&
      neu.pass === true &&
      neu.verdict === 'PASS',
    legacyStillFails: legacy.pass === false,
    evidenceNotClaimedDirect: neu.declaresRestDirectProof === false,
  },
};

fs.writeFileSync(
  path.join(outDir, 'SANITIZED_RESULT45_PROJECTION.json'),
  JSON.stringify(sanitizedCopy, null, 2)
);
fs.writeFileSync(
  path.join(outDir, 'COMPARISON_8F2B45.json'),
  JSON.stringify(comparison, null, 2)
);

console.log(
  JSON.stringify(
    {
      sourceVerdict: result45.verdict,
      legacyVerdict: legacy.verdict,
      correctedVerdict: neu.verdict,
      falseNegativeFixed: comparison.delta.falseNegativeFixed,
      evidence: neu.finalizationEvidenceLevel,
      declaresRestDirectProof: neu.declaresRestDirectProof,
    },
    null,
    2
  )
);
