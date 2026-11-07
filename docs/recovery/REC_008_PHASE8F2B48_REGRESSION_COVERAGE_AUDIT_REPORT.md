# REC-008 phase 8F-2B48 — Audit de couverture et plan de non-régression

Audit **strictement hors ligne** de la couverture des exigences REC-008, à partir des rapports, artefacts et tests déjà produits. Aucun test métier nouveau, aucun message de chat, aucune activation n8n, aucun PUT, aucune mutation SQL, aucun changement mock/Compose, aucun CLAIM, aucun POST CreateAppointment, aucun e-mail, aucune exécution LIVE.

Verdict phase : **PASS**  
GO/NO-GO phases suivantes : **GO** (sous autorisations distinctes, une phase à la fois)

Artefacts : `n8n/proposed/2026-11-01-rec008-phase8f2b48-REGRESSION-COVERAGE-AUDIT/`  
(`PREFLIGHT.json`, `POSTFLIGHT.json`, `COVERAGE_MATRIX.json`, `preflight-readonly.js`, `postflight-readonly.js`)

Sources historiques **non modifiées** (dont 8F-2B45 / 8F-2B46 / 8F-2B47).

## 1. Préflight

Lecture seule. Aucun écart inexpliqué. STOP non déclenché.

| Contrôle | Attendu | Observé | OK |
| --- | --- | --- | --- |
| Workflow `OCD9It1uKFhOoWNF` | inactif | `active=false`, `activeVersionId=null` | oui |
| Version ID | `e1b32992-bc68-46af-86ce-c80af46f5305` | identique | oui |
| VersionCounter | 8 | 8 | oui |
| Graphe | 134 / 137 | 134 / 137 | oui |
| SHA Finaliser | `3fc500bfed99c202156005d252a864cdc25514c93e7e47c842ae896381e8ee7a` | identique ; `__ABSENT__` + `::uuid` | oui |
| Autres workflows actifs | 0 | 0 | oui |
| PostgreSQL TEST | 1 / 10 / 4 / 0 | **1\|10\|4\|0** | oui |
| Tentatives ouvertes | 0 | **0** | oui |
| Statuts | ABANDONED 1, CONFIRMED 2, EXPIRED 1 | identique | oui |
| Mock POST | 1 | **1** (`POST /appointments 201`=1) | oui |
| LIVE fingerprint | `a2dea067599fd4f0a5f857551adc67cc` | `13\|14\|12\|48\|0\|a2dea067…` | oui |
| Mailpit | 5 / 2 / 98 304 | identique | oui |
| `saveDataSuccessExecution` | `none` | **`none`** | oui |

Horodatage : `PREFLIGHT.json` → `2026-11-01T14:21:18.290Z`.

## 2. Inventaire des exigences

Références structurantes (lues, non réécrites) :

| Source | Rôle |
| --- | --- |
| `REC_008_STATE_MACHINE.md` | Transitions, messages reconnus, figement |
| `REC_008_TEST_MATRIX.md` | S1–S12, Q1–Q9, C1–C18 |
| `REC_008_PHASE8F2A_CONFIRMATION_TEST_PLAN.md` | Matrice C1–C20, vagues A–D |
| `REC_008_PHASE8A_DESIGN_REPORT.md` | Conception confirmation / table tentatives |
| Migration `postgres/migrations/20261030_rec008_attempts.sql` | Schéma + fonctions |
| `postgres/tests/20261030_rec008_attempts_tests.sql` | Q1–Q9 transactionnels |
| Phases 8D / 8D2 | SQL + concurrence réelle |
| Phases 8F-2B10 → 8F-2B47 | Preuves conversationnelles, audits, verdict |

Familles d’exigences retenues pour la matrice : **Conversation**, **Idempotence**, **Erreurs**, **Cycle de vie**, **Sécurité**.

Règle de preuve : un test SQL réussi **ne suffit pas** à déclarer PASS un scénario conversationnel non exécuté. Aucun résultat inventé pour un rapport absent.

## 3. Matrice de couverture

Légende : **PASS** / **FAIL** / **PARTIAL** / **NOT_TESTED** / **BLOCKED**.  
Matrice machine : `COVERAGE_MATRIX.json`.

### 3.1 Conversation

