# GOVSUITE-MULTIAGENT-SETUP-001 — Rapport

Mise en place de l'architecture multi-agents Cursor AI et du banc de tests REC-008 **sans** exécution métier, **sans** modification de workflow n8n distant, **sans** mutation PostgreSQL, **sans** altération de conteneurs, **sans** toucher LIVE.

**Verdict mission : PASS**

Phase suivante : **non autorisée** (arrêt volontaire après configuration + rapport).

---

## 1. Préflight d'analyse (lecture seule)

| Élément | Constat |
| --- | --- |
| Racine | `C:\Open Source PME\govsuite-appointments` |
| `.cursor/`, `AGENTS.md`, `.claude/agents/` | Absents avant SETUP-001 → création sans écrasement |
| Stack | Docker Compose : PostgreSQL 16, n8n, Mailpit |
| Workflows | `n8n/workflows`, `n8n/live-exports`, propositions sous `n8n/proposed/` |
| Migrations | `postgres/migrations/` (idempotence REC-007, attempts REC-008) |
| Tests existants | `tests/rec004-rec005-conversation.test.cjs` (Node offline, sans npm) |
| Rapports REC-008 | `docs/recovery/REC_008_*` ; phases P4D→P4G1 présentes |
| Isolation TEST | Documentée notamment dans `REC_008_PHASE8E2B1_TEST_ISOLATION_REPORT.md` |
| Cursor installé | **3.27.22** — subagents `.cursor/agents/` + frontmatter officiels supportés |

Conventions reprises : artefacts `n8n/proposed/<date>-rec008-…/`, rapports `docs/recovery/`, préflight/postflight, verdicts PASS/FAIL/UNCERTAIN, distinction HTTP vs métier, LIVE interdit par défaut.

---

## 2. Architecture des agents

```text
                    ┌─────────────────────┐
                    │  govsuite-planner   │  readonly
                    │  cadrage / GO-NOGO  │
                    └─────────┬───────────┘
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
 ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
 │ n8n-developer  │  │postgres-engineer│  │security-auditor│
 │ proposed only  │  │ SQL proposals   │  │ readonly       │
 └───────┬────────┘  └───────┬────────┘  └───────┬────────┘
         │                   │                   │
         ▼                   ▼                   ▼
 ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
 │ qa-automation  │  │devops-engineer │  │evidence-reviewer│
 │ tests/rec008   │  │ pre/postflight │  │ readonly proofs │
 └────────────────┘  └────────────────┘  └────────┬───────┘
                                                   │
                                                   ▼
                                         décision phase N
                                         (pas N+1 auto)
```

Compatibilité Cursor : fichiers Markdown dans `.cursor/agents/` avec YAML `name`, `description`, `model: inherit`, `readonly` selon le rôle — aligné sur la doc Subagents Cursor 3.27.x.

---

## 3. Fichiers créés

### Agents

- `.cursor/agents/govsuite-planner.md`
- `.cursor/agents/n8n-developer.md`
- `.cursor/agents/postgres-engineer.md`
- `.cursor/agents/qa-automation.md`
- `.cursor/agents/security-auditor.md`
- `.cursor/agents/devops-engineer.md`
- `.cursor/agents/evidence-reviewer.md`

### Règles

- `AGENTS.md`
- `.cursor/rules/govsuite-safety.mdc` (`alwaysApply: true`)

### Banc de tests

- `tests/rec008/README.md`
- `tests/rec008/fixtures/` (identities, slots, sessions, attempts synthétiques)
- `tests/rec008/lib/` (`assert-helpers.cjs`, `offline-runner.cjs`, `report.cjs`)
- `tests/rec008/scenarios/` (conversational, ttl, confirmation, idempotence, concurrency, http-errors, timeout, uncertain-resume, regression)
- `tests/rec008/scripts/` (`run-offline.cjs`, checklists préflight/postflight)
- `tests/rec008/reports/.gitkeep`

### Documentation

- `docs/recovery/GOVSUITE_MULTIAGENT_WORK_PROMPTS.md`
- `docs/recovery/GOVSUITE_MULTIAGENT_SETUP_001_REPORT.md` (ce fichier)

**Non créés / non touchés :** workflows sous `n8n/workflows` ou `n8n/live-exports`, `docker-compose.yml`, migrations appliquées, `.env`, exports historiques P4D–P4G1.

---

## 4. Rôles et permissions

| Agent | `readonly` | Écriture autorisée | LIVE | Activation n8n | SQL métier | CreateAppointment |
| --- | --- | --- | --- | --- | --- | --- |
| govsuite-planner | true | non | non | non | non | non |
| n8n-developer | false | `n8n/proposed/` seulement | non | non (sans ordre) | non | non |
| postgres-engineer | false | propositions SQL locales | non | non | non sans ordre | non |
| qa-automation | false | `tests/rec008/` | non | non | non | non |
| security-auditor | true | non | non (obs. doc possible) | non | non | non |
| devops-engineer | false | scripts/docs locaux | non | non | non | non |
| evidence-reviewer | true | non | non | non | non | non |

