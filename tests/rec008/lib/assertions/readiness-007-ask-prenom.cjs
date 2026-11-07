'use strict';

/**
 * ASK-PRENOM-READINESS-007 — assertions offline VC9 (simulation).
 * Ne prouve pas le runtime n8n/PostgreSQL.
 */

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

function basePrevious(step, extra) {
  return Object.assign(
    {
      session_id: 'rec008-syn-ask-prenom-01',
      session_found: true,
      sessionFound: true,
      session_expired: false,
      sessionExpired: false,
      pending_action: 'CREATE_APPOINTMENT',
      conversation_step: step,
      intent: 'CREATE_APPOINTMENT',
      service: 'PASSEPORT',
      site: 'PARIS',
      date_debut: '2026-11-10',
      date_fin: '2026-11-20',
      slot_id: '11111111-1111-4111-8111-111111111111',
      selected_slot_index: 0,
      available_slots: [],
      nom: 'Dupont',
      prenom: null,
      email: null,
      telephone: null,
      openAttempt: null,
      expires_at: '2026-11-02T14:00:00.000Z'
    },
    extra || {}
  );
}

function metaEnvelope(extra) {
  return Object.assign(
    {
      simulation: true,
      runtimeRequired: true,
      sourceWorkflowSha256: EXPECTED_SHA256,
      evidenceLimits:
        'VM jsCode VC9 only — HTTP réel, TTL PG, mock counters, deactivate hors périmètre offline.'
    },
    extra || {}
  );
}

/** S01 — session active ASK_PRENOM + Camille → prenom + ASK_EMAIL, no CLAIM/POST */
function runS01AskPrenomActive(workflow) {
  const previous = basePrevious('ASK_PRENOM', {
    session_id: 'rec008-syn-s01-ask-prenom-active'
  });
  const turn = runConversationTurn(workflow, {
    previous,
    message: 'Camille',
    llmIntent: 'GET_SERVICES',
    withReply: false
  });
  const assertions = [
    check('s01_parser_create', 'CREATE_APPOINTMENT', turn.parser.intent, turn.parser.intent === 'CREATE_APPOINTMENT'),
    check('s01_prenom_captured', 'Camille', turn.managed.prenom, turn.managed.prenom === 'Camille'),
    check('s01_nom_preserved', 'Dupont', turn.managed.nom, turn.managed.nom === 'Dupont'),
    check('s01_next_ask_email', 'ASK_EMAIL', turn.managed.conversationStep, turn.managed.conversationStep === 'ASK_EMAIL'),
    check('s01_pending_create', 'CREATE_APPOINTMENT', turn.managed.pendingAction, turn.managed.pendingAction === 'CREATE_APPOINTMENT'),
    check('s01_no_claim_post', false, turn.claimOrPost, turn.claimOrPost === false),
    check('s01_no_create_appt', false, turn.wouldCallCreateAppointment, turn.wouldCallCreateAppointment === false)
  ];
  const failed = assertions.some((a) => a.verdict === VERDICTS.FAIL);
  return {
    verdict: failed ? VERDICTS.FAIL : VERDICTS.PASS,
    reason: failed ? 'S01 ASK_PRENOM active failed' : 'S01 ASK_PRENOM active OK (VM simulation)',
    nodes: turn.nodes,
    assertions,
    observed: metaEnvelope({
      scenario: 'S01',
      managed: {
        prenom: turn.managed.prenom,
        nom: turn.managed.nom,
        conversationStep: turn.managed.conversationStep,
        pendingAction: turn.managed.pendingAction
      }
    })
  };
}

