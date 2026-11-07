# Banc de tests REC-008 (offline)

Industrialisé en **TEST-RUNNER-003**. Node.js natif uniquement.

## Principes

- Source de vérité code : `n8n/proposed/...P4F.../after-OCD9It1uKFhOoWNF.json` (**VC9**, SHA épinglé).
- Exécution = **simulation VM** du `jsCode` + classifieurs HTTP + **attempt-sim** + SQL statique — **pas** une preuve runtime n8n/PostgreSQL.
- `skeletonOnly: true` → **NOT_IMPLEMENTED** (jamais PASS). Couverture 004 : 22 scénarios branchés.
- Les PASS avec `runtimeRequired: true` restent des preuves **partielles** (voir rapport COVERAGE-004).
- Verdicts : PASS / FAIL / ERROR / INCONCLUSIVE / NOT_IMPLEMENTED / SKIPPED.
- Guards : block `fetch`/http/https, block `require('pg')`, allowlist écriture `reports/` + `tmp/`.

## Commandes

```bash
node tests/rec008/scripts/run-self-tests.cjs
node tests/rec008/scripts/run-offline.cjs
```

Exit code ≠ 0 si FAIL/ERROR ou scénario **required** non implémenté.

## READINESS-005 (P4G2 futur — non exécuté)

Catalogue d’assertions runtime `PASS` / `FAIL` / `UNCERTAIN` pour une future rejouée P4G2 (`rec008-8f2b1-slot-01` + `chatInput=reprendre`) :

- `tests/rec008/readiness/R005-p4g2-explicit-resume-assertions.json`
- Classifieur pur (hors réseau) : `tests/rec008/lib/assertions/readiness-005-p4g2.cjs`
- Preuves offline déjà OK : scénario `T03-explicit-resume` (partiel VM)
- Runtime requis : HTTP200, type réponse, TTL PG, intent/pending/step, draft, CLAIM=0/POST=0, deactivate

Self-test catalogue uniquement :

```bash
node tests/rec008/unit/readiness-005-p4g2.test.cjs
```

**Ne pas** activer n8n ni envoyer de webhook tant que non autorisé.

## Références

- `docs/recovery/GOVSUITE_MULTIAGENT_TEST_RUNNER_003_REPORT.md`
- `AGENTS.md` / `.cursor/rules/govsuite-safety.mdc`
