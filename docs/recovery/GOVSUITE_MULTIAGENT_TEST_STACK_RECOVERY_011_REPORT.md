# GOVSUITE-MULTIAGENT-TEST-STACK-RECOVERY-011 — Rapport

Récupération de l’environnement Docker **TEST** `govsuite-rec008-test` après l’incident 010 (conteneurs Exited 255, port 5682 down).

**Aucune modification de workflow n8n. Aucun PUT. Aucune activation. Aucune mutation PG. Aucun LIVE.**

**Verdict mission : PASS**  
**GO/NO-GO reprise install FIX-008 : GO conditionnel** (préflight install 010 à rejouer ; autorisation PUT distincte déjà dans le cadre 010, à confirmer humainement)  
**R01–R03 / phase suivante auto : NO-GO**

Artefacts : `n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/stack-recovery-011/`

---

## 1. État initial

| Élément | Avant recovery |
| --- | --- |
| Docker Engine | 29.8.0 (up) |
| Projet Compose | `govsuite-rec008-test` — `running(1)` (ollama seul) |
| Config Compose (compose ls) | `…/2026-10-30-rec008-phase8e2b4-OLLAMA-TEST/docker-compose.rec008-test.yml` |
| Label conteneurs `config_files` | `…/2026-10-30-rec008-phase8e2b2-TEST-DEPLOY/docker-compose.rec008-test.yml` (même `name:` projet) |
| `rec008-n8n` / `postgres` / `mock` / `publish` | **Exited (255)** @ `2026-11-05T18:02:47Z` |
| `rec008-ollama` | Up (`restart: unless-stopped`) |
| Port hôte `127.0.0.1:5682` | Indisponible |
| LIVE `govsuite-n8n` / `govsuite-postgres` | Up (StartedAt ≈ `18:02:52Z`) — hors cible |

---

## 2. Cause racine / hypothèses

| Hypothèse | Preuves | Statut |
| --- | --- | --- |
| Arrêt brutal Docker Desktop / moteur / hôte | Exit **255** simultané (±10 ms) sur 4 services ; `OOMKilled=false` ; `State.Error` vide ; LIVE redémarré à la même fenêtre (`StartedAt≈18:02:52`) ; ollama seul a survécu via `unless-stopped` | **Très probable** — non prouvée par journal Windows Docker Desktop (events die vides) |
| Erreur Compose / config | Conteneurs existants, volumes présents, logs n8n sains avant kill | **Non retenue** |
| OOM | `OOMKilled=false` | **Écartée** |
| Conflit port 5682 | netstat vide avant start | **Écartée** |
| Corruption volume PG | DB ready ; fingerprint stable | **Écartée pour recovery** |

**Ne pas affirmer** « reboot Windows » sans event OS — retenir **arrêt non propre du runtime Docker** comme cause opérationnelle.

---

## 3. Vérifications de sécurité (pré-start)

| Contrôle | Résultat |
| --- | --- |
| Fichier Compose TEST | Identifié (`name: govsuite-rec008-test`) |
| Projet | `govsuite-rec008-test` |
| Conteneurs cibles | Noms exacts `govsuite-rec008-test-rec008-{postgres,mock,n8n,publish}-1` |
| Réseau | `rec008_test` internal ; publish `127.0.0.1:5682` only |
| Volumes | `…_postgres_data`, `…_n8n_data`, `…_ollama_data` — **non** touchés |
| Cible LIVE | Aucune commande sur `govsuite-n8n` / `govsuite-postgres` |
| Port 5682 | Libre avant start |
| Ambiguïté | **Aucune** → GO `docker start` |

---

## 4. Commandes réellement exécutées

Réf. `stack-recovery-011/COMMANDS.json` ([devops-engineer](7f5699e2-c90d-496e-85d4-041731b3699a)) :

1. `docker start govsuite-rec008-test-rec008-postgres-1`  
2. `docker start govsuite-rec008-test-rec008-mock-1`  
3. `docker exec … pg_isready -U postgres -d govsuite_rec008_test`  
4. `docker start govsuite-rec008-test-rec008-n8n-1`  
5. `docker start govsuite-rec008-test-rec008-publish-1`  
6. Lectures : `docker ps`, `curl http://127.0.0.1:5682/healthz`

**Non exécuté :** `compose down` / `up --force-recreate` / prune / volume rm / rebuild / start LIVE / PUT n8n.

---

## 5. Conteneurs démarrés

| Conteneur | Action |
| --- | --- |
| postgres | **start** |
| mock | **start** |
| n8n | **start** |
| publish | **start** |
| ollama | inchangé (déjà Up) |

---

## 6. État Docker final

| Conteneur | Status | Ports |
| --- | --- | --- |
| postgres | Up (healthy) | 5432/tcp |
| mock | Up | — |
| n8n | Up | 5678/tcp |
| publish | Up | `127.0.0.1:5682->5682` |
| ollama | Up | 11434/tcp |
| LIVE n8n / postgres | Up, **non touchés** | 5680 / 5433 |

---

## 7. Contrôles n8n

`N8N-CHECK.json` — **allPass=true** (GET only) :

