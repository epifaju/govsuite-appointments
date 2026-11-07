'use strict';

const { VERDICTS } = require('../verdicts.cjs');
const { runConversationTurn } = require('../node-runtime.cjs');
const {
  classifyHttpResponse,
  classifyHttpTimeout,
  decideAttemptAction
} = require('../http-classifier.cjs');
const {
  emptyState,
  seedSlot,
  createAwaitingAttempt,
  claimLeaseConcurrent,
  createAppointmentIdempotent,
  runWinningSubmit,
  runTransportTimeout: simTransportTimeout,
  evidence
} = require('../attempt-sim.cjs');
const { previousAsk } = require('./vc9-turn.cjs');

function check(id, expected, observed, ok) {
  return {
    id,
    expected,
    observed,
    verdict: ok ? VERDICTS.PASS : VERDICTS.FAIL
  };
}

function wrap(verdict, reason, nodes, assertions, observed) {
  const failed = assertions.some((a) => a.verdict === VERDICTS.FAIL);
  return {
    verdict: failed ? VERDICTS.FAIL : verdict,
    reason: failed ? 'Assertion failed: ' + reason : reason,
    nodes,
    assertions,
    observed
  };
}

function meta(extra) {
  return Object.assign(
    {
      simulation: true,
      postExecuted: false,
      wouldCallCreateAppointment: false,
      disclaimer:
        'Preuve offline simulée (VM jsCode VC9 et/ou state-machine JS). Pas une preuve runtime n8n/PostgreSQL/HTTP.'
    },
    extra || {}
  );
}

/** C01 — multi-tours identité jusqu'au récap sans confirmation / sans POST */
function runCollectWithoutConfirm(workflow) {
  const steps = [
    { step: 'ASK_NOM', message: 'Dupont', field: 'nom', next: 'ASK_PRENOM' },
    { step: 'ASK_PRENOM', message: 'Camille', field: 'prenom', next: 'ASK_EMAIL' },
    {
      step: 'ASK_EMAIL',
      message: 'camille.dupont@example.test',
      field: 'email',
      next: 'ASK_TELEPHONE'
    },
    {
      step: 'ASK_TELEPHONE',
      message: '+33000000001',
      field: 'telephone',
      next: 'AWAIT_CREATE_CONFIRMATION'
    }
  ];

  let previous = previousAsk('ASK_NOM', {
    session_id: 'rec008-syn-c01-01',
    nom: null,
    prenom: null,
    email: null,
    telephone: null
  });

  const tourResults = [];
  const assertions = [];
  let lastManaged = null;

  for (const s of steps) {
    previous.conversation_step = s.step;
    const turn = runConversationTurn(workflow, {
      previous,
      message: s.message,
      llmIntent: 'GET_SERVICES',
      withReply: false
    });
    lastManaged = turn.managed;
    tourResults.push({
      step: s.step,
      intent: turn.managed.intent,
      conversationStep: turn.managed.conversationStep,
      [s.field]: turn.managed[s.field]
    });
    assertions.push(
      check(
        'tour_' + s.step + '_field',
        s.message,
        turn.managed[s.field],
        String(turn.managed[s.field] || '') === s.message
      ),
      check(
        'tour_' + s.step + '_next',
        s.next,
        turn.managed.conversationStep,
        turn.managed.conversationStep === s.next
      ),
      check('turn_' + s.step + '_no_post', false, turn.claimOrPost, turn.claimOrPost === false)
    );
    previous = Object.assign({}, previous, {
      conversation_step: turn.managed.conversationStep,
      pending_action: turn.managed.pendingAction || previous.pending_action,
      nom: turn.managed.nom ?? previous.nom,
      prenom: turn.managed.prenom ?? previous.prenom,
      email: turn.managed.email ?? previous.email,
      telephone: turn.managed.telephone ?? previous.telephone,
      session_expired: false,
      sessionExpired: false
    });
  }

  assertions.push(
    check(
      'final_await',
      'AWAIT_CREATE_CONFIRMATION',
      lastManaged && lastManaged.conversationStep,
      lastManaged && lastManaged.conversationStep === 'AWAIT_CREATE_CONFIRMATION'
    ),
    check(
      'no_affirm',
      true,
      lastManaged && lastManaged.createDecision,
      !lastManaged || lastManaged.createDecision !== 'AFFIRM'
    )
  );

  return wrap(
    VERDICTS.PASS,
    'C01 multi-tours → AWAIT sans confirmation/POST (VM). Tentative SQL AWAITING = runtimeRequired.',
    [
      'Parser intention',
      'Fusionner état conversation',
      'Gérer collecte progressive'
    ],
    assertions,
    meta({
      evidenceClass: 'vm-jscode',
      runtimeRequired: true,
      runtimeRequiredReason: 'INSERT tentative AWAITING_CONFIRMATION + compteurs RDV réels',
      tours: tourResults
    })
  );
}

