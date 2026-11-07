# REC-008 phase 8F-2B46 — Consolidation des preuves et audit d’observabilité (TEST isolé)

Réconciliation lecture seule du décalage 8F-2B45 : succès métier (HTTP 200, POST mock 201, `CONFIRMED`, session nettoyée) versus verdict automatisé `pass=false` / `verdict=FAIL` causé par `finaliserExec=null`.

**Aucun** message de chat, **aucun** `oui`/`non`, **aucun** retry, **aucune** activation, **aucun** PUT, **aucune** mutation SQL/mock/Compose, **aucun** CLAIM, **aucun** POST CreateAppointment, **aucun** e-mail, **aucun** appel LIVE métier.

Verdict audit : **PASS**  
GO/NO-GO scénarios REC-008 suivants : **GO**

Artefacts : `n8n/proposed/2026-11-01-rec008-phase8f2b46-FINALIZATION-OBSERVABILITY-AUDIT/`  
(`AUDIT.json`, `audit-readonly.js`)  
Sources 8F-2B45 : `…/phase8f2b45-POSITIVE-CONFIRMATION-RETRY/`  
(`PREFLIGHT.json`, `RESULT.json`, `response.txt`, `run.js`, `console.log`, `FINALISER_EXEC.json`, `audit-finaliser.js`)

## 1. Préflight

État observé = état post-8F-2B45 attendu (pas l’état préflight d’avant le `oui`).

| Contrôle | Attendu (post-8F-2B45) | Observé | OK |
| --- | --- | --- | --- |
| Workflow `OCD9It1uKFhOoWNF` | inactif, `activeVersionId=null` | `active=false`, `activeVersionId=null` | oui |
| Version ID | `e1b32992-bc68-46af-86ce-c80af46f5305` | identique | oui |
| VersionCounter | 8 | 8 | oui |
| Graphe | 134 / 137 | 134 / 137 | oui |
| SHA Finaliser | `3fc500bf…ee7a` | identique ; `__ABSENT__` + `::uuid` présents | oui |
| Autres workflows actifs | 0 | 0 | oui |
| Webhooks actifs | 0 | 0 (`webhook_entity` vide) | oui |
| PostgreSQL TEST | 1 / 10 / 4 / 0 | **1\|10\|4\|0** | oui |
| Tentatives ouvertes | 0 | **0** | oui |
| Statuts | ABANDONED 1, CONFIRMED 2, EXPIRED 1 | identique | oui |
| Mock | POST CreateAppointment **1** ; GET availability **2** | `POST /appointments 201`=1 ; GET avail.=2 ; scenario `created` | oui |
| LIVE | `13\|14\|12\|48\|0\|a2dea067…` | identique | oui |
| Mailpit | 5 / 2 / 98 304 | identique | oui |

Préflight **OK**. Aucun écart inexpliqué. STOP non déclenché.

## 2. Configuration d’enregistrement n8n

Réglages workflow lus via `GET /rest/workflows/OCD9It1uKFhOoWNF` (lecture seule) :

| Paramètre | Valeur observée |
| --- | --- |
| `saveDataSuccessExecution` | **`none`** |
| `saveDataErrorExecution` | **`none`** |
| `saveManualExecutions` | **`false`** |
| `saveExecutionProgress` | **`false`** |

Variables d’environnement conteneur pertinentes : `GENERIC_TIMEZONE=Europe/Paris`, `TZ=Europe/Paris`. **Aucune** variable `EXECUTIONS_DATA_*` / `N8N_DEFAULT_*` de conservation globale observée dans le filtre d’audit.

Intention documentée (8E1B) : ne pas conserver corps figé / jetons dans l’historique d’exécution ; diagnostic métier via statut, référence et compteurs.

Conséquence mécanique : une exécution webhook **réussie** n’apparaît pas durablement dans l’UI / API REST des exécutions.

## 3. Résultat de l’API exécutions

| Source | Résultat |
| --- | --- |
| `GET /rest/executions?limit=10&workflowId=OCD9It1uKFhOoWNF` | HTTP **200**, **0** ligne (`FINALISER_EXEC.json` 8F-2B45 : `count=0`, `finaliser=null` ; reconfirmé 8F-2B46) |
| `GET /rest/executions?limit=10` (tous workflows) | **0** ligne |
| Filtres `audit-finaliser.js` / `run.js` | `limit` + `workflowId` ; 1ʳᵉ ligne → `includeData=true` → nœud `Finaliser état création` |
| SQLite `execution_entity` | **1** stub id **45**, `mode=webhook`, `status=running`, `finished=0` |
| Soft-delete | `deletedAt` UTC `2026-11-01 12:02:06.873` (= `14:02:06+01`, horodatage de `n8n.workflow.success`) |
| Version liée | `workflowVersionId=e1b32992-…` |

