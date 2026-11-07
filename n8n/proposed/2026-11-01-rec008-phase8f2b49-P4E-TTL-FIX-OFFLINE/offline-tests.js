/**
 * Tests unitaires hors ligne 8F-2B49-P4E.
 * Aucun n8n, Ollama, SQL, chat, mock, CLAIM, POST.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  routeConversation,
  captureIdentityField,
  publicGeneralResponse,
} = require('./PROPOSED_FIX_B');
const { applySaveGuard } = require('./save-guard');

const outDir = __dirname;
const casesDoc = JSON.parse(fs.readFileSync(path.join(outDir, 'TEST_CASES.json'), 'utf8'));

const NOW = Date.parse('2026-11-02T08:00:00.000Z');
const HOUR = 60 * 60 * 1000;

function baseCreateDraft(overrides) {
  return {
    session_id: 'rec008-8f2b49-p4e-fixture',
    session_found: true,
    sessionFound: true,
    pending_action: 'CREATE_APPOINTMENT',
    conversation_step: 'ASK_PRENOM',
    nom: 'Dupont',
    prenom: null,
    email: null,
    telephone: null,
    service: 'PASSEPORT',
    site: 'PARIS',
    slot_id: '33333333-3333-4333-8333-333333333333',
    date_debut: '2026-11-03',
    date_fin: '2026-11-03',
    openAttempt: null,
    ...overrides,
  };
}

function fixtures() {
  return {
    active_ask_nom: baseCreateDraft({
      conversation_step: 'ASK_NOM',
      nom: null,
      session_expired: false,
      sessionExpired: false,
      expires_at: new Date(NOW + HOUR).toISOString(),
      session_expires_at: new Date(NOW + HOUR).toISOString(),
    }),
    active_ask_prenom: baseCreateDraft({
      conversation_step: 'ASK_PRENOM',
      session_expired: false,
      sessionExpired: false,
      expires_at: new Date(NOW + HOUR).toISOString(),
      session_expires_at: new Date(NOW + HOUR).toISOString(),
    }),
    active_ask_email: baseCreateDraft({
      conversation_step: 'ASK_EMAIL',
      prenom: 'Camille',
      session_expired: false,
      sessionExpired: false,
      expires_at: new Date(NOW + HOUR).toISOString(),
      session_expires_at: new Date(NOW + HOUR).toISOString(),
    }),
    active_ask_telephone: baseCreateDraft({
      conversation_step: 'ASK_TELEPHONE',
      prenom: 'Camille',
      email: 'camille.dupont@example.test',
      session_expired: false,
      sessionExpired: false,
      expires_at: new Date(NOW + HOUR).toISOString(),
      session_expires_at: new Date(NOW + HOUR).toISOString(),
    }),
    expired_ask_prenom: baseCreateDraft({
      conversation_step: 'ASK_PRENOM',
      session_expired: true,
      sessionExpired: true,
      expires_at: new Date(NOW - 5 * 60 * 1000).toISOString(),
      session_expires_at: new Date(NOW - 5 * 60 * 1000).toISOString(),
    }),
    active_await_confirmation: baseCreateDraft({
      conversation_step: 'AWAIT_CREATE_CONFIRMATION',
      prenom: 'Camille',
      email: 'camille.dupont@example.test',
      telephone: '+33601020304',
      session_expired: false,
      sessionExpired: false,
      expires_at: new Date(NOW + HOUR).toISOString(),
      session_expires_at: new Date(NOW + HOUR).toISOString(),
      openAttempt: {
        id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        status: 'AWAITING_CONFIRMATION',
        expiresAt: new Date(NOW + HOUR).toISOString(),
      },
    }),
    uncertain_open: baseCreateDraft({
      conversation_step: 'CREATE_UNCERTAIN',
      prenom: 'Camille',
      email: 'camille.dupont@example.test',
      telephone: '+33601020304',
      session_expired: false,
      sessionExpired: false,
      expires_at: new Date(NOW + HOUR).toISOString(),
      openAttempt: {
        id: 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        status: 'UNCERTAIN',
        expiresAt: new Date(NOW + HOUR).toISOString(),
      },
    }),
    expired_attempt: baseCreateDraft({
      conversation_step: null,
      pending_action: null,
      session_expired: true,
      sessionExpired: true,
      expires_at: new Date(NOW - HOUR).toISOString(),
      openAttempt: {
        id: 'cccccccc-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        status: 'EXPIRED',
        expiresAt: new Date(NOW - HOUR).toISOString(),
      },
    }),
    // limite exacte : expires_at <= NOW ⇒ expirée (même politique SQL)
    ttl_boundary_active_exact: baseCreateDraft({
      conversation_step: 'ASK_PRENOM',
      session_expired: true,
      sessionExpired: true,
      expires_at: new Date(NOW).toISOString(),
      session_expires_at: new Date(NOW).toISOString(),
    }),
    ttl_boundary_just_after: baseCreateDraft({
      conversation_step: 'ASK_PRENOM',
      session_expired: true,
      sessionExpired: true,
      expires_at: new Date(NOW - 1).toISOString(),
      session_expires_at: new Date(NOW - 1).toISOString(),
    }),
  };
}

function runRouteCase(tc, fx) {
  const previous = fx[tc.fixture];
  const decision = routeConversation({
    previous,
    llmIntent: tc.llmIntent,
    message: tc.message,
    nowMs: NOW,
  });

  let capture = null;
  if (
    decision.forceCreate &&
    previous.pending_action === 'CREATE_APPOINTMENT' &&
    !decision.sessionExpired
  ) {
    capture = captureIdentityField({
      step: previous.conversation_step,
      message: tc.message,
      fields: {
        nom: previous.nom,
        prenom: previous.prenom,
        email: previous.email,
        telephone: previous.telephone,
      },
    });
  }

  let saved = null;
  if (decision.preserveDraft) {
    saved = applySaveGuard(previous, {
      sessionId: previous.session_id,
      intent: decision.intent,
      nom: null,
      prenom: null,
      service: null,
      pendingAction: null,
      conversationStep: null,
      refreshSessionTtl: decision.refreshSessionTtl === true,
      originalMessage: tc.message,
    });
  }

  const exp = tc.expect;
  const checks = [];

  if (exp.intent !== undefined) checks.push(['intent', decision.intent === exp.intent]);
  if (exp.notIntent !== undefined) checks.push(['notIntent', decision.intent !== exp.notIntent]);
  if (exp.forceCreate !== undefined) checks.push(['forceCreate', !!decision.forceCreate === exp.forceCreate]);
  if (exp.sessionExpired !== undefined) {
    checks.push(['sessionExpired', !!decision.sessionExpired === exp.sessionExpired]);
  }
  if (exp.claimOrPost !== undefined) checks.push(['claimOrPost', !!decision.claimOrPost === exp.claimOrPost]);
  if (exp.preserveDraft !== undefined) {
    checks.push(['preserveDraft', !!decision.preserveDraft === exp.preserveDraft]);
  }
  if (exp.refreshSessionTtl !== undefined) {
    checks.push(['refreshSessionTtl', !!decision.refreshSessionTtl === exp.refreshSessionTtl]);
  }
  if (exp.createDecision !== undefined) {
    checks.push(['createDecision', decision.createDecision === exp.createDecision]);
  }
  if (exp.notCreateDecision !== undefined) {
    checks.push(['notCreateDecision', decision.createDecision !== exp.notCreateDecision]);
  }
  if (exp.modifyField !== undefined) checks.push(['modifyField', decision.modifyField === exp.modifyField]);
  if (exp.authorizedClear !== undefined) {
    checks.push(['authorizedClear', !!decision.authorizedClear === exp.authorizedClear]);
  }
  if (exp.reuseIdempotencyKey !== undefined) {
    checks.push([
      'reuseIdempotencyKey',
      decision.reuseIdempotencyKey === exp.reuseIdempotencyKey,
    ]);
  }
  if (exp.noteIncludes !== undefined) {
    checks.push(['noteIncludes', String(decision.note || '').includes(exp.noteIncludes)]);
  }
  if (exp.captureStepAfter !== undefined) {
    checks.push(['captureStepAfter', capture && capture.conversationStep === exp.captureStepAfter]);
  }
  if (exp.nom !== undefined) checks.push(['nom', capture && capture.nom === exp.nom]);
  if (exp.prenom !== undefined) checks.push(['prenom', capture && capture.prenom === exp.prenom]);
  if (exp.email !== undefined) checks.push(['email', capture && capture.email === exp.email]);
  if (exp.telephone !== undefined) {
    checks.push(['telephone', capture && capture.telephone === exp.telephone]);
  }
  if (exp.draftNom !== undefined) {
    checks.push(['draftNom', saved && saved.nom === exp.draftNom]);
  }
  if (exp.preserveBusiness) {
    checks.push([
      'preserveBusiness',
      saved
        ? saved.service === previous.service && saved.slot_id === previous.slot_id
        : capture && previous.service === 'PASSEPORT',
    ]);
  }

  // Anti-chemin CLAIM/POST hors confirmation AFFIRM
  if (exp.claimOrPost === false) {
    checks.push(['noClaimPostPath', decision.claimOrPost !== true]);
  }

  const pub = publicGeneralResponse(decision);
  if (decision.sessionExpired && decision.publicMessage) {
    checks.push([
      'publicNoTechFlags',
      !/sessionFound|sessionExpired|pendingAction|conversationStep/i.test(pub.text) &&
        pub.type === 'session_expired',
    ]);
  }

  const failed = checks.filter(([, ok]) => !ok).map(([k]) => k);
  return {
    id: tc.id,
    name: tc.name,
    pass: failed.length === 0,
    failed,
    decision,
    capture,
    saved,
    public: pub,
  };
}

function runSaveCase(tc) {
  const saved = applySaveGuard(tc.existing, {
    ...tc.payload,
    __now: new Date(NOW).toISOString(),
  });
  const checks = [];
  for (const [k, v] of Object.entries(tc.expect)) {
    checks.push([k, saved[k] === v]);
  }
  // TTL non prolongé si refreshSessionTtl false
  if (tc.payload.refreshSessionTtl === false && tc.existing.expires_at) {
    checks.push(['ttlNotExtended', saved.expires_at === tc.existing.expires_at]);
  }
  const failed = checks.filter(([, ok]) => !ok).map(([k]) => k);
  return {
    id: tc.id,
    name: tc.name,
    pass: failed.length === 0,
    failed,
    saved,
  };
}

const fx = fixtures();
const results = [];

for (const tc of casesDoc.cases) {
  if (tc.kind === 'save') results.push(runSaveCase(tc));
  else results.push(runRouteCase(tc, fx));
}

const payload = {
  phase: '8F-2B49-P4E',
  at: new Date().toISOString(),
  nowFrozen: new Date(NOW).toISOString(),
  passCount: results.filter((r) => r.pass).length,
  total: results.length,
  allPass: results.every((r) => r.pass),
  results: results.map(({ id, name, pass, failed }) => ({ id, name, pass, failed })),
};

fs.writeFileSync(
  path.join(outDir, 'OFFLINE_TEST_RESULTS.json'),
  JSON.stringify({ payload, results }, null, 2)
);
console.log(JSON.stringify(payload, null, 2));
process.exit(payload.allPass ? 0 : 1);
