const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const outDir =
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-30-rec008-phase8f2b8-NON-PUBLIE';
const sourcePath = path.join(outDir, 'source-installed.json');
const expectedSlotId = '33333333-3333-4333-8333-333333333333';
const expectedGov = '13|14|12|48|0|a2dea067599fd4f0a5f857551adc67cc';

function sha(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}
function docker(args) {
  return execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
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

const validerBefore = fs.readFileSync(
  path.join(outDir, 'node-Valider_param_tres_cr_ation.js'),
  'utf8'
);

const validerAfter = `const routed = $json;
let collected = {};

try {
  collected = $('Gérer collecte progressive').item.json ?? {};
} catch (e) {
  collected = {};
}

const hasValue = (v) =>
  v !== undefined &&
  v !== null &&
  !(typeof v === 'string' && v.trim() === '');

const pick = (key) =>
  hasValue(routed[key]) ? routed[key] : hasValue(collected[key]) ? collected[key] : null;

// Informative hydration only: business fields from Gérer when the
// routing payload (Décider) intentionally omits them.
// Authorization flags stay those of the routed item.
const x = {
  ...routed,
  slotId: pick('slotId'),
  nom: pick('nom'),
  prenom: pick('prenom'),
  email: pick('email'),
  telephone: pick('telephone'),
  intent: pick('intent'),
  pendingAction: pick('pendingAction'),
  conversationStep:
    routed.conversationStep ??
    collected.conversationStep ??
    null,
  createDecision:
    routed.createDecision ??
    collected.createDecision ??
    null,
  claimAcquired: routed.claimAcquired === true
};

const missing = [];

// ------------------------------------------------------
// Vérification des champs obligatoires
// ------------------------------------------------------

if (!x.slotId) {
  missing.push("le créneau choisi");
}

if (!x.nom) {
  missing.push("le nom");
}

if (!x.prenom) {
  missing.push("le prénom");
}

if (!x.email) {
  missing.push("l'adresse e-mail");
}

if (!x.telephone) {
  missing.push("le numéro de téléphone");
}

// ------------------------------------------------------
// Validation UUID
// ------------------------------------------------------

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const slotIdValide =
  !!x.slotId &&
  uuidRegex.test(
    String(x.slotId).trim()
  );

// ------------------------------------------------------
// Validation email
// ------------------------------------------------------

const emailValide =
  !!x.email &&
  /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(
    String(x.email).trim()
  );

// ------------------------------------------------------
// Validation téléphone
// ------------------------------------------------------

const telephoneNormalise =
  x.telephone
    ? String(x.telephone)
        .replace(/[^\\d+]/g, '')
        .trim()
    : '';

const telephoneValide =
  telephoneNormalise.replace(/\\D/g, '').length >= 8;

// ------------------------------------------------------
// Détermination de l'étape conversationnelle
// ------------------------------------------------------

let pendingAction =
  x.pendingAction ?? null;

let conversationStep =
  x.conversationStep ?? null;

if (
  x.intent === 'CREATE_APPOINTMENT' ||
  pendingAction === 'CREATE_APPOINTMENT'
) {
  pendingAction = 'CREATE_APPOINTMENT';

  const earlyCollectionSteps = [
    'ASK_CREATE_SERVICE',
    'ASK_CREATE_SITE',
    'ASK_CREATE_DATE_RANGE',
    'READY_CREATE_SEARCH',
    'ASK_CREATE_SLOT'
  ];

  if (!slotIdValide && earlyCollectionSteps.includes(x.conversationStep)) {
    conversationStep = x.conversationStep;
  }
  else if (!slotIdValide) {
    conversationStep = 'ASK_CREATE_SLOT';
  }
  else if (!x.nom) {
    conversationStep = 'ASK_NOM';
  }
  else if (!x.prenom) {
    conversationStep = 'ASK_PRENOM';
  }
  else if (!emailValide) {
    conversationStep = 'ASK_EMAIL';
  }
  else if (!telephoneValide) {
    conversationStep = 'ASK_TELEPHONE';
  }
  else if (x.conversationStep === 'AWAIT_CREATE_CONFIRMATION' || x.createDecision) {
    conversationStep = 'AWAIT_CREATE_CONFIRMATION';
  } else {
    conversationStep = x.conversationStep;
  }
}

// ------------------------------------------------------
// Validation finale (autorisation POST / claim uniquement)
// ------------------------------------------------------

const ready = x.claimAcquired === true;

// ------------------------------------------------------
// Résultat
// Keep the thin routing payload; do not re-emit collected PII.
// ------------------------------------------------------

return [{
  json: {
    ...routed,

    pendingAction,
    conversationStep,

    telephone:
      telephoneNormalise || routed.telephone || null,

    ready,

    missing,

    validation: {
      slotIdValide,
      emailValide,
      telephoneValide
    }
  }
}];
`;

fs.writeFileSync(path.join(outDir, 'node-Valider-FIXED.js'), validerAfter);

// Pure offline implementations mirroring before/after
function validateCreate(routed, collected, mode) {
  const hasValue = (v) =>
    v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '');
  const pick = (key) =>
    hasValue(routed[key]) ? routed[key] : hasValue(collected[key]) ? collected[key] : null;

  let x;
  if (mode === 'fixed') {
    x = {
      ...routed,
      slotId: pick('slotId'),
      nom: pick('nom'),
      prenom: pick('prenom'),
      email: pick('email'),
      telephone: pick('telephone'),
      intent: pick('intent'),
      pendingAction: pick('pendingAction'),
      conversationStep: routed.conversationStep ?? collected.conversationStep ?? null,
      createDecision: routed.createDecision ?? collected.createDecision ?? null,
      claimAcquired: routed.claimAcquired === true,
    };
  } else {
    x = { ...routed };
  }

  const missing = [];
  if (!x.slotId) missing.push('le créneau choisi');
  if (!x.nom) missing.push('le nom');
  if (!x.prenom) missing.push('le prénom');
  if (!x.email) missing.push("l'adresse e-mail");
  if (!x.telephone) missing.push('le numéro de téléphone');

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const slotIdValide = !!x.slotId && uuidRegex.test(String(x.slotId).trim());
  const emailValide =
    !!x.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(x.email).trim());
  const telephoneNormalise = x.telephone
    ? String(x.telephone).replace(/[^\d+]/g, '').trim()
    : '';
  const telephoneValide = telephoneNormalise.replace(/\D/g, '').length >= 8;

  let pendingAction = x.pendingAction ?? null;
  let conversationStep = x.conversationStep ?? null;
  if (x.intent === 'CREATE_APPOINTMENT' || pendingAction === 'CREATE_APPOINTMENT') {
    pendingAction = 'CREATE_APPOINTMENT';
    const early = [
      'ASK_CREATE_SERVICE',
      'ASK_CREATE_SITE',
      'ASK_CREATE_DATE_RANGE',
      'READY_CREATE_SEARCH',
      'ASK_CREATE_SLOT',
    ];
    if (!slotIdValide && early.includes(x.conversationStep)) conversationStep = x.conversationStep;
    else if (!slotIdValide) conversationStep = 'ASK_CREATE_SLOT';
    else if (!x.nom) conversationStep = 'ASK_NOM';
    else if (!x.prenom) conversationStep = 'ASK_PRENOM';
    else if (!emailValide) conversationStep = 'ASK_EMAIL';
    else if (!telephoneValide) conversationStep = 'ASK_TELEPHONE';
    else if (x.conversationStep === 'AWAIT_CREATE_CONFIRMATION' || x.createDecision)
      conversationStep = 'AWAIT_CREATE_CONFIRMATION';
    else conversationStep = x.conversationStep;
  }

  const ready = x.claimAcquired === true;
  const base = mode === 'fixed' ? { ...routed } : { ...x };
  return {
    ...base,
    pendingAction,
    conversationStep,
    telephone: telephoneNormalise || (mode === 'fixed' ? routed.telephone : x.telephone) || null,
    ready,
    missing,
    validation: { slotIdValide, emailValide, telephoneValide },
  };
}

