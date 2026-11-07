# REC-008 — Critères de tests sécurité R04–R07

Document formel (mission **SECURITY-POST-R0X-029** / QA). **Docs only.** Aucune exécution runtime, aucune activation n8n, aucun POST CreateAppointment, aucun LIVE.

**Statut :** grille **`PROPOSED`** (préparation). Les preuves runtime R04–R07 n’existent pas ; ASK_PRENOM R01–R03 reste clos (027–028) sans autoriser R04+.

Ancrages : rapports 018, 027, 028 ; `REC008_ASK_PRENOM_EXIT_CRITERIA.md` (CF-E1–CF-E3) ; `govsuite-safety.mdc`.

---

## 0. Gates prep vs runtime

| Cible | Gate **prep** (docs / fixtures / offline) | Gate **runtime** (chat / activate / PG mutate) | Condition pour lever le NO-GO runtime |
| --- | --- | --- | --- |
| **R04** ASK_EMAIL | **GO prep** | **NO-GO** | Auth humaine explicite + préflight PASS + 1 msg + 0 retry + mock Δ POST/CLAIM = 0 |
| **R05** ASK_TELEPHONE | **GO prep** | **NO-GO** | Idem R04 ; session post-email synthétique |
| **R06** CONFIRM sans CLAIM/POST | **GO prep** | **NO-GO** | Auth + garde mock ; AFFIRM autorisé ; **POST CreateAppointment interdit** ; Δ POST/CLAIM = 0 |
| **R07** CLAIM + POST **mock** | **GO prep** (plan mock only) | **NO-GO** | Auth + security-auditor GO + URL `rec008-mock` prouvée + anti-LIVE ; jamais CreateAppointment réel |
| **LIVE** | — | **NO-GO** | Hors périmètre ; aucune clôture ASK_PRENOM ni prep R0x ne lève ce gate |
| Auto-next / rejeu R01–R03 | — | **NO-GO** | Autorisation distincte uniquement |

**Règle :** un livrable prep **PASS** n’autorise **pas** le runtime. Une phase runtime **PASS** n’autorise **pas** la suivante.

---

## 1. Cartographie scénarios ↔ sécurité

| ID | Objectif métier (indicatif) | CF-E | Risque sécurité principal | Mock Δ attendu (runtime futur) |
| --- | --- | --- | --- | --- |
| **R04** | `ASK_EMAIL` → capture email synthétique → `ASK_TELEPHONE` | CF-E1 | Fuite PII email ; POST prématuré | POST **0** ; CLAIM **0** ; avail/services **0** |
| **R05** | `ASK_TELEPHONE` → tél synthétique → confirmation / `AWAIT_CREATE_CONFIRMATION` | CF-E1 | Fuite PII tél ; INSERT/POST anticipé | POST **0** ; CLAIM **0** |
| **R06** | AFFIRM explicite → tentative / récap ; **sans** CLAIM ni POST | CF-E2 | `skipCreateProgression` ; double AFFIRM ; POST sans gate | POST **0** ; CLAIM **0** |
| **R07** | AFFIRM + CLAIM → **1** POST mock CreateAppointment | CF-E3 | Double réservation ; POST LIVE ; idempotence non prouvée | POST mock **+1** ; CLAIM **+1** (bornés) ; LIVE **0** |

Fixtures : identités synthétiques uniquement (`Dupont` / `Camille` / emails `*.example.test` / tél `+33000000000`).

---

## 2. Assertions sécurité (catalogue prep)

Légende verdicts futurs : **PASS** | **FAIL** | **UNCERTAIN**. HTTP 200 ≠ succès métier.

### 2.1 Commun R04–R07 (runtime, quand autorisé)

