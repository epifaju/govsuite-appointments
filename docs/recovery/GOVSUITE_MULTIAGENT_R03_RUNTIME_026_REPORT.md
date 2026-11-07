# GOVSUITE-MULTIAGENT-R03-RUNTIME-026 — Rapport

Validation runtime TEST du scénario R03 : session `ASK_PRENOM` **expirée** + message unique `reprendre` → reprise explicite (TTL renouvelé), `prenom` reste `NULL`, pas de réservation.

**TEST uniquement. Un seul message. Zéro retry. Aucun refresh TTL manuel. Aucun R01/R02. Aucun LIVE. Aucun CLAIM. Aucun POST CreateAppointment. Aucun PUT workflow. Aucune recréation Docker.**

**Verdict mission : PASS**  
**R01 / R02 / phase suivante : NO-GO**

Artefacts :
- Contrat / warm / backup / postcheck : `n8n/proposed/…/runtime-013/runtime-026/`
- Campagne : `n8n/proposed/…/runtime-013/artifacts-r03-026/`
- QA : `tests/rec008/readiness/R026-r03-runtime-qa-verdict.json`, `tests/rec008/reports/R03-RUNTIME-026-qa-verdict.md`

---

## 1. Contrat R03 confirmé

Sources : FIX-008 (`explicitResumeMsg` inclut `reprendre`), `assertR03` (`run-runtime-013.js`), rapports 018/019/025.

| Règle | Attendu |
| --- | --- |
| Message | exact folded `reprendre` (liste explicite FIX-008) |
| TTL | **renouvelé** uniquement si reprise explicite (`refreshSessionTtl=true`) |
| `prenom` | reste **NULL** (pas capturé comme « reprendre ») |
| Step | reste **ASK_PRENOM** (pas ASK_EMAIL) |
| Draft | nom / slot / dates / slots préservés |
| HTTP métier | **pas** `session_expired` ; invite au prénom |
| Type observé cible | `create_appointment_question` (collecte identité) |
| CLAIM / POST | interdits / Δ0 |

Contrat **non ambigu** → exécution autorisée.

---

## 2. Préflight

| Contrôle | Observé | OK |
| --- | --- | --- |
| Projet `govsuite-rec008-test` | 5 conteneurs Up (postgres healthy) | oui |
| healthz `:5682` | 200 | oui |
| Runner SHA | `ef79972a87f1f6796b646864912fc495ddd65cac5ee1df71545386ff5462fe23` | oui |
| Workflow inactive | oui | oui |
| VC / VersionId | **10** / `fd75ba32…0320b` | oui |
| SHA FIX-008 | `f75d4984…17fe` | oui |
| Webhooks / running / attempts | 0 / 0 / 0 | oui |
| Fingerprint | `1\|14\|4\|0` | oui |
| LIVE | `liveTouched=false` | oui |

`preflight PASS` (`artifacts-r03-026/preflight.json`).

---

## 3. Fixture R03 (avant)

Session `rec008-runtime013-r03-resume` (`BACKUP-BEFORE.json`) :

| Champ | Attendu | Observé |
| --- | --- | --- |
| step / pending | ASK_PRENOM / CREATE_APPOINTMENT | oui |
| prenom | NULL | oui |
| slot / nom / dates / slots | présents / cohérents | oui |
| `expires_at < NOW()` | strict | oui (`2026-11-05 22:05:47…+01`) |
| Camille | absent | msg len 0 |
| TTL manuel | **interdit** | non exécuté |

Baselines :
- R01 : ASK_EMAIL, prenom len 7, Camille ; TTL déjà passé wall-clock depuis 024 (non muté ici)
- R02 : ASK_PRENOM, prenom null, msg Camille post-025

---

## 4. Warm-up Ollama

| Mesure | Valeur |
| --- | --- |
| Appels | **1** (`keep_alive=10m`) |
| Wall | **42 697 ms** |
| Gate `/api/ps` | **ready** |
| Mémoire | ~1,21 GiB / 1,5 GiB |
| Retry | false |
| Timeout chat | **180000** ms |

---

## 5. Activation TEST

| Champ | Valeur |
| --- | --- |
| Activate | 200 ; `activeVersionId=fd75ba32…` |
| Webhooks | GET+POST chat |
| VC | **10** (pas de bump) |

---

## 6. Message unique

| Champ | Valeur |
| --- | --- |
| Session | `rec008-runtime013-r03-resume` |
| Message | `reprendre` (`resume_cmd`) |
| Essais | **1** |
| `retried` | **false** |
| Timeout | 180000 ms |
| HTTP elapsed | **55 244 ms** |

---

## 7. Réponse HTTP et métier

