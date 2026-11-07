'use strict';

/**
 * Auto-vérification offline des scénarios C7 C8 C9 C11 C12.
 * node n8n/proposed/2026-11-02-rec008-COVERAGE-004-ATTEMPT-SIM/run-self-check.cjs
 */

const path = require('path');
const fs = require('fs');
const sim = require('./attempt-sim.cjs');

const OWNER_A = 'own-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const OWNER_B = 'own-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const SLOT_OK = '11111111-1111-4111-8111-111111111111';
const SLOT_FULL = '22222222-2222-4222-8222-222222222222';
const KEY = 'rec008-' + 'c'.repeat(64);
const SESSION = 'rec008-cov004-session-01';
const ATTEMPT = '00000000-0000-4000-8000-00000000c004';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function loadExpects() {
  const raw = fs.readFileSync(path.join(__dirname, 'ASSERTIONS.json'), 'utf8');
  return JSON.parse(raw).matrix;
}

function baseState(now = 1_000_000) {
  let s = sim.emptyState(now);
  s = sim.seedSlot(s, {
    id: SLOT_OK,
    capacite: 1,
    placesReservees: 0,
    statut: 'DISPONIBLE',
    debut: now + 3_600_000
  });
  s = sim.seedSlot(s, {
    id: SLOT_FULL,
    capacite: 1,
    placesReservees: 1,
    statut: 'COMPLET',
    debut: now + 3_600_000
  });
  return s;
}

function runC7(expects) {
  let s = baseState();
  let r = sim.createAwaitingAttempt(s, {
    id: ATTEMPT,
    sessionId: SESSION,
    payload: { slotId: SLOT_OK, cleIdempotence: KEY }
  });
  assert(r.result.ok, 'C7 create awaiting');
  s = r.state;

  r = sim.runWinningSubmit(s, {
    attemptId: ATTEMPT,
    sessionId: SESSION,
    owner: OWNER_A,
    mode: 'claim'
  });
  assert(r.result.issue === expects.firstIssue, 'C7 CREATED');
  assert(r.result.httpOutcome === expects.firstHttpOutcome, 'C7 CONFIRMED');
  s = r.state;
  const ref = r.result.reference;
  const ev = sim.evidence(s, ATTEMPT);
  assert(ev.attemptStatus === expects.attemptStatusAfter, 'C7 status');
  assert(ev.appointmentCount === expects.appointmentCount, 'C7 appt count');
  assert(ev.postCount === expects.postCount, 'C7 post count');
  assert(ev.openSecretsPurged === expects.openSecretsPurged, 'C7 purge');

  const decision = sim.decideAttemptAction({
    openAttempt: s.attempts[ATTEMPT],
    createDecision: 'AFFIRM',
    now: s.now
  });
  assert(decision.attemptAction === expects.secondAttemptAction, 'C7 RECALL');
  assert(
    decision.noCreateAppointmentPost === expects.secondNoCreateAppointmentPost,
    'C7 no second POST'
  );
  assert(ref === s.attempts[ATTEMPT].appointmentReference, 'C7 referenceStable');
  return { case: 'C7', ok: true, evidence: ev, reference: ref };
}

function runC8(expects) {
  let s = baseState();
  let r = sim.createAwaitingAttempt(s, {
    id: ATTEMPT,
    sessionId: SESSION,
    payload: { slotId: SLOT_OK, cleIdempotence: KEY }
  });
  s = r.state;

  r = sim.claimLeaseConcurrent(s, [
    { attemptId: ATTEMPT, sessionId: SESSION, owner: OWNER_A },
    { attemptId: ATTEMPT, sessionId: SESSION, owner: OWNER_B }
  ]);
  assert(r.result.winners === expects.winners, 'C8 winners');
  assert(r.result.losers === expects.losers, 'C8 losers');
  assert(r.result.results[0].acquired === expects.winnerAcquired, 'C8 winner');
  assert(r.result.results[1].acquired === expects.loserAcquired, 'C8 loser');
  assert(
    (r.result.results[1].requestPayload === null) === expects.loserPayloadNull,
    'C8 loser null payload'
  );
  s = r.state;
  assert(s.attempts[ATTEMPT].status === expects.attemptStatus, 'C8 SUBMITTING');
  assert(s.attempts[ATTEMPT].resumeCount === expects.resumeCount, 'C8 resume 0');

  const win = sim.createAppointmentIdempotent(s, r.result.results[0].requestPayload);
  s = win.state;
  const closed = sim.closeAttempt(s, {
    attemptId: ATTEMPT,
    sessionId: SESSION,
    owner: OWNER_A,
    status: 'CONFIRMED',
    appointmentId: win.result.appointmentId,
    reference: win.result.reference
  });
  s = closed.state;
  const ev = sim.evidence(s, ATTEMPT);
  assert(ev.appointmentCount === expects.appointmentCount, 'C8 appt');
  assert(ev.postCount === expects.postCount, 'C8 posts');
  return { case: 'C8', ok: true, evidence: ev, winners: r.result.winners };
}

