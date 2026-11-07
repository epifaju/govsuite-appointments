'use strict';

/**
 * EXPLICIT-RESUME-FIX-008 — assertions offline.
 * Charge le jsCode du candidat via workflow passé (loadVc9Workflow relativePath).
 * Ne copie PAS le correctif dans ce fichier.
 * Pas de réseau / n8n / SQL réel / POST CreateAppointment.
 */

const path = require('path');
const { VERDICTS } = require('../verdicts.cjs');
const { runConversationTurn, runCodeNode } = require('../node-runtime.cjs');
const { simulateSaveMerge } = require('../sql-contracts.cjs');
const {
  nodeContentSha,
  codeOf,
  loadVc9Workflow,
  sha256File,
  EXPECTED_SHA256: VC9_FILE_SHA256
} = require('../workflow-source.cjs');
const {
  runAbandon,
  runModifyField,
  runUncertainResumeFlag,
  runAwaitConfirmationNoReserve
} = require('./vc9-turn.cjs');
const { runPositiveOuiClaimGate } = require('./coverage-004.cjs');

const GERER = 'Gérer collecte progressive';
const DEMANDER = 'Demander paramètres création';

const CANDIDATE_REL = path.join(
  'n8n',
  'proposed',
  '2026-11-02-rec008-explicit-resume-fix-008',
  'after-OCD9It1uKFhOoWNF.json'
);

const EXPECTED_CANDIDATE_FILE_SHA256 =
  '849201ddd7cb17c158de292ed5479bfd024d83ac89b9a1f135b9422ae973618c';

const EXPECTED_CANDIDATE_GERER_SHA256 =
  'f75d49849231f956bb9ae5383111ea84b362dc58de6711cc75d2e7e2a26917fe';

const VC9_RESUME_ALLOWLIST = Object.freeze([
  'reprendre',
  'reprendre ma demande',
  'continuer',
  'continuer ma demande'
]);

const NON_ALLOWLIST_PROBE = 'je veux reprendre';

function check(id, expected, observed, ok) {
  return {
    id,
    expected,
    observed,
    verdict: ok ? VERDICTS.PASS : VERDICTS.FAIL
  };
}

function wrap(assertions, reasonPass, reasonFail, nodes, observed) {
  const failed = assertions.some((a) => a.verdict === VERDICTS.FAIL);
  return {
    verdict: failed ? VERDICTS.FAIL : VERDICTS.PASS,
    reason: failed ? reasonFail : reasonPass,
    nodes: nodes || [],
    assertions,
    observed: Object.assign(
      {
        simulation: true,
        runtimeRequired: true,
        suite: 'FIX-008',
        evidenceLimits:
          'VM jsCode only — HTTP réel, TTL PG, CLAIM/POST mock counters hors périmètre offline.'
      },
      observed || {}
    )
  };
}

