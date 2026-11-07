# REC-008 phase 8F-2B49-P2 — Sélection du créneau (préparation CONV-07)

Un message `Je prends le 1.` sur `rec008-8f2b49-edit-01` (après P1). Transition `GET_AVAILABILITY` → `CREATE_APPOINTMENT` / `ASK_NOM`, UUID résolu, contexte métier conservé. **Aucune tentative, aucun CLAIM, aucun POST CreateAppointment.**

Verdict : **PASS**  
GO/NO-GO 8F-2B49-P3 (collecte du nom) : **GO**

Artefacts : `n8n/proposed/2026-11-01-rec008-phase8f2b49-P2-SLOT-SELECTION/`  
(`PREFLIGHT.json`, `RESULT.json`, `response.txt`, `run.js`)

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow `OCD9It1uKFhOoWNF` | inactif, `activeVersionId = null` |
| Version / compteur | `e1b32992-…` / **8** |
| Graphe / Finaliser | 134 / 137 ; SHA `3fc500bf…` |
| Autres actifs / webhooks | 0 / 0 |
| URLs métier | 10 × `rec008-mock` |
| PostgreSQL | **1 / 11 / 4 / 0** ; 0 ouverte |
| Statuts | ABANDONED 1, CONFIRMED 2, EXPIRED 1 |
| Mock | `created` ; POST **1** ; GET availability **3** |
| LIVE / Mailpit | `13\|14\|12\|48\|0\|a2dea067…` ; 5 / 2 / 98 304 |

Session cible avant message :

| Champ | Valeur |
| --- | --- |
| Intent / pending | `GET_AVAILABILITY` |
| Service / site / dates | PASSEPORT / PARIS / `2026-11-03` |
| `available_slots` | 1 créneau index 1 · `33333333-…` · 09:00–09:30 |
| `slot_id` / identité | absents |
| Tentatives liées | 0 |

## 2. Connectivité

Base `http://127.0.0.1:5682` uniquement :

| Probe | Résultat |
| --- | --- |
| TCP `127.0.0.1:5682` | OK |
| GET `/healthz` | **200** |
| GET `/healthz/readiness` | **200** |

## 3. Message unique

Activation 200 ; webhook chat GET+POST enregistrés. Warmup GET : **200**.

Exactement : `Je prends le 1.`  
`sessionId = rec008-8f2b49-edit-01` — aucun retry, aucun second message.

## 4. Réponse HTTP

| Mesure | Valeur |
| --- | --- |
| HTTP | **200** |
| Durée | **66 005 ms** |
| `type` | `create_appointment_question` |
| `conversationStep` | **`ASK_NOM`** |
| `ready` / `claimAcquired` | **false** / **false** |
| Texte | « Quel est votre **nom** ? » |
| Transport | aucune erreur |

Aucune confirmation de réservation.

## 5. Créneau sélectionné

| Champ | Valeur |
| --- | --- |
| Index | **1** |
| `slot_id` | `33333333-3333-4333-8333-333333333333` |
| `selected_slot_index` | `1` |
| Service / site / horaire | PASSEPORT / PARIS / 09:00–09:30 |

## 6. Session persistée

| Champ | Après |
| --- | --- |
| Intent / pending | `CREATE_APPOINTMENT` |
| `conversation_step` | `ASK_NOM` |
| Service / site / dates | PASSEPORT / PARIS / `2026-11-03` (conservés) |
| `available_slots` | 1 créneau conservé (UUID attendu) |
| Identité / référence / token | absents |
| Tentatives session | **0** |
| Compteurs PG | `1\|11\|4\|0` |

## 7. Contrôles anti-réservation

| Contrôle | Résultat |
| --- | --- |
| Nouvelle tentative | non |
| CLAIM | non (`claimAcquired=false`, `attemptAction=COLLECT`) |
| POST CreateAppointment | Δ = 0 |
| Nouveau RDV / notification | non |

## 8. Compteurs mock

| Appel | Avant | Après | Δ |
| --- | --- | --- | --- |
| GET availability | 3 | 3 | **0** |
| POST CreateAppointment | 1 | 1 | **0** |
| Cancel / reschedule | — | absents | — |
| Scénario | `created` | `created` | — |

## 9. Désactivation

Immédiate : `active=false`, `activeVersionId=null`, webhooks **0**, VC **8**, graphe et SHA Finaliser inchangés.

## 10. Intégrité LIVE / Mailpit

LIVE `a2dea067599fd4f0a5f857551adc67cc` inchangé. Mailpit 5 / 2 / 98 304 inchangé. Empreintes tentatives / RDV / autres sessions inchangées.

## 11. Verdict

**PASS**

## 12. GO/NO-GO

**GO** pour **8F-2B49-P3** : collecte du nom (`Dupont`) sur `rec008-8f2b49-edit-01`, sous **autorisation distincte**.

Restrictions respectées. Arrêt ici. Attente d’une nouvelle autorisation.
