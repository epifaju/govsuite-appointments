# GovSuite Appointments — Agents Cursor

Configuration multi-agents pour accélérer le développement, les tests, la sécurité et la préparation production de **REC-008**.

Compatibilité vérifiée avec **Cursor 3.27.x** (subagents projet dans `.cursor/agents/`, frontmatter `name` / `description` / `model` / `readonly`).

## Agents

| Agent | Fichier | Mode | Rôle |
| --- | --- | --- | --- |
| `govsuite-planner` | `.cursor/agents/govsuite-planner.md` | `readonly` | Planification, découpage, GO/NO-GO phase courante |
| `n8n-developer` | `.cursor/agents/n8n-developer.md` | écriture locale limitée | Correctifs workflow hors ligne sous `n8n/proposed/` |
| `postgres-engineer` | `.cursor/agents/postgres-engineer.md` | écriture locale limitée | Analyse SQL / propositions ; pas de mutation DB sans ordre |
| `qa-automation` | `.cursor/agents/qa-automation.md` | écriture locale limitée | Scénarios, fixtures, assertions ; hors ligne par défaut |
| `security-auditor` | `.cursor/agents/security-auditor.md` | `readonly` | Auth, secrets, PII, isolation TEST/LIVE |
| `devops-engineer` | `.cursor/agents/devops-engineer.md` | écriture locale limitée | Préflight, postflight, backup, Docker (sans mutate runtime) |
| `evidence-reviewer` | `.cursor/agents/evidence-reviewer.md` | `readonly` | Revue indépendante des preuves, PASS/FAIL/UNCERTAIN |

Aucun agent n'a de permission LIVE. Aucun agent ne peut s'auto-accorder des permissions supplémentaires.

## Règles de sécurité impératives

Voir aussi `.cursor/rules/govsuite-safety.mdc` (`alwaysApply: true`).

1. **LIVE est interdit par défaut.**
2. **TEST et LIVE ne doivent jamais être confondus** (ports, credentials, volumes, empreintes, mocks).
3. **Aucune activation n8n implicite.**
4. **Aucun POST CreateAppointment implicite.**
5. **Aucune modification SQL métier sans autorisation explicite.**
6. **Aucun retry automatique** après timeout ou erreur réseau.
7. **Aucun secret ni PII** dans les rapports, diffs, fixtures réelles ou commits.
8. **Préflight et postflight obligatoires** pour toute phase runtime autorisée.
9. **Toujours produire un verdict** PASS / FAIL / UNCERTAIN.
10. **Une phase n'autorise pas automatiquement la suivante.**
11. **Les agents ne s'accordent pas de permissions supplémentaires.**
12. **Aucun déploiement cloud** de l'environnement TEST sans autorisation.

## Orchestration

### Parallélisable (lecture / hors ligne)

- Diagnostic n8n (`n8n-developer`) ∥ audit SQL (`postgres-engineer`) ∥ audit sécurité (`security-auditor`)
- Rédaction de fixtures / scénarios (`qa-automation`) ∥ scripts préflight (`devops-engineer`)
- Revue de preuves (`evidence-reviewer`) après artefacts stabilisés

### Ordre strict (runtime ou mutation)

1. `govsuite-planner` → cadrage GO/NO-GO
2. Préflight (`devops-engineer` scripts + contrôles)
3. Action autorisée unique (install / un message / une migration)
4. Postflight
5. `evidence-reviewer` → verdict indépendant
6. `govsuite-planner` → décision phase courante uniquement ; **stop**

## Banc de tests

Structure locale : `tests/rec008/` (Node.js natif, pas d'exécution métier dans la mission SETUP-001).

Prompts de travail : `docs/recovery/GOVSUITE_MULTIAGENT_WORK_PROMPTS.md`.

## Hors périmètre par défaut

- Exécution de tests métier runtime
- Modification de workflows n8n distants
- Mutation PostgreSQL
- Modification de conteneurs / réseau Docker
- Toucher LIVE
- Lancer automatiquement la phase suivante
