# GOVSUITE-MULTIAGENT-N8N-REST-TRANSPORT-DIAG-014 — Rapport

Diagnostic de l’échec transport `GET /rest/workflows/OCD9It1uKFhOoWNF` survenu en mission **013** (après préflight PASS, avant activate).

**TEST uniquement. GET/HEAD de diagnostic. Aucune activation. Aucun chat. Aucun R01–R03. Aucune mutation PG. Aucun Docker mutate. Aucun LIVE. Aucune modification du workflow FIX-008.**

**Verdict mission : PASS** (défaut runner **confirmé** + correctif minimal + tests offline)  
**Étiologie réseau socket-close 013 : INCONCLUSIVE** (non reproduite)  
**GO/NO-GO future campagne R01–R03 : GO conditionnel** (autorisation humaine + préflight frais ; **pas** auto)  
**Phase suivante auto : non autorisée**

Artefacts : `n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/runtime-013/diag-014/`

---

## 1. Préflight

| Contrôle | Observé | OK |
| --- | --- | --- |
| 5 conteneurs `govsuite-rec008-test` | Up (postgres healthy, mock, n8n, publish `5682`, ollama) | oui |
| Relais publish | `127.0.0.1:5682→5682` ; image `node:24-alpine` ; `proxy.mjs` TCP | oui |
| `/healthz` | 200 `{"status":"ok"}` | oui |
| GET REST unauth | 401 `Unauthorized` (endpoint joignable) | oui |
| Workflow FIX-008 | non modifié ; inactive (contrôles 013/devops) | oui |
| Fingerprint PG | `1\|14\|4\|0` | oui |
| Fixtures R013 | conservées (pas de DELETE) | oui |
| LIVE | non touché | oui |

---

## 2. Analyse de l’incident 013

| Fait | Preuve |
| --- | --- |
| Préflight campagne **PASS** | `artifacts/preflight.json` |
| Échec au premier `getWorkflow` de `runScenario` (R01) | `campaign-fatal.json` stack → L278 / L571 |
| Avant `activate` / avant chat | `activationPerformed=false`, `messageSent=false` |
| Erreur machine | `TypeError: fetch failed` |
| `cause.code` dans fatal | **absent** (`detail: null`) |
| Implémentation fautive | `getWorkflow` = **bare `fetch`** (hors `fetchOnce`, sans try/catch) |
| Double login | `login()` faisait fetchOnce **puis** un 2ᵉ POST login |

Le FATAL 013 est donc d’abord un **défaut de gestion d’erreur du runner** : un incident transport a été transformé en exception non structurée, sans postflight de sécurité automatisé.

---

## 3. Logs et erreurs techniques (expurgés)

| Source | Résultat |
| --- | --- |
| `docker logs` publish/n8n fenêtre 20:35–20:45Z | **vide** (pas de trace applicative utile) |
| Publish StartedAt | `2026-11-05T20:11:00Z` ; RestartCount `0` |
| `proxy.mjs` | relais **TCP brut** `pipe` bidirectionnel ; `destroy` sur erreur ; **pas** de couche HTTP |
| healthz `Connection` | réponse `keep-alive` (sonde P1) |

Aucun secret / cookie / mot de passe dans les artefacts diag-014.

---

## 4. Résultats des sondes GET

Fichier : `diag-014/PROBES.json` (GET/HEAD only ; **0** login POST).

| ID | Kind | Résultat |
| --- | --- | --- |
| P1 | global-fetch healthz | 200 ; `Connection: keep-alive` |
| P2×5 | http keep-alive healthz | 200 |
| P3×3 | fresh + `Connection: close` | 200 |
| P4a/b/c | idle 4s / 15s reuse | 200 (socket-close **non** reproduit) |
| P5 | REST unauth GET | 401 |
| P6 | busy 2.5s puis REST unauth | 401 |
| P7 | HEAD healthz | 200 |

**Limite :** pas de sonde REST **authentifiée** (POST `/rest/login` hors périmètre strict DIAG-014). L’endpoint REST répond ; l’échec 013 n’est pas un « service down » permanent.

---

## 5. Cause racine

### A. Défaut runner — **CONFIRMÉ**

1. `getWorkflow` / `getActiveIds` en `fetch` nu → throw sur fermeture socket.  
2. Perte de `cause.code` / `errno` dans `campaign-fatal`.  
3. Double login inutile (surface d’erreur élargie).  
4. `main().catch` sans `safetyPostflight` ni `safeDeclared` conditionné à une vérif.

### B. Fermeture socket réseau 013 — **INCONCLUSIVE**

- Hypothèse plausible (renforcée devops) : keep-alive client vs n8n `Keep-Alive: timeout=5` + **proxy TCP non HTTP-aware** après gap préflight (docker exec / busy ~10s entre REST préflight et GET R01).  
- **Non reproduite** à coup sûr par les sondes actuelles (idle 15s OK en conditions calmes).  
- **Docker non prouvé** comme cause (conteneurs Up, RestartCount 0, healthz OK) — [devops-engineer](f629af30-0ab9-4bde-bf9c-96f967006d94).

---

## 6. Modifications locales

