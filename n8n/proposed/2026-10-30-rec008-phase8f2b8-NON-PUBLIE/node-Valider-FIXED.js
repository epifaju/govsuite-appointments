const routed = $json;
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
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(x.email).trim()
  );

// ------------------------------------------------------
// Validation téléphone
// ------------------------------------------------------

const telephoneNormalise =
  x.telephone
    ? String(x.telephone)
        .replace(/[^\d+]/g, '')
        .trim()
    : '';

const telephoneValide =
  telephoneNormalise.replace(/\D/g, '').length >= 8;

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