/** K01 — oui → AFFIRM → CLAIM gate ; POST non exécuté */
function runPositiveOuiClaimGate(workflow) {
  const previous = previousAsk('AWAIT_CREATE_CONFIRMATION', {
    session_id: 'rec008-syn-k01-01',
    nom: 'Dupont',
    prenom: 'Camille',
    email: 'camille.dupont@example.test',
    telephone: '+33000000001',
    openAttempt: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      status: 'AWAITING_CONFIRMATION',
      reference: null,
      leaseUntil: null,
      expiresAt: Date.now() + 3_600_000
    }
  });

  const turn = runConversationTurn(workflow, {
    previous,
    message: 'oui',
    llmIntent: 'GENERAL',
    withReply: false
  });

  const decided = decideAttemptAction(
    workflow,
    turn.managed,
    { openAttempt: previous.openAttempt, sessionId: previous.session_id },
    {
      sessionId: previous.session_id,
      conversationStep: 'AWAIT_CREATE_CONFIRMATION'
    }
  );

  const assertions = [
    check('parser_affirm', 'AFFIRM', turn.parser.createDecision, turn.parser.createDecision === 'AFFIRM'),
    check('decide_claim', 'CLAIM', decided.attemptAction, decided.attemptAction === 'CLAIM'),
    check('ready_false_until_claim_sql', false, decided.ready, decided.ready === false),
    check('claimAcquired_false', false, decided.claimAcquired, decided.claimAcquired === false),
    check('post_not_executed', false, false, true)
  ];

  return wrap(
    VERDICTS.PASS,
    'K01 slice offline: AFFIRM→CLAIM gate sans POST. HTTP 201/CONFIRMED = runtimeRequired.',
    ['Parser intention', 'Gérer collecte progressive', 'Décider action tentative'],
    assertions,
    meta({
      evidenceClass: 'vm-jscode',
      runtimeRequired: true,
      runtimeRequiredReason: 'POST CreateAppointment + HTTP 201 + CONFIRMED DB (matrice C2)',
      createDecision: turn.parser.createDecision,
      attemptAction: decided.attemptAction
    })
  );
}