**Conclusion API** : l’absence de ligne exploitable via `/rest/executions` est **conforme** à `saveDataSuccessExecution=none` (soft-delete au succès). Ce n’est pas une preuve d’échec métier du nœud Finaliser.

Différence production vs manuel : exécution 8F-2B45 en `mode=webhook` (activation temporaire + POST chat). Avec `saveManualExecutions=false` et `saveData*=none`, ni les succès webhook ni les manuels ne sont listés durablement.

## 4. Analyse de la condition `pass=false`

Dans `run.js` (8F-2B45) :

```text
pass = functionalOk && attemptOk && sessionOk && finaliserOk
     && postOk && integrityOk && deactivateOk && claimCount === 1

verdict = pass ? 'PASS' : (transportFailure ? 'UNCERTAIN' : 'FAIL')
```

`finaliserOk` exige :

- `finaliserExec` non null ;
- `finaliserExec.finaliserRan` ;
- absence d’erreur nœud / `$3` / conflit uuid ;
- et `sessionOk`.

Or `finaliserExec` reste `null` si `/rest/executions` ne renvoie aucune ligne → `finaliserOk=null` (falsy) → **`pass=false`** → **`verdict=FAIL`** (pas de `transportFailure`).

`RESULT.json` confirme : tous les checks métier/intégrité à `true` ; seul le chemin observabilité Finaliser échoue.

## 5. Contrôles métier réussis (8F-2B45 + relecture 8F-2B46)

| Contrôle | Preuve |
| --- | --- |
| HTTP client | **200**, ~69 632 ms, `type=appointment_created`, `success=true` |
| Référence réponse | `REC008-MOCK-0001` (`response.txt`) |
| Token réponse | `null` / « Non disponible » |
| CLAIM | **1** (`submitted_at` + `confirmed_at` + POST Δ=1) |
| POST mock | **+1** → `POST /appointments 201` = 1 |
| GET availability Δ | **0** |
| Tentative `d566fc28-…` | **`CONFIRMED`** |
| `submitted_at` | `2026-11-01 14:02:05.862032+01` |
| `confirmed_at` | `2026-11-01 14:02:06.617353+01` |
| Référence / id mock | `REC008-MOCK-0001` / `55555555-5555-4555-8555-555555555555` |
| Clé / corps figé | **purgés** |
| Empreinte | **conservée** (`1aa346780669`) |
| Lease | **absent** |
| Session `rec008-8f2b37-new-01` | intent / step / identité / créneau **vidés** ; référence conservée ; token vide ; `last_user_message=oui` |

Checks script : `functionalOk`, `attemptOk`, `sessionOk`, `postOk`, `httpOk`, `notWorkflowError`, `confirmsAppointment`, `showsReference`, `claimCount=1` → **true**.

## 6. Contrôles d’intégrité réussis

| Contrôle | Résultat |
| --- | --- |
| Compteurs PG | `1\|10\|4\|0` |
| Ouvertes | 0 |
| Statuts | ABANDONED 1, CONFIRMED 2, EXPIRED 1 |
| Session historique `rec008-8f2b14-new-01` | référence `REC008-MOCK-0001` inchangée |
| LIVE | empreinte `a2dea067599fd4f0a5f857551adc67cc` inchangée |
| Mailpit | 5 / 2 / 98 304 inchangé |
| Workflow post-désactivation | inactif ; VC 8 ; SHA Finaliser inchangé ; webhooks 0 |
| `integrityOk` / `deactivateOk` (script) | **true** |

## 7. Preuves directes et indirectes

| Niveau | Définition phase | Application |
| --- | --- | --- |
| **Directe** (REST) | Exécution récupérée via API + nœud identifié | **Non** — `/rest/executions` = 0 ; `finaliserExec=null` |
| **Événementielle** (journal n8n, hors critère script) | Horodatages nœud sans dump de payload | Exécution **45** : `Finaliser état création` started `14:02:06.722+01` → finished `14:02:06.806+01` ; puis `n8n.workflow.success` `14:02:06.872+01` (`success=true`) ; CLAIM et clôture également started/finished |
| **Indirecte forte** | Mutation PG attendue + HTTP 200 + référence cohérente | **Oui** — `CONFIRMED`, purge, session nettoyée, mock 201, HTTP 200 |
| **Insuffisante** | État incompatible / contradictoire | **Non** |

