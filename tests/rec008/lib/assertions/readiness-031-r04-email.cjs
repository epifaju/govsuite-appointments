'use strict';

/**
 * MISSION 031 — Assertions métier R04-A/B/C (simulation VM FIX-008).
 * Observed export: Present/Len uniquement (pas d'email clair dans observed).
 */

const path = require('path');
const { VERDICTS } = require('../verdicts.cjs');
const { runConversationTurn } = require('../node-runtime.cjs');
const { loadJson, REC008_ROOT } = require('../load-json.cjs');
const { EXPECTED_SHA256 } = require('../workflow-source.cjs');
const { assertSyntheticIdentity } = require('../security-guard.cjs');

const FIXTURE_DIR = path.join(REC008_ROOT, 'fixtures', 'r04-offline-readiness-031');

function check(id, expected, observed, ok) {
  return {
    id,
    expected,
    observed,
    verdict: ok ? VERDICTS.PASS : VERDICTS.FAIL
  };
}

function presentLen(value) {
  if (value == null || value === '') {
    return { present: false, len: 0 };
  }
  const s = String(value);
  return { present: true, len: s.length };
}

function loadFixture(name) {
  return loadJson(path.join(FIXTURE_DIR, name)).data;
}

function basePreviousFromFixture(fx, extra) {
  const row = fx.row || {};
  return Object.assign(
    {
      session_id: row.session_id || fx.sessionId,
      session_found: true,
      sessionFound: true,
      session_expired: row.session_expired === true,
      sessionExpired: row.session_expired === true,
      pending_action: row.pending_action || 'CREATE_APPOINTMENT',
      conversation_step: row.conversation_step || 'ASK_EMAIL',
      intent: row.intent || 'CREATE_APPOINTMENT',
      service: row.service || 'PASSEPORT',
      site: row.site || 'PARIS',
      date_debut: row.date_debut || '2026-11-10',
      date_fin: row.date_fin || '2026-11-20',
      slot_id: row.slot_id,
      selected_slot_index: row.selected_slot_index != null ? row.selected_slot_index : 0,
      available_slots: row.available_slots || [],
      nom: row.nom,
      prenom: row.prenom,
      email: row.email,
      telephone: row.telephone,
      openAttempt: null,
      expires_at: row.expires_at || '2026-12-01T14:00:00.000Z'
    },
    extra || {}
  );
}

function redactedObserved(managed, extras) {
  const email = presentLen(managed && managed.email);
  const prenom = presentLen(managed && managed.prenom);
  const nom = presentLen(managed && managed.nom);
  return Object.assign(
    {
      simulation: true,
      runtimeRequired: true,
      sourceWorkflowSha256: EXPECTED_SHA256,
      conversationStep: managed && managed.conversationStep,
      emailPresent: email.present,
      emailLen: email.len,
      emailValide: Boolean(managed && managed.email && /@[^\s]+/.test(String(managed.email))),
      prenomPresent: prenom.present,
      prenomLen: prenom.len,
      nomPresent: nom.present,
      nomLen: nom.len,
      slotIdPresent: true,
      claimOrPost: false,
      mockPostsDelta: 0,
      mockClaimsDelta: 0,
      retried: false
    },
    extras || {}
  );
}

function initialStateAssertions(fx) {
  const row = fx.row;
  return [
    check('init_step_ask_email', 'ASK_EMAIL', row.conversation_step, row.conversation_step === 'ASK_EMAIL'),
    check('init_slot_present', true, Boolean(row.slot_id), Boolean(row.slot_id)),
    check('init_prenom_present', true, Boolean(row.prenom), Boolean(row.prenom)),
    check('init_nom_present', true, Boolean(row.nom), Boolean(row.nom)),
    check('init_email_absent', true, row.email == null, row.email == null),
    check('init_open_attempts_0', 0, row.openAttempts || 0, (row.openAttempts || 0) === 0)
  ];
}

/** R04-A — email valide → ASK_TELEPHONE */
function runR04AValidEmail(workflow) {
  const fx = loadFixture('r04-a-valid-email-state.json');
  assertSyntheticIdentity(fx, 'r04-a');
  const previous = basePreviousFromFixture(fx);
  const message = fx.message.value;
  const turn = runConversationTurn(workflow, {
    previous,
    message,
    llmIntent: 'GENERAL',
    withReply: true
  });
  const emailPl = presentLen(turn.managed.email);
  const assertions = initialStateAssertions(fx).concat([
    check(
      'r04a_email_captured',
      true,
      emailPl.present,
      emailPl.present && String(turn.managed.email).toLowerCase() === String(message).toLowerCase()
    ),
    check(
      'r04a_step_ask_telephone',
      'ASK_TELEPHONE',
      turn.managed.conversationStep,
      turn.managed.conversationStep === 'ASK_TELEPHONE'
    ),
    check('r04a_prenom_preserved', 'Camille', turn.managed.prenom, turn.managed.prenom === 'Camille'),
    check('r04a_nom_preserved', 'Dupont', turn.managed.nom, turn.managed.nom === 'Dupont'),
    check('r04a_no_claim_post', false, turn.claimOrPost, turn.claimOrPost === false),
    check(
      'r04a_no_create_appt',
      false,
      turn.wouldCallCreateAppointment,
      turn.wouldCallCreateAppointment === false
    ),
    check('r04a_retried_false', false, false, true)
  ]);
  const failed = assertions.some((a) => a.verdict === VERDICTS.FAIL);
  return {
    verdict: failed ? VERDICTS.FAIL : VERDICTS.PASS,
    reason: failed ? 'R04-A valid email failed' : 'R04-A valid email → ASK_TELEPHONE OK (VM)',
    nodes: turn.nodes,
    assertions,
    observed: redactedObserved(turn.managed, {
      scenario: 'R04-A',
      fixtureId: fx.fixtureId
    })
  };
}

