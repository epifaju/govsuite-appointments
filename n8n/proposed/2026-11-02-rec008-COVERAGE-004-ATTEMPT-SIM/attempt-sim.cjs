'use strict';

/**
 * COVERAGE-004 — simulation pure JS de ai_appointment_attempt + creer_rendez_vous_idempotent.
 * Aucune I/O, aucune DB. État immuable : chaque opération retourne { state, result }.
 * simulation: true — n'est pas une preuve PostgreSQL.
 */

const crypto = require('crypto');

const LEASE_MS = 90_000;
const OWNER_RE = /^[A-Za-z0-9._~-]{16,64}$/;
const KEY_RE = /^[A-Za-z0-9._~-]{16,128}$/;
const OPEN = new Set(['AWAITING_CONFIRMATION', 'SUBMITTING', 'UNCERTAIN']);
const TERMINAL = new Set([
  'CONFIRMED',
  'ABANDONED',
  'REJECTED',
  'SLOT_UNAVAILABLE',
  'EXPIRED'
]);

function sha256Hex(text) {
  return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');
}

function clone(value) {
  return structuredClone(value);
}

function emptyState(now = 0) {
  return {
    now: Number(now) || 0,
    attempts: {},
    appointmentsByKeyHash: {},
    slots: {},
    postCount: 0,
    meta: { simulation: true }
  };
}

function withNow(state, now) {
  const next = clone(state);
  next.now = Number(now);
  return next;
}

function advanceTime(state, deltaMs) {
  return withNow(state, state.now + Number(deltaMs));
}

function nfcTrim(value, max) {
  const s = String(value ?? '')
    .trim()
    .normalize('NFC')
    .slice(0, max);
  return s;
}

/** Empreinte métier alignée sur l'intention REC-007 (pas d'octet-égalité PG garantie). */
function fingerprintBody(body) {
  const canonical = {
    slotId: String(body.slotId || '')
      .trim()
      .toLowerCase(),
    nom: nfcTrim(body.nom, 100),
    prenom: nfcTrim(body.prenom, 100),
    email: nfcTrim(body.email, 255).toLowerCase() || null,
    telephone: nfcTrim(body.telephone, 50) || null,
    numeroDocument: nfcTrim(body.numeroDocument, 100) || null,
    langue: nfcTrim(body.langue, 10) || 'fr'
  };
  return sha256Hex(JSON.stringify(canonical));
}

function hashIdempotencyKey(rawKey) {
  return sha256Hex(String(rawKey));
}

function syntheticPayload(overrides = {}) {
  const key =
    overrides.cleIdempotence ||
    overrides.idempotencyKey ||
    'rec008-' + 'a'.repeat(64);
  return {
    slotId: String(overrides.slotId || '11111111-1111-4111-8111-111111111111').toLowerCase(),
    nom: overrides.nom || 'NomSyn',
    prenom: overrides.prenom || 'PrenomSyn',
    email: overrides.email || 'syn@example.test',
    telephone: overrides.telephone || '+10000000000',
    numeroDocument: overrides.numeroDocument ?? '',
    langue: overrides.langue || 'fr',
    cleIdempotence: key
  };
}

function seedSlot(state, slot) {
  const next = clone(state);
  const id = String(slot.id).toLowerCase();
  next.slots[id] = {
    id,
    capacite: Number(slot.capacite ?? 1),
    placesReservees: Number(slot.placesReservees ?? 0),
    statut: slot.statut || 'DISPONIBLE',
    debut: Number(slot.debut ?? state.now + 3_600_000)
  };
  return next;
}

function openAttemptCount(state, sessionId) {
  return Object.values(state.attempts).filter(
    (a) => a.sessionId === sessionId && OPEN.has(a.status)
  ).length;
}

function appointmentCount(state) {
  return Object.keys(state.appointmentsByKeyHash).length;
}

