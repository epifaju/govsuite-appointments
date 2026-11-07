# Préflight install FIX-008 — pointeur runtime

Canonique : `n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/install-readiness/PREFLIGHT.md`

Mission **TEST-INSTALL-READINESS-009** — **non exécuté**.

## Rappel STOP si échec

1. Cible TEST `127.0.0.1:5682` uniquement — pas LIVE
2. Workflow `OCD9It1uKFhOoWNF` inactif ; webhooks 0
3. Baseline VC9 SHA `6284f867…f82b889` ; `versionId=e7867799…` ; counter 9
4. Candidat local SHA `849201dd…` vérifié **avant** PUT
5. Backup documenté ; URLs → `rec008-mock` ; PG TEST
6. Mock / open / LIVE ancre / Mailpit OK
7. Autorisation humaine **install seule** ; **0 retry**