Aucun agent ne possède une permission LIVE. Aucun agent ne peut s'auto-accorder de droits supplémentaires (règle 11).

---

## 5. Stratégie d'orchestration

1. **Cadrage** : `govsuite-planner` (GO/NO-GO/HOLD phase courante).
2. **Diagnostics parallèles** : `n8n-developer` ∥ `postgres-engineer` ∥ `security-auditor`.
3. **Préparation hors ligne parallèle** : correctifs proposed + fixtures QA + scripts devops.
4. **Runtime (si autorisé humainement)** : préflight → **une** action → postflight (ordre strict, fail-fast, pas de retry).
5. **Revue** : `evidence-reviewer` indépendant.
6. **Clôture** : planner pour la phase N uniquement ; **stop**.

Prompts prêts à l'emploi : `docs/recovery/GOVSUITE_MULTIAGENT_WORK_PROMPTS.md`.

---

## 6. Stratégie d'isolation

- Règle toujours active : `.cursor/rules/govsuite-safety.mdc`.
- Séparation explicite TEST vs LIVE (ports, credentials, volumes, empreintes, mocks).
- Correctifs d'abord sous `n8n/proposed/` ; pas d'import/activation implicite.
- Fixtures synthétiques `@example.test` / UUID de démo uniquement.
- Lanceur offline documenté mais **non exécuté** dans SETUP-001 (aucun appel métier).
- Observation `docker ps` en lecture seule uniquement ; aucun recreate / compose change.

---

## 7. Organisation du banc de tests

Aligné sur `REC_008_TEST_MATRIX.md` et le style `tests/rec004-rec005-conversation.test.cjs` :

- Descripteurs JSON `mode: offline` + `expects.skeletonOnly` pour SETUP-001.
- Helpers natifs Node (aucune dépendance npm ajoutée).
- Familles : conversationnel, TTL (P4D/P4G1), confirmation, idempotence, concurrence, 400/409/500, timeout, reprise UNCERTAIN, non-régression.
- Rapports JSON + Markdown prévus via `lib/report.cjs` lors d'exécutions futures autorisées.

---

## 8. Contrôles de sécurité (étape 6)

| Contrôle | Résultat |
| --- | --- |
| Sept agents présents + frontmatter valide | OK |
| `AGENTS.md` + `govsuite-safety.mdc` cohérents (12 règles) | OK |
| Aucun agent avec permission LIVE | OK |
| Workflows n8n distants / `n8n/workflows` / live-exports modifiés | Non (aucun changement git sur ces chemins) |
| Mutation PostgreSQL | Non effectuée |
| Conteneurs / Compose modifiés | Non |
| Appel métier / CreateAppointment / chat test | Non |
| Fichiers historiques REC-008 P4D–P4G1 / matrice | Intacts (SHA échantillon relevés) |
| `run-offline.cjs` exécuté | Non (volontaire) |
| Phase suivante lancée | Non |

---

## 9. Risques et limitations

1. `readonly: false` sur quatre agents repose sur la discipline des prompts + règle alwaysApply ; ce n'est pas un sandbox OS.
2. Les scénarios sont des **squelettes** : assertions nœuds Code non branchées tant qu'une mission QA n'est pas autorisée.
3. Des conteneurs `govsuite-*` / `govsuite-rec008-test-*` tournent déjà sur la machine ; SETUP-001 ne les a pas modifiés mais toute mission runtime devra reconfirmer l'isolation.
4. Beaucoup d'artefacts `n8n/proposed/` et rapports recovery étaient déjà non suivis par git ; SETUP-001 n'y a rien écrit hors les nouveaux fichiers listés.
5. Les subagents Cursor héritent du modèle parent (`model: inherit`) : la qualité dépend du modèle de la session appelante.

---

## 10. Prochaines étapes recommandées (non autorisées ici)

1. Mission QA : brancher `offline-runner` sur exports de nœuds (style REC-004/005) pour T01/T02/P4E.
2. Mission evidence : revue croisée du correctif TTL VC9 / P4G2 si poursuite runtime.
3. Optionnel : commit git **uniquement** des fichiers SETUP-001 (agents, rules, tests/rec008, docs) sur demande humaine.
4. Ne pas enchaîner automatiquement une phase P4G3 / install / chat.

---

## 11. Verdict

| Critère | Statut |
| --- | --- |
| Configuration multi-agents | Complète |
| Règles de sécurité | En place |
| Banc de tests local | Préparé, non exécuté métier |
| Non-régression artefacts historiques | Respectée |
| Isolation LIVE / no-mutate runtime | Respectée |

**Verdict : PASS**

**GO/NO-GO phase suivante : NO-GO automatique** — attendre une mission humaine distincte.
