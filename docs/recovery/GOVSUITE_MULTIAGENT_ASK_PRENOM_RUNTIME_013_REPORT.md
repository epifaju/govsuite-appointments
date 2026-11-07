# GOVSUITE-MULTIAGENT-ASK-PRENOM-RUNTIME-013 — Rapport

Validation runtime TEST du correctif EXPLICIT-RESUME-FIX-008 installé en mission 012.

**TEST uniquement. Aucun LIVE. Aucun retry. Aucun POST CreateAppointment. Aucune réservation. Aucun changement workflow. Aucun Docker mutate.**

**Verdict global : UNCERTAIN**  
**R01 / R02 / R03 : UNCERTAIN** (non exécutés — arrêt transport avant activate)  
**GO/NO-GO suite REC-008 : NO-GO** (rerun runtime autorisé séparément requis)  
**Phase suivante auto : non autorisée**

Artefacts : `n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/runtime-013/`

---

## 1. Préflight

| Contrôle | Observé | OK |
| --- | --- | --- |
| Projet Docker `govsuite-rec008-test` | 5 conteneurs Up (postgres healthy, mock, n8n, publish `5682`, ollama) | oui |
| n8n TEST `127.0.0.1:5682` healthz | 200 `{"status":"ok"}` | oui |
| Workflow `OCD9It1uKFhOoWNF` | présent | oui |
| `versionId` | `fd75ba32-f018-40e4-9f79-8f2a5400320b` | oui |
| `versionCounter` | **10** | oui |
| Nodes / edges | **134 / 137** | oui |
| `active` / `activeVersionId` / actifs | `false` / `null` / `[]` | oui |
| Webhooks actifs | **0** | oui |
| Gérer jsCode SHA256 | `f75d49849231f956bb9ae5383111ea84b362dc58de6711cc75d2e7e2a26917fe` | oui |
| PG fingerprint | `1\|14\|4\|0` | oui |
| Open attempts | `0` | oui |
| Mock POST CreateAppointment / CLAIM | `0` / `0` | oui |
| Fixtures R01–R03 | présentes ; R01 TTL actif ; R02/R03 expirées ; prenom null ; nom synthétique | oui |
| Isolation TEST↛LIVE | port `5682` only ; `liveTouched=false` | oui |
| Tentatives métier ouvertes | aucune | oui |

Source : `runtime-013/artifacts/preflight.json` (`ok=true`).

---

## 2. Version n8n installée

| Champ | Valeur |
| --- | --- |
| Workflow | `OCD9It1uKFhOoWNF` |
| `versionId` | `fd75ba32-f018-40e4-9f79-8f2a5400320b` |
| `versionCounter` | 10 |
| Gérer (FIX-008) | `Gérer collecte progressive` |
| jsCode SHA256 | `f75d4984…a26917fe` |
| Origine | install mission 012 (1 PUT, inactive) |

Conformité préflight mission 013 : **PASS**.

---

## 3. Sessions synthétiques

| Scénario | `session_id` | État seed | TTL préflight |
| --- | --- | --- | --- |
| R01 | `rec008-runtime013-r01-active` | ASK_PRENOM, pending CREATE, nom présent, prenom null | actif (`expires_at` futur) |
| R02 | `rec008-runtime013-r02-expired` | ASK_PRENOM, intent GENERAL, brouillon, prenom null | expiré |
| R03 | `rec008-runtime013-r03-resume` | ASK_PRENOM, indépendant R02, nom présent, prenom null | expiré |

Seed : `runtime-013/SEED.sql` + `SEED-RESULT.json` (**PASS**, UPSERT 3 ids, empreinte `1|11|4|0` → `1|14|4|0`).  
PII : nom synthétique uniquement (longueur / booléens dans preuves ; pas d’email citoyen).

---

## 4. Commandes et opérations exécutées

| Étape | Opération | Effet |
| --- | --- | --- |
| Seed (antérieur) | UPSERT 3 sessions TEST | fingerprint `1\|14\|4\|0` |
| Runner | `node runtime-013/run-runtime-013.js` | login REST + préflight |
| Préflight | GET workflow, PG counts, mock `_meta/calls`, webhook probe | **PASS** |
| R01 pré-activate | GET `/rest/workflows/OCD9It1uKFhOoWNF` | **UND_ERR_SOCKET** (`other side closed`) |
| Activate | — | **non exécuté** |
| Chat `sendMessage` | — | **non envoyé** (0 message) |
| Deactivate | — | non requis (jamais actif) |
| Retry | interdit | **0** |
| Docker mutate | interdit | **0** |
| LIVE | interdit | **0** |
| Cleanup fixtures | différé (UNCERTAIN) | **0 DELETE** |

