# GOVSUITE-MULTIAGENT-R01-RUNNER-READINESS-021 — Rapport

Durcissement local du runner R01 à partir des missions 015–020 (timeout, gate Ollama, late-write, observabilité, UNCERTAIN).

**TEST uniquement. Modifications locales runner uniquement. Aucun PUT. Aucune activation. Aucun Chat Trigger. Aucune inférence Ollama réelle. Aucune mutation PG. Aucun Docker mutate. Aucun CLAIM/POST CreateAppointment. Aucun LIVE. Aucune campagne R0x.**

**Verdict mission : PASS** (readiness runner hors ligne)  
**Préflight runtime stack : PARTIAL / non bloquant pour travail offline** (n8n/PG Down — pas de start autorisé)  
**Campagne R01 : NO-GO**  
**Phase suivante auto : non autorisée**

Artefacts : `n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/runtime-013/runner-021/`

---

## 1. Préflight

| Contrôle | Observé | OK |
| --- | --- | --- |
| Projet `govsuite-rec008-test` | 5 conteneurs présents | partiel |
| n8n / postgres / mock / publish | **Exited (255)** | non |
| Ollama | Up | oui |
| healthz `:5682` | **échec** (0) | non |
| Workflow VC10 / SHA / webhooks / attempts | **non sondés** (n8n Down) | n/a |
| LIVE | **non sondé** (`liveProbed=false`) | oui |

`PREFLIGHT.json` → `preflightOk=false`, `preflightPartial=true`. Aucun `compose up`. Travail limité au runner + tests offline (conforme périmètre 021).

---

## 2. Fichiers modifiés / ajoutés

| Fichier | Action |
| --- | --- |
| `runtime-013/run-runtime-013.js` | durci (gate, timeout, settle, classify, correlation) |
| `runner-021/BACKUP-run-runtime-013.before.js` | sauvegarde pré-modif |
| `runner-021/lib/ollama-gate.cjs` | gate pur `/api/ps` |
| `runner-021/lib/postflight-stability.cjs` | classes stabilité / late-write |
| `runner-021/offline-runner-readiness.test.cjs` | tests simulés |
| `runner-021/OBSERVABILITY-RETENTION-DIAG.md` | diagnostic rétention |
| `runner-021/R01-CONTRACT.md` | contrat PRD §6.2 |
| `runner-021/SHA-BEFORE.json` / `SHA-AFTER.json` | empreintes |
| `runner-021/OFFLINE-TEST-RESULTS.json` | résultats |

---

## 3. SHA avant / après

| | SHA-256 `run-runtime-013.js` |
| --- | --- |
| **Avant** | `4183a6a161709df3a3a140e960323ea7aca710548ab4a4176e411605f37196ba` |
| **Après** | `1ab9465a720aa64925e633e5665eea3bafbe42225ac3e728bceea9f177ac5826` |

Backup bit-identique au SHA avant (re-hash post-revue [evidence-reviewer](93f8c82b-19db-431e-9af5-9308c0886175) : `BACKUP-run-runtime-013.before.js` = `4183a6a1…` = `SHA-BEFORE.json`).

---

## 4. Description des modifications

1. **Timeout** : `CHAT_TIMEOUT_MS = TIMEOUT_AFTER_WARM_MS` (**180000**) uniquement si gate prêt ; refus d’envoyer un chat sous ce seuil.  
2. **Gate Ollama** : `evaluateOllamaGate` + `checkOllamaGateLive` (`GET /api/ps` via n8n, **pas** d’inférence) ; modèle `qwen2.5:1.5b`, `expires_at` + headroom, mémoire ; STOP avant chat si non prêt.  
3. **Zéro retry** : `retried: false` inchangé ; un seul `sendMessageOnce`.  
4. **Erreurs transport** : `cause.code` propagé (`transportError` / correlation).  
5. **Corrélation** : `runToken`, `sessionIdHash`, événements sans PII / sans corps message.  
6. **Stabilité PG** : snap immédiat + settle **30–60 s** (`RUNTIME_SETTLE_MS`, défaut 45 s) ; comparaison `updated_at`.  
7. **Exécutions** : poll `running` avant/après ; API down ⇒ UNCERTAIN.  
8. **Deactivate + webhooks** : conservés ; `safeDeclared` exige aussi exécutions idle observables.  
9. **`classifyPostflight`** : PASS/FAIL/UNCERTAIN selon classes (late-write, still_active, unobservable, …).  
10. **Fixtures** : `slotIdPresent` dans `sessionSnap` ; contrat R01 documenté ; **pas** de refresh TTL.

---

## 5. Tests offline et résultats

`node runner-021/offline-runner-readiness.test.cjs` → **18/18 PASS** (`OFFLINE-TEST-RESULTS.json`).

Couverture : warm `/api/ps`, modèle absent, expire trop tôt, timeout HTTP, socket close, réponse OK, late PG write, exec encore active, API exec down, erreur deactivate, postflight fail, zéro retry, pas CLAIM/CreateAppointment action, invariants FIX-008, timeout 180 s, correlation sans PII, webhooks insuffisants pour PASS, contrat R01.

Aucune opération réseau/PG réelle dans les tests.

---

## 6. Diagnostic de rétention n8n

Voir `OBSERVABILITY-RETENTION-DIAG.md`.

