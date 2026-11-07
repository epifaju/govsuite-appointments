# Matrice commandes — install FIX-008 (pointeur)

Canonique : `n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/install-readiness/COMMAND-MATRIX.md`

**L** lecture ; **E** écriture (ordre humain requis). Fenêtre : **1 PUT**, **0 retry**, **0 activation**, **0 chat**.

| Domaine | L OK (futur) | E interdit sans ordre |
| --- | --- | --- |
| Docker | `ps`, logs | compose mutate, prune, ports |
| n8n TEST | GET / export | PUT (1× si autorisé), activate, chat, CreateAppointment |
| PG | SELECT counts | UPDATE/INSERT/migration ; toute LIVE |
| Scripts `*.stub.cjs` | — | `throw` si `main` |

Offline autorisé : `node tests/rec008/scripts/run-fix-008.cjs` (≠ install).