function decideAction(saved, collected, joined, now = Date.now()) {
  const decision = collected.createDecision || null;
  const openAttempt = joined.openAttempt || null;
  const status = openAttempt ? openAttempt.status : null;
  const leaseUntil =
    openAttempt && openAttempt.leaseUntil ? new Date(openAttempt.leaseUntil).getTime() : null;
  const expiresAt =
    openAttempt && openAttempt.expiresAt ? new Date(openAttempt.expiresAt).getTime() : null;
  const leaseExpired = leaseUntil !== null && leaseUntil <= now;
  const waitExpired = expiresAt !== null && expiresAt <= now;
  let attemptAction = 'COLLECT';
  if (status === 'UNCERTAIN' || (status === 'SUBMITTING' && leaseExpired)) attemptAction = 'RESUME';
  else if (status === 'SUBMITTING') attemptAction = 'WAIT';
  else if (status === 'AWAITING_CONFIRMATION' && waitExpired) attemptAction = 'EXPIRE';
  else if (status === 'AWAITING_CONFIRMATION' && decision === 'AFFIRM') attemptAction = 'CLAIM';
  else if (status === 'AWAITING_CONFIRMATION' && decision === 'NEGATIVE') attemptAction = 'ABANDON';
  else if (status === 'AWAITING_CONFIRMATION' && decision === 'MODIFY') attemptAction = 'MODIFY';
  else if (status === 'AWAITING_CONFIRMATION' && decision === 'RESTART') attemptAction = 'RESTART';
  else if (status === 'AWAITING_CONFIRMATION') attemptAction = 'ASK';
  else if (decision === 'INSERT') attemptAction = 'INSERT';
  else if (
    !status &&
    (saved.conversationStep === 'AWAIT_CREATE_CONFIRMATION' ||
      collected.conversationStep === 'AWAIT_CREATE_CONFIRMATION')
  )
    attemptAction = 'RESET_STALE';
  else if (decision === 'RECALL' || (status === 'CONFIRMED' && decision === 'AFFIRM'))
    attemptAction = 'RECALL';
  else if (decision === 'RESUME') attemptAction = 'RESUME';
  else if (decision === 'EXPIRE') attemptAction = 'EXPIRE';
  return {
    sessionId: saved.sessionId || joined.sessionId || null,
    conversationStep: saved.conversationStep || collected.conversationStep || null,
    attemptAction,
    modifyField: collected.modifyField || null,
    openAttempt,
    reference: saved.reference || (openAttempt && openAttempt.reference) || null,
    ready: false,
    claimAcquired: false,
  };
}