function basePrevious(step, extra) {
  return Object.assign(
    {
      session_id: 'rec008-syn-fix008-01',
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

function expiredPrevious(step, extra) {
  return basePrevious(
    step,
    Object.assign(
      {
        session_expired: true,
        sessionExpired: true,
        intent: 'GENERAL',
        expires_at: '2026-10-31T00:00:00.000Z'
      },
      extra || {}
    )
  );
}

function isNullish(v) {
  return v == null || v === '';
}

function assertNoClaimPost(turn, prefix) {
  return [
    check(prefix + '_no_claim_post', false, turn.claimOrPost, turn.claimOrPost === false),
    check(
      prefix + '_no_create_appt',
      false,
      turn.wouldCallCreateAppointment,
      turn.wouldCallCreateAppointment === false
    )
  ];
}

function assertResumeFlags(turn, prefix) {
  return [
    check(prefix + '_ttl_refresh', true, turn.managed.refreshSessionTtl, turn.managed.refreshSessionTtl === true),
    check(prefix + '_expired_cleared', false, turn.managed.sessionExpired, turn.managed.sessionExpired === false),
    check(prefix + '_preserve_draft', true, turn.managed.preserveDraft, turn.managed.preserveDraft === true),
    check(
      prefix + '_intent_create',
      'CREATE_APPOINTMENT',
      turn.managed.intent,
      turn.managed.intent === 'CREATE_APPOINTMENT'
    ),
    check(
      prefix + '_pending_create',
      'CREATE_APPOINTMENT',
      turn.managed.pendingAction,
      turn.managed.pendingAction === 'CREATE_APPOINTMENT'
    )
  ];
}

/** Clone workflow and strip FIX-008 early-return (garde-fou muté). */
function stripFix008EarlyReturn(workflow) {
  const wf = JSON.parse(JSON.stringify(workflow));
  const node = wf.nodes.find((n) => n.name === GERER);
  if (!node || !node.parameters || !node.parameters.jsCode) {
    throw new Error('Gérer jsCode absent for strip mutation');
  }
  const code = node.parameters.jsCode;
  const marker = '// EXPLICIT-RESUME-FIX-008: early return AFTER flags, BEFORE field capture';
  const mi = code.indexOf(marker);
  if (mi < 0) {
    throw new Error('FIX-008 early-return marker absent — cannot mutate');
  }
  const returnIdx = code.indexOf('  return [{', mi);
  if (returnIdx < 0) {
    throw new Error('FIX-008 early-return block absent');
  }
  const endIdx = code.indexOf('}];\n', returnIdx);
  if (endIdx < 0) {
    throw new Error('FIX-008 early-return terminator absent');
  }
  node.parameters.jsCode = code.slice(0, returnIdx) + code.slice(endIdx + '}];\n'.length);
  return wf;
}

function extractAllowlistFromGerer(workflow) {
  const code = codeOf(workflow, GERER);
  const m = code.match(
    /explicitResumeMsg\s*=\s*\[([^\]]+)\]\s*\.includes\(resumeFolded\)/
  );
  if (!m) return null;
  const raw = m[1];
  const items = [];
  const re = /'([^']+)'/g;
  let hit;
  while ((hit = re.exec(raw))) items.push(hit[1]);
  return items;
}

function runAllowlistInvariant(workflow) {
  const observed = extractAllowlistFromGerer(workflow);
  const assertions = [
    check(
      'allowlist_present',
      'array',
      observed,
      Array.isArray(observed)
    ),
    check(
      'allowlist_exact_length',
      VC9_RESUME_ALLOWLIST.length,
      observed && observed.length,
      Array.isArray(observed) && observed.length === VC9_RESUME_ALLOWLIST.length
    ),
    check(
      'allowlist_exact_members',
      VC9_RESUME_ALLOWLIST.slice(),
      observed,
      Array.isArray(observed) &&
        observed.length === VC9_RESUME_ALLOWLIST.length &&
        VC9_RESUME_ALLOWLIST.every((x, i) => observed[i] === x)
    )
  ];
  return wrap(
    assertions,
    'Allowlist VC9 resume inchangée (4 phrases)',
    'Allowlist élargie ou altérée',
    [GERER],
    { allowlist: observed }
  );
}

/** S01 — active ASK_PRENOM + Camille → ASK_EMAIL */
function runS01ActiveCamille(workflow) {
  const previous = basePrevious('ASK_PRENOM', {
    session_id: 'rec008-syn-fix008-s01'
  });
  const turn = runConversationTurn(workflow, {
    previous,
    message: 'Camille',
    llmIntent: 'GET_SERVICES',
    withReply: false
  });
  const assertions = [
    check('s01_prenom', 'Camille', turn.managed.prenom, turn.managed.prenom === 'Camille'),
    check('s01_nom', 'Dupont', turn.managed.nom, turn.managed.nom === 'Dupont'),
    check('s01_step', 'ASK_EMAIL', turn.managed.conversationStep, turn.managed.conversationStep === 'ASK_EMAIL'),
    check(
      's01_pending',
      'CREATE_APPOINTMENT',
      turn.managed.pendingAction,
      turn.managed.pendingAction === 'CREATE_APPOINTMENT'
    ),
    ...assertNoClaimPost(turn, 's01')
  ];
  return wrap(assertions, 'S01 active Camille → ASK_EMAIL OK', 'S01 failed', turn.nodes, {
    scenario: 'S01'
  });
}

