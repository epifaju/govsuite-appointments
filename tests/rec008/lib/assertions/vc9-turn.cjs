'use strict';

const { VERDICTS } = require('../verdicts.cjs');
const { runConversationTurn } = require('../node-runtime.cjs');
const { simulateSaveMerge } = require('../sql-contracts.cjs');

function check(id, expected, observed, ok) {
  return {
    id,
    expected,
    observed,
    verdict: ok ? VERDICTS.PASS : VERDICTS.FAIL
  };
}

function previousAsk(step, extra) {
  return Object.assign(
    {
      session_id: 'rec008-syn-identity-01',
      session_found: true,
      sessionFound: true,
      session_expired: false,
      sessionExpired: false,
      pending_action: 'CREATE_APPOINTMENT',
      conversation_step: step,
      intent: 'CREATE_APPOINTMENT',
      service: 'PASSEPORT',
      site: 'PARIS',
      slot_id: '11111111-1111-4111-8111-111111111111',
      nom: null,
      prenom: null,
      email: null,
      telephone: null,
      available_slots: [],
      openAttempt: null,
      expires_at: '2026-11-02T12:00:00.000Z'
    },
    extra || {}
  );
}

function runIdentityCapture(workflow, step, message, llmIntent, field, nextStep) {
  const previous = previousAsk(step, {
    nom: step === 'ASK_NOM' ? null : 'Dupont',
    prenom: ['ASK_EMAIL', 'ASK_TELEPHONE'].includes(step) ? 'Camille' : null,
    email: step === 'ASK_TELEPHONE' ? 'camille.dupont@example.test' : null
  });
  const turn = runConversationTurn(workflow, {
    previous,
    message,
    llmIntent: llmIntent || 'GET_SERVICES',
    withReply: false
  });
  const assertions = [
    check('parser_locks_create', 'CREATE_APPOINTMENT', turn.parser.intent, turn.parser.intent === 'CREATE_APPOINTMENT'),
    check('managed_intent_create', 'CREATE_APPOINTMENT', turn.managed.intent, turn.managed.intent === 'CREATE_APPOINTMENT'),
    check(
      'field_captured',
      message.trim(),
      turn.managed[field],
      String(turn.managed[field] || '').trim() === String(message).trim()
    ),
    check(
      'next_step',
      nextStep,
      turn.managed.conversationStep,
      turn.managed.conversationStep === nextStep
    ),
    check('no_claim_post', false, turn.claimOrPost, turn.claimOrPost === false)
  ];
  const failed = assertions.some((a) => a.verdict === VERDICTS.FAIL);
  return {
    verdict: failed ? VERDICTS.FAIL : VERDICTS.PASS,
    reason: failed ? 'Identity capture assertion failed' : 'Identity capture OK (VM simulation)',
    nodes: turn.nodes,
    assertions,
    observed: {
      simulation: true,
      parserIntent: turn.parser.intent,
      managed: {
        intent: turn.managed.intent,
        conversationStep: turn.managed.conversationStep,
        [field]: turn.managed[field],
        pendingAction: turn.managed.pendingAction
      }
    }
  };
}

