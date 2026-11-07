# REC-008 — Checklist préflight R04-RUNTIME (035)

**R04-RUNTIME :** **NOT_AUTHORIZED** (prep only).

| # | Contrôle | Statut 035 |
| --- | --- | --- |
| 1 | TEST `:5682` / `govsuite-rec008-test` | **PASS** |
| 2 | LIVE non contacté | **PASS** |
| 3 | VC **11** · versionId `f5a9181f-ff8d-4301-976e-57add79badae` | **PASS** |
| 4 | Gerer SHA `44a7064d…` (W-031-01) | **PASS** |
| 5 | 134 / 137 · `active=false` | **PASS** |
| 6 | webhooks 0 · running 0 · openAttempts 0 | **PASS** |
| 7 | FP PG `1\|14\|4\|0` documenté | **PASS** |
| 8 | Offline R04-A/B/C + R01–R03 sur export installé | **PASS** (9/0) |
| 9 | Runner stub 180 s / 1 msg / 0 retry / refuse exécution | **PASS** |
| 10 | SQL seeds préparés **non appliqués** | **PASS** |
| 11 | Artefact sample redacted + hygiene | **PASS** |
| 12 | `saveData*=none` (pas d’ouverture rétention) | **PASS** (recommandation) |
| 13 | Auth humaine R04-RUNTIME | **OUVERT** |
| 14 | Seed apply + activate + chat | **NO-GO** jusqu’à auth |

**Readiness R04 (prep) :** voir rapport 035.  
**R04-A / B / C (future runtime) :** GO conditionnel sous auth — **NOT_AUTHORIZED** maintenant.  
**R05–R07 / LIVE :** **NO-GO**.
