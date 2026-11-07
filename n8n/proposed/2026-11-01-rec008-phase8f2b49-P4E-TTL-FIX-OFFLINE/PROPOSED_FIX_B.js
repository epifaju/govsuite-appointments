/**
 * PROPOSED_FIX_B.js
 * Phase 8F-2B49-P4E — HORS LIGNE / NON INSTALLÉ
 *
 * Correctif de routage déterministe :
 *  - session ACTIVE en collecte identité → forcer CREATE_APPOINTMENT
 *    (sauf commandes explicites : oui/non/modifier/abandon/restart)
 *  - session EXPIRÉE sans tentative ouverte → NE PAS continuer silencieusement,
 *    NE PAS forcer CREATE, NE PAS laisser GET_SERVICES purger le brouillon ;
 *    intent GENERAL + sessionExpiredDecision
 *  - reprise explicite autorisée → refreshSessionTtl + reprise de l'étape
 *  - tentative ouverte (UNCERTAIN/SUBMITTING/AWAITING) → règles existantes
 *
 * Emplacements d'intégration proposés (install future TEST only) :
 *  1) Joindre tentative de session — normaliser les drapeaux Fix A
 *  2) Parser intention — verrou CREATE + garde session expirée
 *  3) Gérer collecte progressive — branche sessionExpired + preserveDraft
 *  4) Réponse générale — message d'expiration (texte public sans flags techniques)
 */

'use strict';

const IDENTITY_STEPS = [
  'ASK_NOM',
  'ASK_PRENOM',
  'ASK_EMAIL',
  'ASK_TELEPHONE',
  'ASK_CREATE_SLOT',
];

const AFFIRMATIVE = new Set([
  'oui',
  'oui je confirme',
  'je confirme',
  'confirmer',
  "d'accord",
  'daccord',
  'ok',
  'yes',
]);

const NEGATIVE = new Set([
  'non',
  'non merci',
  'je ne confirme pas',
  'annuler',
  'annuler la demande',
  'abandonner',
  'stop',
]);

const EXPLICIT_RESUME = new Set([
  'reprendre',
  'reprendre ma demande',
  'continuer',
  'continuer ma demande',
]);

function stripDecision(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.!?;:,]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function modifyFieldOf(value) {
  const exact = {
    modifier: 'nom',
    'modifier le nom': 'nom',
    'modifier le prenom': 'prenom',
    "modifier l'adresse": 'email',
    'modifier ladresse': 'email',
    'modifier le telephone': 'telephone',
    'modifier le creneau': 'creneau',
    'autre creneau': 'creneau',
  };
  if (exact[value]) return exact[value];
  if (value.includes('change le prenom') || value.includes('changer le prenom')) return 'prenom';
  if (value.includes('change le nom') || value.includes('changer le nom')) return 'nom';
  if (value.includes('change') && (value.includes('adresse') || value.includes('mail'))) return 'email';
  if (value.includes('change') && value.includes('telephone')) return 'telephone';
  if (value.includes('change') && value.includes('creneau')) return 'creneau';
  if (value.includes('modifier') || value.includes('autre creneau')) return 'nom';
  return null;
}

function isExplicitRestart(folded) {
  return (
    /\b(prendre|reserver|creer)\b/.test(folded) && /\b(rendez-vous|rdv)\b/.test(folded)
  );
}

function normalizeSessionFlags(loadedRow, triggerSessionId) {
  const hasId =
    !!(loadedRow && (loadedRow.session_id || loadedRow.sessionId || loadedRow.session_found));
  const sessionFound =
    loadedRow &&
    (loadedRow.session_found === true ||
      loadedRow.sessionFound === true ||
      !!(loadedRow.session_id || loadedRow.sessionId || loadedRow.pending_action || loadedRow.conversation_step));

  const expiresAt =
    loadedRow.session_expires_at ||
    loadedRow.sessionExpiresAt ||
    loadedRow.expires_at ||
    loadedRow.expiresAt ||
    null;

  let sessionExpired = false;
  if (typeof loadedRow.session_expired === 'boolean') {
    sessionExpired = loadedRow.session_expired;
  } else if (typeof loadedRow.sessionExpired === 'boolean') {
    sessionExpired = loadedRow.sessionExpired;
  } else if (expiresAt) {
    sessionExpired = new Date(expiresAt).getTime() <= Date.now();
  }

  return {
    sessionId:
      loadedRow.session_id ||
      loadedRow.sessionId ||
      triggerSessionId ||
      null,
    sessionFound: !!sessionFound || !!hasId,
    sessionExpired: !!sessionFound && !!sessionExpired,
    sessionExpiresAt: expiresAt,
    conversationStep: loadedRow.conversation_step || loadedRow.conversationStep || null,
    pendingAction: loadedRow.pending_action || loadedRow.pendingAction || null,
  };
}

