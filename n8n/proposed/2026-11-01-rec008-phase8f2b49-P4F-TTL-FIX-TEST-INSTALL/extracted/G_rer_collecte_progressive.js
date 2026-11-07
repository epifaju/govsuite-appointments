const x = { ...$json };

// ======================================================
// 1. ETAT PRECEDENT
// ======================================================
//
// IMPORTANT :
// previous sert principalement à connaître l'étape
// précédente de la machine à états.
//
// Les données métier (service, site, dates, token...)
// viennent en priorité de x, c'est-à-dire de
// "Fusionner état conversation".
//
// ======================================================

let previous = {};

try {
  previous =
    $('Joindre tentative de session').item.json ?? {};
} catch (e) {
  try {
    previous =
      $('Charger état conversation').item.json ?? {};
  } catch (e2) {
    previous = {};
  }
}

// ======================================================
// 2. PARSER DU MESSAGE COURANT
// ======================================================

let parserCurrent = {};
let createDecision = null;
let modifyField = null;
let skipCreateProgression = false;

try {
  parserCurrent =
    $('Parser intention').item.json ?? {};
} catch (e) {
  parserCurrent = {};
}

createDecision = parserCurrent.createDecision || null;
modifyField = parserCurrent.modifyField || null;
if (createDecision && createDecision !== 'INSERT') {
  skipCreateProgression = true;
}

// ======================================================
// 3. UTILITAIRES
// ======================================================

function hasValue(value) {
  return (
    value !== null &&
    value !== undefined &&
    value !== '' &&
    value !== 'null' &&
    value !== 'undefined'
  );
}

function isValidUUID(value) {
  if (!value) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(String(value).trim());
}

function isValidEmail(value) {
  if (!value) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(String(value).trim());
}

function normalizePhone(value) {
  if (!value) {
    return null;
  }

  return String(value)
    .replace(/[^\d+]/g, '')
    .trim();
}

function isValidPhone(value) {
  const normalized =
    normalizePhone(value);

  if (!normalized) {
    return false;
  }

  return normalized
    .replace(/\D/g, '')
    .length >= 8;
}

function extractUUIDFromMessage(value) {
  if (!value) {
    return null;
  }

  const match =
    String(value).match(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i
    );

  return match?.[0] ?? null;
}

function isQuestion(value) {
  if (!value) {
    return false;
  }

  return (
    value.includes('?') ||
    /^(quoi|comment|quelles?|quels?|pourquoi|où|ou|combien|de quelles?|de quels?)/i
      .test(value.trim())
  );
}

function normalizeSlots(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed =
        JSON.parse(value);

      return Array.isArray(parsed)
        ? parsed
        : [];
    } catch (e) {
      return [];
    }
  }

  return [];
}

// ======================================================
// 4. MESSAGE COURANT
// ======================================================

const message =
  String(
    x.originalMessage ??
    parserCurrent.originalMessage ??
    ''
  ).trim();

const messageLower =
  message.toLowerCase();

// ======================================================
// 5. INTENTION COURANTE
// ======================================================

const businessIntents = [
  'CREATE_APPOINTMENT',
  'GET_APPOINTMENT',
  'CANCEL_APPOINTMENT',
  'RESCHEDULE_APPOINTMENT'
];

const parserIntent =
  parserCurrent.intent ??
  x.llmIntent ??
  x.intent ??
  null;

const currentIntent =
  x.intent ??
  parserIntent ??
  'GENERAL';

const previousPendingAction =
  previous.pending_action ??
  null;

const previousConversationStep =
  previous.conversation_step ??
  null;

const hasExplicitBusinessIntent =
  businessIntents.includes(parserIntent);

// --- P4E/P4F START GERER ---
const sessionExpiredFlag = previous.sessionExpired === true || previous.session_expired === true;
const openAttemptStatus = previous.openAttempt && previous.openAttempt.status;
const resumeFolded = String(message || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[.!?;:,]+$/g, '')
  .replace(/\s+/g, ' ')
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
// ======================================================
//
// "Fusionner état conversation" sait maintenant détecter
// les redémarrages explicites.
//
// On récupère donc son diagnostic au lieu de refaire
// une deuxième fusion contradictoire.
//
// ======================================================

const fusionDebug =
  x.memoryDebug ?? {};

const fusionActionChanged =
  fusionDebug.actionChanged === true;

const fusionExplicitRestart =
  fusionDebug.explicitRestart === true;

const fusionStartingNewAction =
  fusionDebug.startingNewAction === true;