| ID | Description | Risque | Phase(s) | Preuve | Statut | Prochaine action |
| --- | --- | --- | --- | --- | --- | --- |
| CONV-01 | Collecte service/site/date | MEDIUM | 8F-2B28, 8F-2B37 | E2E chat | **PASS** | Précondition des phases suivantes |
| CONV-02 | Sélection de créneau | MEDIUM | 8F-2B29, 8F-2B38 | E2E chat | **PASS** | Non-régression si parseur index change |
| CONV-03 | Collecte nom/prénom/e-mail/téléphone | MEDIUM | 8F-2B30–33, 8F-2B39–42 | E2E chat | **PASS** | Couvert (dernière vague 39–42) |
| CONV-04 | Récapitulatif obligatoire + INSERT | HIGH | 8F-2B11, 19, 33, 42 | E2E chat | **PASS** | Précondition confirmation |
| CONV-05 | Confirmation `oui` exacte (CLAIM→POST→CONFIRMED→Finaliser 200) | CRITICAL | 8F-2B20 (FAIL partiel), 34 (FAIL TTL), 43 (UNCERTAIN transport), **45 PASS**, 46–47 | E2E + audit + unit verdict | **PASS** | Réutiliser `verdict.js` 8F-2B47 |
| CONV-06 | Refus `non` | HIGH | 8F-2B12 | E2E chat | **PASS** | Non-régression Parser/Décider |
| CONV-07 | Modification après récapitulatif | HIGH | — | — | **NOT_TESTED** | **8F-2B49** |
| CONV-08 | Message ambigu (`peut-être`) | HIGH | — | — | **NOT_TESTED** | **8F-2B50** |
| CONV-09 | Confirmation hors contexte | HIGH | 8F-2B13 | E2E (`oui` après ABANDONED) | **PARTIAL** | Compléter C9 (`oui` en `ASK_NOM`) en **8F-2B50b** |

### 3.2 Idempotence

| ID | Description | Risque | Phase(s) | Preuve | Statut | Prochaine action |
| --- | --- | --- | --- | --- | --- | --- |
| IDEM-01 | Clé CSPRNG par tentative | HIGH | 8F-2B11/42, 8D | E2E + SQL | **PASS** | Contrôle longueur/empreinte |
| IDEM-02 | Conservation corps figé | HIGH | 8F-2B20/45, 8D | E2E + SQL | **PASS** | Empreinte avant/après claim |
| IDEM-03 | Un seul CLAIM | CRITICAL | 8F-2B45, 8D, 8D2 | E2E + SQL + course | **PASS** | Double oui chat encore ouvert |
| IDEM-04 | Un seul POST | CRITICAL | 8F-2B45 | E2E + mock | **PASS** | Baseline POST=1 |
| IDEM-05 | Double `oui` séquentiel | CRITICAL | — | — | **NOT_TESTED** | **8F-2B51** (prioritaire) |
| IDEM-06 | Double `oui` concurrent | CRITICAL | 8D2 | SQL concurrence seule | **PARTIAL** | **8F-2B52** E2E |
| IDEM-07 | REPLAYED HTTP 200 | HIGH | 8F-2B21 T3 | Unit hors ligne | **PARTIAL** | **8F-2B53** mock |
| IDEM-08 | KEY_CONFLICT HTTP 409 | HIGH | — | — | **NOT_TESTED** | **8F-2B56** |
| IDEM-09 | SLOT_UNAVAILABLE HTTP 409 | HIGH | — | — | **NOT_TESTED** | **8F-2B55** |

### 3.3 Erreurs

| ID | Description | Risque | Phase(s) | Preuve | Statut | Prochaine action |
| --- | --- | --- | --- | --- | --- | --- |
| ERR-01 | HTTP 400 → REJECTED | HIGH | — | — | **NOT_TESTED** | **8F-2B57** |
| ERR-02 | HTTP 500 → UNCERTAIN | CRITICAL | 8F-2B20 contrat, 8F-2B21 | Audit + unit | **PARTIAL** | **8F-2B54** mock `error` |
| ERR-03 | Timeout → UNCERTAIN | CRITICAL | 8F-2B20 contrat | Audit | **PARTIAL** | **8F-2B54** mock `timeout` |
| ERR-04 | Échec réseau avant réception | HIGH | 8F-2B43, 8F-2B44 | E2E transport | **PARTIAL** | Instrumentation OK ; pas de simu mock métier |
| ERR-05 | Échec réseau après réception possible | CRITICAL | — | — | **NOT_TESTED** | Phase ultérieure (risque double POST) |
| ERR-06 | Réponse non reconnue | HIGH | 8F-2B20 | Audit classement | **PARTIAL** | E2E absent |
| ERR-07 | État UNCERTAIN | CRITICAL | 8D, 8D2 | SQL | **PARTIAL** | E2E après 8F-2B54 |
| ERR-08 | Récupération après lease expiré | CRITICAL | 8D, 8D2 course C | SQL | **PARTIAL** | **8F-2B58** |