function createAwaitingAttempt(state, input) {
  const next = clone(state);
  const payload = syntheticPayload(input.payload || input);
  const key = payload.cleIdempotence;
  if (!KEY_RE.test(key)) {
    return { state, result: { ok: false, reason: 'invalid_key' } };
  }
  if (payload.cleIdempotence !== key) {
    return { state, result: { ok: false, reason: 'key_mismatch' } };
  }
  const sessionId = String(input.sessionId);
  if (openAttemptCount(next, sessionId) > 0) {
    return { state, result: { ok: false, reason: 'session_open_exists' } };
  }
  const id = String(input.id || crypto.randomUUID());
  const fp = fingerprintBody(payload);
  next.attempts[id] = {
    id,
    sessionId,
    status: 'AWAITING_CONFIRMATION',
    idempotencyKey: key,
    requestPayload: payload,
    requestFingerprint: fp,
    appointmentId: null,
    appointmentReference: null,
    createdAt: next.now,
    updatedAt: next.now,
    expiresAt: Number(input.expiresAt ?? next.now + 2 * 3_600_000),
    submittedAt: null,
    confirmedAt: null,
    leaseOwner: null,
    leaseUntil: null,
    resumeCount: 0
  };
  return { state: next, result: { ok: true, attemptId: id, status: 'AWAITING_CONFIRMATION' } };
}

function claimResult(falseRow = true) {
  if (falseRow) {
    return {
      acquired: false,
      attemptId: null,
      attemptStatus: null,
      requestPayload: null,
      idempotencyKey: null,
      requestFingerprint: null,
      resumeCount: null,
      leaseOwner: null
    };
  }
  return null;
}

/** reclamer_tentative_rendez_vous */
function claimLease(state, { attemptId, sessionId, owner }) {
  if (!OWNER_RE.test(String(owner || ''))) {
    return { state, result: claimResult(true) };
  }
  const next = clone(state);
  const a = next.attempts[attemptId];
  if (
    !a ||
    a.sessionId !== sessionId ||
    a.status !== 'AWAITING_CONFIRMATION' ||
    a.expiresAt <= next.now ||
    !a.idempotencyKey ||
    !a.requestPayload
  ) {
    return { state, result: claimResult(true) };
  }
  a.status = 'SUBMITTING';
  a.leaseOwner = owner;
  a.leaseUntil = next.now + LEASE_MS;
  a.submittedAt = next.now;
  a.updatedAt = next.now;
  return {
    state: next,
    result: {
      acquired: true,
      attemptId: a.id,
      attemptStatus: a.status,
      requestPayload: clone(a.requestPayload),
      idempotencyKey: a.idempotencyKey,
      requestFingerprint: a.requestFingerprint,
      resumeCount: a.resumeCount,
      leaseOwner: owner
    }
  };
}

/**
 * Concurrence déterministe C8 : applique les claims dans l'ordre fourni.
 * Un seul acquired=true (équivalence UPDATE WHERE status=AWAITING).
 */
function claimLeaseConcurrent(state, attempts) {
  let current = state;
  const results = [];
  let winners = 0;
  for (const args of attempts) {
    const out = claimLease(current, args);
    current = out.state;
    results.push(out.result);
    if (out.result.acquired) winners += 1;
  }
  return { state: current, result: { results, winners, losers: results.length - winners } };
}

/** reprendre_tentative_rendez_vous — ne change ni corps ni clé */
function resumeLease(state, { attemptId, sessionId, owner }) {
  if (!OWNER_RE.test(String(owner || ''))) {
    return { state, result: claimResult(true) };
  }
  const next = clone(state);
  const a = next.attempts[attemptId];
  const leaseExpired = a && a.status === 'SUBMITTING' && a.leaseUntil < next.now;
  const eligible = a && (a.status === 'UNCERTAIN' || leaseExpired);
  if (
    !a ||
    a.sessionId !== sessionId ||
    !a.idempotencyKey ||
    !a.requestPayload ||
    !eligible
  ) {
    return { state, result: claimResult(true) };
  }
  const frozenKey = a.idempotencyKey;
  const frozenFp = a.requestFingerprint;
  const frozenPayload = clone(a.requestPayload);
  a.status = 'SUBMITTING';
  a.leaseOwner = owner;
  a.leaseUntil = next.now + LEASE_MS;
  a.resumeCount = a.resumeCount + 1;
  a.updatedAt = next.now;
  return {
    state: next,
    result: {
      acquired: true,
      attemptId: a.id,
      attemptStatus: a.status,
      requestPayload: frozenPayload,
      idempotencyKey: frozenKey,
      requestFingerprint: frozenFp,
      resumeCount: a.resumeCount,
      leaseOwner: owner,
      sameKey: frozenKey === a.idempotencyKey,
      sameFingerprint: frozenFp === a.requestFingerprint
    }
  };
}

