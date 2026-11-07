/**
 * REC-008 phase 8F-2B47 — logique de verdict finalisation (hors ligne).
 *
 * Sépare les checks métier de l'observabilité REST.
 * L'absence de finaliserExec ne provoque PAS de FAIL automatique lorsque
 * saveDataSuccessExecution === 'none'.
 *
 * Ne déclare jamais une preuve REST directe si /rest/executions est vide.
 */

'use strict';

const FINALISER_NODE = 'Finaliser état création';

/**
 * Ancienne logique 8F-2B45 (pour comparaison hors ligne uniquement).
 * @param {object} input
 */
function evaluateVerdictLegacy(input) {
  const checks = computeCoreChecks(input);
  const finaliserOk =
    !!input.finaliserExec &&
    !!input.finaliserExec.finaliserRan &&
    !input.finaliserExec.finaliserError &&
    !input.finaliserExec.hasParam3Error &&
    !input.finaliserExec.hasUuidConflict &&
    !!checks.sessionOk;

  const pass =
    checks.functionalOk &&
    checks.attemptOk &&
    checks.sessionOk &&
    finaliserOk &&
    checks.postOk &&
    checks.integrityOk &&
    checks.deactivateOk &&
    checks.claimCount === 1;

  const transportFailure = !!input.transportFailure;
  return {
    pass: !!pass,
    verdict: pass ? 'PASS' : transportFailure ? 'UNCERTAIN' : 'FAIL',
    goNoGo: pass ? 'GO' : 'NO-GO',
    checks: { ...checks, finaliserOk, observabilityOk: finaliserOk },
    finalizationEvidenceLevel: input.finaliserExec ? 'direct' : 'none',
    legacy: true,
  };
}

/**
 * @param {object} input — snapshot normalisé (synthétique ou projeté depuis RESULT)
 * @returns {object}
 */
function evaluateVerdict(input) {
  const checks = computeCoreChecks(input);
  const events = normalizeEvents(input.events);
  const policy = normalizePolicy(input.saveDataSuccessExecution);
  const restEmpty = !input.finaliserExec;
  const restDirectOk = isRestFinaliserOk(input.finaliserExec, checks.sessionOk);
  const restDirectFail = isRestFinaliserFail(input.finaliserExec);

  const finaliserEventFail = hasExplicitFinaliserFailure(events);
  const finaliserEventOk =
    events.finaliserStarted && events.finaliserFinished && events.workflowSuccess;

  const finalizationEvidenceLevel = resolveEvidenceLevel({
    restEmpty,
    restDirectOk,
    restDirectFail,
    policy,
    finaliserEventOk,
    finaliserEventFail,
    businessOk: isBusinessOk(checks),
  });

  const observabilityOk = resolveObservabilityOk({
    policy,
    restEmpty,
    restDirectOk,
    restDirectFail,
    finaliserEventOk,
    finaliserEventFail,
    finalizationEvidenceLevel,
  });

  const transportFailure = !!input.transportFailure;
  const finalStateDemonstrated =
    checks.attemptOk && checks.sessionOk && checks.functionalOk && checks.postOk;

  // Transport incertain sans état final démontré → UNCERTAIN
  if (transportFailure && !finalStateDemonstrated) {
    return finish({
      pass: false,
      verdict: 'UNCERTAIN',
      goNoGo: 'NO-GO',
      checks,
      observabilityOk,
      finalizationEvidenceLevel,
      policy,
      restEmpty,
      reason: 'transport_failure_without_final_state',
    });
  }

  // Politique inconnue + REST vide → INCONCLUSIVE (jamais PASS auto)
  if (policy === 'unknown' && restEmpty && !restDirectOk) {
    return finish({
      pass: false,
      verdict: 'INCONCLUSIVE',
      goNoGo: 'NO-GO',
      checks,
      observabilityOk: false,
      finalizationEvidenceLevel:
        finalizationEvidenceLevel === 'direct' ? 'insufficient' : finalizationEvidenceLevel,
      policy,
      restEmpty,
      reason: 'unknown_retention_policy_and_empty_rest',
    });
  }

  // Échec explicite Finaliser (événement ou REST) malgré HTTP 200 → FAIL / INCONCLUSIVE
  if (finaliserEventFail || restDirectFail) {
    const verdict =
      checks.functionalOk && !restDirectFail && finaliserEventFail && !finaliserEventOk
        ? 'INCONCLUSIVE'
        : 'FAIL';
    return finish({
      pass: false,
      verdict,
      goNoGo: 'NO-GO',
      checks,
      observabilityOk: false,
      finalizationEvidenceLevel: 'contradicted',
      policy,
      restEmpty,
      reason: restDirectFail ? 'rest_finaliser_error' : 'event_finaliser_failure',
    });
  }

  const businessPass = isBusinessOk(checks);
  const pass = businessPass && observabilityOk === true;

  if (!businessPass) {
    return finish({
      pass: false,
      verdict: 'FAIL',
      goNoGo: 'NO-GO',
      checks,
      observabilityOk,
      finalizationEvidenceLevel,
      policy,
      restEmpty,
      reason: 'business_checks_failed',
    });
  }

  if (observabilityOk !== true) {
    return finish({
      pass: false,
      verdict: 'INCONCLUSIVE',
      goNoGo: 'NO-GO',
      checks,
      observabilityOk,
      finalizationEvidenceLevel,
      policy,
      restEmpty,
      reason: 'observability_not_satisfied',
    });
  }

  return finish({
    pass: true,
    verdict: 'PASS',
    goNoGo: 'GO',
    checks,
    observabilityOk,
    finalizationEvidenceLevel,
    policy,
    restEmpty,
    reason: 'ok',
  });
}