/** S02 — expired + Camille → session_expired, prenom null */
function runS02ExpiredCamille(workflow) {
  const previous = expiredPrevious('ASK_PRENOM', {
    session_id: 'rec008-syn-fix008-s02'
  });
  const turn = runConversationTurn(workflow, {
    previous,
    message: 'Camille',
    llmIntent: 'GET_SERVICES',
    sessionExpired: true,
    withReply: true
  });
  const assertions = [
    check('s02_expired', true, turn.managed.sessionExpired, turn.managed.sessionExpired === true),
    check('s02_no_ttl', false, turn.managed.refreshSessionTtl, turn.managed.refreshSessionTtl === false),
    check('s02_preserve', true, turn.managed.preserveDraft, turn.managed.preserveDraft === true),
    check('s02_step', 'ASK_PRENOM', turn.managed.conversationStep, turn.managed.conversationStep === 'ASK_PRENOM'),
    check('s02_prenom_null', null, turn.managed.prenom, isNullish(turn.managed.prenom)),
    check(
      's02_reply',
      'session_expired',
      turn.reply && turn.reply.type,
      turn.reply && turn.reply.type === 'session_expired'
    ),
    ...assertNoClaimPost(turn, 's02')
  ];
  return wrap(assertions, 'S02 expired Camille → session_expired OK', 'S02 failed', turn.nodes, {
    scenario: 'S02'
  });
}

/**
 * S03 fixed contract — expired + resume phrase → TTL+, ASK_PRENOM, prenom null.
 * message defaults to « reprendre »; allowlist variants pass the same contract.
 */
function runS03ExpiredResumeFixed(workflow, message) {
  const msg = message || 'reprendre';
  const previous = expiredPrevious('ASK_PRENOM', {
    session_id: 'rec008-syn-fix008-s03'
  });
  const turn = runConversationTurn(workflow, {
    previous,
    message: msg,
    llmIntent: 'GENERAL',
    sessionExpired: true,
    withReply: false
  });
  const assertions = [
    ...assertResumeFlags(turn, 's03'),
    check('s03_step_ask_prenom', 'ASK_PRENOM', turn.managed.conversationStep, turn.managed.conversationStep === 'ASK_PRENOM'),
    check('s03_prenom_null', null, turn.managed.prenom, isNullish(turn.managed.prenom)),
    check('s03_nom_preserved', 'Dupont', turn.managed.nom, turn.managed.nom === 'Dupont'),
    check(
      's03_prenom_not_message',
      true,
      turn.managed.prenom,
      String(turn.managed.prenom || '').toLowerCase() !== String(msg).toLowerCase()
    ),
    ...assertNoClaimPost(turn, 's03')
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
      refreshSessionTtl: turn.managed.refreshSessionTtl,
      preserveDraft: turn.managed.preserveDraft
    }
  );
  assertions.push(
    check(
      's03_save_step_kept',
      'ASK_PRENOM',
      saveSim.row.conversation_step,
      saveSim.row.conversation_step === 'ASK_PRENOM'
    ),
    check(
      's03_save_ttl_refreshed',
      true,
      saveSim.row.expires_at !== previous.expires_at,
      saveSim.row.expires_at !== previous.expires_at
    )
  );

  // Invite prénom via nœud Demander paramètres (pas Réponse générale)
  let invite = null;
  let inviteNodes = [];
  try {
    invite = runCodeNode(workflow, DEMANDER, turn.managed, {
      'Gérer collecte progressive': turn.managed
    });
    inviteNodes = [DEMANDER];
    assertions.push(
      check(
        's03_invite_mentions_prenom',
        true,
        invite && invite.text,
        !!(invite && /prénom/i.test(String(invite.text || '')))
      ),
      check(
        's03_invite_step',
        'ASK_PRENOM',
        invite && invite.conversationStep,
        invite &&
          (invite.conversationStep === 'ASK_PRENOM' || invite.conversationStep == null)
      )
    );
  } catch (err) {
    assertions.push(
      check('s03_invite_node', 'ran', String(err.message || err), false)
    );
  }

  return wrap(
    assertions,
    'S03 expired resume → ASK_PRENOM + prenom null OK',
    'S03 fixed contract failed',
    turn.nodes.concat(['Sauvegarder état conversation (simulation)']).concat(inviteNodes),
    {
      scenario: 'S03',
      resumeMessage: msg,
      managed: {
        conversationStep: turn.managed.conversationStep,
        prenom: turn.managed.prenom,
        refreshSessionTtl: turn.managed.refreshSessionTtl
      },
      inviteTextPreview: invite && String(invite.text || '').slice(0, 80)
    }
  );
}