/** marquer_tentative_incertaine */
function markUncertain(state, { attemptId, sessionId, owner }) {
  const next = clone(state);
  const a = next.attempts[attemptId];
  if (
    !a ||
    a.sessionId !== sessionId ||
    a.status !== 'SUBMITTING' ||
    a.leaseOwner !== owner ||
    a.leaseUntil < next.now ||
    !a.idempotencyKey ||
    !a.requestPayload
  ) {
    return { state, result: { ok: false } };
  }
  const keyBefore = a.idempotencyKey;
  const fpBefore = a.requestFingerprint;
  a.status = 'UNCERTAIN';
  a.leaseOwner = null;
  a.leaseUntil = null;
  a.updatedAt = next.now;
  return {
    state: next,
    result: {
      ok: true,
      status: 'UNCERTAIN',
      sameKey: a.idempotencyKey === keyBefore,
      sameFingerprint: a.requestFingerprint === fpBefore,
      payloadPresent: a.requestPayload != null
    }
  };
}

function purgeOpenSecrets(a) {
  a.idempotencyKey = null;
  a.requestPayload = null;
  a.leaseOwner = null;
  a.leaseUntil = null;
}

/** cloturer_tentative_rendez_vous */
function closeAttempt(state, input) {
  const { attemptId, sessionId, owner, status } = input;
  const next = clone(state);
  const a = next.attempts[attemptId];
  if (!a || a.sessionId !== sessionId) {
    return { state, result: { ok: false } };
  }

  if (status === 'ABANDONED') {
    if (input.appointmentId != null || input.reference != null) {
      return { state, result: { ok: false } };
    }
    if (a.status !== 'AWAITING_CONFIRMATION') {
      return { state, result: { ok: false } };
    }
    a.status = 'ABANDONED';
    purgeOpenSecrets(a);
    a.updatedAt = next.now;
    return { state: next, result: { ok: true, status: 'ABANDONED' } };
  }

  if (!['CONFIRMED', 'REJECTED', 'SLOT_UNAVAILABLE'].includes(status)) {
    return { state, result: { ok: false } };
  }
  if (!OWNER_RE.test(String(owner || ''))) {
    return { state, result: { ok: false } };
  }
  if (
    a.status !== 'SUBMITTING' ||
    a.leaseOwner !== owner ||
    a.leaseUntil < next.now
  ) {
    return { state, result: { ok: false } };
  }

  if (status === 'CONFIRMED') {
    if (!input.appointmentId || !input.reference) {
      return { state, result: { ok: false } };
    }
    a.status = 'CONFIRMED';
    a.appointmentId = input.appointmentId;
    a.appointmentReference = input.reference;
    a.confirmedAt = next.now;
  } else {
    if (input.appointmentId != null || input.reference != null) {
      return { state, result: { ok: false } };
    }
    a.status = status;
  }
  purgeOpenSecrets(a);
  a.updatedAt = next.now;
  return { state: next, result: { ok: true, status: a.status } };
}

/**
 * creer_rendez_vous_idempotent (sous-ensemble) — incrémente postCount.
 * Retourne issue + projection HTTP sans PII dans result.http.
 */
