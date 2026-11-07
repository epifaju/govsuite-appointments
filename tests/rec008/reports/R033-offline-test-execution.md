# R033 — Exécution tests offline (candidat exact)

Date : 2026-11-06. Node local. **Aucun** HTTP n8n / Ollama / PG / Docker / LIVE / PUT / chat.

## Objectif

Fermer la lacune matrice 032 : R01/R02 étaient **VC9 harness** seulement ; 033 les exécute sur le candidat exact W-031-01 (`44a7064d…`).

## Commandes

```text
node tests/rec008/unit/w03101-install-readiness-033.test.cjs
node tests/rec008/unit/artifact-hygiene-r032.test.cjs
```

## Résultats

| Suite | Passed | Failed | Verdict | Pin |
| --- | --- | --- | --- | --- |
| `w03101-install-readiness-033` | 16 | 0 | **PASS** | Gerer `44a7064d…` / file `57e08d22…` |
| `artifact-hygiene-r032` | 8 | 0 | **PASS** | S06/S07/S08/T03 |

Logs : `R033-offline-candidate-run.txt`, `R033-offline-hygiene-run.txt`.

## Couverture candidat exact

| ID | Verdict | Critère clé |
| --- | --- | --- |
| Pin SHA | **PASS** | id/134/active=false ; 4 remplacements ; non-resume sans `?? x.email` |
| R01 | **PASS** | Camille → ASK_EMAIL ; claim/post/create = false ; observed hygiène OK |
| R02 | **PASS** | session_expired ; prenom non capturé ; TTL− ; Δ claim 0 |
| R03 | **PASS** | reprendre + allowlist |
| R04-A | **PASS** | ASK_TELEPHONE ; emailPresent ; Δ0 |
| R04-B | **PASS** | ASK_EMAIL ; email absent ; Δ0 |
| R04-C | **PASS** | emailPresent=false ; saveEmailPresent=false ; TTL− |
| R04-D | **PASS** | TTL+ ; email null |
| R04-E | **PASS** | email préservé ; observed expurgé |
| R04-F | **PASS** | telephonePresent=false |
| Hygiene | **PASS** | S06–S08/T03 FAIL attendu ; FP UUID PASS |

Matrice : `docs/recovery/REC008_R04_W03101_COVERAGE_MATRIX.md`.

## Gates

| Gate | Décision |
| --- | --- |
| Couverture offline candidat | **PASS** |
| Install TEST | **NO-GO** |
| R04-RUNTIME | **NO-GO** |
| LIVE | **NO-GO** |

Correctif : **non installé**. Batterie verte ≠ autorisation phase suivante.
