# REC-008 phase 8F-2B47 — Correction hors ligne du verdict automatisé de finalisation

Objectif : corriger le faux négatif du script 8F-2B45 (`pass=false` / `verdict=FAIL` / `finaliserExec=null`) sans nouveau message, sans activation, sans réservation.

Cause déjà démontrée en 8F-2B46 : `saveDataSuccessExecution=none` → l’API REST ne conserve pas l’exécution réussie.

Verdict phase : **PASS**  
GO/NO-GO tests suivants : **GO** (sous autorisation distincte)

Artefacts : `n8n/proposed/2026-11-01-rec008-phase8f2b47-VERDICT-FIX/`  
Sources historiques **inchangées** :  
`…/phase8f2b45-POSITIVE-CONFIRMATION-RETRY/` (`run.js`, `RESULT.json`, …)  
`…/phase8f2b46-FINALIZATION-OBSERVABILITY-AUDIT/` (`AUDIT.json`, …)

## 1. Préflight

| Contrôle | Attendu | Observé | OK |
| --- | --- | --- | --- |
| Workflow `OCD9It1uKFhOoWNF` | inactif | `active=false`, `activeVersionId=null` | oui |
| Version ID | `e1b32992-bc68-46af-86ce-c80af46f5305` | identique | oui |
| VersionCounter | 8 | 8 | oui |
| Graphe | 134 / 137 | 134 / 137 | oui |
| SHA Finaliser | `3fc500bf…ee7a` | identique ; `__ABSENT__` + `::uuid` | oui |
| Autres workflows actifs | 0 | 0 | oui |
| PostgreSQL TEST | 1 / 10 / 4 / 0 | **1\|10\|4\|0** | oui |
| Tentatives ouvertes | 0 | **0** | oui |
| Mock POST | 1 | **1** (`POST /appointments 201`=1) | oui |
| LIVE | `13\|14\|12\|48\|0\|a2dea067…` | identique | oui |
| Mailpit | 5 / 2 / 98 304 | identique | oui |
| `saveDataSuccessExecution` | `none` | **`none`** | oui |

Préflight **OK** (`PREFLIGHT.json`). Aucun écart inexpliqué. STOP non déclenché.

## 2. Cause du faux négatif

Dans `run.js` 8F-2B45 :

```text
pass = functionalOk && attemptOk && sessionOk && finaliserOk
     && postOk && integrityOk && deactivateOk && claimCount === 1

finaliserOk = finaliserExec && finaliserExec.finaliserRan && …
```

Avec `saveDataSuccessExecution=none`, `/rest/executions` renvoie 0 ligne → `finaliserExec=null` → `finaliserOk` falsy → **`pass=false`** / **`verdict=FAIL`**, alors que tous les checks métier (`functionalOk`, `attemptOk`, `sessionOk`, `postOk`, `integrityOk`, `deactivateOk`, `claimCount=1`) sont **true**.

Ce n’est pas un échec Finaliser ; c’est une lacune d’observabilité REST volontaire.

## 3. Fichiers créés

Répertoire : `n8n/proposed/2026-11-01-rec008-phase8f2b47-VERDICT-FIX/`

| Fichier | Rôle |
| --- | --- |
| `verdict.js` | Logique de verdict corrigée (+ legacy pour comparaison) |
| `fixtures/base-success.js` | Fixture synthétique de base (sans PII / clé / token) |
| `test-verdict.js` | 14 tests unitaires hors ligne |
| `re-evaluate-8f2b45.js` | Projection assainie + comparaison ancien/nouveau |
| `preflight-readonly.js` | Préflight lecture seule |
| `postflight-from-preflight.js` | Postflight d’intégrité |
| `PREFLIGHT.json` | Snapshot préflight |
| `POSTFLIGHT.json` | Snapshot postflight |
| `UNIT_TEST_RESULTS.json` | Résultats unitaires |
| `SANITIZED_RESULT45_PROJECTION.json` | Copie assainie du RESULT 8F-2B45 |
| `COMPARISON_8F2B45.json` | Ancien vs nouveau verdict |

**Non modifié** : `run.js` historique 8F-2B45, `RESULT.json` 8F-2B45, workflow n8n, SQL, mock, Compose, LIVE.

## 4. Nouvelle logique de verdict

Séparation explicite :

| Check | Rôle |
| --- | --- |
| `functionalOk` | HTTP 200, `type=appointment_created`, `success=true`, pas d’erreur workflow / 500 |
| `attemptOk` | Tentative `CONFIRMED`, référence cohérente, clé/corps absents, empreinte conservée |
| `sessionOk` | Session nettoyée, référence conservée, token absent |
| `postOk` | Mock POST Δ exactement +1, CLAIM = 1, pas de cancel |
| `integrityOk` | Historique + LIVE + Mailpit préservés |
| `deactivateOk` | Workflow désactivé après test |
| `observabilityOk` | Preuve Finaliser adaptée à la politique de conservation |
| `finalizationEvidenceLevel` | `direct` / `event_corroborated` / `indirect_strong` / `insufficient` / `contradicted` |

