# GOVSUITE-MULTIAGENT-EVIDENCE-AUDIT-006 — Rapport

Audit des preuves historiques **P4G2** et éligibilité actuelle des sessions TEST — **READ-ONLY**.

**Aucun scénario conversationnel exécuté.**  
**Aucun webhook chat, aucune activation, aucune mutation PG, aucun POST métier, aucun accès LIVE de connectivité.**

**Verdict mission : PASS**  
**Preuve historique P4G2 : ACCEPT**  
**Recommandation : Option A**  
**Phase suivante : non lancée automatiquement**

---

## 1. Sources retrouvées

| Source | Rôle |
| --- | --- |
| `docs/recovery/GOVSUITE_MULTIAGENT_RUNTIME_READINESS_005_REPORT.md` | Cadre readiness ; NO-GO replay sans préflight |
| `docs/recovery/REC_008_PHASE8F2B49_P4G1_EXPIRED_SESSION_VALIDATION_REPORT.md` | Pré-état P4G1 (`Camille` → `session_expired`) |
| `docs/recovery/REC_008_PHASE8F2B49_P4G2_EXPLICIT_RESUME_REPORT.md` | Rapport campagne P4G2 historique **PASS** |
| `n8n/proposed/2026-11-01-rec008-phase8f2b49-P4G2-EXPLICIT-RESUME/` | Artefacts machine : `PREFLIGHT.json`, `STATE_BEFORE.json`, `STATE_AFTER.json`, `RESULT.json`, `response.txt`, `CONNECTIVITY.json`, `run.js` |
| `tests/rec008/readiness/R005-p4g2-explicit-resume-assertions.json` | Catalogue assertions A01–A09 |
| `docs/recovery/GOVSUITE_MULTIAGENT_TEST_COVERAGE_004_REPORT.md` | Banc offline 22/22 ; SHA VC9 |
| `.cursor/rules/govsuite-safety.mdc` / `AGENTS.md` | Restrictions TEST/LIVE |

Artefacts historiques **non modifiés**.

---

## 2. Preuves historiques P4G2

Campagne documentée le **2026-11-02** sur `rec008-8f2b1-slot-01`, message unique `reprendre`, workflow TEST VC9.

| Attendu | Observé (artefacts) |
| --- | --- |
| Session expirée avant `reprendre` | `STATE_BEFORE.stillExpired=t` ; `expires_at=2026-10-31 00:59:54.370387+01` |
| Un seul message | `RESULT.chatInput=reprendre` ; `messageSent=true` ; `checks.singleMessage=true` ; `run.js` : un seul `fetch` sendMessage |
| HTTP 200 | `RESULT.message.status=200` (~65 s) ; `transportFailure=null` |
| `type=create_appointment_question` | `response.txt` + `RESULT.message.responseJson.type` |
| `conversation_step=ASK_CREATE_SERVICE` | réponse + `STATE_AFTER` |
| TTL renouvelé (+2 h) | avant `2026-10-31…` → après `2026-11-02 11:46:04+01` = `updated_at 09:46:04+01` + 2 h |
| Brouillon conservé | flags métier absents ; `slotsFingerprint` inchangé ; `draftMetierPreserved=true` |
| Aucune tentative | `attempts.total=0` / `open=0` |
| Aucun CLAIM | `claimAcquired=false` |
| Aucun POST CreateAppointment | `postDelta=0` ; mock posts 0→0 |
| Workflow désactivé | `deactivate.active=false` ; `webhookRows=0` ; VC9 |
| LIVE / Mailpit inchangés | empreinte `…a2dea067…` ; Mailpit `5/2/98304` (ancre **historique**) |

Verdict campagne historique documenté : **PASS**.

---

## 3. Matrice A01–A09

Classification sur preuves historiques uniquement (pas de rejeu).

