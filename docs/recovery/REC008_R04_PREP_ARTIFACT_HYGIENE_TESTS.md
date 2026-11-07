# REC-008 — R04-PREP : tests hygiene artefacts (email / tél / token)

Mission **EVIDENCE-OBSERVABILITY-030** / QA (docs only).  
Aucune exécution runtime, aucune activation n8n, aucun POST CreateAppointment, aucun LIVE, aucune mutation PG/Docker.

**Statut :** spécification **`PROPOSED`**. Implémentation du scanner offline = mission d’outillage distincte ; ce document ne l’exécute pas.

Ancrages : `govsuite-safety.mdc` ; `REC008_R04_R07_SECURITY_TEST_CRITERIA.md` (SEC-C07, R04-P01) ; rapport 029 (R-02, B9) ; `security-guard.cjs` (`assertSyntheticIdentity`).

---

## 0. Objectif

Définir des **tests automatisés hors ligne** qui rendent un verdict **FAIL** dès qu’un **artefact nouveau** (rapports / snapshots / journaux de campagne R04+) contient en clair :

- une adresse e-mail ;
- un numéro de téléphone ;
- un secret / token / credential.

HTTP 200 ≠ succès métier. Un PASS hygiene n’autorise **pas** R04-RUNTIME.

---

## 1. Périmètre « artefacts nouveaux »

| Inclus (à scanner) | Exclu (hors dette / hors scope 030) |
| --- | --- |
| `tests/rec008/reports/**` créés **après** baseline R03 (préfixe `R04-*`, `artifacts-r04*`, `*-r04-*`, `SECURITY-*` post-029, futurs) | Rapports historiques R01–R03 / 024–026 (dette B9 Low — noms/emails synthétiques déjà en clair) |
| `n8n/proposed/**/artifacts*/**` et `**/runtime-*/**/artifacts*/**` produits pour R04+ | Exports LIVE / `n8n/live-exports` (jamais lus) |
| Fixtures **nouvelles** sous `tests/rec008/fixtures/r04*/` (règle distincte : synthétique autorisé **dans fixtures only**) | `.env*`, credentials, dumps PG bruts |
| Sorties runner futures (`correlation*.json`, postflight redacted) | Contenu Mailpit corps / exécutions n8n brutes |

**Baseline « nouveau » :** tout fichier dont le chemin ou le préfixe de campagne est **R04+**, ou horodaté / créé dans une mission ≥ 030 pour R04-PREP.  
Les fixtures synthétiques (`*.example.test`, `+33000000000`) restent autorisées **uniquement** sous `tests/rec008/fixtures/**` et scénarios offline — **pas** dans rapports commités.

---

## 2. Catalogue de patterns (FAIL si match)

Catalogue machine : `tests/rec008/readiness/R030-r04-prep-artifact-hygiene.json`.

### 2.1 E-mail en clair — `HYG-E01`

| Élément | Valeur |
| --- | --- |
| Pattern (indicatif) | `\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b` |
| Verdict | **FAIL** `pii-cleartext-email` |
| Assertion liée | **R04-P01** / **SEC-C07** |
| Autorisé à la place | `emailPresent` (bool), `emailLen` (int), `emailIsNull`, `emailHash` (hex non réversible) |

**Exceptions (PASS) :** chaînes purement documentaires listant le pattern lui-même dans ce doc / JSON de critères ; champs `pattern` / `allowlist` du catalogue ; littéraux `example.test` **uniquement** dans fixtures (pas rapports).

### 2.2 Téléphone en clair — `HYG-T01` / `HYG-T02`

| ID | Pattern (indicatif) | Verdict |
| --- | --- | --- |
| **HYG-T01** | `\+33\s?[1-9](?:[\s.-]?\d{2}){4}` | **FAIL** `pii-cleartext-phone` |
| **HYG-T02** | `\b0[1-9](?:[\s.-]?\d{2}){4}\b` | **FAIL** `pii-cleartext-phone` |

Autorisé : `telephonePresent`, `telephoneLen`, `telephoneIsNull`, `telephoneHash`.  
Fixture synthétique `+33000000000` : **fixtures only**, jamais dans rapport R04+.

### 2.3 Token / secret / credential — `HYG-S01`…`HYG-S05`

| ID | Pattern (indicatif) | Cible |
| --- | --- | --- |
| **HYG-S01** | `(?i)\bBearer\s+[A-Za-z0-9\-._~+/]+=*` | Authorization Bearer |
| **HYG-S02** | `\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b` | JWT |
| **HYG-S03** | `(?i)(api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret)\s*[:=]\s*\S+` | Clés nommées |
| **HYG-S04** | `(?i)(password|passwd|pwd)\s*[:=]\s*\S+` | Mots de passe |
| **HYG-S05** | `(?i)(n8n[_-]?api[_-]?key|cookie)\s*[:=]\s*\S+` | API n8n / cookies |

Verdict : **FAIL** `secret-or-token-cleartext`.  
Autorisé : `tokenPresent=false`, `authConfigured=true/false`, `credentialId` opaque, `runToken` **court** non secret de corrélation (déjà utilisé runner-021) — **pas** de valeur d’API key.

### 2.4 Formes autorisées (non-FAIL)

| Forme | Exemple |
| --- | --- |
| Présence + longueur | `"emailPresent": true, "emailLen": 28` |
| Nullité | `"emailIsNull": true` |
| Hash non réversible | `"emailHash": "<sha256-hex>"` (sans salt secret dumpé) |
| Flags session | `nomPresent`, `prenomIsNull`, `slotIdPresent` (cf. `redactSession`) |
| Corrélation | `sessionIdHash`, `runToken`, `scenarioId` |

