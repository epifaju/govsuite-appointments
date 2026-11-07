# REC-008 phase 8F-2B37 — Nouvelle session TEST : consultation des disponibilités

Un seul message de disponibilités sur `rec008-8f2b37-new-01`. Activation temporaire uniquement. **Aucune tentative, aucun CLAIM, aucun POST CreateAppointment.**

Verdict : **PASS**  
GO/NO-GO sélection de créneau sur cette session : **GO**

Artefacts : `n8n/proposed/2026-10-31-rec008-phase8f2b37-NEW-SESSION-AVAILABILITY/`  
(`PREFLIGHT.json`, `RESULT.json`, `response.txt`, `run.js`)

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow | inactif, `activeVersionId = null` |
| Version / compteur | `e1b32992-…` / **8** |
| Graphe / Finaliser | 134 / 137 ; SHA `3fc500bf…` |
| Credentials / URL / isolation | TEST / 10 mock / OK |
| PostgreSQL | **1 / 9 / 3 / 0** ; 0 ouverte |
| Tentatives | 1 ABANDONED + 1 CONFIRMED + 1 EXPIRED |
| Session `rec008-8f2b37-new-01` | **absente** |
| Sessions historiques présentes | `rec008-8f2b14-new-01`, `rec008-8f2b28-new-01` (non réutilisées) |
| Mock baseline | `created` ; POST **0** ; GET availability **1** |
| LIVE / Mailpit | `a2dea067…` ; 5 / 2 / 98 304 |

Note mock : GET availability = 1 avant le chat = **sonde préflight lecture seule** du jeu mock (créneau PASSEPORT/PARIS). Documentée ; delta métier attendu = **+1** sur le message.

## 2. Vérification de la nouvelle session

Identifiant : `rec008-8f2b37-new-01` — inexistant avant activation. Distinct de `rec008-8f2b28-new-01` et `rec008-8f2b14-new-01`.

## 3. Vérification du jeu de données

PostgreSQL `creneaux` (lecture seule) :

| Champ | Valeur |
| --- | --- |
| Id | `33333333-3333-4333-8333-333333333333` |
| Service / site | PASSEPORT / PARIS |
| Début / fin | 2026-11-03 09:00–09:30 +01 |
| Capacité / réservées / statut | 2 / 0 / DISPONIBLE |

## 4. Message exact

`Je souhaite connaître les disponibilités pour un passeport à Paris du 03/11/2026 au 03/11/2026.`  
`sessionId = rec008-8f2b37-new-01` — aucun second message.

## 5. Réponse HTTP et durée

| Mesure | Valeur |
| --- | --- |
| Activation | 200 ; version `e1b32992-…` seule active |
| Message | **200** ; **45 432 ms** |
| Désactivation | immédiate ; webhooks = 0 |

## 6. Disponibilités retournées

`type = availability` ; 1 créneau :

| Champ | Valeur |
| --- | --- |
| Index | **1** |
| UUID | `33333333-…` |
| Service / site | PASSEPORT / PARIS |
| Date / horaire | mardi 03/11/2026 · 09:00–09:30 |
| Places | **2** |

Pas de demande d’identité. Pas de récapitulatif de réservation. Invitation à sélectionner (non effectuée).

## 7. État PostgreSQL

Session `rec008-8f2b37-new-01` :

| Champ | Valeur |
| --- | --- |
| Intent / pending | `GET_AVAILABILITY` |
| Service / site / dates | PASSEPORT / PARIS / `2026-11-03` |
| `available_slots` | 1 créneau persisté (index 1, UUID attendu, 2 places) |
| `slot_id` / identité / référence | absents |
| Tentatives liées | **0** |

Compteurs : **1 / 10 / 3 / 0** ; 0 ouverte.

## 8. Compteurs mock avant/après

| Appel | Avant | Après | Δ |
| --- | --- | --- | --- |
| GET availability | 1 | **2** | **+1** |
| POST CreateAppointment | 0 | 0 | 0 |
| Cancel / reschedule | — | absents | — |

## 9. Absence de CLAIM / POST

Aucune tentative créée ; POST Δ = 0 ; pas de confirmation de création.

## 10. Intégrité des sessions historiques

Empreinte des 9 sessions hors nouvelle session **inchangée**. Tentatives ABANDONED / CONFIRMED / EXPIRED **inchangées**. `rec008-8f2b14-new-01` toujours `REC008-MOCK-0001`.

## 11. Intégrité LIVE / Mailpit

Inchangés. Workflow inactif ; VC **8** ; Finaliser SHA et graphe inchangés.

## 12. Verdict

**PASS**

## 13. GO/NO-GO

**GO** pour sélectionner le créneau index 1 sur `rec008-8f2b37-new-01`, sous **autorisation distincte**.

Arrêt ici.
