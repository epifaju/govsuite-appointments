# REC-008 phase 8F-2B6 — Test C3 : collecte du prénom

Un message « Camille » sur la session existante `rec008-8f2b4-slot-01`. Le prénom est persisté, transition `ASK_PRENOM` → `ASK_EMAIL`, nom et mémoire métier conservés. Aucun POST, aucune tentative. Incohérence `validation`/`missing` toujours présente, non bloquante pour C3.

Verdict du scénario : **PASS**.

Artefacts : `n8n/proposed/2026-10-30-rec008-phase8f2b6-FIRSTNAME-COLLECTION/RESULT.json`.

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow | inactif, `activeVersionId = null` |
| Version / compteur | `12e6b201-6173-457e-97c4-a17cc1900eb6` / 5 |
| Graphe | 134 / 137 |
| Autres workflows actifs | 0 |
| Chat Trigger | `public: true`, webhook `a91c4e70-6b18-4f0d-9c55-2e7d8a14b603` |
| Credentials | PostgreSQL `Fs0l0058q5CEadRw` (30 nœuds), Ollama `dxzHqBq8Q60R8BOz` |
| HTTP | 10 URL mock exclusivement |
| Isolation | OK (`networkOk`) |
| PostgreSQL TEST | 1 rendez-vous, 7 sessions, 0 tentative, 0 notification |
| Mock | total 6, GET availability 6, POST 0 |
| GovSuite | 13, 14, 12, 48, 0, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Mailpit | 5 / 2 / 98 304 |

Préflight OK — poursuite autorisée.

## 2. Session initiale

Session `rec008-8f2b4-slot-01` (après C2), vérifiée en PostgreSQL TEST :

| Champ | Valeur |
| --- | --- |
| `intent` | `CREATE_APPOINTMENT` |
| `pending_action` | `CREATE_APPOINTMENT` |
| `conversation_step` | `ASK_PRENOM` |
| `nom` | `Dupont` |
| `prenom` | vide |
| `service` / `site` | `PASSEPORT` / `PARIS` |
| `date_debut` / `date_fin` | `2026-11-03` |
| `slot_id` | `33333333-3333-4333-8333-333333333333` |
| `available_slots` | conservé |
| `last_user_message` | `Dupont` |

## 3. Activation

`POST .../activate` → 200. Version active `12e6b201-…`. Seul workflow actif `OCD9It1uKFhOoWNF`. Webhooks chat GET/POST enregistrés.

## 4. Message et réponse

Session : `rec008-8f2b4-slot-01`.

Texte unique : `Camille`.

Aucun autre message. Aucun retry.

| Mesure | Valeur |
| --- | --- |
| HTTP | 200 |
| Durée | 82 033 ms |
| `type` | `create_appointment_question` |
| `conversationStep` | `ASK_EMAIL` |
| Texte | `📧 Quelle est votre **adresse e-mail** ?` |
| `attemptAction` | `COLLECT` |
| `ready` | `false` |
| `claimAcquired` | `false` |

## 5. Prénom persisté

| Champ | Avant | Après |
| --- | --- | --- |
| `nom` | `Dupont` | `Dupont` |
| `prenom` | `` | `Camille` |
| `last_user_message` | `Dupont` | `Camille` |

## 6. Transition ASK_PRENOM → ASK_EMAIL

| Champ | Avant | Après |
| --- | --- | --- |
| `conversation_step` | `ASK_PRENOM` | `ASK_EMAIL` |
| Texte chatbot | (attente prénom) | demande de l’**adresse e-mail** |

Transition conforme.

## 7. Conservation des données

| Champ | Avant | Après |
| --- | --- | --- |
| `intent` | `CREATE_APPOINTMENT` | `CREATE_APPOINTMENT` |
| `pending_action` | `CREATE_APPOINTMENT` | `CREATE_APPOINTMENT` |
| `service` / `site` | `PASSEPORT` / `PARIS` | inchangés |
| Dates | `2026-11-03` | inchangées |
| `slot_id` | `33333333-…` | inchangé |
| `selected_slot_index` | `1` | inchangé |
| `available_slots` | conservé | conservé |
| `nom` | `Dupont` | `Dupont` |