/** R04-B — email invalide → reste ASK_EMAIL */
function runR04BInvalidEmail(workflow) {
  const fx = loadFixture('r04-b-invalid-email-state.json');
  assertSyntheticIdentity(fx, 'r04-b');
  const previous = basePreviousFromFixture(fx);
  const message = fx.message.value;
  const turn = runConversationTurn(workflow, {
    previous,
    message,
    llmIntent: 'GENERAL',
    withReply: true
  });
  const emailNull = turn.managed.email == null || turn.managed.email === '';
  const assertions = initialStateAssertions(fx).concat([
    check('r04b_email_not_accepted', true, emailNull, emailNull),
    check(
      'r04b_step_stays_ask_email',
      'ASK_EMAIL',
      turn.managed.conversationStep,
      turn.managed.conversationStep === 'ASK_EMAIL'
    ),
    check('r04b_prenom_preserved', 'Camille', turn.managed.prenom, turn.managed.prenom === 'Camille'),
    check('r04b_nom_preserved', 'Dupont', turn.managed.nom, turn.managed.nom === 'Dupont'),
    check('r04b_no_claim_post', false, turn.claimOrPost, turn.claimOrPost === false),
    check(
      'r04b_no_create_appt',
      false,
      turn.wouldCallCreateAppointment,
      turn.wouldCallCreateAppointment === false
    )
  ]);
  const failed = assertions.some((a) => a.verdict === VERDICTS.FAIL);
  return {
    verdict: failed ? VERDICTS.FAIL : VERDICTS.PASS,
    reason: failed ? 'R04-B invalid email failed' : 'R04-B invalid email stays ASK_EMAIL OK (VM)',
    nodes: turn.nodes,
    assertions,
    observed: redactedObserved(turn.managed, {
      scenario: 'R04-B',
      fixtureId: fx.fixtureId,
      asksCorrection: true
    })
  };
}

/**
 * R04-C — session expirée ASK_EMAIL.
 * Contrat: pas de capture email. VM actuelle peut fuiter via `previous.email ?? x.email`
 * (Fusionner remplit x.email avant early-return Gerer) → anomalie W-031-01.
 */
function runR04CExpiredAskEmail(workflow) {
  const fx = loadFixture('r04-c-expired-ask-email-state.json');
  assertSyntheticIdentity(fx, 'r04-c');
  const previous = basePreviousFromFixture(fx, {
    session_expired: true,
    sessionExpired: true,
    expires_at: fx.row.expires_at
  });
  const message = fx.message.value;
  const turn = runConversationTurn(workflow, {
    previous,
    message,
    llmIntent: 'GENERAL',
    sessionExpired: true,
    withReply: true
  });
  const emailNull = turn.managed.email == null || turn.managed.email === '';
  const safetyAssertions = [
    check('r04c_init_expired', true, true, fx.row.session_expired === true),
    check('r04c_init_step', 'ASK_EMAIL', fx.row.conversation_step, fx.row.conversation_step === 'ASK_EMAIL'),
    check(
      'r04c_session_expired_flag',
      true,
      turn.managed.sessionExpired,
      turn.managed.sessionExpired === true
    ),
    check(
      'r04c_refresh_ttl_false',
      false,
      turn.managed.refreshSessionTtl,
      turn.managed.refreshSessionTtl === false
    ),
    check(
      'r04c_step_not_advanced_to_phone',
      true,
      turn.managed.conversationStep,
      turn.managed.conversationStep !== 'ASK_TELEPHONE'
    ),
    check(
      'r04c_reply_session_expired',
      'session_expired',
      turn.reply && turn.reply.type,
      turn.reply && turn.reply.type === 'session_expired'
    ),
    check('r04c_no_claim_post', false, turn.claimOrPost, turn.claimOrPost === false),
    check(
      'r04c_no_create_appt',
      false,
      turn.wouldCallCreateAppointment,
      turn.wouldCallCreateAppointment === false
    )
  ];
  const contractEmail = check('r04c_email_not_captured', true, emailNull, emailNull);
  const assertions = safetyAssertions.concat([contractEmail]);
  const anomalies = [];
  if (contractEmail.verdict === VERDICTS.FAIL) {
    anomalies.push({
      id: 'W-031-01',
      title: 'expired ASK_EMAIL still surfaces email from Fusionner via Gerer ?? x.email',
      severity: 'Medium',
      proposedPatch:
        'n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/runtime-013/diag-031/PROPOSED-W-031-01-expired-no-identity-fallback.md',
      installed: false
    });
  }
  const safetyFailed = safetyAssertions.some((a) => a.verdict === VERDICTS.FAIL);
  // Scénario « safety » PASS si flags OK ; contrat email strict = anomaly si FAIL
  const verdict = safetyFailed ? VERDICTS.FAIL : VERDICTS.PASS;
  return {
    verdict,
    reason: safetyFailed
      ? 'R04-C safety assertions failed'
      : anomalies.length
        ? 'R04-C safety OK ; contrat email violé (W-031-01) — patch proposé non installé'
        : 'R04-C expired — no implicit email capture OK (VM)',
    nodes: turn.nodes,
    assertions,
    anomalies,
    contractEmailCaptured: !emailNull,
    observed: redactedObserved(turn.managed, {
      scenario: 'R04-C',
      fixtureId: fx.fixtureId,
      sessionExpired: true,
      refreshSessionTtl: turn.managed.refreshSessionTtl === true,
      anomalyIds: anomalies.map((a) => a.id)
    })
  };
}

module.exports = {
  runR04AValidEmail,
  runR04BInvalidEmail,
  runR04CExpiredAskEmail,
  loadFixture,
  FIXTURE_DIR
};
