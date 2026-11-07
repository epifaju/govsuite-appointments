'use strict';

/**
 * CONTRACT-018 — offline invariants for CREATE flow options A (VC10) vs B (017 AFTER).
 * Simulation only — not runtime proof.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const outPath = path.join(__dirname, 'OFFLINE-TEST-RESULTS.json');
const SLOT = '33333333-3333-4333-8333-333333333333';

function isQuestion(message) {
  return /\?/.test(String(message || ''));
}

function isExplicitResume(message) {
  const resumeFolded = String(message || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.!?;:,]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[’']/g, '');
  return [
    'reprendre',
    'reprendre ma demande',
    'continuer',
    'continuer ma demande',
  ].includes(resumeFolded);
}

function isValidEmail(v) {
  return !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());
}

function isValidPhone(v) {
  if (!v) return false;
  const n = String(v).replace(/[^\d+]/g, '');
  return /^(?:\+\d{7,15}|\d{8,15})$/.test(n);
}

/** VC10 Gérer CREATE §12.3–12.4 (slot-gated identity). */
function vc10(input) {
  let {
    conversationStep,
    message,
    nom,
    prenom,
    email,
    telephone,
    service,
    site,
    dateDebut,
    dateFin,
    slotId,
    skipCreateProgression = false,
    createDecision = null,
  } = { ...input };

  let intent = 'CREATE_APPOINTMENT';

  if (slotId) {
    if (
      conversationStep === 'ASK_NOM' &&
      message &&
      !nom &&
      !isQuestion(message)
    ) {
      if (String(message).trim().length >= 2) nom = String(message).trim();
    } else if (
      conversationStep === 'ASK_PRENOM' &&
      message &&
      !prenom &&
      !isQuestion(message)
    ) {
      if (String(message).trim().length >= 2) prenom = String(message).trim();
    }
  }

  if (skipCreateProgression) {
    conversationStep = 'AWAIT_CREATE_CONFIRMATION';
  } else if (slotId) {
    if (!nom) conversationStep = 'ASK_NOM';
    else if (!prenom) conversationStep = 'ASK_PRENOM';
    else if (!isValidEmail(email)) conversationStep = 'ASK_EMAIL';
    else if (!isValidPhone(telephone)) conversationStep = 'ASK_TELEPHONE';
    else {
      conversationStep = 'AWAIT_CREATE_CONFIRMATION';
      createDecision = createDecision || 'INSERT';
    }
  } else if (!service) {
    conversationStep = 'ASK_CREATE_SERVICE';
  } else if (!site) {
    conversationStep = 'ASK_CREATE_SITE';
  } else if (!dateDebut || !dateFin) {
    conversationStep = 'ASK_CREATE_DATE_RANGE';
  } else {
    conversationStep = 'READY_CREATE_SEARCH';
    intent = 'GET_AVAILABILITY';
  }

  return { conversationStep, prenom, nom, intent, slotId: slotId || null, createDecision };
}

/** DIAG-017 AFTER (identity allowed without slot). */
function after017(input) {
  let {
    conversationStep,
    message,
    nom,
    prenom,
    email,
    telephone,
    service,
    site,
    dateDebut,
    dateFin,
    slotId,
    skipCreateProgression = false,
    createDecision = null,
  } = { ...input };

  const identitySteps = ['ASK_NOM', 'ASK_PRENOM', 'ASK_EMAIL', 'ASK_TELEPHONE'];
  const onIdentity = identitySteps.includes(conversationStep);
  const explicitResumeMsg = isExplicitResume(message);
  let intent = 'CREATE_APPOINTMENT';

  if (slotId || onIdentity) {
    if (
      conversationStep === 'ASK_NOM' &&
      message &&
      !nom &&
      !isQuestion(message) &&
      !explicitResumeMsg
    ) {
      if (String(message).trim().length >= 2) nom = String(message).trim();
    } else if (
      conversationStep === 'ASK_PRENOM' &&
      message &&
      !prenom &&
      !isQuestion(message) &&
      !explicitResumeMsg
    ) {
      if (String(message).trim().length >= 2) prenom = String(message).trim();
    }
  }

  if (skipCreateProgression) {
    conversationStep = 'AWAIT_CREATE_CONFIRMATION';
  } else if (
    slotId ||
    onIdentity ||
    nom ||
    prenom ||
    isValidEmail(email) ||
    isValidPhone(telephone)
  ) {
    if (!nom) conversationStep = 'ASK_NOM';
    else if (!prenom) conversationStep = 'ASK_PRENOM';
    else if (!isValidEmail(email)) conversationStep = 'ASK_EMAIL';
    else if (!isValidPhone(telephone)) conversationStep = 'ASK_TELEPHONE';
    else if (slotId) {
      conversationStep = 'AWAIT_CREATE_CONFIRMATION';
      createDecision = createDecision || 'INSERT';
    } else if (!dateDebut || !dateFin) {
      conversationStep = 'ASK_CREATE_DATE_RANGE';
    } else {
      conversationStep = 'READY_CREATE_SEARCH';
      intent = 'GET_AVAILABILITY';
    }
  } else if (!service) {
    conversationStep = 'ASK_CREATE_SERVICE';
  } else if (!site) {
    conversationStep = 'ASK_CREATE_SITE';
  } else if (!dateDebut || !dateFin) {
    conversationStep = 'ASK_CREATE_DATE_RANGE';
  } else {
    conversationStep = 'READY_CREATE_SEARCH';
    intent = 'GET_AVAILABILITY';
  }

  return { conversationStep, prenom, nom, intent, slotId: slotId || null, createDecision };
}