| ID | Assertion | Critère d’arrêt si échec |
| --- | --- | --- |
| **SEC-C01** | Port / compose TEST (`:5682`, projet `govsuite-rec008-test`) | **STOP** `test-live-confusion` |
| **SEC-C02** | `liveTouched=false` ; aucune sonde LIVE `:5680` | **STOP** / **FAIL** isolation |
| **SEC-C03** | Exactement **1** message chat ; `retried=false` | **FAIL** process ; **STOP** `retry-performed` |
| **SEC-C04** | Timeout / corps ambigu → **UNCERTAIN** ; **pas** de second essai | **STOP** `timeout-or-transport` |
| **SEC-C05** | URLs CreateAppointment / disponibilité → préfixe `rec008-mock` | **STOP** `urls-or-credentials` |
| **SEC-C06** | Postflight : webhooks 0, running 0, workflow idle (sauf fenêtre contrôlée) | **FAIL** / **STOP** `deactivate-failed` |
| **SEC-C07** | Artefacts sans secret / token / PII citoyen ; synthétique masqué ou présent+longueur | **FAIL** hygiene PII (B9) |
| **SEC-C08** | Empreinte PG métier hors attendu → **UNCERTAIN**/FAIL ; pas de « correction » LIVE | **STOP** `pg-or-live-changed` |

### 2.2 R04 — ASK_EMAIL

| ID | Assertion | Attendu | Mock Δ |
| --- | --- | --- | --- |
| **R04-H01** | Transport HTTP | 200 + JSON parseable | — |
| **R04-M01** | Step avant | `ASK_EMAIL` + `slotId` présent (OPTION A) | — |
| **R04-M02** | Step après | `ASK_TELEPHONE` (ou contrat figé en prep) | — |
| **R04-M03** | Email capturé | valeur **synthétique** uniquement | — |
| **R04-S01** | Aucun CLAIM | `mockClaimsDelta=0` | CLAIM **0** |
| **R04-S02** | Aucun POST CreateAppointment | `mockPostsDelta=0` | POST **0** |
| **R04-S03** | Pas d’activation hors plan ; 0 retry | `retried=false` | — |
| **R04-P01** | Rapport : email masqué (`présent` + len) ou hash non réversible | pas de clair exportable hors TEST | — |

### 2.3 R05 — ASK_TELEPHONE

| ID | Assertion | Attendu | Mock Δ |
| --- | --- | --- | --- |
| **R05-H01** | Transport HTTP | 200 + JSON parseable | — |
| **R05-M01** | Step avant | `ASK_TELEPHONE` + identité partielle + `slotId` | — |
| **R05-M02** | Step après | `AWAIT_CREATE_CONFIRMATION` / récap (contrat prep) | — |
| **R05-M03** | Tél capturé | synthétique uniquement | — |
| **R05-S01** | Aucun CLAIM | `mockClaimsDelta=0` | CLAIM **0** |
| **R05-S02** | Aucun POST CreateAppointment | `mockPostsDelta=0` | POST **0** |
| **R05-S03** | Tentative ouverte : 0 **ou** INSERT documenté sans POST (figer en prep) | Δ POST reste 0 | POST **0** |
| **R05-P01** | Tél masqué dans artefacts | pas de clair hors TEST | — |

### 2.4 R06 — Confirmation AFFIRM sans CLAIM/POST

| ID | Assertion | Attendu | Mock Δ |
| --- | --- | --- | --- |
| **R06-H01** | Transport HTTP | 200 + JSON parseable | — |
| **R06-M01** | Intention | AFFIRM explicite (allowlist) ; pas free-text ambigu | — |
| **R06-M02** | `slotId` toujours présent | sinon **FAIL** (`skipCreateProgression` / confirm sans créneau) | — |
| **R06-M03** | État | `AWAIT_CREATE_CONFIRMATION` / tentative `AWAITING_*` **sans** CONFIRMED métier réel | — |
| **R06-S01** | **Zéro** CLAIM | `mockClaimsDelta=0` | CLAIM **0** |
| **R06-S02** | **Zéro** POST CreateAppointment | `mockPostsDelta=0` | POST **0** |
| **R06-S03** | Pas de 2ᵉ AFFIRM / retry | `retried=false` ; 1 msg | — |
| **R06-S04** | CreateAppointment non joignable hors mock dans le plan | préflight | — |
| **R06-P01** | Récap artefacts sans PII brute | masquage | — |