function computeCoreChecks(input) {
  const expectedRef = input.expectedMockRef || 'SYNTH-REF-0001';
  const expectedApptId = input.expectedMockApptId || 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const fingerprintBefore = input.fingerprintBefore || '';

  const status = Number(input.httpStatus);
  const type = input.responseType || null;
  const success = input.responseSuccess === true;
  const httpOk = status === 200;
  const notHttp500 = status !== 500;
  const notWorkflowError = input.notWorkflowError !== false;

  const functionalOk =
    httpOk &&
    notHttp500 &&
    notWorkflowError &&
    type === 'appointment_created' &&
    success === true &&
    !!input.confirmsAppointment &&
    !!input.showsReference &&
    !input.falseSuccessWithoutFinalize;

  const attempt = input.attempt || {};
  const attemptOk =
    attempt.status === 'CONFIRMED' &&
    !attempt.hasIdempotencyKey &&
    !attempt.hasRequestPayload &&
    !!attempt.hasFingerprint &&
    (!fingerprintBefore || attempt.fingerprintFp12 === fingerprintBefore) &&
    !attempt.hasLeaseOwner &&
    !attempt.hasLeaseUntil &&
    attempt.appointmentReference === expectedRef &&
    attempt.appointmentId === expectedApptId &&
    !!attempt.submittedAt &&
    !!attempt.confirmedAt;

  const session = input.session || {};
  const sessionOk =
    !session.conversation_step &&
    !session.pending_action &&
    !session.intent &&
    !session.nom &&
    !session.prenom &&
    !session.email &&
    !session.telephone &&
    !session.service &&
    !session.site &&
    !session.slot_id &&
    session.reference === expectedRef &&
    !session.token;

  const postDelta = Number(input.postDelta);
  const claimCount = Number(input.claimCount);
  const postOk =
    postDelta === 1 &&
    claimCount === 1 &&
    Number(input.getAvailabilityDelta || 0) === 0 &&
    !input.cancelSeen;

  const integrityOk = input.integrityOk === true;
  const deactivateOk = input.deactivateOk === true;

  return {
    functionalOk: !!functionalOk,
    attemptOk: !!attemptOk,
    sessionOk: !!sessionOk,
    postOk: !!postOk,
    integrityOk: !!integrityOk,
    deactivateOk: !!deactivateOk,
    httpOk: !!httpOk,
    notHttp500: !!notHttp500,
    claimCount,
    postDelta,
  };
}

function isBusinessOk(checks) {
  return (
    checks.functionalOk &&
    checks.attemptOk &&
    checks.sessionOk &&
    checks.postOk &&
    checks.integrityOk &&
    checks.deactivateOk &&
    checks.claimCount === 1 &&
    checks.postDelta === 1
  );
}

function normalizePolicy(p) {
  if (p === 'none' || p === 'all') return p;
  if (p === undefined || p === null || p === '' || p === 'unknown') return 'unknown';
  return 'unknown';
}

