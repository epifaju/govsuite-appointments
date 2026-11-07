# TEST-INSTALL-READINESS-009 — Gate SQL inchangé (FIX-008)

Mode : **offline / proposition locale** — aucun `psql`, Docker, mutation, LIVE.

## Verdict gate

| Contrôle | Résultat |
| --- | --- |
| Nœuds Postgres diff before → after | **0** |
| Seul nœud différant | `Gérer collecte progressive` (`jsCode` only) |
| SQL Charger / Sauvegarder divergé ? | **NON** |
| Action | **CONTINUE** (pas de STOP SQL) |

## Empreintes bit-identiques (before = after)

| Nœud | Paramètres SHA-256 | Query SHA-256 |
| --- | --- | --- |
| `Charger état conversation` | `fca043913c5a27f7cc1e82261f8a1908a43ee8ad9d356eabec9de68a5f97ff8b` | `ba174e1e632f19e3ec9ddfbad1762fac7543340c1f98967f8050070527dabcb7` |
| `Sauvegarder état conversation` | `7c8597781429d7c282e69b908ae28bebcb97f6a84650423cfbd48b67fef00387` | `0f864cbcfb1995154042212a34b761d8ae2ec0cbe88de072e2323d524e5b6439` |

Sources comparées : `before-OCD9It1uKFhOoWNF.json` vs `after-OCD9It1uKFhOoWNF.json` (candidat `849201dd…`).

## Règle STOP (future install / revue)

Si un re-hash post-candidat montre `query` ou `parameters` Charger/Sauvegarder **≠** empreintes ci-dessus → **STOP** mission install / campagne runtime. Aucune migration SQL n’est attendue pour FIX-008.

## Rollback SQL

**N/A** — aucune migration métier proposée ; rollback = restaurer export `before-` (nœud Gérer uniquement).

## Verdict analyse offline

**PASS** — SQL Charger/Sauvegarder inchangé ; gate CONTINUE.