/** S03 allowlist — les 4 phrases VC9 passent ; hors allowlist ≠ reprise */
function runS03AllowlistVariants(workflow) {
  const assertions = [];
  const observed = [];
  for (const msg of VC9_RESUME_ALLOWLIST) {
    const r = runS03ExpiredResumeFixed(workflow, msg);
    observed.push({
      message: msg,
      verdict: r.verdict,
      step: r.observed && r.observed.managed && r.observed.managed.conversationStep,
      prenom: r.observed && r.observed.managed && r.observed.managed.prenom
    });
    assertions.push(
      check('s03_variant_' + msg.replace(/\s+/g, '_'), VERDICTS.PASS, r.verdict, r.verdict === VERDICTS.PASS)
    );
  }

  const previous = expiredPrevious('ASK_PRENOM', {
    session_id: 'rec008-syn-fix008-s03-nonallow'
  });
  const turn = runConversationTurn(workflow, {
    previous,
    message: NON_ALLOWLIST_PROBE,
    llmIntent: 'GENERAL',
    sessionExpired: true,
    withReply: true
  });
  assertions.push(
    check(
      's03_non_allowlist_still_expired',
      true,
      turn.managed.sessionExpired,
      turn.managed.sessionExpired === true
    ),
    check(
      's03_non_allowlist_no_ttl',
      false,
      turn.managed.refreshSessionTtl,
      turn.managed.refreshSessionTtl === false
    ),
    check(
      's03_non_allowlist_reply',
      'session_expired',
      turn.reply && turn.reply.type,
      turn.reply && turn.reply.type === 'session_expired'
    ),
    check('s03_non_allowlist_prenom_null', null, turn.managed.prenom, isNullish(turn.managed.prenom))
  );

  const allow = runAllowlistInvariant(workflow);
  assertions.push(...allow.assertions);

  return wrap(
    assertions,
    'S03 allowlist variants OK (sans élargissement)',
    'S03 allowlist variants failed',
    [GERER, 'Réponse générale'],
    { scenario: 'S03-allowlist', variants: observed, nonAllowlist: NON_ALLOWLIST_PROBE }
  );
}

/** S04 — ASK_NOM + reprendre → nom non capturé */
function runS04AskNomResume(workflow) {
  const previous = expiredPrevious('ASK_NOM', {
    session_id: 'rec008-syn-fix008-s04',
    nom: null
  });
  const turn = runConversationTurn(workflow, {
    previous,
    message: 'reprendre',
    llmIntent: 'GENERAL',
    sessionExpired: true,
    withReply: false
  });
  const assertions = [
    ...assertResumeFlags(turn, 's04'),
    check('s04_step', 'ASK_NOM', turn.managed.conversationStep, turn.managed.conversationStep === 'ASK_NOM'),
    check('s04_nom_null', null, turn.managed.nom, isNullish(turn.managed.nom)),
    check(
      's04_nom_not_reprendre',
      true,
      turn.managed.nom,
      String(turn.managed.nom || '').toLowerCase() !== 'reprendre'
    ),
    ...assertNoClaimPost(turn, 's04')
  ];
  return wrap(assertions, 'S04 ASK_NOM resume — nom non capturé', 'S04 failed', turn.nodes, {
    scenario: 'S04'
  });
}