function normalizeEvents(events) {
  const e = events || {};
  return {
    finaliserStarted: !!e.finaliserStarted || hasNodeEvent(e, 'started', FINALISER_NODE),
    finaliserFinished: !!e.finaliserFinished || hasNodeEvent(e, 'finished', FINALISER_NODE),
    workflowSuccess: !!e.workflowSuccess,
    finaliserFailed: !!e.finaliserFailed,
    list: Array.isArray(e.list) ? e.list : [],
  };
}

function hasNodeEvent(events, kind, nodeName) {
  const list = Array.isArray(events.list) ? events.list : [];
  const name =
    kind === 'started' ? 'n8n.node.started' : kind === 'finished' ? 'n8n.node.finished' : null;
  if (!name) return false;
  return list.some((x) => x.eventName === name && x.nodeName === nodeName);
}

function hasExplicitFinaliserFailure(events) {
  if (events.finaliserFailed) return true;
  const list = events.list || [];
  return list.some(
    (x) =>
      x.nodeName === FINALISER_NODE &&
      (x.eventName === 'n8n.node.failed' ||
        x.success === false ||
        x.error === true ||
        (typeof x.errorMessage === 'string' && x.errorMessage.length > 0))
  );
}

function isRestFinaliserOk(finaliserExec, sessionOk) {
  return (
    !!finaliserExec &&
    !!finaliserExec.finaliserRan &&
    !finaliserExec.finaliserError &&
    !finaliserExec.hasParam3Error &&
    !finaliserExec.hasUuidConflict &&
    !!sessionOk
  );
}

function isRestFinaliserFail(finaliserExec) {
  if (!finaliserExec) return false;
  return !!(
    finaliserExec.finaliserError ||
    finaliserExec.hasParam3Error ||
    finaliserExec.hasUuidConflict ||
    (finaliserExec.finaliserRan && finaliserExec.workflowError)
  );
}

function resolveEvidenceLevel({
  restEmpty,
  restDirectOk,
  restDirectFail,
  policy,
  finaliserEventOk,
  finaliserEventFail,
  businessOk,
}) {
  if (restDirectFail || finaliserEventFail) return 'contradicted';
  if (!restEmpty && restDirectOk) return 'direct';
  // Jamais « direct » si REST vide
  if (restEmpty && finaliserEventOk && businessOk) return 'event_corroborated';
  if (restEmpty && policy === 'none' && businessOk) return 'indirect_strong';
  if (restEmpty && policy === 'unknown') return 'insufficient';
  if (!businessOk) return 'insufficient';
  return 'insufficient';
}

function resolveObservabilityOk({
  policy,
  restEmpty,
  restDirectOk,
  restDirectFail,
  finaliserEventOk,
  finaliserEventFail,
  finalizationEvidenceLevel,
}) {
  if (restDirectFail || finaliserEventFail) return false;
  if (restDirectOk) return true;
  // Politique none + REST vide : finalisation acceptée via preuve indirecte / événementielle
  if (policy === 'none' && restEmpty) {
    if (
      finalizationEvidenceLevel === 'indirect_strong' ||
      finalizationEvidenceLevel === 'event_corroborated'
    ) {
      return true;
    }
    return false;
  }
  // Politique inconnue + REST vide : jamais OK automatique
  if (policy === 'unknown' && restEmpty) return false;
  // Politique all / autre + REST vide : pas d'observabilité satisfaisante
  if (restEmpty) return false;
  return false;
}

function finish( partial ) {
  const checks = {
    ...partial.checks,
    observabilityOk: partial.observabilityOk,
  };
  return {
    pass: !!partial.pass,
    verdict: partial.verdict,
    goNoGo: partial.goNoGo,
    checks: {
      functionalOk: checks.functionalOk,
      attemptOk: checks.attemptOk,
      sessionOk: checks.sessionOk,
      postOk: checks.postOk,
      integrityOk: checks.integrityOk,
      deactivateOk: checks.deactivateOk,
      observabilityOk: checks.observabilityOk,
      httpOk: checks.httpOk,
      notHttp500: checks.notHttp500,
      claimCount: checks.claimCount,
      postDelta: checks.postDelta,
    },
    finalizationEvidenceLevel: partial.finalizationEvidenceLevel,
    policy: partial.policy,
    restEmpty: !!partial.restEmpty,
    reason: partial.reason,
    declaresRestDirectProof: partial.finalizationEvidenceLevel === 'direct',
  };
}

