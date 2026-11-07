# GOVSUITE-MULTIAGENT-ASK-PRENOM-READINESS-007 — Rapport

Préparation **hors ligne** d’une future validation runtime `ASK_PRENOM` (VC9).

**Aucune conversation n8n exécutée. Aucune mutation PG. Aucune activation. Aucun LIVE.**

**Verdict mission : PASS** (catalog / banc / fixtures / diagnostic)  
**Divergence critique S03 brief vs VC9 : CONFIRMÉE**  
**GO/NO-GO runtime : conditionnel (voir §13)**  
**Phase suivante : non autorisée automatiquement**

---

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| EVIDENCE-AUDIT-006 | P4G2 ACCEPT / Option A ; session slot-01 non éligible replay |
| VC9 export | `after-OCD9It1uKFhOoWNF.json` SHA `6284f867…f82b889` ; `versionId=e7867799…` ; VC9 |
| Banc offline avant | 22/22 PASS (COVERAGE-004) |
| Artefacts historiques P4* | Lecture seule, non modifiés |
| Workflow distant | Non touché |
| AGENTS.md / govsuite-safety | LIVE interdit ; offline only |

Références : P4D–P4G2, COVERAGE-004, AUDIT-006.

---

## 2. Délégations

| Agent | ID | Livrable |
| --- | --- | --- |
| [govsuite-planner](f6be8fd4-acf6-4738-8102-5bac126ba941) | Cadrage S01–S03 ; NO-GO runtime immédiat | |
| [n8n-developer](6ff89ed6-6b94-4a35-a9a2-9f615fb7567a) | Chemins VC9 ; **divergence S03** | |
| [postgres-engineer](ea49c78a-fa28-42f1-9b12-1b7e12710ceb) | Contrat TTL/brouillon + `R007-ask-prenom-ttl-sql-contract.json` | |
| [qa-automation](77d7e220-ca76-4417-a9c7-aac5f69c353c) | Catalogue assertions ; FAIL contrat brief S03 | |
| [security-auditor](2f3b2c2f-4d24-4b6e-b3e3-21f5a0d982be) | Garde-fous TEST ; sessions distinctes | |
| [devops-engineer](97e1b836-3d80-410b-a86b-cdf84c8c9a30) | PREFLIGHT/POSTFLIGHT/STOP/COMMAND + stubs throw | |
| [evidence-reviewer](cd88b118-b111-48a2-aa8a-94ea2dc63eae) | PASS offline ; NO-GO S03-brief / LIVE | |
| Parent | Handlers S01–S03/N01–N02 ; fixtures ; suite 27/27 | |

---

## 3. Analyse du code VC9

Nœuds : Parser intention → Fusionner → Gérer collecte progressive → (Réponse générale / Demander paramètres) → Sauvegarder.

| Mécanisme | Comportement VC9 |
| --- | --- |
| Parser + step identité actif | Force `intent=CREATE_APPOINTMENT` sauf override |
| Parser + session expirée + `reprendre` | `intent=CREATE` si pending CREATE |
| Gérer `sessionExpired` + free-text | `sessionExpired=true`, `refreshSessionTtl=false`, `preserveDraft=true`, intent GENERAL |
| Gérer `explicitResumeMsg` | `refreshSessionTtl=true`, `sessionExpired=false`, `preserveDraft=true`, intent CREATE si pending CREATE — **puis continue la collecte** |
| Collecte `ASK_PRENOM` | `prenom = message` si len≥2 (y compris **« reprendre »**) |
| `_authorizedNulls` | Non utilisée sur S01–S03 (pas d’abandon) |
| CreateAppointment / CLAIM | Hors chemin COLLECT pour ces messages |

### Divergence S03 (critique)

| Attente brief mission | Observé VC9 (VM) |
| --- | --- |
| step reste `ASK_PRENOM` | step → **`ASK_EMAIL`** |
| prenom reste null | prenom = **`reprendre`** |
| réponse invite prénom | collect avance ; invite serait email |
| TTL renouvelé | **oui** (`refreshSessionTtl=true`) |
| nom conservé | **oui** |
| no CLAIM/POST | **oui** |

Cause : après reprise explicite, aucun skip de la branche collect identité ; le message `reprendre` est traité comme valeur de prénom.

**Asymétrie :** `ASK_CREATE_SERVICE` + `reprendre` (P4G2) ne capture pas le service (step conservé). Identity steps (`ASK_NOM` / `ASK_PRENOM`) capturent.

**Aucun correctif workflow dans cette mission** (interdit).

---

## 4. Scénarios S01–S03

| ID | Préconditions | Message | Contrat offline |
| --- | --- | --- | --- |
| **S01** | ACTIVE ; pending CREATE ; step ASK_PRENOM ; nom set ; prenom null | `Camille` | prenom=Camille ; step ASK_EMAIL ; no CLAIM/POST |
| **S02** | EXPIRÉE ; même brouillon (session **distincte**) | `Camille` | `session_expired` ; TTL non refresh ; prenom null ; draft OK |
| **S03** | EXPIRÉE ; session **indépendante** de S02 | `reprendre` | **VC9-actual** : TTL+ ; CREATE ; prenom=`reprendre` ; step ASK_EMAIL |

Sessions cibles synthétiques : `rec008-syn-s01-…` / `s02-…` / `s03-…` — **ne pas chaîner** S02→S03 sans reset autorisé.

Fichiers : `tests/rec008/scenarios/ask-prenom/S0{1,2,3}-*.json` (+ N01/N02).

---

## 5. Assertions

