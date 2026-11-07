# GOVSUITE-MULTIAGENT-VALIDATION-002 — Rapport

Validation **locale, statique, hors ligne** de la configuration multi-agents créée en SETUP-001.

**Aucune** modification n8n, activation, Ollama, webhook, mutation PostgreSQL, changement Docker, accès LIVE, test métier runtime, ni déploiement.

**Verdict mission : PASS** (configuration multi-agents fonctionnelle, avec limitations documentées)  
**GO/NO-GO automatisation `tests/rec008` : NO-GO**  
**Phase suivante : non autorisée**

---

## 1. Audit des agents

### 1.1 Inventaire et frontmatter

| Fichier | `name` | `model` | `readonly` | Validité YAML |
| --- | --- | --- | --- | --- |
| `govsuite-planner.md` | govsuite-planner | inherit | true | OK |
| `n8n-developer.md` | n8n-developer | inherit | false | OK |
| `postgres-engineer.md` | postgres-engineer | inherit | false | OK |
| `qa-automation.md` | qa-automation | inherit | false | OK |
| `security-auditor.md` | security-auditor | inherit | true | OK |
| `devops-engineer.md` | devops-engineer | inherit | false | OK |
| `evidence-reviewer.md` | evidence-reviewer | inherit | true | OK |

Cohérence avec `AGENTS.md` : rôles, modes et règles 1–12 alignés.  
`.cursor/rules/govsuite-safety.mdc` : `alwaysApply: true`, interdits LIVE / activation / CreateAppointment / retry / PII / cloud.  
`GOVSUITE_MULTIAGENT_WORK_PROMPTS.md` et `GOVSUITE_MULTIAGENT_SETUP_001_REPORT.md` : présents et cohérents.

### 1.2 Mécanismes Cursor réels vs déclarations

| Annonce projet | Mécanisme Cursor réel | Nature |
| --- | --- | --- |
| Subagents dans `.cursor/agents/` | Enregistrés dans l’enum Task (`govsuite-planner`, `n8n-developer`, …) — **observé** | Technique |
| `readonly: true` | Mode Ask : pas d’éditions fichier ni commandes mutantes — **observé** (Write bloqué) | Technique |
| `model: inherit` | Hérite du parent | Technique |
| Allowlist répertoires (`n8n/proposed/` seulement, etc.) | **Prompts + AGENTS.md uniquement** — pas de sandbox FS par chemin | **Déclaratif** |
| « LIVE interdit » / « pas de webhook » | Règles + discipline agent ; pas de firewall projet | **Déclaratif** |
| Nested Task depuis un subagent | Possible selon doc ; **échoué ici par quota** sur le planner | Technique + limite compte |

**Conclusion audit :** ne pas confondre règles déclaratives et contrôles techniques. Seuls `readonly` et l’enregistrement Task sont prouvés comme garde-fous plateforme.

---

## 2. Résultat de la délégation réelle

### 2.1 Appels réellement effectués

| Ordre | Agent | ID | Résultat |
| --- | --- | --- | --- |
| 1 | [govsuite-planner](8726e9e2-e66b-468e-a309-147416744965) | cadrage P4D | **Succès** — plan GO collab offline / HOLD correction |
| 1b | Nested Task depuis planner → 4 spécialistes | — | **Échec réel** : *« You're out of usage… »* (quota) — **non simulé** |
| 2 | [n8n-developer](15e6b9e6-7eb1-4733-9e70-8529c12e6c36) | routage | **Succès** — PASS |
| 2 | [postgres-engineer](8337430c-3b20-4117-9e05-a1bc5903a036) | TTL/SQL | **Succès** — PASS |
| 2 | [security-auditor](2969bd94-5a6b-4634-870a-a0b4d7d9dd33) | risques | **Succès** — PASS (Medium résiduels) |
| 2 | [qa-automation](4b857a16-7377-48ae-881f-1d750fe86e71) | tests | **Succès** — UNCERTAIN |
| 2 | [evidence-reviewer](3cd44ee9-2ab5-412c-88c4-76c0c924e669) | test Write | **Succès** — PASS (Write bloqué) |
| 3 | [evidence-reviewer](4716e1bd-e0b3-4ea3-af31-ebcf75696e26) | revue collab | **Succès** — UNCERTAIN (package non clos) |
| 3 | [govsuite-planner](8726e9e2-e66b-468e-a309-147416744965) resume | consolidation | **Succès** — GO clôture / HOLD automatisation |

