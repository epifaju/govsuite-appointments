# REC-008 phase 8F-2B30 — Collecte contrôlée du nom (`rec008-8f2b28-new-01`)

Un message `Dupont` sur la session en `ASK_NOM` (après 8F-2B29). Nom persisté, transition `ASK_NOM` → `ASK_PRENOM`, contexte métier conservé. **Aucune tentative, aucun CLAIM, aucun POST.**

Verdict : **PASS**  
GO/NO-GO collecte du prénom : **GO**

Artefacts : `n8n/proposed/2026-10-31-rec008-phase8f2b30-NAME-COLLECTION/`  
(`PREFLIGHT.json`, `RESULT.json`, `response.txt`, `run.js`)

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow | inactif, `activeVersionId = null` |
| Version / compteur | `e1b32992-…` / **8** |
| Graphe / Finaliser | 134 / 137 ; SHA `3fc500bf…` |
| Credentials / URL / isolation | TEST / 10 mock / OK |
| PostgreSQL | 1 / 9 / 2 / 0 ; 0 ouverte |
| Mock | POST = 1 ; GET availability = 2 |
| LIVE / Mailpit | `a2dea067…` ; 5 / 2 / 98 304 |

## 2. État initial de la session

| Champ | Valeur |
| --- | --- |
| Intent / pending / step | `CREATE_APPOINTMENT` / `CREATE_APPOINTMENT` / `ASK_NOM` |
| Service / site / dates | PASSEPORT / PARIS / `2026-11-03` |
| `slot_id` / index | `33333333-…` / 1 |
| Identité | vide |
| Tentatives liées | 0 |

## 3. Message envoyé

Exactement : `Dupont` — un seul message, `sessionId = rec008-8f2b28-new-01`.

## 4. Réponse HTTP et durée

| Mesure | Valeur |
| --- | --- |
| Activation | 200 ; version `e1b32992-…` seule active |
| Message | **200** ; 59 396 ms ; **aucun retry** |
| Désactivation | immédiate ; webhooks = 0 |

## 5. Réponse conversationnelle

| Champ | Valeur |
| --- | --- |
| `type` | `create_appointment_question` |
| `conversationStep` | `ASK_PRENOM` |
| Texte | « Merci. Quel est votre **prénom** ? » |
| `claimAcquired` / `ready` | false / false |

## 6. État PostgreSQL après collecte

| Champ | Après |
| --- | --- |
| `nom` | **Dupont** |
| `prenom` / `email` / `telephone` | vides |
| `conversation_step` | `ASK_PRENOM` |
| Compteurs | `1\|9\|2\|0` ; 0 tentative sur la session |

## 7. Conservation du contexte

PASSEPORT / PARIS / dates / `slot_id` / index 1 / `available_slots` inchangés.

## 8. Absence de CLAIM / POST

GET availability Δ = 0 ; POST = **1** ; pas de cancel/reschedule ; `claimAcquired = false`.

## 9. Désactivation

Workflow inactif ; VC **8** ; Finaliser SHA et graphe inchangés.

## 10. Intégrité sessions historiques

Empreinte des autres sessions inchangée. `rec008-8f2b14-new-01` / tentatives CONFIRMED·ABANDONED inchangées.

## 11. LIVE et Mailpit

Inchangés.

## 12. Verdict

**PASS**

## 13. GO/NO-GO

**GO** pour la collecte du prénom sur `rec008-8f2b28-new-01`, après autorisation distincte.

Arrêt ici — attendre autorisation distincte.