### 2.5 R07 — CLAIM + POST mock

| ID | Assertion | Attendu | Mock Δ |
| --- | --- | --- | --- |
| **R07-H01** | Transport HTTP chat | 200 + JSON parseable | — |
| **R07-M01** | AFFIRM + chemin CLAIM | claim acquis une fois | CLAIM **+1** |
| **R07-M02** | POST CreateAppointment | **uniquement** mock ; HTTP mock documenté (ex. 201) | POST **+1** |
| **R07-S01** | URL cible = `rec008-mock` (jamais host LIVE / prod) | préflight + postflight | LIVE **0** |
| **R07-S02** | Δ POST ∈ {1} ; pas de 2ᵉ POST | compteur borné | POST **+1** max |
| **R07-S03** | Δ CLAIM ∈ {1} ; pas de double claim concurrent non maîtrisé | sinon **FAIL**/UNCERTAIN | CLAIM **+1** |
| **R07-S04** | `liveTouched=false` ; fingerprint LIVE inchangé | isolation | — |
| **R07-S05** | Timeout POST → **UNCERTAIN** ; **STOP** ; conserver clé d’idempotence ; **0** retry | anti-double | — |
| **R07-P01** | Corps réponse mock expurgé (pas d’email/tél citoyen) | hygiene | — |

**Interprétation :** Δ0 sur R01–R06 = anti-régression conversationnelle, **pas** preuve d’anti-double-réservation. Seul R07 (runtime futur) peut exercer CLAIM/POST mock.

---

## 3. Conditions STOP (R04–R07)

Complète `tests/rec008/runtime/STOP-CONDITIONS-ASK-PRENOM.md` ; ne remplace pas les STOP install / P4G2.

### 3.1 Préflight → STOP (ne pas activer, ne pas poster)

| Code | Condition |
| --- | --- |
| `auth-missing` | Autorisation humaine absente / ambiguë / multi-scénarios |
| `prep-confused-as-runtime` | Traiter PASS docs/offline 029 comme GO runtime |
| `test-live-confusion` | Ports, credentials, volumes, `WEBHOOK_URL` LIVE ou mélange |
| `createappointment-unguarded` | Endpoint CreateAppointment réel dans le plan (R04–R06) ou non-mock (R07) |
| `mock-not-anchored` | Scénario mock / compteurs hors ancre préflight |
| `open-attempts-unexpected` | Tentatives ouvertes ≠ contrat fixture |
| `target-state-mismatch` | Step / `slotId` / identité hors profil R04–R07 |
| `pii-fixture-real` | Fixture avec email/tél/nom non synthétique |
| `r07-without-security-go` | Tentative R07 sans gate security + mock prouvé |
| `ask-prenom-closure-as-create-go` | Utiliser clôture 028 comme autorisation CREATE |

### 3.2 Pendant l’action unique → STOP

| Code | Condition |
| --- | --- |
| `timeout-or-transport` | Timeout / reset / HTTP ambigu → **UNCERTAIN**, **0** renvoi |
| `second-message` | 2ᵉ message (même run) |
| `retry-performed` | Tout retry automatique |
| `createappointment-post` | Tout POST CreateAppointment sur **R04–R06** |
| `createappointment-live` | Tout POST hors `rec008-mock` (surtout R07) |
| `claim-on-r04-r06` | CLAIM observé sur R04–R06 |
| `sql-mutation-extra` | Écriture SQL hors plan autorisé |
| `cross-scenario-send` | Message R0x sur session R0y |

### 3.3 Postflight → STOP / non-PASS