### 3.4 Cycle de vie

| ID | Description | Risque | Phase(s) | Preuve | Statut | Prochaine action |
| --- | --- | --- | --- | --- | --- | --- |
| LIFE-01 | AWAITING_CONFIRMATION | HIGH | 8F-2B11/42, 8D | E2E + SQL | **PASS** | — |
| LIFE-02 | SUBMITTING | HIGH | 8D/8D2, 8F-2B45 | SQL + implicite E2E | **PARTIAL** | Snapshot intermédiaire rare en E2E |
| LIFE-03 | CONFIRMED | CRITICAL | 8F-2B45, 8D | E2E + SQL | **PASS** | 2 lignes en baseline |
| LIFE-04 | ABANDONED | HIGH | 8F-2B12, 8D | E2E + SQL | **PASS** | — |
| LIFE-05 | REJECTED | HIGH | 8D (fonction) | SQL schéma | **NOT_TESTED** | Lié ERR-01 / IDEM-08 |
| LIFE-06 | SLOT_UNAVAILABLE | HIGH | — | — | **NOT_TESTED** | Lié IDEM-09 |
| LIFE-07 | EXPIRED | HIGH | 8F-2B35–36, 8D | E2E + audit + SQL | **PASS** | — |
| LIFE-08 | Purge clé/corps | CRITICAL | 8F-2B12/36/45, 8D | E2E + SQL | **PASS** | ABD / EXP / CONF |
| LIFE-09 | Absence double réservation | CRITICAL | 8F-2B45 | E2E + mock | **PARTIAL** | Manque double confirmation |
| LIFE-10 | Nettoyage session | HIGH | 8F-2B27, 8F-2B45 | E2E + SQL reconcil. | **PASS** | — |
| LIFE-11 | Préservation historiques | HIGH | 8F-2B45–47 | Intégrité | **PASS** | Baseline 4 / 0 ouverte |

### 3.5 Sécurité

| ID | Description | Risque | Phase(s) | Preuve | Statut | Prochaine action |
| --- | --- | --- | --- | --- | --- | --- |
| SEC-01 | Isolation TEST/LIVE | CRITICAL | 8E-2B1/2, 8F-2B* | Audit + fingerprint | **PASS** | Pré/postflight obligatoires |
| SEC-02 | Permissions PG minimales | HIGH | 8B, 8C, 8E-2B2 | Audit migration | **PASS** | REVOKE/GRANT documentés |
| SEC-03 | Absence fuite token | HIGH | 8F-2B21/45/47 | Unit + E2E | **PASS** | — |
| SEC-04 | Absence fuite clé idempotence | HIGH | 8F-2B11/45, 8D | E2E + SQL | **PASS** | Empreintes tronquées |
| SEC-05 | Absence PII dans logs | MEDIUM | 8F-2B47 | Unit fixtures | **PARTIAL** | Auditer réutilisation `run.js` |
| SEC-06 | Absence exécution LIVE | CRITICAL | 8F-2B10–47 | Intégrité | **PASS** | Fingerprint stable |
| SEC-07 | Désactivation après test | CRITICAL | 8F-2B12/45 + préflight | E2E + lecture | **PASS** | `active=false` actuel |

### 3.6 Synthèse quantitative

| Statut | Nombre |
| --- | --- |
| PASS | 24 |
| PARTIAL | 14 |
| NOT_TESTED | 10 |
| FAIL | 0 (échecs historiques corrigés ou remplacés) |
| BLOCKED | 0 |

Aucun scénario critique restant en **FAIL** ouvert : les FAIL 8F-2B20 / 8F-2B24 / 8F-2B34 ont été corrigés ou contournés (Finaliser VC8, nouvelle session, retry 8F-2B45). Le faux négatif script 8F-2B45 est corrigé hors ligne en 8F-2B47.