Règles clés :

1. Si `saveDataSuccessExecution=none` et REST vide : **pas de FAIL automatique** ; preuve `indirect_strong` ou `event_corroborated` suffit pour `observabilityOk`.
2. Si politique **inconnue** et REST vide → **`INCONCLUSIVE`**, jamais PASS automatique.
3. Si événement / REST d’échec Finaliser malgré HTTP 200 → **`FAIL`** ou **`INCONCLUSIVE`**, jamais PASS automatique.
4. Transport en échec **sans** état final démontré → **`UNCERTAIN`**.
5. **Jamais** `finalizationEvidenceLevel=direct` / `declaresRestDirectProof=true` lorsque REST est vide.

## 5. Résultats des tests unitaires

Exécution : `node test-verdict.js` — **14 / 14 PASS** (`UNIT_TEST_RESULTS.json`).

| # | Scénario | Verdict attendu | Observé |
| --- | --- | --- | --- |
| 1 | Succès métier + REST vide + `none` | PASS | PASS (`event_corroborated`) |
| 2 | Succès métier + REST dispo | PASS | PASS (`direct`) |
| 3 | HTTP 500 | FAIL | FAIL |
| 4 | Tentative non CONFIRMED | FAIL | FAIL |
| 5 | Session non nettoyée | FAIL | FAIL |
| 6 | Référence incohérente | FAIL | FAIL |
| 7 | Mock POST Δ 0 | FAIL | FAIL |
| 8 | Mock POST Δ > 1 | FAIL | FAIL |
| 9 | CLAIM > 1 | FAIL | FAIL |
| 10 | Transport incertain sans état final | UNCERTAIN | UNCERTAIN |
| 11 | Workflow encore actif | FAIL | FAIL |
| 12 | Intégrité LIVE modifiée | FAIL | FAIL |
| 13 | Politique inconnue + REST vide | INCONCLUSIVE | INCONCLUSIVE |
| 14 | Échec Finaliser explicite (événements) | FAIL/INCONCLUSIVE | INCONCLUSIVE |

Aucune requête métier exécutée pour ces tests.

## 6. Vérification de non-régression

- Les cas d’échec métier (3–9, 11–12) restent **FAIL**.
- Le cas transport (10) reste **UNCERTAIN**.
- Les cas d’observabilité ambiguë (13–14) ne passent **jamais** en PASS automatique.
- Le succès avec preuve REST directe (2) reste **PASS** / `direct`.
- Aucun artefact historique modifié.

## 7. Comparaison ancien / nouveau sur copie 8F-2B45

Projection assainie : `SANITIZED_RESULT45_PROJECTION.json`  
(événements Finaliser / `workflow.success` repris depuis l’audit 8F-2B46 ; politique `none`).

| Source | `pass` | `verdict` | Preuve |
| --- | --- | --- | --- |
| `RESULT.json` 8F-2B45 (historique) | false | FAIL | `finaliserExec=null` bloquant |
| Logique legacy (rejouée) | false | FAIL | idem |
| **Logique corrigée** | **true** | **PASS** | `event_corroborated` (pas `direct`) |

`falseNegativeFixed=true` ; `declaresRestDirectProof=false`.

## 8. Contrôle des données sensibles

| Exigence | Respect |
| --- | --- |
| Aucune clé d’idempotence complète dans les fixtures | oui (absentes) |
| Aucun corps figé réel | oui |
| Aucun token | oui (`token` vide ou `[PRESENT]`) |
| Aucune PII réelle dans fixtures / projection | oui (synthétique / présence seule) |
| Artefacts historiques inchangés | oui |

## 9. Intégrité postflight

Relecture après travaux hors ligne (`POSTFLIGHT.json`) :

| Contrôle | OK |
| --- | --- |
| PG toujours `1\|10\|4\|0` | oui |
| Ouvertes 0 | oui |
| Mock POST reste 1 | oui |
| LIVE inchangé | oui |
| Mailpit inchangé | oui |
| Workflow inactif / VC 8 / graphe / SHA | oui |
| Aucun chat / activation / PUT | oui |
| Artefacts 8F-2B45/46 non touchés | oui |

## 10. Verdict

**PASS**

La logique hors ligne corrige le faux négatif d’observabilité tout en conservant les échecs métier et les cas `INCONCLUSIVE` / `UNCERTAIN` requis.

## 11. GO/NO-GO

**GO** pour les tests REC-008 suivants, sous **autorisation distincte**.

Restrictions respectées : nouveaux fichiers hors ligne uniquement ; aucun changement workflow ; aucun PUT ; aucune SQL ; aucune activation ; aucun webhook chat ; aucun `oui`/`non` ; aucun POST CreateAppointment ; aucun Compose ; aucun e-mail ; aucun appel métier LIVE.

Arrêt ici. Attente d’une autorisation distincte.
