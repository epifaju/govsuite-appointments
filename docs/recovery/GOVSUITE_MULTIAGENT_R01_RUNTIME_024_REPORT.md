# GOVSUITE-MULTIAGENT-R01-RUNTIME-024 — Rapport

Validation runtime TEST du scénario R01 : session `ASK_PRENOM` + message unique `Camille` → `prenom=Camille` + `ASK_EMAIL`.

**TEST uniquement. Un seul message. Zéro retry. Aucun R02/R03. Aucun LIVE. Aucun CLAIM. Aucun POST CreateAppointment. Aucun PUT workflow. Aucune recréation Docker.**

**Verdict mission : PASS**  
**R02/R03 : NO-GO** (non exécutés ; phase suivante non autorisée)

Artefacts :
- Warm/TTL : `n8n/proposed/…/runtime-013/runtime-024/`
- Campagne : `n8n/proposed/…/runtime-013/artifacts-r01-024/`

---

## 1. Préflight

| Contrôle | Observé | OK |
| --- | --- | --- |
| 5 conteneurs TEST Up | oui (postgres healthy) | oui |
| healthz `:5682` | 200 | oui |
| Runner SHA | `ef79972a87f1f6796b646864912fc495ddd65cac5ee1df71545386ff5462fe23` | oui |
| Workflow inactive / VC10 / SHA FIX-008 | confirmé au preflight runner | oui |
| 134/137, webhooks 0, running 0, attempts 0 | oui | oui |
| LIVE | non touché (`liveTouched=false`) | oui |

`preflight PASS` avant activate.

---

## 2. Audit SQL

Script campagne : `runtime-024/TTL-REFRESH-R01.sql` (durci vs 023).

| Exigence | Implémentation |
| --- | --- |
| Session exacte R01 | `WHERE session_id='…r01-active'` |
| Invariants dans UPDATE | step/pending/prenom/slot/slots/nom/dates/Camille |
| `ROW_COUNT=1` | `GET DIAGNOSTICS` + RAISE |
| Open attempts | guard `=0` |
| R02/R03 | postcheck `expires_at > NOW()` count = 0 |
| Rollback | `ON_ERROR_STOP` + RAISE dans transaction |

Sauvegarde : `BACKUP-R01-BEFORE.json` / `BACKUP-R01-AFTER-TTL.json` (booléens / longueurs / ids synthétiques).

---

## 3. Warm-up Ollama

| Mesure | Valeur |
| --- | --- |
| Appels | **1** synthétique (`/api/chat`, `keep_alive=10m`) |
| Wall | **26 118 ms** |
| `/api/ps` après | `qwen2.5:1.5b` présent, `expires_at` futur |
| Gate | **ready** (`ok`) |
| Mémoire (gate) | ~1,03 GiB / 1,5 GiB |
| Retry | **false** |

---

## 4. Refresh TTL

| Contrôle | Résultat |
| --- | --- |
| Exécution | `psql -v ON_ERROR_STOP=1 -f TTL-REFRESH-R01.sql` |
| Marqueur | `TTL_R01_OK` |
| R01 `ttl_future` | **true** |
| R02/R03 snaps | **inchangés** |
| Identité / slot / dates | non mutés (TTL + `updated_at` seuls) |

---

## 5. Activation TEST

| Champ | Valeur |
| --- | --- |
| Activate HTTP | 200 |
| `activeVersionId` | `fd75ba32…0320b` |
| Webhooks chat | GET+POST enregistrés |
| VersionCounter | **10** (pas de bump) |

---

## 6. Message

| Champ | Valeur |
| --- | --- |
| Session | `rec008-runtime013-r01-active` |
| Message | `Camille` (classe `prenom_like`) |
| Essais | **1** |
| `retried` | **false** |
| Timeout client | **180000** ms |

---

## 7. Temps de réponse

| Phase | ms |
| --- | --- |
| Chat HTTP | **77 758** |
| Settle late-write | 45 000 |
| Campagne totale (approx) | ~160 s wall process |

Pas de timeout client.

---

## 8. Résultat métier