function runExpiredFreeText(workflow) {
  const previous = previousAsk('ASK_PRENOM', {
    session_id: 'rec008-syn-expired-01',
    session_expired: true,
    sessionExpired: true,
    nom: 'Dupont',
    prenom: null,
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
    check('session_expired_flag', true, turn.managed.sessionExpired, turn.managed.sessionExpired === true),
    check('refresh_ttl_false', false, turn.managed.refreshSessionTtl, turn.managed.refreshSessionTtl === false),
    check('preserve_draft', true, turn.managed.preserveDraft, turn.managed.preserveDraft === true),
    check('pending_preserved', 'CREATE_APPOINTMENT', turn.managed.pendingAction, turn.managed.pendingAction === 'CREATE_APPOINTMENT'),
    check('step_preserved', 'ASK_PRENOM', turn.managed.conversationStep, turn.managed.conversationStep === 'ASK_PRENOM'),
    check('nom_preserved', 'Dupont', turn.managed.nom, turn.managed.nom === 'Dupont'),
    check('not_get_services', 'GENERAL', turn.managed.intent, turn.managed.intent === 'GENERAL'),
    check('reply_type', 'session_expired', turn.reply && turn.reply.type, turn.reply && turn.reply.type === 'session_expired'),
    check('no_claim_post', false, turn.claimOrPost, turn.claimOrPost === false)
  ];

  const saveSim = simulateSaveMerge(
    {
      pending_action: 'CREATE_APPOINTMENT',
      conversation_step: 'ASK_PRENOM',
      nom: 'Dupont',
      expires_at: previous.expires_at
    },
    {
      intent: turn.managed.intent,
      pendingAction: turn.managed.pendingAction,
      conversationStep: turn.managed.conversationStep,
      nom: turn.managed.nom,
      refreshSessionTtl: turn.managed.refreshSessionTtl
    }
  );
  assertions.push(
    check(
      'save_sim_ttl_not_refreshed',
      previous.expires_at,
      saveSim.row.expires_at,
      saveSim.row.expires_at === previous.expires_at
    ),
    check(
      'save_sim_draft_kept',
      'ASK_PRENOM',
      saveSim.row.conversation_step,
      saveSim.row.conversation_step === 'ASK_PRENOM'
    )
  );

  const failed = assertions.some((a) => a.verdict === VERDICTS.FAIL);
  return {
    verdict: failed ? VERDICTS.FAIL : VERDICTS.PASS,
    reason: failed ? 'Expired session free-text failed' : 'Expired session free-text OK (VM + SQL sim)',
    nodes: turn.nodes.concat(['Sauvegarder état conversation (simulation)']),
    assertions,
    observed: {
      simulation: true,
      managed: {
        intent: turn.managed.intent,
        sessionExpired: turn.managed.sessionExpired,
        refreshSessionTtl: turn.managed.refreshSessionTtl,
        preserveDraft: turn.managed.preserveDraft,
        pendingAction: turn.managed.pendingAction,
        conversationStep: turn.managed.conversationStep,
        nom: turn.managed.nom
      },
      replyType: turn.reply && turn.reply.type,
      saveSim: saveSim.row
    }
  };
}

function runExplicitResume(workflow) {
  const previous = previousAsk('ASK_PRENOM', {
    session_expired: true,
    sessionExpired: true,
    nom: 'Dupont'
  });
  const turn = runConversationTurn(workflow, {
    previous,
    message: 'reprendre',
    llmIntent: 'GENERAL',
    sessionExpired: true,
    withReply: false
  });
  const assertions = [
    check('resume_intent_create', 'CREATE_APPOINTMENT', turn.managed.intent, turn.managed.intent === 'CREATE_APPOINTMENT'),
    check('refresh_ttl_true', true, turn.managed.refreshSessionTtl, turn.managed.refreshSessionTtl === true),
    check('session_expired_cleared', false, turn.managed.sessionExpired, turn.managed.sessionExpired === false),
    check('preserve_draft', true, turn.managed.preserveDraft, turn.managed.preserveDraft === true),
    check('no_claim_post', false, turn.claimOrPost, turn.claimOrPost === false)
  ];
  const failed = assertions.some((a) => a.verdict === VERDICTS.FAIL);
  return {
    verdict: failed ? VERDICTS.FAIL : VERDICTS.PASS,
    reason: failed ? 'Explicit resume failed' : 'Explicit resume OK (VM simulation)',
    nodes: turn.nodes,
    assertions,
    observed: { simulation: true, managed: turn.managed }
  };
}

function runAbandon(workflow) {
  const previous = previousAsk('ASK_PRENOM', { nom: 'Dupont' });
  const turn = runConversationTurn(workflow, {
    previous,
    message: 'non',
    llmIntent: 'GENERAL',
    withReply: false
  });
  const assertions = [
    check('negative_decision', 'NEGATIVE', turn.managed.createDecision, turn.managed.createDecision === 'NEGATIVE'),
    check('pending_cleared', null, turn.managed.pendingAction, turn.managed.pendingAction == null),
    check('step_cleared', null, turn.managed.conversationStep, turn.managed.conversationStep == null),
    check(
      'authorized_nulls',
      true,
      Array.isArray(turn.managed._authorizedNulls),
      Array.isArray(turn.managed._authorizedNulls) && turn.managed._authorizedNulls.includes('nom')
    ),
    check('preserve_draft_false', false, turn.managed.preserveDraft, turn.managed.preserveDraft === false)
  ];
  const saveUnauthorized = simulateSaveMerge(
    { nom: 'Dupont', pending_action: 'CREATE_APPOINTMENT', conversation_step: 'ASK_PRENOM', expires_at: 'T0' },
    { nom: null, pendingAction: null, conversationStep: null, refreshSessionTtl: true }
  );
  const saveAuthorized = simulateSaveMerge(
    { nom: 'Dupont', pending_action: 'CREATE_APPOINTMENT', conversation_step: 'ASK_PRENOM', expires_at: 'T0' },
    {
      nom: null,
      pendingAction: null,
      conversationStep: null,
      refreshSessionTtl: true,
      _authorizedNulls: ['nom', 'pendingAction', 'conversationStep']
    }
  );
  assertions.push(
    check('null_unauthorized_keeps', 'Dupont', saveUnauthorized.row.nom, saveUnauthorized.row.nom === 'Dupont'),
    check('null_authorized_clears', null, saveAuthorized.row.nom, saveAuthorized.row.nom === null)
  );
  const failed = assertions.some((a) => a.verdict === VERDICTS.FAIL);
  return {
    verdict: failed ? VERDICTS.FAIL : VERDICTS.PASS,
    reason: failed ? 'Abandon/nulls failed' : 'Abandon + null auth OK (VM + SQL sim)',
    nodes: turn.nodes.concat(['Sauvegarder état conversation (simulation)']),
    assertions,
    observed: { simulation: true, managed: turn.managed }
  };
}

function runAwaitConfirmationNoReserve(workflow) {
  const previous = previousAsk('AWAIT_CREATE_CONFIRMATION', {
    nom: 'Dupont',
    prenom: 'Camille',
    email: 'camille.dupont@example.test',
    telephone: '+33000000001',
    openAttempt: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      status: 'AWAITING_CONFIRMATION'
    }
  });
  const turn = runConversationTurn(workflow, {
    previous,
    message: 'peut-être',
    llmIntent: 'GENERAL',
    withReply: false
  });
  const assertions = [
    check('ambiguous_or_not_affirm', true, turn.parser.createDecision, turn.parser.createDecision !== 'AFFIRM'),
    check('no_claim_post', false, turn.claimOrPost, turn.claimOrPost === false),
    check(
      'would_not_create',
      false,
      turn.wouldCallCreateAppointment,
      turn.wouldCallCreateAppointment === false
    )
  ];
  const failed = assertions.some((a) => a.verdict === VERDICTS.FAIL);
  return {
    verdict: failed ? VERDICTS.FAIL : VERDICTS.PASS,
    reason: failed ? 'Await confirmation guard failed' : 'No reservation without confirm (parser decision only)',
    nodes: turn.nodes,
    assertions,
    observed: {
      simulation: true,
      createDecision: turn.parser.createDecision,
      note: 'Absence de POST CreateAppointment simulée (harness offline ne fait jamais HTTP).'
    }
  };
}

