# MISSION 030 — Matrice commandes (rétention)

## Lecture (autorisée / exécutée)

| Action | Danger |
| --- | --- |
| `docker ps` filtre `rec008` | L |
| `docker inspect` env / labels / mounts TEST | L (ne pas logger secrets) |
| `printenv` filtre `EXECUTIONS` dans conteneur TEST | L |
| sqlite `DatabaseSync(..., {readOnly:true})` count | L |
| `GET /healthz`, login, `/rest/settings`, `/rest/workflows/{id}`, `/rest/executions` | L |

## Écriture (interdite sans auth distincte)

| Action | Danger |
| --- | --- |
| PUT workflow / settings `saveData*` | E |
| Ajout `EXECUTIONS_DATA_*` + recreate | E |
| compose up/down/recreate/prune/volume rm | E |
| activate / chat / CreateAppointment | E |
| Toute action sur `govsuite-n8n` (LIVE) | E+STOP |
