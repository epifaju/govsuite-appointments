# REC-008 phase 8F-2B16 — Collecte du nom

Un message `Dupont` sur `rec008-8f2b14-new-01` (version `e84ee0d2-…` / 6). Nom persisté, transition `ASK_NOM` → `ASK_PRENOM`, créneau et mémoire métier conservés. **Aucune tentative**, **aucun POST métier**.

Verdict : **PASS**.

Artefacts : `n8n/proposed/2026-10-30-rec008-phase8f2b16-NAME-COLLECTION/` (`CONTRACT.json`, `RESULT.json`, `response.txt`).

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
| Session | `ASK_NOM`, PASSEPORT / PARIS / 2026-11-03, slot UUID, identité vide |
| Ancienne tentative | `ABANDONED`, clé/corps NULL |

## 2. Audit du routage

| Point | Constat |
| --- | --- |
| Gérer | collecte du nom depuis `ASK_NOM` |
| Transition | nom présent + prénom absent → `ASK_PRENOM` |
| INSERT | seulement identité complète → `AWAIT_CREATE_CONFIRMATION` |
| CreateAppointment | **non atteignable** depuis Valider / Demander |
| Décider | sans tentative ouverte → `COLLECT` |

**GO activation.**

## 3. Activation

`POST .../activate` → 200. Version `e84ee0d2-…`. Seul workflow actif.

## 4. Message unique

`Dupont` — un seul message.

## 5. Réponse HTTP

| Mesure | Valeur |
| --- | --- |
| HTTP | 200 |
| Durée | 50 793 ms |
| `type` | `create_appointment_question` |
| `conversationStep` | `ASK_PRENOM` |
| Texte | `Merci. Quel est votre **prénom** ?` |
| `attemptAction` | `COLLECT` |
| `ready` / `claimAcquired` | false / false |

## 6. État PostgreSQL de la session

| Champ | Avant | Après |
| --- | --- | --- |
| `nom` | vide | **`Dupont`** |
| `prenom` / e-mail / téléphone | vides | vides |
| `conversation_step` | `ASK_NOM` | **`ASK_PRENOM`** |
| service / site / dates / slot | PASSEPORT / PARIS / 2026-11-03 / UUID | **conservés** |
| `selected_slot_index` | 1 | 1 |
| `intent` / `pending_action` | `CREATE_APPOINTMENT` | inchangés |

## 7. Validation / missing

| Champ | Valeur |
| --- | --- |
| `validation.slotIdValide` | `true` |
| `validation.emailValide` / `telephoneValide` | false |
| `missing` | prénom, e-mail, téléphone (nom absent de la liste) |

## 8. Absence de tentative et de POST

0 tentative sur la session. Toujours 1× `ABANDONED` globale. 0 POST. Mock inchangé.

## 9. Compteurs mock

Total 2, GET services 1, GET availability 1, POST 0.

## 10. Compteurs PostgreSQL TEST

1 rendez-vous, 8 sessions, 1 tentative, 0 notification.

## 11. Durée et mémoire Ollama

50 793 ms ; 72,66 Mio → 1,2 Gio ; OOM false.

## 12. Désactivation

`active = false`, `activeVersionId = null`, 0 webhook, compteur 6, graphe 134/137.

## 13. Intégrité GovSuite et Mailpit

GovSuite inchangé. Mailpit 5 / 2 / 98 304.

## 14. Verdict

**PASS**.

## 15. GO/NO-GO

Collecte du prénom sur `rec008-8f2b14-new-01`, après autorisation distincte : **GO**.

Collecter d’autres champs ou confirmer maintenant sans autorisation : **NO-GO**.

Arrêt 8F-2B16.
