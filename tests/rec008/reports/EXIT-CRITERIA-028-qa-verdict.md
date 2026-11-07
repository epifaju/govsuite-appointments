# EXIT-CRITERIA-028 / AP-DOC-01 — Verdict QA

**Verdict : PASS** (réconciliation docs only)  
**Rejeu R0x / CREATE E2E / CLAIM-POST / LIVE / auto-next : NO-GO**

Mode : **docs only** — aucune exécution runtime, aucune activation, aucune mutation PG.

---

## Critères de sortie E1–E7

| Id | Critère | État | Preuve |
| --- | --- | --- | --- |
| E1 | FIX-008 installé TEST (VC10, Gérer `f75d4984…`) | **SATISFIED** | 012+, revue 027 |
| E2 | Fixtures runtime OPTION A (`slot_id` + dates + slots) | **SATISFIED_RUNTIME** | REALIGN-019 ; *dette JSON R009* |
| E3 | R01 runtime PASS | **SATISFIED** | R024 |
| E4 | R02 runtime PASS | **SATISFIED** | R025 |
| E5 | R03 runtime PASS | **SATISFIED** | R026 |
| E6 | Postflight idle + isolation TEST + evidence QA (1 msg, 0 retry, mock Δ0) | **SATISFIED** | R024–R026 |
| E7 | Catalogue R009 ↔ preuves R024–R026 (AP-DOC-01) | **SATISFIED** | ce livrable |

→ Sous-périmètre **ASK-PRENOM / FIX-008** : clôture catalogue formelle **GO**.  
→ Sortie **REC-008 CREATE complet** : **NO-GO** (hors périmètre ; cf. 027 §6.2).

---

## Matrice R009 → R024–R026

| Scénario | État initial | Message | Attendu | Preuve | Verdict |
| --- | --- | --- | --- | --- | --- |
| **R01** | Catalogue : ASK_PRENOM **actif**, `prenom` null, `nom=Dupont`, session `…-r009-r01-…`. Runtime : idem + **OPTION A** (`slot_id` …301), session `…-runtime013-r01-active` | `Camille` | HTTP 200 ; `prenom=Camille` ; step `ASK_EMAIL` ; CLAIM/POST Δ0 ; 0 retry | `R024-r01-runtime-qa-verdict.json` + `artifacts-r01-024/` | **PASS** |
| **R02** | Catalogue : ASK_PRENOM **expiré**, `prenom` null, session `…-r009-r02-…`. Runtime : OPTION A (`slot_id` …302), session `…-runtime013-r02-expired` | `Camille` | HTTP 200 ; type `session_expired` ; `prenom` null ; step `ASK_PRENOM` ; TTL non renouvelé ; Δ0 ; 0 retry | `R025-r02-runtime-qa-verdict.json` + `artifacts-r02-025/` | **PASS** |
| **R03** | Catalogue : ASK_PRENOM **expiré**, `prenom` null, session `…-r009-r03-…`. Runtime : OPTION A (`slot_id` …303), session `…-runtime013-r03-resume` | `reprendre` | HTTP 200 ; TTL+ ; step `ASK_PRENOM` ; `prenom` null ; invite prénom ; pas `session_expired` ; Δ0 ; 0 retry | `R026-r03-runtime-qa-verdict.json` + `artifacts-r03-026/` | **PASS** |

### HTTP vs métier

| Scénario | Transport HTTP | Succès métier |
| --- | --- | --- |
| R01 | PASS (200) | PASS (`create_appointment_question` → ASK_EMAIL) |
| R02 | PASS (200) | PASS (`session_expired` ; pas de capture) |
| R03 | PASS (200) | PASS (`create_appointment_question` ; reprise sans capture) |

HTTP 200 ≠ succès métier automatique ; ici transport et métier concordent.

---

## Dette fixtures JSON R009 vs OPTION A runtime

| Champ | JSON R009 (`install-readiness-009/`) | Runtime 019–026 (autorité) |
| --- | --- | --- |
| `slot_id` | **`null`** (R01) / absent ou vide (R02/R03) | UUID synthétique `…301` / `…302` / `…303` |
| `available_slots` | `[]` | jsonb longueur 1 |
| `date_debut` / `date_fin` | non posés dans JSON | `2026-11-10` / `2026-11-14` |
| `session_id` | `rec008-syn-r009-r0x-…` | `rec008-runtime013-r0x-…` |

**Impact :** un reseed à partir des seuls JSON R009 sortirait du contrat OPTION A (018/019) et pourrait reproduire le routage DIAG-017.  
**Autorité :** `SEED.sql` / REALIGN-019 pour runtime. Les JSON R009 restent le catalogue pré-OPTION A.  
**Correctif recommandé :** AP-DOC-02 (alignement JSON only) — **hors cette mission**.

---

## Alignement assertions catalogue ↔ QA

| Domaine | Statut |
| --- | --- |
| Contrats métier R01/R02/R03 | **Alignés** avec R024–R026 |
| IDs assert R02 (catalogue M01=type vs R025 M01=prenom) | Remap documenté ; sémantique OK |
| R01-M03/M04, R03-M05 | Couverture partielle explicite dans QA runtime ; non bloquant (PASS campagne) |

---

## Gates

| Gate | Décision |
| --- | --- |
| Clôture catalogue ASK-PRENOM (AP-DOC-01) | **GO / PASS** |
| AP-DOC-02 (JSON OPTION A) | **GO conditionnel** docs/fixtures |
| Rejeu R01–R03 | **NO-GO** |
| CREATE E2E / CLAIM / POST | **NO-GO** |
| LIVE / auto-next | **NO-GO** |

Artefact JSON : `tests/rec008/readiness/R028-exit-criteria-r009-reconciliation.json`  
Catalogue annoté : `tests/rec008/readiness/R009-install-runtime-campaigns.json`
