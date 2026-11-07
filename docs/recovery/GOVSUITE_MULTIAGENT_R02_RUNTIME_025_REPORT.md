# GOVSUITE-MULTIAGENT-R02-RUNTIME-025 — Rapport

Validation runtime TEST du scénario R02 : session `ASK_PRENOM` **expirée** + message unique `Camille` → refus de collecte implicite (`session_expired`), `prenom` reste `NULL`.

**TEST uniquement. Un seul message. Zéro retry. Aucun refresh TTL R02. Aucun R01/R03. Aucun LIVE. Aucun CLAIM. Aucun POST CreateAppointment. Aucun PUT workflow. Aucune recréation Docker.**

**Verdict mission : PASS**  
**R01 / R03 / phase suivante : NO-GO**

Artefacts :
- Warm / backup / postcheck : `n8n/proposed/…/runtime-013/runtime-025/`
- Campagne : `n8n/proposed/…/runtime-013/artifacts-r02-025/`
- QA : `tests/rec008/readiness/R025-r02-runtime-qa-verdict.json`, `tests/rec008/reports/R02-RUNTIME-025-qa-verdict.md`

---

## 1. Préflight

| Contrôle | Observé | OK |
| --- | --- | --- |
| 5 conteneurs TEST Up | oui (postgres healthy) | oui |
| healthz `:5682` | 200 | oui |
| Runner SHA | `ef79972a87f1f6796b646864912fc495ddd65cac5ee1df71545386ff5462fe23` | oui |
| Workflow `OCD9It1uKFhOoWNF` inactive | oui | oui |
| VersionCounter / VersionId | **10** / `fd75ba32-f018-40e4-9f79-8f2a5400320b` | oui |
| SHA FIX-008 (Gérer) | `f75d49849231f956bb9ae5383111ea84b362dc58de6711cc75d2e7e2a26917fe` | oui |
| Nodes / edges | 134 / 137 | oui |
| Webhooks / running / attempts | 0 / 0 / 0 | oui |
| Fingerprint | `1\|14\|4\|0` | oui |
| LIVE | `liveTouched=false` ; port 5680 non utilisé | oui |

`preflight PASS` avant activate (`artifacts-r02-025/preflight.json`).

---

## 2. Contrat R02 (avant)

Session `rec008-runtime013-r02-expired` (`BACKUP-BEFORE.json` + `R02-before.json`) :

| Champ | Attendu | Observé |
| --- | --- | --- |
| `conversation_step` | ASK_PRENOM | oui |
| `pending_action` | CREATE_APPOINTMENT | oui |
| `slot_id` | présent | oui |
| `nom` | présent (synthétique) | oui |
| `prenom` | null | oui |
| `expires_at < NOW()` | strict | oui (`2026-11-05 22:05:47…+01`) |
| Résidu Camille | absent | `last_user_message_len=0` |
| Attempts ouverts | 0 | oui |
| Refresh TTL R02 | **interdit** | non exécuté (`ttl_refresh_r02=false`) |

Baselines croisées avant campagne :
- R01 post-024 : `ASK_EMAIL`, prenom len 7, Camille msg, ttl future
- R03 : `ASK_PRENOM`, prenom null, pas Camille, ttl false

---

## 3. Warm-up Ollama

| Mesure | Valeur |
| --- | --- |
| Appels | **1** synthétique (`keep_alive=10m`) |
| Wall | **8 443 ms** |
| `/api/ps` après | `qwen2.5:1.5b` présent, `expires_at` futur |
| Gate | **ready** (`ok`) |
| Mémoire | ~1,21 GiB / 1,5 GiB |
| Retry | **false** |
| Timeout chat autorisé | **180000** ms |

---

## 4. Activation TEST

| Champ | Valeur |
| --- | --- |
| Activate HTTP | 200 |
| `activeVersionId` | `fd75ba32…0320b` |
| Webhooks chat | GET + POST enregistrés |
| VersionCounter | **10** (pas de bump) |
| Gate Ollama pré-chat | ready / modelPresent |

---

## 5. Message unique

| Champ | Valeur |
| --- | --- |
| Session | `rec008-runtime013-r02-expired` |
| Message | `Camille` (classe `prenom_like`) |
| Essais | **1** |
| `retried` | **false** |
| Timeout client | **180000** ms |

---

## 6. Réponse HTTP vs métier

| Couche | Résultat |
| --- | --- |
| Transport | HTTP **200**, `elapsedMs=48345`, non aborté |
| Signal métier | `type=session_expired` |
| Texte | invitation à « reprendre » ou nouvelle demande (sans collecte prénom) |

HTTP 2xx ≠ capture de prénom : le 200 porte le **refus métier** attendu.

---

## 7. Assertions métier

