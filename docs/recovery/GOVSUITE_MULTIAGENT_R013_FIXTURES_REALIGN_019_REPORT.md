# GOVSUITE-MULTIAGENT-R013-FIXTURES-REALIGN-019 — Rapport

Réalignement des fixtures synthétiques R01–R03 sur le parcours CREATE PRD §6.2 (**OPTION A**, mission 018).

**TEST uniquement. Workflow VC10 / FIX-008 inchangés. Mutation PG limitée aux 3 `session_id`. Aucun chat. Aucune activation. Aucun PUT. Aucune Ollama. Aucun CLAIM/POST. Aucun Docker mutate. Aucun LIVE. Aucune campagne R0x.**

**Verdict mission : PASS**  
**Warm-up Ollama (préparation) : GO conditionnel** (mission distincte + auth)  
**Campagne R01 : NO-GO**  
**Phase suivante auto : non autorisée**

Artefacts : `n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/runtime-013/realign-019/`

---

## 1. Préflight

| Contrôle | Observé | OK |
| --- | --- | --- |
| Projet Docker `govsuite-rec008-test` | 5 conteneurs Up (postgres healthy) | oui |
| DB `govsuite_rec008_test` | accessible | oui |
| healthz TEST `:5682` | 200 | oui |
| Workflow `OCD9It1uKFhOoWNF` | présent, **inactive** | oui |
| `versionId` | `fd75ba32-f018-40e4-9f79-8f2a5400320b` | oui |
| `versionCounter` | **10** | oui |
| Gérer SHA | `f75d4984…a26917fe` | oui |
| `active-workflows` | `[]` | oui |
| Webhooks sqlite | **0** | oui |
| Exécutions running | **0** | oui |
| Attempts ouverts (3 sessions) | **0** | oui |
| Empreinte | `1\|14\|4\|0` | oui |
| FK sur `ai_conversation_state` | **0** (`slot_id` libre) | oui |
| LIVE `:5680` | healthz répond (observé) — **aucune op LIVE** | isolation ops TEST |

`PREFLIGHT.json` → `preflightOk=true`.

État R01 avant realign (résidu 015/016) : `ASK_CREATE_DATE_RANGE`, `last_user_message=Camille`, `slot_id` null — à corriger.

---

## 2. Sauvegarde des sessions

| Fichier | Contenu |
| --- | --- |
| `BACKUP-BEFORE.json` | 3 sessions expurgées (booléens / longueurs / steps) |
| `RESTORE-BEFORE.sql` | script local de restauration (synthétique) |
| `BACKUP-AFTER.json` | état post-mutation expurgé |

Rapports : pas de PII réelle ; `Dupont` / UUIDs synthétiques uniquement.

---

## 3. Analyse des contraintes SQL

- `ai_conversation_state.slot_id` : `uuid` **nullable**, **sans FK** vers `creneaux`.
- Aucune création de ligne `creneaux` / `rendez_vous` / `ai_appointment_attempt` / `notifications`.
- UUID synthétiques distincts R01/R02/R03 (`…301` / `…302` / `…303`).

---

## 4. Script de réalignement

- Exécuteur : `realign-019/run-realign-019.js`
- SQL : `realign-019/REALIGN.sql` — `BEGIN` → `UPDATE … WHERE session_id IN (3 ids)` → `RETURNING` → `ROWS=3` → `COMMIT`
- Source doc : `runtime-013/SEED.sql` mis à jour OPTION A (pour reseeds futurs)

Champs forcés (chaque session) :

| Champ | Valeur |
| --- | --- |
| `conversation_step` | `ASK_PRENOM` |
| `pending_action` | `CREATE_APPOINTMENT` |
| `service` / `site` | `PASSEPORT` / `PARIS` |
| `date_debut` / `date_fin` | `2026-11-10` / `2026-11-14` |
| `slot_id` + `available_slots` + index | UUID synthétique + jsonb len 1 + `1` |
| `nom` | synthétique présent |
| `prenom` / email / téléphone | `NULL` |
| `last_user_message` | `NULL` (purge Camille) |
| TTL R01 | `NOW()+2h` |
| TTL R02/R03 | `NOW()-1h` (pas de refresh) |

---

## 5. Modifications réellement exécutées

| Action | Résultat |
| --- | --- |
| Lignes affectées | **3** |
| Empreinte avant → après | `1\|14\|4\|0` → `1\|14\|4\|0` |
| Attempts / rdv / notifs | inchangés |
| Autres sessions | non touchées (filtre strict) |
| n8n PUT / activate | **0** |
| Chat / Ollama / POST CreateAppointment | **0** |

---

## 6. Tests offline

`offline-fixtures-realign.test.cjs` → `OFFLINE-TEST-RESULTS.json` — **8/8 PASS**

