const x = $json;

// ------------------------------------------------------
// Récupération du rendez-vous
// ------------------------------------------------------

const appointment =
  x.appointment ??
  x.data?.appointment ??
  x.data ??
  x;

// ------------------------------------------------------
// Fonctions utilitaires
// ------------------------------------------------------

function valueOrNull(value) {
  if (
    value === null ||
    value === undefined ||
    value === '' ||
    value === 'null' ||
    value === 'undefined'
  ) {
    return null;
  }

  return value;
}

function formatService(service) {
  if (!service) return 'Non renseigné';

  const labels = {
    PASSEPORT: 'Passeport',
    VISA: 'Visa',
    LEGALISATION: 'Légalisation',
    ETAT_CIVIL: 'État civil'
  };

  return labels[service] ?? service;
}

function formatSite(site) {
  if (!site) return 'Non renseigné';

  const labels = {
    PARIS: 'Paris'
  };

  return labels[site] ?? site;
}

// ------------------------------------------------------
// Données
// ------------------------------------------------------

const reference =
  valueOrNull(appointment.reference);

const token =
  valueOrNull(
    appointment.token_gestion ??
    appointment.token
  );

const service =
  valueOrNull(appointment.service);

const site =
  valueOrNull(appointment.site);

const debut =
  valueOrNull(
    appointment.debut ??
    appointment.start
  );

const fin =
  valueOrNull(
    appointment.fin ??
    appointment.end
  );

const email =
  valueOrNull(appointment.email);

const telephone =
  valueOrNull(appointment.telephone);

// ------------------------------------------------------
// Informations utilisateur provenant de la mémoire
// ------------------------------------------------------

let state = {};

try {
  state =
    $('Sauvegarder état conversation').item.json ?? {};
} catch (e) {
  state = {};
}

const nom =
  valueOrNull(state.nom);

const prenom =
  valueOrNull(state.prenom);

// ------------------------------------------------------
// Formatage date / heure
// ------------------------------------------------------

let dateLabel = 'Non renseignée';
let heureDebutLabel = 'Non renseignée';
let heureFinLabel = 'Non renseignée';

if (debut) {

  const dateDebut = new Date(debut);

  if (!Number.isNaN(dateDebut.getTime())) {

    dateLabel =
      dateDebut.toLocaleDateString(
        'fr-FR',
        {
          timeZone: 'Europe/Paris',
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        }
      );

    heureDebutLabel =
      dateDebut.toLocaleTimeString(
        'fr-FR',
        {
          timeZone: 'Europe/Paris',
          hour: '2-digit',
          minute: '2-digit'
        }
      );
  }
}

if (fin) {

  const dateFin = new Date(fin);

  if (!Number.isNaN(dateFin.getTime())) {

    heureFinLabel =
      dateFin.toLocaleTimeString(
        'fr-FR',
        {
          timeZone: 'Europe/Paris',
          hour: '2-digit',
          minute: '2-digit'
        }
      );
  }
}

// Première lettre du jour en majuscule
dateLabel =
  dateLabel.charAt(0).toUpperCase() +
  dateLabel.slice(1);

// ------------------------------------------------------
// Nom complet
// ------------------------------------------------------

const fullName =
  [prenom, nom]
    .filter(Boolean)
    .join(' ');

// ------------------------------------------------------
// Construction du message
// ------------------------------------------------------

let text = '';

text += '✅ **Rendez-vous confirmé**\n\n';

text +=
  'Votre rendez-vous a été créé avec succès.\n\n';

text += '📋 **Détails du rendez-vous**\n\n';

text +=
  `🛂 **Service :** ${formatService(service)}\n`;

text +=
  `📍 **Site :** ${formatSite(site)}\n`;

text +=
  `📅 **Date :** ${dateLabel}\n`;

text +=
  `🕒 **Heure :** ${heureDebutLabel} – ${heureFinLabel}\n`;

if (fullName) {
  text += '\n👤 **Demandeur**\n';
  text += `${fullName}\n`;
}

if (email) {
  text += `📧 ${email}\n`;
}

if (telephone) {
  text += `📱 ${telephone}\n`;
}

text += '\n🔖 **Référence du rendez-vous**\n';
text += `${reference ?? 'Non disponible'}\n`;

text += '\n🔐 **Token de gestion**\n';
text += `${token ?? 'Non disponible'}\n`;

text += '\n⚠️ **Important**\n';

text +=
  'Conservez votre référence et votre token de gestion. ' +
  'Ils pourront être nécessaires pour consulter, modifier ou annuler votre rendez-vous.';

if (email) {
  text +=
    '\n\n📧 Une confirmation du rendez-vous vous sera envoyée par e-mail.';
}

// ------------------------------------------------------
// Output structuré
// ------------------------------------------------------

return [{
  json: {

    type: 'appointment_created',

    success: true,

    title: 'Rendez-vous confirmé',

    appointment: {
      reference,
      token,

      service,
      serviceLabel:
        formatService(service),

      site,
      siteLabel:
        formatSite(site),

      debut,
      fin,

      dateLabel,
      heureDebutLabel,
      heureFinLabel,

      nom,
      prenom,
      fullName,

      email,
      telephone
    },

    text
  }
}];