## 4. Preuves disponibles

Classification stricte.

### 4.1 Tests unitaires hors ligne

| Artefact | Couverture |
| --- | --- |
| 8F-2B21 T1–T20 | Finaliser / REPLAYED / UNCERTAIN / portes / pas de LIVE |
| 8F-2B23 T1–T20 | Réconciliation + forme SQL |
| 8F-2B47 `test-verdict.js` (14/14) | Verdict finalisation vs observabilité REST |

### 4.2 Tests SQL

| Artefact | Couverture |
| --- | --- |
| 8D `20261030_rec008_attempts_tests.sql` | Q1–Q9 + reprise / bail (transaction + ROLLBACK) |
| 8D2 courses A–D | CLAIM concurrent, RESUME concurrent, bail expiré, CONFIRMED non réclamable |

### 4.3 Tests mock HTTP

| Artefact | Couverture |
| --- | --- |
| 8F-2B45 | Scénario `created` → POST 201 unique (`Δ=+1`, baseline actuelle 1) |
| — | Scénarios `timeout` / `error` / `slot` / `conflict` / `replayed` **non exécutés** en chat |

### 4.4 Tests conversationnels de bout en bout

| Vague observée | Phases | Résultat |
| --- | --- | --- |
| Collecte + récap (× plusieurs sessions) | 8F-2B10–11, 14–19, 28–33, 37–42 | PASS |
| Refus `non` | 8F-2B12 | PASS |
| `oui` hors tentative abandonnée | 8F-2B13 | PASS (pas de POST) |
| Confirmation positive (chemin métier) | 8F-2B20 | FAIL Finaliser (corrigé ensuite) |
| Expiration | 8F-2B35–36 | PASS |
| Confirmation positive + Finaliser 200 | 8F-2B45 | PASS métier (script legacy FAIL observabilité) |
| Transport `fetch failed` | 8F-2B43–44 | UNCERTAIN / INCONCLUSIVE |

### 4.5 Audits statiques / intégrité

| Artefact | Couverture |
| --- | --- |
| 8E-1 / 8E-2B1 | Diff nœuds, isolation Docker, URLs |
| 8F-2B8 / 8F-2B23 / 8F-2B35 / 8F-2B46 | Validation, réconciliation, expiration, observabilité |
| Pré/postflight systématiques | LIVE fingerprint, Mailpit, graphe, SHA Finaliser |

## 5. Lacunes de validation

Priorisées (pas inventées).

1. **Double confirmation** (séquentielle et concurrente) — critique idempotence / anti double réservation.
2. **Branches d’erreur mock** (500, timeout, 409 slot, 409 key, 400) — jamais basculées en E2E sous autorisation.
3. **Modification après récap** et **message ambigu** — absents des rapports 8F-2B*.
4. **Replay HTTP 200** et **reprise UNCERTAIN / lease expiré** — SQL oui, conversation non.
5. **Échec réseau après réception possible** — non couvert ; risque théorique de double POST.
6. **`oui` pendant collecte** (C9 plan 8F-2A) — seulement partiellement couvert via abandonné (8F-2B13).
7. **Observabilité REST** — politique `saveDataSuccessExecution=none` : preuve Finaliser = état PG + événements, pas `/rest/executions` (documenté 8F-2B46/47).

## 6. Risques prioritaires

| Rang | Risque | Exigence(s) | Pourquoi maintenant |
| --- | --- | --- | --- |
| 1 | Second POST / double réservation | IDEM-05/06, LIFE-09 | Un seul succès E2E ; pas de second `oui` testé |
| 2 | UNCERTAIN non récupéré | ERR-02/03/07/08 | Branches mock non exercées |
| 3 | KEY_CONFLICT / SLOT mal classés | IDEM-08/09, LIFE-05/06 | Message 409 exact vs autre → UNCERTAIN (plan 8F-2A) |
| 4 | Modification / ambigu → POST involontaire | CONV-07/08 | Aucune preuve E2E |
| 5 | Faux négatif script | — | Mitigé par `verdict.js` 8F-2B47 ; à réutiliser |
| 6 | Transport client fragile | ERR-04 | Observé 8F-2B43 ; instrumentation 8F-2B45 OK |
| 7 | Fuite PII via logs scripts | SEC-05 | PARTIAL |

