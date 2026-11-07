# REC-008 phase 8F-2B29 — Sélection contrôlée du créneau (session `rec008-8f2b28-new-01`)

Un message `Je prends le 1.` sur la session créée en 8F-2B28. Transition `GET_AVAILABILITY` → `CREATE_APPOINTMENT` / `ASK_NOM`, UUID résolu, contexte métier conservé. **Aucune tentative, aucun CLAIM, aucun POST.**

Verdict : **PASS**  
GO/NO-GO collecte du nom : **GO**

Artefacts : `n8n/proposed/2026-10-31-rec008-phase8f2b29-SLOT-SELECTION/`  
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
| Session | `rec008-8f2b28-new-01` |
| Intent / pending | `GET_AVAILABILITY` |
| Service / site / dates | PASSEPORT / PARIS / `2026-11-03` |
| Créneau n°1 | `33333333-3333-4333-8333-333333333333` |
| Identité / `slot_id` | vides |
| Tentatives liées | 0 |

## 3. Message envoyé

Exactement : `Je prends le 1.` — un seul message, même `sessionId`.

## 4. Réponse HTTP

| Mesure | Valeur |
| --- | --- |
| Activation | 200 ; version `e1b32992-…` seule active |
| Message | **200** ; 64 843 ms ; **aucun retry** |
| Désactivation | immédiate ; `activeVersionId = null` |

## 5. Réponse chatbot

| Champ | Valeur |
| --- | --- |
| `type` | `create_appointment_question` |
| `conversationStep` | `ASK_NOM` |
| `claimAcquired` / `ready` | false / false |
| Texte | demande uniquement le **nom** |
| Redemande service/site/dispo | non |

## 6. État PostgreSQL après sélection

| Champ | Après |
| --- | --- |
| `intent` / `pending_action` | `CREATE_APPOINTMENT` |
| `conversation_step` | `ASK_NOM` |
| `slot_id` | `33333333-3333-4333-8333-333333333333` |
| `selected_slot_index` | `1` |
| Identité | toujours vide |
| Compteurs | `1\|9\|2\|0` ; 0 tentative sur la session |

## 7. Conservation service / site / dates

PASSEPORT / PARIS / `2026-11-03`–`2026-11-03` conservés ; `available_slots` toujours présent (1 créneau).

## 8. UUID du créneau sélectionné

`33333333-3333-4333-8333-333333333333` — conforme au créneau n° 1 mémorisé.

## 9. Absence de CLAIM / POST

`claimAcquired = false` ; 0 tentative ouverte/nouvelle ; mock POST toujours **1** ; GET availability Δ = 0 ; pas de cancel/reschedule.

## 10. Désactivation

Workflow inactif ; VC **8** ; graphe et Finaliser SHA inchangés ; 0 webhook actif.

## 11. Intégrité sessions historiques

Autres sessions (empreinte) inchangées. `rec008-8f2b14-new-01` toujours `REC008-MOCK-0001`. Tentatives CONFIRMED / ABANDONED inchangées.

## 12. LIVE et Mailpit

Empreinte LIVE et Mailpit inchangés.

## 13. Verdict

**PASS**

## 14. GO/NO-GO

**GO** pour la collecte du nom sur `rec008-8f2b28-new-01`, après autorisation distincte.

Arrêt ici — attendre autorisation distincte.
