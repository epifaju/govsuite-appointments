const current = { ...$json };

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
// 1. UTILITAIRES
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

function pick(newValue, oldValue) {

  if (hasValue(newValue)) {
    return newValue;
  }

  if (hasValue(oldValue)) {
    return oldValue;
  }

  return null;
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
      const parsed = JSON.parse(value);

      return Array.isArray(parsed)
        ? parsed
        : [];

    } catch (e) {
      return [];
    }
  }

  return [];
}

function isValidUUID(value) {

  if (!value) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(String(value).trim());
}

// ======================================================
// 2. MESSAGE COURANT
// ======================================================

const originalMessage =
  current.originalMessage ?? '';

const message =
  String(originalMessage)
    .trim()
    .toLowerCase();

// ======================================================
// 3. ETAT PRECEDENT
// ======================================================

const previousPendingAction =
  previous.pending_action ??
  null;

const previousConversationStep =
  previous.conversation_step ??
  null;

// ======================================================
// 4. INTENTION DU MESSAGE COURANT
// ======================================================
//
// current.intent vient normalement de "Parser intention".
// On considère donc cette valeur comme l'intention détectée
// sur le message ACTUEL.
//
// ======================================================

let currentIntent =
  current.intent ??
  current.llmIntent ??
  'GENERAL';

// ------------------------------------------------------
// Sécurisation avec quelques règles textuelles explicites
// ------------------------------------------------------

// ANNULATION

if (
  /\bannul(er|ation|e|ez)?\b/i.test(message)
) {

  currentIntent =
    'CANCEL_APPOINTMENT';
}

// REPLANIFICATION

else if (
  /\b(replanif|replanifier|replanification|déplacer|deplacer)\b/i
    .test(message) ||
  /\bchanger\b.*\b(rendez-vous|rdv)\b/i
    .test(message)
) {

  currentIntent =
    'RESCHEDULE_APPOINTMENT';
}

// CONSULTATION

else if (
  /\b(consulter|voir|retrouver)\b.*\b(rendez-vous|rdv)\b/i
    .test(message)
) {

  currentIntent =
    'GET_APPOINTMENT';
}

// CREATION

else if (
  /\b(prendre|réserver|reserver|créer|creer)\b.*\b(rendez-vous|rdv|créneau|creneau)\b/i
    .test(message)
) {

  currentIntent =
    'CREATE_APPOINTMENT';
}

// ======================================================
// 5. INTENTIONS METIER
// ======================================================

const businessIntents = [
  'CREATE_APPOINTMENT',
  'GET_APPOINTMENT',
  'CANCEL_APPOINTMENT',
  'RESCHEDULE_APPOINTMENT'
];

const hasExplicitBusinessIntent =
  businessIntents.includes(currentIntent);

// ======================================================
// 6. DETECTION D'UN REDEMARRAGE EXPLICITE
// ======================================================
//
// Problème traité :
//
// mémoire :
// CREATE_APPOINTMENT / READY_CREATE_SEARCH
//
// utilisateur :
// "Je souhaite prendre rendez-vous pour renouveler
// mon passeport"
//
// CREATE == CREATE ne suffit pas pour conclure qu'il
// continue l'ancienne création.
//
// Ici nous reconnaissons une NOUVELLE demande explicite.
//
// ======================================================

// ------------------------------------------------------
// Nouvelle création explicite
// ------------------------------------------------------

const explicitCreateRestart =
  currentIntent === 'CREATE_APPOINTMENT' &&
  (
    /\b(?:je\s+)?(?:souhaite|veux|voudrais|aimerais)\b.*\b(?:prendre|réserver|reserver|créer|creer)\b.*\b(?:rendez-vous|rdv)\b/i
      .test(message)
    ||
    /\b(?:prendre|réserver|reserver|créer|creer)\b.*\b(?:un\s+)?(?:rendez-vous|rdv)\b/i
      .test(message)
  );

// ------------------------------------------------------
// Nouvelle replanification explicite
// ------------------------------------------------------

const explicitRescheduleRestart =
  currentIntent === 'RESCHEDULE_APPOINTMENT' &&
  (
    /\b(?:je\s+)?(?:souhaite|veux|voudrais|aimerais)\b.*\b(?:replanifier|déplacer|deplacer)\b.*\b(?:rendez-vous|rdv)\b/i
      .test(message)
    ||
    /\b(?:replanifier|déplacer|deplacer)\b.*\b(?:mon\s+)?(?:rendez-vous|rdv)\b/i
      .test(message)
  );

