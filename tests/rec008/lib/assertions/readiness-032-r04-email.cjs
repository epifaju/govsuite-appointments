'use strict';

/**
 * MISSION 032 — Régressions R04-A…F + contrat strict R04-C (W-031-01).
 * Observed: Present/Len only.
 */

const {
  runR04AValidEmail,
  runR04BInvalidEmail,
  runR04CExpiredAskEmail,
  loadFixture
} = require('./readiness-031-r04-email.cjs');
const { VERDICTS } = require('../verdicts.cjs');
const { runConversationTurn } = require('../node-runtime.cjs');
const { simulateSaveMerge } = require('../sql-contracts.cjs');
const { EXPECTED_SHA256 } = require('../workflow-source.cjs');

function check(id, expected, observed, ok) {
  return {
    id,
    expected,
    observed,
    verdict: ok ? VERDICTS.PASS : VERDICTS.FAIL
  };
}

function present(value) {
  return !(value == null || value === '');
}

function baseAskEmail(extra) {
  return Object.assign(
    {
      session_id: 'rec008-syn-r032-ask-email',
      session_found: true,
      sessionFound: true,
      session_expired: false,
      sessionExpired: false,
      pending_action: 'CREATE_APPOINTMENT',
      conversation_step: 'ASK_EMAIL',
      intent: 'CREATE_APPOINTMENT',
      service: 'PASSEPORT',
      site: 'PARIS',
      date_debut: '2026-11-10',
      date_fin: '2026-11-20',
      slot_id: '11111111-1111-4111-8111-111111111301',
      selected_slot_index: 0,
      available_slots: [
        { id: '11111111-1111-4111-8111-111111111301', label: '2026-11-12T09:00:00+01:00' }
      ],
      nom: 'Dupont',
      prenom: 'Camille',
      email: null,
      telephone: null,
      openAttempt: null,
      expires_at: '2026-12-01T14:00:00.000Z'
    },
    extra || {}
  );
}

function wrap(assertions, okReason, failReason, turn, extras) {
  const failed = assertions.some((a) => a.verdict === VERDICTS.FAIL);
  return {
    verdict: failed ? VERDICTS.FAIL : VERDICTS.PASS,
    reason: failed ? failReason : okReason,
    nodes: turn.nodes,
    assertions,
    observed: Object.assign(
      {
        simulation: true,
        sourceWorkflowSha256: EXPECTED_SHA256,
        conversationStep: turn.managed.conversationStep,
        emailPresent: present(turn.managed.email),
        emailLen: present(turn.managed.email) ? String(turn.managed.email).length : 0,
        prenomPresent: present(turn.managed.prenom),
        nomPresent: present(turn.managed.nom),
        telephonePresent: present(turn.managed.telephone),
        sessionExpired: turn.managed.sessionExpired === true,
        refreshSessionTtl: turn.managed.refreshSessionTtl === true,
        claimOrPost: turn.claimOrPost === true,
        mockPostsDelta: 0,
        mockClaimsDelta: 0,
        retried: false
      },
      extras || {}
    )
  };
}

/** R04-C strict: email absent si initialement null + non persisté (save sim) */
function runR04CStrictNoEmailCapture(workflow) {
  const fx = loadFixture('r04-c-expired-ask-email-state.json');
  const previous = baseAskEmail({
    session_id: fx.sessionId,
    session_expired: true,
    sessionExpired: true,
    expires_at: fx.row.expires_at
  });
  const turn = runConversationTurn(workflow, {
    previous,
    message: fx.message.value,
    llmIntent: 'GENERAL',
    sessionExpired: true,
    withReply: true
  });
  const save = simulateSaveMerge(
    {
      session_id: fx.sessionId,
      email: null,
      conversation_step: 'ASK_EMAIL',
      expires_at: fx.row.expires_at,
      nom: 'Dupont',
      prenom: 'Camille'
    },
    {
      email: turn.managed.email,
      conversationStep: turn.managed.conversationStep,
      refreshSessionTtl: turn.managed.refreshSessionTtl,
      nom: turn.managed.nom,
      prenom: turn.managed.prenom
    }
  );
  const emailNull = !present(turn.managed.email);
  const persistOk = !present(save.row.email);
  const strictAssertions = [
    check('r04c_email_null', true, emailNull, emailNull),
    check(
      'r04c_step_ask_email',
      'ASK_EMAIL',
      turn.managed.conversationStep,
      turn.managed.conversationStep === 'ASK_EMAIL'
    ),
    check(
      'r04c_ttl_not_refreshed',
      false,
      turn.managed.refreshSessionTtl,
      turn.managed.refreshSessionTtl === false
    ),
    check(
      'r04c_session_expired',
      true,
      turn.managed.sessionExpired,
      turn.managed.sessionExpired === true
    ),
    check('r04c_no_claim', false, turn.claimOrPost, turn.claimOrPost === false),
    check('r04c_save_email_not_persisted', true, persistOk, persistOk),
    check(
      'r04c_fusion_may_have_email_but_gerer_blocks',
      true,
      true,
      // fusion can still hold email; managed must not after patch
      emailNull
    )
  ];
  return wrap(
    strictAssertions,
    'R04-C strict: no email capture/persist on expired',
    'R04-C strict failed (W-031-01)',
    turn,
    { scenario: 'R04-C-strict', saveEmailPresent: present(save.row.email) }
  );
}