/**
 * Projette un RESULT.json 8F-2B45 (ou équivalent) vers l'entrée normalisée.
 * Ne conserve aucune clé d'idempotence, corps figé, token ou PII.
 */
function projectFromResult45(result, options = {}) {
  const msg = result.message || {};
  const after = result.after || {};
  const pre = result.preflight || {};
  const checks = result.checks || {};
  const deact = result.deactivate || {};
  const responseJson = msg.responseJson || {};
  const appointment = responseJson.appointment || {};

  const expectedMockRef =
    options.expectedMockRef ||
    (after.attempt && after.attempt.appointmentReference) ||
    'REC008-MOCK-0001';
  const expectedMockApptId =
    options.expectedMockApptId ||
    (after.attempt && after.attempt.appointmentId) ||
    '55555555-5555-4555-8555-555555555555';

  return {
    httpStatus: msg.status,
    responseType: responseJson.type || null,
    responseSuccess: responseJson.success === true,
    confirmsAppointment: checks.confirmsAppointment === true,
    showsReference: checks.showsReference === true,
    falseSuccessWithoutFinalize: checks.falseSuccessWithoutFinalize === true,
    notWorkflowError: checks.notWorkflowError !== false,
    transportFailure: msg.transportFailure || null,
    expectedMockRef,
    expectedMockApptId,
    fingerprintBefore: msg.fingerprintBefore || '',
    attempt: {
      status: after.attempt && after.attempt.status,
      hasIdempotencyKey: !!(after.attempt && after.attempt.hasIdempotencyKey),
      hasRequestPayload: !!(after.attempt && after.attempt.hasRequestPayload),
      hasFingerprint: !!(after.attempt && after.attempt.hasFingerprint),
      fingerprintFp12: (after.attempt && after.attempt.fingerprintFp12) || '',
      hasLeaseOwner: !!(after.attempt && after.attempt.hasLeaseOwner),
      hasLeaseUntil: !!(after.attempt && after.attempt.hasLeaseUntil),
      appointmentReference: (after.attempt && after.attempt.appointmentReference) || '',
      appointmentId: (after.attempt && after.attempt.appointmentId) || '',
      submittedAt: (after.attempt && after.attempt.submittedAt) || '',
      confirmedAt: (after.attempt && after.attempt.confirmedAt) || '',
    },
    session: {
      conversation_step: (after.target && after.target.conversation_step) || '',
      pending_action: (after.target && after.target.pending_action) || '',
      intent: (after.target && after.target.intent) || '',
      // Présence seule (jamais la valeur réelle) pour sessionOk sans PII
      nom: after.target && after.target.nom ? '[PRESENT]' : '',
      prenom: after.target && after.target.prenom ? '[PRESENT]' : '',
      email: after.target && after.target.email ? '[PRESENT]' : '',
      telephone: after.target && after.target.telephone ? '[PRESENT]' : '',
      service: (after.target && after.target.service) || '',
      site: (after.target && after.target.site) || '',
      slot_id: (after.target && after.target.slot_id) || '',
      reference: (after.target && after.target.reference) || '',
      token: after.target && after.target.token ? '[PRESENT]' : '',
    },
    postDelta: msg.postDelta,
    claimCount: checks.claimCount,
    getAvailabilityDelta: msg.getAvailabilityDelta || 0,
    cancelSeen: !!msg.cancelSeen,
    integrityOk: checks.integrityOk === true,
    deactivateOk: checks.deactivateOk === true,
    finaliserExec: after.finaliserExec || null,
    saveDataSuccessExecution:
      options.saveDataSuccessExecution !== undefined
        ? options.saveDataSuccessExecution
        : 'none',
    events: options.events || null,
    // métadonnées non sensibles pour traçabilité
    meta: {
      phase: result.phase,
      sessionId: result.sessionId,
      deactivateActive: deact.active === false,
      preflightPg: pre.pg,
      afterPg: after.pg,
    },
  };
}

module.exports = {
  evaluateVerdict,
  evaluateVerdictLegacy,
  projectFromResult45,
  computeCoreChecks,
  FINALISER_NODE,
};
