# MISSION 035 — Fixtures SQL R04-A/B/C (NON APPLIQUÉES)

**Verdict docs : PASS**  
**Statut exécution : NOT_RUN** — aucun `psql`, aucune mutation PG.

## Règle absolue

**NE PAS APPLIQUER** ces scripts sans autorisation runtime humaine distincte (préflight + postflight + mission seed dédiée).  
LIVE interdit. Pas d’auto-next. Pas de POST CreateAppointment.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `seed-r04-a.sql` | UPSERT ASK_EMAIL TTL actif — `rec008-r04a-035-active-ask-email` |
| `seed-r04-b.sql` | UPSERT ASK_EMAIL TTL actif — `rec008-r04b-035-active-ask-email` |
| `seed-r04-c.sql` | UPSERT ASK_EMAIL TTL expiré — `rec008-r04c-035-expired-ask-email` |
| `verify-r04-select.sql` | SELECT Present/Len only (contrat R031) |
| `cleanup-r04.sql` | DELETE commenté, ids R04-035 uniquement |

Contrat assertions : `tests/rec008/readiness/R031-r04-abc-sql-contract.json`.

Miroir catalogue : `tests/rec008/fixtures/r04-runtime-readiness-035/sql/README.md`.

## État initial commun (A/B ; C = TTL expiré)

- `conversation_step = ASK_EMAIL`
- `nom` / `prenom` présents (synthétiques Dupont / Camille)
- `email` / `telephone` = NULL
- OPTION A : `slot_id` présent (UUID `4444…301/302/303`)
- `openAttempts = 0` (pas d’INSERT attempt)
- A/B : `expires_at = NOW() + 2 hours` → `ttlActive`
- C : `expires_at = NOW() - 1 hour` → `sessionExpired`

## Isolation vs R01–R03 (conflit évité)

| Famille | session_id | Notes |
| --- | --- | --- |
| R01 runtime | `rec008-runtime013-r01-active` | ASK_PRENOM — **ne pas toucher** |
| R02 runtime | `rec008-runtime013-r02-expired` | ASK_PRENOM expiré — **ne pas toucher** |
| R03 runtime | `rec008-runtime013-r03-resume` | ASK_PRENOM resume — **ne pas toucher** |
| R04-A 035 | `rec008-r04a-035-active-ask-email` | nouveau préfixe `rec008-r04*-035-*` |
| R04-B 035 | `rec008-r04b-035-active-ask-email` | idem |
| R04-C 035 | `rec008-r04c-035-expired-ask-email` | idem |

Slots OPTION A R04 utilisent `4444…` (distinct des `3333…301/302/303` R01–R03).

## PII / preuves

- Seeds : noms synthétiques OK ; emails `@example.test` **uniquement** en commentaire seed (chat futur), jamais dans verify/preuves.
- Verify : **Present / Len** uniquement — pas de SELECT clair email/téléphone/message.
- Cleanup : filtre strict sur les 3 ids R04-035 ; corps DELETE commenté `NOT AUTHORIZED`.

## Gates

| Gate | Décision |
| --- | --- |
| Docs / fixtures SQL locales | **PASS** |
| SQL execution | **NOT_RUN** |
| R04-RUNTIME | **NO-GO** |
| LIVE | **NO-GO** |
| Auto-next | **NO-GO** |
