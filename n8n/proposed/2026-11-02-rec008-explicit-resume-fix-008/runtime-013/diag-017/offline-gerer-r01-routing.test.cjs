'use strict';

/**
 * DIAG-017 — offline simulation of Gérer CREATE identity vs date-range routing.
 * Not a runtime proof; reproduces VC10 Gérer §12.3–12.4 control flow.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const outPath = path.join(__dirname, 'OFFLINE-TEST-RESULTS.json');

function isQuestion(message) {
  return /\?/.test(String(message || ''));
}

/** Exact control flow from Gérer CREATE block (identity + step calc). */
function gererCreateProgression(input) {
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
    parserPrenom,
  } = input;

  const parserCurrent = { prenom: parserPrenom ?? null };
  const skipCreateProgression = false;
  const createDecision = null;
  let intent = 'CREATE_APPOINTMENT';

  // --- §12.3 (gated on slotId in VC10) ---
  if (slotId) {
    if (conversationStep === 'ASK_NOM' && message && !nom && !isQuestion(message)) {
      const candidate = parserCurrent.nom ?? message;
      if (candidate && String(candidate).trim().length >= 2) nom = String(candidate).trim();
    } else if (
      conversationStep === 'ASK_PRENOM' &&
      message &&
      !prenom &&
      !isQuestion(message)
    ) {
      const candidate = parserCurrent.prenom ?? message;
      if (candidate && String(candidate).trim().length >= 2) {
        prenom = String(candidate).trim();
      }
    } else if (conversationStep === 'ASK_EMAIL' && message) {
      /* omit */
    } else if (conversationStep === 'ASK_TELEPHONE' && message) {
      /* omit */
    }
  }

  // --- §12.4 ---
  if (skipCreateProgression) {
    conversationStep = 'AWAIT_CREATE_CONFIRMATION';
  } else if (slotId) {
    if (!nom) conversationStep = 'ASK_NOM';
    else if (!prenom) conversationStep = 'ASK_PRENOM';
    else if (!email) conversationStep = 'ASK_EMAIL';
    else if (!telephone) conversationStep = 'ASK_TELEPHONE';
    else conversationStep = 'AWAIT_CREATE_CONFIRMATION';
  } else {
    if (!service) {
      conversationStep = 'ASK_CREATE_SERVICE';
      intent = 'CREATE_APPOINTMENT';
    } else if (!site) {
      conversationStep = 'ASK_CREATE_SITE';
      intent = 'CREATE_APPOINTMENT';
    } else if (!dateDebut || !dateFin) {
      conversationStep = 'ASK_CREATE_DATE_RANGE';
      intent = 'CREATE_APPOINTMENT';
    } else {
      conversationStep = 'READY_CREATE_SEARCH';
      intent = 'GET_AVAILABILITY';
    }
  }

  return { conversationStep, prenom, nom, intent, slotId: slotId || null };
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

