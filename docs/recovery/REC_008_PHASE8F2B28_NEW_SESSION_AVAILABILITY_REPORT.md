# REC-008 phase 8F-2B28 — Nouvelle session TEST : consultation des disponibilités

Un seul message de disponibilités sur `rec008-8f2b28-new-01` après install Finaliser (8F-2B26) et réconciliation historique (8F-2B27). Activation temporaire uniquement. **Aucune tentative, aucun CLAIM, aucun POST CreateAppointment.**

Verdict : **PASS**  
GO/NO-GO sélection de créneau sur cette session : **GO**

Artefacts : `n8n/proposed/2026-10-31-rec008-phase8f2b28-NEW-SESSION-AVAILABILITY/`  
(`PREFLIGHT.json`, `RESULT.json`, `response.txt`, `run.js`)

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow | inactif, `activeVersionId = null` |
| Version / compteur | `e1b32992-bc68-46af-86ce-c80af46f5305` / **8** |
| Graphe | 134 / 137 |
| Finaliser SHA | `3fc500bf…` |
| Credentials / URL / isolation | TEST / 10 mock / OK |
| PostgreSQL TEST | 1 / 8 / 2 / 0 ; 0 ouverte |
| Session `rec008-8f2b14-new-01` | ref `REC008-MOCK-0001` ; step/pending/token NULL |
| Mock POST | **1** |
| LIVE / Mailpit | `a2dea067…` ; 5 / 2 / 98 304 |
| Session `rec008-8f2b28-new-01` | **absente** |

## 2. Identifiant de session

`rec008-8f2b28-new-01` (nouvelle, non historique).

## 3. Message envoyé

Exactement un message :

`Je souhaite connaître les disponibilités pour un passeport à Paris du 03/11/2026 au 03/11/2026.`

Aucun second message, aucun `oui`, aucune sélection, aucune identité.

## 4. Activation temporaire

`POST .../activate` → **200**. `activeVersionId = e1b32992-…`. Seul workflow actif. Webhooks chat GET/POST présents.

## 5. Réponse HTTP

| Mesure | Valeur |
| --- | --- |
| HTTP | **200** |
| Durée | 48 532 ms |
| Retry message | **aucun** |

## 6. Réponse conversationnelle

`type = availability`. Texte listant 1 créneau PASSEPORT / PARIS (03/11/2026 09:00–09:30) avec invitation à sélectionner un numéro — **sélection non effectuée**.

## 7. Données extraites

| Champ | Valeur |
| --- | --- |
| Index | **1** |
| Id | `33333333-3333-4333-8333-333333333333` |
| Service / site | PASSEPORT / PARIS |
| Places | 2 |

Session PG : `intent/pending = GET_AVAILABILITY` ; dates `2026-11-03` ; `available_slots` mémorisé ; `slot_id` / identité vides.

## 8. Appels mock observés

| Appel | Δ |
| --- | --- |
| GET `/appointments/availability` | **+1** (1 → 2) |
| GET `/services` | 0 |
| POST CreateAppointment | **reste 1** |
| Cancel / reschedule | absents |

## 9. État PostgreSQL

| Compteur | Après |
| --- | --- |
| RDV / sessions / tentatives / notifs | **1 / 9 / 2 / 0** |
| Tentatives sur nouvelle session | **0** |
| Tentatives ouvertes | **0** |

## 10. Absence de CLAIM / POST

Aucune nouvelle tentative ; POST mock toujours à 1 ; pas de demande de confirmation de création.

## 11. Désactivation

Immédiate après le message : `active = false`, `activeVersionId = null`, webhooks 0. VersionCounter **8**, Finaliser SHA inchangé, graphe 134/137.

## 12. Intégrité sessions historiques

Empreinte des 8 sessions hors nouvelle session inchangée. `rec008-8f2b14-new-01` toujours réconciliée (`REC008-MOCK-0001`, step/pending vides). Tentatives CONFIRMED / ABANDONED inchangées.

## 13. LIVE et Mailpit

GovSuite LIVE empreinte inchangée. Mailpit 5 / 2 / 98304.

## 14. Verdict

**PASS**

## 15. GO/NO-GO

**GO** pour la sélection du créneau sur `rec008-8f2b28-new-01`, après autorisation distincte.

Arrêt ici — attendre autorisation distincte.