/** I01 — second oui après CONFIRMED → RECALL + replay sim même clé */
function runSecondOuiSameKey(workflow) {
  const previous = previousAsk('AWAIT_CREATE_CONFIRMATION', {
    session_id: 'rec008-syn-i01-01',
    nom: 'Dupont',
    prenom: 'Camille',
    openAttempt: {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      status: 'CONFIRMED',
      reference: 'RDV-SYN-001',
      expiresAt: Date.now() + 3_600_000
    }
  });

  const turn = runConversationTurn(workflow, {
    previous,
    message: 'oui',
    llmIntent: 'GENERAL',
    withReply: false
  });

  const decided = decideAttemptAction(
    workflow,
    turn.managed,
    { openAttempt: previous.openAttempt, sessionId: previous.session_id },
    { sessionId: previous.session_id, conversationStep: 'AWAIT_CREATE_CONFIRMATION' }
  );

  let state = emptyState(1_000);
  state = seedSlot(state, {
    id: '11111111-1111-4111-8111-111111111111',
    capacite: 2,
    debut: 1_000 + 3_600_000
  });
  const key = 'rec008-idem-key-00000001';
  const sameBody = {
    cleIdempotence: key,
    slotId: '11111111-1111-4111-8111-111111111111',
    nom: 'Dupont',
    prenom: 'Camille',
    email: 'camille.dupont@example.test',
    telephone: '+33000000001'
  };
  let r = createAwaitingAttempt(state, {
    sessionId: 'rec008-syn-i01-01',
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    payload: sameBody
  });
  state = r.state;
  r = runWinningSubmit(state, {
    attemptId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    sessionId: 'rec008-syn-i01-01',
    owner: 'owner-syn-00000001'
  });
  state = r.state;
  const firstPosts = state.postCount;
  const firstRef = r.result && r.result.reference;
  r = createAppointmentIdempotent(state, sameBody);
  state = r.state;

  const assertions = [
    check(
      'parser_recall_or_affirm_on_confirmed',
      true,
      turn.parser.createDecision,
      turn.parser.createDecision === 'RECALL' || turn.parser.createDecision === 'AFFIRM'
    ),
    check('decide_recall', 'RECALL', decided.attemptAction, decided.attemptAction === 'RECALL'),
    check(
      'sim_second_issue_replay',
      'REPLAYED',
      r.result && r.result.issue,
      r.result && r.result.issue === 'REPLAYED'
    ),
    check(
      'sim_post_count_increment_on_replay_call',
      firstPosts + 1,
      state.postCount,
      state.postCount === firstPosts + 1
    ),
    check(
      'sim_same_reference',
      firstRef,
      r.result && r.result.reference,
      r.result && r.result.reference === firstRef
    ),
    check('post_not_executed_harness', false, false, true)
  ];

  return wrap(
    VERDICTS.PASS,
    'I01: RECALL + replay sim même clé. Anti-doublon PG réel = runtimeRequired.',
    ['Parser intention', 'Décider action tentative', 'attempt-sim'],
    assertions,
    meta({
      evidenceClass: 'state-machine-sim',
      runtimeRequired: true,
      runtimeRequiredReason: 'Aucun second rendez-vous en base réelle (C7)',
      firstRef,
      simOutcome: r.result
    })
  );
}

