const saved = $json;
let collected = {};
let joined = {};

try { collected = $('Gérer collecte progressive').item.json ?? {}; } catch (e) { collected = {}; }
try { joined = $('Joindre tentative de session').item.json ?? {}; } catch (e) { joined = {}; }

const decision = collected.createDecision || null;
const openAttempt = joined.openAttempt || null;
const status = openAttempt ? openAttempt.status : null;
const now = Date.now();
const leaseUntil = openAttempt && openAttempt.leaseUntil ? new Date(openAttempt.leaseUntil).getTime() : null;
const expiresAt = openAttempt && openAttempt.expiresAt ? new Date(openAttempt.expiresAt).getTime() : null;
const leaseExpired = leaseUntil !== null && leaseUntil <= now;
const waitExpired = expiresAt !== null && expiresAt <= now;

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
} else if (!status && (saved.conversationStep === 'AWAIT_CREATE_CONFIRMATION' || collected.conversationStep === 'AWAIT_CREATE_CONFIRMATION')) {
  attemptAction = 'RESET_STALE';
} else if (decision === 'RECALL' || (status === 'CONFIRMED' && decision === 'AFFIRM')) {
  attemptAction = 'RECALL';
} else if (decision === 'RESUME') {
  attemptAction = 'RESUME';
} else if (decision === 'EXPIRE') {
  attemptAction = 'EXPIRE';
}

return [{
  json: {
    sessionId: saved.sessionId || joined.sessionId || null,
    conversationStep: saved.conversationStep || collected.conversationStep || null,
    attemptAction,
    modifyField: collected.modifyField || null,
    openAttempt,
    reference: saved.reference || (openAttempt && openAttempt.reference) || null,
    ready: false,
    claimAcquired: false
  }
}];