const newBusinessAction =
  fusionActionChanged ||
  fusionExplicitRestart ||
  fusionStartingNewAction;

// ======================================================
// 7. DONNEES METIER
// ======================================================
//
// REGLE FONDAMENTALE :
//
// x est la source de vérité.
//
// PAS :
//
// x.site ?? previous.site
//
// car cela réinjecterait les anciennes données que
// "Fusionner état conversation" vient volontairement
// d'effacer.
//
// ======================================================

let intent =
  currentIntent;

let pendingAction =
  x.pendingAction ??
  null;

let conversationStep =
  x.conversationStep ??
  null;

// ------------------------------------------------------
// Identifiants
// ------------------------------------------------------

let token =
  x.token ?? null;

let slotId =
  x.slotId ?? null;

let newSlotId =
  x.newSlotId ?? null;

// ------------------------------------------------------
// Critères
// ------------------------------------------------------

let service =
  x.service ?? null;

let site =
  x.site ?? null;

let dateDebut =
  x.dateDebut ?? null;

let dateFin =
  x.dateFin ?? null;

// ------------------------------------------------------
// Informations personnelles
// ------------------------------------------------------

let nom =
  x.nom ?? null;

let prenom =
  x.prenom ?? null;

let email =
  x.email ?? null;

let telephone =
  x.telephone ?? null;

// ------------------------------------------------------
// Créneaux
// ------------------------------------------------------

let selectedSlotIndex =
  x.selectedSlotIndex ??
  parserCurrent.selectedSlotIndex ??
  null;

let availableSlots =
  normalizeSlots(
    x.availableSlots ??
    x.available_slots ??
    []
  );

let selectedSlot =
  x.selectedSlot ?? null;

// ======================================================
// 8. DETERMINER L'ACTION ACTIVE
// ======================================================
//
// Si Fusionner état conversation indique une nouvelle
// action, on démarre avec l'intention actuelle.
//
// Sinon, une action précédente peut continuer.
//
// ======================================================

if (newBusinessAction) {

  pendingAction =
    businessIntents.includes(currentIntent)
      ? currentIntent
      : null;

  conversationStep =
    null;
}

else if (
  previousPendingAction &&
  businessIntents.includes(previousPendingAction)
) {

  pendingAction =
    previousPendingAction;

  // On conserve uniquement l'étape de conversation.
  // PAS les anciennes données métier.

  conversationStep =
    previousConversationStep ??
    conversationStep ??
    null;
}

else if (
  businessIntents.includes(currentIntent)
) {

  pendingAction =
    currentIntent;
}

// ======================================================
// 9. GET_APPOINTMENT
// ======================================================

if (
  pendingAction === 'GET_APPOINTMENT'
) {

  intent =
    'GET_APPOINTMENT';

  // ----------------------------------------------------
  // Si nous attendons le token, regarder le message
  // courant.
  // ----------------------------------------------------

  if (
    conversationStep === 'ASK_TOKEN' ||
    !conversationStep
  ) {

    const candidate =
      parserCurrent.token ??
      extractUUIDFromMessage(message) ??
      token;

    if (
      candidate &&
      isValidUUID(candidate)
    ) {

      token =
        String(candidate).trim();

      slotId =
        null;

      newSlotId =
        null;

      conversationStep =
        'READY_GET_APPOINTMENT';

    } else {

      token =
        null;

      conversationStep =
        'ASK_TOKEN';
    }
  }

  else if (
    token &&
    isValidUUID(token)
  ) {

    conversationStep =
      'READY_GET_APPOINTMENT';
  }

  else {

    conversationStep =
      'ASK_TOKEN';
  }
}

// ======================================================
// 10. CANCEL_APPOINTMENT
// ======================================================

else if (
  pendingAction === 'CANCEL_APPOINTMENT'
) {

  intent =
    'CANCEL_APPOINTMENT';

  slotId =
    null;

  newSlotId =
    null;

  // ----------------------------------------------------
  // Confirmation déjà demandée
  // ----------------------------------------------------

  if (
    conversationStep ===
      'ASK_CANCEL_CONFIRMATION'
  ) {

    conversationStep =
      'ASK_CANCEL_CONFIRMATION';
  }

  // ----------------------------------------------------
  // Sinon obtenir le token
  // ----------------------------------------------------

  else {

    const candidate =
      parserCurrent.token ??
      extractUUIDFromMessage(message) ??
      token;

    if (
      candidate &&
      isValidUUID(candidate)
    ) {

      token =
        String(candidate).trim();

      conversationStep =
        'READY_CANCEL_LOOKUP';

    } else {

      token =
        null;

      conversationStep =
        'ASK_TOKEN';
    }
  }
}