const AIGUILLER_RULES = [
  'INSERT',
  'CLAIM',
  'RESUME',
  'ABANDON',
  'MODIFY',
  'RESTART',
  'ASK',
  'WAIT',
  'RECALL',
  'EXPIRE',
  'RESET_STALE',
];
function aiguillerTarget(attemptAction) {
  const idx = AIGUILLER_RULES.indexOf(attemptAction);
  if (idx < 0) return 'Valider paramètres création'; // fallback extra
  return [
    'Tirer aléa de tentative',
    'Préparer réclamation ou reprise',
    'Préparer reprise',
    'Préparer abandon ou modification',
    'Préparer abandon ou modification',
    'Préparer abandon ou modification',
    'Demander paramètres création',
    'Réponse attente de bail',
    'Réponse référence déjà connue',
    'Expirer tentatives en attente',
    'Effacer collecte orpheline',
  ][idx];
}

function canReachCreateAppointment(fromNode, connections, maxDepth = 20) {
  const q = [{ n: fromNode, d: 0 }];
  const seen = new Set();
  while (q.length) {
    const { n, d } = q.shift();
    if (seen.has(n) || d > maxDepth) continue;
    seen.add(n);
    if (n === 'Appeler CreateAppointment') return true;
    const outs = connections[n];
    if (!outs) continue;
    for (const groups of Object.values(outs)) {
      for (const group of groups || []) {
        for (const e of group || []) q.push({ n: e.node, d: d + 1 });
      }
    }
  }
  return false;
}

