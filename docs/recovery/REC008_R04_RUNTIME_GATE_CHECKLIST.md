# REC-008 — Checklist gate R04-RUNTIME (non exécuté)

Mission 031. **R04-RUNTIME = NO-GO** jusqu’à autorisation humaine distincte.

---

## Prérequis prep (031 → 035)

| # | Contrôle | Statut |
| --- | --- | --- |
| 1 | Scanner hygiene H-01…H-09 vert | **PASS** |
| 2 | Fixtures R04-A/B/C synthétiques | **PASS** |
| 3 | Assertions offline A/B | **PASS** |
| 4 | R04-C safety (expired, Δ0) | **PASS** |
| 5 | Contrat email null sur expired | **PASS** (W-031-01 **installé** 034 · Gerer `44a7064d…`) |
| 6 | Contrat redaction 030 | **PASS** docs |
| 7 | STOP R04–R07 documentés | **PASS** (029) |
| 8 | Readiness runtime prep 035 (VC11 · runner stub · SQL non appliqué) | **PASS** · runtime **NOT_AUTHORIZED** |

---

## Avant tout chat R04 (futur)

- [ ] Autorisation humaine écrite R04-RUNTIME  
- [ ] Préflight TEST `:5682`, **VC11**, versionId `f5a9181f…`, Gerer `44a7064d…`, `liveTouched=false`  
- [ ] W-031-01 installé (034) confirmé  
- [ ] Workflow `saveData*` : plan rétention optionnel autorisé séparément (sinon rester `none`)  
- [ ] Fixture seed ASK_EMAIL OPTION A (`diag-035/sql/` — pas apply implicite)  
- [ ] Email synthétique `@example.test` uniquement  
- [ ] 1 message ; `retried=false` ; timeout 180 s post-warm  
- [ ] Mock Δ POST/CLAIM = 0  
- [ ] Postflight : deactivate, webhooks 0, running 0, settle late-write  
- [ ] Artefacts expurgés + scanner hygiene sur `artifacts-r04-*`  
- [ ] **Pas** d’auto-next R05  

---

## Toujours NO-GO

LIVE · CLAIM · POST CreateAppointment · R06/R07 runtime · mutate rétention sans auth
