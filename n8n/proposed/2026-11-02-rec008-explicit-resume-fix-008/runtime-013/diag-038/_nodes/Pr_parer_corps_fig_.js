let collected = {};
try { collected = $('Gérer collecte progressive').item.json ?? {}; } catch (e) { collected = {}; }

function nfc(value) {
  return String(value ?? '').trim().normalize('NFC');
}

const idempotencyKey = String($json.idempotencyKey || '');
const attemptId = String($json.attemptId || '');
const keyOk = /^rec008-[0-9a-f]{64}$/.test(idempotencyKey);
const idOk = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attemptId);
if (!keyOk || !idOk) {
  return [{ json: { frozenReady: false, sessionId: collected.sessionId || null } }];
}

const slots = Array.isArray(collected.availableSlots) ? collected.availableSlots : [];
const remembered = String(collected.slotId || '').trim().toLowerCase();
const slot = slots.find((item) => String(item.id || item.slotId || '').trim().toLowerCase() === remembered);
const slotId = String((slot && (slot.id || slot.slotId)) || collected.slotId || '').trim().toLowerCase();
const payload = {
  slotId,
  nom: nfc(collected.nom),
  prenom: nfc(collected.prenom),
  email: String(collected.email || '').trim(),
  telephone: String(collected.telephone || '').trim(),
  numeroDocument: '',
  langue: 'fr',
  cleIdempotence: idempotencyKey
};
const canonical = JSON.stringify(payload);
return [{
  json: {
    frozenReady: true,
    attemptId,
    sessionId: collected.sessionId || null,
    idempotencyKey,
    requestPayload: payload,
    canonical
  }
}];