/**
 * REC-008 phase 8F-2B47 — tests unitaires hors ligne du verdict.
 * Aucune requête métier, aucune activation, aucun webhook.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { evaluateVerdict } = require('./verdict');
const { baseSuccess } = require('./fixtures/base-success');

const outDir = __dirname;

const cases = [
  {
    id: 1,
    name: 'Succès métier + REST vide + politique none → PASS',
    input: baseSuccess({
      finaliserExec: null,
      saveDataSuccessExecution: 'none',
    }),
    expect: { verdict: 'PASS', pass: true },
  },
  {
    id: 2,
    name: 'Succès métier + exécution REST disponible → PASS',
    input: baseSuccess({
      finaliserExec: {
        finaliserRan: true,
        finaliserError: null,
        hasParam3Error: false,
        hasUuidConflict: false,
        workflowError: null,
      },
      saveDataSuccessExecution: 'all',
      events: null,
    }),
    expect: { verdict: 'PASS', pass: true, evidence: 'direct' },
  },
  {
    id: 3,
    name: 'HTTP 500 → FAIL',
    input: baseSuccess({
      httpStatus: 500,
      responseType: 'appointment_created',
      responseSuccess: false,
      confirmsAppointment: false,
      showsReference: false,
    }),
    expect: { verdict: 'FAIL', pass: false },
  },
  {
    id: 4,
    name: 'Tentative non CONFIRMED → FAIL',
    input: baseSuccess({
      attempt: { status: 'AWAITING_CONFIRMATION', submittedAt: '', confirmedAt: '' },
      claimCount: 0,
    }),
    expect: { verdict: 'FAIL', pass: false },
  },
  {
    id: 5,
    name: 'Session non nettoyée → FAIL',
    input: baseSuccess({
      session: {
        conversation_step: 'AWAIT_CREATE_CONFIRMATION',
        pending_action: 'CREATE_APPOINTMENT',
        intent: 'CREATE_APPOINTMENT',
      },
    }),
    expect: { verdict: 'FAIL', pass: false },
  },
  {
    id: 6,
    name: 'Référence incohérente → FAIL',
    input: baseSuccess({
      attempt: { appointmentReference: 'SYNTH-OTHER' },
      session: { reference: 'SYNTH-OTHER' },
      showsReference: false,
    }),
    expect: { verdict: 'FAIL', pass: false },
  },
  {
    id: 7,
    name: 'Mock POST delta 0 → FAIL',
    input: baseSuccess({ postDelta: 0, claimCount: 0 }),
    expect: { verdict: 'FAIL', pass: false },
  },
  {
    id: 8,
    name: 'Mock POST delta > 1 → FAIL',
    input: baseSuccess({ postDelta: 2, claimCount: 1 }),
    expect: { verdict: 'FAIL', pass: false },
  },
  {
    id: 9,
    name: 'CLAIM supérieur à 1 → FAIL',
    input: baseSuccess({ claimCount: 2, postDelta: 1 }),
    expect: { verdict: 'FAIL', pass: false },
  },
  {
    id: 10,
    name: 'Transport incertain sans état final → UNCERTAIN',
    input: baseSuccess({
      transportFailure: {
        name: 'TypeError',
        message: 'fetch failed',
        cause: { code: 'ECONNRESET' },
      },
      httpStatus: 0,
      responseType: null,
      responseSuccess: false,
      confirmsAppointment: false,
      showsReference: false,
      attempt: {
        status: 'AWAITING_CONFIRMATION',
        submittedAt: '',
        confirmedAt: '',
        appointmentReference: '',
        appointmentId: '',
      },
      session: {
        conversation_step: 'AWAIT_CREATE_CONFIRMATION',
        pending_action: 'CREATE_APPOINTMENT',
        intent: 'CREATE_APPOINTMENT',
        reference: '',
      },
      postDelta: 0,
      claimCount: 0,
      integrityOk: true,
      deactivateOk: true,
    }),
    expect: { verdict: 'UNCERTAIN', pass: false },
  },
  {
    id: 11,
    name: 'Workflow encore actif après test → FAIL',
    input: baseSuccess({ deactivateOk: false }),
    expect: { verdict: 'FAIL', pass: false },
  },
  {
    id: 12,
    name: 'Intégrité LIVE modifiée → FAIL',
    input: baseSuccess({ integrityOk: false }),
    expect: { verdict: 'FAIL', pass: false },
  },
  {
    id: 13,
    name: 'Politique inconnue + REST vide → INCONCLUSIVE',
    input: baseSuccess({
      finaliserExec: null,
      saveDataSuccessExecution: 'unknown',
      events: null,
    }),
    expect: { verdict: 'INCONCLUSIVE', pass: false, neverPass: true },
  },
  {
    id: 14,
    name: 'Événement échec Finaliser malgré HTTP 200 → FAIL/INCONCLUSIVE',
    input: baseSuccess({
      httpStatus: 200,
      responseType: 'appointment_created',
      responseSuccess: true,
      finaliserExec: null,
      saveDataSuccessExecution: 'none',
      events: {
        finaliserStarted: true,
        finaliserFinished: false,
        workflowSuccess: false,
        finaliserFailed: true,
        list: [
          {
            eventName: 'n8n.node.started',
            nodeName: 'Finaliser état création',
          },
          {
            eventName: 'n8n.node.failed',
            nodeName: 'Finaliser état création',
            error: true,
            errorMessage: 'synthetic finaliser failure',
          },
        ],
      },
    }),
    expect: { verdictIn: ['FAIL', 'INCONCLUSIVE'], pass: false, neverPass: true },
  },
];

function runCase(c) {
  const result = evaluateVerdict(c.input);
  const okVerdict = c.expect.verdictIn
    ? c.expect.verdictIn.includes(result.verdict)
    : result.verdict === c.expect.verdict;
  const okPass = result.pass === c.expect.pass;
  const okNeverPass = c.expect.neverPass ? result.pass === false && result.verdict !== 'PASS' : true;
  const okEvidence = c.expect.evidence
    ? result.finalizationEvidenceLevel === c.expect.evidence
    : true;
  // Jamais preuve REST directe si REST vide
  const okNoFalseDirect =
    !c.input.finaliserExec ? result.declaresRestDirectProof !== true : true;

  const pass = okVerdict && okPass && okNeverPass && okEvidence && okNoFalseDirect;
  return {
    id: c.id,
    name: c.name,
    pass,
    expected: c.expect,
    actual: {
      verdict: result.verdict,
      pass: result.pass,
      goNoGo: result.goNoGo,
      finalizationEvidenceLevel: result.finalizationEvidenceLevel,
      observabilityOk: result.checks.observabilityOk,
      reason: result.reason,
      declaresRestDirectProof: result.declaresRestDirectProof,
      checks: result.checks,
    },
  };
}

const results = cases.map(runCase);
const allPass = results.every((r) => r.pass);
const summary = {
  phase: '8F-2B47',
  mode: 'offline-unit',
  total: results.length,
  passed: results.filter((r) => r.pass).length,
  failed: results.filter((r) => !r.pass).length,
  allPass,
  results,
};

fs.writeFileSync(path.join(outDir, 'UNIT_TEST_RESULTS.json'), JSON.stringify(summary, null, 2));
console.log(
  JSON.stringify(
    {
      allPass,
      passed: summary.passed,
      failed: summary.failed,
      total: summary.total,
      lines: results.map((r) => ({
        id: r.id,
        pass: r.pass,
        verdict: r.actual.verdict,
        evidence: r.actual.finalizationEvidenceLevel,
      })),
    },
    null,
    2
  )
);
process.exit(allPass ? 0 : 1);
