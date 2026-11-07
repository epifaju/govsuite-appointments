# TEST-INSTALL-010 — STOP préflight

**Verdict : FAIL** (préflight KO). **Halt.** Aucun PUT.

## Constat

| Contrôle | Résultat |
| --- | --- |
| `http://127.0.0.1:5682` TCP | `TcpTestSucceeded=false` |
| healthz | fail |
| Conteneur n8n TEST rec008 (5682) | **ABSENT** (`docker ps`) |
| SHA candidat local `849201dd…` | OK (fichier seulement) |
| Docker mutate | **non effectué** (restriction) |
| PUT / activation / LIVE | **non effectués** |

## Artefacts

| Fichier | Rôle |
| --- | --- |
| `STOP.json` | Halt — `connectivity` / `test-stack-down` |
| `PREFLIGHT.json` | `preflightOk=false` + checks documentés |
| `README.md` | ce rappel |

## Règles

1. **Ne pas** `docker compose up` / recreate / prune sans autorisation distincte.
2. **Ne pas** PUT tant que préflight KO.
3. **Ne pas** toucher LIVE.
4. **0 retry** réseau — fail-fast.
5. Reprise uniquement après stack TEST joignable + préflight PASS + autorisation PUT écrite.

Réf. STOP : `../install-readiness/STOP-CONDITIONS.md` (`connectivity`).
