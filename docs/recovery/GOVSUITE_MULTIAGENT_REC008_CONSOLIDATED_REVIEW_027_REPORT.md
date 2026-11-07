# GOVSUITE-MULTIAGENT-REC008-CONSOLIDATED-REVIEW-027 — Rapport

Revue consolidée **lecture seule** du chantier REC-008 après validations runtime TEST R01 / R02 / R03.

**Aucune activation n8n. Aucun chat. Aucune Ollama. Aucune mutation PG. Aucun PUT. Aucun Docker mutate. Aucun LIVE. Aucune campagne supplémentaire.**

**Verdict consolidé (périmètre ASK-PRENOM R01–R03) : PASS**  
**LIVE / CreateAppointment end-to-end / auto-next : NO-GO**

Légende preuves : **O** = offline · **R** = runtime TEST · **N** = non testé · **I** = inconclusif

---

## 1. Synthèse exécutive

Le workflow TEST (`OCD9It1uKFhOoWNF`, VC10, Gérer FIX-008 `f75d4984…`) a démontré en runtime, sur fixtures OPTION A (019), les trois comportements critiques autour de `ASK_PRENOM` :

| Scénario | Mission | Métier | Preuve |
| --- | --- | --- | --- |
| Capture prénom active | R01-024 | `Camille` → `ASK_EMAIL` | **R PASS** |
| Expiration sans capture | R02-025 | `Camille` → `session_expired`, prenom null | **R PASS** |
| Reprise explicite | R03-026 | `reprendre` → TTL+, ASK_PRENOM, invite prénom | **R PASS** |

Chaque campagne : **1 message**, **`retried=false`**, mock CreateAppointment/CLAIM **Δ0**, postflight idle, isolation TEST `:5682`.

**Maturité réelle :** le sous-ensemble FIX-008 / identité post-créneau / expiration / reprise est **prouvé en TEST**. Le parcours CREATE complet (recherche créneaux → confirmation → CLAIM → POST), GET/CANCEL/RESCHEDULE, et toute évolution LIVE restent **non validés runtime** dans ce chantier.

---

## 2. Matrice PRD → implémentation → tests → preuves

| Exigence PRD | Implémentation | Tests | Preuves | Statut | Risque résiduel |
| --- | --- | --- | --- | --- | --- |
| F-06 Collecte progressive (identité après créneau) | Gérer VC10 ladder + gate `slotId` (018) | Offline 018/019 ; R01 runtime partiel (un pas ASK_PRENOM→ASK_EMAIL) | O 018/019 ; R 024 | **Partiel R** | Chaîne ASK_EMAIL→TEL→confirm **N** |
| Contexte / brouillon préservé | `preserveDraft`, Fusionner + Sauvegarder | Offline FIX-008 ; R02/R03 nom/slot | O 008 ; R 025/026 | **Partiel R** | Contaminations BUG-01/02 hors R0x **N** |
| Expiration déterministe | `session_expired` si expiré sans allowlist | assertR02 ; R02 | R 025 | **PASS R** | Phrases hors allowlist **N** |
| Reprise explicite `reprendre` | Early-return FIX-008 + TTL+ | Offline 008 ; assertR03 ; R03 | O 008 ; R 026 | **PASS R** | Variantes allowlist (`continuer…`) **N** |
| Validation champs (email/tél) | Nœuds validation + Gérer | Offline partiel | — | **N** | Erreurs format / injection **élevé** si prod |
| F-04/F-05 Recherche & sélection créneaux | GetAvailability + ASK_CREATE_SLOT | Offline / campagnes historiques 8F2B | O partiel | **N** (pas R01–R03) | Liste ≠ garantie (PRD) |
| Confirmation explicite CREATE | `AWAIT_CREATE_CONFIRMATION` + AFFIRM | Offline contrat 018 | — | **N** | Double « oui » / skipCreateProgression (Medium 018) |
| Idempotence / CLAIM | `ai_appointment_attempt`, clés | Contrats SQL ; R0x mock Δ0 seulement | R anti-régression Δ0 | **N** chemin heureux | Double réservation **élevé** sans test CLAIM |
| Gestion erreurs (timeout/réseau) | Runner 021 : UNCERTAIN, 0 retry | Offline 021 ; timeouts 016 | O 016/021 ; R non forcé | **Partiel O** | Rétention `execution_entity=0` (**I**) |
| F-09/F-10 Annulation / replan | Workflows dédiés | Hors REC-008 R0x | — | **N** | Confirmation / idempotence **élevé** |
| §11 Protection PII | Règles safety ; artefacts expurgés partiels | Audits security 024–026 | R isolation OK | **Partiel** | `nom` synthétique en clair artefacts (Low) ; tokens/logs **N** |

