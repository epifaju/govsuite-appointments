let raw =
  $json.text ??
  $json.output ??
  $json.response ??
  '';

raw = String(raw)
  .trim()
  .replace(/^```json\s*/i, '')
  .replace(/^```\s*/i, '')
  .replace(/\s*```$/i, '')
  .trim();

let parsed = {};

try {
  parsed = JSON.parse(raw);
} catch (e) {
  parsed = {};
}

// ======================================================
// TRIGGER CHAT
// ======================================================

const trigger =
  $("Lorsqu'un message de chat est reçu").item.json;

const originalMessage =
  String(trigger.chatInput ?? '').trim();

const message =
  originalMessage.toLowerCase();


// ======================================================
// MEMOIRE POSTGRESQL DU TOUR PRECEDENT
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

const previousPendingAction =
  previous.pending_action ??
  null;

const previousConversationStep =
  previous.conversation_step ??
  null;

function stripDecision(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.!?;:,]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const affirmativeDecisions = new Set([
  'oui', 'oui je confirme', 'je confirme', 'confirmer',
  'd\'accord', 'daccord', 'ok', 'yes'
]);
const negativeDecisions = new Set([
  'non', 'non merci', 'je ne confirme pas', 'annuler',
  'annuler la demande', 'abandonner', 'stop'
]);

function modifyFieldOf(value) {
  const exact = {
    'modifier': 'nom',
    'modifier le nom': 'nom',
    'modifier le prenom': 'prenom',
    'modifier l\'adresse': 'email',
    'modifier ladresse': 'email',
    'modifier le telephone': 'telephone',
    'modifier le creneau': 'creneau',
    'autre creneau': 'creneau'
  };
  if (exact[value]) return exact[value];
  if (value.includes('change le prenom') || value.includes('changer le prenom')) return 'prenom';
  if (value.includes('change le nom') || value.includes('changer le nom')) return 'nom';
  if (value.includes('change') && (value.includes('adresse') || value.includes('mail'))) return 'email';
  if (value.includes('change') && value.includes('telephone')) return 'telephone';
  if (value.includes('change') && value.includes('creneau')) return 'creneau';
  if (value.includes('modifier') || value.includes('autre creneau')) return 'nom';
  return null;
}

const decisionText = stripDecision(originalMessage);
const decisionFolded = decisionText.replace(/[’']/g, '');
const openAttempt = previous.openAttempt || null;
let createDecision = null;
let modifyField = null;

if (openAttempt && (openAttempt.status === 'UNCERTAIN' || openAttempt.status === 'SUBMITTING')) {
  createDecision = 'RESUME';
} else if (
  previousConversationStep === 'AWAIT_CREATE_CONFIRMATION' ||
  (openAttempt && openAttempt.status === 'AWAITING_CONFIRMATION')
) {
  modifyField = modifyFieldOf(decisionFolded);
  if (modifyField) createDecision = 'MODIFY';
  else if (affirmativeDecisions.has(decisionText) || affirmativeDecisions.has(decisionFolded)) createDecision = 'AFFIRM';
  else if (negativeDecisions.has(decisionText) || negativeDecisions.has(decisionFolded)) createDecision = 'NEGATIVE';
  else if (/\b(prendre|reserver|creer)\b/.test(decisionFolded) && /\b(rendez-vous|rdv)\b/.test(decisionFolded)) createDecision = 'RESTART';
  else createDecision = 'AMBIGUOUS';
} else if (
  openAttempt &&
  openAttempt.status === 'CONFIRMED' &&
  (affirmativeDecisions.has(decisionText) || affirmativeDecisions.has(decisionFolded)) &&
  !modifyFieldOf(decisionFolded)
) {
  createDecision = 'RECALL';
}


// ======================================================
// INTENTIONS AUTORISEES
// ======================================================

const allowed = [
  'GET_SERVICES',
  'GET_AVAILABILITY',
  'CREATE_APPOINTMENT',
  'GET_APPOINTMENT',
  'CANCEL_APPOINTMENT',
  'RESCHEDULE_APPOINTMENT',
  'GENERAL'
];


// ======================================================
// UTILITAIRES
// ======================================================

function normalizeDate(value) {

  if (!value) {
    return null;
  }

  const str =
    String(value).trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // DD/MM/YYYY
  const match =
    str.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
    );

  if (match) {

    const jour =
      match[1].padStart(2, '0');

    const mois =
      match[2].padStart(2, '0');

    const annee =
      match[3];

    return `${annee}-${mois}-${jour}`;
  }

  return null;
}


function isValidUUID(value) {

  if (!value) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(String(value).trim());
}


// ======================================================
// EXTRACTION DES DATES DU MESSAGE COURANT
// ======================================================

function isValidNormalizedDate(value) {
  if (!value) return false;
  const parts = String(value).split('-').map(Number);
  if (parts.length !== 3) return false;
  const [y, m, d] = parts;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const dateMatchList = [
  ...originalMessage.matchAll(
    /\b(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})\b/g
  )
].map((match) => ({
  raw: match[1],
  index: match.index,
  value: normalizeDate(match[1])
}));

const invalidDateSeen = dateMatchList.some((item) => !item.value);
const dateMatches = dateMatchList.filter((item) => item.value);

let dateDebut = null;
let dateFin = null;

const rangeMatch = String(originalMessage).toLowerCase().match(
  /\bdu\s+(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})\s+au\s+(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})\b/
);

if (rangeMatch) {
  dateDebut = normalizeDate(rangeMatch[1]);
  dateFin = normalizeDate(rangeMatch[2]);
} else if (dateMatches.length === 1) {
  const only = dateMatches[0];
  const before = String(originalMessage)
    .toLowerCase()
    .slice(Math.max(0, only.index - 48), only.index);
  if (
    /\b(date\s+de\s+fin|jusqu'?au|avant\s+le)\b/.test(before) ||
    /\bdate\s+de\s+fin\b/i.test(originalMessage)
  ) {
    dateFin = only.value;
  } else if (
    /\b(date\s+de\s+d[ée]but|[àa]\s+partir|depuis)\b/.test(before)
  ) {
    dateDebut = only.value;
  } else {
    dateDebut = only.value;
  }
} else if (dateMatches.length >= 2) {
  dateDebut = dateMatches[0].value;
  dateFin = dateMatches[1].value;
  if (dateDebut && dateFin && dateFin < dateDebut) {
    const tmp = dateDebut;
    dateDebut = dateFin;
    dateFin = tmp;
  }
}

if ((dateDebut && !isValidNormalizedDate(dateDebut)) || (dateFin && !isValidNormalizedDate(dateFin)) || invalidDateSeen) {
  if (!isValidNormalizedDate(dateDebut)) dateDebut = null;
  if (!isValidNormalizedDate(dateFin)) dateFin = null;
}


// ======================================================
// SERVICE
//
// Seulement s'il est explicitement présent
// dans le message courant.
// ======================================================

let service = null;

if (
  /\bpasseport\b/i.test(originalMessage)
) {
  service = 'PASSEPORT';
}

else if (
  /\bvisa\b/i.test(originalMessage)
) {
  service = 'VISA';
}

else if (
  /\blégalisation\b/i.test(originalMessage) ||
  /\blegalisation\b/i.test(originalMessage)
) {
  service = 'LEGALISATION';
}

else if (
  /\bétat civil\b/i.test(originalMessage) ||
  /\betat civil\b/i.test(originalMessage)
) {
  service = 'ETAT_CIVIL';
}


// ======================================================
// SITE
//
// Seulement s'il est explicitement reconnu
// dans le message courant.
// ======================================================

let site = null;

if (
  /\bparis\b/i.test(originalMessage)
) {
  site = 'PARIS';
}


// ======================================================
// CHOIX D'UN CRENEAU PAR NUMERO
//
// Exemples :
//
// Je prends le 2
// Je choisis 3
// Réserve le créneau 4
// ======================================================

const slotChoiceMatch =
  originalMessage.match(
    /\b(?:je\s+)?(?:prends?|choisis?|sélectionne|selectionne|réserve|reserve)\s+(?:le\s+)?(?:créneau\s+|creneau\s+)?(\d+)\b/i
  );

const selectedSlotIndex =
  slotChoiceMatch
    ? Number(slotChoiceMatch[1])
    : null;


// ======================================================
// EXTRACTION UUID
// ======================================================

const uuidMatches = [
  ...originalMessage.matchAll(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi
  )
].map(m => m[0]);


// ======================================================
// EMAIL
// ======================================================

const emailMatch =
  originalMessage.match(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
  );

const email =
  emailMatch?.[0] ??
  null;


// ======================================================
// TELEPHONE
// ======================================================

const telephoneMatch =
  originalMessage.match(
    /(?:\+\d{7,15}|\b\d{8,15}\b)/
  );

const telephone =
  telephoneMatch?.[0] ??
  null;


// ======================================================
// NOM / PRENOM
//
// On ne récupère ces valeurs que si les libellés
// apparaissent explicitement.
// ======================================================

const nomMatch =
  originalMessage.match(
    /\bNom\s*:\s*(.+?)(?=\s+Pr[eé]nom\s*:|\s+Email\s*:|\s+T[eé]l[eé]phone\s*:|$)/i
  );

const prenomMatch =
  originalMessage.match(
    /\bPr[eé]nom\s*:\s*(.+?)(?=\s+Email\s*:|\s+T[eé]l[eé]phone\s*:|$)/i
  );

const nom =
  nomMatch
    ? nomMatch[1].trim()
    : null;

const prenom =
  prenomMatch
    ? prenomMatch[1].trim()
    : null;


// ======================================================
// INTENTION INITIALE DU LLM
// ======================================================

let intent =
  allowed.includes(parsed.intent)
    ? parsed.intent
    : 'GENERAL';


// ======================================================
// PRIORITE 0 : ACTION CONVERSATIONNELLE EN COURS
//
// Cette partie est capitale.
//
// Si la mémoire indique que l'assistant attend un token,
// l'UUID reçu doit être interprété selon l'action en cours.
// ======================================================


// ------------------------------------------------------
// GET_APPOINTMENT : on attend le token
// ------------------------------------------------------

if (
  previousPendingAction === 'GET_APPOINTMENT' &&
  previousConversationStep === 'ASK_TOKEN'
) {
  intent = 'GET_APPOINTMENT';
}


// ------------------------------------------------------
// CANCEL_APPOINTMENT : préparation pour la suite
// ------------------------------------------------------

else if (
  previousPendingAction === 'CANCEL_APPOINTMENT' &&
  previousConversationStep === 'ASK_TOKEN'
) {
  intent = 'CANCEL_APPOINTMENT';
}


// ------------------------------------------------------
// RESCHEDULE_APPOINTMENT : token attendu
// ------------------------------------------------------

else if (
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
    (/\b(prendre|reserver|creer)\b/.test(decisionFolded) && /\b(rendez-vous|rdv)\b/.test(decisionFolded));
  if (!explicitOverride) {
    intent = 'CREATE_APPOINTMENT';
  } else if (negativeDecisions.has(decisionText) || negativeDecisions.has(decisionFolded)) {
    intent = 'CREATE_APPOINTMENT';
    createDecision = 'NEGATIVE';
  }
}
// --- P4E/P4F END PARSER ---

// ======================================================
// REGLES METIER DU MESSAGE COURANT
//
// Ces règles ne doivent pas écraser une action
// conversationnelle déjà explicitement en cours.
// ======================================================

else {

  // ----------------------------------------------------
  // 1. Annulation
  // ----------------------------------------------------

  if (createDecision) {
    intent = 'CREATE_APPOINTMENT';
  }

  else if (
    /\bannul(er|ation|e|ez)?\b/i.test(message)
  ) {
    intent =
      'CANCEL_APPOINTMENT';
  }

  // ----------------------------------------------------
  // 2. Replanification
  // ----------------------------------------------------

  else if (
    /\b(replanif|replanifier|replanification|déplacer|deplacer)\b/i.test(message) ||
    /\bchanger\b.*\brendez-vous\b/i.test(message)
  ) {
    intent =
      'RESCHEDULE_APPOINTMENT';
  }

  // ----------------------------------------------------
  // 3. Consultation
  // ----------------------------------------------------

  else if (
    /\b(consulter|voir|retrouver)\b.*\b(rendez-vous|rdv)\b/i.test(message) ||
    /\bmon rendez-vous\b/i.test(message)
  ) {
    intent =
      'GET_APPOINTMENT';
  }

  // ----------------------------------------------------
  // 4. Sélection de créneau par numéro
  // ----------------------------------------------------

  else if (
    selectedSlotIndex !== null
  ) {

    // Le numéro de créneau ne change pas l'action en cours.
    // Pendant une replanification, il désigne newSlotId.

    if (
      previousPendingAction === 'RESCHEDULE_APPOINTMENT' &&
      (
        previousConversationStep === 'ASK_RESCHEDULE_SLOT' ||
        previousConversationStep === 'ASK_RESCHEDULE_CONFIRMATION'
      )
    ) {
      intent =
        'RESCHEDULE_APPOINTMENT';
    } else {
      intent =
        'CREATE_APPOINTMENT';
    }
  }

  // ----------------------------------------------------
  // 5. Création explicite
  // ----------------------------------------------------

  else if (
    /\b(prendre|réserver|reserver|créer|creer)\b.*\b(rendez-vous|rdv|créneau|creneau)\b/i.test(message)
  ) {
    intent =
      'CREATE_APPOINTMENT';
  }

  // ----------------------------------------------------
  // 6. Disponibilités
  // ----------------------------------------------------

  else if (
    /\b(disponibilit|créneau|creneau|période|periode|date)\b/i.test(message) ||
    (
      service &&
      site &&
      (
        dateDebut ||
        dateFin
      )
    )
  ) {
    intent =
      'GET_AVAILABILITY';
  }

  // ----------------------------------------------------
  // 7. Services
  // ----------------------------------------------------

  else if (
    /\b(services?|démarches?|demarches?|proposez|disponibles)\b/i.test(message)
  ) {
    intent =
      'GET_SERVICES';
  }

  // ----------------------------------------------------
  // 8. Service seul
  //
  // Exemple :
  // "Je souhaite un passeport à Paris"
  //
  // On ne crée pas encore de rendez-vous.
  // ----------------------------------------------------

  else if (
    /\b(passeport|visa|légalisation|legalisation|état civil|etat civil)\b/i.test(message)
  ) {
    intent =
      'GET_SERVICES';
  }
}


// ======================================================
// AFFECTATION DETERMINISTE DES UUID
//
// C'est ici qu'on empêche un token de devenir slotId.
// ======================================================

let slotId =
  null;

let token =
  null;

let newSlotId =
  null;


// ------------------------------------------------------
// ACTION EN COURS : GET_APPOINTMENT
//
// L'UUID courant est forcément le token.
// ------------------------------------------------------

if (
  previousPendingAction === 'GET_APPOINTMENT' &&
  previousConversationStep === 'ASK_TOKEN'
) {

  token =
    uuidMatches[0] ??
    null;

  slotId =
    null;
}


// ------------------------------------------------------
// ACTION EN COURS : CANCEL_APPOINTMENT
// ------------------------------------------------------

else if (
  previousPendingAction === 'CANCEL_APPOINTMENT' &&
  previousConversationStep === 'ASK_TOKEN'
) {

  token =
    uuidMatches[0] ??
    null;

  slotId =
    null;
}


// ------------------------------------------------------
// ACTION EN COURS : RESCHEDULE_APPOINTMENT
//
// Premier UUID = token
// ------------------------------------------------------

else if (
  previousPendingAction === 'RESCHEDULE_APPOINTMENT' &&
  previousConversationStep === 'ASK_TOKEN'
) {

  token =
    uuidMatches[0] ??
    null;

  slotId =
    null;
}


// ------------------------------------------------------
// CREATION
// ------------------------------------------------------

else if (
  intent === 'CREATE_APPOINTMENT'
) {

  slotId =
    uuidMatches[0] ??
    null;
}


// ------------------------------------------------------
// CONSULTATION
// ------------------------------------------------------

else if (
  intent === 'GET_APPOINTMENT'
) {

  token =
    uuidMatches[0] ??
    null;
}


// ------------------------------------------------------
// ANNULATION
// ------------------------------------------------------

else if (
  intent === 'CANCEL_APPOINTMENT'
) {

  token =
    uuidMatches[0] ??
    null;
}


// ------------------------------------------------------
// REPLANIFICATION
//
// Cas initial où les 2 UUID sont fournis
// dans le même message.
// ------------------------------------------------------

else if (
  intent === 'RESCHEDULE_APPOINTMENT'
) {

  token =
    uuidMatches[0] ??
    null;

  newSlotId =
    uuidMatches[1] ??
    null;
}


// ======================================================
// RESULTAT
// ======================================================

return [
  {
    json: {

      intent,

      confidence:
        Number(
          parsed.confidence ?? 0
        ),

      service,

      site,

      dateDebut,

      dateFin,

      slotId,

      token,

      newSlotId,

      selectedSlotIndex,

      nom,

      prenom,

      email,

      telephone,

      originalMessage,

      createDecision,

      modifyField,

      sessionId:
        trigger.sessionId ??
        null,

      // ------------------------------------------------
      // Informations LLM pour audit
      // ------------------------------------------------

      llmIntent:
        parsed.intent ??
        null,

      llmRaw: {

        service:
          parsed.service ?? null,

        site:
          parsed.site ?? null,

        dateDebut:
          parsed.dateDebut ?? null,

        dateFin:
          parsed.dateFin ?? null,

        slotId:
          parsed.slotId ?? null,

        token:
          parsed.token ?? null,

        newSlotId:
          parsed.newSlotId ?? null
      },

      // ------------------------------------------------
      // Diagnostic mémoire
      // ------------------------------------------------

      memoryContext: {

        pendingAction:
          previousPendingAction,

        conversationStep:
          previousConversationStep
      },

      parserDebug: {

        uuidCount:
          uuidMatches.length,

        firstUuid:
          uuidMatches[0] ?? null,

        selectedSlotIndex,

        finalIntent:
          intent,

        resolvedSlotId:
          slotId,

        resolvedToken:
          token,

        resolvedNewSlotId:
          newSlotId
      }
    }
  }
];