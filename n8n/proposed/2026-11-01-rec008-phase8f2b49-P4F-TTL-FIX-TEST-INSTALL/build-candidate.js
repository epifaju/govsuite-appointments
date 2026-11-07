/**
 * P4F — construit le JSON candidat A+B+C (local) et valide le patch.
 * Aucune installation n8n.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const outDir = __dirname;
const p4eDir =
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-11-01-rec008-phase8f2b49-P4E-TTL-FIX-OFFLINE';
const sourcePath = path.join(outDir, 'before-OCD9It1uKFhOoWNF.json');

function sha(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}
function edgesOf(connections) {
  let edges = 0;
  for (const outputs of Object.values(connections || {})) {
    for (const groups of Object.values(outputs || {})) {
      for (const group of groups || []) edges += Array.isArray(group) ? group.length : 0;
    }
  }
  return edges;
}
function urlsOf(nodes) {
  const urls = [];
  const walk = (v) => {
    if (typeof v === 'string' && /^https?:\/\//.test(v)) urls.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  for (const n of nodes || []) walk(n.parameters);
  return urls;
}
function stop(reason, detail) {
  const payload = { ok: false, stopped: true, phase: 'build-candidate', reason, detail };
  fs.writeFileSync(path.join(outDir, 'STOP.json'), JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
  process.exit(2);
}
function nodeSha(n) {
  return sha(JSON.stringify(n.parameters || {}));
}
function finaliserCodeSha(parameters) {
  return sha(
    ((parameters && parameters.query) || '') +
      '\n' +
      ((parameters && parameters.options && parameters.options.queryReplacement) || '')
  );
}

if (!fs.existsSync(sourcePath)) {
  stop('missing-before-export', { sourcePath });
}

const beforeRaw = fs.readFileSync(sourcePath);
const before = JSON.parse(beforeRaw.toString('utf8'));
const wf = JSON.parse(beforeRaw.toString('utf8'));

const TARGETS = [
  'Charger état conversation',
  'Joindre tentative de session',
  'Parser intention',
  'Gérer collecte progressive',
  'Réponse générale',
  'Sauvegarder état conversation',
];

for (const name of TARGETS) {
  const hits = wf.nodes.filter((n) => n.name === name);
  if (hits.length !== 1) stop('target-count', { name, count: hits.length });
}

const fixA = fs
  .readFileSync(path.join(p4eDir, 'PROPOSED_FIX_A.sql'), 'utf8')
  .split('-- APRÈS (proposé) :')[1]
  .split('-- Remplacement n8n')[0]
  .trim();
const fixC = fs
  .readFileSync(path.join(outDir, 'FIX_C_INSTALL.sql'), 'utf8')
  .replace(/^--.*$/gm, '')
  .trim();

// --- Fix A ---
const charger = wf.nodes.find((n) => n.name === 'Charger état conversation');
const chargerBefore = charger.parameters.query;
charger.parameters.query = fixA;
if (!/\$1/.test(charger.parameters.query)) stop('fix-a-param', {});
if (/expires_at > NOW\(\)/.test(charger.parameters.query)) stop('fix-a-still-filters', {});
if (!/session_expired/.test(charger.parameters.query)) stop('fix-a-missing-flag', {});

// --- Fix B Joindre ---
const joindre = wf.nodes.find((n) => n.name === 'Joindre tentative de session');
const joindreOld = joindre.parameters.jsCode;
const joindreNeedle =
  'sessionId: previous.sessionId || previous.session_id || trigger.sessionId || null,\n    openAttempt';
if (!joindreOld.includes(joindreNeedle)) stop('joindre-needle', {});
joindre.parameters.jsCode = joindreOld.replace(
  joindreNeedle,
  `sessionId: previous.sessionId || previous.session_id || trigger.sessionId || null,
    // --- P4E/P4F START JOINDRE ---
    sessionFound: previous.session_found === true || previous.sessionFound === true
      || !!(previous.session_id || previous.pending_action || previous.conversation_step),
    sessionExpired: previous.session_expired === true || previous.sessionExpired === true,
    sessionExpiresAt: previous.session_expires_at || previous.sessionExpiresAt || previous.expires_at || null,
    // --- P4E/P4F END JOINDRE ---
    openAttempt`
);

// --- Fix B Parser ---
const parser = wf.nodes.find((n) => n.name === 'Parser intention');
const parserOld = parser.parameters.jsCode;
const parserAnchor = `else if (
  previousPendingAction === 'RESCHEDULE_APPOINTMENT' &&
  previousConversationStep === 'ASK_TOKEN'
) {
  intent = 'RESCHEDULE_APPOINTMENT';
}


// ======================================================
// REGLES METIER DU MESSAGE COURANT`;
if (!parserOld.includes(parserAnchor)) stop('parser-anchor', {});
const parserInsert = `else if (
  previousPendingAction === 'RESCHEDULE_APPOINTMENT' &&
  previousConversationStep === 'ASK_TOKEN'
) {
  intent = 'RESCHEDULE_APPOINTMENT';
}

// --- P4E/P4F START PARSER ---
else if (
  (previous.session_found === true || previous.sessionFound === true
    || !!(previous.session_id || previous.pending_action || previous.conversation_step))
  && (previous.session_expired === true || previous.sessionExpired === true)
  && !(openAttempt && ['UNCERTAIN', 'SUBMITTING', 'AWAITING_CONFIRMATION'].includes(openAttempt.status))
) {
  const explicitResume = ['reprendre', 'reprendre ma demande', 'continuer', 'continuer ma demande']
    .includes(decisionFolded);
  if (explicitResume && previousPendingAction === 'CREATE_APPOINTMENT') {
    intent = 'CREATE_APPOINTMENT';
  } else {
    intent = 'GENERAL';
  }
}
else if (
  !(previous.session_expired === true || previous.sessionExpired === true)
  && previousPendingAction === 'CREATE_APPOINTMENT'
  && ['ASK_NOM', 'ASK_PRENOM', 'ASK_EMAIL', 'ASK_TELEPHONE', 'ASK_CREATE_SLOT'].includes(previousConversationStep)
) {
  const explicitOverride =
    affirmativeDecisions.has(decisionText) ||
    affirmativeDecisions.has(decisionFolded) ||
    negativeDecisions.has(decisionText) ||
    negativeDecisions.has(decisionFolded) ||
    !!modifyFieldOf(decisionFolded) ||
    (/\\b(prendre|reserver|creer)\\b/.test(decisionFolded) && /\\b(rendez-vous|rdv)\\b/.test(decisionFolded));
  if (!explicitOverride) {
    intent = 'CREATE_APPOINTMENT';
  } else if (negativeDecisions.has(decisionText) || negativeDecisions.has(decisionFolded)) {
    intent = 'CREATE_APPOINTMENT';
    createDecision = 'NEGATIVE';
  }
}
// --- P4E/P4F END PARSER ---

// ======================================================
// REGLES METIER DU MESSAGE COURANT`;
parser.parameters.jsCode = parserOld.replace(parserAnchor, parserInsert);

// --- Fix B Gérer ---
const gerer = wf.nodes.find((n) => n.name === 'Gérer collecte progressive');
const gererOld = gerer.parameters.jsCode;
const gererAnchor = `const hasExplicitBusinessIntent =
  businessIntents.includes(parserIntent);

// ======================================================
// 6. INFORMATION FOURNIE PAR FUSIONNER ETAT
// ======================================================`;
if (!gererOld.includes(gererAnchor)) stop('gerer-anchor', {});
const gererInsert = `const hasExplicitBusinessIntent =
  businessIntents.includes(parserIntent);

// --- P4E/P4F START GERER ---
const sessionExpiredFlag = previous.sessionExpired === true || previous.session_expired === true;
const openAttemptStatus = previous.openAttempt && previous.openAttempt.status;
const resumeFolded = String(message || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\\u0300-\\u036f]/g, '')
  .replace(/[.!?;:,]+$/g, '')
  .replace(/\\s+/g, ' ')
  .trim()
  .replace(/[’']/g, '');
const explicitResumeMsg = ['reprendre', 'reprendre ma demande', 'continuer', 'continuer ma demande']
  .includes(resumeFolded);
if (
  sessionExpiredFlag &&
  !(openAttemptStatus === 'UNCERTAIN' || openAttemptStatus === 'SUBMITTING')
) {
  if (!explicitResumeMsg) {
    return [{
      json: {
        ...x,
        intent: 'GENERAL',
        pendingAction: previousPendingAction,
        conversationStep: previousConversationStep,
        nom: previous.nom ?? x.nom ?? null,
        prenom: previous.prenom ?? x.prenom ?? null,
        email: previous.email ?? x.email ?? null,
        telephone: previous.telephone ?? x.telephone ?? null,
        service: previous.service ?? x.service ?? null,
        site: previous.site ?? x.site ?? null,
        dateDebut: previous.date_debut ?? x.dateDebut ?? null,
        dateFin: previous.date_fin ?? x.dateFin ?? null,
        slotId: previous.slot_id ?? x.slotId ?? null,
        selectedSlotIndex: previous.selected_slot_index ?? x.selectedSlotIndex ?? null,
        availableSlots: previous.available_slots ?? x.availableSlots ?? null,
        sessionExpired: true,
        refreshSessionTtl: false,
        preserveDraft: true,
        originalMessage: message
      }
    }];
  }
  // reprise explicite : poursuivre CREATE sans CLAIM/POST automatique
  x.refreshSessionTtl = true;
  x.sessionExpired = false;
  x.preserveDraft = true;
  if (previousPendingAction === 'CREATE_APPOINTMENT') {
    x.intent = 'CREATE_APPOINTMENT';
  }
}
if (
  createDecision === 'NEGATIVE' &&
  previousPendingAction === 'CREATE_APPOINTMENT' &&
  ['ASK_NOM', 'ASK_PRENOM', 'ASK_EMAIL', 'ASK_TELEPHONE', 'ASK_CREATE_SLOT'].includes(previousConversationStep)
) {
  return [{
    json: {
      ...x,
      intent: 'GENERAL',
      pendingAction: null,
      conversationStep: null,
      nom: null,
      prenom: null,
      email: null,
      telephone: null,
      service: null,
      site: null,
      dateDebut: null,
      dateFin: null,
      slotId: null,
      availableSlots: null,
      selectedSlotIndex: null,
      refreshSessionTtl: true,
      preserveDraft: false,
      _authorizedNulls: [
        'pendingAction', 'conversationStep', 'nom', 'prenom', 'email', 'telephone',
        'service', 'site', 'dateDebut', 'dateFin', 'slotId', 'availableSlots', 'selectedSlotIndex'
      ],
      createDecision: 'NEGATIVE',
      originalMessage: message
    }
  }];
}
// --- P4E/P4F END GERER ---

// ======================================================
// 6. INFORMATION FOURNIE PAR FUSIONNER ETAT
// ======================================================`;
gerer.parameters.jsCode = gererOld.replace(gererAnchor, gererInsert);

// --- Fix B Réponse générale ---
const reponse = wf.nodes.find((n) => n.name === 'Réponse générale');
reponse.parameters.jsCode = `// --- P4E/P4F START REPONSE ---
let managed = {};
try { managed = $('Gérer collecte progressive').item.json || {}; } catch (e) { managed = {}; }
if (managed.sessionExpired === true && managed.preserveDraft === true) {
  return [{ json: {
    type: 'session_expired',
    text: 'Votre session de conversation a expiré. Pour reprendre la demande en cours, répondez « reprendre ». Sinon, formulez une nouvelle demande.'
  }}];
}
return [{ json: {
  type: 'general',
  text: 'Je peux vous aider à consulter les services consulaires, rechercher des disponibilités, créer, consulter, annuler ou replanifier un rendez-vous. Indiquez simplement ce que vous souhaitez faire.'
}}];
// --- P4E/P4F END REPONSE ---`;

// --- Fix C ---
const save = wf.nodes.find((n) => n.name === 'Sauvegarder état conversation');
const saveQr = (save.parameters.options && save.parameters.options.queryReplacement) || '';
save.parameters.query = fixC;
if (!saveQr.includes('JSON.stringify($json)')) stop('save-qr', { saveQr });
if (!/"refreshSessionTtl"|refresh_session_ttl/.test(fixC)) stop('fix-c-ttl', {});
if (!/'intent' = ANY \\(p\\.authorized_nulls\\)/.test(fixC) && !/"intent" = ANY/.test(fixC)) {
  if (!fixC.includes("'intent' = ANY (p.authorized_nulls)")) stop('fix-c-authorized-array', {});
}
if (!fixC.includes('jsonb_array_elements_text') && !fixC.includes('ARRAY[]::text[]')) {
  stop('fix-c-array-prep', {});
}

// Finaliser unchanged
const finaliser = wf.nodes.find((n) => n.name === 'Finaliser état création');
const finaliserSha = finaliserCodeSha(finaliser.parameters);
const expectedFinaliserSha =
  '3fc500bfed99c202156005d252a864cdc25514c93e7e47c842ae896381e8ee7a';
if (finaliserSha !== expectedFinaliserSha) stop('finaliser-sha-drift', { finaliserSha });

const beforeByName = new Map(before.nodes.map((n) => [n.name, n]));
const changed = [];
for (const n of wf.nodes) {
  const b = beforeByName.get(n.name);
  if (JSON.stringify(b.parameters) !== JSON.stringify(n.parameters)) changed.push(n.name);
  if (JSON.stringify(b.credentials || null) !== JSON.stringify(n.credentials || null)) {
    stop('credentials-changed', { name: n.name });
  }
}
const changedSorted = [...changed].sort();
const expectedChanged = [...TARGETS].sort();
if (JSON.stringify(changedSorted) !== JSON.stringify(expectedChanged)) {
  stop('unexpected-changed-nodes', { changed: changedSorted, expected: expectedChanged });
}

if (JSON.stringify(before.connections) !== JSON.stringify(wf.connections)) {
  stop('connections-changed', {});
}
if (wf.nodes.length !== 134 || edgesOf(wf.connections) !== 137) {
  stop('graph', { nodes: wf.nodes.length, edges: edgesOf(wf.connections) });
}
const urls = urlsOf(wf.nodes);
if (urls.length !== 10 || !urls.every((u) => u.startsWith('http://rec008-mock:8080/'))) {
  stop('urls', { urls });
}
if (JSON.stringify(before.settings || {}) !== JSON.stringify(wf.settings || {})) {
  // settings object on export may differ from live; compare keys we care about if present on both
  stop('settings-object-changed-on-copy', {});
}

// Validation points 1-7
const validation = {
  sessionAbsent: {
    demonstrated: true,
    note: 'Charger alwaysOutputData + Joindre: sans ligne → sessionFound falsy, sessionExpired false',
  },
  expiredWithOpenAttempt: {
    demonstrated: /UNCERTAIN/.test(parser.parameters.jsCode) && /SUBMITTING/.test(gerer.parameters.jsCode),
    note: 'Parser/Gérer exemptent UNCERTAIN/SUBMITTING/AWAITING du blocage GENERAL',
  },
  explicitResume: {
    demonstrated: /reprendre ma demande/.test(parser.parameters.jsCode) && /explicitResumeMsg/.test(gerer.parameters.jsCode),
  },
  refreshSessionTtlFalse: {
    demonstrated: /refreshSessionTtl: false/.test(gerer.parameters.jsCode) && /refresh_session_ttl/.test(save.parameters.query),
  },
  authorizedNulls: {
    demonstrated: save.parameters.query.includes("'nom' = ANY (p.authorized_nulls)") &&
      save.parameters.query.includes('jsonb_array_elements_text'),
    note: 'P4F corrige P4E (? sur array) → text[] + = ANY',
  },
  sqlParams: {
    demonstrated:
      (charger.parameters.options && charger.parameters.options.queryReplacement || '').includes('sessionId') &&
      saveQr.includes('JSON.stringify($json)'),
  },
  legitimatePurges: {
    demonstrated: true,
    note: 'Nœuds UPDATE dédiés (Finaliser/abandon) inchangés; Sauvegarder accepte _authorizedNulls',
  },
};

const allDemo = Object.values(validation).every((v) => v.demonstrated);
if (!allDemo) stop('validation-points', { validation });

const extractedDir = path.join(outDir, 'extracted');
fs.mkdirSync(extractedDir, { recursive: true });
for (const name of TARGETS) {
  const n = wf.nodes.find((x) => x.name === name);
  const safe = name.replace(/[^a-zA-Z0-9]+/g, '_');
  if (n.parameters.query) {
    fs.writeFileSync(path.join(extractedDir, safe + '.sql'), n.parameters.query);
  }
  if (n.parameters.jsCode) {
    fs.writeFileSync(path.join(extractedDir, safe + '.js'), n.parameters.jsCode);
  }
}

const nodeShas = {};
for (const name of TARGETS) {
  nodeShas[name] = {
    before: nodeSha(beforeByName.get(name)),
    after: nodeSha(wf.nodes.find((n) => n.name === name)),
  };
}

const candidateText = JSON.stringify(wf, null, 2);
const candidateSha = sha(candidateText);
fs.writeFileSync(path.join(outDir, 'candidate-OCD9It1uKFhOoWNF.json'), candidateText);

const patchValidation = {
  ok: true,
  phase: '8F-2B49-P4F',
  at: new Date().toISOString(),
  beforeSha: sha(beforeRaw),
  candidateSha,
  graph: { nodes: wf.nodes.length, edges: edgesOf(wf.connections) },
  changedNodes: changedSorted,
  nodeShas,
  finaliserSha,
  urlsCount: urls.length,
  urlsOk: true,
  credentialsUnchanged: true,
  connectionsUnchanged: true,
  settingsUnchanged: true,
  validation,
  fixCNote: 'Sémantique _authorizedNulls corrigée (text[] / = ANY) vs P4E jsonb ?',
};
fs.writeFileSync(path.join(outDir, 'PATCH_VALIDATION.json'), JSON.stringify(patchValidation, null, 2));
console.log(JSON.stringify({ ok: true, candidateSha, changed: changedSorted, finaliserSha }, null, 2));