function createAppointmentIdempotent(state, body) {
  const next = clone(state);
  next.postCount += 1;
  const payload = syntheticPayload(body);
  const rawKey = payload.cleIdempotence;
  if (!KEY_RE.test(rawKey)) {
    return {
      state,
      result: { issue: 'INVALID', http: { statusCode: 400, body: { error: { code: 'VALIDATION' } } } }
    };
  }
  const keyHash = hashIdempotencyKey(rawKey);
  const fp = fingerprintBody(payload);
  const existing = next.appointmentsByKeyHash[keyHash];

  if (existing) {
    if (existing.empreinte === fp) {
      return {
        state: next,
        result: {
          issue: 'REPLAYED',
          appointmentId: existing.id,
          reference: existing.reference,
          http: {
            statusCode: 200,
            body: {
              replayed: true,
              created: false,
              id: existing.id,
              reference: existing.reference
            }
          }
        }
      };
    }
    return {
      state: next,
      result: {
        issue: 'KEY_CONFLICT',
        appointmentId: null,
        reference: null,
        http: {
          statusCode: 409,
          body: { error: { code: 'IDEMPOTENCY_KEY_CONFLICT' } }
        }
      }
    };
  }

  const slotId = String(payload.slotId).toLowerCase();
  const slot = next.slots[slotId];
  const slotOk =
    slot &&
    slot.statut === 'DISPONIBLE' &&
    slot.placesReservees < slot.capacite &&
    slot.debut > next.now;

  if (!slotOk) {
    return {
      state: next,
      result: {
        issue: 'SLOT_UNAVAILABLE',
        appointmentId: null,
        reference: null,
        http: {
          statusCode: 409,
          body: { message: 'Créneau introuvable ou complet' }
        }
      }
    };
  }

  const id = crypto.randomUUID();
  const reference =
    'GB-SIM-' + String(Object.keys(next.appointmentsByKeyHash).length + 1).padStart(4, '0');
  next.appointmentsByKeyHash[keyHash] = {
    id,
    reference,
    empreinte: fp,
    slotId,
    keyHash
  };
  slot.placesReservees += 1;
  if (slot.placesReservees >= slot.capacite) {
    slot.statut = 'COMPLET';
  }

  return {
    state: next,
    result: {
      issue: 'CREATED',
      appointmentId: id,
      reference,
      http: {
        statusCode: 201,
        body: { created: true, replayed: false, id, reference }
      }
    }
  };
}

/** Mapping nœud VC9 « Interpréter résultat création ». */
function mapHttpOutcome(http) {
  const status = Number((http && http.statusCode) || 0);
  let body = http && http.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }
  const errorCode = body && body.error && body.error.code;
  const message = body && (body.message || (body.error && body.error.message));
  if (!status || body === null || body === undefined) return 'UNCERTAIN';
  if (status === 201 || (status === 200 && body.replayed === true && body.created === false)) {
    return 'CONFIRMED';
  }
  if (status === 400) return 'REJECTED';
  if (status === 409 && errorCode === 'IDEMPOTENCY_KEY_CONFLICT') return 'REJECTED';
  if (status === 409 && message === 'Créneau introuvable ou complet') return 'SLOT_UNAVAILABLE';
  return 'UNCERTAIN';
}

/**
 * Décider action tentative (extrait VC9) — pure, sans side-effect.
 */
function decideAttemptAction({ openAttempt, createDecision, conversationStep, now }) {
  const status = openAttempt ? openAttempt.status : null;
  const leaseUntil = openAttempt && openAttempt.leaseUntil != null ? Number(openAttempt.leaseUntil) : null;
  const expiresAt = openAttempt && openAttempt.expiresAt != null ? Number(openAttempt.expiresAt) : null;
  const leaseExpired = leaseUntil !== null && leaseUntil <= now;
  const waitExpired = expiresAt !== null && expiresAt <= now;
  const decision = createDecision || null;

  let attemptAction = 'COLLECT';
  if (status === 'UNCERTAIN' || (status === 'SUBMITTING' && leaseExpired)) {
    attemptAction = 'RESUME';
  } else if (status === 'SUBMITTING') {
    attemptAction = 'WAIT';
  } else if (status === 'AWAITING_CONFIRMATION' && waitExpired) {
    attemptAction = 'EXPIRE';
  } else if (status === 'AWAITING_CONFIRMATION' && decision === 'AFFIRM') {
    attemptAction = 'CLAIM';
  } else if (status === 'AWAITING_CONFIRMATION' && decision === 'NEGATIVE') {
    attemptAction = 'ABANDON';
  } else if (status === 'AWAITING_CONFIRMATION' && decision === 'MODIFY') {
    attemptAction = 'MODIFY';
  } else if (status === 'AWAITING_CONFIRMATION' && decision === 'RESTART') {
    attemptAction = 'RESTART';
  } else if (status === 'AWAITING_CONFIRMATION') {
    attemptAction = 'ASK';
  } else if (decision === 'INSERT') {
    attemptAction = 'INSERT';
  } else if (
    !status &&
    (conversationStep === 'AWAIT_CREATE_CONFIRMATION')
  ) {
    attemptAction = 'RESET_STALE';
  } else if (decision === 'RECALL' || (status === 'CONFIRMED' && decision === 'AFFIRM')) {
    attemptAction = 'RECALL';
  } else if (decision === 'RESUME') {
    attemptAction = 'RESUME';
  } else if (decision === 'EXPIRE') {
    attemptAction = 'EXPIRE';
  }
  return { attemptAction, noCreateAppointmentPost: attemptAction !== 'CLAIM' && attemptAction !== 'RESUME' };
}