- Baseline historique : `saveData*=none` ⇒ REST vide **attendu** (8F-2B46).  
- 020 : settings API `all` mais `execution_entity=0` ⇒ **INCONCLUSIVE** (pas de run depuis flip / prune / soft-delete).  
- Compose : pas de `EXECUTIONS_DATA_*`.  
- Proposition future (auth) : fenêtre `all` + rollback `none` ; corrélation `runToken` ↔ exec ↔ PG ↔ Ollama.  
- **Aucun PUT settings dans 021.**

---

## 7. Gestion des écritures tardives

| Classe | Verdict typique | `safeDeclared` |
| --- | --- | --- |
| business_conformant | PASS | oui (si idle observable) |
| business_nonconformant | FAIL | oui si idle |
| execution_still_active | UNCERTAIN | **non** |
| execution_unobservable | UNCERTAIN | **non** |
| timeout_with_late_pg_write | UNCERTAIN | **non** |
| final_state_indeterminate | UNCERTAIN | **non** |

Timeout client **≠** preuve d’absence de traitement serveur. Webhooks à 0 **≠** PASS.

---

## 8. Contrôles de sécurité

| Contrôle | Statut |
| --- | --- |
| Isolation TEST / pas LIVE | OK |
| Pas d’activation / chat / Ollama generate | OK (021) |
| Pas PG mutate / Docker mutate | OK |
| Pas retry auto | OK |
| Pas CLAIM / CreateAppointment | OK (guards mock) |
| Correlation sans PII | OK |
| `require.main` guard (pas d’exec au require) | OK |

---

## 9. Risques résiduels

| Risque | Niveau |
| --- | --- |
| Stack TEST Down — fixtures/TTL non revalidées runtime | élevé avant campagne |
| Rétention exécutions toujours trouée | élevé pour debug nœud |
| Gate live dépend de n8n Up + DNS Ollama | moyen |
| Prompt métier ≫ synth 020 | moyen (180 s après warm) |
| Settle 45 s ne prouve pas terminaison si API exec down | documenté → UNCERTAIN |
| Snaps campagne (`sessionSnap`) portent encore nom/prénom synthétiques ([security-auditor](5e3c6208-172f-4304-a903-7cd875c85685) Low) | bas — redact si export hors TEST |
| `assertR01` ne revalide pas `slotIdPresent` après message ([postgres-engineer](38a124b1-23e4-405e-b482-17c9b7e82912)) | bas — renforcer en campagne |
| Nom `checkOllamaGateLive` ambigu ([security-auditor](5e3c6208-172f-4304-a903-7cd875c85685) Info) | bas — renommer hors ligne si rework |

---

## 10. Avis des agents

| Agent | Avis |
| --- | --- |
| [govsuite-planner](81c20489-8764-49c6-bfb6-5c82f341bf53) | **GO** hors ligne runner+tests+SHA+rapport ; **NO-GO** R01 ; phase suivante non autorisée |
| [qa-automation](fa31bd66-e951-40bd-81b1-c994281e393a) | **PASS** — offline **18/18** rejouée ; gate simulé ; late-write → UNCERTAIN ; zéro retry |
| [n8n-developer](b0ba5baa-a943-4051-aa4b-c1311587d643) | **PASS** — pas d’activate/chat 021 ; pin FIX-008 OK ; `saveData*=all` ≠ traces |
| [devops-engineer](cb1e199c-02ad-40b4-917d-fc58d5944e0a) | Préflight runtime **UNCERTAIN** (stack Exited) ; R01 **NO-GO** ; pas de docker start |
| [postgres-engineer](38a124b1-23e4-405e-b482-17c9b7e82912) | **PASS** prep — late-write UNCERTAIN ; `slotIdPresent` ; 0 mutate PG ; TTL reporté |
| [security-auditor](5e3c6208-172f-4304-a903-7cd875c85685) | **PASS** isolation ; Low : snaps campagne portent encore nom/prénom synthétiques |
| [evidence-reviewer](93f8c82b-19db-431e-9af5-9308c0886175) | Readiness offline **PASS** ; préflight/rétention **INCONCLUSIVE** ; R01 **NO-GO** (non exécutoire) |

---

## 11. Verdict

**PASS** — runner local durci, SHA tracés, tests offline 18/18 verts, documentation rétention + contrat R01.

**UNCERTAIN / INCONCLUSIVE** (sous-périmètre runtime, [devops-engineer](cb1e199c-02ad-40b4-917d-fc58d5944e0a)) : préflight workflow/PG (stack Down) ; cause exacte `execution_entity=0` malgré `saveData*=all`.

---

## 12. GO / NO-GO future campagne R01

| Gate | Décision |
| --- | --- |
| Readiness runner hors ligne | **GO** |
| Campagne R01 conversationnelle | **NO-GO** |

**Conditions minimales avant R01 (mission + auth distinctes)** : (1) stack TEST Up + préflight VC10/SHA/webhooks/fixtures/TTL, (2) warm Ollama réel + `/api/ps`, (3) runner 021, (4) plan rétention temporaire ou acceptation consciente du trou, (5) zéro retry, (6) TTL refresh ciblé si besoin après contrôle état.

**Arrêt après ce rapport. Aucune mission suivante lancée.**
