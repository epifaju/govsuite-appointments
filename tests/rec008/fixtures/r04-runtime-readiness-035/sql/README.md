# R04 runtime readiness 035 — SQL catalogue pointer

Canonical fixtures (NON APPLIQUÉES) :

`n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/runtime-013/diag-035/sql/`

| session_id | scénario |
| --- | --- |
| `rec008-r04a-035-active-ask-email` | R04-A TTL actif |
| `rec008-r04b-035-active-ask-email` | R04-B TTL actif |
| `rec008-r04c-035-expired-ask-email` | R04-C TTL expiré |

Contrat SELECT Present/Len : `tests/rec008/readiness/R031-r04-abc-sql-contract.json`.

**NE PAS APPLIQUER** sans auth runtime. Isolation vs R01–R03 : préfixe `rec008-r04*-035-*` ≠ `rec008-runtime013-r0{1,2,3}-*`.

Verdict docs : **PASS** · SQL execution : **NOT_RUN** · R04-RUNTIME : **NO-GO**.
