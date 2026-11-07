# GOVSUITE-MULTIAGENT-TEST-STACK-RECOVERY-022 — Rapport

Récupération contrôlée de l’environnement Docker **TEST** `govsuite-rec008-test` (4× Exited 255) puis contrôles d’intégrité n8n VC10 / PG / runner 021.

**TEST uniquement. `docker start` des conteneurs existants uniquement. Aucune recréation. Aucun compose up/down. Aucun volume/réseau modifié. Aucun PUT. Aucune activation. Aucun Chat Trigger. Aucune inférence Ollama. Aucune mutation PG. Aucun LIVE. Aucune campagne R0x.**

**Verdict mission : PASS**  
**Cause d’arrêt : INCONCLUSIVE** (preuve root OS absente) — classification opérationnelle **arrêt runtime Docker non propre** (haute confiance, pattern 011)  
**TTL R01 : `TTL_REFRESH_REQUIRED=true`** (pas de refresh dans 022)  
**Préparation future R01 : GO-CONDITIONAL** (stack Up + VC10 OK ; TTL refresh + warm Ollama en missions/auth distinctes)  
**Campagne R01 conversationnelle : NO-GO**  
**Phase suivante auto : non autorisée**

Artefacts : `n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/stack-recovery-022/`

---

## 1. État initial

| Conteneur | Status | Exit | FinishedAt (UTC) |
| --- | --- | --- | --- |
| `…-postgres-1` | Exited | **255** | `2026-11-06T17:45:27.524Z` |
| `…-mock-1` | Exited | **255** | `2026-11-06T17:45:27.528Z` |
| `…-n8n-1` | Exited | **255** | `2026-11-06T17:45:27.528Z` |
| `…-publish-1` | Exited | **255** | `2026-11-06T17:45:27.528Z` |
| `…-ollama-1` | **Up** | (restart `unless-stopped`) | même fenêtre puis relance |

`OOMKilled=false`, `State.Error` vide. Port `127.0.0.1:5682` libre. LIVE non sondé.

IDs avant : voir `CONTAINERS-BEFORE.txt` (mêmes IDs après start).

---

## 2. Cause d’arrêt

| Hypothèse | Statut |
| --- | --- |
| Arrêt non propre Docker Desktop / moteur | **Retenue opérationnellement** (exit 255 simultané ±10 ms ; ollama seul survit via `unless-stopped` ; logs sans crash) |
| Crash applicatif isolé | **Écartée** |
| OOM | **Écartée** (`OOMKilled=false`) |
| Preuve OS / event Desktop | **Absente** → root cause formelle **INCONCLUSIVE** |

Ne pas attribuer 255 à un crash n8n/PG sans journal applicatif.

---

## 3. Préflight d’isolation

| Contrôle | Résultat |
| --- | --- |
| Projet Compose | `govsuite-rec008-test` |
| Config file | `…/2026-10-30-rec008-phase8e2b2-TEST-DEPLOY/docker-compose.rec008-test.yml` |
| DB | `govsuite_rec008_test` |
| Volumes | `…_postgres_data`, `…_n8n_data`, `…_ollama_data` — **pas** LIVE |
| Réseaux | `rec008_test` internal ; publish `127.0.0.1:5682` |
| Compose mutate / recreate | non |
| Workflow actif avant arrêt | dernières preuves 021 : inactive (stack Down) |
| Ambiguïté isolation | **Aucune** → **GO** `docker start` |

---

## 4. Actions Docker exécutées

Ordre (`COMMANDS.json`) :

1. `docker start govsuite-rec008-test-rec008-postgres-1`  
2. `docker start govsuite-rec008-test-rec008-mock-1`  
3. `pg_isready` (accepting)  
4. `docker start govsuite-rec008-test-rec008-n8n-1`  
5. `docker start govsuite-rec008-test-rec008-publish-1`  

**Non exécuté :** compose up/down, recreate, prune, volume rm, start LIVE, restart ollama (déjà Up).

---

## 5. Identifiants conteneurs avant / après

| Conteneur | ID (inchangé) |
| --- | --- |
| mock | `e78b3670752e…1f09b1` |
| ollama | `fe1f98b94da2…dea5fd` |
| publish | `4eb6226d3e46…257d0a0` |
| n8n | `9296af917abe…260cd1` |
| postgres | `cc245dd588ad…0e1878d` |

Aucune recréation (IDs stables).

---

## 6. État final des services

| Service | Status |
| --- | --- |
| postgres | Up **healthy** |
| mock | Up ; `_meta/calls` joignable via réseau interne |
| n8n | Up ; healthz **200** via `:5682` |
| publish | Up `127.0.0.1:5682->5682` |
| ollama | Up ; tags `qwen2.5:1.5b` via `rec008-ollama:11434` |
| Volumes / réseaux | inchangés |

---

## 7. Intégrité n8n VC10

| Contrôle | Observé |
| --- | --- |
| Workflow | `OCD9It1uKFhOoWNF` |
| `active` | **false** |
| `activeVersionId` | **null** |
| `versionCounter` | **10** |
| `versionId` | `fd75ba32-f018-40e4-9f79-8f2a5400320b` |
| Gérer SHA | `f75d4984…a26917fe` |
| Nœuds / arêtes | **134** / **137** |
| Webhooks | **0** |
| Exécutions running | **0** |

