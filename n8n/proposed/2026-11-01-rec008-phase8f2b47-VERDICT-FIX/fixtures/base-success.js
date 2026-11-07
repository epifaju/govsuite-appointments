/**
 * Fixture synthétique de succès métier complet.
 * Aucune clé d'idempotence, aucun corps figé, aucun token, aucune PII réelle.
 */
'use strict';

const SYNTH_REF = 'SYNTH-REF-0001';
const SYNTH_APPT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SYNTH_FP = 'abc123def456';

function baseSuccess(overrides = {}) {
  const base = {
    httpStatus: 200,
    responseType: 'appointment_created',
    responseSuccess: true,
    confirmsAppointment: true,
    showsReference: true,
    falseSuccessWithoutFinalize: false,
    notWorkflowError: true,
    transportFailure: null,
    expectedMockRef: SYNTH_REF,
    expectedMockApptId: SYNTH_APPT,
    fingerprintBefore: SYNTH_FP,
    attempt: {
      status: 'CONFIRMED',
      hasIdempotencyKey: false,
      hasRequestPayload: false,
      hasFingerprint: true,
      fingerprintFp12: SYNTH_FP,
      hasLeaseOwner: false,
      hasLeaseUntil: false,
      appointmentReference: SYNTH_REF,
      appointmentId: SYNTH_APPT,
      submittedAt: '2026-01-01 12:00:00+01',
      confirmedAt: '2026-01-01 12:00:01+01',
    },
    session: {
      conversation_step: '',
      pending_action: '',
      intent: '',
      nom: '',
      prenom: '',
      email: '',
      telephone: '',
      service: '',
      site: '',
      slot_id: '',
      reference: SYNTH_REF,
      token: '',
    },
    postDelta: 1,
    claimCount: 1,
    getAvailabilityDelta: 0,
    cancelSeen: false,
    integrityOk: true,
    deactivateOk: true,
    finaliserExec: null,
    saveDataSuccessExecution: 'none',
    events: {
      finaliserStarted: true,
      finaliserFinished: true,
      workflowSuccess: true,
      finaliserFailed: false,
      list: [
        {
          eventName: 'n8n.node.started',
          nodeName: 'Finaliser état création',
        },
        {
          eventName: 'n8n.node.finished',
          nodeName: 'Finaliser état création',
        },
        {
          eventName: 'n8n.workflow.success',
          success: true,
        },
      ],
    },
  };
  return deepMerge(base, overrides);
}

function deepMerge(a, b) {
  if (!b) return a;
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object') {
      out[k] = deepMerge(a[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

module.exports = { baseSuccess, SYNTH_REF, SYNTH_APPT, SYNTH_FP, deepMerge };