---

## 5. Résultat R01

**Verdict : UNCERTAIN**

- Préflight session OK (active, ASK_PRENOM, prenom null).
- Échec transport REST **avant** `POST …/activate`.
- Aucun message `Camille`.
- Assertions métier (prenom Camille, ASK_EMAIL, no CLAIM/POST) **non évaluables**.

---

## 6. Résultat R02

**Verdict : UNCERTAIN**

- Non démarré (STOP campagne après incident R01 pré-activate).
- Fixture expirée toujours intacte au post-stop.

---

## 7. Résultat R03

**Verdict : UNCERTAIN**

- Non démarré.
- Aucune preuve de capture `prenom="reprendre"` ni bascule ASK_EMAIL (scénario non joué).

---

## 8. Réponses HTTP

| Scénario | HTTP chat | Corps |
| --- | --- | --- |
| R01 | n/a | aucun |
| R02 | n/a | aucun |
| R03 | n/a | aucun |

Incident transport : `TypeError: fetch failed` / `SocketError: other side closed` sur GET REST workflow (voir `artifacts/campaign-fatal.json`).  
**Distinction :** échec **transport/API** — pas un échec métier conversationnel.

---

## 9. États PostgreSQL avant/après

| Moment | Fingerprint `rdv\|sessions\|attempts\|notifs` | Sessions R013 |
| --- | --- | --- |
| Après seed | `1\|14\|4\|0` | 3 synthétiques |
| Préflight campagne | `1\|14\|4\|0` | inchangées |
| Post-stop | `1\|14\|4\|0` | inchangées (ASK_PRENOM, prenom null) |

Aucun delta autorisé sur les 3 sessions n’a eu lieu (aucun message traité).  
Tables métier `rendez_vous` / `ai_appointment_attempt` / `notifications` : **inchangées**.

---

## 10. Compteurs CLAIM / POST

| Compteur | Préflight | Post-stop |
| --- | --- | --- |
| Mock POST CreateAppointment | 0 | 0 (non re-mesuré runtime scénario ; préflight + absence d’activate) |
| Mock CLAIM paths | 0 | 0 |
| Open attempts | 0 | 0 |

**Aucun CLAIM. Aucun POST CreateAppointment** observé dans le périmètre exécuté.

---

## 11. Preuves de désactivation

| Contrôle post-stop | Valeur |
| --- | --- |
| `active` | `false` |
| `activeVersionId` | `null` |
| Active workflows | `[]` |
| `versionId` / counter | inchangés (`fd75ba32…` / 10) |

Pas d’activation temporaire : la preuve est « jamais activé » plutôt que « désactivé après scénario ».

---

## 12. Contrôles d’intégrité

| Contrôle | Résultat |
| --- | --- |
| Rendez-vous | inchangés |
| Notifications | inchangées |
| Tentatives métier | inchangées |
| Sessions historiques hors R013 | non mutées (delta sessions = 0 pendant campagne) |
| CLAIM / CreateAppointment | aucun |
| Appel LIVE | aucun |
| PII dans logs artefacts | synthétique / masqué (booléens, longueurs) |
| Workflow inactif après incident | oui |

---

## 13. Incidents et limites

1. **Incident critique campagne :** après préflight PASS, `GET /rest/workflows/…` a levé `UND_ERR_SOCKET` (`other side closed`) avant activate R01.
2. **Règle appliquée :** aucun retry automatique (govsuite-safety) → **STOP / UNCERTAIN**.
3. **État sûr :** workflow inactive, fixtures préservées, fingerprint stable — éligible à un **rerun explicitement autorisé**, non lancé ici.
4. **Limite :** FIX-008 n’est **pas** validé runtime par R01–R03 dans cette mission.
5. **Runner :** `runtime-013/run-runtime-013.js` (activate `/rest/.../activate` + 1 message sans retry + deactivate) — préflight OK ; boucle scénario non atteinte.

---

## 14. Evidence Reviewer et délégations