Catalogue : `tests/rec008/readiness/R007-ask-prenom-assertions.json`  
Handlers : `tests/rec008/lib/assertions/readiness-007-ask-prenom.cjs`

Chaque scénario porte : `simulation: true`, `runtimeRequired: true` (sauf N02 diagnostic), SHA source, limites de preuve.

| Assertion clé | S01 | S02 | S03 VC9-actual |
| --- | --- | --- | --- |
| HTTP / PG réel | runtimeRequired | runtimeRequired | runtimeRequired |
| prenom | Camille | null | **reprendre** |
| step | ASK_EMAIL | ASK_PRENOM | **ASK_EMAIL** |
| refreshSessionTtl | (collect normal) | false | true |
| reply type | (Demander params runtime) | session_expired | (invite email runtime) |
| CLAIM/POST | 0 | 0 | 0 |

N02 : PASS si et seulement si le **brief** S03 est contredit par VC9.

---

## 6. Résultats offline

| Suite | Résultat |
| --- | --- |
| Unit `readiness-007-ask-prenom.test.cjs` | **6/6 PASS** |
| Offline `run-offline.cjs` | **27 PASS / 0 FAIL** (rapport `report-2026-11-02T10-22-23-799Z`) |
| SHA / versionId | Identiques banc 003/004/005 |

**PASS offline ≠ PASS runtime.**

---

## 7. Tests négatifs

| ID | Rôle | Verdict |
| --- | --- | --- |
| N01 | Régression : expired ne doit pas capturer prenom | PASS |
| N02 | Brief S03 ≠ VC9 (divergence détectée) | PASS |

Mutation-engine historiques (C03) inchangés.

---

## 8. Fixtures préparées (non appliquées)

Sous `tests/rec008/fixtures/ask-prenom-readiness-007/` :

| Fichier | `applied` |
| --- | --- |
| `s01-active-state.json` | **false** |
| `s02-expired-state.json` | **false** |
| `s03-expired-resume-state.json` | **false** |
| `SELECT-TEMPLATES.md` | templates uniquement |

SQL contrat : `tests/rec008/readiness/R007-ask-prenom-ttl-sql-contract.json` (`executed: false`).

---

## 9. Risques

| Risque | Sévérité |
| --- | --- |
| S03 brief exécuté sur VC9 → faux prénom `reprendre` | **Critical** |
| Confusion PASS offline / N02 avec GO produit S03 | High |
| Chaînage S02→S03 sans reset | High |
| STOP-conditions brief vs campagne « vc9-actual » | Medium |
| Correctif partiel service-only (P4G2) masquant le bug identity | Medium |
| PII réelle dans fixtures futures | Low (Dupont/Camille synthétiques) |

---

## 10. Audit sécurité

| Contrôle | Statut |
| --- | --- |
| Pas d’accès LIVE / webhook / activation / Ollama | OK mission 007 |
| Pas de mutation PG / Docker | OK |
| Pas de retry métier | Documenté pour futur runtime |
| Sessions distinctes S01/S02/S03 | Spécifié |
| Isolation TEST + deactivate + mock | Checklists runtime prêtes, non exécutées |
| PASS offline ≠ PASS runtime | Explicit dans scénarios |

---

## 11. Revue indépendante

[evidence-reviewer](cd88b118-b111-48a2-aa8a-94ea2dc63eae) :

- Mission offline : **PASS**
- Divergence S03 : **confirmée**
- Runtime S01/S02 : **GO** sous autorisation + fixtures
- Runtime S03-brief : **NO-GO**
- S03-vc9-actual : diagnostic seulement, **NO-GO** acceptation produit
- LIVE / auto-phase : **NO-GO**

---

## 12. Verdict

| Critère 007 | Statut |
| --- | --- |
| S01–S03 spécifiés | OK |
| Assertions ↔ VC9 (S03 = actual) | OK |
| Offline reproductible | 27/27 |
| Négatifs | N01/N02 PASS |
| Fixtures non appliquées | OK |
| Risques identifiés | OK + divergence S03 |
| Evidence Reviewer | Approuve prep offline |
| Contradiction brief S03 vs VC9 | **Démontrée** (bloquant runtime brief) |

**Verdict mission : PASS** (préparation)  
Le contrat **produit** S03 du brief n’est **pas** réalisable sur VC9 actuel sans correctif hors ligne ultérieur.

---

## 13. GO/NO-GO — future exécution runtime TEST

| Cible | Décision |
| --- | --- |
| Runtime **S01** | **GO** sous autorisation distincte + fixtures + préflight/postflight |
| Runtime **S02** | **GO** idem (session ≠ S03) |
| Runtime **S03 brief** (ASK_PRENOM + prenom null) | **NO-GO** |
| Runtime **S03 VC9-actual** (documenter capture) | **GO diagnostic** seulement si ordre humain explicite |
| Correctif VC9 (skip collect si `explicitResumeMsg`) | Mission **distincte** proposée — non lancée |
| LIVE | **NO-GO** |
| Auto-enchaînement | **NO-GO** |

Checklists : `tests/rec008/runtime/PREFLIGHT-ASK-PRENOM.md`, `POSTFLIGHT-ASK-PRENOM.md`, `STOP-CONDITIONS-ASK-PRENOM.md`, `COMMAND-MATRIX-ASK-PRENOM.md`  
Stubs : `preflight-ask-prenom.stub.cjs` / `postflight-ask-prenom.stub.cjs` (throw si `main`).

---

**Mission arrêtée après ce rapport. Aucune exécution runtime déclenchée.**