| Contrôle | Observé |
| --- | --- |
| ID | `OCD9It1uKFhOoWNF` |
| `active` / `activeVersionId` | `false` / `null` |
| `versionId` | `e7867799-2a18-4aec-9ee5-3ba9cbc40766` |
| `versionCounter` | **9** (VC9) |
| Nœuds / edges | **134** / **137** |
| Active workflows | **[]** |
| Credential PG | `Fs0l0058q5CEadRw` only |
| URLs HTTP | toutes `http://rec008-mock:8080/…` |
| healthz | 200 `{"status":"ok"}` (transport ≠ métier) |

**Aucun PUT / webhook chat / activation.**

---

## 8. Contrôles PostgreSQL

| Mesure | Valeur | Ancre P4F | Drift |
| --- | --- | --- | --- |
| `rdv\|sessions\|attempts\|notif` | `1\|11\|4\|0` | `1\|11\|4\|0` | **non** |
| Open attempts | `0` | `0` | **non** |
| Mutation | aucune | — | — |

---

## 9. Contrôles mock

| Mesure | Valeur |
| --- | --- |
| scenario | `created` |
| total calls | **0** |
| POST CreateAppointment | **0** |

---

## 10. Isolation TEST / LIVE

| Probe depuis n8n TEST | Attendu | Observé |
| --- | --- | --- |
| `govsuite-postgres:5432` | interdit | timeout |
| `govsuite-n8n:5678` | interdit | timeout |
| `rec008-postgres:5432` | autorisé | connect-ok |
| `rec008-mock:8080` | autorisé | open |

---

## 11. Anomalies et écarts

| Item | Note |
| --- | --- |
| Label compose 8e2b2 vs compose ls 8e2b4 | Même projet `govsuite-rec008-test` ; **pas** de recreate — documenté seulement |
| DNS probe PG initial timeout | Course au démarrage ; re-probe **connect-ok** |
| Logs PG historiques (nov) « relation does not exist » | Anciens ; schéma métier présent aujourd’hui (counts OK) |
| HTTP 200 healthz | **Insuffisant seul** — complété par N8N/PG/mock/isolation |

---

## 12. Evidence Reviewer

Délégué : [evidence-reviewer](0fe50f9c-c69a-4219-b2d3-419da9f0726c) — verdict indépendant **PASS** (recovery + HTTP) ; métier FIX-008 non évalué ; **GO** reprise préflight install ; **NO-GO** PUT/activation sans préflight frais + autorisation.

Couches :

| Couche | Statut |
| --- | --- |
| Recovery Docker (`docker start`) | **PASS** |
| Transport HTTP healthz | PASS (non suffisant seul) |
| Workflow VC9 inactif | PASS |
| Intégrité PG / mock | PASS |
| Install FIX-008 / métier | **non faite** (attendu) |

---

## 13. Verdict PASS / FAIL / UNCERTAIN

| Champ | Valeur |
| --- | --- |
| Verdict | **PASS** |
| Portée | Stack TEST récupérée ; workflow non modifié |

---

## 14. GO / NO-GO — reprendre install FIX-008

| Question | Décision |
| --- | --- |
| Stack TEST utilisable | **GO** |
| Reprendre séquence install FIX-008 (préflight → backup → 1 PUT) | **GO conditionnel** — rejouer préflight runtime 010 ; chemin FIX-008 + SHA `849201dd…` ; **pas** auto-lancer |
| Activation / chat / R01–R03 | **NO-GO** |
| LIVE / recreate / prune | **NO-GO** |
| Phase suivante automatique | **non autorisée** |

---

## Délégations

| Agent | ID | Rôle |
| --- | --- | --- |
| [govsuite-planner](91bb718e-e550-45a7-9b5e-21c3829ffe0b) | **GO conditionnel** `docker start` ; install FIX-008 **NO-GO** dans 011 |
| [security-auditor](7f1803d5-079e-46b5-9a86-770952a3a562) | Isolation **PASS** ; GO start TEST exited only |
| [devops-engineer](7f5699e2-c90d-496e-85d4-041731b3699a) | Diagnostic + `docker start` + artefacts |
| [n8n-developer](5c5039aa-be7e-4746-866b-c30fa3bacf17) | `N8N-CHECK.json` **PASS** (VC9 inactive, 134/137) |
| [postgres-engineer](11fbd68e-9607-401e-bd8e-6731f49b3f8e) | `PG-CHECK.json` **PASS** (`1\|11\|4\|0`, open=0) |
| [qa-automation](19c8413b-1533-4a4e-9498-ece7575fe99c) | `R011-stack-recovery-qa-verdict.json` **PASS** ; install **GO-CONDITIONAL** ; R0x **NO-GO** |
| [evidence-reviewer](0fe50f9c-c69a-4219-b2d3-419da9f0726c) | **PASS** recovery ; **GO** re-préflight install ; **NO-GO** PUT sans autorisation |
| Parent | Probe, N8N/PG/mock/isolation checks, rapport |

---

## Halt

Mission **arrêtée** après ce rapport. Aucune install FIX-008 lancée automatiquement.
