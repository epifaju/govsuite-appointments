# REC-008 phase 8F-1E — Alignement du mock GET_AVAILABILITY

Le mock TEST renvoie désormais le contrat de disponibilités attendu par le chatbot et par l'API réelle `02_API_GetAvailability`. Le workflow n8n n'a pas été modifié. Aucun message de chat n'a été envoyé.

## Préflight

| Contrôle | Résultat |
| --- | --- |
| n8n TEST | `127.0.0.1:5682` |
| Workflow `OCD9It1uKFhOoWNF` | inactif, version `bb9aad73-3cf5-4c1b-bb08-132df3ccbb45`, compteur 3, 134 nœuds, 137 liens |
| Autres workflows TEST actifs | aucun |
| PostgreSQL TEST | 1 rendez-vous, 3 sessions, 0 tentative |
| Mock avant redémarrage | `GET /services` 2, `GET /appointments/availability` 1, 0 POST |
| GovSuite | 13, 14, 12, 48, 0 tentative, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Mailpit | 5 messages, 2 non lus, base 98 304 octets, 0 SMTP accepté |

## Contrat JSON attendu par n8n

Référence locale : `n8n/workflows/02_API_GetAvailability.json`.

Requête : `GET /appointments/availability` avec les paramètres `service`, `site`, `dateDebut`, `dateFin`.

Réponse réelle :

```json
{
  "success": true,
  "count": 1,
  "slots": [
    {
      "id": "...",
      "service": "PASSEPORT",
      "site": "PARIS",
      "debut": "...",
      "fin": "...",
      "capacite": 2,
      "places_reservees": 0,
      "places_disponibles": 2
    }
  ]
}
```

Filtres SQL de référence :

- `s.code` et `si.code` égaux aux paramètres ;
- `statut = 'DISPONIBLE'` ;
- `places_reservees < capacite` ;
- `debut >= dateDebut` ;
- `debut < dateFin + 1 jour`.

Le nœud `Appeler GetAvailability` du workflow TEST envoie ces quatre paramètres. Le nœud `Préparer réponse disponibilité` lit `slots[]` et utilise `id`, `service`, `site`, `debut`, `fin`, `places_disponibles`.

## Contrat JSON initial du mock

Avant correction :

```json
{ "slots": [{ "id": "33333333-3333-4333-8333-333333333333", "service": "PASSEPORT", "site": "PARIS" }] }
```

Il manquait `success`, `count`, `debut`, `fin`, `capacite`, `places_reservees` et `places_disponibles`. Aucun filtre sur la période ni sur le statut n'était appliqué.

## Diff du mock

Sauvegarde : `n8n/proposed/2026-10-30-rec008-phase8f1e-MOCK-AVAILABILITY/server.mjs.before`.

Fichier déployé : `n8n/proposed/2026-10-30-rec008-phase8e2b2-TEST-DEPLOY/mock/server.mjs`.

Copie après correction : `n8n/proposed/2026-10-30-rec008-phase8f1e-MOCK-AVAILABILITY/server.mjs.after`.

| Empreinte | SHA-256 | Octets |
| --- | --- | --- |
| Avant | `aa58ee9ccde0deac537697f5e459b5c6339fb22dc388dbd5a3bdd67364b52451` | 5 333 |
| Après | `845c9f6be8b099e0a2068379f6e8f3a12a90aec73f2c496e1a25898b4d225535` | 7 489 |

Le mock conserve les deux créneaux synthétiques. Pour `GET /appointments/availability`, il :

- lit `service`, `site`, `dateDebut`, `dateFin` ;
- exclut le créneau `COMPLET` et tout créneau sans place libre ;
- filtre la période comme l'API réelle ;
- renvoie `success`, `count` et `slots` avec `debut`, `fin`, `capacite`, `places_reservees`, `places_disponibles`.

PostgreSQL TEST n'a pas été modifié.

## Tests directs HTTP

Depuis `rec008-n8n`, sans passer par le chatbot.

Période `2026-11-03` à `2026-11-03`, service `PASSEPORT`, site `PARIS` :

| Contrôle | Résultat |
| --- | --- |
| Statut | 200 |
| `count` | 1 |
| Créneau réservable | `33333333-3333-4333-8333-333333333333` |
| Début / fin | `2026-11-03T09:00:00+01:00` / `2026-11-03T09:30:00+01:00` |
| Places disponibles | 2 |
| Créneau complet `44444444-...` | absent |
| Données personnelles | aucune clé `email`, `telephone`, `nom`, `prenom`, `token` |

Période sans disponibilité `2026-12-01` à `2026-12-01` :

```json
{ "success": true, "count": 0, "slots": [] }
```

Aucun POST métier n'a été envoyé.

## Déploiement

Commande : `docker compose ... up -d --no-deps --force-recreate rec008-mock` sur le Compose 8E-2B-2. Les services n8n, PostgreSQL et Ollama n'ont pas été recréés. Le conteneur Ollama, absent de ce Compose, est resté en place.

Le redémarrage réinitialise le journal du mock. Nouvelle référence après les deux GET de contrôle :

| Compteur | Valeur |
| --- | --- |
| `total` | 2 |
| `GET /appointments/availability 200` | 2 |
| `GET /services` | 0 |
| POST | 0 |
| `distinctKeys` | 0 |

## État des conteneurs et du workflow

| Conteneur | État |
| --- | --- |
| `rec008-mock` | Up |
| `rec008-n8n` | Up |
| `rec008-postgres` | Up (healthy) |
| `rec008-ollama` | Up |
| `rec008-publish` | Up |

Workflow TEST : inactif, version `bb9aad73-3cf5-4c1b-bb08-132df3ccbb45`, compteur 3, 134 nœuds, 137 liens, 0 exécution persistée. Aucun message de chat n'a été envoyé.

## PostgreSQL TEST et GovSuite

PostgreSQL TEST : 1 rendez-vous, 3 sessions, 0 tentative, créneaux synthétiques inchangés.

GovSuite : 13, 14, 12, 48, 0 tentative, empreinte `a2dea067599fd4f0a5f857551adc67cc`, fonctions REC-008 inchangées. Mailpit inchangé.

## Préparation des scénarios conversationnels suivants

Non exécutés dans cette phase.

### Scénario A — reprise de session

Session : `rec008-8f1d-availability-01`.

État déjà persisté : intention `GET_AVAILABILITY`, service `PASSEPORT`, site `PARIS`, `date_debut = 2026-11-03`, `date_fin` vide.

Message suivant proposé :

`Ma date de fin est le 03/11/2026.`

Objectif : vérifier la conservation du service, du site et de la date de début, puis l'appel mock.

### Scénario B — demande complète

Nouvelle session synthétique.

Message proposé :

`Je souhaite connaître les disponibilités pour un passeport à Paris du 03/11/2026 au 03/11/2026.`

Objectif : vérifier l'extraction des quatre paramètres et l'appel mock en un tour.

Dans les deux cas, la réponse attendue doit présenter le créneau du 3 novembre 2026 de 09:00 à 09:30, avec 2 places, et ne pas proposer le créneau complet de 10:00.

## Verdict

Nouveau test conversationnel de disponibilité après une autorisation distincte : **GO**.

Activer le workflow, envoyer un message, ou lancer les scénarios A et B maintenant : **NO-GO**.
