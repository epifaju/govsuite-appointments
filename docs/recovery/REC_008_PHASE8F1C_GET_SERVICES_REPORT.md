# REC-008 phase 8F-1C — Reprise GET_SERVICES

Le scénario de consultation des services a abouti. Un seul message a été envoyé, le chatbot a répondu, puis le workflow TEST a été désactivé.

Classification : **F. Parcours complet réussi.**

## Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow `OCD9It1uKFhOoWNF` | inactif, version `bb9aad73-3cf5-4c1b-bb08-132df3ccbb45`, compteur 3, 134 nœuds, 137 liens, 0 exécution persistée |
| Chat Trigger | `public: true`, `options.responseMode: lastNode`, webhook `a91c4e70-6b18-4f0d-9c55-2e7d8a14b603` |
| PostgreSQL TEST | `Fs0l0058q5CEadRw`, 30 références |
| Ollama TEST | `dxzHqBq8Q60R8BOz`, modèle `qwen2.5:1.5b` |
| HTTP | 10 URL, toutes vers `http://rec008-mock:8080` |
| Workflows TEST actifs | aucun |
| Port | `127.0.0.1:5682` |
| Isolement | PostgreSQL, mock et Ollama TEST ouverts ; noms GovSuite en `EAI_AGAIN` ; `192.168.112.4:5432`, `192.168.112.2:5678` et `192.168.112.3:8025` en `ENETUNREACH` ; route `192.168.224.0/20` sans passerelle |
| Conservation | succès `none`, erreurs `none`, manuelles `false`, progression `false` |

Avant le message : PostgreSQL TEST 4 services, 1 site, 2 créneaux, 1 rendez-vous, 1 session `rec008-session-synthetique`, 0 tentative, 0 notification. Mock `total` 2, `GET /services` 1, `GET /appointments/availability` 1, aucun POST. Ollama 26,86 Mio sur 1,5 Gio, `OOMKilled` false. GovSuite 13, 14, 12, 48, 0 tentative, empreinte `a2dea067599fd4f0a5f857551adc67cc`. Mailpit 5 messages, 2 non lus, base 98 304 octets, 0 message SMTP accepté.

## Activation et désactivation

`POST /api/v1/workflows/OCD9It1uKFhOoWNF/activate` avec la version `bb9aad73-3cf5-4c1b-bb08-132df3ccbb45` a répondu 200. `activeVersionId` était cette version. Seul ce workflow était actif.

Webhook enregistré, nœud `Lorsqu'un message de chat est reçu` :

| Méthode | Chemin |
| --- | --- |
| GET | `a91c4e70-6b18-4f0d-9c55-2e7d8a14b603/chat` |
| POST | `a91c4e70-6b18-4f0d-9c55-2e7d8a14b603/chat` |

Après la réponse, `POST /api/v1/workflows/OCD9It1uKFhOoWNF/deactivate` a répondu 200. Le workflow est inactif, `activeVersionId` est null, la version et le compteur restent `bb9aad73-3cf5-4c1b-bb08-132df3ccbb45` et 3. Aucun autre workflow TEST n'est actif. La table des webhooks est vide. Les 134 nœuds, 137 liens, credentials et `public: true` sont inchangés.

Les exécutions persistées restent à 0, conformément au réglage `none`. L'exécution est établie par la réponse HTTP, le compteur du mock et la session TEST.

## Message

Session : `rec008-8f1c-services-01`.

URL : `http://127.0.0.1:5682/webhook/a91c4e70-6b18-4f0d-9c55-2e7d8a14b603/chat`.

Action : `sendMessage`.

Message : `Bonjour, quels sont les services consulaires disponibles ?`

Un seul envoi, sans retry.

| Mesure | Valeur |
| --- | --- |
| Code HTTP | 200 |
| Durée | 116 388 ms |
| Erreur | aucune |
| Ollama après | 1,075 Gio / 1,5 Gio |
| `OOMKilled` | false, conteneur `running` |

Le corps JSON a le type `services` et le titre `Services consulaires disponibles`. Son texte est :

```text
📋 Voici les services consulaires actuellement disponibles :

1. **Passeport**
   📝 Service fictif REC-008
   ⏱️ Durée : 30 minutes
   👥 Capacité par créneau : 2

2. **Visa**
   📝 Service fictif REC-008
   ⏱️ Durée : 30 minutes
   👥 Capacité par créneau : 2

3. **Légalisation**
   📝 Service fictif REC-008
   ⏱️ Durée : 20 minutes
   👥 Capacité par créneau : 3

4. **État civil**
   📝 Service fictif REC-008
   ⏱️ Durée : 45 minutes
   👥 Capacité par créneau : 1

💬 Pour obtenir les disponibilités d'un service, indiquez simplement le service, le site et la période souhaitée.
```

La phrase finale demande le service, le site et la période pour consulter les disponibilités. Elle ne demande pas de confirmer un rendez-vous.

## Parcours observé

L'intention enregistrée dans `ai_conversation_state` pour cette session est `GET_SERVICES`. Le service, le site, le nom, l'adresse et le jeton sont vides. Aucune étape de confirmation n'est posée.

Le mock est passé de 1 à 2 lectures `GET /services`, toutes en 200. `GET /appointments/availability` est resté à 1. Aucun POST de création, d'annulation ou de replanification n'est apparu. `distinctKeys` reste 0. `total` passe de 2 à 3.

## PostgreSQL TEST

| Mesure | Avant | Après |
| --- | --- | --- |
| Services, sites, créneaux | 4, 1, 2 | 4, 1, 2 |
| Rendez-vous | 1 | 1 |
| Sessions | 1 | 2 |
| Tentatives | 0 | 0 |
| Notifications | 0 | 0 |

Écriture technique ajoutée : session `rec008-8f1c-services-01`, intention `GET_SERVICES`, message égal au texte envoyé. La session initiale `rec008-session-synthetique` est toujours présente. Aucune tentative REC-008 n'a été créée.

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
| `hRfHsSeKpRMo0c6Z` | inactif, version `1c7f444e-fca3-4576-9dfa-ae19017db743` |
| Mailpit | v1.30.6, 5 messages, 2 non lus, base 98 304 octets, 0 accepté par SMTP |

## Verdict

Scénario GET_SERVICES : **PASS**.

Premier point de défaillance : aucun.

Tests conversationnels suivants, après une autorisation distincte : **GO** pour une lecture de disponibilités. Confirmation, création, annulation et replanification : **NO-GO** tant qu'elles ne sont pas autorisées séparément. Cette phase s'arrête ici.