## 7. Plan des phases suivantes

Phases **indépendantes**, chacune limitée à un scénario (ou groupe cohérent) **sans effet métier LIVE**. **Non exécutées** dans 8F-2B48. Ordre = risque décroissant, préconditions respectées.

Préconditions transversales pour toute phase chat :

- Workflow TEST inactif en entrée ; activation contrôlée puis désactivation.
- Version `e1b32992-…` / VC 8 / 134–137 / SHA Finaliser inchangé (sauf phase d’install autorisée).
- PG `1|10|4|0`, ouvertes 0, mock POST baseline documentée, LIVE `a2dea067…`, Mailpit inchangé.
- Session / tentative synthétiques dédiées ; identity fictive Dupont/Camille.
- Verdict via module 8F-2B47 (import), **sans modifier** artefacts historiques.
- STOP si POST inattendu, Δ LIVE, activation hors cible, ou scénario mock non restauré.

### 8F-2B49 — Modification après récapitulatif (CONV-07)

| Champ | Contenu |
| --- | --- |
| Objectif | `modifier le nom` → ABANDONED, retour `ASK_NOM`, 0 POST |
| Préconditions | Nouvelle session jusqu’à `AWAIT_CREATE_CONFIRMATION` (ou tentative ouverte dédiée) |
| Message | `modifier le nom` |
| Attendu | Tentative `ABANDONED` ; clé/corps purgés ; brouillon partiel ; mock POST inchangé |
| Effets autorisés | UPDATE/INSERT tentatives TEST ; session TEST |
| STOP | Tout POST ; CLAIM ; LIVE Δ |
| Risque | HIGH |
| GO/NO-GO | PASS si 0 POST + ABANDONED + pas de nouvelle clé sur l’ancienne ligne |

### 8F-2B50 — Message ambigu (CONV-08)

| Champ | Contenu |
| --- | --- |
| Objectif | `peut-être` → reste `AWAITING_CONFIRMATION`, récap redemandé, 0 POST |
| Préconditions | Tentative ouverte valide (`secsLeft > 300`) |
| Message | `peut-être` |
| Attendu | Statut inchangé ; 0 CLAIM ; 0 POST |
| Effets autorisés | Réponse chat + éventuelle MAJ texte session |
| STOP | POST / ABANDONED / CLAIM |
| Risque | HIGH |
| GO/NO-GO | PASS si tentative toujours AWAITING et POST Δ=0 |

### 8F-2B50b — `oui` hors contexte collecte (CONV-09 complément)

| Champ | Contenu |
| --- | --- |
| Objectif | `oui` en `ASK_NOM` → pas de CLAIM/POST |
| Préconditions | Session arrêtée à `ASK_NOM` |
| Message | `oui` |
| Attendu | Reste collecte ; 0 tentative ouverte créée par ce message |
| STOP | Toute tentative / POST |
| Risque | HIGH |
| GO/NO-GO | PASS si 0 CLAIM et 0 POST |

### 8F-2B51 — Double `oui` séquentiel (IDEM-05) — **priorité 1**

| Champ | Contenu |
| --- | --- |
| Objectif | Second `oui` après CONFIRMED → rappel référence, **pas** de 2ᵉ POST |
| Préconditions | Session fraîchement CONFIRMED (nouvelle construction si besoin) ; mock POST baseline notée |
| Message | second `oui` |
| Attendu | POST Δ=0 ; CLAIM=0 ; même référence ; tentatives historiques préservées |
| Effets autorisés | Lecture session ; éventuelle réponse textuelle |
| STOP | POST Δ≥1 ; nouvelle clé ; LIVE Δ |
| Risque | CRITICAL |
| GO/NO-GO | PASS si mock POST inchangé et référence rappelée |

### 8F-2B52 — Double `oui` concurrent (IDEM-06)

| Champ | Contenu |
| --- | --- |
| Objectif | Deux webhooks chat simultanés → un seul CLAIM, un seul POST |
| Préconditions | Tentative AWAITING valide ; instrumentation timestamps |
| Action | Deux POST chat parallèles `oui` |
| Attendu | `distinctKeys`=1 ; POST Δ=1 ; une ligne CONFIRMED |
| Effets autorisés | 1 POST mock max |
| STOP | POST Δ>1 ; 2 CONFIRMED pour même session ouverte |
| Risque | CRITICAL |
| GO/NO-GO | PASS si un seul gagnant claim + un seul POST |

