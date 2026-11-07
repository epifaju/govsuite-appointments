# COVERAGE-004 OFFLINE — Simulation `ai_appointment_attempt`

**Mode :** pure JS, aucune DB réelle, aucun `psql`, aucun POST CreateAppointment.

**Sources :** `postgres/migrations/20261030_rec008_attempts.sql`, `20261029_rec007_idempotence.sql`, `docs/recovery/REC_008_TEST_MATRIX.md` (C7 C8 C9 C11 C12), machine d’états VC9 (`Décider action tentative` + mapping HTTP).

## 1. Analyse

### Couche tentative (lease)

| Opération SQL | Sémantique simulée | Race |
|---|---|---|
| `reclamer_tentative_rendez_vous` | `AWAITING_CONFIRMATION` → `SUBMITTING` + bail 90 s | Un seul `acquired=true` ; le second voit statut ≠ AWAITING |
| `reprendre_tentative_rendez_vous` | `UNCERTAIN` ou `SUBMITTING` bail échu → `SUBMITTING`, `resume_count++` | Même mutex logique ; corps/clé inchangés |
| `marquer_tentative_incertaine` | `SUBMITTING` + owner valide → `UNCERTAIN`, bail effacé | Corps/clé conservés |
| `cloturer_tentative_rendez_vous` | `CONFIRMED` / `REJECTED` / `SLOT_UNAVAILABLE` / `ABANDONED` | Purge PII : `request_payload` et `idempotency_key` → null |

Index partiel unique session ouverte (`AWAITING|SUBMITTING|UNCERTAIN`) : une seule ligne ouverte par `session_id` dans le store simulé.

### Couche rendez-vous (idempotence HTTP)

| Issue SQL | HTTP simulé | `httpOutcome` n8n | Statut tentative |
|---|---|---|---|
| `CREATED` | 201 | `CONFIRMED` | `CONFIRMED` |
| `REPLAYED` | 200 `{replayed:true, created:false}` | `CONFIRMED` | `CONFIRMED` |
| `KEY_CONFLICT` | 409 `IDEMPOTENCY_KEY_CONFLICT` | `REJECTED` | `REJECTED` |
| `SLOT_UNAVAILABLE` | 409 message créneau | `SLOT_UNAVAILABLE` | `SLOT_UNAVAILABLE` |
| timeout / corps vide | status 0 / body null | `UNCERTAIN` | `UNCERTAIN` (via `markUncertain`) |

Empreinte : SHA-256 hex du JSON canonique `{slotId,nom,prenom,email,telephone,numeroDocument,langue}` (email lower). Hash clé RDV : SHA-256 de la clé brute (comme `cle_idempotence`).

### Matrice

| Case | Mécanisme | Attendu métier |
|---|---|---|
| **C7** | Après `CONFIRMED`, 2ᵉ AFFIRM → `RECALL` | Même référence, 0 second RDV, 0 second POST |
| **C8** | Deux `claimLease` concurrents | Une seule victoire `SUBMITTING`, un seul POST gagnant |
| **C9** | Timeout → `markUncertain` → `resumeLease` | Même clé + même corps figés ; `resume_count` +1 |
| **C11** | Même clé, empreinte différente | `KEY_CONFLICT` → `REJECTED` ; pas de nouvelle clé auto |
| **C12** | Créneau saturé / passé | `SLOT_UNAVAILABLE` ; 0 RDV pour cette clé |

## 2. Proposition

Fichiers locaux uniquement sous ce dossier :

- `attempt-sim.cjs` — API de fonctions pures (état immuable)
- `ASSERTIONS.json` — assertions attendues par case
- `run-self-check.cjs` — exécute les scénarios offline (Node, pas PG)

## 3. Risques (simulation ≠ preuve PG)

- Pas de vrai verrou de ligne / `FOR UPDATE` : la concurrence est **séquentielle déterministe** (premier appel gagne).
- Canonicalisation JSON ≠ `jsonb_build_object` PostgreSQL à l’octet près ; comparaison d’empreintes **interne** au sim.
- Ne valide pas les contraintes CHECK SQL ni les index partiels réels.
- Ne remplace pas une course `psql` 8D-2.

## 4. Contrôles de preuve (sans PII)

Compteurs : `appointmentCount`, `postCount`, `openAttemptCount`, `resumeCount`, `acquiredTrueCount`.  
Empreintes : égalité booléenne `sameKey`, `sameFingerprint`, `referenceStable` — jamais de dump email/téléphone.

## 5. Verdict préparation

**PASS** — modèle et assertions livrés hors ligne, alignés migrations + matrice C7/C8/C9/C11/C12.  
Non-preuve runtime PostgreSQL / n8n → toute validation LIVE/TEST DB reste **hors périmètre** de cette phase.
