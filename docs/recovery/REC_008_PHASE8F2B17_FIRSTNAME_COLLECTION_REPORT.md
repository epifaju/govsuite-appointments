# REC-008 phase 8F-2B17 — Collecte du prénom

Un message `Camille` sur `rec008-8f2b14-new-01` (version `e84ee0d2-…` / 6). Prénom persisté, transition `ASK_PRENOM` → `ASK_EMAIL`, nom et mémoire métier conservés. **Aucune tentative**, **aucun POST métier**.

Verdict : **PASS**.

Artefacts : `n8n/proposed/2026-10-30-rec008-phase8f2b17-FIRSTNAME-COLLECTION/` (`CONTRACT.json`, `RESULT.json`, `response.txt`).

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
| Session | `ASK_PRENOM`, nom `Dupont`, prénom vide, slot UUID |
| Ancienne tentative | `ABANDONED`, clé/corps NULL |

## 2. Audit du routage

| Point | Constat |
| --- | --- |
| Gérer | collecte du prénom depuis `ASK_PRENOM` |
| Transition | prénom présent + e-mail absent → `ASK_EMAIL` |
| Conservation | nom / slot / service / site / dates |
| INSERT | seulement identité complète |
| CreateAppointment | **non atteignable** depuis Valider / Demander |

**GO activation.**

## 3. Activation

`POST .../activate` → 200. Version `e84ee0d2-…`. Seul workflow actif.

## 4. Message unique

`Camille` — un seul message.

## 5. Réponse HTTP

| Mesure | Valeur |
| --- | --- |
| HTTP | 200 |
| Durée | 60 381 ms |
| `type` | `create_appointment_question` |
| `conversationStep` | `ASK_EMAIL` |
| Texte | `Quelle est votre **adresse e-mail** ?` |
| `attemptAction` | `COLLECT` |
| `ready` / `claimAcquired` | false / false |

## 6. État PostgreSQL de la session

| Champ | Avant | Après |
| --- | --- | --- |
| `prenom` | vide | **`Camille`** |
| `nom` | `Dupont` | **`Dupont`** |
| e-mail / téléphone | vides | vides |
| `conversation_step` | `ASK_PRENOM` | **`ASK_EMAIL`** |

## 7. Conservation des données métier

PASSEPORT / PARIS / 2026-11-03 / `slot_id` UUID / index 1 / `available_slots` inchangés. Intent et pending_action toujours `CREATE_APPOINTMENT`.

## 8. Validation / missing

| Champ | Valeur |
| --- | --- |
| `validation.slotIdValide` | `true` |
| `missing` | e-mail, téléphone |

## 9. Absence de tentative et de POST

0 tentative sur la session. 1× `ABANDONED` globale. 0 POST. Mock inchangé.

## 10. Compteurs mock

Total 2, GET services 1, GET availability 1, POST 0.

## 11. Compteurs PostgreSQL TEST

1 rendez-vous, 8 sessions, 1 tentative, 0 notification.

## 12. Durée et mémoire Ollama

60 381 ms ; 70,2 Mio → 1,136 Gio ; OOM false.

## 13. Désactivation

`active = false`, `activeVersionId = null`, 0 webhook, compteur 6, graphe 134/137.

## 14. Intégrité GovSuite et Mailpit

GovSuite inchangé. Mailpit 5 / 2 / 98 304.

## 15. Verdict

**PASS**.

## 16. GO/NO-GO

Collecte de l’e-mail sur `rec008-8f2b14-new-01`, après autorisation distincte : **GO**.

Collecter d’autres champs ou confirmer maintenant sans autorisation : **NO-GO**.

Arrêt 8F-2B17.