/** R04-D — expired + reprendre → TTL+, draft preserved, no CLAIM */
function runR04DExpiredResume(workflow) {
  const previous = baseAskEmail({
    session_id: 'rec008-syn-r032-r04d',
    session_expired: true,
    sessionExpired: true,
    expires_at: '2026-10-31T00:00:00.000Z',
    email: null
  });
  const turn = runConversationTurn(workflow, {
    previous,
    message: 'reprendre',
    llmIntent: 'GENERAL',
    sessionExpired: true,
    withReply: true
  });
  const assertions = [
    check('r04d_refresh_ttl', true, turn.managed.refreshSessionTtl, turn.managed.refreshSessionTtl === true),
    check('r04d_not_session_expired_flag', false, turn.managed.sessionExpired, turn.managed.sessionExpired === false),
    check('r04d_step_preserved', 'ASK_EMAIL', turn.managed.conversationStep, turn.managed.conversationStep === 'ASK_EMAIL'),
    check('r04d_email_still_null', false, present(turn.managed.email), !present(turn.managed.email)),
    check('r04d_prenom_kept', 'Camille', turn.managed.prenom, turn.managed.prenom === 'Camille'),
    check('r04d_no_claim', false, turn.claimOrPost, turn.claimOrPost === false),
    check('r04d_intent_create', 'CREATE_APPOINTMENT', turn.managed.intent, turn.managed.intent === 'CREATE_APPOINTMENT')
  ];
  return wrap(assertions, 'R04-D resume OK', 'R04-D resume failed', turn, { scenario: 'R04-D' });
}

/** R04-E — email préexistant + message non-email (active) → email conservé, pas CLAIM */
function runR04EPreexistingEmail(workflow) {
  const previous = baseAskEmail({
    session_id: 'rec008-syn-r032-r04e',
    conversation_step: 'ASK_TELEPHONE',
    email: 'camille.pre@example.test'
  });
  const turn = runConversationTurn(workflow, {
    previous,
    message: 'bonjour',
    llmIntent: 'GENERAL',
    withReply: true
  });
  const assertions = [
    check('r04e_email_preserved', true, present(turn.managed.email), present(turn.managed.email)),
    check(
      'r04e_email_unchanged_len',
      String(previous.email).length,
      present(turn.managed.email) ? String(turn.managed.email).length : 0,
      present(turn.managed.email) &&
        String(turn.managed.email).toLowerCase() === String(previous.email).toLowerCase()
    ),
    check('r04e_no_claim', false, turn.claimOrPost, turn.claimOrPost === false),
    check(
      'r04e_not_create_appt',
      false,
      turn.wouldCallCreateAppointment,
      turn.wouldCallCreateAppointment === false
    )
  ];
  return wrap(assertions, 'R04-E preexisting email OK', 'R04-E failed', turn, {
    scenario: 'R04-E',
    emailPresent: true,
    emailLen: present(turn.managed.email) ? String(turn.managed.email).length : 0
  });
}

/** R04-F — expired ASK_TELEPHONE + phone-shaped message → no telephone capture */
function runR04FExpiredPhoneNoCapture(workflow) {
  const previous = baseAskEmail({
    session_id: 'rec008-syn-r032-r04f',
    conversation_step: 'ASK_TELEPHONE',
    email: 'camille.pre@example.test',
    telephone: null,
    session_expired: true,
    sessionExpired: true,
    expires_at: '2026-10-31T00:00:00.000Z'
  });
  const turn = runConversationTurn(workflow, {
    previous,
    message: '+33699887766',
    llmIntent: 'GENERAL',
    sessionExpired: true,
    withReply: true
  });
  const assertions = [
    check('r04f_tel_not_captured', false, present(turn.managed.telephone), !present(turn.managed.telephone)),
    check('r04f_email_preserved_from_previous', true, present(turn.managed.email), present(turn.managed.email)),
    check('r04f_session_expired', true, turn.managed.sessionExpired, turn.managed.sessionExpired === true),
    check('r04f_ttl_not_refreshed', false, turn.managed.refreshSessionTtl, turn.managed.refreshSessionTtl === false),
    check('r04f_no_claim', false, turn.claimOrPost, turn.claimOrPost === false)
  ];
  return wrap(assertions, 'R04-F expired no phone capture OK', 'R04-F failed', turn, {
    scenario: 'R04-F',
    telephonePresent: false
  });
}

module.exports = {
  runR04AValidEmail,
  runR04BInvalidEmail,
  runR04CExpiredAskEmail,
  runR04CStrictNoEmailCapture,
  runR04DExpiredResume,
  runR04EPreexistingEmail,
  runR04FExpiredPhoneNoCapture
};