// ------------------------------------------------------
// Nouvelle annulation explicite
// ------------------------------------------------------

const explicitCancelRestart =
  currentIntent === 'CANCEL_APPOINTMENT' &&
  (
    /\b(?:je\s+)?(?:souhaite|veux|voudrais|aimerais)\b.*\bannuler\b.*\b(?:rendez-vous|rdv)\b/i
      .test(message)
    ||
    /\bannuler\b.*\b(?:mon\s+)?(?:rendez-vous|rdv)\b/i
      .test(message)
  );

// ------------------------------------------------------
// Nouvelle consultation explicite
// ------------------------------------------------------

const explicitGetRestart =
  currentIntent === 'GET_APPOINTMENT' &&
  (
    /\b(?:je\s+)?(?:souhaite|veux|voudrais|aimerais)\b.*\b(?:consulter|voir|retrouver)\b.*\b(?:rendez-vous|rdv)\b/i
      .test(message)
    ||
    /\b(?:consulter|retrouver)\b.*\b(?:mon\s+)?(?:rendez-vous|rdv)\b/i
      .test(message)
  );

const createFlowLocked =
  ['AWAIT_CREATE_CONFIRMATION', 'CREATE_UNCERTAIN', 'CREATE_IN_PROGRESS'].includes(previous.conversation_step)
  || (
    previous.openAttempt
    && ['AWAITING_CONFIRMATION', 'SUBMITTING', 'UNCERTAIN'].includes(previous.openAttempt.status)
  );

const explicitRestart =
  !createFlowLocked &&
  (
    explicitCreateRestart ||
    explicitRescheduleRestart ||
    explicitCancelRestart ||
    explicitGetRestart
  );

// ======================================================
// 7. CHANGEMENT D'ACTION
// ======================================================
//
// CAS 1 :
// previous = RESCHEDULE
// current  = CREATE
// => changement
//
// CAS 2 :
// previous = CREATE
// current  = CREATE
// message = "Je souhaite prendre un rendez-vous"
// => redémarrage explicite
//
// CAS 3 :
// previous = RESCHEDULE
// current = GENERAL
// message = "Oui"
// => continuation
//
// ======================================================

const actionChanged =
  !createFlowLocked &&
  hasExplicitBusinessIntent &&
  hasValue(previousPendingAction) &&
  (
    currentIntent !== previousPendingAction ||
    explicitRestart
  );

// ======================================================
// 8. DEMARRAGE D'UNE PREMIERE ACTION
// ======================================================

const startingNewAction =
  !createFlowLocked &&
  hasExplicitBusinessIntent &&
  !hasValue(previousPendingAction);

// ======================================================
// 9. CONTINUATION DE L'ACTION PRECEDENTE
// ======================================================

const continuingPreviousAction =
  hasValue(previousPendingAction) &&
  !actionChanged &&
  !explicitRestart;

// ======================================================
// 10. CRENEAUX MEMORISES
// ======================================================

const previousAvailableSlots =
  normalizeSlots(
    previous.available_slots
  );

// ======================================================
// 11. VARIABLES DE SORTIE
// ======================================================

let intent =
  currentIntent;

let service =
  null;

let site =
  null;

let dateDebut =
  null;

let dateFin =
  null;

let slotId =
  null;

let token =
  null;

let newSlotId =
  null;

let selectedSlotIndex =
  null;

let selectedSlot =
  null;

let availableSlots =
  [];

let reference =
  null;

let nom =
  null;

let prenom =
  null;

let email =
  null;

let telephone =
  null;

// ======================================================
// 12. NOUVELLE ACTION / REDEMARRAGE / CHANGEMENT
// ======================================================
//
// REGLE PRINCIPALE :
//
// Si une nouvelle action commence, nous ne fusionnons
// PAS les anciennes informations métier.
//
// Nous utilisons uniquement ce que "Parser intention"
// a réellement extrait du message courant.
//
// ======================================================

const slotSelectionFromAvailability =
  !createFlowLocked &&
  !explicitRestart &&
  previousPendingAction === 'GET_AVAILABILITY' &&
  currentIntent === 'CREATE_APPOINTMENT' &&
  hasValue(current.selectedSlotIndex);