Fichier unique : `runtime-013/run-runtime-013.js`

| Changement | Détail |
| --- | --- |
| `restHeaders` / `Connection: close` | toutes les requêtes `fetchOnce` |
| `errInfo` | conserve `cause.code` (sans secrets) |
| `getWorkflow` / `getActiveIds` | via `fetchOnce` ; `transportError` ; **pas de throw** |
| Pré-activate | transport → verdict **UNCERTAIN**, stop scénario |
| Login | **un seul** POST |
| `safetyPostflight` | écrit toujours ; `safeDeclared=true` **seulement** si vérifié inactive + webhooks 0 |
| Activate / chat | toujours **0 retry** |

Non modifié : workflow n8n, fixtures PG, Docker, FIX-008 installé.

---

## 7. Tests offline

`diag-014/offline-transport-tests.js` → `OFFLINE-TEST-RESULTS.json` : **pass=true**

| Test | OK |
| --- | --- |
| T1 errInfo cause.code | oui |
| T2 fetchOnce no-throw on destroy | oui |
| T3 Connection: close success | oui |
| T4 single attempt / retried=false | oui |
| T5 contrats source runner | oui |
| T6 observation keep-alive vs close | oui |

---

## 8. Vérifications d’intégrité

| Contrôle | Résultat |
| --- | --- |
| Fingerprint PG | `1\|14\|4\|0` inchangé |
| Fixtures R013 | non supprimées |
| Workflow / version | non mutés |
| Activate / chat / R0x | **0** |
| LIVE | **0** |
| Docker mutate | **0** |

---

## 9. Evidence Reviewer et délégations

| Agent | Verdict / décision |
| --- | --- |
| [govsuite-planner](a7e66ef8-6a41-481b-a1d1-9bde16d82369) | **GO** diagnostic only ; fix si cause prouvée ; phase suivante non autorisée |
| [devops-engineer](f629af30-0ab9-4bde-bf9c-96f967006d94) | **PASS** inspection ; Docker **non** cause prouvée ; H1 keep-alive vs `Keep-Alive: timeout=5` + proxy TCP silencieux = plus probable |
| [n8n-developer](3380e56a-8134-44e3-b91b-2fc67fc53464) | Throw locus **confirmé** ; keep-alive **likely** ; patch proposé (parent **appliqué** ensuite dans `run-runtime-013.js`) |
| [security-auditor](b3184dd5-76ed-4e36-aca8-3238922b8dc5) | Isolation / PII / zero-retry **PASS** |
| [postgres-engineer](9b5a5681-dd5d-41c9-aad0-d4e12d60b1dd) | Empreinte `1\|14\|4\|0` ; non-mutation **PASS** |
| [qa-automation](ce5bec19-b01a-49cb-8bd4-832826459a35) | Offline transport **PASS** (gaps mineurs T2 cause.code live / postflight comportemental) |
| [evidence-reviewer](0ceb275c-b1a0-40ca-979b-3e4cb3e6defa) | Mission diag **PASS** ; réseau keep-alive **INCONCLUSIVE** ; R0x **NO-GO** sans auth humaine + préflight frais |

**Note parent :** le patch runner DIAG-014 est **appliqué** dans `runtime-013/run-runtime-013.js` (contrairement au libellé « not applied » du livrable n8n-developer / drift `DIAG-014-FINDINGS.md`).

**Alignement final :** Evidence + QA + security + postgres + devops + planner — cohérents avec §10–§11 (PASS diag / INCONCLUSIVE réseau / GO conditionnel R0x hors mission).

---

## 10. Verdict

| Couche | Verdict |
| --- | --- |
| Mission DIAG-014 (diagnostic + hardening runner + offline) | **PASS** |
| Cause réseau exacte de l’incident 013 | **INCONCLUSIVE** |
| Validation métier FIX-008 (R0x) | **non évaluée** (hors périmètre) |

---

## 11. GO/NO-GO future campagne R01–R03

| Décision | Statut |
| --- | --- |
| Relancer R01–R03 dans **cette** mission | **NO-GO** (interdit) |
| Future campagne runtime dédiée | **GO conditionnel** |
| Conditions | autorisation humaine écrite ; préflight frais PASS (healthz, inactive, SHA/version, fingerprint, TTL fixtures) ; runner DIAG-014 ; 0 retry ; activate→1 msg→deactivate |
| Rollback FIX-008 | non indiqué |
| Cleanup fixtures | toujours différé tant que runtime UNCERTAIN / non rejoué |
| Phase suivante auto | **non autorisée** |

---

## Références

- `GOVSUITE_MULTIAGENT_ASK_PRENOM_RUNTIME_013_REPORT.md`
- `GOVSUITE_MULTIAGENT_TEST_INSTALL_RETRY_012_REPORT.md`
- `GOVSUITE_MULTIAGENT_TEST_STACK_RECOVERY_011_REPORT.md`
- `runtime-013/run-runtime-013.js` (post DIAG-014)
- `runtime-013/artifacts/campaign-fatal.json` / `preflight.json`
- `publish/proxy.mjs`
- `AGENTS.md` / `govsuite-safety.mdc`
