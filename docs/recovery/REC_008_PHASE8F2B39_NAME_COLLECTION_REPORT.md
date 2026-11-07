# REC-008 phase 8F-2B39 — Collecte contrôlée du nom (`rec008-8f2b37-new-01`)

Un message `Dupont` sur la session en `ASK_NOM` (après 8F-2B38). Nom persisté, transition `ASK_NOM` → `ASK_PRENOM`, contexte métier conservé. **Aucune tentative, aucun CLAIM, aucun POST.**

Verdict : **PASS**  
GO/NO-GO collecte du prénom : **GO**

Artefacts : `n8n/proposed/2026-10-31-rec008-phase8f2b39-NAME-COLLECTION/`  
(`PREFLIGHT.json`, `RESULT.json`, `response.txt`, `run.js`)

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow | inactif, `activeVersionId = null` |
| Version / compteur | `e1b32992-…` / **8** |
| Graphe / Finaliser | 134 / 137 ; SHA `3fc500bf…` |
| Credentials / URL / isolation | TEST / 10 mock / OK |
| PostgreSQL | **1 / 10 / 3 / 0** ; 0 ouverte |
| Tentatives | 1 ABANDONED + 1 CONFIRMED + 1 EXPIRED |
| Mock | POST **0** ; GET availability **2** |
| LIVE / Mailpit | `a2dea067…` ; 5 / 2 / 98 304 |

## 2. État initial de la session

| Champ | Valeur |
| --- | --- |
| Intent / pending / step | `CREATE_APPOINTMENT` / `CREATE_APPOINTMENT` / `ASK_NOM` |
| Service / site / dates | PASSEPORT / PARIS / `2026-11-03` |
| `slot_id` / index | `33333333-…` / 1 |
| Identité | vide |
| Tentatives liées | 0 |

## 3. Message unique

Exactement : `Dupont` — `sessionId = rec008-8f2b37-new-01`. Aucun retry.

## 4. Réponse HTTP et durée

| Mesure | Valeur |
| --- | --- |
| Activation | 200 ; version `e1b32992-…` seule active |
| Message | **200** ; **49 193 ms** |
| Désactivation | immédiate ; webhooks = 0 |

## 5. Étape conversationnelle

| Champ | Valeur |
| --- | --- |
| `type` | `create_appointment_question` |
| `conversationStep` | **`ASK_PRENOM`** |
| Texte | « Merci. Quel est votre **prénom** ? » |
| `ready` / `claimAcquired` | **false** / **false** |
| Annonce RDV confirmé | non |

## 6. Persistance PostgreSQL

| Champ | Après |
| --- | --- |
| `nom` | **Dupont** |
| `prenom` / `email` / `telephone` | vides |
| `conversation_step` | `ASK_PRENOM` |
| Intent / pending | `CREATE_APPOINTMENT` |
| Tentatives session | **0** |
| Compteurs | `1\|10\|3\|0` |

## 7. Conservation du contexte

PASSEPORT / PARIS / dates / `slot_id` / index 1 / `available_slots` inchangés.

## 8. Absence de CLAIM / POST

GET availability Δ = **0** ; POST Δ = **0** ; pas de cancel/reschedule.

## 9. Intégrité historique

Autres sessions inchangées. Tentatives ABANDONED / CONFIRMED / EXPIRED inchangées.

## 10. Intégrité LIVE / Mailpit

Inchangés. Workflow inactif ; VC **8** ; Finaliser SHA et graphe inchangés.

## 11. Verdict

**PASS**

## 12. GO/NO-GO

**GO** pour la collecte du prénom sur `rec008-8f2b37-new-01`, sous **autorisation distincte**.

Arrêt ici.
