# GOVSUITE-MULTIAGENT-SECURITY-POST-R0X-029 — Rapport

Audit de sécurité **lecture seule** post-clôture ASK_PRENOM / FIX-008 (028), avant campagnes futures R04–R07.

**Aucune activation. Aucun chat. Aucune Ollama. Aucune mutation PG/Docker. Aucun CLAIM/POST. Aucun accès LIVE (même healthcheck). Aucun rejeu R0x.**

**Verdict audit documentaire : PASS** (contrôles R0x + isolation déclarative TEST cohérents)  
**LIVE : NO-GO** · **R07 CLAIM/POST mock runtime : NO-GO** · **R04–R06 runtime : NO-GO** (prep docs **GO-CONDITIONAL**)

Légende protections CREATE : **P** = prouvée runtime · **I** = implémentée non testée · **A** = absente · **U** = inconclusive

---

## 1. Synthèse exécutive

| Zone | Constat |
| --- | --- |
| ASK_PRENOM / FIX-008 | Clos TEST (E1–E7) ; mock Δ0 **≠** preuve anti-double-réservation |
| Isolation TEST | Compose `govsuite-rec008-test`, bind `127.0.0.1:5682`, réseau `rec008_test` internal ; runner `livePortForbidden=5680` ; **LIVE non joint** |
| PII | Champs identité en clair dans PG + artefacts (synthétiques R0x) ; redaction incomplete (Low→Medium avant R04 email) |
| CREATE aval | Confirm / CLAIM / POST / concurrence : **I** ou **U** — High bloquants avant R06/R07 |
| Runner 021 | 0 retry, gate Ollama, settle, deactivate : **P** sur R01–R03 |

Aucun Critical observé sur le périmètre déjà exécuté. **High** = gaps avant élargissement du parcours.

---

## 2. Inventaire des surfaces d’attaque

| Surface | Exposition | Notes |
| --- | --- | --- |
| Proxy publish `:5682` | localhost only | Relais vers n8n ; pas de TLS (`N8N_SECURE_COOKIE=false` TEST) |
| Réseau `rec008_test` | internal | PG / mock / ollama non publiés hôte |
| Workflow chat TEST | `OCD9It1uKFhOoWNF` | Activate temporaire R0x ; postflight idle |
| Mock CreateAppointment | réseau interne | Scénario `created` ; Δ0 sur R0x |
| `ai_conversation_state` | PG TEST | Identité + `last_user_message` + slot |
| `ai_appointment_attempt` / RDV | PG TEST | Non mutés R0x ; cible R07 |
| Artefacts JSON/MD | disque repo | Snaps session / HTTP body |
| Credentials | `.env.rec008-test.local` (hors commit attendu) | Compose exige vars ; **non dumpées** ici |
| LIVE (`:5680` typique) | hors mission | **Non contacté** |

---

## 3. Isolation TEST / LIVE

| Contrôle | Preuve statique | OK |
| --- | --- | --- |
| Projet Compose | `name: govsuite-rec008-test` | oui |
| Port hôte n8n | `127.0.0.1:5682:5682` (publish) | oui |
| `WEBHOOK_URL` / editor | `http://localhost:5682/` | oui |
| Réseau métier | `rec008_test` **internal: true** | oui |
| DB name | `govsuite_rec008_test` | oui |
| Runner isolation | `n8nTestPort:5682`, `livePortForbidden:5680`, `liveTouched:false` (024–026) | oui |
| Volumes distincts | `rec008_*_data` | oui |
| LIVE joint | **interdit / non fait** | n/a |

**Risque résiduel :** stack LIVE distinct (`govsuite-appointments`, port **5680**, bind potentiellement large) peut coexister sur le même hôte que TEST (`127.0.0.1:5682`) — confusion d’URL/credentials = **FAIL** opérationnel si omis en préflight. LIVE **non joint** (HTTP). Drift doc : compose 8E-2B-2 disque sans Ollama vs overlay **8E-2B-4** runtime.

Secrets : référencés par nom (`REC008_POSTGRES_PASSWORD`, `REC008_N8N_ENCRYPTION_KEY`, owner n8n) — **valeurs non reproduites**.

---

## 4. Protection des données

| Donnée | Stockage | Artefacts R0x | Risque |
| --- | --- | --- | --- |
| nom / prenom | `ai_conversation_state` clair | clair (synthétique) | Low→Med si email réel en R04 |
| email / téléphone | colonnes dédiées | absents R0x | **High** dès R04/R05 si dumps HTTP |
| `last_user_message` | clair | preview claire | Med |
| Tokens RDV | hors R0x | — | High si logs n8n |
| sessionId | clair dans HTTP | présent | Low (synthétique) ; préférer hash |
| Logs n8n / PG | rétention **U** (`execution_entity` souvent vide) | — | Med (debug vs fuite) |

