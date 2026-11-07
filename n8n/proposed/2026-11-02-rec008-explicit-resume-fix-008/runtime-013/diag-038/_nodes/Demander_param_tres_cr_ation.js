const x = $json;

const step =
  x.conversationStep ??
  null;

let text =
  "Pour continuer la création du rendez-vous, j'ai besoin de quelques informations.";

switch (step) {

  case 'ASK_CREATE_SERVICE':

    text =
      "🗓️ **Création d'un rendez-vous**\n\n" +
      "Pour quel service souhaitez-vous prendre rendez-vous ?\n\n" +
      "Exemple : **Passeport**";

    break;

  case 'ASK_CREATE_SITE':

    text =
      "📍 **Choix du lieu**\n\n" +
      `Vous souhaitez prendre rendez-vous pour le service **${x.service}**.\n\n` +
      "Dans quel site souhaitez-vous effectuer cette démarche ?\n\n" +
      "Exemple : **Paris**";

    break;

  case 'ASK_CREATE_DATE_RANGE':

    text =
      "📅 **Période souhaitée**\n\n" +
      `Service : **${x.service}**\n` +
      `Site : **${x.site}**\n\n` +
      "Indiquez la période pendant laquelle vous souhaitez prendre rendez-vous.\n\n" +
      "Exemple : **Du 02/11/2026 au 06/11/2026**";

    break;

  case 'READY_CREATE_SEARCH':

    text =
      "🔎 **Recherche des créneaux**\n\n" +
      "Toutes les informations nécessaires sont disponibles.\n" +
      "Je recherche maintenant les créneaux disponibles.";

    break;

  // ====================================================
  // Aucun créneau encore choisi
  // ====================================================

  case 'ASK_SLOT':
  case 'ASK_CREATE_SLOT':

    // Service déjà connu mais site manquant
    if (
      x.service &&
      !x.site
    ) {
      text =
        "📍 **Choix du lieu**\n\n" +
        `Vous souhaitez prendre rendez-vous pour le service **${x.service}**.\n\n` +
        "Dans quel site souhaitez-vous effectuer cette démarche ?\n\n" +
        "Exemple : **Paris**";
    }

    // Service + site connus, mais dates manquantes
    else if (
      x.service &&
      x.site &&
      (
        !x.dateDebut ||
        !x.dateFin
      )
    ) {
      text =
        "📅 **Période souhaitée**\n\n" +
        `Service : **${x.service}**\n` +
        `Site : **${x.site}**\n\n` +
        "Indiquez la période pendant laquelle vous souhaitez prendre rendez-vous.\n\n" +
        "Exemple : **Du 02/09/2026 au 03/09/2026**";
    }

    // Toutes les données nécessaires à la recherche sont présentes
    else if (
      x.service &&
      x.site &&
      x.dateDebut &&
      x.dateFin
    ) {
      text =
        "🔎 **Recherche des créneaux**\n\n" +
        "Toutes les informations nécessaires sont disponibles.\n" +
        "Je recherche maintenant les créneaux disponibles.";
    }

    // Cas totalement incomplet
    else {
      text =
        "🗓️ **Création d'un rendez-vous**\n\n" +
        "Avant de renseigner vos coordonnées, nous devons d'abord choisir un créneau.\n\n" +
        "Indiquez le **service**, le **site** et la **période souhaitée**.\n\n" +
        "Exemple : **Passeport à Paris du 02/09/2026 au 03/09/2026**";
    }

    break;

  // ====================================================
  // Nom
  // ====================================================

  case 'ASK_NOM':

    text =
      "👤 **Vos coordonnées**\n\n" +
      "Quel est votre **nom** ?";

    break;

  // ====================================================
  // Prénom
  // ====================================================

  case 'ASK_PRENOM':

    text =
      "Merci. Quel est votre **prénom** ?";

    break;

  // ====================================================
  // Email
  // ====================================================

  case 'ASK_EMAIL':

    text =
      "📧 Quelle est votre **adresse e-mail** ?";

    break;

  // ====================================================
  // Téléphone
  // ====================================================

  case 'ASK_TELEPHONE':

    text =
      "📱 Quel est votre **numéro de téléphone** ?";

    break;

  // ====================================================
  // Création prête
  // ====================================================

  case 'AWAIT_CREATE_CONFIRMATION':
  case 'CREATE_RECALL':
  case 'CREATE_UNCERTAIN':

    text =
      "La création attend une confirmation explicite, une reprise de la demande déjà figée, ou l'affichage de la référence déjà connue. " +
      "Répondez oui, non, ou indiquez le champ à modifier.";

    break;

  case 'READY_CREATE':

    text =
      "Les informations sont réunies, mais le rendez-vous n'est pas créé sans confirmation explicite.";

    break;

  // ====================================================
  // Fallback
  // ====================================================

  default:

    text =
      "🗓️ Pour créer votre rendez-vous, indiquez le service, " +
      "le site et la période souhaitée.";

    break;
}

return [{
  json: {
    ...x,
    type:
      'create_appointment_question',
    text
  }
}];