if (
  (actionChanged || startingNewAction) &&
  slotSelectionFromAvailability
) {

  // Transition GET_AVAILABILITY -> CREATE via « Je prends le N » :
  // conserver critères et créneaux mémorisés, puis résoudre l'UUID.
  intent =
    'CREATE_APPOINTMENT';

  service =
    pick(
      current.service,
      previous.service
    );

  site =
    pick(
      current.site,
      previous.site
    );

  dateDebut =
    pick(
      current.dateDebut,
      previous.date_debut
    );

  dateFin =
    pick(
      current.dateFin,
      previous.date_fin
    );

  slotId =
    hasValue(current.slotId)
      ? current.slotId
      : null;

  token =
    null;

  newSlotId =
    null;

  selectedSlotIndex =
    current.selectedSlotIndex;

  reference =
    hasValue(current.reference)
      ? current.reference
      : null;

  nom =
    hasValue(current.nom)
      ? current.nom
      : null;

  prenom =
    hasValue(current.prenom)
      ? current.prenom
      : null;

  email =
    hasValue(current.email)
      ? current.email
      : null;

  telephone =
    hasValue(current.telephone)
      ? current.telephone
      : null;

  availableSlots =
    previousAvailableSlots;

  selectedSlot =
    null;
}

else if (
  actionChanged ||
  startingNewAction
) {

  intent =
    currentIntent;

  // ----------------------------------------------------
  // Service
  // ----------------------------------------------------

  service =
    hasValue(current.service)
      ? current.service
      : null;

  // ----------------------------------------------------
  // Site
  // ----------------------------------------------------

  site =
    hasValue(current.site)
      ? current.site
      : null;

  // ----------------------------------------------------
  // Dates
  // ----------------------------------------------------

  dateDebut =
    hasValue(current.dateDebut)
      ? current.dateDebut
      : null;

  dateFin =
    hasValue(current.dateFin)
      ? current.dateFin
      : null;

  // ----------------------------------------------------
  // Identifiants
  // ----------------------------------------------------

  slotId =
    hasValue(current.slotId)
      ? current.slotId
      : null;

  token =
    hasValue(current.token)
      ? current.token
      : null;

  newSlotId =
    hasValue(current.newSlotId)
      ? current.newSlotId
      : null;

  selectedSlotIndex =
    hasValue(current.selectedSlotIndex)
      ? current.selectedSlotIndex
      : null;

  // ----------------------------------------------------
  // Référence
  // ----------------------------------------------------

  reference =
    hasValue(current.reference)
      ? current.reference
      : null;

  // ----------------------------------------------------
  // Informations personnelles
  // ----------------------------------------------------

  nom =
    hasValue(current.nom)
      ? current.nom
      : null;

  prenom =
    hasValue(current.prenom)
      ? current.prenom
      : null;

  email =
    hasValue(current.email)
      ? current.email
      : null;

  telephone =
    hasValue(current.telephone)
      ? current.telephone
      : null;

  // ----------------------------------------------------
  // Une nouvelle action ne récupère jamais les anciens
  // créneaux.
  // ----------------------------------------------------

  availableSlots =
    [];

  selectedSlot =
    null;

  // ----------------------------------------------------
  // CREATE
  // ----------------------------------------------------

  if (
    currentIntent === 'CREATE_APPOINTMENT'
  ) {

    // Une création n'utilise jamais le token d'un
    // rendez-vous existant.

    token =
      null;

    // newSlotId appartient à RESCHEDULE.

    newSlotId =
      null;
  }

  // ----------------------------------------------------
  // RESCHEDULE
  // ----------------------------------------------------

  if (
    currentIntent === 'RESCHEDULE_APPOINTMENT'
  ) {

    // slotId appartient à CREATE.
    // Pour RESCHEDULE, le nouveau créneau ira dans
    // newSlotId.

    slotId =
      null;
  }
}

// ======================================================
// 13. CONTINUATION DE LA MEME ACTION
// ======================================================
//
// C'est uniquement ici que nous avons le droit de faire:
//
// nouvelle valeur ?? ancienne valeur
//
// ======================================================