### Mesures proposées (docs / prep — pas d’exécution)

1. Snapshots : `nomPresent` / `nomLen` / `emailLen` / hash non réversible — pas de clair (B9).
2. Interdire commit de `.env*` et d’exports n8n avec PII.
3. Mission purge fixtures TEST sous autorisation explicite.
4. Politique conservation `last_user_message` / exécutions n8n.
5. Corrélation runner : conserver `sessionIdHash` + `runToken` (déjà en place).

---

## 5. Confirmation explicite

| Mécanisme | Classe | Commentaire |
| --- | --- | --- |
| `AWAIT_CREATE_CONFIRMATION` + AFFIRM | **I** runtime ; **P** offline (K01) | Allowlist Parser → CLAIM gate ; **pas** E2E post-FIX |
| « oui » ambigu | **P** offline (K03/S10) ; **I** runtime | Re-ask / Δ0 ; variantes floues non ciblées |
| Invalidation `modifyField` | **I** | Détection Parser **P** offline ; null SQL + step **non** assertés |
| `skipCreateProgression` | **I** + Medium (018) | Force AWAIT/RECALL/UNCERTAIN **sans** re-check `slotId` ; diag-017 force flag false |
| Ladder identité → confirm avec `slotId` | **I** | Gate `else if (slotId)` avant confirm |

**Bloquant R06 :** pas de preuve **runtime** AFFIRM sans POST (offline ≠ runtime).

---

## 6. Idempotence et concurrence

| Protection | Classe | Commentaire |
| --- | --- | --- |
| `creer_rendez_vous_idempotent` / `FOR UPDATE` | **I** | Schéma/tests SQL préparés ; **pas** R0x |
| Clé idempotence attempt | **I** | Indexes partiels ; non exercés |
| CLAIM / lease (`reclamer_*`, bail) | **I** | Jamais runtime R01–R03 |
| 409 SLOT_UNAVAILABLE / KEY_CONFLICT | **I** | Mock capable ; non joué |
| Fingerprint `1\|14\|4\|0` stable | **P** (anti-régression locale) | **≠** preuve anti-collision |
| UNIQUE « 1 RDV actif / place » hors fonction | **A** / **U** | Dépend chemins INSERT |

**Bloquant R07 :** double-book / lease / replay **non prouvés**.

---

## 7. Gestion des erreurs

| Cas | Classe | Notes |
| --- | --- | --- |
| Timeout chat client | **P** (policy) | 180 s après warm ; 0 retry R0x |
| Transport ambigu → UNCERTAIN | **P** (runner) | STOP ; pas de second message |
| POST 500 / timeout Create | **I** | Hors R0x ; clé à conserver (safety) |
| Late-write PG | **P** partiel | Settle 45 s ; classes stabilité 021 |
| Rétention exécutions n8ud | **U** | Attribution nœud impossible |

---

## 8. Sécurité du runner

| Contrôle | Statut R0x |
| --- | --- |
| Zéro retry | **P** (`retried=false`) |
| Timeout gated warm | **P** |
| Préflight (SHA/VC/webhooks/attempts) | **P** |
| Gate `/api/ps` | **P** |
| Corrélation sans email/tél | **P** (hash/token) ; noms parfois clairs |
| Settle late-write | **P** |
| Deactivate + verify webhooks 0 | **P** |
| Running poll API | **P** |
| `RUNTIME_ONLY` périmètre | **P** |
| Erreurs API → escalate deactivate | **P** (chemins fail) |

---

## 9. Matrice des risques

| ID | Scénario | Impact | Prob. | Criticité | Preuve | Correctif | Validation | Mission |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-01 | Confusion URL/credentials LIVE | Haute | Med | **High** | Compose + runner ports | Préflight refuse ≠5682 / liveTouched | Checklist préflight | Toute runtime |
| R-02 | Email réel dans artefacts HTTP | Haute | Med dès R04 | **High** | Pattern R0x clair | Redaction len/hash | Revue artefacts | R04-PREP |
| R-03 | AFFIRM sans slot via `skipCreateProgression` | Haute | Med | **High** | Code Gérer 018 | Patch hors ligne + test | Offline + R06 | FIX-skip + R06 |
| R-04 | Double CLAIM/POST | Haute | Med | **High** | Non testé | Scénarios concurrence | R07 mock strict | R07 |
| R-05 | Retry auto après timeout Create | Haute | Low (policy) | **High** | Safety + runner | Garder 0 retry | Assert `retried=false` | R06/R07 |
| R-06 | « oui » ambigu → mutation | Med | Med | **Medium** | PRD | Re-ask sans side-effect | Runtime R06 | R06 |
| R-07 | modifyField sans abandon tentative | Med | Med | **Medium** | Code | Test CONV-07 | Runtime dédié | post-R06 |
| R-08 | Fuite token dans logs n8n | Haute | Low–Med | **Medium** | Rétention U | Politique saveData/prune | Audit logs | OBS-028+ |
| R-09 | PII synthétique en repo | Low | High | **Low** | Artefacts 024–026 | B9 redaction | Grep CI | AP-DOC/B9 |
| R-10 | Mock `created` trop permissif | Med | Med | **Medium** | Compose mock | Scénarios 409/500 | R07 matrix | R07-PREP |