| Code | Condition |
| --- | --- |
| `claim-or-post-delta` | R04–R06 : CLAIM>0 ou POST>0 ; R07 : Δ hors {+1} |
| `live-touched` | `liveTouched≠false` ou drift empreinte LIVE |
| `pii-in-report` | Secret / PII citoyen / email clair non masqué dans rapport commité |
| `phase-auto-advance` | Autoriser R0(n+1) ou LIVE depuis ce run |
| `deactivate-failed` | Workflow / webhooks non idle après fenêtre |

### 3.4 Comportement au STOP

1. Halt immédiat ; désactiver si activation commencée (runtime autorisé).
2. Artefact d’échec : raison + checks + `scenarioId` — **sans** secret/PII.
3. Verdict **FAIL** (écart clair) ou **UNCERTAIN** (transport ambigu).
4. Pas de retry, pas de phase suivante, pas de LIVE.

---

## 4. Politique mock Δ

| Scénario | `mockPostsDelta` | `mockClaimsDelta` | Avail / services Δ | Lecture correcte |
| --- | --- | --- | --- | --- |
| R04 | **0** | **0** | **0** | Contact seul |
| R05 | **0** | **0** | **0** | Contact seul |
| R06 | **0** | **0** | **0** | Confirm gate **sans** écriture mock RDV |
| R07 | **+1** (mock) | **+1** | **0** sauf contrat | Exercice mock uniquement |
| R01–R03 (clos) | 0 | 0 | 0 | ≠ preuve anti-double |

Drift hors tableau → **STOP** `claim-or-post-delta` / `mock-drift`.

---

## 5. Politique PII / artefacts

| Règle | Prep | Runtime (futur) |
| --- | --- | --- |
| Identités | Synthétiques (`Dupont`, `Camille`, `user.r04@example.test`, `+33000000000`) | Idem ; jamais email citoyen |
| Rapports / JSON | Pas de secret ; email/tél en clair **déconseillé** (Low historique 024–026) | Masquer : `présent` + longueur ou hash non réversible |
| Snaps session | Flags / step / booléens préférés aux valeurs brutes | Idem |
| Mailpit | Ancre compteurs ; ne pas coller corps mail | Corps non commités |
| Export hors TEST | **Interdit** sans expurgation (B9) | Idem |

Violation → assertion **R0x-P01** / **SEC-C07** **FAIL** ; n’invalide pas à elle seule l’isolation TEST/LIVE si SEC-C01/C02 PASS.

---

## 6. Livrables prep attendus (hors exécution)

| Livrable | Emplacement indicatif | Statut 029 |
| --- | --- | --- |
| Ce document | `docs/recovery/REC008_R04_R07_SECURITY_TEST_CRITERIA.md` | **Créé** |
| Catalogue machine | `tests/rec008/readiness/R029-r04-r07-security-test-criteria.json` | **Créé** |
| Verdict QA docs | `tests/rec008/reports/SECURITY-POST-R0X-029-qa-criteria.md` | **Créé** |
| STOP dédié | `tests/rec008/runtime/STOP-CONDITIONS-R04-R07.md` | **Créé** |
| Fixtures R04–R07 | `tests/rec008/fixtures/…` | **Non** (mission suivante prep) |
| Hygiene artefacts R04-PREP (patterns FAIL) | `docs/recovery/REC008_R04_PREP_ARTIFACT_HYGIENE_TESTS.md` + `tests/rec008/readiness/R030-r04-prep-artifact-hygiene.json` | **Créé** (030 docs) |
| Scanner offline hygiene | `tests/rec008/unit/artifact-hygiene-r030.test.cjs` | **Non** (outillage) |
| Runner / campagne | `runtime-013/…` | **NO-GO** |

---

## 7. Décisions

| Gate | Décision 029 |
| --- | --- |
| Mission documentaire critères sécurité R04–R07 | **PASS** (docs) |
| Prep R04–R07 | **GO prep** |
| Runtime R04 / R05 / R06 / R07 | **NO-GO** |
| LIVE / auto-next / rejeu R01–R03 | **NO-GO** |

**Arrêt.** Aucune phase runtime ouverte par ce document.