const collectedC4 = {
  intent: 'CREATE_APPOINTMENT',
  pendingAction: 'CREATE_APPOINTMENT',
  conversationStep: 'ASK_TELEPHONE',
  slotId: expectedSlotId,
  nom: 'Dupont',
  prenom: 'Camille',
  email: 'camille.essai@example.test',
  telephone: null,
  createDecision: null,
};
const routedThin = decideAction(
  { sessionId: 'rec008-8f2b4-slot-01', conversationStep: 'ASK_TELEPHONE', reference: null },
  collectedC4,
  { openAttempt: null, sessionId: 'rec008-8f2b4-slot-01' }
);

const tests = [];
function check(id, title, pass, detail) {
  tests.push({ id, title, pass: !!pass, detail: detail || null });
}

const beforeAnomaly = validateCreate(routedThin, collectedC4, 'before');
const afterFix = validateCreate(routedThin, collectedC4, 'fixed');

check('T15', 'Anomalie reproduite (code actuel)', 
  beforeAnomaly.validation.slotIdValide === false &&
  beforeAnomaly.missing.includes('le créneau choisi') &&
  beforeAnomaly.missing.includes('le nom') &&
  beforeAnomaly.conversationStep === 'ASK_TELEPHONE',
  beforeAnomaly);

check('T1', 'Slot valide correctement reconnu', afterFix.validation.slotIdValide === true, afterFix.validation);
check('T2', 'Nom correctement reconnu', !afterFix.missing.includes('le nom'), afterFix.missing);
check('T3', 'Prénom correctement reconnu', !afterFix.missing.includes('le prénom'), afterFix.missing);
check('T4', 'E-mail valide correctement reconnu', afterFix.validation.emailValide === true && !afterFix.missing.includes("l'adresse e-mail"), afterFix.validation);
check('T5', 'Téléphone manquant correctement signalé', afterFix.missing.includes('le numéro de téléphone') && afterFix.validation.telephoneValide === false, afterFix.missing);
check('T6', 'missing reflète les données collectées', 
  afterFix.missing.length === 1 && afterFix.missing[0] === 'le numéro de téléphone' && afterFix.conversationStep === 'ASK_TELEPHONE',
  afterFix.missing);
check('T16', 'Correction de l’anomalie (code proposé)',
  afterFix.validation.slotIdValide === true &&
  afterFix.validation.emailValide === true &&
  afterFix.missing.length === 1 &&
  afterFix.ready === false &&
  afterFix.claimAcquired !== true,
  { missing: afterFix.missing, validation: afterFix.validation, ready: afterFix.ready });

check('T7', 'COLLECT ne déclenche pas de POST',
  routedThin.attemptAction === 'COLLECT' &&
  aiguillerTarget('COLLECT') === 'Valider paramètres création' &&
  afterFix.ready === false,
  { attemptAction: routedThin.attemptAction, target: aiguillerTarget('COLLECT'), ready: afterFix.ready });

const insertRouted = decideAction(
  { sessionId: 's', conversationStep: 'AWAIT_CREATE_CONFIRMATION' },
  { ...collectedC4, telephone: '+33601020304', conversationStep: 'AWAIT_CREATE_CONFIRMATION', createDecision: 'INSERT' },
  { openAttempt: null }
);
check('T8', 'INSERT ne déclenche pas de POST',
  insertRouted.attemptAction === 'INSERT' &&
  aiguillerTarget('INSERT') === 'Tirer aléa de tentative' &&
  insertRouted.ready === false &&
  insertRouted.claimAcquired === false,
  insertRouted);

const claimNoLease = decideAction(
  { sessionId: 's', conversationStep: 'AWAIT_CREATE_CONFIRMATION' },
  { createDecision: 'AFFIRM', conversationStep: 'AWAIT_CREATE_CONFIRMATION' },
  {
    openAttempt: {
      status: 'AWAITING_CONFIRMATION',
      leaseUntil: new Date(Date.now() + 60000).toISOString(),
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      reference: 'REF-1',
    },
  }
);
check('T9', 'CLAIM sans lease acquis ne déclenche pas de POST',
  claimNoLease.attemptAction === 'CLAIM' &&
  claimNoLease.claimAcquired === false &&
  claimNoLease.ready === false &&
  aiguillerTarget('CLAIM') === 'Préparer réclamation ou reprise',
  claimNoLease);