### Evidence Reviewer — [evidence-reviewer](f7d9d46a-8e5c-4a6c-a546-1c9b11e74c3a)

| Scope | Verdict |
| --- | --- |
| R01 / R02 / R03 | **UNCERTAIN** |
| Global | **UNCERTAIN** |

- Préflight / FIX-008 / isolation / seed : **soutenus**.
- Crash pré-activate / 0 chat / 0 retry : **soutenus**.
- Métier R0x : **insuffisant** (non exercé).
- CreateAppointment / CLAIM : **aucun indice d’occurrence**.
- Code exact `UND_ERR_SOCKET` : narrative parent ; fatal machine = `fetch failed` seulement.
- Post-stop détaillé : surtout post-hoc `campaign-result.json` (pas de postflight runner dédié).
- Rerun : seule voie vers PASS métier — **non autorisé** par cet audit.

### Autres agents (clôturés)

| Agent | Verdict / décision |
| --- | --- |
| [govsuite-planner](c3979709-5fc7-43dd-8a61-0f0f51bc39b1) (cadrage initial) | **GO conditionnel** R01→halt→R02→halt→R03 si préflight frais PASS |
| [govsuite-planner](058a618f-fd41-42a4-9a4e-a85d9e4bd30d) (après fatal) | **NO-GO** exécution immédiate ; pas de retry ; phase suivante non autorisée |
| [security-auditor](4ce7579e-c4ff-4889-a08d-eee9c65e27ac) | Isolation **PASS** ; STOP no-retry conforme ; Low : `Dupont` clair dans snaps |
| [postgres-engineer](4a5c891f-705c-4653-82c2-6992d63d4065) | Intégrité SQL **PASS** ; fixtures valides ; cleanup non recommandé |
| [n8n-developer](d5b5d517-09b0-4c4b-91e2-08f43accbaa4) | Chemins FIX-008 inchangés / non exercés ; note `PATH-NOTE-013.md` ; **UNCERTAIN** |
| [devops-engineer](66282904-81db-48e8-850a-9a022001e247) | Postflight safety **PASS** (inactive, version inchangée, surface activate non entrée) ; campagne **UNCERTAIN** ; next = diagnostic transport puis rerun autorisé |
| [qa-automation](703b7439-e228-40f8-8d37-15aba51c2c5c) | R01/R02/R03/global **UNCERTAIN** ; 27/27 assertions R009 **NOT_EVALUATED** ; 0 corps HTTP chat ; `tests/rec008/readiness/R013-runtime-013-qa-verdict.json` |

**Alignement parent :** Evidence / QA / DevOps / planner post-fatal — tous alignés **UNCERTAIN** + **NO-GO** rerun auto (§16–§17).

---

## 15. Verdicts par scénario

| Scénario | Verdict | Motif |
| --- | --- | --- |
| R01 | **UNCERTAIN** | transport avant activate ; 0 message |
| R02 | **UNCERTAIN** | non exécuté (STOP) |
| R03 | **UNCERTAIN** | non exécuté (STOP) |

---

## 16. Verdict global

**UNCERTAIN**

- Préflight install FIX-008 / fixtures : PASS.
- Campagne conversationnelle R01–R03 : non conclue (transport).
- Aucune preuve de régression métier FIX-008, mais **aucune preuve positive** non plus.

---

## 17. GO/NO-GO suite REC-008

| Décision | Statut |
| --- | --- |
| Clôturer 013 avec UNCERTAIN | **oui** |
| Auto-lancer une phase suivante | **NO-GO** |
| Rerun R01–R03 | **NO-GO automatique** — nécessite **nouvelle autorisation** explicite (même protocole, fixtures encore valides au moment du stop) |
| Rollback FIX-008 | **non indiqué** (pas de preuve d’échec métier) |
| Cleanup fixtures R013 | **différé** tant que UNCERTAIN (conservation forensique) |

---

## Références

- `GOVSUITE_MULTIAGENT_TEST_INSTALL_RETRY_012_REPORT.md`
- `GOVSUITE_MULTIAGENT_TEST_INSTALL_READINESS_009_REPORT.md`
- `GOVSUITE_MULTIAGENT_EXPLICIT_RESUME_FIX_008_REPORT.md`
- `GOVSUITE_MULTIAGENT_ASK_PRENOM_READINESS_007_REPORT.md`
- `AGENTS.md` / `.cursor/rules/govsuite-safety.mdc`