// ======================================================
// 11. RESCHEDULE_APPOINTMENT
// ======================================================

else if (
  pendingAction === 'RESCHEDULE_APPOINTMENT'
) {

  intent =
    'RESCHEDULE_APPOINTMENT';

  // RESCHEDULE n'utilise jamais slotId.

  slotId =
    null;

  // ----------------------------------------------------
  // 11.1 Nouvelle replanification
  // ----------------------------------------------------

  if (!conversationStep) {

    if (
      token &&
      isValidUUID(token)
    ) {

      conversationStep =
        'READY_RESCHEDULE_TOKEN';

    } else {

      const candidate =
        parserCurrent.token ??
        extractUUIDFromMessage(message);

      if (
        candidate &&
        isValidUUID(candidate)
      ) {

        token =
          String(candidate).trim();

        conversationStep =
          'READY_RESCHEDULE_TOKEN';

      } else {

        token =
          null;

        conversationStep =
          'ASK_RESCHEDULE_TOKEN';
      }
    }
  }

  // ----------------------------------------------------
  // 11.2 Token attendu
  // ----------------------------------------------------

  else if (
    conversationStep === 'ASK_TOKEN' ||
    conversationStep === 'ASK_RESCHEDULE_TOKEN'
  ) {

    const candidate =
      parserCurrent.token ??
      extractUUIDFromMessage(message) ??
      token;

    if (
      candidate &&
      isValidUUID(candidate)
    ) {

      token =
        String(candidate).trim();

      newSlotId =
        null;

      conversationStep =
        'READY_RESCHEDULE_TOKEN';

    } else {

      conversationStep =
        'ASK_RESCHEDULE_TOKEN';
    }
  }

  // ----------------------------------------------------
  // 11.3 Token prêt
  // ----------------------------------------------------

  else if (
    conversationStep === 'READY_RESCHEDULE_TOKEN'
  ) {

    if (
      !token ||
      !isValidUUID(token)
    ) {

      conversationStep =
        'ASK_RESCHEDULE_TOKEN';
    }
  }

  // ----------------------------------------------------
  // 11.4 Nouvelle période attendue
  // ----------------------------------------------------

  else if (
    conversationStep ===
      'ASK_RESCHEDULE_DATE_RANGE'
  ) {

    const newDateDebut =
      parserCurrent.dateDebut ??
      dateDebut ??
      null;

    const newDateFin =
      parserCurrent.dateFin ??
      dateFin ??
      null;

    if (
      newDateDebut &&
      newDateFin
    ) {

      dateDebut =
        newDateDebut;

      dateFin =
        newDateFin;

      conversationStep =
        'READY_RESCHEDULE_SEARCH';

    } else {

      conversationStep =
        'ASK_RESCHEDULE_DATE_RANGE';
    }
  }

  // ----------------------------------------------------
  // 11.5 Recherche prête
  // ----------------------------------------------------

  else if (
    conversationStep ===
      'READY_RESCHEDULE_SEARCH'
  ) {

    if (
      !dateDebut ||
      !dateFin
    ) {

      conversationStep =
        'ASK_RESCHEDULE_DATE_RANGE';
    }
  }

  // ----------------------------------------------------
  // 11.6 Choix d'un nouveau créneau
  // ----------------------------------------------------

  else if (
    conversationStep ===
      'ASK_RESCHEDULE_SLOT'
  ) {

    let choice =
      parserCurrent.selectedSlotIndex ??
      selectedSlotIndex ??
      null;

    if (
      choice === null ||
      choice === undefined
    ) {

      const match =
        message.match(/\b(\d{1,2})\b/);

      if (match) {
        choice =
          Number(match[1]);
      }
    }

    if (
      choice !== null &&
      choice !== undefined
    ) {

      selectedSlotIndex =
        Number(choice);
    }

    if (
      !selectedSlot &&
      Number.isInteger(selectedSlotIndex) &&
      selectedSlotIndex >= 1 &&
      selectedSlotIndex <= availableSlots.length
    ) {

      selectedSlot =
        availableSlots[selectedSlotIndex - 1];
    }

    const candidateNewSlotId =
      selectedSlot?.id ??
      selectedSlot?.slotId ??
      parserCurrent.newSlotId ??
      newSlotId ??
      null;

    if (
      candidateNewSlotId &&
      isValidUUID(candidateNewSlotId)
    ) {

      newSlotId =
        String(candidateNewSlotId).trim();

      conversationStep =
        'ASK_RESCHEDULE_CONFIRMATION';

    } else {

      newSlotId =
        null;

      conversationStep =
        'ASK_RESCHEDULE_SLOT';
    }
  }

  // ----------------------------------------------------
  // 11.7 Confirmation attendue
  // ----------------------------------------------------

  else if (
    conversationStep ===
      'ASK_RESCHEDULE_CONFIRMATION'
  ) {

    conversationStep =
      'ASK_RESCHEDULE_CONFIRMATION';
  }
}

