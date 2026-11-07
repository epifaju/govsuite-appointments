'use strict';

/**
 * REALIGN-019 — offline contract checks for Option A fixtures.
 * Simulation only — not runtime.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const outPath = path.join(__dirname, 'OFFLINE-TEST-RESULTS.json');
const afterPath = path.join(__dirname, 'BACKUP-AFTER.json');

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
  return ['reprendre', 'reprendre ma demande', 'continuer', 'continuer ma demande'].includes(
    resumeFolded,
  );
}

function vc10Identity(input) {
  let { conversationStep, message, nom, prenom, email, telephone, slotId } = { ...input };
  if (slotId) {
    if (
      conversationStep === 'ASK_PRENOM' &&
      message &&
      !prenom &&
      !isQuestion(message) &&
      !isExplicitResume(message)
    ) {
      if (String(message).trim().length >= 2) prenom = String(message).trim();
    }
  }
  if (slotId) {
    if (!nom) conversationStep = 'ASK_NOM';
    else if (!prenom) conversationStep = 'ASK_PRENOM';
    else if (!email) conversationStep = 'ASK_EMAIL';
    else if (!telephone) conversationStep = 'ASK_TELEPHONE';
    else conversationStep = 'AWAIT_CREATE_CONFIRMATION';
  }
  return { conversationStep, prenom, createDecision: conversationStep === 'AWAIT_CREATE_CONFIRMATION' ? 'INSERT' : null };
}

function expiredEarlyReturn(message) {
  if (!isExplicitResume(message)) {
    return { prenom: null, conversationStep: 'ASK_PRENOM', refreshSessionTtl: false, intent: 'GENERAL' };
  }
  return {
    prenom: null,
    conversationStep: 'ASK_PRENOM',
    refreshSessionTtl: true,
    intent: 'CREATE_APPOINTMENT',
  };
}

const tests = [];
function check(name, fn) {
  try {
    fn();
    tests.push({ name, ok: true });
  } catch (e) {
    tests.push({ name, ok: false, error: String(e.message || e) });
  }
}

const after = JSON.parse(fs.readFileSync(afterPath, 'utf8'));
const byId = Object.fromEntries(after.sessions.map((s) => [s.sessionId, s]));

check('fixture_r01_shape', () => {
  const s = byId['rec008-runtime013-r01-active'];
  assert.equal(s.conversationStep, 'ASK_PRENOM');
  assert.equal(s.ttlFuture, true);
  assert.equal(s.prenomIsNull, true);
  assert.equal(s.slotIdPresent, true);
  assert.ok(s.availableSlotsLen >= 1);
  assert.equal(s.lastUserMessageLen, 0);
  assert.equal(s.lastUserMessageIsCamille, false);
});

check('fixture_r02_expired_shape', () => {
  const s = byId['rec008-runtime013-r02-expired'];
  assert.equal(s.conversationStep, 'ASK_PRENOM');
  assert.equal(s.ttlFuture, false);
  assert.equal(s.slotIdPresent, true);
  assert.notEqual(s.slotId, byId['rec008-runtime013-r01-active'].slotId);
});

check('fixture_r03_independent_expired', () => {
  const s = byId['rec008-runtime013-r03-resume'];
  assert.equal(s.conversationStep, 'ASK_PRENOM');
  assert.equal(s.ttlFuture, false);
  assert.notEqual(s.slotId, byId['rec008-runtime013-r02-expired'].slotId);
});

check('r01_camille_ask_email', () => {
  const s = byId['rec008-runtime013-r01-active'];
  const r = vc10Identity({
    conversationStep: 'ASK_PRENOM',
    message: 'Camille',
    nom: 'Dupont',
    prenom: null,
    email: null,
    telephone: null,
    slotId: s.slotId,
  });
  assert.equal(r.prenom, 'Camille');
  assert.equal(r.conversationStep, 'ASK_EMAIL');
});

check('r02_camille_expired_no_capture', () => {
  const r = expiredEarlyReturn('Camille');
  assert.equal(r.prenom, null);
  assert.equal(r.refreshSessionTtl, false);
  assert.equal(r.conversationStep, 'ASK_PRENOM');
});

check('r03_reprendre_no_prenom', () => {
  const r = expiredEarlyReturn('reprendre');
  assert.equal(r.prenom, null);
  assert.equal(r.refreshSessionTtl, true);
  assert.equal(r.conversationStep, 'ASK_PRENOM');
});

check('no_confirm_without_slot', () => {
  const r = vc10Identity({
    conversationStep: 'ASK_PRENOM',
    message: 'Camille',
    nom: 'Dupont',
    prenom: null,
    email: null,
    telephone: null,
    slotId: null,
  });
  assert.notEqual(r.conversationStep, 'AWAIT_CREATE_CONFIRMATION');
  assert.equal(r.createDecision, null);
});

check('no_claim_post_in_mission', () => {
  // structural: fixtures stay at ASK_PRENOM incomplete identity
  for (const s of after.sessions) {
    assert.equal(s.prenomIsNull, true);
    assert.equal(s.conversationStep, 'ASK_PRENOM');
  }
});

const results = {
  ts: new Date().toISOString(),
  mission: 'R013-FIXTURES-REALIGN-019',
  pass: tests.every((t) => t.ok),
  tests,
  note: 'offline simulation only; CLAIM/POST not invoked',
};

fs.writeFileSync(outPath, JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
process.exit(results.pass ? 0 : 1);