| ID | Assertion | Verdict | Preuve |
| --- | --- | --- | --- |
| A01 | HTTP 200 + JSON parseable | **PASS** | `RESULT.message.status=200` ; `response.txt` |
| A02 | `create_appointment_question` / `ASK_CREATE_SERVICE` / ready&claim false | **PASS** | `RESULT` + `response.txt` |
| A03 | TTL renouvelé politique 2 h | **PASS** | `STATE_BEFORE/AFTER` ; `comparisons.ttlPolicyOk=true` |
| A04 | intent `GENERAL`→`CREATE` ; pending/step conservés | **PASS** | `intentRestored=true` ; STATE_* |
| A05 | Brouillon métier préservé ; attempts=0 | **PASS** | flags + `slotsFingerprint` ; attempts 0 (`draftFingerprint` peut changer) |
| A06 | CLAIM=0 ; POST Δ=0 | **PASS** | hardStop OK |
| A07 | Désactivation | **PASS** | hardStop OK |
| A08 | Un message ; 0 retry chat | **PASS** | structure `run.js` ; lacune mineure : `singleMessage` dérivé de `messageSent===true` |
| A09 | LIVE / Mailpit inchangés | **PASS** | ancre historique PREFLIGHT = AFTER |

**Score : 9 PASS / 0 FAIL / 0 INCONCLUSIVE.**

Lacune A08 non bloquante : pas de compteur réseau indépendant ; `fetchRetry` existe pour login/activate/deactivate (infra), **pas** pour le chat métier.

---

## 4. État actuel TEST (lecture seule)

Horodatage lectures ≈ **2026-11-02 10:59–11:00+01** (`NOW()` PG ≈ `2026-11-02 10:59:56+01`).

Services déjà up — **aucun Docker start**.

### Workflow TEST (copie sqlite en lecture seule, puis purge locale)

| Champ | Valeur |
| --- | --- |
| ID | `OCD9It1uKFhOoWNF` |
| `active` | **false** |
| `versionId` | `e7867799-2a18-4aec-9ee5-3ba9cbc40766` |
| `versionCounter` | **9** |
| Actifs | **0** |
| Webhooks | **0** |

### Session `rec008-8f2b1-slot-01`

| Champ | Valeur actuelle |
| --- | --- |
| TTL | `expires_at=2026-11-02 11:46:04.206239+01` → **ACTIVE** |
| `intent` | `CREATE_APPOINTMENT` |
| `pending_action` | `CREATE_APPOINTMENT` |
| `conversation_step` | `ASK_CREATE_SERVICE` |
| `last_user_message` | `reprendre` |
| Flags métier (service/site/slot/identité) | absents |
| `available_slots` | présent (len 0) |
| Tentatives | **0** / ouvertes **0** |

État aligné **STATE_AFTER** historique P4G2 (TTL encore futur au moment de l’audit).

### Compteurs

| Domaine | Valeur |
| --- | --- |
| PG TEST `rdv\|sessions\|attempts\|notif` | `1\|11\|4\|0` |
| Ouvertes globales | `0` |
| Mock `_meta/calls` | `scenario=created` ; `total=0` ; `byPath={}` |

### LIVE

Non requêté dans cette mission. Empreinte `13\|14\|12\|48\|0\|a2dea067…` citée uniquement comme **référence historique** P4G2.

---

## 5. Sessions éligibles

Critères replay P4G2 classique : `expires_at ≤ NOW` **et** `pending_action=CREATE_APPOINTMENT` **et** `conversation_step=ASK_CREATE_SERVICE` **et** brouillon intact **et** attempts ouvertes = 0 **et** (pour A04 strict) `intent=GENERAL` avant message.

| Session | Statut | Éligible P4G2 ? |
| --- | --- | --- |
| `rec008-8f2b1-slot-01` | ACTIVE, intent déjà `CREATE` | **NON** |
| Expiration naturelle seule (~11:46) | intent resterait `CREATE` | **NON** (pré-état P4G1 non restauré) |
| `rec008-8f2b28-new-01` | EXPIRED, intent CREATE, pending/step **vides** | **NON** |
| Autres expirées (`8f2b49-edit-01`, `8f2b37-new-01`, …) | hors combo CREATE+ASK_CREATE_SERVICE | **NON** |

**Aucune session TEST éligible** pour un rejeu P4G2 fidèle au moment de l’audit.

---

## 6. Vérifications de sécurité

| Contrôle | Résultat |
| --- | --- |
| Cible historique TEST `127.0.0.1:5682` | PASS (`run.js` + garde port) |
| Isolation mock / credentials TEST (historique) | PASS (10× `rec008-mock`) |
| Un sendMessage métier / 0 retry chat | PASS (lacune soft A08) |
| Désactivation post-test | PASS |
| POST CreateAppointment Δ=0 | PASS |
| Audit 006 sans activation / webhook / Ollama / mutation | PASS |
| Connectivité LIVE dans 006 | **non effectuée** (interdit) |

