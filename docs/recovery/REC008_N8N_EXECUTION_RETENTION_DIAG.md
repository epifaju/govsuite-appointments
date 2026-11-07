# REC-008 — Diagnostic rétention exécutions n8n TEST

Mission **EVIDENCE-OBSERVABILITY-030**. **Lecture seule.** Aucun PUT settings. Aucun changement Docker / `EXECUTIONS_DATA_*`. Aucun LIVE.

Artefacts runtime : `n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/runtime-013/diag-030-retention/`.

---

## 1. Faits observables (030)

| Fait | Statut |
| --- | --- |
| Projet Compose `govsuite-rec008-test` (fichier 8E-2B-2) Up ; n8n `2.32.6` ; publish `127.0.0.1:5682` | **Confirmé** |
| Conteneur env : **aucune** variable `EXECUTIONS_DATA_*` / prune | **Confirmé** (`printenv` + compose) |
| Volume `govsuite-rec008-test_rec008_n8n_data` → `/home/node/.n8n` | **Confirmé** |
| sqlite `execution_entity` = **0** ; `deletedAt` soft = **0** ; `execution_data` / `metadata` = **0** | **Confirmé** (probe readOnly) |
| `GET /healthz` → ok ; API login 200 | **Confirmé** |
| Instance `/rest/settings` : `saveDataSuccessExecution=all`, `saveDataErrorExecution=all` | **Confirmé** |
| Workflow `OCD9It1uKFhOoWNF.settings` : `saveDataSuccessExecution=none`, `saveDataErrorExecution=none`, `saveManualExecutions=false` | **Confirmé** |
| `GET /rest/executions` (running / all / workflow) : status 200, count **0** | **Confirmé** |
| Workflow `active=false`, `running=0` | **Confirmé** |
| LIVE (`govsuite-n8n`) | **Non sondé / non touché** |

---

## 2. Hypothèses `execution_entity=0`

| ID | Hypothèse | Statut |
| --- | --- | --- |
| **H1** | Settings **workflow** `saveData*=none` → succès non retenus (soft-delete / non listés) | **Confirmée** (API workflow 030 + historique 8F-2B46) |
| **H4** | Confusion **instance** `/rest/settings=all` vs **workflow.settings=none** (faux positif « all » en 020–023) | **Confirmée** |
| **H5** | API `running` opérationnelle ≠ archive historique | **Confirmée** |
| **H2** | Flip instance `all` sans run depuis → count 0 | **Réfutée** comme cause principale (le workflow n’est pas en `all`) |
| **H3** | Env compose `EXECUTIONS_DATA_*` prune trop agressif | **Réfutée** (variables **absentes**) |
| **H3b** | Prune hard interne défaut n8n post soft-delete | **Inconclusive** (tables vides compatibles ; non isolé) |
| **H6** | Bug silencieux n8n 2.32.6 | **Inconclusive** (comportement cohérent avec H1) |

**Cause principale :** rétention désactivée au **niveau workflow** (`saveData*=none`), pas un trou d’env prune compose. Les lectures 020–023 sur les settings **instance** ont masqué ce fait.

---

## 3. Compose / env (matrice)

| Variable | Compose TEST | Conteneur runtime |
| --- | --- | --- |
| `EXECUTIONS_DATA_SAVE_ON_SUCCESS` | absente | absente |
| `EXECUTIONS_DATA_SAVE_ON_ERROR` | absente | absente |
| `EXECUTIONS_DATA_PRUNE*` / `MAX_AGE` | absente | absente |
| `saveData*` | n/a (store n8n) | instance `all` / workflow `none` |

---

## 4. Preuves alternatives (inchangées)

Sans archive nœud : PG `updated_at` + fingerprint, Ollama `/api/ps`, poll `running`, deactivate webhooks, `classifyPostflight`. Ne pas FAIL métier uniquement faute de `/rest/executions` historique.

---

## 5. Remédiation future (hors 030 — auth requise)

1. Backup workflow settings + SHA  
2. PUT **workflow** temporaire `saveData*=all` (pas seulement instance)  
3. Fenêtre campagne bornée  
4. Postflight restaurer `none` + purge IDs  
5. Ne pas committer payloads PII  

**Non fait en 030.** Plan détaillé optionnel (docs only, non exécuté) : [`REC008_N8N_EXECUTION_RETENTION_TEMP_PLAN_031.md`](./REC008_N8N_EXECUTION_RETENTION_TEMP_PLAN_031.md) (MISSION 031).
---

## 6. STOP

- Toucher LIVE  
- PUT `saveData*` / env `EXECUTIONS_DATA_*` sans mission auth  
- compose recreate / prune volume  
- activate / chat / CreateAppointment  
- retry auto après timeout  

---

## 7. Verdict

| Périmètre | Verdict |
| --- | --- |
| Diagnostic lecture seule 030 | **PASS** |
| Cause principale `execution_entity=0` | **Confirmée** (workflow `saveData*=none`) |
| Contribution prune hard interne | **UNCERTAIN** / Inconclusive (secondaire) |