| Test | OK |
| --- | --- |
| Forme R01 active + slot + Camille résidu absent | oui |
| Forme R02/R03 expirées + slots distincts | oui |
| R01 + Camille → `prenom=Camille`, `ASK_EMAIL` (sim VC10) | oui |
| R02 expired + Camille → no capture | oui |
| R03 + reprendre → TTL refresh sim, pas prenom | oui |
| Pas de confirm sans slot | oui |
| Fixtures restent identité incomplète (pas CLAIM/POST) | oui |

Simulation ≠ validation runtime.

---

## 7. Postflight PostgreSQL

| Session | step | slot | dates | prenom null | TTL futur | Camille |
| --- | --- | --- | --- | --- | --- | --- |
| R01 | ASK_PRENOM | …301 | oui | oui | **oui** | non |
| R02 | ASK_PRENOM | …302 | oui | oui | **non** | non |
| R03 | ASK_PRENOM | …303 | oui | oui | **non** | non |

`POSTFLIGHT.json` → ok.

---

## 8. Intégrité n8n

| Champ | Postflight |
| --- | --- |
| `active` | `false` |
| `versionId` | `fd75ba32…` inchangé |
| `versionCounter` | **10** |
| Gérer SHA | `f75d4984…` (préflight) |
| Webhooks | 0 |

---

## 9. Avis des agents

| Agent | Verdict |
| --- | --- |
| [govsuite-planner](c8331017-875a-4eb8-aad5-f0e0866f965a) | **GO conditionnel** mutation seed si préflight ; R01 **NO-GO** ; stop |
| [devops-engineer](b9e56012-33f4-4c14-8384-651971ffea2f) | Env : 5 Up + PG OK + FP `1\|14\|4\|0` + 0 running ; **FAIL** politique stricte car LIVE `:5680` répond 200 |
| [postgres-engineer](af591439-f027-4564-a5e8-4057639a112a) | SQL **PASS** (txn, 3 ids, TTL, Camille cleared, slots) |
| [n8n-developer](25c66174-8610-487f-81b9-686b07e19459) | Machine à états **PASS** ; VC10 intact ; warm GO-cond / R01 NO-GO |
| [qa-automation](90b28136-c5e5-42b9-bad3-b99ca5438287) | Offline **PASS** 8/8 |
| [security-auditor](506eb434-cee2-43c7-aad2-e6df288b36c7) | **PASS** — mutate TEST only ; note Info : drift politique LIVE vs script devops |
| [evidence-reviewer](21fc0f17-bfe3-42b2-baca-a29333163296) | **PASS** ; warm **GO-CONDITIONAL** ; R01 **NO-GO** |

Parent : préflight/mutation/postflight (`RESULT.json` PASS), `SEED.sql` Option A, offline, rapport.

**Arbitrage LIVE** : [devops-engineer](b9e56012-33f4-4c14-8384-651971ffea2f) avait FAIL sur LIVE `:5680` joignable ; parent + [security-auditor](506eb434-cee2-43c7-aad2-e6df288b36c7) + [evidence-reviewer](21fc0f17-bfe3-42b2-baca-a29333163296) acceptent LIVE up si ops = TEST only. `_preflight-env-readonly.js` aligné a posteriori sur cette politique (plus de faux `live_isolation_breach`).

---

## 10. Verdict

| Item | Statut |
| --- | --- |
| Mission REALIGN-019 | **PASS** |
| Fixtures R01–R03 OPTION A | **conformes** |
| Workflow VC10 | **intact** |
| LIVE | non muté |

---

## 11. GO / NO-GO

| Décision | Statut |
| --- | --- |
| Préparation performances / warm-up Ollama | **GO conditionnel** (mission dédiée + auth ; pas auto) |
| Campagne R01 (chat) | **NO-GO** |
| R02 / R03 runtime | **NO-GO** |
| Install patch DIAG-017 | **NO-GO** (option A) |
| Phase suivante | **stop** |

Conditions futures R01 (hors 019) : warm Ollama et/ou timeout mesuré (016) + auth humaine + préflight frais.

---

## Références

- `GOVSUITE_MULTIAGENT_CREATE_FLOW_CONTRACT_018_REPORT.md`
- `GOVSUITE_MULTIAGENT_R01_STATE_ROUTING_DIAG_017_REPORT.md`
- `GOVSUITE_MULTIAGENT_CHAT_TIMEOUT_DIAG_016_REPORT.md`
- `GOVSUITE_MULTIAGENT_RUNTIME_R01_RETRY_015_REPORT.md`
- `PRD_GovSuite_AI_Consular_Assistant_Cursor.md` §6.2
- `AGENTS.md`, `.cursor/rules/govsuite-safety.mdc`