/**
 * Décision de routage conversationnel (cœur Fix B).
 * @returns {object} decision technique — ne pas exposer telle quelle au public
 */
function routeConversation({
  previous,
  llmIntent,
  message,
  nowMs = Date.now(),
}) {
  const originalMessage = String(message || '').trim();
  const decisionText = stripDecision(originalMessage);
  const decisionFolded = decisionText.replace(/[’']/g, '');
  const flags = normalizeSessionFlags(previous || {}, previous && previous.sessionId);
  const openAttempt = (previous && previous.openAttempt) || null;
  const pending = flags.pendingAction || previous.pending_action || null;
  const step = flags.conversationStep || previous.conversation_step || null;

  const attemptStatus = openAttempt && openAttempt.status ? openAttempt.status : null;
  const attemptExpired =
    !!openAttempt &&
    openAttempt.expiresAt &&
    new Date(openAttempt.expiresAt).getTime() <= nowMs;

  const explicitOverride =
    AFFIRMATIVE.has(decisionText) ||
    AFFIRMATIVE.has(decisionFolded) ||
    NEGATIVE.has(decisionText) ||
    NEGATIVE.has(decisionFolded) ||
    !!modifyFieldOf(decisionFolded) ||
    isExplicitRestart(decisionFolded);

  const explicitResume = EXPLICIT_RESUME.has(decisionFolded);
  const explicitAbandon =
    NEGATIVE.has(decisionText) ||
    NEGATIVE.has(decisionFolded);

  // --- Tentative ouverte : jamais de POST implicite depuis un message libre ---
  if (attemptStatus === 'UNCERTAIN' || attemptStatus === 'SUBMITTING') {
    return {
      intent: 'CREATE_APPOINTMENT',
      createDecision: 'RESUME',
      sessionExpired: flags.sessionExpired,
      refreshSessionTtl: false,
      preserveDraft: true,
      forceCreate: false,
      claimOrPost: false,
      note: 'replay_only_uncertain_or_submitting',
    };
  }

  if (attemptStatus === 'AWAITING_CONFIRMATION') {
    if (attemptExpired || flags.sessionExpired) {
      return {
        intent: 'GENERAL',
        createDecision: null,
        sessionExpired: true,
        refreshSessionTtl: false,
        preserveDraft: true,
        forceCreate: false,
        claimOrPost: false,
        expireAttempt: true,
        note: 'awaiting_confirmation_ttl_expired_no_post',
      };
    }
    const modifyField = modifyFieldOf(decisionFolded);
    let createDecision = 'AMBIGUOUS';
    if (modifyField) createDecision = 'MODIFY';
    else if (AFFIRMATIVE.has(decisionText) || AFFIRMATIVE.has(decisionFolded)) createDecision = 'AFFIRM';
    else if (NEGATIVE.has(decisionText) || NEGATIVE.has(decisionFolded)) createDecision = 'NEGATIVE';
    else if (isExplicitRestart(decisionFolded)) createDecision = 'RESTART';
    return {
      intent: 'CREATE_APPOINTMENT',
      createDecision,
      modifyField,
      sessionExpired: false,
      refreshSessionTtl: createDecision === 'AFFIRM' || createDecision === 'MODIFY' || createDecision === 'NEGATIVE',
      preserveDraft: createDecision === 'AMBIGUOUS',
      forceCreate: false,
      claimOrPost: createDecision === 'AFFIRM', // CLAIM only after AFFIRM; POST after won claim
      note: 'await_confirmation_active',
    };
  }

  if (attemptStatus === 'EXPIRED' || attemptStatus === 'ABANDONED' || attemptStatus === 'REJECTED') {
    return {
      intent: llmIntent || 'GENERAL',
      createDecision: null,
      sessionExpired: flags.sessionExpired,
      refreshSessionTtl: false,
      preserveDraft: true,
      forceCreate: false,
      claimOrPost: false,
      reuseIdempotencyKey: false,
      note: 'terminal_or_expired_attempt_no_key_reuse',
    };
  }

  // --- Session conversationnelle expirée, sans tentative ouverte ---
  if (flags.sessionFound && flags.sessionExpired && !openAttempt) {
    if (explicitResume && pending === 'CREATE_APPOINTMENT' && IDENTITY_STEPS.includes(step)) {
      return {
        intent: 'CREATE_APPOINTMENT',
        createDecision: null,
        sessionExpired: false,
        refreshSessionTtl: true,
        preserveDraft: true,
        forceCreate: true,
        claimOrPost: false,
        resumeAuthorized: true,
        conversationStep: step,
        pendingAction: pending,
        note: 'explicit_resume_after_conversation_ttl',
      };
    }
    return {
      intent: 'GENERAL',
      createDecision: null,
      sessionExpired: true,
      refreshSessionTtl: false,
      preserveDraft: true,
      forceCreate: false,
      claimOrPost: false,
      publicMessage:
        'Votre session de conversation a expiré. Pour reprendre la demande en cours, répondez « reprendre ». Sinon, formulez une nouvelle demande.',
      note: 'expired_no_silent_continue',
    };
  }

  // --- Session active : verrou collecte identité ---
  if (
    !flags.sessionExpired &&
    pending === 'CREATE_APPOINTMENT' &&
    IDENTITY_STEPS.includes(step) &&
    !explicitOverride
  ) {
    return {
      intent: 'CREATE_APPOINTMENT',
      createDecision: null,
      sessionExpired: false,
      refreshSessionTtl: true,
      preserveDraft: true,
      forceCreate: true,
      claimOrPost: false,
      conversationStep: step,
      pendingAction: pending,
      note: 'active_identity_collection_lock',
    };
  }

  // Abandon explicite hors confirmation
  if (explicitAbandon && pending === 'CREATE_APPOINTMENT' && IDENTITY_STEPS.includes(step)) {
    return {
      intent: 'CREATE_APPOINTMENT',
      createDecision: 'NEGATIVE',
      sessionExpired: false,
      refreshSessionTtl: true,
      preserveDraft: false,
      authorizedClear: true,
      forceCreate: false,
      claimOrPost: false,
      note: 'explicit_abandon_during_collection',
    };
  }

  return {
    intent: llmIntent || 'GENERAL',
    createDecision: null,
    sessionExpired: !!flags.sessionExpired,
    refreshSessionTtl: !flags.sessionExpired,
    preserveDraft: false,
    forceCreate: false,
    claimOrPost: false,
    note: 'passthrough_llm_or_general',
  };
}

/**
 * Capture d'un champ identité pour session ACTIVE uniquement.
 */
function captureIdentityField({ step, message, fields }) {
  const msg = String(message || '').trim();
  const out = { ...fields, conversationStep: step, captured: false };
  if (!msg) return out;

  if (step === 'ASK_NOM' && !fields.nom) {
    if (msg.length >= 2) {
      out.nom = msg;
      out.conversationStep = 'ASK_PRENOM';
      out.captured = true;
    }
  } else if (step === 'ASK_PRENOM' && !fields.prenom) {
    if (msg.length >= 2) {
      out.prenom = msg;
      out.conversationStep = 'ASK_EMAIL';
      out.captured = true;
    }
  } else if (step === 'ASK_EMAIL') {
    const m = msg.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
    if (m) {
      out.email = m[0];
      out.conversationStep = 'ASK_TELEPHONE';
      out.captured = true;
    }
  } else if (step === 'ASK_TELEPHONE') {
    const m = msg.match(/(?:\+\d{7,15}|\b\d{8,15}\b)/);
    if (m && m[0].replace(/\D/g, '').length >= 8) {
      out.telephone = m[0].replace(/[^\d+]/g, '');
      out.conversationStep = 'AWAIT_CREATE_CONFIRMATION';
      out.captured = true;
    }
  }
  return out;
}

/**
 * Texte public pour Réponse générale (sans drapeaux techniques).
 */
function publicGeneralResponse(decision) {
  if (decision && decision.sessionExpired && decision.publicMessage) {
    return {
      type: 'session_expired',
      text: decision.publicMessage,
    };
  }
  return {
    type: 'general',
    text:
      'Je peux vous aider à consulter les services consulaires, rechercher des disponibilités, créer, consulter, annuler ou replanifier un rendez-vous. Indiquez simplement ce que vous souhaitez faire.',
  };
}

module.exports = {
  IDENTITY_STEPS,
  AFFIRMATIVE,
  NEGATIVE,
  EXPLICIT_RESUME,
  stripDecision,
  modifyFieldOf,
  normalizeSessionFlags,
  routeConversation,
  captureIdentityField,
  publicGeneralResponse,
};