/** S02 — session expirée + Camille → session_expired, pas de capture prénom, TTL non renouvelé */
function runS02AskPrenomExpired(workflow) {
  const previous = basePrevious('ASK_PRENOM', {
    session_id: 'rec008-syn-s02-ask-prenom-expired',
    session_expired: true,
    sessionExpired: true,
    intent: 'GENERAL',
    expires_at: '2026-10-31T00:00:00.000Z'
  });
  const turn = runConversationTurn(workflow, {
    previous,
    message: 'Camille',
    llmIntent: 'GET_SERVICES',
    sessionExpired: true,
    withReply: true
  });
  const assertions = [
    check('s02_session_expired', true, turn.managed.sessionExpired, turn.managed.sessionExpired === true),
    check('s02_refresh_ttl_false', false, turn.managed.refreshSessionTtl, turn.managed.refreshSessionTtl === false),
    check('s02_preserve_draft', true, turn.managed.preserveDraft, turn.managed.preserveDraft === true),
    check('s02_step_preserved', 'ASK_PRENOM', turn.managed.conversationStep, turn.managed.conversationStep === 'ASK_PRENOM'),
    check('s02_nom_preserved', 'Dupont', turn.managed.nom, turn.managed.nom === 'Dupont'),
    check('s02_prenom_not_captured', null, turn.managed.prenom, turn.managed.prenom == null || turn.managed.prenom === ''),
    check('s02_intent_general', 'GENERAL', turn.managed.intent, turn.managed.intent === 'GENERAL'),
    check('s02_reply_session_expired', 'session_expired', turn.reply && turn.reply.type, turn.reply && turn.reply.type === 'session_expired'),
    check('s02_no_claim_post', false, turn.claimOrPost, turn.claimOrPost === false)
  ];
  const saveSim = simulateSaveMerge(
    {
      pending_action: 'CREATE_APPOINTMENT',
      conversation_step: 'ASK_PRENOM',
      nom: 'Dupont',
      prenom: null,
      expires_at: previous.expires_at
    },
    {
      intent: turn.managed.intent,
      pendingAction: turn.managed.pendingAction,
      conversationStep: turn.managed.conversationStep,
      nom: turn.managed.nom,
      prenom: turn.managed.prenom,
      refreshSessionTtl: turn.managed.refreshSessionTtl
    }
  );
  assertions.push(
    check(
      's02_save_ttl_unchanged',
      previous.expires_at,
      saveSim.row.expires_at,
      saveSim.row.expires_at === previous.expires_at
    )
  );
  const failed = assertions.some((a) => a.verdict === VERDICTS.FAIL);
  return {
    verdict: failed ? VERDICTS.FAIL : VERDICTS.PASS,
    reason: failed ? 'S02 expired free-text failed' : 'S02 expired free-text OK (VM + SQL sim)',
    nodes: turn.nodes.concat(['Sauvegarder état conversation (simulation)']),
    assertions,
    observed: metaEnvelope({
      scenario: 'S02',
      managed: {
        sessionExpired: turn.managed.sessionExpired,
        refreshSessionTtl: turn.managed.refreshSessionTtl,
        prenom: turn.managed.prenom,
        conversationStep: turn.managed.conversationStep
      },
      replyType: turn.reply && turn.reply.type
    })
  };
}

/**
 * S03 — comportement VC9 OBSERVÉ (pas le brief produit).
 * Après reprendre sur ASK_PRENOM expiré : TTL+, intent CREATE, mais
 * message « reprendre » est capturé comme prenom et step → ASK_EMAIL.
 */
function runS03AskPrenomResumeVc9Actual(workflow) {
  const previous = basePrevious('ASK_PRENOM', {
    session_id: 'rec008-syn-s03-ask-prenom-resume',
    session_expired: true,
    sessionExpired: true,
    intent: 'GENERAL',
    expires_at: '2026-10-31T00:00:00.000Z'
  });
  const turn = runConversationTurn(workflow, {
    previous,
    message: 'reprendre',
    llmIntent: 'GENERAL',
    sessionExpired: true,
    withReply: false
  });
  const assertions = [
    check('s03_ttl_refresh', true, turn.managed.refreshSessionTtl, turn.managed.refreshSessionTtl === true),
    check('s03_expired_cleared', false, turn.managed.sessionExpired, turn.managed.sessionExpired === false),
    check('s03_preserve_draft_flag', true, turn.managed.preserveDraft, turn.managed.preserveDraft === true),
    check('s03_intent_create', 'CREATE_APPOINTMENT', turn.managed.intent, turn.managed.intent === 'CREATE_APPOINTMENT'),
    check('s03_pending_create', 'CREATE_APPOINTMENT', turn.managed.pendingAction, turn.managed.pendingAction === 'CREATE_APPOINTMENT'),
    check('s03_nom_preserved', 'Dupont', turn.managed.nom, turn.managed.nom === 'Dupont'),
    // Divergence produit documentée — contrat VC9 actuel :
    check('s03_vc9_prenom_is_reprendre', 'reprendre', turn.managed.prenom, turn.managed.prenom === 'reprendre'),
    check('s03_vc9_step_ask_email', 'ASK_EMAIL', turn.managed.conversationStep, turn.managed.conversationStep === 'ASK_EMAIL'),
    check('s03_no_claim_post', false, turn.claimOrPost, turn.claimOrPost === false)
  ];
  const failed = assertions.some((a) => a.verdict === VERDICTS.FAIL);
  return {
    verdict: failed ? VERDICTS.FAIL : VERDICTS.PASS,
    reason: failed
      ? 'S03 VC9-actual failed'
      : 'S03 VC9-actual OK — note: brief attendait ASK_PRENOM+prenom null (DIVERGENCE)',
    nodes: turn.nodes,
    assertions,
    observed: metaEnvelope({
      scenario: 'S03',
      divergenceFromBrief: true,
      briefExpected: {
        conversationStep: 'ASK_PRENOM',
        prenom: null,
        invitePrenom: true
      },
      vc9Observed: {
        conversationStep: turn.managed.conversationStep,
        prenom: turn.managed.prenom,
        refreshSessionTtl: turn.managed.refreshSessionTtl
      }
    })
  };
}

