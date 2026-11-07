# REC-008 phase 8F-2B38 — Sélection contrôlée du créneau (session `rec008-8f2b37-new-01`)

Un message `Je prends le 1.` sur la session créée en 8F-2B37. Transition `GET_AVAILABILITY` → `CREATE_APPOINTMENT` / `ASK_NOM`, UUID résolu, contexte métier conservé. **Aucune tentative, aucun CLAIM, aucun POST.**

Verdict : **PASS**  
GO/NO-GO collecte du nom : **GO**

Artefacts : `n8n/proposed/2026-10-31-rec008-phase8f2b38-SLOT-SELECTION/`  
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

## 2. État initial

| Champ | Valeur |
| --- | --- |
| Session | `rec008-8f2b37-new-01` |
| Intent / pending | `GET_AVAILABILITY` |
| Service / site / dates | PASSEPORT / PARIS / `2026-11-03` |
| Créneau n°1 | `33333333-…` · 09:00–09:30 · 2 places |
| `slot_id` / identité | vides |
| Tentatives liées | 0 |

## 3. Message unique

Exactement : `Je prends le 1.` — aucun retry.

## 4. Réponse HTTP et durée

| Mesure | Valeur |
| --- | --- |
| Activation | 200 ; version `e1b32992-…` seule active |
| Message | **200** ; **13 825 ms** |
| Désactivation | immédiate ; webhooks = 0 |

## 5. Étape conversationnelle

| Champ | Valeur |
| --- | --- |
| `type` | `create_appointment_question` |
| `conversationStep` | **`ASK_NOM`** |
| Texte | « Quel est votre **nom** ? » uniquement |
| `ready` / `claimAcquired` | **false** / **false** |
| Annonce RDV confirmé | non |

## 6. État PostgreSQL

| Champ | Après |
| --- | --- |
| `intent` / `pending_action` | `CREATE_APPOINTMENT` |
| `conversation_step` | `ASK_NOM` |
| `slot_id` | `33333333-3333-4333-8333-333333333333` |
| `selected_slot_index` | `1` |
| Identité | vide |
| Tentatives session | **0** |
| Compteurs | `1\|10\|3\|0` |

## 7. Conservation du contexte

PASSEPORT / PARIS / `2026-11-03`–`2026-11-03` conservés ; `available_slots` toujours 1 créneau (index 1, UUID attendu, 2 places).

## 8. Absence de CLAIM / POST

Mock POST Δ = **0** ; GET availability Δ = **0** ; 0 tentative ouverte/nouvelle ; pas de cancel/reschedule.

## 9. Intégrité historique

Empreinte des autres sessions inchangée. Tentatives ABANDONED / CONFIRMED / EXPIRED inchangées. `rec008-8f2b14-new-01` toujours `REC008-MOCK-0001`.

## 10. Intégrité LIVE / Mailpit

Inchangés. Workflow inactif ; VC **8** ; Finaliser SHA et graphe inchangés.

## 11. Verdict

**PASS**

## 12. GO/NO-GO

**GO** pour la collecte du nom sur `rec008-8f2b37-new-01`, sous **autorisation distincte**.

Arrêt ici.
