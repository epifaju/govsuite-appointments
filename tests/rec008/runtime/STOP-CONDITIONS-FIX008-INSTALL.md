# STOP conditions — install FIX-008 (pointeur)

Canonique : `n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/install-readiness/STOP-CONDITIONS.md`

Fail-fast. **0 retry.** Mission 009 n’exécute rien.

## Codes critiques (extrait)

| Code | Quand |
| --- | --- |
| `auth-missing` | Pas d’ordre install explicite |
| `test-live-confusion` | Mélange TEST/LIVE |
| `baseline-sha-mismatch` | Export ≠ VC9 `6284f867…` |
| `candidate-sha-mismatch` | after ≠ `849201dd…` |
| `backup-missing` | Pas de backup avant PUT |
| `workflow-active-unexpected` | Déjà actif |
| `second-put` / `timeout-or-transport` | Retry ou ambigu → UNCERTAIN |
| `activate` | Activation pendant install |
| `after-sha-mismatch` | Postflight SHA KO |
| `phase-auto-advance` | Activation / chat auto |

Halt + artefact sans PII/secrets. Escalade : `install-readiness/BACKUP-SHA-ROLLBACK.md`.