const resumeNoLease = decideAction(
  { sessionId: 's', conversationStep: 'AWAIT_CREATE_CONFIRMATION' },
  { createDecision: null },
  {
    openAttempt: {
      status: 'UNCERTAIN',
      leaseUntil: new Date(Date.now() - 1000).toISOString(),
      expiresAt: new Date(Date.now() + 600000).toISOString(),
    },
  }
);
check('T10', 'RESUME sans lease acquis ne déclenche pas de POST',
  resumeNoLease.attemptAction === 'RESUME' &&
  resumeNoLease.claimAcquired === false &&
  resumeNoLease.ready === false,
  resumeNoLease);

const claimWithFlag = validateCreate(
  { ...claimNoLease, claimAcquired: true },
  { ...collectedC4, telephone: '+33601020304', intent: 'CREATE_APPOINTMENT', pendingAction: 'CREATE_APPOINTMENT', conversationStep: 'AWAIT_CREATE_CONFIRMATION', createDecision: 'AFFIRM' },
  'fixed'
);
check('T11', 'CLAIM avec lease acquis conserve ready=claimAcquired seulement',
  claimWithFlag.ready === true &&
  claimWithFlag.validation.slotIdValide === true &&
  claimWithFlag.validation.telephoneValide === true &&
  claimWithFlag.missing.length === 0,
  { ready: claimWithFlag.ready, missing: claimWithFlag.missing });

const uncertain = decideAction(
  { sessionId: 's', conversationStep: 'AWAIT_CREATE_CONFIRMATION' },
  { createDecision: 'AFFIRM' },
  {
    openAttempt: {
      status: 'UNCERTAIN',
      leaseUntil: new Date(Date.now() - 1000).toISOString(),
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      reference: 'REF-U',
    },
  }
);
check('T12', 'UNCERTAIN ne devient jamais automatiquement CONFIRMED',
  uncertain.attemptAction === 'RESUME' &&
  uncertain.claimAcquired === false &&
  uncertain.openAttempt.status === 'UNCERTAIN',
  uncertain);

const independent = validateCreate(
  decideAction({ sessionId: 'new', conversationStep: null }, { intent: 'CREATE_APPOINTMENT', pendingAction: 'CREATE_APPOINTMENT' }, {}),
  { intent: 'CREATE_APPOINTMENT', pendingAction: 'CREATE_APPOINTMENT', conversationStep: 'ASK_CREATE_SERVICE' },
  'fixed'
);
check('T13', 'Nouvelle demande indépendante ne réutilise pas les données précédentes',
  independent.missing.includes('le créneau choisi') &&
  independent.missing.includes('le nom') &&
  independent.validation.slotIdValide === false &&
  !independent.nom,
  independent.missing);

const abandoned = decideAction(
  { sessionId: 's', conversationStep: 'ASK_TELEPHONE' },
  { createDecision: null, conversationStep: 'ASK_TELEPHONE' },
  { openAttempt: { status: 'ABANDONED', reference: 'REF-OLD' } }
);
check('T14', 'Tentative ABANDONED non réutilisée (reste COLLECT)',
  abandoned.attemptAction === 'COLLECT' &&
  abandoned.claimAcquired === false &&
  abandoned.ready === false,
  abandoned);

// Build candidate workflow
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const candidate = JSON.parse(JSON.stringify(source));
const validerNode = candidate.nodes.find((n) => n.name === 'Valider paramètres création');
if (!validerNode) throw new Error('Valider node missing');
validerNode.parameters.jsCode = validerAfter;