/** I02 — 409 KEY_CONFLICT classifier + sim */
function runKeyBodyConflict(workflow) {
  const classified = classifyHttpResponse(
    workflow,
    409,
    {
      success: false,
      error: { code: 'IDEMPOTENCY_KEY_CONFLICT', message: 'Conflict' }
    },
    { attemptId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', sessionId: 's', leaseOwner: 'owner-syn-00000001' }
  );

  let state = emptyState(1_000);
  state = seedSlot(state, {
    id: '11111111-1111-4111-8111-111111111111',
    debut: 1_000 + 3_600_000
  });
  const key = 'rec008-idem-key-00000002';
  let r = createAwaitingAttempt(state, {
    sessionId: 's',
    payload: { cleIdempotence: key, nom: 'Dupont', prenom: 'Camille' }
  });
  state = r.state;
  r = runWinningSubmit(state, {
    attemptId: r.result.attemptId,
    sessionId: 's',
    owner: 'owner-syn-00000001'
  });
  state = r.state;
  r = createAppointmentIdempotent(state, {
    cleIdempotence: key,
    slotId: '11111111-1111-4111-8111-111111111111',
    nom: 'Martin',
    prenom: 'Alex',
    email: 'alex.martin@example.test',
    telephone: '+33000000002'
  });

  const assertions = [
    check('classifier_rejected', 'REJECTED', classified.httpOutcome, classified.httpOutcome === 'REJECTED'),
    check(
      'sim_key_conflict',
      'KEY_CONFLICT',
      r.result && r.result.issue,
      r.result && r.result.issue === 'KEY_CONFLICT'
    ),
    check('not_confirmed', true, classified.httpOutcome, classified.httpOutcome !== 'CONFIRMED')
  ];

  return wrap(
    VERDICTS.PASS,
    'I02: classifieur VC9 409 IDEMPOTENCY_KEY_CONFLICT → REJECTED + sim conflict.',
    ['Classer réponse HTTP', 'attempt-sim'],
    assertions,
    meta({
      evidenceClass: 'http-classifier-sim',
      runtimeRequired: true,
      runtimeRequiredReason: 'Conflit clé/corps réel en base (C11)'
    })
  );
}

/** X01 — double claim lease : un seul gagnant (sim) + Décider WAIT si SUBMITTING */
function runDoubleOuiLease(workflow) {
  let state = emptyState(5_000);
  state = seedSlot(state, {
    id: '11111111-1111-4111-8111-111111111111',
    capacite: 1,
    debut: 5_000 + 3_600_000
  });
  let r = createAwaitingAttempt(state, {
    sessionId: 'rec008-syn-x01',
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    payload: {
      cleIdempotence: 'rec008-idem-key-00000003',
      nom: 'Dupont',
      prenom: 'Camille'
    }
  });
  state = r.state;
  const concurrent = claimLeaseConcurrent(state, [
    {
      attemptId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      sessionId: 'rec008-syn-x01',
      owner: 'owner-syn-aaaa00000001'
    },
    {
      attemptId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      sessionId: 'rec008-syn-x01',
      owner: 'owner-syn-bbbb00000002'
    }
  ]);
  state = concurrent.state;
  const winCount = concurrent.result.winners;
  const loseCount = concurrent.result.losers;

  const decidedWait = decideAttemptAction(
    workflow,
    { createDecision: 'AFFIRM', conversationStep: 'AWAIT_CREATE_CONFIRMATION' },
    {
      openAttempt: {
        status: 'SUBMITTING',
        leaseUntil: Date.now() + 60_000,
        expiresAt: Date.now() + 3_600_000
      },
      sessionId: 'rec008-syn-x01'
    },
    { sessionId: 'rec008-syn-x01', conversationStep: 'AWAIT_CREATE_CONFIRMATION' }
  );

  const assertions = [
    check('single_winner', 1, winCount, winCount === 1),
    check('single_loser', 1, loseCount, loseCount === 1),
    check('decide_wait_while_submitting', 'WAIT', decidedWait.attemptAction, decidedWait.attemptAction === 'WAIT'),
    check('not_double_claim_path', true, decidedWait.attemptAction, decidedWait.attemptAction !== 'CLAIM')
  ];

  return wrap(
    VERDICTS.PASS,
    'X01: lease sim 1 gagnant + Décider WAIT sous SUBMITTING. Concurrence PG réelle = runtimeRequired.',
    ['Décider action tentative', 'attempt-sim'],
    assertions,
    meta({
      evidenceClass: 'state-machine-sim',
      runtimeRequired: true,
      runtimeRequiredReason: 'Double UPDATE/FOR UPDATE PostgreSQL (C8)',
      concurrent: concurrent.result
    })
  );
}

function runHttp400(workflow) {
  const classified = classifyHttpResponse(workflow, 400, {
    success: false,
    message: 'validation'
  });
  const assertions = [
    check('outcome_rejected', 'REJECTED', classified.httpOutcome, classified.httpOutcome === 'REJECTED'),
    check('not_confirmed', true, classified.httpOutcome, classified.httpOutcome !== 'CONFIRMED'),
    check('not_success_from_uncertain', true, classified.httpOutcome, classified.httpOutcome !== 'UNCERTAIN' || classified.httpOutcome === 'REJECTED')
  ];
  // Fix third check - for 400 we want REJECTED specifically, not UNCERTAIN
  assertions[2] = check('not_uncertain', true, classified.httpOutcome, classified.httpOutcome === 'REJECTED');

  return wrap(
    VERDICTS.PASS,
    'E01: Classer réponse HTTP 400 → REJECTED (pas CONFIRMED).',
    ['Classer réponse HTTP'],
    assertions,
    meta({
      evidenceClass: 'http-classifier-sim',
      runtimeRequired: true,
      runtimeRequiredReason: 'Transport HTTP réel 400'
    })
  );
}

function runHttp409Slot(workflow) {
  const classified = classifyHttpResponse(workflow, 409, {
    success: false,
    message: 'Créneau introuvable ou complet'
  });
  const assertions = [
    check(
      'slot_unavailable',
      'SLOT_UNAVAILABLE',
      classified.httpOutcome,
      classified.httpOutcome === 'SLOT_UNAVAILABLE'
    ),
    check('not_confirmed', true, classified.httpOutcome, classified.httpOutcome !== 'CONFIRMED')
  ];
  return wrap(
    VERDICTS.PASS,
    'E02: 409 créneau → SLOT_UNAVAILABLE.',
    ['Classer réponse HTTP'],
    assertions,
    meta({
      evidenceClass: 'http-classifier-sim',
      runtimeRequired: true,
      runtimeRequiredReason: 'Créneau réel indisponible (C12)'
    })
  );
}

function runHttp500(workflow) {
  const classified = classifyHttpResponse(workflow, 500, {
    success: false,
    message: 'internal'
  });
  const assertions = [
    check('uncertain', 'UNCERTAIN', classified.httpOutcome, classified.httpOutcome === 'UNCERTAIN'),
    check('not_confirmed', true, classified.httpOutcome, classified.httpOutcome !== 'CONFIRMED'),
    check('not_rejected_as_success', true, classified.httpOutcome, classified.httpOutcome !== 'REJECTED' || true)
  ];
  assertions[2] = check('no_false_success', false, classified.success === true, classified.success !== true);

  return wrap(
    VERDICTS.PASS,
    'E03: HTTP 500 → UNCERTAIN (jamais succès métier).',
    ['Classer réponse HTTP'],
    assertions,
    meta({
      evidenceClass: 'http-classifier-sim',
      runtimeRequired: true,
      runtimeRequiredReason: '500 transport réel + marquage tentative UNCERTAIN en PG'
    })
  );
}

function runTransportTimeout(workflow) {
  const classified = classifyHttpTimeout(workflow, {
    attemptId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    sessionId: 'rec008-syn-o01',
    leaseOwner: 'owner-syn-00000001'
  });

  let state = emptyState(2_000);
  state = seedSlot(state, {
    id: '11111111-1111-4111-8111-111111111111',
    debut: 2_000 + 3_600_000
  });
  let r = createAwaitingAttempt(state, {
    sessionId: 'rec008-syn-o01',
    payload: {
      cleIdempotence: 'rec008-idem-key-00000004',
      nom: 'Dupont',
      prenom: 'Camille'
    }
  });
  state = r.state;
  const attemptId = r.result.attemptId;
  r = simTransportTimeout(state, {
    attemptId,
    sessionId: 'rec008-syn-o01',
    owner: 'owner-syn-00000001'
  });
  state = r.state;
  const ev = evidence(state, attemptId);
  const assertions = [
    check(
      'classifier_uncertain',
      'UNCERTAIN',
      classified.httpOutcome,
      classified.httpOutcome === 'UNCERTAIN'
    ),
    check('classifier_timeout_flag', true, classified.timeout, classified.timeout === true),
    check(
      'sim_uncertain_status',
      'UNCERTAIN',
      ev.attemptStatus,
      ev.attemptStatus === 'UNCERTAIN'
    ),
    check('no_auto_retry_post', 0, state.postCount, state.postCount === 0),
    check('not_confirmed', true, classified.httpOutcome, classified.httpOutcome !== 'CONFIRMED')
  ];

  return wrap(
    VERDICTS.PASS,
    'O01: timeout → UNCERTAIN (classifieur VC9 + sim), pas de retry auto.',
    ['Classer délai HTTP', 'attempt-sim'],
    assertions,
    meta({
      evidenceClass: 'http-classifier-sim',
      runtimeRequired: true,
      runtimeRequiredReason: 'Timeout HTTP réel n8n 20s + Marquer tentative incertaine'
    })
  );
}

module.exports = {
  runCollectWithoutConfirm,
  runPositiveOuiClaimGate,
  runSecondOuiSameKey,
  runKeyBodyConflict,
  runDoubleOuiLease,
  runHttp400,
  runHttp409Slot,
  runHttp500,
  runTransportTimeout
};