---

## 3. Résultats R01 / R02 / R03

| Critère | R01-024 | R02-025 | R03-026 |
| --- | --- | --- | --- |
| Verdict | **PASS** | **PASS** | **PASS** |
| Messages | 1× `Camille` | 1× `Camille` | 1× `reprendre` |
| Retry | false | false | false |
| HTTP | 200 | 200 | 200 |
| Type métier | `create_appointment_question` | `session_expired` | `create_appointment_question` |
| Step après | ASK_EMAIL | ASK_PRENOM | ASK_PRENOM |
| prenom | Camille | null | null |
| TTL | futur (refresh SQL pré-campagne) | non renouvelé | renouvelé (workflow) |
| CLAIM / POST Δ | 0 / 0 | 0 / 0 | 0 / 0 |
| Fingerprint | `1\|14\|4\|0` | idem | idem |
| Postflight | idle, webhooks 0 | idle | idle |
| Isolation | TEST 5682 | TEST 5682 | TEST 5682 |
| Sessions croisées | R02/R03 OK | R01/R03 OK (+ POSTCHECK) | R01/R02 OK (+ POSTCHECK) |
| Chat ms | **77 758** | **48 345** | **55 244** |
| Warm ms | ~26 118 | ~8 443 | ~42 697 |

Sources : rapports 024–026 + `artifacts-r0{1,2,3}-02{4,5,6}/campaign-result.json` + readiness QA R024–R026.

---

## 4. Risques résiduels

| Risque | Niveau | Commentaire |
| --- | --- | --- |
| Rétention exécutions n8n (`execution_entity` vide) | **High** (debug) | 020/021 : pas de durée par nœud ; corrélation via runner/PG seulement |
| Écritures tardives PG | **Medium** | Settle 45 s ; `updatedAtChanged` observé ; classes stabilité 021 |
| Timeout / réseau ambigu | **Medium** | Politique 0 retry correcte ; scénario UNCERTAIN peu exercé en R |
| Double réservation / CLAIM | **High** (métier) | Jamais exercé en R01–R03 (volontairement) |
| Confirmation explicite CREATE | **High** | Non testée runtime ; Medium historique `skipCreateProgression` (018) |
| PII dans artefacts / logs | **Low–Medium** | Nom fixture en clair ; pas de preuve politique rétention logs |
| Performance Ollama variable | **Medium** | Warm 8–43 s ; chat 48–78 s ; cold vs hot mal instrumenté |
| Ressources Docker TEST | **Low** | Stack stable Up ; mem Ollama ~1,2/1,5 GiB |
| Corrélation bout-en-bout | **Medium** | runToken/sessionHash OK ; pas d’ID exécution n8n fiable |
| LIVE confusion | **Contrôlé** | `liveTouched=false` systématique ; **NO-GO LIVE** |

---

## 5. Analyse des performances

### 5.1 Durées observées

| Phase | Warm (ms) | Chat HTTP (ms) | Settle (ms) |
| --- | --- | --- | --- |
| R01 | ~26 118 | **77 758** | 45 000 |
| R02 | ~8 443 | **48 345** | 45 000 |
| R03 | ~42 697 | **55 244** | 45 000 |

Timeout client autorisé après gate : **180 000** ms. Aucun timeout chat sur R01–R03.

### 5.2 Mesures manquantes (attribution latence)

Sans `execution_entity` / timings nœud :

1. Temps Ollama `/api/chat` **pendant** le webhook (vs warm séparé).
2. Temps SQL Sauvegarder / lectures d’état.
3. Temps mock HTTP (si appelé — ici Δ0).
4. Temps nœuds non-LLM (Parser, Gérer, Demander).
5. File d’attente n8n / cold start worker.

