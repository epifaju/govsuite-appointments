# MISSION 031 — Matrice commandes (rétention temporaire)

**Docs only.** Aucune commande E exécutée en 031.

Plan : `docs/recovery/REC008_N8N_EXECUTION_RETENTION_TEMP_PLAN_031.md`  
Ancre : `docs/recovery/REC008_N8N_EXECUTION_RETENTION_DIAG.md`

## Lecture (L)

| Action | Danger |
| --- | --- |
| `docker ps` / `inspect` filtre `rec008` TEST | L |
| `printenv` filtre `EXECUTIONS` conteneur TEST | L |
| sqlite `DatabaseSync(..., {readOnly:true})` count | L |
| `GET /healthz`, `/rest/settings`, `/rest/workflows/OCD9It1uKFhOoWNF`, `/rest/executions` | L |
| SHA-256 fichier backup settings local | L |

## Écriture (E) — future mission auth seulement

| Action | Danger |
| --- | --- |
| Backup écrit + PUT workflow `saveData*=all` | E |
| Restauration PUT `saveData*=none` (depuis backup) | E |
| Purge executions TEST par ID | E |
| Ajout `EXECUTIONS_DATA_*` + recreate | E+STOP |
| activate / chat / CreateAppointment | E (R04, pas 031) |
| Toute action `govsuite-n8n` (LIVE) | E+STOP |

## STOP 031

Pas de PUT, pas de purge, pas de Docker change, pas de LIVE dans cette mission.