/** S05 — ASK_EMAIL + reprendre → email non capturé */
function runS05AskEmailResume(workflow) {
  const previous = expiredPrevious('ASK_EMAIL', {
    session_id: 'rec008-syn-fix008-s05',
    prenom: 'Camille'
  });
  const turn = runConversationTurn(workflow, {
    previous,
    message: 'reprendre',
    llmIntent: 'GENERAL',
    sessionExpired: true,
    withReply: false
  });
  const assertions = [
    ...assertResumeFlags(turn, 's05'),
    check('s05_step', 'ASK_EMAIL', turn.managed.conversationStep, turn.managed.conversationStep === 'ASK_EMAIL'),
    check('s05_email_null', null, turn.managed.email, isNullish(turn.managed.email)),
    check('s05_prenom_kept', 'Camille', turn.managed.prenom, turn.managed.prenom === 'Camille'),
    ...assertNoClaimPost(turn, 's05')
  ];
  return wrap(assertions, 'S05 ASK_EMAIL resume — email non capturé', 'S05 failed', turn.nodes, {
    scenario: 'S05'
  });
}

/** S06 — ASK_TELEPHONE + reprendre → tel non capturé */
function runS06AskTelephoneResume(workflow) {
  const previous = expiredPrevious('ASK_TELEPHONE', {
    session_id: 'rec008-syn-fix008-s06',
    prenom: 'Camille',
    email: 'camille.dupont@example.test'
  });
  const turn = runConversationTurn(workflow, {
    previous,
    message: 'reprendre',
    llmIntent: 'GENERAL',
    sessionExpired: true,
    withReply: false
  });
  const assertions = [
    ...assertResumeFlags(turn, 's06'),
    check(
      's06_step',
      'ASK_TELEPHONE',
      turn.managed.conversationStep,
      turn.managed.conversationStep === 'ASK_TELEPHONE'
    ),
    check('s06_tel_null', null, turn.managed.telephone, isNullish(turn.managed.telephone)),
    ...assertNoClaimPost(turn, 's06')
  ];
  return wrap(assertions, 'S06 ASK_TELEPHONE resume — tel non capturé', 'S06 failed', turn.nodes, {
    scenario: 'S06'
  });
}

/** S07 — ASK_CREATE_SERVICE + reprendre → step conservé, service null (P4G2) */
function runS07AskCreateServiceResume(workflow) {
  const previous = expiredPrevious('ASK_CREATE_SERVICE', {
    session_id: 'rec008-syn-fix008-s07',
    service: null,
    site: null,
    date_debut: null,
    date_fin: null,
    slot_id: null,
    selected_slot_index: null,
    nom: null,
    prenom: null,
    email: null,
    telephone: null
  });
  const turn = runConversationTurn(workflow, {
    previous,
    message: 'reprendre',
    llmIntent: 'GENERAL',
    sessionExpired: true,
    withReply: false
  });
  const assertions = [
    ...assertResumeFlags(turn, 's07'),
    check(
      's07_step',
      'ASK_CREATE_SERVICE',
      turn.managed.conversationStep,
      turn.managed.conversationStep === 'ASK_CREATE_SERVICE'
    ),
    check('s07_service_null', null, turn.managed.service, isNullish(turn.managed.service)),
    check(
      's07_service_not_reprendre',
      true,
      turn.managed.service,
      String(turn.managed.service || '').toLowerCase() !== 'reprendre'
    ),
    ...assertNoClaimPost(turn, 's07')
  ];
  return wrap(
    assertions,
    'S07 ASK_CREATE_SERVICE resume — step conservé / service null',
    'S07 failed',
    turn.nodes,
    { scenario: 'S07' }
  );
}

/** S08 — oui/non confirmation / abandon (non-régression) */
function runS08ConfirmAbandon(workflow) {
  const abandon = runAbandon(workflow);
  const awaitNo = runAwaitConfirmationNoReserve(workflow);
  const affirm = runPositiveOuiClaimGate(workflow);
  const assertions = [
    check('s08_abandon', VERDICTS.PASS, abandon.verdict, abandon.verdict === VERDICTS.PASS),
    check('s08_await_no_reserve', VERDICTS.PASS, awaitNo.verdict, awaitNo.verdict === VERDICTS.PASS),
    check('s08_affirm_claim_gate', VERDICTS.PASS, affirm.verdict, affirm.verdict === VERDICTS.PASS)
  ];
  if (abandon.assertions) assertions.push(...abandon.assertions.map((a) => Object.assign({}, a, { id: 's08_ab_' + a.id })));
  if (awaitNo.assertions) {
    assertions.push(...awaitNo.assertions.map((a) => Object.assign({}, a, { id: 's08_aw_' + a.id })));
  }
  return wrap(
    assertions,
    'S08 confirmation/abandon non-régression OK',
    'S08 failed',
    (abandon.nodes || []).concat(awaitNo.nodes || []).concat(affirm.nodes || []),
    { scenario: 'S08' }
  );
}