### 2.2 Interprétation

- **Délégation native parent → subagents : disponible et fonctionnelle** (Task + `subagent_type` projet).
- **Délégation nested planner → spécialistes : tentée, échouée par quota** — limitation réelle documentée.
- Orchestration manuelle parent (vague parallèle puis evidence puis planner) : **validée** comme fallback opérationnel, conformément aux work prompts.

---

## 3. Vérification des restrictions

Méthode : tests **non destructifs** uniquement (aucune action dangereuse volontairement réussie).

| Contrôle | Méthode | Résultat |
| --- | --- | --- |
| Readonly ne modifie pas de fichiers | evidence-reviewer tente `Write` → `_val002_should_not_exist.txt` | **Bloqué** (Ask mode) ; fichier **absent** postflight |
| Agents write n’ont pas muté hors mission | Postflight mtimes SETUP-001 / pas de nouveaux fichiers agents ; `git status` clean sur `n8n/workflows`, `live-exports`, `docker-compose.yml`, `postgres`, `database` | OK pour cette session |
| Allowlist répertoires | Non appliquée par Cursor FS | **Non prouvable techniquement** — déclaratif |
| Pas de LIVE / webhook / SQL métier / Docker mutate | Session limitée à Task, Read, Shell lecture, WebFetch docs, parse Node statique | OK (observé) |
| Probe orphelin | `tests/rec008/reports/_val002_should_not_exist.txt` | Absent |

---

## 4. Résultats de collaboration (fixture P4D)

### 4.1 Cause racine (faits)

Consensus n8n + postgres + security + evidence :

1. Après ~2 h, TTL `expires_at` dépassé.
2. `Charger` filtre `expires_at > NOW()` → mémoire vide (ligne PG peut encore exister).
3. Sans mémoire : LLM `GET_SERVICES` + absences de verrou Parser ASK_PRENOM + Fusionner/Gérer sans pending → UPSERT nullifiant → purge + GetServices.
4. Ollama **écarté** comme cause unique (T1 offline avec mémoire).

### 4.2 Correctifs possibles (non autorisés)

- P4E A+B+C (charger + flags, pas de continuation silencieuse, garde NULL) — **préférés** à Fix A minimal P4D (continuation post-TTL).
- Install / chat : **HOLD**, pas de nouvelles preuves dans VALIDATION-002.

### 4.3 Risques (security)

- Critical VC8 purge silencieuse : adressé VC9 (documenté).
- Medium : M-01 couverture runtime ASK_PRENOM ≠ P4G1 (`ASK_CREATE_SERVICE`) ; M-02 dérive artefact Fix B vs install ; M-03 purge explicite via « non ».

### 4.4 Scénarios de test

- QA : 8 scénarios textuels V002-S01…S08 ; banc actuel = squelettes.
- Planner : T-ACT-PRENOM, T-EXP-CAMILLE, etc.

### 4.5 GO/NO-GO consolidé

| Objet | Recommandation |
| --- | --- |
| Compréhension diagnostic P4 | GO informatif |
| Clôture VALIDATION-002 (config agents) | **GO** (planner) |
| Cohérence package métier complet | **UNCERTAIN** (evidence collab) — n’empêche pas la validation *config* |
| Automatisation `tests/rec008` | **NO-GO / HOLD** |
| Phase suivante / install / chat | **Non autorisée** |

Faits vs hypothèses : evidence-reviewer a explicitement séparé faits P4D/P4E/P4G1 des non-démontrés (équivalence runtime ASK_PRENOM post-VC9).

---

## 5. État du banc de tests

### 5.1 Organisation

14 descripteurs JSON sous `tests/rec008/scenarios/` (conversational, ttl, confirmation, idempotence, concurrency, http-errors, timeout, uncertain-resume, regression) + fixtures synthétiques + helpers Node natifs + checklists.

### 5.2 Exécutable vs squelette

