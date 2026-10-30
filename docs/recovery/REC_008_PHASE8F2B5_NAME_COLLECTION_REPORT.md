# REC-008 phase 8F-2B5 — Test C2 : collecte du nom

Un message « Dupont » sur la session existante `rec008-8f2b4-slot-01`. Le nom est persisté, transition `ASK_NOM` → `ASK_PRENOM`, mémoire métier et créneau conservés. Aucun POST, aucune tentative. Incohérence `validation`/`missing` documentée, non bloquante.

Verdict du scénario : **PASS**.

Artefacts : `n8n/proposed/2026-10-30-rec008-phase8f2b5-NAME-COLLECTION/RESULT.json`.

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

## 2. Session et état initial

Session `rec008-8f2b4-slot-01` (issue de 8F-2B4), vérifiée en PostgreSQL TEST :

| Champ | Valeur |
| --- | --- |
| `intent` | `CREATE_APPOINTMENT` |
| `pending_action` | `CREATE_APPOINTMENT` |
| `conversation_step` | `ASK_NOM` |
| `service` / `site` | `PASSEPORT` / `PARIS` |
| `date_debut` / `date_fin` | `2026-11-03` |
| `slot_id` | `33333333-3333-4333-8333-333333333333` |
| `selected_slot_index` | `1` |
| `available_slots` | conservé (UUID présent) |
| `nom` / `prenom` | vides |
| `last_user_message` | `Je prends le 1.` |

## 3. Activation

`POST .../activate` → 200. Version active `12e6b201-…`. Seul workflow actif `OCD9It1uKFhOoWNF`. Webhooks chat GET/POST enregistrés.

## 4. Message envoyé

Session : `rec008-8f2b4-slot-01`.

Texte unique : `Dupont`.

Aucun autre message. Aucun retry.

## 5. Réponse HTTP

| Mesure | Valeur |
| --- | --- |
| HTTP | 200 |
| Durée | 96 073 ms |
| `type` | `create_appointment_question` |
| `conversationStep` | `ASK_PRENOM` |
| Texte | `Merci. Quel est votre **prénom** ?` |
| `attemptAction` | `COLLECT` |
| `ready` / `claimAcquired` | `false` / `false` |

## 6. Nom persisté

| Champ | Avant | Après |
| --- | --- | --- |
| `nom` | `` | `Dupont` |
| `prenom` | `` | `` (vide) |
| `last_user_message` | `Je prends le 1.` | `Dupont` |

## 7. Transition ASK_NOM → ASK_PRENOM

| Champ | Avant | Après |
| --- | --- | --- |
| `conversation_step` | `ASK_NOM` | `ASK_PRENOM` |
| Texte chatbot | (attente nom) | demande du **prénom** |

Transition conforme.

## 8. Conservation des champs métier

| Champ | Avant | Après |
| --- | --- | --- |
| `intent` | `CREATE_APPOINTMENT` | `CREATE_APPOINTMENT` |
| `pending_action` | `CREATE_APPOINTMENT` | `CREATE_APPOINTMENT` |
| `service` / `site` | `PASSEPORT` / `PARIS` | inchangés |
| Dates | `2026-11-03` | inchangées |
| `slot_id` | `33333333-3333-4333-8333-333333333333` | inchangé |
| `selected_slot_index` | `1` | inchangé |
| `available_slots` | conservé | conservé |

Aucun effacement de mémoire. Aucun nouveau GET availability. Aucun POST.

## 9. Analyse validation/missing

JSON de réponse :

| Champ | Valeur observée | Attendu / réalité PG |
| --- | --- | --- |
| `slot_id` (PG) | `33333333-…` | présent |
| `validation.slotIdValide` | `false` | devrait être `true` |
| `missing` | `le créneau choisi`, `le nom`, `le prénom`, e-mail, téléphone | créneau et nom déjà connus |
| `conversationStep` | `ASK_PRENOM` | correct |
| Texte | demande du prénom | correct |

Incohérence : le texte et `conversation_step` avancent correctement vers `ASK_PRENOM` alors que `validation`/`missing` recalculent un état « vide » (créneau et nom encore manquants, `slotIdValide: false`).

Premier nœud susceptible : **Valider paramètres création** (validation amont obsolète / non alimentée par le `slot_id` et le `nom` déjà persistés). Les nœuds de gestion / demande suivent correctement `ASK_PRENOM`.

- Non bloquant pour C2 : collecte du nom OK, créneau non effacé.
- Non considérée comme résolue.
- Aucune modification de workflow dans cette phase.

## 10. Compteurs mock

| Moment | total | GET availability | POST |
| --- | --- | --- | --- |
| Préflight | 6 | 6 | 0 |
| Après « Dupont » | 6 | 6 | 0 |

Aucun nouveau GET. Aucun POST.

## 11. Intégrité PostgreSQL TEST

| Compteur | Préflight | Postflight |
| --- | --- | --- |
| Rendez-vous | 1 | 1 |
| Sessions | 7 | 7 |
| Tentatives | 0 | 0 |
| Notifications | 0 | 0 |

Rendez-vous fictif initial inchangé. Aucune tentative REC-008.

## 12. Durée et mémoire Ollama

| Mesure | Valeur |
| --- | --- |
| Durée chat | 96 073 ms |
| Mémoire avant | 71,45 Mio / 1,5 Gio |
| Mémoire après | 1,191 Gio / 1,5 Gio |
| OOMKilled | false (running) |

## 13. Désactivation

`POST .../deactivate` → 200.

| Contrôle | Résultat |
| --- | --- |
| `active` | `false` |
| `activeVersionId` | `null` |
| Webhooks actifs | 0 |
| Autres workflows actifs | 0 |
| Version / compteur | `12e6b201-…` / 5 |
| Graphe | 134 / 137 inchangé |

## 14. Intégrité GovSuite

Inchangée : 13 rendez-vous, 14 notifications, 12 historiques, 48 sessions, 0 tentative, empreinte `a2dea067599fd4f0a5f857551adc67cc`.

Mailpit inchangé : 5 / 2 / 98 304.

## 15. Verdict

**PASS**.

Critères :

| Critère | Statut |
| --- | --- |
| HTTP 200 | OK |
| Nom `Dupont` persisté | OK |
| Prénom vide | OK |
| `ASK_NOM` → `ASK_PRENOM` | OK |
| Mémoire métier / `slot_id` conservés | OK |
| 0 GET availability supplémentaire | OK |
| 0 POST | OK |
| 0 tentative | OK |
| Validation/missing obsolète documentée, non bloquante | OK |
| Désactivation propre | OK |
| Postflight PG / mock / GovSuite / Mailpit | OK |

## 16. GO/NO-GO pour C3

Scénario C3 (collecte du prénom), après autorisation distincte : **GO**.

Activer ou chatter maintenant sans autorisation : **NO-GO**.

Arrêt 8F-2B5.