/** S09 — modify field (non-régression) */
function runS09ModifyField(workflow) {
  const r = runModifyField(workflow);
  const assertions = (r.assertions || []).map((a) => Object.assign({}, a, { id: 's09_' + a.id }));
  return wrap(
    assertions.length ? assertions : [check('s09_modify', VERDICTS.PASS, r.verdict, r.verdict === VERDICTS.PASS)],
    'S09 modify field OK',
    'S09 failed',
    r.nodes,
    { scenario: 'S09' }
  );
}

/** S10 — CLAIM/POST/UNCERTAIN no regress */
function runS10ClaimPostUncertain(workflow) {
  const uncertain = runUncertainResumeFlag(workflow);
  const awaitNo = runAwaitConfirmationNoReserve(workflow);
  const previous = expiredPrevious('ASK_PRENOM', { session_id: 'rec008-syn-fix008-s10' });
  const resume = runConversationTurn(workflow, {
    previous,
    message: 'reprendre',
    llmIntent: 'GENERAL',
    sessionExpired: true,
    withReply: false
  });
  const assertions = [
    check('s10_uncertain', VERDICTS.PASS, uncertain.verdict, uncertain.verdict === VERDICTS.PASS),
    check('s10_await', VERDICTS.PASS, awaitNo.verdict, awaitNo.verdict === VERDICTS.PASS),
    ...assertNoClaimPost(resume, 's10_resume'),
    check(
      's10_resume_no_create',
      false,
      resume.wouldCallCreateAppointment,
      resume.wouldCallCreateAppointment === false
    )
  ];
  if (uncertain.assertions) {
    assertions.push(...uncertain.assertions.map((a) => Object.assign({}, a, { id: 's10_u_' + a.id })));
  }
  return wrap(
    assertions,
    'S10 CLAIM/POST/UNCERTAIN no regress OK',
    'S10 failed',
    (uncertain.nodes || []).concat(awaitNo.nodes || []).concat(resume.nodes || []),
    { scenario: 'S10' }
  );
}

/** Négatif : VC9 original doit ÉCHOUER le contrat S03 fixé */
function runNegOriginalS03Fails(originalWorkflow) {
  const r = runS03ExpiredResumeFixed(originalWorkflow, 'reprendre');
  const ok = r.verdict === VERDICTS.FAIL;
  return {
    verdict: ok ? VERDICTS.PASS : VERDICTS.FAIL,
    reason: ok
      ? 'Negative OK — original VC9 fails fixed S03 (capture reprendre)'
      : 'Unexpected — original VC9 passed fixed S03',
    nodes: r.nodes,
    assertions: [
      check('neg_original_s03_fails', VERDICTS.FAIL, r.verdict, ok),
      ...(r.assertions || []).map((a) => Object.assign({}, a, { id: 'neg_orig_' + a.id }))
    ],
    observed: {
      simulation: true,
      suite: 'FIX-008',
      scenario: 'N-original-S03-fail',
      innerVerdict: r.verdict,
      managed: r.observed && r.observed.managed
    }
  };
}

