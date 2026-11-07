# Postflight install FIX-008 — pointeur runtime

Canonique : `n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/install-readiness/POSTFLIGHT.md`

1. Toujours inactif (`active=false`, webhooks 0) — hardStop si échec
2. SHA after = candidat `849201dd…` / jsCode Gérer `f75d4984…`
3. Seul nœud Gérer modifié vs backup
4. Mock / PG / LIVE / Mailpit = ancres préflight
5. Verdict PASS/FAIL/UNCERTAIN — pas d’activation ni S0x auto
6. Timeout transport → UNCERTAIN, **pas de retry PUT**