Aucune activation.

---

## 8. Intégrité PostgreSQL

Empreinte `1|14|4|0` ; `openAttempts=0`.

| Session | step | pending | slot | prenom null | Camille | slots |
| --- | --- | --- | --- | --- | --- | --- |
| r01-active | ASK_PRENOM | CREATE_APPOINTMENT | oui | oui | non | 1 |
| r02-expired | ASK_PRENOM | CREATE_APPOINTMENT | oui | oui | non | 1 |
| r03-resume | ASK_PRENOM | CREATE_APPOINTMENT | oui | oui | non | 1 |

Dates `2026-11-10`→`2026-11-14` ; nom présent. **Aucune mutation.**

---

## 9. État des TTL

| Session | `ttl_future` au contrôle |
| --- | --- |
| R01 | **false** (`expires_at` ≈ 2026-11-06 01:05+01) |
| R02 | false (attendu) |
| R03 | false (attendu) |

**`TTL_REFRESH_REQUIRED=true`** pour R01. Refresh **interdit** dans 022 → mission/auth distincte avant campagne.

---

## 10. Intégrité runner 021

| Contrôle | OK |
| --- | --- |
| SHA AFTER `1ab9465a…ac5826` | oui |
| Gate Ollama / timeout 180 s / zéro retry | oui |
| `classifyPostflight` / settle / running exec | oui |
| Offline tests 021 | 18/18 (rejoués) |
| Exécution Chat Trigger | **non** |

---

## 11. Observabilité

| Élément | Valeur |
| --- | --- |
| `saveDataSuccessExecution` | `all` |
| `saveDataErrorExecution` | `all` |
| `execution_entity` (sqlite) | **0** |
| API `/rest/executions` | HTTP 200 ; running=0 |
| Écart settings vs traces | **persistant** (INCONCLUSIVE root — voir 021) |
| Mutation settings | **non** |

---

## 12. Avis des agents

| Agent | Avis |
| --- | --- |
| [govsuite-planner](ffbe66b8-dd4a-453b-9da7-9fedb41b1f71) | **GO** diagnostic + `docker start` ; **NO-GO** R01 ; phase suivante non autorisée |
| [devops-engineer](1b436dbf-34a8-41a7-a46b-0e5a52ce8e99) | **PASS** GO conditionnel start (ordre postgres→mock→pg_isready→n8n→publish) ; pattern 011 |
| [postgres-engineer](36cca272-67fa-4986-9c6b-ea61e1e9aff7) | **PASS** fixtures ; FP `1\|14\|4\|0` ; `TTL_REFRESH_REQUIRED` ; `pgMutated=false` |
| [n8n-developer](ef251100-ce2d-44a9-9432-0ba670b27004) | **PASS** VC10 inactive ; SHA FIX-008 ; webhooks/running 0 |
| [security-auditor](387eb615-db5b-4a0e-953d-5b35404a9692) | **PASS** isolation — start IDs TEST only ; `liveProbed=false` ; pas recreate/activate/PG mutate |
| [qa-automation](03e008b7-77a8-4cdd-8c22-b90de61227d8) | **PASS** recovery/offline ; R01 **NO-GO** (`TTL_REFRESH_REQUIRED`) ; prep **GO-CONDITIONAL** |
| [evidence-reviewer](2e8557ab-b89a-4ff3-9d84-160b2ee3f1e3) | Recovery **PASS** ; cause OS **INCONCLUSIVE** ; R01 **NO-GO** ; prep **GO-CONDITIONAL** |

---

## 13. Verdict Evidence Reviewer

[evidence-reviewer](2e8557ab-b89a-4ff3-9d84-160b2ee3f1e3) — **PASS** recovery (IDs stables, VC10, FP, runner SHA). Cause OS et gap `execution_entity=0` : **UNCERTAIN/INCONCLUSIVE**. Campagne R01 **NO-GO** (`TTL_REFRESH_REQUIRED`). Prep **GO-CONDITIONAL** (TTL + warm + préflight frais). Claims mock/tags/offline 18/18 du rapport parent : hors preuves JSON 022 → à reconfirmer en préflight suivant. Phase suivante **non autorisée**.

---

## 14. Verdict

**PASS** — stack TEST restaurée par `docker start` ; intégrité n8n/PG/runner vérifiée en lecture.

**UNCERTAIN/INCONCLUSIVE** : cause OS exacte du 255 ; trou `execution_entity=0` malgré `saveData*=all`.

---

## 15. GO / NO-GO préparation R01

| Gate | Décision |
| --- | --- |
| Stack TEST opérationnelle | **GO** |
| Préparation campagne R01 (préflight frais) | **GO-CONDITIONAL** — conditions : refresh TTL R01 autorisé + warm Ollama `/api/ps` + runner 021 + préflight VC10 |
| Campagne conversationnelle R01 | **NO-GO** |

**Arrêt après ce rapport. Aucune mission suivante lancée.**
