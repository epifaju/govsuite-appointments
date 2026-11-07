# R02-RUNTIME-025 — Verdict QA

**Verdict : PASS**  
**R03 / auto-next : NO-GO**

## Assertions

| Id | Attendu | Observé | Verdict |
| --- | --- | --- | --- |
| R02-H01 | HTTP 200 + `session_expired` | 200 / session_expired | PASS |
| R02-M01 | `prenom` null | null | PASS |
| R02-M02 | step `ASK_PRENOM` (pas ASK_EMAIL) | ASK_PRENOM | PASS |
| R02-M03 | TTL non renouvelé | ttlAfter=false | PASS |
| R02-M05 | `mockPostsDelta=0` | 0 | PASS |
| zeroRetry | `retried=false` | false | PASS |

## HTTP vs métier

- Transport : **PASS** (HTTP 200).
- Métier : **PASS** (`session_expired`, prénom non capturé, step inchangé, aucun CreateAppointment).
- HTTP 200 ≠ succès métier automatique ; ici les deux concordent.

## Gates

| Gate | Décision |
| --- | --- |
| R02 métier | **PASS** (clos) |
| R03 | **NO-GO** |
| Phase suivante | **NO-GO** |
| LIVE | **NO-GO** |

Artefact JSON : `tests/rec008/readiness/R025-r02-runtime-qa-verdict.json`