| Artefact | Nature réelle |
| --- | --- |
| Descripteurs `expects.skeletonOnly: true` (14/14) | **Squelette** — `evaluateScenarioDescriptor` → PASS auto sans logique nœuds |
| `node tests/rec008/scripts/run-offline.cjs` | Inventaire + écriture rapports (non lancé métier ici ; parse statique absolu : 14 PASS squelette) |
| `n8n/proposed/…P4D…/offline-tests.js` | **Exécutable** hors banc (historique 6/6) — non rejoué |
| `n8n/proposed/…P4E…` TC01–18 | **Exécutable** hors banc — non rejoué |
| Assertions HTTP/métier / nœuds Code | **Absentes** du runner `tests/rec008` |

### 5.3 Anomalie banc (T01)

`T01` attend encore `loaderReturnsEmpty: true` (modèle pré-Fix A / VC8). Sous VC9, Charger charge la session expirée avec `session_expired` — expect **obsolète** si on branche un jour des assertions réelles.

### 5.4 Bug helper

`loadJson` dans `offline-runner.cjs` : si l’appelant passe un chemin **relatif** déjà préfixé `tests/rec008/...`, double jointure `__dirname/../` → ENOENT.  
Avec chemins **absolus** (cas de `run-offline.cjs`) : OK.  
Repro VALIDATION-002 : `loadJson('tests/rec008/scenarios/ttl/T01-…')` → BUG.

---

## 6. Anomalies identifiées

1. **Quota nested Task** : le planner peut appeler Task mais a échoué (usage limit) ; orchestration parent obligatoire comme fallback.
2. **Allowlists de répertoires déclaratives** seulement — un agent `readonly: false` n’est pas techniquement confiné à `n8n/proposed/` ou `tests/rec008/`.
3. **PASS squelette trompeur** : 14/14 PASS sans preuve métier.
4. **T01 `loaderReturnsEmpty`** désaligné VC9 / P4E.
5. **Bug `loadJson` chemins relatifs**.
6. **M-01 / M-02** (security) : couverture runtime et dérive artefacts — hors correction dans cette mission.
7. Planner consolidation a noté evidence collab « absente » avant sa fin ; livrable evidence collab **reçu ensuite** (UNCERTAIN) — pris en compte dans ce rapport parent.

---

## 7. Recommandations de correction

1. Mission offline dédiée : brancher le runner sur exports/code nœuds (style REC-004/005 + P4D/P4E), retirer `skeletonOnly` des scénarios couverts.
2. Corriger T01/T02 pour le contrat Fix A (`session_expired` + preserveDraft, pas loader vide).
3. Corriger `loadJson` pour toujours résoudre correctement relatifs vs absolus.
4. Documenter dans `AGENTS.md` : « allowlist path = déclaratif ; seul `readonly:true` est un contrôle Cursor ».
5. Prévoir reprise explicite si nested Task échoue (quota) : parent lance la vague parallèle.
6. Ne pas traiter un PASS inventaire comme GO automatisation REC-008.

---

## 8. Verdict

| Critère | Statut |
| --- | --- |
| Fichiers agents / rules / prompts valides | PASS |
| Enregistrement Task + délégation réelle | PASS (avec limite quota nested) |
| Restriction `readonly` technique | PASS |
| Isolation session (pas LIVE/webhook/SQL/Docker) | PASS |
| Collaboration diagnostic P4D | PASS sur cause ; UNCERTAIN sur clôture métier complète |
| Banc `tests/rec008` prêt automatisation | FAIL / non prêt |

**Verdict global VALIDATION-002 : PASS**

Motif : la configuration multi-agents Cursor fonctionne réellement (invocation, parallélisme, readonly, consolidation). Les limitations (quota nested, allowlists déclaratives, banc squelette) sont identifiées sans invalider la config.

---

## 9. GO/NO-GO automatisation tests REC-008

**NO-GO**

Conditions minimales pour un futur GO (mission humaine distincte) :

- Runner avec assertions nœuds (plus de `skeletonOnly` auto-PASS).
- Alignement T01/T02 sur VC9.
- Fix `loadJson`.
- Preuves offline rejouables depuis `tests/rec008` (ou lien explicite versionné vers proposed).
- Revue evidence-reviewer PASS sur la batterie.

**Phase suivante : non autorisée.** Mission arrêtée après ce rapport.
