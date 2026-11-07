# REC-008 — Critères de sortie ASK_PRENOM / FIX-008

Document formel (mission EXIT-CRITERIA-028). **Docs only.** Aucune preuve runtime nouvelle.

**Statut E1–E7 :** aucune définition approuvée PRD trouvée dans le dépôt avant 027/028.  
La grille **E1–E7** ci-dessous (sortie **ASK_PRENOM / FIX-008**) est **`PROPOSED`** puis **satisfaite** par les preuves 024–026 + livrables 028 — **pas** une exigence PRD déjà votée.  
Les critères CREATE complet utilisent des IDs distincts **`CF-E*`** (`PROPOSED`) pour éviter toute collision.

Ancrage planner : [govsuite-planner](40e634d9-49eb-4595-962e-27b3d4f1a2d3).

---

## A. E1–E7 — Clôture ASK_PRENOM / FIX-008 (`PROPOSED` → satisfaits)

| ID | Exigence associée | Comportement attendu | Test | Type preuve | Artefact | Verdict | Limites |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **E1** | FIX-008 installé | Gérer SHA `f75d4984…`, VC10, `OCD9It1uKFhOoWNF` | Install 012 + preflight R0x | runtime + doc | `preflight.json` ×3 | **PASS** | ≠ CREATE E2E |
| **E2** | PRD §6.2 / 019 | Fixtures OPTION A : slot présent ; sessions indépendantes | Realign 019 | offline + runtime | rapport 019 ; before 024–026 | **PASS** | JSON R009 encore `slot_id:null` → **AP-DOC-02** |
| **E3** | FIX008-S01 / R009-R01 | Actif + `Camille` → prenom capturé, `ASK_EMAIL` | R01-024 | **runtime** | `artifacts-r01-024/` SHA `6818d6da…` | **PASS** | 1 msg ; email/tél **N** |
| **E4** | FIX008-S02 / R009-R02 | Expiré + `Camille` → `session_expired`, prenom null, TTL− | R02-025 | **runtime** | `artifacts-r02-025/` SHA `299312c4…` | **PASS** | Autres free-text **N** |
| **E5** | FIX008-S03 / R009-R03 | Expiré + `reprendre` → TTL+, ASK_PRENOM, prenom null | R03-026 | **runtime** | `artifacts-r03-026/` SHA `cfa7cb6b…` | **PASS** | Variantes allowlist **N** |
| **E6** | Safety / isolation | 1 msg, 0 retry, mock Δ0, postflight idle, `:5682`, `liveTouched=false`, evidence PASS | assertR0x + postflight | **runtime** + doc | `campaign-result` + `safety-postflight-success` ×3 ; revues 024–027 | **PASS** | LIVE **N** ; Δ0 ≠ anti-double |
| **E7** | Catalogue R009 ↔ preuves | Réconciliation documentaire AP-DOC-01 ; R009 n’est plus « non exécuté » sans mapping | EXIT-028 | **documentaire** | `REC008_R009_TO_R01_R03_TRACEABILITY.md` ; `R028-exit-criteria-r009-reconciliation.json` ; R009 annoté | **PASS** (028) | AP-DOC-02 (align JSON slot) reste ouvert |

Alias internes historiques AP-1…AP-7 ≈ E1…E6 ; AP-8 ⊂ E6/E7.

**Décision clôture ASK_PRENOM :** **GO** (E1–E7 satisfaits ; runtime + catalogue documentaire).

### Hors clôture ASK_PRENOM

Email, téléphone, confirmation, CLAIM/POST, idempotence, amont créneaux, cancel/reschedule, LIVE.

---

## B. CF-E1–CF-E7 — REC-008 CREATE complet (`PROPOSED`)

Ancienne grille « E1–E7 CREATE » du brouillon parent 027/028 — **renommée** pour ne pas écraser E1–E7 ASK_PRENOM.

| ID | Exigence (indicatif) | Comportement attendu | Test | Type | Artefact | Verdict | Risque |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **CF-E1** | F-06 suite | `ASK_EMAIL` → `ASK_TELEPHONE` | CF-S01 / R04–R05 | runtime | — | **N** | Contact non prouvé |
| **CF-E2** | Confirm gate | Affirm → `AWAIT_CREATE_CONFIRMATION` + INSERT ; 0 POST sans AFFIRM | CF-S02 / R06 | runtime | — | **N** | skipCreateProgression |
| **CF-E3** | F-07/F-08 | AFFIRM + CLAIM → POST mock | CF-C05 / R07 | runtime | — | **N** | Double réservation |
| **CF-E4** | P4E | Expired + `oui` → 0 CLAIM/POST | R08 | runtime | — | **N** | Régression |
| **CF-E5** | F-04/F-05 | ≥1 scénario amont slot VC10 | UPSTREAM-SLOT | runtime | 8F2B ≠ post-FIX | **N** | Seeds sans parcours naturel |
| **CF-E6** | Safety | Préflight/postflight + SHA/VC sur chaque mission create | chaque CF-* | runtime+doc | partiel R0x | **Partiel** | Hors ASK_PRENOM |
| **CF-E7** | §11 PII | Fixtures synthétiques ; artefacts expurgés | security | doc | Low noms en clair | **Partiel** | B9 |

**Décision REC-008 complet :** **NO-GO** tant que CF-E1–CF-E5 non PASS.

**Décision LIVE :** **NO-GO**.

---

## C. Versions de référence

| Élément | Valeur |
| --- | --- |
| Workflow | `OCD9It1uKFhOoWNF` |
| VersionCounter | 10 |
| VersionId | `fd75ba32-f018-40e4-9f79-8f2a5400320b` |
| SHA Gérer FIX-008 | `f75d49849231f956bb9ae5383111ea84b362dc58de6711cc75d2e7e2a26917fe` |
| Runner SHA | `ef79972a87f1f6796b646864912fc495ddd65cac5ee1df71545386ff5462fe23` |
| Fingerprint TEST | `1\|14\|4\|0` |

---

## D. Références

- `docs/recovery/GOVSUITE_MULTIAGENT_EXIT_CRITERIA_028_REPORT.md`
- `docs/recovery/REC008_R009_TO_R01_R03_TRACEABILITY.md`
- `tests/rec008/readiness/R028-exit-criteria-r009-reconciliation.json`
- `tests/rec008/readiness/R009-install-runtime-campaigns.json` (annoté 028)
- Rapports 018, 019, 024–027