function runUncertainResumeFlag(workflow) {
  const previous = previousAsk('AWAIT_CREATE_CONFIRMATION', {
    nom: 'Dupont',
    prenom: 'Camille',
    openAttempt: {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      status: 'UNCERTAIN'
    }
  });
  const turn = runConversationTurn(workflow, {
    previous,
    message: 'oui',
    llmIntent: 'GENERAL',
    withReply: false
  });
  const assertions = [
    check('resume_decision', 'RESUME', turn.parser.createDecision, turn.parser.createDecision === 'RESUME'),
    check('no_http', false, turn.claimOrPost, turn.claimOrPost === false)
  ];
  const failed = assertions.some((a) => a.verdict === VERDICTS.FAIL);
  return {
    verdict: failed ? VERDICTS.FAIL : VERDICTS.PASS,
    reason: failed ? 'UNCERTAIN resume decision failed' : 'UNCERTAIN → RESUME decision OK (no HTTP)',
    nodes: turn.nodes,
    assertions,
    observed: { simulation: true, createDecision: turn.parser.createDecision }
  };
}

function runModifyField(workflow) {
  const previous = previousAsk('AWAIT_CREATE_CONFIRMATION', {
    nom: 'Dupont',
    prenom: 'Camille',
    email: 'camille.dupont@example.test',
    telephone: '+33000000001',
    openAttempt: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', status: 'AWAITING_CONFIRMATION' }
  });
  const turn = runConversationTurn(workflow, {
    previous,
    message: 'modifier le nom',
    llmIntent: 'GENERAL',
    withReply: false
  });
  const assertions = [
    check('modify_decision', 'MODIFY', turn.parser.createDecision, turn.parser.createDecision === 'MODIFY'),
    check('modify_field_nom', 'nom', turn.parser.modifyField, turn.parser.modifyField === 'nom')
  ];
  const failed = assertions.some((a) => a.verdict === VERDICTS.FAIL);
  return {
    verdict: failed ? VERDICTS.FAIL : VERDICTS.PASS,
    reason: failed ? 'Modify field failed' : 'Modify field OK',
    nodes: turn.nodes,
    assertions,
    observed: {
      simulation: true,
      createDecision: turn.parser.createDecision,
      modifyField: turn.parser.modifyField
    }
  };
}

module.exports = {
  runIdentityCapture,
  runExpiredFreeText,
  runExplicitResume,
  runAbandon,
  runAwaitConfirmationNoReserve,
  runUncertainResumeFlag,
  runModifyField,
  previousAsk
};