function expiredEarlyReturn(message) {
  if (!isExplicitResume(message)) {
    return {
      prenom: null,
      conversationStep: 'ASK_PRENOM',
      refreshSessionTtl: false,
      intent: 'GENERAL',
    };
  }
  return {
    prenom: null,
    conversationStep: 'ASK_PRENOM',
    refreshSessionTtl: true,
    intent: 'CREATE_APPOINTMENT',
  };
}

const r01Broken = {
  conversationStep: 'ASK_PRENOM',
  message: 'Camille',
  nom: 'Dupont',
  prenom: null,
  email: null,
  telephone: null,
  service: 'PASSEPORT',
  site: 'PARIS',
  dateDebut: null,
  dateFin: null,
  slotId: null,
};

const r01FixedA = {
  ...r01Broken,
  slotId: SLOT,
  dateDebut: '2026-11-10',
  dateFin: '2026-11-14',
};

const tests = [];
function check(name, fn) {
  try {
    fn();
    tests.push({ name, ok: true });
  } catch (e) {
    tests.push({ name, ok: false, error: String(e.message || e) });
  }
}

// --- Natural VC10 path never reaches ASK_PRENOM without slot ---
check('N1_vc10_service_site_no_dates_is_date_range_not_identity', () => {
  const r = vc10({
    conversationStep: null,
    message: 'x',
    nom: null,
    prenom: null,
    email: null,
    telephone: null,
    service: 'PASSEPORT',
    site: 'PARIS',
    dateDebut: null,
    dateFin: null,
    slotId: null,
  });
  assert.equal(r.conversationStep, 'ASK_CREATE_DATE_RANGE');
});

check('N2_vc10_slot_without_nom_asks_nom', () => {
  const r = vc10({
    conversationStep: 'ASK_CREATE_SLOT',
    message: '',
    nom: null,
    prenom: null,
    email: null,
    telephone: null,
    service: 'PASSEPORT',
    site: 'PARIS',
    dateDebut: '2026-11-10',
    dateFin: '2026-11-14',
    slotId: SLOT,
  });
  assert.equal(r.conversationStep, 'ASK_NOM');
});

check('N3_vc10_natural_ask_prenom_requires_slot', () => {
  const r = vc10({
    conversationStep: 'ASK_NOM',
    message: 'Dupont',
    nom: null,
    prenom: null,
    email: null,
    telephone: null,
    service: 'PASSEPORT',
    site: 'PARIS',
    dateDebut: '2026-11-10',
    dateFin: '2026-11-14',
    slotId: SLOT,
  });
  assert.equal(r.nom, 'Dupont');
  assert.equal(r.conversationStep, 'ASK_PRENOM');
  assert.equal(r.slotId, SLOT);
});

// --- R01 fixture ---
check('F1_broken_seed_vc10_diverges', () => {
  const r = vc10(r01Broken);
  assert.equal(r.prenom, null);
  assert.equal(r.conversationStep, 'ASK_CREATE_DATE_RANGE');
});

check('F2_optionA_fixture_with_slot_passes_R01', () => {
  const r = vc10(r01FixedA);
  assert.equal(r.prenom, 'Camille');
  assert.equal(r.conversationStep, 'ASK_EMAIL');
});

check('F3_optionB_patch_passes_broken_seed', () => {
  const r = after017(r01Broken);
  assert.equal(r.prenom, 'Camille');
  assert.equal(r.conversationStep, 'ASK_EMAIL');
});

// --- Confirmation / INSERT without slot ---
check('I1_vc10_never_await_confirm_without_slot_via_ladder', () => {
  const r = vc10({
    conversationStep: 'ASK_TELEPHONE',
    message: '0612345678',
    nom: 'Dupont',
    prenom: 'Camille',
    email: 'a@b.co',
    telephone: null,
    service: 'PASSEPORT',
    site: 'PARIS',
    dateDebut: '2026-11-10',
    dateFin: '2026-11-14',
    slotId: null,
  });
  assert.notEqual(r.conversationStep, 'AWAIT_CREATE_CONFIRMATION');
  assert.notEqual(r.createDecision, 'INSERT');
});

