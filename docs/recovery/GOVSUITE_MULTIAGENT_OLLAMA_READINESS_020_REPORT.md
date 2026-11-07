# GOVSUITE-MULTIAGENT-OLLAMA-READINESS-020 — Rapport

Préparation n8n + Ollama **TEST** pour une future validation runtime R01 : caractérisation latence (lien mission 016), warm-up contrôlé, timeout justifié, plan d’observabilité.

**TEST uniquement. Aucune activation n8n. Aucun Chat Trigger. Aucun R01/R02/R03. Aucun PUT. Aucune mutation PG. Aucun Docker mutate. Aucun LIVE. Aucun CLAIM. Aucun POST CreateAppointment. Aucun retry automatique.**

**Verdict mission : PASS**  
**Warm-up Ollama (préparation technique) : GO-CONDITIONAL**  
**Campagne R01 : NO-GO**  
**Phase suivante auto : non autorisée**

Artefacts : `n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/runtime-013/ollama-020/`

Références lues : rapports 015 / 016 / 018 / 019, `runtime-013/run-runtime-013.js`, `AGENTS.md`, `.cursor/rules/govsuite-safety.mdc`.

---

## 1. Préflight

| Contrôle | Observé | OK |
| --- | --- | --- |
| Projet Docker `govsuite-rec008-test` | 5 conteneurs Up (postgres healthy) | oui |
| n8n TEST `127.0.0.1:5682` | healthz **200** (~3,2 s) | oui |
| Workflow `OCD9It1uKFhOoWNF` | **inactive**, `activeVersionId=null` | oui |
| `versionCounter` | **10** | oui |
| `versionId` | `fd75ba32-f018-40e4-9f79-8f2a5400320b` | oui |
| SHA Gérer FIX-008 | `f75d4984…a26917fe` | oui |
| Webhooks sqlite | **0** | oui |
| Exécutions running | **0** | oui |
| `active-workflows` | `[]` | oui |
| Fingerprint PG | `1\|14\|4\|0` | oui |
| Fixtures R01–R03 | `ASK_PRENOM` + `slot` + `prenom` null (TTL R01 futur / R02–R03 expirés) | oui |
| Attempts ouverts | **0** | oui |
| LIVE sondé | **non** (`liveProbed=false`) | oui |

`RESULT.json` → `preflightOk=true`. STOP non déclenché.

---

## 2. Configuration Ollama TEST

| Élément | Valeur |
| --- | --- |
| Conteneur | `govsuite-rec008-test-rec008-ollama-1` |
| Version | **0.11.6** |
| Modèle | `qwen2.5:1.5b` (digest `65ec06548149b04c`, ~986 MiB disque) |
| Endpoint interne (via n8n) | `http://rec008-ollama:11434` |
| Accès mesures | `wget` depuis conteneur n8n (pas de curl / PATH wget dans le conteneur Ollama) |
| Appels Ollama mission | **2** / plafond documenté **4** |
| Prompt | synthétique court (« OK »), **sans PII** |

État avant mesures : `/api/ps` vide (`loadedBefore=[]`) → chargement à froid effectif (pas d’unload forcé nécessaire ; `unloadedForCold=false` = déjà déchargé).

---

## 3. Ressources CPU / RAM

| Ressource | Limite Docker | Observé |
| --- | --- | --- |
| CPU | **1,5** (`nanoCpus=1.5e9`) | idle ~0 % hors inférence (échantillon stats) |
| RAM | **1,5 GiB** | avant : ~64 MiB (4 %) ; après cold load : **~1,10 GiB / 1,5 GiB (73 %)** |
| Modèle en mémoire (`/api/ps`) | — | size ~1,45 GiB annoncé ; hold `keep_alive=10m` |

**Limite documentée :** la RAM TEST **permet** un maintien stable à ~1,1 GiB utilisés sous plafond 1,5 GiB pour `qwen2.5:1.5b` + `keep_alive=10m`. Marge faible (~0,4 GiB) : risque d’OOM si charge concurrente ou modèle plus large. **Aucune modification des limites Docker dans cette mission.**

---

## 4. Mesures à froid et à chaud

Essais fixes : **1 cold + 1 warm** (`POST /api/chat`, `keep_alive=10m`, `num_predict` court).

