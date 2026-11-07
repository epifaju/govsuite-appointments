# Fixtures R04 — offline readiness 031

Synthétiques uniquement (`synthetic: true`). Domaine email autorisé : `@example.test`.  
Contrat : `docs/recovery/REC008_R04_FIXTURE_CONTRACT.md`.  
Réutilisées par R035 (`../r04-runtime-readiness-035/`) pour replay offline post-install W-031-01.

**Interdit :** appliquer ces fixtures en PostgreSQL sans mission runtime autorisée.

| ID | Fichier | Message | Attendu |
| --- | --- | --- | --- |
| R04-A | `r04-a-valid-email-state.json` | `camille.r04a@example.test` | → `ASK_TELEPHONE` |
| R04-B | `r04-b-invalid-email-state.json` | `pas-un-email` | reste `ASK_EMAIL` |
| R04-C | `r04-c-expired-ask-email-state.json` | `camille.r04c@example.test` (TTL expiré) | pas de capture |