---

## 3. Scénarios de test offline (spécifiés, non exécutés ici)

Emplacement cible futur : `tests/rec008/unit/artifact-hygiene-r030.test.cjs` (+ helper `tests/rec008/lib/assertions/artifact-hygiene.cjs`).

| ID | Entrée synthétique | Attendu |
| --- | --- | --- |
| **H-01** | Rapport JSON avec `"email": "user.r04@example.test"` | **FAIL** `HYG-E01` |
| **H-02** | Rapport avec `"emailPresent": true, "emailLen": 22` | **PASS** |
| **H-03** | Rapport avec `"telephone": "+33612345678"` | **FAIL** `HYG-T01` |
| **H-04** | Rapport avec `"telephoneIsNull": false, "telephoneLen": 12` | **PASS** |
| **H-05** | Rapport avec `Authorization: Bearer eyJ…` | **FAIL** `HYG-S01`/`S02` |
| **H-06** | Corrélation `{ runToken, sessionIdHash }` sans message | **PASS** |
| **H-07** | Fixture sous `fixtures/r04*/` avec `user.r04@example.test` | **PASS** (allowlist fixtures) |
| **H-08** | Même e-mail dans `reports/R04-*.md` | **FAIL** |
| **H-09** | Rapport historique 024 listé en allowlist dette B9 | **SKIP** / hors scope (pas de FAIL forcé 030) |

Commande d’exécution **future** (ne pas lancer sans autorisation outillage) :

```text
node tests/rec008/unit/artifact-hygiene-r030.test.cjs
```

Critère d’arrêt scanner : premier match bloquant → **FAIL** suite ; pas de retry ; pas d’appel réseau (réutiliser `installOfflineGuards`).

---

## 4. Critères R04-PREP (checklist GO prep)

| ID | Critère | Preuve attendue | Gate |
| --- | --- | --- | --- |
| **R04P-01** | Contrat métier ASK_EMAIL → ASK_TELEPHONE figé (018 / 029) | docs 029 | Prep |
| **R04P-02** | Assertions R04-H/M/S/P + SEC-C* catalogue | `R029-…json` | Prep |
| **R04P-03** | STOP R04 documentés (`pii-in-report`, `pii-fixture-real`) | `STOP-CONDITIONS-R04-R07.md` | Prep |
| **R04P-04** | Politique masquage : présent/len/hash ; interdit clair | ce doc + contrat masquage 030 | Prep |
| **R04P-05** | Catalogue patterns FAIL (E/T/S) versionné | `R030-…json` | Prep |
| **R04P-06** | Scénarios H-01…H-09 spécifiés | §3 | Prep |
| **R04P-07** | Fixture R04 synthétique planifiée (`*.example.test`) — **pas** créée runtime | chemin `fixtures/r04*` (mission fixtures) | Prep |
| **R04P-08** | Mock Δ POST/CLAIM = 0 pour R04 | 029 | Prep |
| **R04P-09** | Seed session post-R01 OPTION A (ASK_EMAIL + slotId) documenté | 018 / R009 | Prep |
| **R04P-10** | Scanner offline implémenté + vert | unit test futur | **GO-CONDITIONAL** outillage |
| **R04P-11** | Autorisation humaine + préflight PASS | hors 030 | **R04-RUNTIME** seulement |

**Décision prep 030 (docs) :** critères **R04P-01…R04P-09** = **PASS** (spécifiés).  
**R04P-10** = **OPEN** (implémentation non faite ici).  
**R04-RUNTIME / R05–R07 / LIVE / auto-next** = **NO-GO** (blocages 029 conservés).

---

## 5. Mapping STOP / verdicts

| Match | Code STOP / assertion | Verdict |
| --- | --- | --- |
| E-mail clair rapport | `pii-cleartext-email` → `pii-in-report` | **FAIL** |
| Tél clair rapport | `pii-cleartext-phone` → `pii-in-report` | **FAIL** |
| Token / secret | `secret-or-token-cleartext` | **FAIL** |
| Fixture non synthétique | `pii-fixture-real` | **STOP** préflight futur |
| Fichier illisible / scan partiel | — | **UNCERTAIN** (pas de PASS hygiene) |

Violation hygiene **n’équivaut pas** à confusion TEST/LIVE (SEC-C01/C02 inchangés).

---

## 6. Livrables 030 (QA)

| Livrable | Chemin | Statut |
| --- | --- | --- |
| Ce document | `docs/recovery/REC008_R04_PREP_ARTIFACT_HYGIENE_TESTS.md` | **Créé** |
| Catalogue patterns | `tests/rec008/readiness/R030-r04-prep-artifact-hygiene.json` | **Créé** |
| Verdict QA | `tests/rec008/reports/R04-PREP-030-qa-criteria.md` | **Créé** |
| Unit scanner | `tests/rec008/unit/artifact-hygiene-r030.test.cjs` | **Non** (mission outillage) |
| Runtime R04 | — | **NO-GO** |

---

## 7. Décisions

| Gate | Décision |
| --- | --- |
| Mission docs 030 (hygiene + R04-PREP) | **PASS** |
| R04-PREP (critères docs) | **GO-CONDITIONAL** (ouvert sur R04P-10 scanner) |
| R04-RUNTIME | **NO-GO** |
| R05–R07 / LIVE / auto-next | **NO-GO** |

**Arrêt.** Aucune phase runtime ouverte.