| Phase | Wall client | `load_duration` | `prompt_eval` | `eval` | tokens (prompt / eval) |
| --- | --- | --- | --- | --- | --- |
| **Cold** | **88 214 ms** | 63 232 ms | 23 492 ms | 217 ms | 39 / 2 |
| **Warm** | **3 594 ms** | 1 570 ms | 383 ms | 310 ms | 39 / 2 |

Réponse synthétique : `OK` (len 2). `done=true` sur les deux appels.

Fichiers : `MEASURES.json`, section `measures` de `RESULT.json`.

---

## 5. Résultats du warm-up

| Critère | Résultat |
| --- | --- |
| Commande | `POST /api/chat` model=`qwen2.5:1.5b`, `keep_alive=10m`, prompt synthétique |
| Vérification | `GET /api/ps` liste `qwen2.5:1.5b` + `expires_at` futur |
| Hold stable | **oui** (`stableHold=true`) |
| HTTP 200 seul | **insuffisant** (`http200NotEnough=true`) — exiger `/api/ps` |
| Impact latence | cold ~88 s → warm ~3,6 s (**~24×**) |
| Échec possible | modèle absent de `/api/ps` après warm ; OOM près de 1,5 GiB ; keep_alive expiré |

Stratégie retenue pour futures campagnes : warm-up contrôlé **avant** tout Chat Trigger, puis gate `/api/ps`.

---

## 6. Analyse des performances

- Mission **016** : timeout client 45 s face à une chaîne chat (~3 min 10 s côté Ollama + nœuds) + écriture PG tardive — cohérent avec **cold load ~63 s** + prompt_eval froid ~23 s **déjà** > 45 s sur prompt synthétique.
- À **chaud**, l’inférence synthétique (~3,6 s) passe largement sous 45 s ; les prompts métier (Camille / contexte n8n) seront plus longs → marge obligatoire.
- Traitement n8n + sauvegarde PG : non mesurés en runtime chat (interdit) ; 016 montre écriture PG **minutes** après abort client → observation différée obligatoire.
- `execution_entity=0` malgré `saveData*=all` → pas de durée par nœud disponible aujourd’hui (voir §8).

---

## 7. Recommandation de timeout

| Référence | ms |
| --- | --- |
| Client actuel runner | **45 000** |
| Cold wall mesuré | 88 214 |
| Warm wall mesuré | 3 594 |
| Formule | `max(120s, warm×3+30s, cold+60s)` → **148 214** |
| Reco campagne **après warm vérifié** | **180 000** (3 min) |
| Reco si warm échoue / risque cold | **300 000** (5 min) — alignée ordre de grandeur 016 |

**Ne pas** monter arbitrairement à 60–120 s si le cold reste possible. **Aucun retry** automatique (`noRetry=true`).

Test offline : `offline-timeout-formula.test.cjs` → `OFFLINE-TEST-RESULTS.json` **pass**.

---

## 8. Plan d’observabilité n8n

### Audit lecture seule (non modifié)

| Setting | Valeur |
| --- | --- |
| `saveDataSuccessExecution` | `all` |
| `saveDataErrorExecution` | `all` |
| `saveExecutionProgress` | `false` |
| `saveManualExecutions` | `true` |
| `executionTimeout` | `-1` |
| `maxExecutionTimeout` | `3600` |
| Lignes `execution_entity` | **0** |

### Propositions temporaires TEST (mission future — **pas appliquées ici**)

1. Vérifier env prune (`EXECUTIONS_DATA_MAX_AGE` / save-on-success) : rétention nulle malgré `all` → cause probable des listes vides (016/020).
2. Fenêtre campagne : désactiver ou allonger prune ; postflight restaurer.
3. Runner : poll `/rest/executions?status=running` avant deactivate + après `settleMs` ; corréler `sessionId` ↔ horodatages activate / Ollama `/api/ps` / PG `updated_at` (pas de PII).
4. Détecter écritures PG tardives : snap avant/après + fenêtre 30–60 s post-timeout **sans retry**.
5. Durées par nœud : dépendent d’exécutions réellement persistées ; sinon logs Ollama + PG restent le filet.

---

## 9. Modifications proposées pour le runner