check('I2_after_identity_complete_without_slot_not_confirm', () => {
  const r = after017({
    conversationStep: 'ASK_TELEPHONE',
    message: '0612345678',
    nom: 'Dupont',
    prenom: 'Camille',
    email: 'a@b.co',
    telephone: null,
    service: 'PASSEPORT',
    site: 'PARIS',
    dateDebut: null,
    dateFin: null,
    slotId: null,
  });
  // telephone capture needs onIdentity; after capture ladder needs phone valid —
  // message alone isn't auto-validated in this sim; set telephone after ladder path:
  const r2 = after017({
    conversationStep: 'ASK_EMAIL',
    message: '',
    nom: 'Dupont',
    prenom: 'Camille',
    email: 'a@b.co',
    telephone: '0612345678',
    service: 'PASSEPORT',
    site: 'PARIS',
    dateDebut: null,
    dateFin: null,
    slotId: null,
  });
  assert.equal(r2.conversationStep, 'ASK_CREATE_DATE_RANGE');
  assert.notEqual(r2.createDecision, 'INSERT');
  assert.ok(r); // silence unused if ladder skipped
});

check('I3_with_slot_and_full_identity_awaits_confirm', () => {
  const r = vc10({
    conversationStep: 'ASK_TELEPHONE',
    message: '',
    nom: 'Dupont',
    prenom: 'Camille',
    email: 'a@b.co',
    telephone: '0612345678',
    service: 'PASSEPORT',
    site: 'PARIS',
    dateDebut: '2026-11-10',
    dateFin: '2026-11-14',
    slotId: SLOT,
  });
  assert.equal(r.conversationStep, 'AWAIT_CREATE_CONFIRMATION');
  assert.equal(r.createDecision, 'INSERT');
});

// --- reprendre / expired ---
check('C1_after_active_reprendre_not_prenom', () => {
  const r = after017({ ...r01Broken, message: 'reprendre' });
  assert.equal(r.prenom, null);
  assert.equal(r.conversationStep, 'ASK_PRENOM');
});

check('C2_expired_camille_no_capture', () => {
  const r = expiredEarlyReturn('Camille');
  assert.equal(r.prenom, null);
  assert.equal(r.refreshSessionTtl, false);
});

check('C3_expired_reprendre_no_prenom', () => {
  const r = expiredEarlyReturn('reprendre');
  assert.equal(r.prenom, null);
  assert.equal(r.refreshSessionTtl, true);
});

// --- Slot change: identity preserved when slot kept ---
check('P1_vc10_change_message_keeps_identity_when_slot_stable', () => {
  const r = vc10({
    conversationStep: 'ASK_EMAIL',
    message: 'x@y.z',
    nom: 'Dupont',
    prenom: 'Camille',
    email: null,
    telephone: null,
    service: 'PASSEPORT',
    site: 'PARIS',
    dateDebut: '2026-11-10',
    dateFin: '2026-11-14',
    slotId: SLOT,
  });
  assert.equal(r.nom, 'Dupont');
  assert.equal(r.prenom, 'Camille');
});

// --- SHA anchors ---
check('S1_vc10_and_after_sha', () => {
  const before = crypto
    .createHash('sha256')
    .update(
      fs.readFileSync(
        path.join(
          __dirname,
          '..',
          'diag-017',
          'proposed-patch',
          'Gerer_collecte_progressive.BEFORE.js',
        ),
      ),
    )
    .digest('hex');
  const after = crypto
    .createHash('sha256')
    .update(
      fs.readFileSync(
        path.join(
          __dirname,
          '..',
          'diag-017',
          'proposed-patch',
          'Gerer_collecte_progressive.AFTER.js',
        ),
      ),
    )
    .digest('hex');
  assert.equal(
    before,
    'f75d49849231f956bb9ae5383111ea84b362dc58de6711cc75d2e7e2a26917fe',
  );
  assert.equal(
    after,
    '23524b5d075d3fc136904b9a7fb00bba5e06f5ec858afa669e62d1d619685961',
  );
});

const results = {
  ts: new Date().toISOString(),
  mission: 'CREATE-FLOW-CONTRACT-018',
  pass: tests.every((t) => t.ok),
  tests,
  recommendationHint: 'A',
  note: 'offline simulation only; PRD §6.2 orders slot before identity',
};

fs.writeFileSync(outPath, JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
process.exit(results.pass ? 0 : 1);
