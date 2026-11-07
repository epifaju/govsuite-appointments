# REC-008 — Traçabilité R009 → R01 / R02 / R03 (024–026)

Mission EXIT-CRITERIA-028. **Documentaire uniquement.** Aucune modification de fixtures historiques ni de PostgreSQL.

---

## 1. Pourquoi les fixtures R009 sans créneau étaient insuffisantes

### Contrat métier (PRD §6.2 + CREATE-FLOW-018)

Ordre CREATE officiel :

`ASK_CREATE_SERVICE` → `ASK_CREATE_SITE` → `ASK_CREATE_DATE_RANGE` → recherche créneaux → `ASK_CREATE_SLOT` → **puis** `ASK_NOM` → `ASK_PRENOM` → …

La collecte d’identité est **gated sur `slotId`**. Un état `ASK_PRENOM` avec `slot_id` NULL :

- n’est **pas** un état conversationnel naturel produit par Gérer VC10 ;
- ne permet **pas** de tester correctement « Camille → capture prénom » : le graphe retombe vers la recherche de dates/créneaux (DIAG-017) ;
- contredit F-05 avant F-06.

### Fixture historique R009 (catalogue)

Fichiers `tests/rec008/fixtures/install-readiness-009/*` :

| Champ | R009 historique |
| --- | --- |
| `conversation_step` | `ASK_PRENOM` |
| `prenom` | null |
| **`slot_id`** | **`null`** |
| `available_slots` | `[]` |
| `sessionId` | `rec008-syn-r009-r0x-…` |

Ces fixtures documentent le **contrat de message** (Camille / reprendre) mais **pas** un état CREATE conforme PRD.

### Correction 019 (OPTION A)

Realign fixtures runtime : UUID synthétique de créneau + dates + `available_slots` contenant ce UUID ; sessions `rec008-runtime013-r0x-…`.  
**Les JSON R009 n’ont pas été réécrits** (dette documentaire AP-DOC-02) — les preuves 024–026 utilisent les sessions runtime-013 OPTION A.

---

## 2. Chaîne de transformation

```text
R009 catalogue (slot null, session syn-r009-*)
    ↓ contrat métier clarifié
018 CREATE-FLOW (Option A : garder VC10, corriger fixtures)
    ↓ seed / realign PG TEST
019 OPTION A (slot présent, session runtime013-*)
    ↓ install FIX-008 VC10 (012) + runner (021) + warm (020)
024 R01 / 025 R02 / 026 R03  → preuves runtime
027 revue consolidée
028 réconciliation documentaire (ce fichier)
```

---

## 3. Matrice de validation R01 / R02 / R03

Légende : **R** = runtime démontré · **O** = offline · noms synthétiques (pas PII citoyen).

| Scénario | État initial (runtime 019+) | Message | État attendu | Preuve | Verdict |
| --- | --- | --- | --- | --- | --- |
| **R01** | `rec008-runtime013-r01-active` ; ASK_PRENOM ; prenom null ; **slot présent** ; TTL futur (refresh SQL pré-024) | `Camille` ×1 | prenom capturé (len 7) ; step **ASK_EMAIL** ; slot/nom conservés ; mock Δ0 | `artifacts-r01-024/campaign-result.json` (`6818d6da…`) ; rapport 024 ; QA R024 | **PASS R** |
| **R02** | `…-r02-expired` ; ASK_PRENOM ; prenom null ; slot présent ; **expires_at &lt; NOW()** | `Camille` ×1 | type **`session_expired`** ; prenom **null** ; step ASK_PRENOM ; TTL **non** renew ; mock Δ0 | `artifacts-r02-025/campaign-result.json` (`299312c4…`) ; rapport 025 ; QA R025 | **PASS R** |
| **R03** | `…-r03-resume` ; ASK_PRENOM ; prenom null ; slot présent ; expirée | `reprendre` ×1 | type **`create_appointment_question`** ; invite prénom ; prenom **null** ; TTL **renew** ; step ASK_PRENOM ; mock Δ0 | `artifacts-r03-026/campaign-result.json` (`cfa7cb6b…`) ; rapport 026 ; QA R026 | **PASS R** |

### Contrôles transverses (démontrés)

| Contrôle | R01 | R02 | R03 |
| --- | --- | --- | --- |
| `retried=false` | oui | oui | oui |
| Messages | 1 | 1 | 1 |
| Postflight idle | SHA `3de4acd6…` | `3d557d65…` | `b90a5277…` |
| `liveTouched=false` | oui | oui | oui |
| Gérer SHA / VC10 | f75d4984… / 10 | idem | idem |
| Fingerprint final | `1\|14\|4\|0` | idem | idem |

### Mapping catalogue R009

| R009 campaign | Offline anchor | Runtime session réelle | Runtime mission |
| --- | --- | --- | --- |
| R01 / FIX008-S01 | `r01-active-camille-state.json` (slot null — historique) | `rec008-runtime013-r01-active` | RUNTIME-024 |
| R02 / FIX008-S02 | `r02-expired-camille-state.json` | `…-r02-expired` | RUNTIME-025 |
| R03 / FIX008-S03 | `r03-expired-resume-state.json` | `…-r03-resume` | RUNTIME-026 |

**R013** : stop transport, assertions `NOT_EVALUATED` — **ne compte pas** comme PASS métier ; **supplanté** par 024–026.

---

## 4. Preuve vs interprétation

| Déclaration | Statut |
| --- | --- |
| R01/R02/R03 métier PASS sur OPTION A + FIX-008 | **Preuve** (campaign-result + PG snaps) |
| Catalogue ASK_PRENOM R009 « exécuté » via syn-r009-* | **Faux** — sessions runtime013 utilisées |
| Fixtures JSON R009 = état runtime | **Faux** — `slot_id:null` vs OPTION A |
| ASK_PRENOM clos ⇒ CreateAppointment sûr | **Interprétation abusive** — NO-GO |
| mock Δ0 ⇒ anti-collision créneau | **Interprétation abusive** |

---

## 5. Dette documentaire restante (sans mutation)

| ID | Action | GO |
| --- | --- | --- |
| AP-DOC-02 | Annoter / aligner JSON R009 (`slot_id` OPTION A) sans toucher PG | GO docs |
| AP-DOC-03 | Chemins QA `evidence-*` → `artifacts-*` | GO docs |

---

## 6. Références

- `tests/rec008/readiness/R009-install-runtime-campaigns.json`
- `tests/rec008/fixtures/install-readiness-009/`
- `docs/recovery/GOVSUITE_MULTIAGENT_CREATE_FLOW_CONTRACT_018_REPORT.md`
- `docs/recovery/GOVSUITE_MULTIAGENT_R013_FIXTURES_REALIGN_019_REPORT.md`
- `docs/recovery/GOVSUITE_MULTIAGENT_R01_STATE_ROUTING_DIAG_017_REPORT.md`
- `n8n/proposed/…/runtime-013/artifacts-r0{1,2,3}-02{4,5,6}/`