### 8F-2B53 — REPLAYED HTTP 200 (IDEM-07)

| Champ | Contenu |
| --- | --- |
| Objectif | Mock `replayed` → CONFIRMED sans nouvelle clé |
| Préconditions | Autorisation changement scénario mock + restauration `created` |
| Message | `oui` (ou reprise UNCERTAIN selon setup) |
| Attendu | HTTP 200 replayed ; même référence ; 0 double réservation |
| STOP | Nouvelle clé ; POST créant un second id |
| Risque | HIGH |
| GO/NO-GO | PASS si CONFIRMED + clé unique + mock restauré |

### 8F-2B54 — Timeout / HTTP 500 → UNCERTAIN (ERR-02/03/07) — **priorité 2**

| Champ | Contenu |
| --- | --- |
| Objectif | Mock `timeout` puis `error` → UNCERTAIN ; clé/corps conservés |
| Préconditions | Autorisation mock ; session AWAITING ; restauration finale `created` |
| Message | `oui` |
| Attendu | UNCERTAIN ; 0 CONFIRMED ; pas de purge clé |
| STOP | CONFIRMED ; purge prématurée ; mock non restauré |
| Risque | CRITICAL |
| GO/NO-GO | PASS si UNCERTAIN + clés présentes + mock restauré |

### 8F-2B55 — SLOT_UNAVAILABLE (IDEM-09 / LIFE-06)

| Champ | Contenu |
| --- | --- |
| Objectif | Mock `slot` 409 → `SLOT_UNAVAILABLE` + retour créneau |
| Préconditions | Autorisation mock `slot` |
| Message | `oui` |
| Attendu | Statut SLOT_UNAVAILABLE ; pas de CONFIRMED ; pas de retry silencieux ancien corps |
| STOP | CONFIRMED ; POST supplémentaire non documenté |
| Risque | HIGH |
| GO/NO-GO | PASS si statut + session `ASK_CREATE_SLOT` |

### 8F-2B56 — KEY_CONFLICT (IDEM-08 / LIFE-05)

| Champ | Contenu |
| --- | --- |
| Objectif | Mock `conflict` → REJECTED |
| Préconditions | Autorisation mock `conflict` |
| Message | `oui` |
| Attendu | REJECTED ; brouillon effacé ; pas de nouvelle clé auto |
| STOP | Nouvelle clé silencieuse ; CONFIRMED |
| Risque | HIGH |
| GO/NO-GO | PASS si REJECTED + purge conforme |

### 8F-2B57 — HTTP 400 → REJECTED (ERR-01)

| Champ | Contenu |
| --- | --- |
| Objectif | Réponse 400 mock → REJECTED |
| Préconditions | Scénario mock 400 disponible sous autorisation |
| Message | `oui` |
| Attendu | REJECTED ; 0 rendez-vous |
| STOP | UNCERTAIN mal classé si 400 clair ; LIVE Δ |
| Risque | HIGH |
| GO/NO-GO | PASS si REJECTED |

### 8F-2B58 — Reprise après lease expiré (ERR-08)

| Champ | Contenu |
| --- | --- |
| Objectif | Après UNCERTAIN + lease échu → RESUME même clé/corps, un POST |
| Préconditions | Sortie 8F-2B54 ; bail expiré (attente naturelle ou setup autorisé) |
| Message | message suivant session |
| Attendu | Même empreinte clé/corps ; 1 POST ; pas de 2ᵉ tentative ouverte |
| STOP | Nouvelle clé ; 2 POST ; LIVE Δ |
| Risque | CRITICAL |
| GO/NO-GO | PASS si reprise mono-clé démontrée |

### 8F-2B59 — Échec réseau après réception possible (ERR-05)

| Champ | Contenu |
| --- | --- |
| Objectif | Documenter/contrôler comportement si client ne reçoit pas la réponse alors que mock a 201 |
| Préconditions | Instrumentation avancée ; autorisation distincte |
| Action | À définir (injection contrôlée) — **pas** d’improvisation |
| Attendu | Pas de second POST créateur ; reprise ou RECALL sûr |
| STOP | Second POST ; incertitude non classée |
| Risque | CRITICAL |
| GO/NO-GO | PASS seulement avec preuve anti-double POST |

