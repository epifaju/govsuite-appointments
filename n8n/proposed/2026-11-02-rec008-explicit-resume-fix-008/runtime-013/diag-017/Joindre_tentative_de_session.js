const trigger = $('Lorsqu\'un message de chat est reçu').item.json || {};
let previous = {};
try { previous = $('Charger état conversation').item.json ?? {}; } catch (e) { previous = {}; }
const row = $json || {};
const openAttempt = row.attempt_id ? {
  id: row.attempt_id,
  status: row.attempt_status,
  reference: row.appointment_reference || null,
  leaseUntil: row.lease_until || null,
  expiresAt: row.expires_at || null,
  resumeCount: row.resume_count
} : null;
return [{
  json: {
    ...previous,
    sessionId: previous.sessionId || previous.session_id || trigger.sessionId || null,
    // --- P4E/P4F START JOINDRE ---
    sessionFound: previous.session_found === true || previous.sessionFound === true
      || !!(previous.session_id || previous.pending_action || previous.conversation_step),
    sessionExpired: previous.session_expired === true || previous.sessionExpired === true,
    sessionExpiresAt: previous.session_expires_at || previous.sessionExpiresAt || previous.expires_at || null,
    // --- P4E/P4F END JOINDRE ---
    openAttempt
  }
}];