---

## 10. Plan de remédiation priorisé

| Prio | Action | Type |
| --- | --- | --- |
| P0 | Figer gates R04–R07 (ce rapport) — **pas d’auto-runtime** | docs |
| P0 | Prep redaction artefacts avant tout email réel | docs/tooling |
| P0 | Revue/patch offline `skipCreateProgression` + slot re-check | n8n/proposed |
| P1 | Mission prep R04 (contrat email + assert + fixtures) | docs |
| P1 | SQL offline concurrence Create (BEGIN/ROLLBACK) | postgres readonly/exec auth |
| P1 | Observabilité rétention n8n TEST | devops auth |
| P2 | Purge fixtures / B9 | auth |
| P2 | Variantes allowlist resume | offline |

---

## 11. Gates de sécurité R04–R07 / LIVE

| Gate | Prep docs / contrat | Exécution runtime | Conditions bloquantes |
| --- | --- | --- | --- |
| **R04** email | **GO-CONDITIONAL** | **NO-GO** | Auth humaine ; 1 msg ; redaction ; Δ CLAIM/POST=0 ; seed post-R01 OPTION A |
| **R05** téléphone | **GO-CONDITIONAL** après R04 clos | **NO-GO** | Idem ; validation format |
| **R06** confirm sans POST | **GO-CONDITIONAL** après R05 + revue skipCreate | **NO-GO** | AFFIRM ; mock POST **interdit** ; openAttempt contrôlé |
| **R07** CLAIM+POST mock | **HOLD** | **NO-GO** | Security + postgres concurrence ; ΔPOST=1 exact ; fingerprint ; 0 retry |
| **LIVE** | **NO-GO** | **NO-GO** | Auth/RGPD/tokens/isolation LIVE non prouvés |

Prep ≠ runtime. Une mission prep n’autorise pas le chat.

---

## 12. Avis multi-agents

| Agent | Avis |
| --- | --- |
| [security-auditor](4d01bbac-d6b8-403f-b43a-407915f99685) | **PASS** audit ASK_PRENOM/isolation ; CREATE/CLAIM/LIVE **NO-GO** |
| [govsuite-planner](ea9323c8-374f-4981-bf9e-52a157ce73c1) | Prep docs **GO** ; runtime R04–R07/LIVE **NO-GO** |
| [n8n-developer](f6c9c72a-9c05-4c0f-85ff-7c8d2198da2f) | **PASS** analyse — skipCreate/modifyField **I** ; AFFIRM ambigu **P** offline ; CLAIM E2E **NO-GO** |
| [postgres-engineer](3822b9c7-582e-44d1-805e-ef735924d091) | **UNCERTAIN** Create R0x ; 7H/7I/8D2 hors chat ; openAttempts=0 = garde identité seulement |
| [devops-engineer](0b33257d-25cd-416c-913f-88684e487d4e) | **PASS** — projets/réseaux/volumes disjoints ; LIVE `:5680` non joint ; TEST loopback |
| [qa-automation](358b7f0c-16a3-4ccc-ba66-183137997767) | **PASS** — `REC008_R04_R07_SECURITY_TEST_CRITERIA.md` + R029 JSON ; prep **GO** / runtime **NO-GO** |
| [evidence-reviewer](f82c8312-1b25-478c-af23-14e288b47ade) | **PASS** docs — 028 n’autorise ni R07 ni LIVE ; Δ0 ≠ anti-collision |

---

## 13. Verdict

| Item | Décision |
| --- | --- |
| Mission documentaire 029 | **PASS** |
| Isolation TEST déclarative | **PASS** (LIVE non joint) |
| Élargir PASS ASK_PRENOM à CREATE/CLAIM | **FAIL** si déclaré — ici **évité** |
| R04–R06 runtime | **NO-GO** |
| R07 runtime | **NO-GO** |
| LIVE | **NO-GO** |
| Auto-next | **NO-GO** |

**INCONCLUSIVE** (sous-zones) : rétention exécutions n8n ; efficacité réelle anti-collision Create sans test.

Compléments QA (docs only) :
- `docs/recovery/REC008_R04_R07_SECURITY_TEST_CRITERIA.md`
- `tests/rec008/runtime/STOP-CONDITIONS-R04-R07.md`
- `tests/rec008/readiness/R029-r04-r07-security-test-criteria.json`
- `tests/rec008/reports/SECURITY-POST-R0X-029-qa-criteria.md`

**Arrêt après ce rapport.**