Détail : `ollama-020/RUNNER-PROPOSED-PATCH.md` (**non appliqué**, **aucune campagne R01**).

1. Préflight `/api/ps` + warm-up contrôlé si modèle absent.  
2. Timeout mesuré : 180 s (warm) / 300 s (cold-risk).  
3. Corrélation session / Ollama / PG.  
4. Contrôle exécutions running.  
5. Observation différée après timeout client.  
6. Vérif PG après stabilisation.  
7. Deactivate + webhooks = 0.  
8. `retried=false` conservé.

Offline : formule timeout validée ; pas d’exécution métier.

---

## 10. Risques résiduels

| Risque | Niveau | Mitigation proposée |
| --- | --- | --- |
| Cold start > 45 s (et > 120 s) | **élevé** sans warm | warm + `/api/ps` gate |
| RAM 1,5 GiB / modèle ~1,1 GiB | moyen | surveiller stats ; pas de bump Docker sans auth |
| `execution_entity` vide | élevé pour debug nœud | mission observabilité / prune |
| Écritures PG après abort client | élevé (016) | settle + snap ; pas de retry |
| Prompt métier ≫ synthétique | moyen | timeout 180 s après warm ; UNCERTAIN si ambigu |
| Confusion TEST/LIVE | contrôlé | `liveProbed=false` ; ports 5682 only |
| Fichier `/tmp/r020-chat.json` résiduel (Low, security) | bas | `rm` post-mesure (corrigé hors ligne + cleanup TEST) |
| Modèle laissé chargé `keep_alive=10m` | info | effet warm volontaire ; documenter en postflight campagne |

---

## 11. Avis des agents

| Agent | Avis |
| --- | --- |
| [govsuite-planner](0d8840f1-ae0c-4529-9f78-94a8c0c5757d) | Readiness technique **GO** ; R01 **NO-GO** jusqu’à patch runner + warm `/api/ps` + timeout ~148–180 s ; phase suivante non autorisée. |
| [devops-engineer](f696fe5f-6868-42ef-8936-496f62ac8414) | **PASS** ; cold crédible ; formule 148214 ms ; warm prep **GO** conditionnel ; R01 **NO-GO** ; RAM marge ~0,4 GiB. |
| [n8n-developer](309b9414-7730-45f9-ad3d-61ff78cc8ab4) | **PASS** ; path Comprendre→Ollama confirmé ; `saveData*=all` ≠ traces ; timeouts 180/300 s confirmés ; rien appliqué. |
| [qa-automation](4c41b2fa-7fe7-4460-ade8-de24bcd721cf) | **PASS** ; 2 appels utiles ; offline formula OK ; timeout **148214 ms** justifié ; R01 **NO-GO**. |
| [postgres-engineer](4eeabe30-513d-4a31-9165-8e3101dba449) | **PASS** ; `pgMutated=false` ; FP `1\|14\|4\|0` ; tip late-write settle 30–60 s. |
| [security-auditor](a6660566-4d40-44ba-8820-a9627f095ac9) | **PASS** ; 0 Critical/High/Medium ; Low `/tmp` + Info keep_alive. |
| [evidence-reviewer](2fa60227-77b7-4fa1-9de7-041529f8f47f) | **PASS** readiness indépendant ; R01 **NO-GO** ; warm **GO-CONDITIONAL**. |

---

## 12. Verdict

**PASS** — diagnostic et tests techniques Ollama TEST terminés ; warm-up caractérisé ; timeout justifié par mesures ; propositions runner/observabilité documentées hors ligne.

**INCONCLUSIVE** uniquement sur la durée exacte n8n+PG en chat métier (hors périmètre : aucun Chat Trigger).

---

## 13. GO / NO-GO future campagne R01

| Gate | Décision |
| --- | --- |
| Préparation warm-up Ollama TEST | **GO-CONDITIONAL** (commande + `/api/ps` + keep_alive 10m + RAM OK) |
| Campagne conversationnelle R01 | **NO-GO** |
| Conditions minimales avant R01 (mission dédiée + auth) | (1) patch runner timeout/corrélation/settle, (2) warm préflight vérifié, (3) plan rétention exécutions TEST, (4) préflight/postflight workflow, (5) zéro retry |

**Arrêt après ce rapport. Aucune mission suivante lancée.**