### 5.3 Plan d’optimisation (sans modifier le workflow)

1. **Observabilité** : mission dédiée rétention exécutions TEST (`EXECUTIONS_DATA_*`) — lecture/config seulement sous autorisation.
2. **Warm policy** : standardiser warm ≤2 min avant chat ; documenter cold vs hot (R02 chaud vs R03 froid).
3. **Corrélation** : conserver runToken + timestamps activate/chat/deactivate/PG `updated_at` (déjà runner 021).
4. **Budget SLO TEST** : cibler chat p95 &lt; 90 s après warm vérifié (indicatif, non SLA LIVE).
5. **Pas de changement Gérer/Ollama model** dans cette revue.

---

## 6. Critères de sortie REC-008

### 6.1 Sortie **ASK-PRENOM / FIX-008** (atteignable)

| Critère | État |
| --- | --- |
| FIX-008 installé VC10 SHA `f75d4984…` | **Oui** (012+) |
| Fixtures OPTION A (slot présent) | **Oui** runtime (019) ; dette doc fixtures JSON R009 |
| R01/R02/R03 runtime PASS, 1 msg, 0 retry, mock Δ0 | **Oui** (024–026) |
| Postflight idle + isolation TEST | **Oui** |
| Evidence indépendante PASS | **Oui** (024–026) |
| Réconciliation catalogue R009 ↔ preuves (AP-DOC-01) | **Ouvert** (docs only) |

→ **Sous-périmètre ASK-PRENOM : clos runtime** ; clôture formelle catalogue **GO conditionnel** après AP-DOC-01 (+ AP-DOC-02 recommandé) — sans rejeu R0x.

### 6.2 Sortie **REC-008 CREATE complet** (non atteinte)

| Critère | État |
| --- | --- |
| Runtime recherche créneaux + sélection | **N** |
| Runtime email/tél + confirmation AFFIRM | **N** |
| Runtime CLAIM + POST CreateAppointment (mock puis réel TEST) | **N** |
| Idempotence / double submit | **N** |
| NEGATIVE purge + modifyField | **N** / O partiel |
| Observabilité exécutions nœud | **I** |

→ **NO-GO** déclaration « REC-008 clos » au sens PRD F-04…F-08.

### 6.3 Sortie **LIVE**

| Critère | État |
| --- | --- |
| Isolation + auth LIVE | **NO-GO** |
| PII / RGPD / tokens | **NO-GO** |
| Campagnes prod | **NO-GO** |

---

## 7. Backlog priorisé

| ID | Item | Criticité | Risque tech | Effort | Dépendances | Sécurité |
| --- | --- | --- | --- | --- | --- | --- |
| B1 | Observabilité rétention n8n TEST | Haute | Med | M | Auth config TEST | Lecture seule d’abord |
| B2 | Runtime ASK_EMAIL → ASK_TEL (1–2 msg) | Haute | Low | S | Fixture post-R01 | TEST only, 0 CLAIM |
| B3 | Runtime confirmation AFFIRM sans POST (mock gate) | Haute | Med | M | B2 | Interdire POST réel |
| B4 | Runtime CLAIM+POST mock CreateAppointment | Haute | High | L | B3 + auth | Mock only |
| B5 | Idempotence double AFFIRM | Haute | High | M | B4 | TEST |
| B6 | NEGATIVE purge + modifyField | Med | Med | M | Fixture | TEST |
| B7 | Variantes allowlist resume | Low | Low | S | R03 pattern | TEST |
| B8 | Cancel / Reschedule confirmation | Haute | High | L | Hors ASK-PRENOM | Mission distincte |
| B9 | Expurgation PII artefacts | Med | Low | S | CI hygiene | Safety |
| B10 | Perf attribution (timers) | Med | Low | M | B1 | Pas de mutate WF |

---

## 8. Prochaines missions proposées (non autorisées)

Ordre recommandé ([govsuite-planner](fe65ce98-a115-4729-85b3-80a5a46baee6) + [qa-automation](815c6e70-9836-4472-a68a-8ab494f7f1a2)) :

