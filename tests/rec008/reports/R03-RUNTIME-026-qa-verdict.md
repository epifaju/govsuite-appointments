# R03-RUNTIME-026 — Verdict QA

**Verdict : PASS**  
**R01 / R02 / auto-next : NO-GO**

## Assertions

| Id | Attendu | Observé | Verdict |
| --- | --- | --- | --- |
| R03-H01 | HTTP 200 | 200 / create_appointment_question | PASS |
| R03-M01 | TTL+ | ttlAfter=true | PASS |
| R03-M02 | step `ASK_PRENOM` | ASK_PRENOM | PASS |
| R03-M03 | `prenom` null | null | PASS |
| R03-M04 | `nom` préservé | Dupont | PASS |
| R03-M06 | ask prénom ; pas `session_expired` | invite prénom ; type≠session_expired | PASS |
| R03-A02 | `mockPostsDelta=0` | 0 | PASS |
| zeroRetry | `retried=false` | false | PASS |

## HTTP vs métier

- Transport : **PASS** (HTTP 200).
- Métier : **PASS** (reprise `reprendre` → TTL+, prénom null, step ASK_PRENOM, invite prénom, aucun CreateAppointment).
- HTTP 200 ≠ succès métier automatique ; ici les deux concordent.

## Gates

| Gate | Décision |
| --- | --- |
| R03 métier | **PASS** (clos) |
| R01 | **NO-GO** |
| R02 | **NO-GO** |
| Phase suivante | **NO-GO** |
| LIVE | **NO-GO** |

Preuves : `n8n/proposed/.../runtime-013/artifacts-r03-026/`  
Artefact JSON : `tests/rec008/readiness/R026-r03-runtime-qa-verdict.json`