else if (
  continuingPreviousAction
) {

  // ----------------------------------------------------
  // L'action précédente reste prioritaire
  // ----------------------------------------------------

  intent =
    previousPendingAction;

  // ----------------------------------------------------
  // Service
  // ----------------------------------------------------

  service =
    pick(
      current.service,
      previous.service
    );

  // ----------------------------------------------------
  // Site
  // ----------------------------------------------------

  site =
    pick(
      current.site,
      previous.site
    );

  // ----------------------------------------------------
  // Dates
  // ----------------------------------------------------

  dateDebut =
    pick(
      current.dateDebut,
      previous.date_debut
    );

  dateFin =
    pick(
      current.dateFin,
      previous.date_fin
    );

  // ----------------------------------------------------
  // Identifiants
  // ----------------------------------------------------

  slotId =
    pick(
      current.slotId,
      previous.slot_id
    );

  token =
    pick(
      current.token,
      previous.token
    );

  newSlotId =
    pick(
      current.newSlotId,
      previous.new_slot_id
    );

  // ----------------------------------------------------
  // Référence
  // ----------------------------------------------------

  reference =
    pick(
      current.reference,
      previous.reference
    );

  // ----------------------------------------------------
  // Informations personnelles
  // ----------------------------------------------------

  nom =
    pick(
      current.nom,
      previous.nom
    );

  prenom =
    pick(
      current.prenom,
      previous.prenom
    );

  email =
    pick(
      current.email,
      previous.email
    );

  telephone =
    pick(
      current.telephone,
      previous.telephone
    );

  // ----------------------------------------------------
  // Sélection
  // ----------------------------------------------------

  selectedSlotIndex =
    pick(
      current.selectedSlotIndex,
      previous.selected_slot_index
    );

  availableSlots =
    previousAvailableSlots;
}

// ======================================================
// 14. AUCUNE ACTION METIER ACTIVE
// ======================================================

else {

  // GET_AVAILABILITY / GENERAL sans pending_action :
  // conserver la mémoire valide déjà enregistrée.
  intent =
    currentIntent;

  service =
    pick(
      current.service,
      previous.service
    );

  site =
    pick(
      current.site,
      previous.site
    );

  dateDebut =
    pick(
      current.dateDebut,
      previous.date_debut
    );

  dateFin =
    pick(
      current.dateFin,
      previous.date_fin
    );

  slotId =
    pick(
      current.slotId,
      previous.slot_id
    );

  token =
    pick(
      current.token,
      previous.token
    );

  newSlotId =
    pick(
      current.newSlotId,
      previous.new_slot_id
    );

  selectedSlotIndex =
    pick(
      current.selectedSlotIndex,
      previous.selected_slot_index
    );

  reference =
    pick(
      current.reference,
      previous.reference
    );

  nom =
    pick(
      current.nom,
      previous.nom
    );

  prenom =
    pick(
      current.prenom,
      previous.prenom
    );

  email =
    pick(
      current.email,
      previous.email
    );

  telephone =
    pick(
      current.telephone,
      previous.telephone
    );

  availableSlots =
    previousAvailableSlots;
}

// ======================================================
// 15. CONVERSION DU NUMERO DE CRENEAU
// ======================================================
//
// Exemple:
//
// utilisateur : "Je prends le 2"
//
// Si action = CREATE
//     -> slotId
//
// Si action = RESCHEDULE
//     -> newSlotId
//
// IMPORTANT :
// Le choix "2" ne change jamais à lui seul l'intention.
//
// ======================================================

if (
  selectedSlotIndex !== null &&
  selectedSlotIndex !== undefined &&
  Array.isArray(availableSlots) &&
  availableSlots.length > 0
) {

  const numericIndex =
    Number(selectedSlotIndex);

  if (
    Number.isInteger(numericIndex) &&
    numericIndex >= 1 &&
    numericIndex <= availableSlots.length
  ) {

    selectedSlot =
      availableSlots[numericIndex - 1];

    const selectedId =
      selectedSlot?.id ??
      selectedSlot?.slotId ??
      null;

    if (
      selectedId &&
      isValidUUID(selectedId)
    ) {

      // ------------------------------------------------
      // REPLANIFICATION
      // ------------------------------------------------

      if (
        previousPendingAction ===
          'RESCHEDULE_APPOINTMENT' ||
        intent ===
          'RESCHEDULE_APPOINTMENT'
      ) {

        newSlotId =
          String(selectedId).trim();

        slotId =
          null;

        intent =
          'RESCHEDULE_APPOINTMENT';
      }

      // ------------------------------------------------
      // CREATION
      // ------------------------------------------------

      else if (
        previousPendingAction ===
          'CREATE_APPOINTMENT' ||
        intent ===
          'CREATE_APPOINTMENT'
      ) {

        slotId =
          String(selectedId).trim();

        newSlotId =
          null;

        intent =
          'CREATE_APPOINTMENT';
      }
    }
  }
}