---

## 7. Écarts et risques

| Risque | Sévérité | Note |
| --- | --- | --- |
| Confusion « ACCEPT historique » ≠ runtime présent | High | READINESS-005 déjà alerté |
| Replay naïf sur session ACTIVE / intent CREATE | High | faux scénario → STOP |
| A08 booléen dérivé + `fetchRetry` infra | Low–Med | n’invalide pas A01–A07/A09 |
| LIVE actuel non mesuré | Med | ancre historique seulement |
| Aucune fixture expirée équivalente | Med | bloque Option B ; Option C seulement si rejouabilité exigée |

Aucune contradiction critique A01–A09. Aucun FAIL historique.

---

## 8. Revue Evidence Reviewer

Agent : [evidence-reviewer](34570221-63ca-46aa-af74-eae5a2cb65ab)

| Point | Verdict indépendant |
| --- | --- |
| Preuve historique | **ACCEPT** |
| Matrice A01–A09 | **9 PASS** confirmés |
| Sessions actuelles | **non éligibles** replay |
| Option | **A** |
| Replay / LIVE / runtime ASK_PRENOM | **NO-GO** |
| Préparation offline ASK_PRENOM | **GO** cadrage seulement |

---

## 9. Recommandation A / B / C

### **Option A — Preuve historique suffisante** (retenue)

Accepter P4G2 comme validation historique de la reprise explicite VC9.  
Proposer ensuite la **préparation** (hors ligne) du test `ASK_PRENOM` sous **autorisation distincte**.

| Option | Décision |
| --- | --- |
| A | **Retenue** |
| B (preuve insuffisante + session éligible) | Écartée — preuve suffisante **et** session **non** éligible |
| C (preuve insuffisante + aucune session) | Non requise pour clôturer P4G2 ; utile seulement si un audit exige rejouabilité stricte |

**Aucune option lancée automatiquement.**

---

## 10. GO / NO-GO — phases ultérieures

| Question | Décision |
| --- | --- |
| Accepter P4G2 historique comme jalon PASS clos | **GO** |
| Préparer ASK_PRENOM offline (docs / fixtures / assertions) | **GO** sous autorisation distincte |
| Exécuter runtime ASK_PRENOM / activer / webhook | **NO-GO** |
| Rejouer P4G2 maintenant | **NO-GO** |
| LIVE | **NO-GO** |
| Auto-enchaînement | **NO-GO** |

---

## 11. Délégations effectuées

| Agent | ID | Livrable |
| --- | --- | --- |
| [govsuite-planner](8997bfd2-3527-42ec-bf13-ccbe01ab9e97) | Stratégie A/B/C → **Option A** | |
| [qa-automation](87e1ebcd-d9fc-4393-a821-181ac6e2e57d) | Matrice A01–A09 **9 PASS** | |
| [postgres-engineer](cce5e063-57a2-4a7e-91c8-a4050a991ad3) | Contrat SELECT + session **non éligible** | |
| [n8n-developer](7819702f-5afb-4ff9-8eee-9496b16fef0e) | VC9 / routage / deactivate **PASS** | |
| [security-auditor](f366b9d2-8a96-4f05-b5a1-afdfacdb92fc) | Restrictions TEST **PASS** ; Option A OK comme preuve passée | |
| [evidence-reviewer](34570221-63ca-46aa-af74-eae5a2cb65ab) | **ACCEPT** + Option A ; NO-GO replay | |
| Parent | Lectures TEST (PG SELECT, mock GET, sqlite snapshot RO) + rapport | |

---

## 12. Verdict

| Critère 006 | Statut |
| --- | --- |
| Sources P4G2 retrouvées | OK |
| Matrice A01–A09 classée | 9 PASS |
| État TEST lu sans mutation | OK |
| Sessions éligibles inventoriées | Aucune pour replay fidèle |
| Sécurité / isolation documentées | OK |
| Evidence Reviewer | ACCEPT / Option A |
| Contradiction critique | Aucune |

**Verdict mission : PASS**  
**Recommandation : Option A**  
**Mission arrêtée après ce rapport. Aucune phase suivante déclenchée.**