Classification officielle au sens de la mission (pas de preuve directe si exécution non accessible via le canal d’audit script) : **preuve indirecte forte**, corroborée par le journal d’événements (télémétrie non payload).

Distinction des causes :

1. **Échec métier** : non.
2. **Échec technique** (transport / HTTP 500 / `$3` / uuid) : non.
3. **Absence de télémétrie REST** : oui (politique d’enregistrement).
4. **Preuve indirecte de finalisation** : oui (PG + HTTP + mock + journal nœud).

## 8. Conclusion sur le nœud Finaliser

Le correctif installé (SHA `3fc500bf…`, sentinelle `__ABSENT__` + cast `::uuid`) a produit l’effet attendu en 8F-2B45 :

- session nettoyée avec référence conservée et token NULL ;
- HTTP 200 sans erreur workflow ;
- journal : nœud Finaliser terminé sans événement d’échec avant `workflow.success`.

L’absence de `finaliserExec` dans `RESULT.json` **n’invalide pas** la finalisation ; elle reflète une lacune d’observabilité **volontaire** (`saveData*=none`) et le filtre REST sur les exécutions soft-supprimées.

## 9. Causes du décalage verdict automatisé / fonctionnel

| Facteur | Effet |
| --- | --- |
| `saveDataSuccessExecution=none` (+ error/manual/progress off) | Succès soft-supprimé ; API liste vide |
| Critère `finaliserOk` **bloquant** dans `pass` | Un seul check d’observabilité force `FAIL` |
| Tous les autres checks métier/intégrité | `true` → succès fonctionnel réel |
| Rapport narratif 8F-2B45 | Déjà **PASS** / **GO** en distinguant l’écart script |

## 10. Recommandations non implémentées

1. **Critère automatisé** : séparer `observabilityOk` de `pass` métier ; ou accepter `finaliserOk` comme satisfait si `sessionOk && attemptOk && httpOk && !transportFailure` lorsque la config workflow a `saveDataSuccessExecution=none` ; journaliser explicitement `finaliserExecSkippedReason`.
2. **Observabilité adaptée aux données personnelles** : conserver métadonnées d’exécution (id, status, started/stopped, node summary sans I/O) plutôt que payloads ; éviter d’activer `saveDataSuccessExecution=all` sur ce workflow.
3. **Preuve des transitions métier sans payloads** : s’appuyer sur PG (statut, timestamps, empreinte, présence/absence clé/corps), compteurs mock, HTTP type/référence, et éventuellement événements n8n `node.started`/`node.finished`/`workflow.success` sans `includeData`.
4. **Validation avant publication LIVE** : exiger preuve indirecte forte + intégrité LIVE/Mailpit inchangée + Finaliser SHA attendu ; ne pas bloquer LIVE sur `/rest/executions` tant que `saveData*=none` ; documenter le critère d’acceptation dans le playbook REC-008.

**Rien n’a été modifié** dans cette phase.

## 11. Intégrité postflight

Relecture après audit (aucune mutation métier) :

| Contrôle | OK |
| --- | --- |
| Aucune nouvelle tentative (`1\|10\|4\|0`) | oui |
| Aucun changement de statut | oui |
| Aucun nouveau POST mock (reste 1) | oui |
| Aucun GET availability supplémentaire (reste 2) | oui |
| Session `rec008-8f2b37-new-01` inchangée depuis 8F-2B45 | oui |
| Workflow inactif / non modifié / webhooks 0 | oui |
| Aucun e-mail (Mailpit inchangé) | oui |
| LIVE inchangé | oui |

## 12. Verdict

**PASS**

L’audit confirme : succès fonctionnel 8F-2B45 ; `pass=false` script = faux négatif d’observabilité, conforme à la configuration n8n TEST.

## 13. GO/NO-GO

**GO** pour les scénarios REC-008 suivants sous autorisation distincte.

Restrictions respectées : lecture seule ; aucun chat ; aucune activation ; aucun PUT ; aucune mutation SQL/mock/Compose ; aucun CLAIM ; aucun POST CreateAppointment ; aucun e-mail ; aucun appel LIVE métier.

Arrêt ici. Attente d’une autorisation distincte.