const idemBefore = source.nodes.find((n) => n.name === 'Calculer empreinte du corps');
const idemAfter = candidate.nodes.find((n) => n.name === 'Calculer empreinte du corps');
const corpsBefore = source.nodes.find((n) => n.name === 'Préparer corps figé');
const corpsAfter = candidate.nodes.find((n) => n.name === 'Préparer corps figé');
const idemPayload = (n) => JSON.stringify(n && n.parameters ? n.parameters : null);
check('T17', 'Aucune modification de clé d’idempotence',
  !!idemBefore &&
  !!idemAfter &&
  !!corpsBefore &&
  !!corpsAfter &&
  idemPayload(idemBefore) === idemPayload(idemAfter) &&
  idemPayload(corpsBefore) === idemPayload(corpsAfter),
  {
    empreinte: idemBefore && idemBefore.name,
    empreinteSha: sha(idemPayload(idemBefore)),
    corpsSha: sha(idemPayload(corpsBefore)),
  });

const createReachCollect = canReachCreateAppointment('Valider paramètres création', candidate.connections);
const createReachInsert = canReachCreateAppointment('Tirer aléa de tentative', candidate.connections);
const createPred = [];
for (const [s, o] of Object.entries(candidate.connections)) {
  for (const groups of Object.values(o || {})) {
    for (const g of groups || []) {
      for (const e of g || []) {
        if (e.node === 'Appeler CreateAppointment') createPred.push(s);
      }
    }
  }
}
const createIncomingBefore = [];
for (const [s, o] of Object.entries(source.connections)) {
  for (const groups of Object.values(o || {})) {
    for (const g of groups || []) {
      for (const e of g || []) {
        if (e.node === 'Appeler CreateAppointment') createIncomingBefore.push(s);
      }
    }
  }
}
check('T18', 'Aucun nouveau chemin vers Appeler CreateAppointment',
  JSON.stringify(createPred) === JSON.stringify(createIncomingBefore) &&
  createPred.join() === 'Corps figé présent ?' &&
  createReachCollect === false &&
  edgesOf(candidate.connections) === edgesOf(source.connections) &&
  candidate.nodes.length === source.nodes.length,
  { createPred, createReachCollect, createReachInsert, nodes: candidate.nodes.length, edges: edgesOf(candidate.connections) });

// Extra: ready never true without claimAcquired
const readyGuard = validateCreate(
  { ...routedThin, claimAcquired: false },
  { ...collectedC4, telephone: '+33601020304', intent: 'CREATE_APPOINTMENT', pendingAction: 'CREATE_APPOINTMENT' },
  'fixed'
);
check('T19', 'ready reste false sans claimAcquired même si champs complets',
  readyGuard.ready === false && readyGuard.missing.length === 0 && readyGuard.validation.telephoneValide === true,
  { ready: readyGuard.ready, missing: readyGuard.missing });

check('T20', 'Décider inchangé (projection routing conservée)',
  fs.readFileSync(path.join(outDir, 'node-D_cider_action_tentative.js'), 'utf8').includes("attemptAction = 'COLLECT'") &&
  !fs.readFileSync(path.join(outDir, 'node-D_cider_action_tentative.js'), 'utf8').includes('slotId:'),
  'Décider does not pass slotId');

const urls = urlsOf(candidate.nodes);
const postgresIds = candidate.nodes
  .filter((n) => n.credentials && n.credentials.postgres)
  .map((n) => n.credentials.postgres.id);
const ollama = candidate.nodes.find((n) => n.name === 'Ollama Chat Model');
const chat = candidate.nodes.find((n) => n.name === "Lorsqu'un message de chat est reçu");
check('T21', 'Credentials/URL/webhook/settings conservés',
  urls.length === 10 &&
  urls.every((u) => u.startsWith('http://rec008-mock:8080/')) &&
  [...new Set(postgresIds)].join() === 'Fs0l0058q5CEadRw' &&
  ollama.credentials.ollamaApi.id === 'dxzHqBq8Q60R8BOz' &&
  chat.webhookId === 'a91c4e70-6b18-4f0d-9c55-2e7d8a14b603' &&
  JSON.stringify(candidate.settings || {}) === JSON.stringify(source.settings || {}) &&
  JSON.stringify(candidate.connections) === JSON.stringify(source.connections),
  { urls: urls.length, webhook: chat.webhookId });

const allPass = tests.every((t) => t.pass);