/**
 * Test négatif / détection : les attentes BRIEF S03 échouent contre VC9.
 * Le scénario PASS si (et seulement si) le brief est bien contredit.
 */
function runS03BriefExpectationsFailAgainstVc9(workflow) {
  const previous = basePrevious('ASK_PRENOM', {
    session_id: 'rec008-syn-s03-brief-probe',
    session_expired: true,
    sessionExpired: true,
    intent: 'GENERAL',
    expires_at: '2026-10-31T00:00:00.000Z'
  });
  const turn = runConversationTurn(workflow, {
    previous,
    message: 'reprendre',
    llmIntent: 'GENERAL',
    sessionExpired: true,
    withReply: false
  });
  const briefOk =
    turn.managed.conversationStep === 'ASK_PRENOM' &&
    (turn.managed.prenom == null || turn.managed.prenom === '') &&
    turn.managed.refreshSessionTtl === true &&
    turn.managed.intent === 'CREATE_APPOINTMENT' &&
    turn.managed.nom === 'Dupont';

  const divergenceDetected = !briefOk;
  const assertions = [
    check(
      's03_brief_diverges_from_vc9',
      'brief NOT satisfied by VC9',
      {
        step: turn.managed.conversationStep,
        prenom: turn.managed.prenom,
        briefOk
      },
      divergenceDetected
    ),
    check('s03_brief_probe_no_claim', false, turn.claimOrPost, turn.claimOrPost === false)
  ];
  const failed = assertions.some((a) => a.verdict === VERDICTS.FAIL);
  return {
    verdict: failed ? VERDICTS.FAIL : VERDICTS.PASS,
    reason: failed
      ? 'Expected brief≠VC9 divergence not detected'
      : 'Negative OK — brief S03 expectations contradicted by VC9 (capture reprendre)',
    nodes: turn.nodes,
    assertions,
    observed: metaEnvelope({
      scenario: 'N-S03-brief-divergence',
      briefSatisfiedByVc9: briefOk,
      managed: {
        conversationStep: turn.managed.conversationStep,
        prenom: turn.managed.prenom
      }
    })
  };
}

/** Négatif : free-text sur session expirée ne doit PAS capturer le prénom (régression). */
function runNegativeExpiredMustNotCapturePrenom(workflow) {
  const r = runS02AskPrenomExpired(workflow);
  const prenomAssert = (r.assertions || []).find((a) => a.id === 's02_prenom_not_captured');
  const ok = prenomAssert && prenomAssert.verdict === VERDICTS.PASS;
  return {
    verdict: ok ? VERDICTS.PASS : VERDICTS.FAIL,
    reason: ok
      ? 'Negative OK — expired free-text does not capture prenom'
      : 'REGRESSION — prenom captured on expired session',
    nodes: r.nodes,
    assertions: [prenomAssert || check('s02_prenom_not_captured', null, 'missing', false)],
    observed: metaEnvelope({ scenario: 'N-expired-no-prenom', parent: 'S02' })
  };
}

module.exports = {
  runS01AskPrenomActive,
  runS02AskPrenomExpired,
  runS03AskPrenomResumeVc9Actual,
  runS03BriefExpectationsFailAgainstVc9,
  runNegativeExpiredMustNotCapturePrenom,
  basePrevious
};