/** Pipeline gagnant : claim/resume → POST simulé → close selon outcome. */
function runWinningSubmit(state, { attemptId, sessionId, owner, mode }) {
  const leaseFn = mode === 'resume' ? resumeLease : claimLease;
  const claimed = leaseFn(state, { attemptId, sessionId, owner });
  if (!claimed.result.acquired) {
    return { state: claimed.state, result: { acquired: false, posted: false } };
  }
  const body = claimed.result.requestPayload;
  const created = createAppointmentIdempotent(claimed.state, body);
  const outcome = mapHttpOutcome(created.result.http);
  let closed = created.state;
  let closeResult = { ok: false };
  if (outcome === 'CONFIRMED') {
    const c = closeAttempt(created.state, {
      attemptId,
      sessionId,
      owner,
      status: 'CONFIRMED',
      appointmentId: created.result.appointmentId,
      reference: created.result.reference
    });
    closed = c.state;
    closeResult = c.result;
  } else if (outcome === 'REJECTED' || outcome === 'SLOT_UNAVAILABLE') {
    const c = closeAttempt(created.state, {
      attemptId,
      sessionId,
      owner,
      status: outcome
    });
    closed = c.state;
    closeResult = c.result;
  } else if (outcome === 'UNCERTAIN') {
    const u = markUncertain(created.state, { attemptId, sessionId, owner });
    closed = u.state;
    closeResult = u.result;
  }
  return {
    state: closed,
    result: {
      acquired: true,
      posted: true,
      issue: created.result.issue,
      httpOutcome: outcome,
      close: closeResult,
      reference: created.result.reference || null,
      idempotencyKey: claimed.result.idempotencyKey,
      requestFingerprint: claimed.result.requestFingerprint,
      resumeCount: claimed.result.resumeCount
    }
  };
}

/** Timeout transport : claim OK, HTTP ambigu → UNCERTAIN sans RDV garanti. */
function runTransportTimeout(state, { attemptId, sessionId, owner }) {
  const claimed = claimLease(state, { attemptId, sessionId, owner });
  if (!claimed.result.acquired) {
    return { state: claimed.state, result: { acquired: false } };
  }
  // Pas de createAppointmentIdempotent : réponse perdue / timeout.
  const marked = markUncertain(claimed.state, { attemptId, sessionId, owner });
  return {
    state: marked.state,
    result: {
      acquired: true,
      postedAmbiguous: true,
      httpOutcome: 'UNCERTAIN',
      mark: marked.result,
      sameKey: marked.result.sameKey,
      sameFingerprint: marked.result.sameFingerprint,
      idempotencyKey: claimed.result.idempotencyKey,
      requestFingerprint: claimed.result.requestFingerprint
    }
  };
}

function evidence(state, attemptId) {
  const a = state.attempts[attemptId] || null;
  return {
    simulation: true,
    appointmentCount: appointmentCount(state),
    postCount: state.postCount,
    attemptStatus: a ? a.status : null,
    resumeCount: a ? a.resumeCount : null,
    openSecretsPurged: a ? a.requestPayload == null && a.idempotencyKey == null : null,
    openForSession: a ? openAttemptCount(state, a.sessionId) : null,
    hasLease: !!(a && a.leaseOwner && a.leaseUntil != null)
  };
}

module.exports = {
  LEASE_MS,
  emptyState,
  withNow,
  advanceTime,
  sha256Hex,
  fingerprintBody,
  hashIdempotencyKey,
  syntheticPayload,
  seedSlot,
  createAwaitingAttempt,
  claimLease,
  claimLeaseConcurrent,
  resumeLease,
  markUncertain,
  closeAttempt,
  createAppointmentIdempotent,
  mapHttpOutcome,
  decideAttemptAction,
  runWinningSubmit,
  runTransportTimeout,
  evidence,
  appointmentCount,
  openAttemptCount,
  OPEN,
  TERMINAL
};