// Diff
const diff = {
  modifiedNodes: ['Valider paramètres création'],
  unchangedCritical: [
    'Décider action tentative',
    'Aiguiller tentative',
    'Création prête ?',
    'Appeler CreateAppointment',
    'Calculer empreinte du corps',
    'Fusionner état conversation',
    'Gérer collecte progressive',
  ],
  optionRetained: 'B',
  rationale:
    'Modifier uniquement Valider pour hydrater les champs informatifs depuis Gérer, sans élargir le payload de Décider (évite régression multi-branches et exposition PII). ready reste claimAcquired===true.',
  beforeSha: sha(validerBefore),
  afterSha: sha(validerAfter),
  beforeBytes: Buffer.byteLength(validerBefore),
  afterBytes: Buffer.byteLength(validerAfter),
};

const diffTxt = [
  'DIFF 8F-2B8 — Valider paramètres création uniquement',
  '',
  'Option retenue : B (validation informative séparée de l’autorisation POST).',
  'Option A rejetée : enrichir Décider toucherait INSERT/CLAIM/RESUME/… et exposerait le PII via ...x.',
  '',
  `SHA before: ${diff.beforeSha}`,
  `SHA after : ${diff.afterSha}`,
  '',
  'Ajouts :',
  '- Lecture $(' + "'Gérer collecte progressive'" + ') pour hydrater slotId/nom/prenom/email/telephone/intent/pendingAction',
  '- claimAcquired uniquement depuis le payload routé',
  '- return basé sur routed (sans réémettre le PII collecté)',
  '- commentaire : ready = autorisation claim, pas complétude des champs',
  '',
  'Inchangé :',
  '- formule ready = claimAcquired === true',
  '- règles missing / UUID / email / téléphone',
  '- graphe, credentials, URL mock, webhook, settings',
  '- Décider action tentative',
].join('\n');

fs.writeFileSync(path.join(outDir, 'DIFF_NODES.txt'), diffTxt);
fs.writeFileSync(path.join(outDir, 'DIFF_META.json'), JSON.stringify(diff, null, 2));

const proposedName = '10_AI_ConsularAssistant_VALIDATION_FIX_NON_PUBLIE.json';
const proposedPath = path.join(outDir, proposedName);
// Strip live metadata that shouldn't be "published"; keep nodes/connections/settings/credentials
const exportBody = {
  name: source.name,
  nodes: candidate.nodes,
  connections: candidate.connections,
  settings: candidate.settings,
  staticData: source.staticData ?? null,
  pinData: source.pinData || {},
  versionId: source.versionId,
  activeVersionId: null,
  versionCounter: source.versionCounter,
  meta: source.meta,
  tags: source.tags || [],
};
fs.writeFileSync(proposedPath, JSON.stringify(exportBody, null, 2));

const nePas = `Copie hors ligne 8F-2B8. Ne pas publier ni activer sans autorisation distincte.
Correction Option B : Valider paramètres création hydrate les champs informatifs depuis Gérer.
ready/claimAcquired inchangés. Aucun PUT autorisé dans cette phase.
`;
fs.writeFileSync(path.join(outDir, 'NE_PAS_PUBLIER.txt'), nePas);

const offline = {
  phase: '8F-2B8',
  option: 'B',
  allPass,
  tests,
  anomalyBefore: beforeAnomaly,
  fixedAfter: afterFix,
  pathAudit: {
    steps: [
      { node: 'Fusionner état conversation', has: ['slotId', 'nom', 'prenom', 'email', 'telephone', 'intent', 'pendingAction', 'conversationStep', 'availableSlots'] },
      { node: 'Gérer collecte progressive', has: ['slotId', 'nom', 'prenom', 'email', 'telephone', 'intent', 'pendingAction', 'conversationStep', 'createDecision'] },
      { node: 'Sauvegarder état conversation', has: ['persists PG fields'], note: 'slot_id/nom/prenom/email en base' },
      { node: 'Router intention', has: ['full saved json'] },
      { node: 'Décider action tentative', has: ['sessionId', 'conversationStep', 'attemptAction', 'ready:false', 'claimAcquired:false'], missing: ['slotId', 'nom', 'prenom', 'email', 'telephone', 'intent', 'pendingAction'], destructive: true },
      { node: 'Aiguiller tentative', note: 'COLLECT → fallback extra → Valider' },
      { node: 'Valider paramètres création', before: 'valide le payload réduit', after: 'hydrate depuis Gérer pour missing/validation' },
      { node: 'Création prête ?', note: 'ready === true seulement si claimAcquired' },
      { node: 'Demander paramètres création', note: 'utilise conversationStep' },
    ],
  },
};

