# REC-008 phase 8F-1D — Test conversationnel GET_AVAILABILITY

Un seul message a été envoyé. Le webhook a accepté la requête. Le workflow a reconnu l'intention et une partie des paramètres, puis s'est arrêté faute de date de fin. Aucun créneau n'a été présenté. Le workflow TEST a été désactivé.

Verdict du scénario : **FAIL**.

## Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow `OCD9It1uKFhOoWNF` | inactif, version `bb9aad73-3cf5-4c1b-bb08-132df3ccbb45`, compteur 3, 134 nœuds, 137 liens |
| Chat Trigger | `public: true`, `options.responseMode: lastNode`, webhook `a91c4e70-6b18-4f0d-9c55-2e7d8a14b603` |
| PostgreSQL TEST | `Fs0l0058q5CEadRw`, 30 références |
| Ollama TEST | `dxzHqBq8Q60R8BOz`, modèle `qwen2.5:1.5b` |
| HTTP | 10 URL, toutes vers `http://rec008-mock:8080` |
| Workflows TEST actifs | aucun |
| Port | `127.0.0.1:5682` |
| Isolement | PostgreSQL, mock et Ollama TEST ouverts ; noms GovSuite en `EAI_AGAIN` ; adresses GovSuite en `ENETUNREACH` |

Avant le message : PostgreSQL TEST 1 rendez-vous, 2 sessions, 0 tentative. Mock `total` 3, `GET /services` 2, `GET /appointments/availability` 1, aucun POST. Ollama environ 37 à 40 Mio sur 1,5 Gio, `OOMKilled` false. GovSuite 13, 14, 12, 48, 0 tentative, empreinte `a2dea067599fd4f0a5f857551adc67cc`. Mailpit 5 messages, 2 non lus, base 98 304 octets, 0 message SMTP accepté.

## Données synthétiques attendues

PostgreSQL TEST :

| Identifiant | Service | Site | Début | Fin | Capacité | Réservés | Statut |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `33333333-3333-4333-8333-333333333333` | PASSEPORT | PARIS | 2026-11-03 09:00+01 | 2026-11-03 09:30+01 | 2 | 0 | DISPONIBLE |
| `44444444-4444-4444-8444-444444444444` | PASSEPORT | PARIS | 2026-11-03 10:00+01 | 2026-11-03 10:30+01 | 1 | 1 | COMPLET |

Le mock, pour `GET /appointments/availability`, renvoie un créneau unique :

```json
{ "slots": [{ "id": "33333333-3333-4333-8333-333333333333", "service": "PASSEPORT", "site": "PARIS" }] }
```

Il n'expose ni `debut`, ni `fin`, ni `places_disponibles`. Aucune donnée de test n'a été modifiée.

## Activation et désactivation

`POST /api/v1/workflows/OCD9It1uKFhOoWNF/activate` avec la version `bb9aad73-3cf5-4c1b-bb08-132df3ccbb45` a répondu 200. Seul ce workflow était actif. Le webhook GET et POST `a91c4e70-6b18-4f0d-9c55-2e7d8a14b603/chat` était enregistré.

Après la réponse, `POST .../deactivate` a répondu 200. Le workflow est inactif, `activeVersionId` est null, la version et le compteur restent `bb9aad73-3cf5-4c1b-bb08-132df3ccbb45` et 3. Aucun webhook n'est enregistré. Les 134 nœuds, 137 liens, credentials et endpoints sont inchangés. `public` reste `true`.

## Message

Session : `rec008-8f1d-availability-01`.

URL : `http://127.0.0.1:5682/webhook/a91c4e70-6b18-4f0d-9c55-2e7d8a14b603/chat`.

Action : `sendMessage`.

Message : `Je souhaite connaître les disponibilités pour un passeport à Paris le 03/11/2026.`

Un seul envoi, sans retry.

| Mesure | Valeur |
| --- | --- |
| Code HTTP | 200 |
| Durée | 132 961 ms |
| Réponse | `{"text":"Pour rechercher les disponibilités, j'ai besoin de la date de fin (YYYY-MM-DD)."}` |
| Erreur HTTP | aucune |
| Ollama avant | 40,12 Mio / 1,5 Gio |
| Ollama après | 1,085 Gio / 1,5 Gio |
| `OOMKilled` | false, conteneur `running` |

## Intention et paramètres persistés

Session `rec008-8f1d-availability-01` dans `ai_conversation_state` :

| Champ | Valeur |
| --- | --- |
| Intention | `GET_AVAILABILITY` |
| Service | `PASSEPORT` |
| Site | `PARIS` |
| `date_debut` | `2026-11-03` |
| `date_fin` | vide |
| `conversation_step` | vide |
| `pending_action` | vide |
| Nom, prénom, e-mail, téléphone | absents |

Le message enregistré est exactement celui envoyé.

## Route réellement exécutée

Le nœud `Valider paramètres disponibilité` exige `service`, `site`, `dateDebut` et `dateFin`. Avec `dateFin` manquant, `ready` reste faux. Le nœud `Demander paramètres disponibilité` produit alors le texte observé.

Le mock n'a reçu aucun nouvel appel. `GET /appointments/availability` reste à 1, le même compteur qu'avant le message. `GET /services` reste à 2. Aucun POST n'apparaît. `total` reste 3.

Aucune comparaison de créneaux n'est possible : la réponse utilisateur ne contient pas le créneau mock `33333333-3333-4333-8333-333333333333`.

## PostgreSQL TEST

| Mesure | Avant | Après |
| --- | --- | --- |
| Rendez-vous | 1 | 1 |
| Sessions | 2 | 3 |
| Tentatives | 0 | 0 |
| Notifications | 0 | 0 |

Écriture technique : session `rec008-8f1d-availability-01`. Les sessions `rec008-8f1c-services-01` et `rec008-session-synthetique` sont toujours présentes. Aucune tentative REC-008 n'a été créée. Aucun rendez-vous n'a été ajouté.

## GovSuite

| Contrôle | Résultat |
| --- | --- |
| Rendez-vous, notifications, historiques, sessions | 13, 14, 12, 48 |
| Tentatives | 0 |
| Empreinte | `a2dea067599fd4f0a5f857551adc67cc` |
| Fonctions REC-008 | empreintes inchangées |
| Workflows 03, 08, 10 et `hRfHsSeKpRMo0c6Z` | versions inchangées |
| Mailpit | v1.30.6, 5 messages, 2 non lus, base 98 304 octets, 0 accepté par SMTP |

## Anomalies

1. Le message unique ne fournit qu'une date. L'extracteur a posé `dateDebut = 2026-11-03` et a laissé `dateFin` vide.
2. `Valider paramètres disponibilité` bloque l'appel mock dès qu'il manque `dateFin`.
3. Le parcours attendu, jusqu'à la présentation des créneaux, n'a donc pas été atteint.
4. Écart structurel entre le mock et le formateur de réponse : même si l'appel avait eu lieu, le mock ne renvoie ni horaires ni places ; le nœud `Préparer réponse disponibilité` s'attend à `debut`, `fin` et `places_disponibles`.

Premier point de défaillance : validation des paramètres de disponibilité, avant `Appeler GetAvailability`.

Aucune correction fonctionnelle n'a été appliquée dans cette phase.

## Verdict

Scénario GET_AVAILABILITY : **FAIL**.

Phase de collecte et confirmation : **NO-GO**.

Le message unique autorisé n'a pas produit de créneaux. Les tests suivants de réservation ou de confirmation ne doivent pas démarrer tant que le parcours de disponibilité n'a pas été validé après une autorisation distincte. Cette phase s'arrête ici.
