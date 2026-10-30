// Mock REC-008. Ne pas démarrer pendant la phase 8E-2B-1.
// Le journal ne conserve ni corps brut, ni clé, ni jeton.
// 8F-1E : GET /appointments/availability aligné sur 02_API_GetAvailability.

import { createHash } from 'node:crypto';
import { createServer } from 'node:http';

const scenario = process.env.REC008_MOCK_SCENARIO || 'created';
const calls = [];
const keyCounts = new Map();

const appointment = {
  id: '55555555-5555-4555-8555-555555555555',
  reference: 'REC008-MOCK-0001',
  statut: 'CONFIRME',
  email: 'camille.essai@example.test',
  telephone: '+33000000000',
  debut: '2026-11-03T09:00:00+01:00',
  fin: '2026-11-03T09:30:00+01:00',
  service: 'PASSEPORT',
  site: 'PARIS'
};

// Créneaux synthétiques alignés sur postgres/030_seed_synthetique.sql.
const creneaux = [
  {
    id: '33333333-3333-4333-8333-333333333333',
    service: 'PASSEPORT',
    site: 'PARIS',
    debut: '2026-11-03T09:00:00+01:00',
    fin: '2026-11-03T09:30:00+01:00',
    capacite: 2,
    places_reservees: 0,
    statut: 'DISPONIBLE'
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    service: 'PASSEPORT',
    site: 'PARIS',
    debut: '2026-11-03T10:00:00+01:00',
    fin: '2026-11-03T10:30:00+01:00',
    capacite: 1,
    places_reservees: 1,
    statut: 'COMPLET'
  }
];

function hash(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function readBody(request) {
  return new Promise((resolve) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

function metadata(method, path, raw) {
  let fields = [];
  let keyHash = null;
  let bodyHash = hash(raw);
  if (raw.length) {
    try {
      const json = JSON.parse(raw.toString('utf8'));
      fields = Object.keys(json).sort();
      if (json.cleIdempotence) keyHash = hash(json.cleIdempotence);
    } catch {
      fields = [];
    }
  }
  return { method, path, bodyHash, keyHash, fields };
}

function record(entry) {
  calls.push({ at: new Date().toISOString(), scenario, ...entry });
  if (entry.keyHash) keyCounts.set(entry.keyHash, (keyCounts.get(entry.keyHash) || 0) + 1);
}

function send(response, status, payload) {
  if (payload === undefined) {
    response.writeHead(status);
    response.end();
    return;
  }
  if (typeof payload === 'string') {
    response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(payload);
    return;
  }
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function createResponse(keyHash) {
  const seen = keyHash ? keyCounts.get(keyHash) || 0 : 0;
  if (scenario === 'double') {
    if (seen === 0) return [201, { success: true, created: true, appointment }];
    return [200, { success: true, created: false, replayed: true, appointment }];
  }
  const table = {
    created: [201, { success: true, created: true, appointment }],
    replayed: [200, { success: true, created: false, replayed: true, appointment }],
    validation: [400, { error: { code: 'VALIDATION_ERROR', message: 'champ fictif invalide' } }],
    conflict: [409, { error: { code: 'IDEMPOTENCY_KEY_CONFLICT' } }],
    slot: [409, { message: 'Créneau introuvable ou complet' }],
    unknown409: [409, { error: { code: 'UNCLASSIFIED_CONFLICT', message: 'conflit non classé' } }],
    error: [500, { error: { code: 'INTERNAL_ERROR' } }],
    empty: [200, ''],
    malformed: [200, '<<<']
  };
  return table[scenario] || table.created;
}

function isYmd(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

// Même filtre que 02_API_GetAvailability : DISPONIBLE, places libres,
// debut dans [dateDebut, dateFin + 1 jour[.
function availabilitySlots(query) {
  const service = String(query.get('service') || '').toUpperCase().trim();
  const site = String(query.get('site') || '').toUpperCase().trim();
  const dateDebut = String(query.get('dateDebut') || '').trim();
  const dateFin = String(query.get('dateFin') || dateDebut || '').trim();
  if (!service || !site || !isYmd(dateDebut) || !isYmd(dateFin)) {
    return { success: true, count: 0, slots: [] };
  }
  const start = Date.parse(dateDebut + 'T00:00:00+01:00');
  const endExclusive = Date.parse(dateFin + 'T00:00:00+01:00') + 24 * 60 * 60 * 1000;
  const slots = creneaux
    .filter((slot) => {
      if (slot.service !== service || slot.site !== site) return false;
      if (slot.statut !== 'DISPONIBLE') return false;
      if (!(slot.places_reservees < slot.capacite)) return false;
      const debutMs = Date.parse(slot.debut);
      return debutMs >= start && debutMs < endExclusive;
    })
    .map((slot) => ({
      id: slot.id,
      service: slot.service,
      site: slot.site,
      debut: slot.debut,
      fin: slot.fin,
      capacite: slot.capacite,
      places_reservees: slot.places_reservees,
      places_disponibles: slot.capacite - slot.places_reservees
    }))
    .sort((left, right) => Date.parse(left.debut) - Date.parse(right.debut));
  return { success: true, count: slots.length, slots };
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://rec008-mock:8080');
  if (request.method === 'GET' && url.pathname === '/_meta/calls') {
    const byPath = {};
    for (const call of calls) {
      const key = call.method + ' ' + call.path + ' ' + call.status;
      byPath[key] = (byPath[key] || 0) + 1;
    }
    send(response, 200, { scenario, total: calls.length, byPath, distinctKeys: keyCounts.size });
    return;
  }
  const raw = await readBody(request);
  const meta = metadata(request.method, url.pathname, raw);
  if (request.method === 'POST' && url.pathname === '/appointments' && scenario === 'timeout') {
    record({ ...meta, status: 'timeout' });
    setTimeout(() => response.destroy(), 25000);
    return;
  }
  let status = 200;
  let payload = { ok: true };
  if (request.method === 'GET' && url.pathname === '/services') {
    payload = { services: [
      { code: 'PASSEPORT', nom: 'Passeport', description: 'Service fictif REC-008', duree_minutes: 30, capacite_par_creneau: 2 },
      { code: 'VISA', nom: 'Visa', description: 'Service fictif REC-008', duree_minutes: 30, capacite_par_creneau: 2 },
      { code: 'LEGALISATION', nom: 'Légalisation', description: 'Service fictif REC-008', duree_minutes: 20, capacite_par_creneau: 3 },
      { code: 'ETAT_CIVIL', nom: 'État civil', description: 'Service fictif REC-008', duree_minutes: 45, capacite_par_creneau: 1 }
    ] };
  } else if (request.method === 'GET' && url.pathname === '/appointments/availability') {
    payload = availabilitySlots(url.searchParams);
  } else if (request.method === 'GET' && url.pathname === '/appointments/manage') {
    payload = { appointment };
  } else if (request.method === 'POST' && url.pathname === '/appointments/cancel') {
    payload = { appointment: { ...appointment, statut: 'ANNULE' } };
  } else if (request.method === 'POST' && url.pathname === '/appointments/reschedule') {
    payload = { appointment: { ...appointment, debut: '2026-11-04T09:00:00+01:00' } };
  } else if (request.method === 'POST' && url.pathname === '/appointments') {
    [status, payload] = createResponse(meta.keyHash);
  } else {
    status = 404;
    payload = { error: { code: 'NOT_FOUND' } };
  }
  record({ ...meta, status });
  send(response, status, payload);
});

server.listen(8080, '0.0.0.0');