Aucun effacement. Aucun nouveau GET availability. Aucun POST.

## 8. Analyse validation/missing

| Champ | Réponse JSON | PostgreSQL / réalité |
| --- | --- | --- |
| `slot_id` | — | `33333333-…` présent |
| `nom` / `prenom` | — | `Dupont` / `Camille` |
| `validation.slotIdValide` | `false` | devrait être `true` |
| `missing` | créneau, nom, prénom, e-mail, téléphone | seuls e-mail et téléphone manquent réellement |
| `conversationStep` | `ASK_EMAIL` | correct |
| `ready` | `false` | attendu (collecte incomplète) |
| `claimAcquired` | `false` | attendu |

Incohérence persistante (déjà vue en C1/C2) : le texte et l’étape avancent correctement (`ASK_EMAIL`), tandis que `validation`/`missing` recalculent un état « vide ».

Premier nœud susceptible (lecture seule) : **Valider paramètres création** — validation amont non alimentée par `slot_id` / `nom` / `prenom` déjà persistés. Les nœuds de gestion / demande suivent correctement `ASK_EMAIL`.

Conséquences possibles sur **C5** (récap/confirmation) :
- `ready` peut rester `false` malgré une mémoire PostgreSQL complète.
- Le claim peut ne pas s’acquérir.
- Des champs déjà collectés peuvent réapparaître comme manquants.
- Risque de non-passage en confirmation malgré des données métier intactes.

Non bloquant pour C3. Non résolu. Aucune modification de workflow.

## 9. Compteurs mock

| Moment | total | GET availability | POST |
| --- | --- | --- | --- |
| Préflight | 6 | 6 | 0 |
| Après « Camille » | 6 | 6 | 0 |

## 10. Intégrité PostgreSQL TEST

| Compteur | Préflight | Postflight |
| --- | --- | --- |
| Rendez-vous | 1 | 1 |
| Sessions | 7 | 7 |
| Tentatives | 0 | 0 |
| Notifications | 0 | 0 |

Rendez-vous fictif initial inchangé. Aucune tentative REC-008.

## 11. Durée et mémoire Ollama

| Mesure | Valeur |
| --- | --- |
| Durée chat | 82 033 ms |
| Mémoire avant | 89,71 Mio / 1,5 Gio |
| Mémoire après | 1,193 Gio / 1,5 Gio |
| OOMKilled | false (running) |

## 12. Désactivation

`POST .../deactivate` → 200.

| Contrôle | Résultat |
| --- | --- |
| `active` | `false` |
| `activeVersionId` | `null` |
| Webhooks actifs | 0 |
| Autres workflows actifs | 0 |
| Version / compteur | `12e6b201-…` / 5 |
| Graphe | 134 / 137 inchangé |

## 13. Intégrité GovSuite

Inchangée : 13 rendez-vous, 14 notifications, 12 historiques, 48 sessions, 0 tentative, empreinte `a2dea067599fd4f0a5f857551adc67cc`.

Mailpit inchangé : 5 / 2 / 98 304.

## 14. Verdict

**PASS**.

| Critère | Statut |
| --- | --- |
| HTTP 200 | OK |
| `nom = Dupont` conservé | OK |
| `prenom = Camille` persisté | OK |
| `ASK_PRENOM` → `ASK_EMAIL` | OK |
| Mémoire métier / `slot_id` conservés | OK |
| 0 GET availability supplémentaire | OK |
| 0 POST | OK |
| 0 tentative | OK |
| Validation/missing obsolète documentée + impact C5 | OK |
| Désactivation propre | OK |
| Postflight PG / mock / GovSuite / Mailpit | OK |

## 15. GO/NO-GO pour C4

Scénario C4 (collecte de l’e-mail), après autorisation distincte : **GO**.

Activer ou chatter maintenant sans autorisation : **NO-GO**.

Arrêt 8F-2B6.