| Attendu | Observé |
| --- | --- |
| Signal expiration | oui (`session_expired`) |
| `prenom` NULL | **oui** (before / afterImmediate / after settle) |
| Pas de passage `ASK_EMAIL` | step reste **ASK_PRENOM** |
| Pas de capture implicite du prénom | **oui** |
| TTL non renouvelé | `expires_at` **identique** ; `ttlAfter=false` |
| CreateAppointment / CLAIM | Δ **0** / **0** |
| Fingerprint | `1\|14\|4\|0` → `1\|14\|4\|0` |
| Attempts ouverts | 0 → 0 |

### Écriture technique autorisée (documentée)

| Champ | Avant | Après |
| --- | --- | --- |
| `last_user_message` | len 0 | len **7** (texte Camille) |
| `updated_at` | `2026-11-05 23:05:47…` | `2026-11-06 19:56:26…` |
| `expires_at` | figé | **inchangé** |
| `prenom` / step / pending | ASK_PRENOM / null / CREATE… | **inchangés** |

Conforme au contrat §6 : trace de message ≠ promotion en `prenom`.

Stabilité : `execution_finished_business_conformant` / idle.

---

## 8. Contrôles PostgreSQL (R01 / R03)

Postcheck readonly SELECT (`runtime-025/POSTCHECK-R01-R03.json`) après campagne :

| Session | Observé | vs baseline |
| --- | --- | --- |
| R01 | `ASK_EMAIL`, prenom len 7, Camille msg, ttl future | **inchangé** |
| R02 | `ASK_PRENOM`, prenom null, ttl false, `expires_at` figé, msg len 7 | conforme R02 |
| R03 | `ASK_PRENOM`, prenom null, pas Camille, ttl false | **inchangé** |
| Fingerprint | `1\|14\|4\|0` | stable |

---

## 9. Observabilité

| Élément | Valeur |
| --- | --- |
| Warm | 8443 ms |
| Chat HTTP | 48345 ms |
| Settle late-write | 45 000 ms |
| Running before chat / after settle | 0 / 0 (API available) |
| `updatedAtChanged` (settle) | **true** (écriture technique message) |
| Webhooks après deactivate | 0 |

---

## 10. Postflight

| Contrôle | Observé |
| --- | --- |
| `active` / `activeVersionId` | false / null |
| Webhooks | **0** |
| Running | **0** (API available) |
| `safeDeclared` | **true** |
| VC10 / SHA FIX-008 | inchangés |
| Fixtures cleanup | non (`RUNTIME_ALLOW_CLEANUP` unset) |

---

## 11. Avis des agents

| Agent | Avis |
| --- | --- |
| [govsuite-planner](1f58ed6d-780c-47a0-921a-13d7fb53a313) | **GO conditionnel R02** (préflight+warm+gate) ; **NO-GO** R01/R03/LIVE/TTL refresh/auto-next |
| [postgres-engineer](bab6fe27-8a80-4e29-b558-c8d6e10164f1) | **PASS** — ASK_PRENOM + prenom null + `expires_at` figé ; side-effect `last_user_message` OK ; FP stable |
| [devops-engineer](f3d62fdc-f4b4-4c2c-9c0d-362e1f7c5150) | **PASS** — warm ~8 s, gate ready, chat ~48 s &lt; 180 s, pas de Docker mutate |
| [n8n-developer](e4f50413-8f04-4c27-a9e0-7052950b0a33) | **PASS** activate→chat→deactivate ; VC10/SHA inchangés ; postflight idle |
| [qa-automation](87b30866-739f-4e58-ad22-7d92ef397f3e) | **PASS** — `session_expired`, prenom null, pas ASK_EMAIL, mock Δ0, `retried=false` |
| [security-auditor](e380b611-702e-44a8-98f0-56b958988c04) | **PASS** isolation — TEST 5682, 1 msg/`retried=false`, `liveTouched=false`, pas TTL refresh R02 |
| [evidence-reviewer](af9dfaf8-356c-4192-866c-596d3a045a18) | **PASS** indépendant ; R01/R03/auto-next **NO-GO** ; caveat snap R01/R03 clos par `POSTCHECK-R01-R03.json` (SELECT-only post-revue) |

---

## 12. Verdict

**PASS** — expiration correctement traitée ; prénom non capturé ; aucun effet métier interdit ; serveur idle démontré ; postflight sûr ; isolation TEST ; zéro retry ; zéro CreateAppointment/CLAIM.

Note : la ligne `issues` informative `stability:…business_conformant_idle` n’est pas un écart métier (instrumentation).

---

## 13. GO / NO-GO

| Gate | Décision |
| --- | --- |
| R02 | **PASS** (clos) |
| R01 | **NO-GO** automatique cette mission |
| R03 | **NO-GO** automatique cette mission |
| Phase suivante | **non autorisée** (demande humaine distincte) |

**Arrêt après ce rapport.**