function runC9(expects) {
  let s = baseState();
  let r = sim.createAwaitingAttempt(s, {
    id: ATTEMPT,
    sessionId: SESSION,
    payload: { slotId: SLOT_OK, cleIdempotence: KEY }
  });
  s = r.state;
  const key0 = s.attempts[ATTEMPT].idempotencyKey;
  const fp0 = s.attempts[ATTEMPT].requestFingerprint;

  r = sim.runTransportTimeout(s, {
    attemptId: ATTEMPT,
    sessionId: SESSION,
    owner: OWNER_A
  });
  s = r.state;
  assert(s.attempts[ATTEMPT].status === expects.afterTimeoutStatus, 'C9 UNCERTAIN');
  assert(r.result.httpOutcome === expects.afterTimeoutHttpOutcome, 'C9 outcome');
  assert(r.result.sameKey === expects.keyPreserved, 'C9 key');
  assert(r.result.sameFingerprint === expects.fingerprintPreserved, 'C9 fp');
  assert(
    (s.attempts[ATTEMPT].requestPayload != null) === expects.payloadPreserved,
    'C9 payload'
  );

  const decide = sim.decideAttemptAction({
    openAttempt: s.attempts[ATTEMPT],
    createDecision: 'AFFIRM',
    now: s.now
  });
  assert(decide.attemptAction === expects.createDecisionPath, 'C9 RESUME path');

  r = sim.resumeLease(s, {
    attemptId: ATTEMPT,
    sessionId: SESSION,
    owner: OWNER_B
  });
  s = r.state;
  assert(r.result.acquired === expects.resumeAcquired, 'C9 resume acquired');
  assert(r.result.idempotencyKey === key0, 'C9 no new key');
  assert(r.result.requestFingerprint === fp0, 'C9 same fp resume');
  assert(r.result.resumeCount === expects.resumeCount, 'C9 resume_count');
  assert(
    (r.result.idempotencyKey === key0) === expects.noNewIdempotencyKey,
    'C9 noNewIdempotencyKey'
  );
  return {
    case: 'C9',
    ok: true,
    evidence: sim.evidence(s, ATTEMPT),
    sameKey: r.result.idempotencyKey === key0
  };
}

function runC11(expects) {
  let s = baseState();
  // Premier RDV avec clé K / corps A
  let r = sim.createAppointmentIdempotent(s, {
    slotId: SLOT_OK,
    cleIdempotence: KEY,
    nom: 'NomSyn'
  });
  assert(r.result.issue === 'CREATED', 'C11 seed CREATED');
  s = r.state;

  // Tentative ouverte avec même clé mais corps différent (conflit volontaire)
  r = sim.createAwaitingAttempt(s, {
    id: ATTEMPT,
    sessionId: SESSION,
    payload: { slotId: SLOT_OK, cleIdempotence: KEY, nom: 'AutreNomSyn' }
  });
  s = r.state;
  const keyFrozen = s.attempts[ATTEMPT].idempotencyKey;

  r = sim.claimLease(s, { attemptId: ATTEMPT, sessionId: SESSION, owner: OWNER_A });
  s = r.state;
  const posted = sim.createAppointmentIdempotent(s, r.result.requestPayload);
  s = posted.state;
  assert(posted.result.issue === expects.issue, 'C11 KEY_CONFLICT');
  assert(posted.result.http.statusCode === expects.httpStatus, 'C11 409');
  assert(
    posted.result.http.body.error.code === expects.errorCode,
    'C11 error code'
  );
  const outcome = sim.mapHttpOutcome(posted.result.http);
  assert(outcome === expects.httpOutcome, 'C11 REJECTED');

  const closed = sim.closeAttempt(s, {
    attemptId: ATTEMPT,
    sessionId: SESSION,
    owner: OWNER_A,
    status: 'REJECTED'
  });
  s = closed.state;
  assert(s.attempts[ATTEMPT].status === expects.attemptStatusAfter, 'C11 status');
  assert(sim.appointmentCount(s) === expects.appointmentCount, 'C11 still 1 appt');
  assert(s.postCount === expects.postCount, 'C11 posts');
  assert(keyFrozen === KEY, 'C11 key unchanged / no auto new key');
  return { case: 'C11', ok: true, evidence: sim.evidence(s, ATTEMPT) };
}

function runC12(expects) {
  let s = baseState();
  let r = sim.createAwaitingAttempt(s, {
    id: ATTEMPT,
    sessionId: SESSION,
    payload: { slotId: SLOT_FULL, cleIdempotence: KEY }
  });
  s = r.state;

  r = sim.runWinningSubmit(s, {
    attemptId: ATTEMPT,
    sessionId: SESSION,
    owner: OWNER_A,
    mode: 'claim'
  });
  s = r.state;
  assert(r.result.issue === expects.issue, 'C12 issue');
  assert(r.result.httpOutcome === expects.httpOutcome, 'C12 outcome');
  assert(s.attempts[ATTEMPT].status === expects.attemptStatusAfter, 'C12 status');
  const ev = sim.evidence(s, ATTEMPT);
  assert(ev.appointmentCount === expects.appointmentCount, 'C12 no appt');
  assert(ev.postCount === expects.postCount, 'C12 one post');
  assert(ev.openSecretsPurged === expects.openSecretsPurged, 'C12 purge');
  const keyHash = sim.hashIdempotencyKey(KEY);
  assert(
    !s.appointmentsByKeyHash[keyHash] === expects.appointmentForKeyAbsent,
    'C12 key absent'
  );
  return { case: 'C12', ok: true, evidence: ev };
}

function main() {
  const expects = loadExpects();
  const results = [];
  const runners = [
    ['C7', runC7],
    ['C8', runC8],
    ['C9', runC9],
    ['C11', runC11],
    ['C12', runC12]
  ];
  let failed = 0;
  for (const [id, fn] of runners) {
    try {
      results.push(fn(expects[id].expects));
    } catch (e) {
      failed += 1;
      results.push({ case: id, ok: false, error: String(e.message || e) });
    }
  }
  const report = {
    simulation: true,
    disclaimer: 'Not a PostgreSQL / n8n runtime proof',
    passed: results.filter((x) => x.ok).length,
    failed,
    results
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(failed === 0 ? 0 : 1);
}

main();