// ======================================================
// 16. DISPONIBILITE HORS ACTION MULTI-TOUR
// ======================================================
//
// On évite de convertir une CREATE ou une RESCHEDULE
// active en GET_AVAILABILITY dans ce nœud.
//
// "Gérer collecte progressive" décidera quand une
// recherche de créneaux est réellement prête.
//
// ======================================================

if (
  !hasValue(previousPendingAction) &&
  !hasExplicitBusinessIntent
) {

  if (
    service &&
    site &&
    (
      dateDebut ||
      dateFin ||
      /\b(disponibilit|créneau|creneau|période|periode|date)\b/i
        .test(message)
    )
  ) {

    intent =
      'GET_AVAILABILITY';
  }
}

// ======================================================
// 17. SECURITE CREATE_APPOINTMENT
// ======================================================

if (
  intent === 'CREATE_APPOINTMENT'
) {

  // Un CREATE n'utilise pas le token de gestion
  // d'un ancien rendez-vous.

  token =
    null;

  // newSlotId est réservé à la replanification.

  newSlotId =
    null;
}

// ======================================================
// 18. SECURITE RESCHEDULE_APPOINTMENT
// ======================================================

if (
  intent === 'RESCHEDULE_APPOINTMENT'
) {

  // slotId représente le créneau choisi pour CREATE.
  // newSlotId représente le nouveau créneau de RESCHEDULE.

  slotId =
    null;
}

// ======================================================
// 19. RESULTAT FINAL
// ======================================================

return [{
  json: {

    // --------------------------------------------------
    // Session
    // --------------------------------------------------

    sessionId:
      current.sessionId ??
      previous.session_id ??
      null,

    // --------------------------------------------------
    // Action
    // --------------------------------------------------

    intent,

    // --------------------------------------------------
    // Critères
    // --------------------------------------------------

    service,
    site,

    dateDebut,
    dateFin,

    // --------------------------------------------------
    // Identifiants
    // --------------------------------------------------

    slotId,
    token,
    newSlotId,

    // --------------------------------------------------
    // Sélection
    // --------------------------------------------------

    selectedSlotIndex,

    selectedSlot,

    availableSlots,

    // --------------------------------------------------
    // Rendez-vous / personne
    // --------------------------------------------------

    reference,

    nom,
    prenom,
    email,
    telephone,

    // --------------------------------------------------
    // Message
    // --------------------------------------------------

    originalMessage,

    confidence:
      current.confidence ?? 0,

    llmIntent:
      current.llmIntent ??
      current.intent ??
      null,

    // ==================================================
    // DEBUG TEMPORAIRE
    // ==================================================
    //
    // Gardez ce bloc pendant nos tests.
    // Nous pourrons le supprimer lorsque CREATE /
    // CANCEL / GET / RESCHEDULE seront tous validés.
    //
    // ==================================================

    memoryDebug: {

      // ----------------------------------------------
      // Intention actuelle
      // ----------------------------------------------

      currentIntent:
        current.intent ?? null,

      detectedCurrentIntent:
        currentIntent ?? null,

      // ----------------------------------------------
      // Etat précédent
      // ----------------------------------------------

      previousPendingAction:
        previousPendingAction,

      previousConversationStep:
        previousConversationStep,

      // ----------------------------------------------
      // Décision de machine à états
      // ----------------------------------------------

      hasExplicitBusinessIntent,

      explicitRestart,

      explicitCreateRestart,

      explicitRescheduleRestart,

      explicitCancelRestart,

      explicitGetRestart,

      actionChanged,

      startingNewAction,

      continuingPreviousAction,

      slotSelectionFromAvailability,

      // ----------------------------------------------
      // Anciennes valeurs
      // ----------------------------------------------

      previousService:
        previous.service ?? null,

      previousSite:
        previous.site ?? null,

      previousDateDebut:
        previous.date_debut ?? null,

      previousDateFin:
        previous.date_fin ?? null,

      previousToken:
        previous.token ?? null,

      previousAvailableSlotsCount:
        previousAvailableSlots.length,

      // ----------------------------------------------
      // Sélection
      // ----------------------------------------------

      selectedSlotIndex:
        selectedSlotIndex ?? null,

      selectedSlotFound:
        !!selectedSlot,

      // ----------------------------------------------
      // Valeurs finales
      // ----------------------------------------------

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

      finalIntent:
        intent
    }
  }
}];