| # | Mission | But | GO/NO-GO actuel |
| --- | --- | --- | --- |
| 1 | **EXIT-CRITERIA-028** / AP-DOC-01 | Figer E1–E7 + matrice R009→preuves 024–026 | **GO** (docs only) |
| 2 | SECURITY-POST-R0x-029 | Audit isolation post-catalogue (readonly) | **GO** (readonly) |
| 3 | EVIDENCE-CONSOLIDATE-030 / OBS-RETENTION | Index preuves + diag rétention n8n | **GO** (readonly / auth config) |
| 4 | R04-ASK-EMAIL-PREP puis RUNTIME | 1 msg email synthétique | **HOLD** → **NO-GO** runtime sans auth |
| 5 | R05-TEL / R06-CONFIRM-NO-CLAIM | Aval identité + AFFIRM sans POST | **NO-GO** |
| 6 | R07-CLAIM-POST-MOCK | CLAIM+POST mock | **NO-GO** (auth + security) |
| 7 | UPSTREAM-SLOT / CANCEL-RESCHEDULE | Amont créneau / F-09–F-10 | **NO-GO** |
| — | Rejeu R01–R03 | — | **NO-GO** sauf fail preuve |
| — | LIVE-* | — | **NO-GO** |

Parallélisable dès autorisation humaine : 028 ∥ 029 ∥ 030. Aucune mission lancée par ce rapport.

---

## 9. Verdict GO / NO-GO par phase

| Phase | Décision |
| --- | --- |
| Clôture ASK-PRENOM R01–R03 (TEST) | **GO** (prouvé) |
| Nouvelle campagne chat immédiate | **NO-GO** (demande humaine) |
| CLAIM / CreateAppointment | **NO-GO** |
| Modification workflow / Docker / PG métier | **NO-GO** |
| LIVE | **NO-GO** |
| Auto-next | **NO-GO** |

---

## 10. Avis des agents

| Agent | Avis |
| --- | --- |
| [govsuite-planner](fe65ce98-a115-4729-85b3-80a5a46baee6) | **GO** cadrage docs ; ASK-PRENOM clos ; runtime/LIVE/auto-next **NO-GO** |
| [n8n-developer](9c3c8d9d-010f-419a-b20f-254e9bdef900) | **PASS** revue — R01–R03 clos ; créneaux/confirm/CLAIM **sans** preuve R |
| [postgres-engineer](31103014-54ab-4f0a-994f-8c91e87895ed) | **UNCERTAIN** sur anti-double-réservation (non exercée) ; FP/Δ0 stables conversationnellement |
| [qa-automation](815c6e70-9836-4472-a68a-8ab494f7f1a2) | **PASS** plan — catalogue ASK-PRENOM clos ; R013 obsolète pour clôture |
| [devops-engineer](c6fa9d5b-e7fc-4f89-88ba-fd9b62226a78) | **PASS** — warm variable 8–43 s ; chat &lt; 180 s ; rétention n8n **INCONCLUSIVE** |
| [security-auditor](50ec1c42-a354-468a-87ee-245bb19d2809) | **PASS** isolation R0x ; High : confirm + anti-double non prouvés ; **LIVE NO-GO** |
| [evidence-reviewer](6f862f44-32e1-4cd8-bd6f-c2c14d09f2f3) | **PASS** catalogue R01–R03 ; LIVE/auto-next **NO-GO** |

### 10.1 Avis indépendant Evidence Reviewer

Sur artefacts machine 024–026 (+ POSTCHECK / warm) :

- R01 / R02 / R03 et catalogue ASK-PRENOM : **PASS** chacun.
- HTTP 200 ≠ métier unique (R02 `session_expired` vs R03 reprise).
- Caveat mineur : `safeDeclared` racine vs postflight — preuve authoritative = `safety-postflight-success.json`.
- Isolation croisée R01 post-chat absente des artefacts-r01 ; fermée ensuite par POSTCHECK 025/026.
- **Ne pas** étendre ce PASS à CREATE E2E, CLAIM, CANCEL, RESCHEDULE ou LIVE.

---

## 11. Restrictions respectées

Analyse lecture seule. Aucune activation, chat, Ollama, mutation PG, PUT, Docker, LIVE, CLAIM/POST, campagne, auto-next.

**Arrêt après ce rapport.**
