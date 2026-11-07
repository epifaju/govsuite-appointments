# R031 — Rapport d’exécution tests offline

Date : 2026-11-06. Environnement : Node local. **Aucun** HTTP n8n / Ollama / PG / Docker / LIVE.

## Commandes

```text
node tests/rec008/unit/artifact-hygiene-r030.test.cjs
node tests/rec008/unit/r04-offline-readiness-031.test.cjs
```

## Résultats

| Suite | Passed | Failed | Verdict | Exit |
| --- | --- | --- | --- | --- |
| `artifact-hygiene-r030` | 20 | 0 | **PASS** | 0 |
| `r04-offline-readiness-031` | 4 | 0 | **PASS** | 0 |

Logs bruts : `R031-offline-hygiene-run.txt`, `R031-offline-r04-run.txt`.

## Couverture H-01…H-09

Tous **PASS** (voir suite hygiene).

## Couverture R04-A/B/C

| ID | Résultat |
| --- | --- |
| R04-A | PASS (→ ASK_TELEPHONE, Δ0, observed expurgé) |
| R04-B | PASS (reste ASK_EMAIL, Δ0) |
| R04-C | PASS safety ; anomalie **W-031-01** détectée (email mémoire sur expired) |

## Scanner

FAIL correct sur clair email/tél/Bearer ; PASS sur Present/Len/hash ; fixtures allowlist ; historiques SKIP ; unreadable → UNCERTAIN ; jamais de valeur sensible loguée.