// ======================================================
// 12. CREATE_APPOINTMENT
// ======================================================

else if (
  pendingAction === 'CREATE_APPOINTMENT'
) {

  intent =
    'CREATE_APPOINTMENT';

  // CREATE n'utilise jamais le token de gestion
  // d'un rendez-vous existant.

  token =
    null;

  newSlotId =
    null;

  // ----------------------------------------------------
  // 12.1 Résoudre un slot UUID explicitement fourni
  // ----------------------------------------------------

  if (!slotId) {

    const candidateSlot =
      parserCurrent.slotId ??
      null;

    if (
      candidateSlot &&
      isValidUUID(candidateSlot)
    ) {

      slotId =
        String(candidateSlot).trim();
    }
  }

  // ----------------------------------------------------
  // 12.2 "Je prends le 2"
  // ----------------------------------------------------

  if (
    !slotId &&
    selectedSlotIndex !== null &&
    selectedSlotIndex !== undefined &&
    availableSlots.length > 0
  ) {

    const index =
      Number(selectedSlotIndex) - 1;

    if (
      Number.isInteger(index) &&
      index >= 0 &&
      index < availableSlots.length
    ) {

      selectedSlot =
        availableSlots[index];

      const candidate =
        selectedSlot?.id ??
        selectedSlot?.slotId ??
        null;

      if (
        candidate &&
        isValidUUID(candidate)
      ) {

        slotId =
          String(candidate).trim();
      }
    }
  }

  // ----------------------------------------------------
  // 12.3 Coordonnées personnelles
  // ----------------------------------------------------

  if (slotId) {

    // NOM

    if (
      conversationStep === 'ASK_NOM' &&
      message &&
      !nom &&
      !isQuestion(message)
    ) {

      const candidate =
        parserCurrent.nom ??
        message;

      if (
        candidate &&
        String(candidate).trim().length >= 2
      ) {

        nom =
          String(candidate).trim();
      }
    }

    // PRENOM

    else if (
      conversationStep === 'ASK_PRENOM' &&
      message &&
      !prenom &&
      !isQuestion(message)
    ) {

      const candidate =
        parserCurrent.prenom ??
        message;

      if (
        candidate &&
        String(candidate).trim().length >= 2
      ) {

        prenom =
          String(candidate).trim();
      }
    }

    // EMAIL

    else if (
      conversationStep === 'ASK_EMAIL' &&
      message &&
      !isValidEmail(email)
    ) {

      const candidate =
        parserCurrent.email ??
        message.match(
          /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
        )?.[0] ??
        null;

      if (
        candidate &&
        isValidEmail(candidate)
      ) {

        email =
          String(candidate).trim();
      }
    }

    // TELEPHONE

    else if (
      conversationStep === 'ASK_TELEPHONE' &&
      message &&
      !isValidPhone(telephone)
    ) {

      const candidate =
        parserCurrent.telephone ??
        message.match(
          /(?:\+\d{7,15}|\b\d{8,15}\b)/
        )?.[0] ??
        null;

      if (
        candidate &&
        isValidPhone(candidate)
      ) {

        telephone =
          normalizePhone(candidate);
      }
    }
  }

  // ====================================================
  // 12.4 CALCUL DE L'ETAPE CREATE
  // ====================================================

  if (skipCreateProgression) {
    intent = 'CREATE_APPOINTMENT';
    if (createDecision === 'RECALL') conversationStep = 'CREATE_RECALL';
    else if (createDecision === 'RESUME') conversationStep = 'CREATE_UNCERTAIN';
    else conversationStep = 'AWAIT_CREATE_CONFIRMATION';
  }

  else if (slotId) {

    if (!nom) {

      conversationStep =
        'ASK_NOM';

    } else if (!prenom) {

      conversationStep =
        'ASK_PRENOM';

    } else if (!isValidEmail(email)) {

      conversationStep =
        'ASK_EMAIL';

    } else if (!isValidPhone(telephone)) {

      conversationStep =
        'ASK_TELEPHONE';

    } else {

      conversationStep =
        'AWAIT_CREATE_CONFIRMATION';
      if (previous.conversation_step !== 'AWAIT_CREATE_CONFIRMATION') {
        createDecision = 'INSERT';
      }
    }
  }

  // ----------------------------------------------------
  // Pas encore de créneau
  // ----------------------------------------------------

  else {

    if (!service) {

      conversationStep =
        'ASK_CREATE_SERVICE';

      intent =
        'CREATE_APPOINTMENT';
    }

    else if (!site) {

      conversationStep =
        'ASK_CREATE_SITE';

      intent =
        'CREATE_APPOINTMENT';
    }

    else if (
      !dateDebut ||
      !dateFin
    ) {

      conversationStep =
        'ASK_CREATE_DATE_RANGE';

      intent =
        'CREATE_APPOINTMENT';
    }

    else {

      conversationStep =
        'READY_CREATE_SEARCH';

      intent =
        'GET_AVAILABILITY';
    }
  }
}