/** Négatif : strip early-return sur candidat → S03 doit échouer */
function runNegStrippedGuardFails(candidateWorkflow) {
  const mutated = stripFix008EarlyReturn(candidateWorkflow);
  const codeMut = codeOf(mutated, GERER);
  const mi = codeMut.indexOf('EXPLICIT-RESUME-FIX-008');
  const nextReturn = mi >= 0 ? codeMut.indexOf('  return [{', mi) : -1;
  // Après strip : pas de return immédiat après le marqueur (fenêtre ~350 chars = flags only).
  const hasEarlyReturnStill = nextReturn >= 0 && nextReturn - mi < 350;
  const r = runS03ExpiredResumeFixed(mutated, 'reprendre');
  const ok = r.verdict === VERDICTS.FAIL && !hasEarlyReturnStill;
  return {
    verdict: ok ? VERDICTS.PASS : VERDICTS.FAIL,
    reason: ok
      ? 'Negative OK — stripped early-return fails fixed S03'
      : 'Unexpected — stripped guard still passes S03 or strip incomplete',
    nodes: r.nodes,
    assertions: [
      check('neg_strip_return_removed', false, hasEarlyReturnStill, !hasEarlyReturnStill),
      check('neg_strip_s03_fails', VERDICTS.FAIL, r.verdict, r.verdict === VERDICTS.FAIL)
    ],
    observed: {
      simulation: true,
      suite: 'FIX-008',
      scenario: 'N-stripped-early-return-fail',
      innerVerdict: r.verdict,
      managed: r.observed && r.observed.managed
    }
  };
}

/** Candidat : empreinte Gérer attendue */
function runCandidateFingerprint(workflow, fileSha256) {
  const gererSha = nodeContentSha(workflow, GERER);
  const assertions = [
    check(
      'candidate_gerer_sha',
      EXPECTED_CANDIDATE_GERER_SHA256,
      gererSha,
      gererSha === EXPECTED_CANDIDATE_GERER_SHA256
    )
  ];
  if (fileSha256) {
    assertions.push(
      check(
        'candidate_file_sha',
        EXPECTED_CANDIDATE_FILE_SHA256,
        fileSha256,
        fileSha256 === EXPECTED_CANDIDATE_FILE_SHA256
      )
    );
  }
  const code = codeOf(workflow, GERER);
  assertions.push(
    check(
      'candidate_has_early_return_marker',
      true,
      code.includes('EXPLICIT-RESUME-FIX-008'),
      code.includes('EXPLICIT-RESUME-FIX-008')
    )
  );
  return wrap(
    assertions,
    'Fingerprint candidat FIX-008 OK',
    'Fingerprint candidat mismatch',
    [GERER],
    { scenario: 'fingerprint', gererSha, fileSha256: fileSha256 || null }
  );
}

function runNegCandidateS03Passes(candidateWorkflow) {
  const r = runS03ExpiredResumeFixed(candidateWorkflow, 'reprendre');
  const ok = r.verdict === VERDICTS.PASS;
  return {
    verdict: ok ? VERDICTS.PASS : VERDICTS.FAIL,
    reason: ok
      ? 'Negative OK — candidate passes fixed S03'
      : 'Candidate failed fixed S03',
    nodes: r.nodes,
    assertions: [check('neg_candidate_s03_pass', VERDICTS.PASS, r.verdict, ok)],
    observed: {
      simulation: true,
      suite: 'FIX-008',
      scenario: 'N-candidate-S03-pass',
      innerVerdict: r.verdict
    }
  };
}

function runNegNoRegressS01S02S07(candidateWorkflow) {
  const a = runS01ActiveCamille(candidateWorkflow);
  const b = runS02ExpiredCamille(candidateWorkflow);
  const c = runS07AskCreateServiceResume(candidateWorkflow);
  const ok =
    a.verdict === VERDICTS.PASS && b.verdict === VERDICTS.PASS && c.verdict === VERDICTS.PASS;
  return {
    verdict: ok ? VERDICTS.PASS : VERDICTS.FAIL,
    reason: ok
      ? 'Negative OK — S01/S02/S07 no regress on candidate'
      : 'Regression on S01/S02/S07',
    nodes: (a.nodes || []).concat(b.nodes || []).concat(c.nodes || []),
    assertions: [
      check('neg_s01', VERDICTS.PASS, a.verdict, a.verdict === VERDICTS.PASS),
      check('neg_s02', VERDICTS.PASS, b.verdict, b.verdict === VERDICTS.PASS),
      check('neg_s07', VERDICTS.PASS, c.verdict, c.verdict === VERDICTS.PASS)
    ],
    observed: { simulation: true, suite: 'FIX-008', scenario: 'N-no-regress-S01-S02-S07' }
  };
}