/** Proposed minimal fix: mirrors AFTER §12.3–12.4. */
function gererCreateProgressionFixed(input) {
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
    parserPrenom,
  } = input;

  const parserCurrent = { prenom: parserPrenom ?? null };
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
      const candidate = message;
      if (String(candidate).trim().length >= 2) nom = String(candidate).trim();
    } else if (
      conversationStep === 'ASK_PRENOM' &&
      message &&
      !prenom &&
      !isQuestion(message) &&
      !explicitResumeMsg
    ) {
      const candidate = parserCurrent.prenom ?? message;
      if (candidate && String(candidate).trim().length >= 2) {
        prenom = String(candidate).trim();
      }
    }
  }

  if (slotId || onIdentity || nom || prenom || email || telephone) {
    if (!nom) conversationStep = 'ASK_NOM';
    else if (!prenom) conversationStep = 'ASK_PRENOM';
    else if (!email) conversationStep = 'ASK_EMAIL';
    else if (!telephone) conversationStep = 'ASK_TELEPHONE';
    else if (slotId) conversationStep = 'AWAIT_CREATE_CONFIRMATION';
    else if (!dateDebut || !dateFin) conversationStep = 'ASK_CREATE_DATE_RANGE';
    else {
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

  return { conversationStep, prenom, nom, intent, slotId: slotId || null };
}

const r01Fixture = {
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
  parserPrenom: null,
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

const vc10 = gererCreateProgression(r01Fixture);
check('T1_vc10_R01_Camille_diverges_to_ASK_CREATE_DATE_RANGE', () => {
  assert.equal(vc10.prenom, null);
  assert.equal(vc10.conversationStep, 'ASK_CREATE_DATE_RANGE');
});

check('T1b_first_divergence_is_slotId_gate', () => {
  const withSlot = gererCreateProgression({
    ...r01Fixture,
    slotId: '11111111-1111-4111-8111-111111111111',
  });
  assert.equal(withSlot.prenom, 'Camille');
  assert.equal(withSlot.conversationStep, 'ASK_EMAIL');
});

check('T2_reprendre_on_active_ASK_PRENOM_vc10_same_trap', () => {
  const r = gererCreateProgression({ ...r01Fixture, message: 'reprendre' });
  // FIX-008 early return for explicit resume is BEFORE this block when sessionExpired;
  // on active session, reprendre is treated as prenom IF slotId — without slotId still date range
  assert.equal(r.conversationStep, 'ASK_CREATE_DATE_RANGE');
  assert.equal(r.prenom, null);
});

check('T3_ambiguous_text_vc10', () => {
  const r = gererCreateProgression({ ...r01Fixture, message: 'bonjour' });
  assert.equal(r.conversationStep, 'ASK_CREATE_DATE_RANGE');
  assert.equal(r.prenom, null);
});

check('T4_empty_message_vc10', () => {
  const r = gererCreateProgression({ ...r01Fixture, message: '' });
  assert.equal(r.conversationStep, 'ASK_CREATE_DATE_RANGE');
  assert.equal(r.prenom, null);
});

check('T5_fixed_R01_Camille_ASK_EMAIL', () => {
  const r = gererCreateProgressionFixed(r01Fixture);
  assert.equal(r.prenom, 'Camille');
  assert.equal(r.conversationStep, 'ASK_EMAIL');
});

check('T6_fixed_with_slot_still_ASK_EMAIL', () => {
  const r = gererCreateProgressionFixed({
    ...r01Fixture,
    slotId: '11111111-1111-4111-8111-111111111111',
  });
  assert.equal(r.prenom, 'Camille');
  assert.equal(r.conversationStep, 'ASK_EMAIL');
});

check('T7_llm_fake_intent_irrelevant_when_pending_CREATE', () => {
  // Parser would force CREATE; Gérer still hits same slotId gate
  const r = gererCreateProgression(r01Fixture);
  assert.equal(r.conversationStep, 'ASK_CREATE_DATE_RANGE');
});

check('T8_gerer_source_contains_slotId_gate', () => {
  const src = fs.readFileSync(
    path.join(__dirname, 'G_rer_collecte_progressive.js'),
    'utf8',
  );
  assert.match(src, /if \(slotId\) \{\s*\n\s*\/\/ NOM/);
  assert.match(src, /conversationStep =\s*\n\s*'ASK_CREATE_DATE_RANGE'/);
});

/** FIX-008 early-return contract (expired) — not §12.3, documented separately. */
function expiredEarlyReturn(message) {
  const resumeFolded = String(message || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.!?;:,]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[’']/g, '');
  const explicitResumeMsg = [
    'reprendre',
    'reprendre ma demande',
    'continuer',
    'continuer ma demande',
  ].includes(resumeFolded);
  if (!explicitResumeMsg) {
    return {
      prenom: null,
      conversationStep: 'ASK_PRENOM',
      refreshSessionTtl: false,
      preserveDraft: true,
      intent: 'GENERAL',
    };
  }
  return {
    prenom: null,
    conversationStep: 'ASK_PRENOM',
    refreshSessionTtl: true,
    preserveDraft: true,
    intent: 'CREATE_APPOINTMENT',
  };
}

check('T9_expired_Camille_no_capture', () => {
  const r = expiredEarlyReturn('Camille');
  assert.equal(r.prenom, null);
  assert.equal(r.conversationStep, 'ASK_PRENOM');
  assert.equal(r.refreshSessionTtl, false);
  assert.equal(r.intent, 'GENERAL');
});

check('T10_expired_reprendre_no_prenom', () => {
  const r = expiredEarlyReturn('reprendre');
  assert.equal(r.prenom, null);
  assert.equal(r.conversationStep, 'ASK_PRENOM');
  assert.equal(r.refreshSessionTtl, true);
});

check('T11_fixed_active_reprendre_not_prenom', () => {
  const r = gererCreateProgressionFixed({ ...r01Fixture, message: 'reprendre' });
  // Proposed AFTER: explicitResumeMsg blocks capture; stay ASK_PRENOM if prenom still null
  assert.equal(r.prenom, null);
  assert.equal(r.conversationStep, 'ASK_PRENOM');
});

check('T12_proposed_after_sha_and_markers', () => {
  const afterPath = path.join(
    __dirname,
    'proposed-patch',
    'Gerer_collecte_progressive.AFTER.js',
  );
  const after = fs.readFileSync(afterPath);
  const sha = crypto.createHash('sha256').update(after).digest('hex');
  assert.equal(
    sha,
    '23524b5d075d3fc136904b9a7fb00bba5e06f5ec858afa669e62d1d619685961',
  );
  const src = after.toString('utf8');
  assert.match(src, /allowIdentityCapture/);
  assert.match(src, /onIdentityStep/);
  assert.match(src, /!explicitResumeMsg/);
});

const gererSha = crypto
  .createHash('sha256')
  .update(fs.readFileSync(path.join(__dirname, 'G_rer_collecte_progressive.js')))
  .digest('hex');

const afterSha = crypto
  .createHash('sha256')
  .update(
    fs.readFileSync(
      path.join(__dirname, 'proposed-patch', 'Gerer_collecte_progressive.AFTER.js'),
    ),
  )
  .digest('hex');

const results = {
  ts: new Date().toISOString(),
  gererJsShaVc10: gererSha,
  expectedSha:
    'f75d49849231f956bb9ae5383111ea84b362dc58de6711cc75d2e7e2a26917fe',
  shaMatch: gererSha === 'f75d49849231f956bb9ae5383111ea84b362dc58de6711cc75d2e7e2a26917fe',
  proposedAfterSha: afterSha,
  proposedAfterExpected:
    '23524b5d075d3fc136904b9a7fb00bba5e06f5ec858afa669e62d1d619685961',
  vc10R01: vc10,
  pass: tests.every((t) => t.ok),
  tests,
  rootCause:
    'Gérer §12.3 identity capture and §12.4 identity ladder are gated on slotId; without slotId, CREATE falls through to ASK_CREATE_DATE_RANGE when service+site set and dates missing — prenom never captured from Camille.',
};

fs.writeFileSync(outPath, JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
process.exit(results.pass ? 0 : 1);