// ======================================================
// 13. GET_AVAILABILITY SANS ACTION CREATE
// ======================================================

else if (
  currentIntent === 'GET_AVAILABILITY'
) {

  intent =
    'GET_AVAILABILITY';

  pendingAction =
    'GET_AVAILABILITY';

  conversationStep =
    null;
}

// ======================================================
// 14. GENERAL
// ======================================================

else {

  intent =
    currentIntent ??
    'GENERAL';

  pendingAction =
    null;

  conversationStep =
    null;
}

// ======================================================
// 15. NORMALISATION TELEPHONE
// ======================================================

if (
  telephone &&
  isValidPhone(telephone)
) {

  telephone =
    normalizePhone(telephone);
}

// ======================================================
// 16. FORÇAGE FINAL DES INTENTIONS
// ======================================================

if (
  pendingAction === 'RESCHEDULE_APPOINTMENT'
) {

  intent =
    'RESCHEDULE_APPOINTMENT';

  slotId =
    null;
}

else if (
  pendingAction === 'CANCEL_APPOINTMENT'
) {

  intent =
    'CANCEL_APPOINTMENT';
}

else if (
  pendingAction === 'GET_APPOINTMENT'
) {

  intent =
    'GET_APPOINTMENT';
}

else if (
  pendingAction === 'CREATE_APPOINTMENT'
) {

  if (
    conversationStep === 'READY_CREATE_SEARCH' &&
    !slotId &&
    service &&
    site &&
    dateDebut &&
    dateFin
  ) {

    intent =
      'GET_AVAILABILITY';

  } else {

    intent =
      'CREATE_APPOINTMENT';
  }
}

// ======================================================
// 17. ETATS READY
// ======================================================

const creationServicePending =
  pendingAction === 'CREATE_APPOINTMENT' &&
  conversationStep === 'ASK_CREATE_SERVICE';

const creationSitePending =
  pendingAction === 'CREATE_APPOINTMENT' &&
  conversationStep === 'ASK_CREATE_SITE';

const creationDateRangePending =
  pendingAction === 'CREATE_APPOINTMENT' &&
  conversationStep === 'ASK_CREATE_DATE_RANGE';

const creationSlotPending =
  pendingAction === 'CREATE_APPOINTMENT' &&
  conversationStep === 'ASK_CREATE_SLOT' &&
  !slotId;

const creationSearchReady =
  pendingAction === 'CREATE_APPOINTMENT' &&
  conversationStep === 'READY_CREATE_SEARCH' &&
  !slotId &&
  !!service &&
  !!site &&
  !!dateDebut &&
  !!dateFin;

const creationComplete =
  pendingAction === 'CREATE_APPOINTMENT' &&
  conversationStep === 'READY_CREATE' &&
  !!slotId &&
  !!nom &&
  !!prenom &&
  isValidEmail(email) &&
  isValidPhone(telephone);

const getAppointmentReady =
  pendingAction === 'GET_APPOINTMENT' &&
  conversationStep === 'READY_GET_APPOINTMENT' &&
  isValidUUID(token);

const cancelLookupReady =
  pendingAction === 'CANCEL_APPOINTMENT' &&
  conversationStep === 'READY_CANCEL_LOOKUP' &&
  isValidUUID(token);

