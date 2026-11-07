# EXPLICIT-RESUME-FIX-008 — candidat local

Correctif minimal hors ligne : message de reprise explicite (`reprendre` / allowlist VC9) **non collecté** comme donnée métier après TTL expiré.

## Fichiers canoniques

| Fichier | Rôle |
| --- | --- |
| `before-OCD9It1uKFhOoWNF.json` | Copie VC9 (SHA `6284f867…`) |
| `after-OCD9It1uKFhOoWNF.json` | **Candidat** patché (SHA `849201dd…`) |
| `SHA256.md` / `DIFF.md` / `JUSTIFICATION.md` | Empreintes et justification |
| `STATIC-VALIDATION.md` | Validation statique |

**Candidat ≠ installé TEST. Pas VC10.**

## Install readiness (offline, mission 009)

Procédures **non exécutées** : dossier [`install-readiness/`](./install-readiness/)  
(checklist PUT futur, backup/SHA/rollback/escalade, STOP, stubs throw-if-main).  
Miroirs : `tests/rec008/runtime/*-FIX008-INSTALL*`.

## Tests

```bash
node tests/rec008/scripts/run-fix-008.cjs
```

Exécute le jsCode du candidat (pas une copie du correctif dans les tests).