| Attendu | Observé |
| --- | --- |
| `prenom=Camille` | oui |
| `conversation_step=ASK_EMAIL` | oui |
| `slot_id` conservé | `slotIdPresent=true` before/after |
| `nom` conservé | Dupont (len 6) |
| `pending_action=CREATE_APPOINTMENT` | oui |
| HTTP type | `create_appointment_question` |
| `claimAcquired` | false |
| `openAttempt` | null |

Stabilité : `execution_finished_business_conformant` / idle.

---

## 9. Contrôles PostgreSQL

| Contrôle | Avant | Après |
| --- | --- | --- |
| Fingerprint | `1\|14\|4\|0` | `1\|14\|4\|0` |
| Attempts ouverts | 0 | 0 |
| Mock POST CreateAppointment Δ | — | **0** |
| Mock CLAIM Δ | — | **0** |
| R02 | ASK_PRENOM, prenom null, ttl false | inchangé |
| R03 | ASK_PRENOM, prenom null, ttl false | inchangé |

---

## 10. Écritures tardives

| Observation | Valeur |
| --- | --- |
| Abort client | non |
| `updatedAtChanged` pendant settle | **true** (TTL/session déjà métier-OK à `afterImmediate`) |
| Classe late-write timeout | n/a (HTTP 200) |
| État immédiat post-chat | déjà `ASK_EMAIL` + Camille |

---

## 11. Exécutions n8n

| Instant | running | API |
| --- | --- | --- |
| Avant chat | 0 | 200 |
| Après settle | 0 | 200 |
| Postflight | 0 | available |

Note : `execution_entity` historique peut rester 0 ; preuves = REST running + PG + HTTP métier.

---

## 12. Postflight

| Contrôle | Observé |
| --- | --- |
| `active` / `activeVersionId` | false / null |
| Webhooks | **0** |
| Running | **0** (API available) |
| `safeDeclared` | **true** |
| VC10 / SHA | inchangés |
| Fixtures cleanup | non (`RUNTIME_ALLOW_CLEANUP` unset) |

---

## 13. Avis des agents

| Agent | Avis |
| --- | --- |
| [govsuite-planner](031b98a8-61ac-4ab7-9917-5409de099738) | **GO conditionnel R01** (préflight+warm+TTL) ; **NO-GO** R02/R03/LIVE/CLAIM |
| [postgres-engineer](863c0717-b92b-4e9b-ae81-4c5861155a72) | **PASS** — TTL OK ; R01 ASK_EMAIL+slot ; R02/R03 inchangés ; FP `1\|14\|4\|0` |
| [devops-engineer](b986ab67-b62f-4667-95b7-7da93b11618a) | **PASS** — warm ~26 s, gate ready, chat ~78 s &lt; 180 s, pas de Docker mutate |
| [n8n-developer](a963322c-53e7-4659-9331-a977948ed2fb) | **PASS** activate→chat→deactivate ; VC10/SHA inchangés ; postflight idle |
| [qa-automation](255788ef-f0b3-47f0-9858-1120f1dab80b) | **PASS** — HTTP 200 + ASK_EMAIL/Camille ; mock Δ0 ; `retried=false` ; R02/R03 NO-GO |
| [security-auditor](506a40f8-619f-4316-b332-563e9025958f) | **PASS** isolation — TEST 5682, 1 msg/`retried=false`, mock Δ0, R02/R03 non exécutés |
| [evidence-reviewer](5fa85c15-b14c-4e36-852e-7b81f35ef68b) | **PASS** indépendant ; R02/R03 **NO-GO** ; phase suivante non autorisée |

---

## 14. Verdict

**PASS** — métier conforme, serveur idle démontré (running=0), postflight sûr, isolation TEST, zéro retry, zéro CreateAppointment/CLAIM.

Note mineure : la ligne `issues` informative `stability:…business_conformant_idle` n’est pas un écart métier (liste non vide côté instrumentation).

---

## 15. GO / NO-GO R02 / R03

| Gate | Décision |
| --- | --- |
| R01 | **PASS** (clos) |
| R02 | **NO-GO** automatique cette mission |
| R03 | **NO-GO** automatique cette mission |
| Phase suivante | **non autorisée** (demande humaine distincte) |

**Arrêt après ce rapport.**
