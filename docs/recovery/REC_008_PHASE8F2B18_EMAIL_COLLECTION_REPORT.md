# REC-008 phase 8F-2B18 — Collecte de l’adresse e-mail

Un message `camille.essai@example.test` sur `rec008-8f2b14-new-01` (version `e84ee0d2-…` / 6). E-mail validé et persisté, transition `ASK_EMAIL` → `ASK_TELEPHONE`, identité et mémoire métier conservées. **Aucune tentative**, **aucun POST métier**.

Verdict : **PASS**.

Artefacts : `n8n/proposed/2026-10-30-rec008-phase8f2b18-EMAIL-COLLECTION/` (`CONTRACT.json`, `RESULT.json`, `response.txt`).

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
| Session | `ASK_EMAIL`, Dupont / Camille, e-mail vide, slot UUID |
| Ancienne tentative | `ABANDONED`, clé/corps NULL |

## 2. Audit du routage

| Point | Constat |
| --- | --- |
| Gérer | collecte + `isValidEmail` depuis `ASK_EMAIL` |
| Transition | e-mail valide + téléphone absent → `ASK_TELEPHONE` |
| INSERT | seulement après téléphone valide |
| CreateAppointment | **non atteignable** depuis Valider / Demander |

**GO activation.**

## 3. Activation

`POST .../activate` → 200. Version `e84ee0d2-…`. Seul workflow actif.

## 4. Message unique

`camille.essai@example.test` — un seul message.

## 5. Réponse HTTP

| Mesure | Valeur |
| --- | --- |
| HTTP | 200 |
| Durée | 11 989 ms |
| `type` | `create_appointment_question` |
| `conversationStep` | `ASK_TELEPHONE` |
| Texte | `Quel est votre **numéro de téléphone** ?` |
| `attemptAction` | `COLLECT` |
| `ready` / `claimAcquired` | false / false |

## 6. État PostgreSQL de la session

| Champ | Avant | Après |
| --- | --- | --- |
| `email` | vide | **`camille.essai@example.test`** |
| `nom` / `prenom` | Dupont / Camille | conservés |
| `telephone` | vide | vide |
| `conversation_step` | `ASK_EMAIL` | **`ASK_TELEPHONE`** |

## 7. Conservation des données métier

PASSEPORT / PARIS / 2026-11-03 / `slot_id` UUID / index 1 / `available_slots` inchangés.

## 8. Validation / missing

| Champ | Valeur |
| --- | --- |
| `validation.slotIdValide` | `true` |
| `validation.emailValide` | `true` |
| `validation.telephoneValide` | `false` |
| `missing` | téléphone uniquement |

## 9. Absence de tentative et de POST

0 tentative sur la session. 1× `ABANDONED` globale. 0 POST. Mock inchangé. Mailpit inchangé (aucun e-mail envoyé).

## 10. Compteurs mock

Total 2, GET services 1, GET availability 1, POST 0.

## 11. Compteurs PostgreSQL TEST

1 rendez-vous, 8 sessions, 1 tentative, 0 notification.

## 12. Durée et mémoire Ollama

11 989 ms ; 1,108 Gio → 1,135 Gio ; OOM false.

## 13. Désactivation

`active = false`, `activeVersionId = null`, 0 webhook, compteur 6, graphe 134/137.

## 14. Intégrité GovSuite et Mailpit

GovSuite inchangé. Mailpit 5 / 2 / 98 304.

## 15. Verdict

**PASS**.

## 16. GO/NO-GO

Collecte du téléphone sur `rec008-8f2b14-new-01`, après autorisation distincte : **GO**.

Collecter d’autres champs ou confirmer maintenant sans autorisation : **NO-GO**.

Arrêt 8F-2B18.
