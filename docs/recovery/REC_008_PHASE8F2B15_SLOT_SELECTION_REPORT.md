# REC-008 phase 8F-2B15 — Sélection du créneau (nouvelle session)

Un message `Je prends le 1.` sur `rec008-8f2b14-new-01` (version `e84ee0d2-…` / 6). Transition `GET_AVAILABILITY` → `CREATE_APPOINTMENT` / `ASK_NOM`, UUID résolu, mémoire métier conservée. **Aucune tentative**, **aucun POST métier**.

Verdict : **PASS**.

Artefacts : `n8n/proposed/2026-10-30-rec008-phase8f2b15-SLOT-SELECTION/` (`CONTRACT.json`, `RESULT.json`, `response.txt`).

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow | inactif, `activeVersionId = null` |
| Version / compteur | `e84ee0d2-7af9-417e-8d47-0a28580dccac` / 6 |
| Graphe | 134 / 137 |
| Autres actifs | 0 |
| Credentials / URL / isolation | TEST / 10 mock / OK |
| PostgreSQL TEST | 1 / 8 / 1 / 0 |
| Mock | total 2, GET services 1, GET availability 1, POST 0 |
| GovSuite | 13, 14, 12, 48, 0, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Mailpit | 5 / 2 / 98 304 |
| Session | `GET_AVAILABILITY`, PASSEPORT / PARIS / 2026-11-03, 1 créneau index 1, `slot_id` et identité vides |
| Ancienne tentative | `ABANDONED`, clé/corps NULL, 0 ouverte |

## 2. Audit du routage

| Point | Constat |
| --- | --- |
| Parser | `Je prends le 1.` → `selectedSlotIndex = 1` → `CREATE_APPOINTMENT` |
| Fusionner | transition disponibilités → création : conserve service/site/dates/`availableSlots`, résout l’UUID |
| Gérer | index → `slot_id` ; sans identité → `ASK_NOM` ; pas d’`INSERT` |
| Décider | sans tentative ouverte → `COLLECT` |
| CreateAppointment | **non atteignable** depuis Valider / Demander (claim requis) |

**GO activation.**

## 3. Activation

`POST .../activate` → 200. Version `e84ee0d2-…`. Seul workflow actif.

## 4. Message unique

`Je prends le 1.` — un seul message. Pas d’identité, pas de `oui`.

## 5. Réponse HTTP

| Mesure | Valeur |
| --- | --- |
| HTTP | 200 |
| Durée | 49 244 ms |
| `type` | `create_appointment_question` |
| `conversationStep` | `ASK_NOM` |
| `attemptAction` | `COLLECT` |
| `ready` / `claimAcquired` | false / false |

Texte : « Quel est votre **nom** ? »

## 6. État PostgreSQL de la session

| Champ | Après |
| --- | --- |
| `intent` / `pending_action` | `CREATE_APPOINTMENT` |
| `conversation_step` | `ASK_NOM` |
| `service` / `site` | `PASSEPORT` / `PARIS` |
| Dates | `2026-11-03` |
| `selected_slot_index` | `1` |
| `slot_id` | `33333333-3333-4333-8333-333333333333` |
| Identité | vide |
| `last_user_message` | `Je prends le 1.` |

## 7. Sélection index / UUID

Index **1** → UUID `33333333-3333-4333-8333-333333333333`. `available_slots` conservé (1 créneau, même id / index).

## 8. Conservation des données métier

Service, site, dates et liste de créneaux inchangés par rapport au préflight 8F-2B14. Ancienne session `rec008-8f2b4-slot-01` inchangée.

## 9. Validation / missing

Présents dans la réponse JSON :

- `validation.slotIdValide = true` ; email / téléphone non valides (absents).
- `missing` : nom, prénom, e-mail, téléphone.

Cohérent avec `ASK_NOM` et l’absence d’identité.

## 10. Absence de tentative et de POST

0 tentative sur la nouvelle session. Toujours 1 tentative globale `ABANDONED`. 0 POST, 0 Cancel, `ready` / `claimAcquired` false.

## 11. Compteurs mock

Total 2, GET services 1, GET availability 1, POST 0 (inchangé).

## 12. Compteurs PostgreSQL TEST

1 rendez-vous, 8 sessions, 1 tentative, 0 notification. Empreinte rendez-vous inchangée (`986b715d…`).

## 13. Durée et mémoire Ollama

49 244 ms ; 73,89 Mio → 1,125 Gio ; OOM false.

## 14. Désactivation

`active = false`, `activeVersionId = null`, 0 webhook, compteur 6, graphe 134/137.

## 15. Intégrité GovSuite

Inchangée : 13, 14, 12, 48, 0, empreinte `a2dea067599fd4f0a5f857551adc67cc`. Mailpit 5 / 2 / 98 304.

## 16. Verdict

**PASS**.

## 17. GO/NO-GO

Collecte du nom sur `rec008-8f2b14-new-01`, après autorisation distincte : **GO**.

Collecter l’identité ou confirmer maintenant sans autorisation : **NO-GO**.

Arrêt 8F-2B15.