function loadCandidateAndOriginal() {
  const original = loadVc9Workflow();
  const candidate = loadVc9Workflow({
    relativePath: CANDIDATE_REL,
    skipShaCheck: true,
    skipVersionCheck: true
  });
  const fileSha = sha256File(candidate.path);
  return { original, candidate, fileSha };
}

function runAllFix008() {
  const { original, candidate, fileSha } = loadCandidateAndOriginal();
  const wf = candidate.workflow;
  const orig = original.workflow;

  const cases = [
    { id: 'FIX008-fingerprint', run: () => runCandidateFingerprint(wf, fileSha) },
    { id: 'FIX008-S01', run: () => runS01ActiveCamille(wf) },
    { id: 'FIX008-S02', run: () => runS02ExpiredCamille(wf) },
    { id: 'FIX008-S03', run: () => runS03ExpiredResumeFixed(wf) },
    { id: 'FIX008-S03-variants', run: () => runS03AllowlistVariants(wf) },
    { id: 'FIX008-S04', run: () => runS04AskNomResume(wf) },
    { id: 'FIX008-S05', run: () => runS05AskEmailResume(wf) },
    { id: 'FIX008-S06', run: () => runS06AskTelephoneResume(wf) },
    { id: 'FIX008-S07', run: () => runS07AskCreateServiceResume(wf) },
    { id: 'FIX008-S08', run: () => runS08ConfirmAbandon(wf) },
    { id: 'FIX008-S09', run: () => runS09ModifyField(wf) },
    { id: 'FIX008-S10', run: () => runS10ClaimPostUncertain(wf) },
    { id: 'FIX008-N-original-S03', run: () => runNegOriginalS03Fails(orig) },
    { id: 'FIX008-N-candidate-S03', run: () => runNegCandidateS03Passes(wf) },
    { id: 'FIX008-N-strip-guard', run: () => runNegStrippedGuardFails(wf) },
    { id: 'N-no-regress-S01-S02-S07', run: () => runNegNoRegressS01S02S07(wf) }
  ];

  const results = [];
  for (const c of cases) {
    let outcome;
    try {
      outcome = c.run();
    } catch (err) {
      outcome = {
        verdict: VERDICTS.ERROR,
        reason: err.message,
        assertions: [],
        nodes: [],
        observed: { error: String(err.message || err) }
      };
    }
    results.push(Object.assign({ id: c.id }, outcome));
  }

  const failedIds = results
    .filter((r) => r.verdict !== VERDICTS.PASS)
    .map((r) => r.id);
  return {
    verdict: failedIds.length ? VERDICTS.FAIL : VERDICTS.PASS,
    results,
    failedIds,
    candidateSha256: fileSha,
    expectedCandidateSha256: EXPECTED_CANDIDATE_FILE_SHA256,
    originalSha256: original.sha256 || VC9_FILE_SHA256,
    candidatePath: candidate.path,
    originalPath: original.path
  };
}

module.exports = {
  GERER,
  DEMANDER,
  CANDIDATE_REL,
  EXPECTED_CANDIDATE_FILE_SHA256,
  EXPECTED_CANDIDATE_GERER_SHA256,
  VC9_RESUME_ALLOWLIST,
  NON_ALLOWLIST_PROBE,
  stripFix008EarlyReturn,
  extractAllowlistFromGerer,
  runAllowlistInvariant,
  runS01ActiveCamille,
  runS02ExpiredCamille,
  runS03ExpiredResumeFixed,
  runS03AllowlistVariants,
  runS04AskNomResume,
  runS05AskEmailResume,
  runS06AskTelephoneResume,
  runS07AskCreateServiceResume,
  runS08ConfirmAbandon,
  runS09ModifyField,
  runS10ClaimPostUncertain,
  runNegOriginalS03Fails,
  runNegCandidateS03Passes,
  runNegStrippedGuardFails,
  runNegNoRegressS01S02S07,
  runCandidateFingerprint,
  loadCandidateAndOriginal,
  runAllFix008,
  basePrevious,
  expiredPrevious
};