fs.writeFileSync(path.join(outDir, 'OFFLINE_TESTS.json'), JSON.stringify(offline, null, 2));

const shaMap = {
  sourceInstalled: sha(fs.readFileSync(sourcePath)),
  proposed: sha(fs.readFileSync(proposedPath)),
  proposedBytes: fs.statSync(proposedPath).size,
  nodes: candidate.nodes.length,
  edges: edgesOf(candidate.connections),
  nePasPublier: sha(Buffer.from(nePas)),
  diffNodes: sha(Buffer.from(diffTxt)),
  offlineTests: sha(fs.readFileSync(path.join(outDir, 'OFFLINE_TESTS.json'))),
  validerBefore: sha(validerBefore),
  validerAfter: sha(validerAfter),
  decideUnchanged: sha(fs.readFileSync(path.join(outDir, 'node-D_cider_action_tentative.js'))),
};
fs.writeFileSync(path.join(outDir, 'SHA256.json'), JSON.stringify(shaMap, null, 2));

// Postflight read-only
const countsLine = docker([
  'exec', '-i', 'govsuite-rec008-test-rec008-postgres-1',
  'psql', '-U', 'postgres', '-d', 'govsuite_rec008_test', '-t', '-A', '-F', '|', '-c',
  `SELECT (SELECT count(*) FROM rendez_vous),(SELECT count(*) FROM ai_conversation_state),(SELECT count(*) FROM ai_appointment_attempt),(SELECT count(*) FROM notifications);`,
]).trim();
const gov = docker([
  'exec', '-i', 'govsuite-postgres',
  'psql', '-U', 'govsuite', '-d', 'govsuite', '-t', '-A', '-c',
  `SELECT (SELECT count(*) FROM rendez_vous) || '|' ||
(SELECT count(*) FROM notifications) || '|' ||
(SELECT count(*) FROM historique_rendez_vous) || '|' ||
(SELECT count(*) FROM ai_conversation_state) || '|' ||
(SELECT count(*) FROM ai_appointment_attempt) || '|' ||
(SELECT md5(string_agg(id::text || '|' || reference || '|' || statut || '|' || creneau_id::text || '|' || updated_at::text, ',' ORDER BY id)) FROM rendez_vous);`,
]).trim();
const mockProbe = `const http=require('http');http.get('http://rec008-mock:8080/_meta/calls',res=>{let b='';res.on('data',c=>b+=c);res.on('end',()=>console.log(b));});`;
const tmp = path.join(outDir, '_mock.js');
fs.writeFileSync(tmp, mockProbe);
docker(['cp', tmp, 'govsuite-rec008-test-rec008-n8n-1:/tmp/_mock.js']);
const mock = JSON.parse(docker(['exec', 'govsuite-rec008-test-rec008-n8n-1', 'node', '/tmp/_mock.js']).trim());
docker(['exec', '-u', 'root', 'govsuite-rec008-test-rec008-n8n-1', 'rm', '-f', '/tmp/_mock.js']);
try { fs.unlinkSync(tmp); } catch {}

const postflight = {
  pg: countsLine,
  gov,
  govOk: gov === expectedGov,
  mock,
  mockOk: mock.total === 6 && (mock.byPath['GET /appointments/availability 200'] || 0) === 6,
};
fs.writeFileSync(path.join(outDir, 'POSTFLIGHT.json'), JSON.stringify(postflight, null, 2));

console.log(JSON.stringify({ allPass, failed: tests.filter((t) => !t.pass).map((t) => t.id), shaMap, postflight, option: 'B' }, null, 2));
process.exit(allPass ? 0 : 4);
