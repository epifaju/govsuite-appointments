# Diagnostic rétention exécutions n8n TEST (lecture seule — 021)

## Constats croisés

| Source | `saveDataSuccessExecution` | `execution_entity` / REST |
| --- | --- | --- |
| 8F-2B46/47 (baseline) | **`none`** (volontaire) | liste vide attendue (soft-delete succès) |
| DIAG-016 / 017 | rétention nulle observée | **0** lignes |
| OLLAMA-020 | API settings **`all`** | **0** lignes |

Compose TEST (`docker-compose.rec008-test.yml`) : **aucune** variable `EXECUTIONS_DATA_*` / prune — la source de vérité est le **settings store** n8n (sqlite volume `rec008_n8n_data`).

## Cause

**INCONCLUSIVE entre :**

1. **Historique `saveData*=none`** — les succès webhook ne sont pas listés (cause confirmée en 8F-2B46).
2. **Flip récent vers `all` sans exécution webhook depuis** — count reste 0 faute de nouveaux runs.
3. **Prune / soft-delete** non visible dans compose (défaut n8n ou job interne) — non prouvé dans 021 (stack TEST majoritairement Down ; pas de probe sqlite runtime).

**Confirmé :** l’UI/API `saveData*=all` **ne garantit pas** des traces exploitables (`execution_entity=0` en 020).  
**Confirmé historiquement :** `saveData*=none` ⇒ absence d’exécutions REST **attendue**.

## Configuration TEST proposée (future mission + auth — **pas appliquée ici**)

1. Backup settings workflow + SHA.  
2. PUT temporaire : `saveDataSuccessExecution=all`, `saveDataErrorExecution=all`, `saveExecutionProgress=true` (optionnel).  
3. Env optionnelle (si autorisée Docker) : `EXECUTIONS_DATA_PRUNE_MAX_AGE=24` / désactiver prune pendant la fenêtre.  
4. Campagne R0x bornée.  
5. Postflight : restaurer `saveData*=none` (baseline), purge IDs campagne, vérifier count.

## Corrélation

`runToken` + `sessionIdHash` (runner 021) ↔ fenêtre horodatée activate/chat/deactivate ↔ `/api/ps` ↔ PG `updated_at` ↔ (si rétention) `executionId`.

Sans rétention : s’appuyer sur PG + Ollama + classifyPostflight (jamais PASS sur webhooks seuls).