const cancelConfirmationPending =
  pendingAction === 'CANCEL_APPOINTMENT' &&
  conversationStep === 'ASK_CANCEL_CONFIRMATION';

const rescheduleTokenReady =
  pendingAction === 'RESCHEDULE_APPOINTMENT' &&
  conversationStep === 'READY_RESCHEDULE_TOKEN' &&
  isValidUUID(token);

const rescheduleDateRangePending =
  pendingAction === 'RESCHEDULE_APPOINTMENT' &&
  conversationStep === 'ASK_RESCHEDULE_DATE_RANGE';

const rescheduleSearchReady =
  pendingAction === 'RESCHEDULE_APPOINTMENT' &&
  conversationStep === 'READY_RESCHEDULE_SEARCH' &&
  isValidUUID(token) &&
  !!service &&
  !!site &&
  !!dateDebut &&
  !!dateFin;

const rescheduleSlotPending =
  pendingAction === 'RESCHEDULE_APPOINTMENT' &&
  conversationStep === 'ASK_RESCHEDULE_SLOT';

const rescheduleConfirmationPending =
  pendingAction === 'RESCHEDULE_APPOINTMENT' &&
  conversationStep === 'ASK_RESCHEDULE_CONFIRMATION';

// ======================================================
// 18. RESULTAT
// ======================================================

return [{
  json: {

    ...x,

    // --------------------------------------------------
    // Etat métier
    // --------------------------------------------------

    intent,

    service,
    site,

    dateDebut,
    dateFin,

    token,
    slotId,
    newSlotId,

    selectedSlotIndex,
    selectedSlot,

    nom,
    prenom,
    email,
    telephone,

    availableSlots,

    pendingAction,
    conversationStep,
    createDecision,
    modifyField,

    // --------------------------------------------------
    // Etats calculés
    // --------------------------------------------------

    stateReady: {

      createServicePending:
        creationServicePending,

      createSitePending:
        creationSitePending,

      createDateRangePending:
        creationDateRangePending,

      createSlotPending:
        creationSlotPending,

      createSearch:
        creationSearchReady,

      createAppointment:
        creationComplete,

      getAppointment:
        getAppointmentReady,

      cancelLookup:
        cancelLookupReady,

      cancelConfirmationPending:
        cancelConfirmationPending,

      rescheduleToken:
        rescheduleTokenReady,

      rescheduleDateRangePending:
        rescheduleDateRangePending,

      rescheduleSearch:
        rescheduleSearchReady,

      rescheduleSlotPending:
        rescheduleSlotPending,

      rescheduleConfirmationPending:
        rescheduleConfirmationPending
    },

    // ==================================================
    // DEBUG TEMPORAIRE
    // ==================================================

    collectionDebug: {

      rawXIntent:
        x.intent ?? null,

      rawLlmIntent:
        x.llmIntent ?? null,

      parserIntent:
        parserCurrent.intent ?? null,

      currentIntent,

      previousIntent:
        previous.intent ?? null,

      previousPendingAction:
        previousPendingAction,

      previousConversationStep:
        previousConversationStep,

      // ----------------------------------------------
      // Diagnostic venant de Fusionner état
      // ----------------------------------------------

      fusionActionChanged,

      fusionExplicitRestart,

      fusionStartingNewAction,

      newBusinessAction,

      // ----------------------------------------------
      // Etat final
      // ----------------------------------------------

      finalIntent:
        intent,

      finalPendingAction:
        pendingAction,

      finalConversationStep:
        conversationStep,

      resolvedService:
        service ?? null,

      resolvedSite:
        site ?? null,

      resolvedDateDebut:
        dateDebut ?? null,

      resolvedDateFin:
        dateFin ?? null,

      resolvedToken:
        token ?? null,

      resolvedSlotId:
        slotId ?? null,

      resolvedNewSlotId:
        newSlotId ?? null,

      selectedSlotIndex:
        selectedSlotIndex ?? null,

      availableSlotsCount:
        availableSlots.length,

      // ----------------------------------------------
      // Etats
      // ----------------------------------------------

      creationServicePending,
      creationSitePending,
      creationDateRangePending,
      creationSlotPending,
      creationSearchReady,
      creationComplete,

      getAppointmentReady,

      cancelLookupReady,
      cancelConfirmationPending,

      rescheduleTokenReady,
      rescheduleDateRangePending,
      rescheduleSearchReady,
      rescheduleSlotPending,
      rescheduleConfirmationPending
    }
  }
}];