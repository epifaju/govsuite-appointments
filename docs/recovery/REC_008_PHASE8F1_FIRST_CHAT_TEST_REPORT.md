# REC-008 phase 8F-1 — Premier test conversationnel

Un seul message a été envoyé au déclencheur de chat TEST. Le workflow ne l'a pas exécuté : le déclencheur de production répond 404 tant que le chat n'est pas public. Le workflow a été désactivé. Aucun rendez-vous n'a été créé.

## Préflight

| Contrôle | Résultat |
| --- | --- |
| n8n TEST | `http://127.0.0.1:5682`, workflow `OCD9It1uKFhOoWNF` |
| État avant activation | inactif, version `e499b802-f345-44bf-85b7-4a929fe4bbf5`, compteur 2, 134 nœuds, 137 liens, 0 exécution |
| Workflows TEST | un seul, inactif |
| PostgreSQL TEST | `Fs0l0058q5CEadRw`, 30 références |
| Ollama TEST | `dxzHqBq8Q60R8BOz`, URL `http://rec008-ollama:11434`, modèle `qwen2.5:1.5b` présent |
| HTTP | les 10 URL visent `http://rec008-mock:8080` |
| Credentials GovSuite | aucune référence à `1VegSXfDpTY1hQUI` ni `LlHYqyFvq4IkYbhP` |
| Déclencheur | `Lorsqu'un message de chat est reçu`, webhook `a91c4e70-6b18-4f0d-9c55-2e7d8a14b603` |
| Conservation des exécutions | succès `none`, erreurs `none`, manuelles `false`, progression `false` |
| Isolement | PostgreSQL, mock et Ollama TEST ouverts ; noms GovSuite en `EAI_AGAIN` ; adresses `192.168.112.4:5432`, `192.168.112.2:5678` et `192.168.112.3:8025` en `ENETUNREACH` ; route unique `192.168.224.0/20` sans passerelle |

PostgreSQL TEST avant le message : 4 services, 1 site, 2 créneaux, 1 rendez-vous, 1 session `rec008-session-synthetique`, 0 tentative, 0 notification.

Mock avant le message : `total` 2, `GET /services` 200 une fois, `GET /appointments/availability` 200 une fois, `distinctKeys` 0.

GovSuite avant le message : 13 rendez-vous, 14 notifications, 12 historiques, 48 sessions, 0 tentative, empreinte `a2dea067599fd4f0a5f857551adc67cc`. Workflow 03 actif en version `2d72700c-d731-47e1-b6d6-82c5c684f055`. Workflow 08 inactif. Workflow 10 inactif, 84 nœuds, version `88a1f42a-ab9e-4eff-bfd9-996c31976b16`. Copie `hRfHsSeKpRMo0c6Z` inactive, 134 nœuds, version `1c7f444e-fca3-4576-9dfa-ae19017db743`. Mailpit : 5 messages, 2 non lus, base 98 304 octets, 0 message SMTP accepté.

## Activation

Méthode : `POST http://127.0.0.1:5682/api/v1/workflows/OCD9It1uKFhOoWNF/activate` avec la version `e499b802-f345-44bf-85b7-4a929fe4bbf5`.

Réponse 200. Le workflow était actif, `activeVersionId` égal à cette version. Aucun autre workflow TEST n'était actif. Les URL restaient sur le mock. Le credential Ollama restait `dxzHqBq8Q60R8BOz`.

Déclencheur enregistré :

| Méthode | Chemin | Nœud |
| --- | --- | --- |
| GET | `a91c4e70-6b18-4f0d-9c55-2e7d8a14b603/chat` | `Lorsqu'un message de chat est reçu` |
| POST | `a91c4e70-6b18-4f0d-9c55-2e7d8a14b603/chat` | `Lorsqu'un message de chat est reçu` |

## Message

Session : `rec008-8f1-services-01`.

URL : `http://127.0.0.1:5682/webhook/a91c4e70-6b18-4f0d-9c55-2e7d8a14b603/chat`.

Message :

`Bonjour, quels sont les services consulaires disponibles ?`

Un seul envoi, avec l'action technique `sendMessage`.

| Mesure | Valeur |
| --- | --- |
| Statut HTTP | 404 |
| Corps | vide |
| Durée | 130 ms |
| Exécutions n8n | 0 |
| Mémoire Ollama avant | 28,75 Mio / 1,5 Gio |
| Mémoire Ollama après | 28,75 Mio / 1,5 Gio |
| `OOMKilled` | false, conteneur `running` |

Le modèle n'a pas été sollicité. Aucune intention n'est observable, et aucune route `GET_SERVICES` n'a été prise. Le mock n'a pas reçu de nouvel appel.

La cause est dans le déclencheur de chat, version 1.3. Le paramètre `public` est absent et vaut donc `false`. En mode production, le nœud termine la requête par un 404 vide et ne démarre pas le workflow. Le mode test de l'éditeur n'a pas été utilisé.

Le message n'a pas été renvoyé.

## Désactivation

`POST /api/v1/workflows/OCD9It1uKFhOoWNF/deactivate` a répondu 200.

| Contrôle | Résultat |
| --- | --- |
| Workflow TEST | inactif, `activeVersionId` null, version inchangée `e499b802-f345-44bf-85b7-4a929fe4bbf5`, compteur 2 |
| Autre workflow TEST actif | aucun |
| Webhooks | table vide |
| Exécutions | 0 |
| Nœuds, liens, credentials, URL | inchangés |

Après la désactivation, un POST vide vers la même URL a confirmé que le webhook n'est plus enregistré. Ce contrôle ne contenait pas le message autorisé et n'a créé aucune exécution.

## PostgreSQL TEST

| Mesure | Avant | Après |
| --- | --- | --- |
| Services, sites, créneaux | 4, 1, 2 | 4, 1, 2 |
| Rendez-vous | 1 | 1 |
| Sessions | 1, `rec008-session-synthetique` | 1, même session |
| Tentatives | 0 | 0 |
| Notifications | 0 | 0 |

La session `rec008-8f1-services-01` n'a pas été créée. Aucune ligne n'a été ajoutée à `ai_appointment_attempt`.

Mock après le test : `total` 2, les deux mêmes lectures, aucun POST.

## GovSuite

| Contrôle | Résultat |
| --- | --- |
| Rendez-vous, notifications, historiques, sessions | 13, 14, 12, 48 |
| Tentatives | 0 |
| Empreinte | `a2dea067599fd4f0a5f857551adc67cc` |
| Fonctions REC-008 | empreintes inchangées |
| Workflow 03 | actif, version `2d72700c-d731-47e1-b6d6-82c5c684f055` |
| Workflow 08 | inactif, version `43167625-0a3b-42fa-861c-60f55f316379` |
| Workflow 10 | inactif, 84 nœuds, version `88a1f42a-ab9e-4eff-bfd9-996c31976b16` |
| `hRfHsSeKpRMo0c6Z` | inactif, 134 nœuds, version `1c7f444e-fca3-4576-9dfa-ae19017db743` |
| Mailpit | v1.30.6, 5 messages, 2 non lus, base 98 304 octets, 0 accepté par SMTP |

## Anomalie

Le déclencheur enregistré refuse l'appel de production parce que le chat n'est pas public. Le scénario de consultation des services n'a donc pas pu être observé. Le workflow n'a pas été modifié pour lever ce refus.

## Verdict

Tests conversationnels suivants : **NO-GO**.

La consultation des services reste à exécuter après une autorisation distincte qui rend le déclencheur de production acceptant, sans autre changement du graphe. Cette phase ne relance pas le message.