| Couche | Résultat |
| --- | --- |
| Transport | HTTP **200** |
| Type | **`create_appointment_question`** |
| Texte | « Merci. Quel est votre **prénom** ? » |
| `claimAcquired` | false |
| `openAttempt` | null |
| `attemptAction` | COLLECT |

HTTP 200 = reprise + invite prénom — **≠** capture de « reprendre » comme prénom.

---

## 8. État PostgreSQL

| Champ R03 | Avant | Après |
| --- | --- | --- |
| step | ASK_PRENOM | ASK_PRENOM |
| prenom | null | **null** |
| nom | Dupont | Dupont |
| slot | présent | présent |
| intent | GENERAL | CREATE_APPOINTMENT |
| `last_user_message` | len 0 | len 9 (`reprendre`) |
| `expires_at` | 2026-11-05 22:05… | **2026-11-07 00:37…** |
| ttlActive | false | **true** |

---

## 9. TTL avant / après

| | Avant | Après |
| --- | --- | --- |
| R03 | expiré | **futur** (renew via reprendre) |
| Manuel | non | non |

---

## 10. Écritures tardives

| Observation | Valeur |
| --- | --- |
| Settle | 45 000 ms |
| Running after settle | 0 |
| Stabilité | `execution_finished_business_conformant` |
| État immédiat post-chat | déjà conforme (TTL+, prenom null) |

---

## 11. Contrôles mock

| Compteur | Δ |
| --- | --- |
| POST CreateAppointment | **0** |
| CLAIM | **0** |
| Fingerprint | `1\|14\|4\|0` → `1\|14\|4\|0` |
| Attempts ouverts | 0 |

---

## 12. Postflight

| Contrôle | Observé |
| --- | --- |
| `active` / `activeVersionId` | false / null |
| Webhooks / running | 0 / 0 |
| `safeDeclared` | true |
| VC10 / SHA | inchangés |
| Cleanup fixtures | non |

R01/R02 (`POSTCHECK-R01-R02.json`) : **inchangées** vs baselines.

---

## 13. Avis des agents

| Agent | Avis |
| --- | --- |
| [govsuite-planner](bf1556ba-ae30-4d18-b94d-17fe1a677bfc) | **GO conditionnel R03** ; contrat non ambigu ; **NO-GO** R01/R02/LIVE/TTL manuel/auto-next |
| [n8n-developer](280d63e4-7240-45fe-bec9-58141e0f30e6) | **PASS** hors ligne — allowlist foldée `reprendre` ; TTL+ ; step ASK_PRENOM ; `create_appointment_question` |
| [postgres-engineer](beb98786-c49c-4dd9-a63f-e8da9d608ad5) | **PASS** — TTL renew R03 seul ; prenom null ; R01/R02 inchangés ; FP stable |
| [devops-engineer](cb913af9-f0e8-45df-9800-d3152f9ec09c) | **PASS** — warm 42697 ms, chat 55244 ms, postflight idle, pas de Docker mutate |
| [qa-automation](25df470a-7bef-44c9-a2e7-5492e49591b9) | **PASS** — assertR03 OK ; artefacts `R026-r03-runtime-qa-verdict.json` / `R03-RUNTIME-026-qa-verdict.md` ; R01/R02/auto-next **NO-GO** |
| [security-auditor](7946acaa-81b4-47c5-a96f-58dececacee8) | **PASS** isolation — TEST 5682, 1 msg, `retried=false`, mock Δ0 (Low : nom synthétique en clair artefacts) |
| [evidence-reviewer](29386d24-527c-4f5f-839e-5877c96a03a0) | **PASS** indépendant — HTTP≠métier distingués ; TTL+ vs R02 ; R01/R02/auto-next **NO-GO** |

---

## 14. Verdict

**PASS** — reprise explicite reconnue ; TTL renouvelé ; prénom non capturé ; step ASK_PRENOM ; mock Δ0 ; postflight sûr ; isolation TEST.

---

## 15. Synthèse R01 / R02 / R03

| Campagne | Mission | Résultat |
| --- | --- | --- |
| R01 | RUNTIME-024 | **PASS** (Camille → ASK_EMAIL) |
| R02 | RUNTIME-025 | **PASS** (Camille → session_expired) |
| R03 | RUNTIME-026 | **PASS** (reprendre → TTL+ / ASK_PRENOM) |

Catalogue ASK-PRENOM runtime TEST **clos** pour R01–R03.

---

## 16. Recommandations (non exécutoires)

- Ne pas enchaîner automatiquement une nouvelle mission.
- Prochaine étape humaine éventuelle : revue consolidée REC-008 / critères de sortie, hors runtime chat.
- R01 a un TTL naturellement expiré wall-clock ; ne pas le « réparer » sans mission dédiée.

**Arrêt après ce rapport.**