### Ordre d’exécution recommandé

```text
8F-2B49 → 8F-2B50 → 8F-2B50b
    → 8F-2B51 (double oui séquentiel)
    → 8F-2B52 (double oui concurrent)
    → 8F-2B54 (UNCERTAIN timeout/500)
    → 8F-2B58 (reprise lease)
    → 8F-2B53 (REPLAYED)
    → 8F-2B55 (SLOT) → 8F-2B56 (KEY) → 8F-2B57 (400)
    → 8F-2B59 (réseau post-réception) [si toujours nécessaire]
```

Chaque phase exige une **autorisation distincte**.

## 8. Stratégie de réutilisation du verdict corrigé

Artefacts 8F-2B47 (inchangés) :

| Fichier | Usage futur |
| --- | --- |
| `verdict.js` | `require('…/verdict').evaluateVerdict(snapshot)` |
| `test-verdict.js` / `UNIT_TEST_RESULTS.json` | Non-régression hors ligne avant intégration script |
| `COMPARISON_8F2B45.json` | Preuve historique faux négatif corrigé |
| `fixtures/base-success.js` | Fixtures synthétiques sans PII |

Règles d’intégration **sans toucher l’historique** :

1. **Copier ou importer** `verdict.js` (et éventuellement `fixtures/`) dans le répertoire de la **nouvelle** phase (`…-phase8f2bXX-…/`), ou `require` le chemin absolu 8F-2B47 en lecture seule.
2. **Ne jamais** réécrire `RESULT.json` / `run.js` de 8F-2B45–46–47.
3. Les nouveaux `run.js` doivent construire un **snapshot normalisé** (checks métier + `saveDataSuccessExecution` + `events` + `finaliserExec`) puis appeler `evaluateVerdict`.
4. Avec politique `none` et REST vide : accepter `finalizationEvidenceLevel` ∈ {`event_corroborated`, `indirect_strong`} ; **jamais** déclarer preuve `direct`.
5. Conserver les FAIL métier (HTTP 500, non CONFIRMED, POST Δ≠1, CLAIM≠1, LIVE modifié, workflow encore actif).
6. Transport sans état final → `UNCERTAIN` ; politique inconnue + REST vide → `INCONCLUSIVE`.
7. Avant première utilisation runtime, rejouer `node test-verdict.js` depuis une **copie** locale si le module est dupliqué.

Cette phase **n’intègre ni ne déploie** le module dans les scripts métier.

## 9. Intégrité postflight

Relecture système (`POSTFLIGHT.json`) après rédaction des artefacts d’audit uniquement.

| Contrôle | OK |
| --- | --- |
| PG `1\|10\|4\|0` | oui |
| Ouvertes 0 ; ABD1 / CONF2 / EXP1 | oui |
| Mock POST = 1 | oui |
| LIVE `a2dea067…` | oui |
| Mailpit 5 / 2 / 98 304 | oui |
| Workflow inactif / VC 8 / 134–137 / SHA Finaliser | oui |
| Inchangé vs préflight | oui |
| Aucun chat / activation / PUT / SQL / mock / LIVE | oui |
| Artefacts 8F-2B45/46/47 non touchés | oui |

## 10. Verdict

**PASS**

L’audit hors ligne est complet : préflight conforme, matrice exigences → preuves établie sans invention, lacunes et risques priorisés, plan de phases non exécuté, stratégie verdict 8F-2B47 définie, intégrité postflight préservée.

## 11. GO/NO-GO

**GO** pour les phases de non-régression proposées (**8F-2B49+**), chacune sous **autorisation distincte**.

**NO-GO** immédiat pour : exécution groupée multi-scénarios, bascule mock sans restauration, double `oui` sans préflight, toute écriture LIVE, toute modification des artefacts historiques 8F-2B45–47.

Restrictions respectées : lecture seule TEST/LIVE ; seuls le présent rapport et les artefacts d’audit 8F-2B48 créés ; aucun message ; aucune activation ; aucun PUT ; aucune SQL ; aucun Compose ; aucun mock ; aucun CLAIM ; aucun POST CreateAppointment ; aucun e-mail ; aucune exécution LIVE.

Arrêt ici. Attente d’une nouvelle autorisation.
