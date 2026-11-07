# REC-008 — Checklist pré-install W-031-01 (033)

| # | Contrôle | Statut 033 |
| --- | --- | --- |
| 1 | Candidat ID `OCD9It1uKFhOoWNF` | **PASS** |
| 2 | 134 nœuds / 137 arêtes | **PASS** |
| 3 | Seul Gerer jsCode modifié ; 4 remplacements | **PASS** |
| 4 | SHA Gerer = `44a7064d…` ; file = `57e08d22…` | **PASS** |
| 5 | Pas creds/URL/trigger drift | **PASS** |
| 6 | TEST Up ; healthz `:5682` ok | **PASS** |
| 7 | Workflow inactive ; webhooks 0 ; running 0 | **PASS** |
| 8 | VC **10** ; versionId `fd75ba32…` | **PASS** |
| 9 | Gerer TEST actuel = FIX-008 `f75d4984…` | **PASS** |
| 10 | openAttempts 0 | **PASS** |
| 11 | FP PG noté (`1\|14\|4\|0` — drift sessions R0x vs 012) | **PASS** (écart documenté) |
| 12 | Offline R01–R03 + R04-A…F + hygiene sur candidat | **PASS** (11/0) |
| 13 | Risques persistance `last_user_message` documentés | **PASS** docs |
| 14 | Runbook + rollback rédigés | **PASS** (non exécutés) |
| 15 | LIVE non contacté | **PASS** |
| 16 | Auth humaine install | **ACCORDÉE** (mission 034) |
| 17 | Méthode = jsCode Gerer only (pas import full candidate) | **Respectée** (034) |

**Readiness install TEST (033) :** **GO**.  
**Installation effective (034) :** **PASS / YES** — Gerer `44a7064d…` · VC11 · inactive.  
**R04-RUNTIME / LIVE :** **NO-GO**.
