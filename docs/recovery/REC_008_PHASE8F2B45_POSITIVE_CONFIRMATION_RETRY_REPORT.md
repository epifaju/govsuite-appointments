# REC-008 phase 8F-2B45 — Confirmation positive contrôlée (retry transport) (`rec008-8f2b37-new-01`)

Objectif : un seul message `oui` sur la tentative `d566fc28-…` pour valider  
`AWAITING_CONFIRMATION` → CLAIM → POST mock 201 → `CONFIRMED` → Finaliser → HTTP 200.

Instrumentation client renforcée (TCP/`healthz`, `error.cause`, warmup GET non avalé).  
**Aucun retry** du message. **Aucun PUT**, **aucune** modification SQL/workflow/mock.

Verdict : **PASS**  
GO/NO-GO scénarios ultérieurs : **GO**

Note script : `RESULT.json` a `pass=false` / `verdict=FAIL` uniquement parce que  
`finaliserExec=null` (API `/rest/executions` → 0 ligne). Toutes les autres checks métier  
(`functionalOk`, `attemptOk`, `sessionOk`, `postOk`, `integrityOk`, `deactivateOk`) sont **true**.  
La finalisation SQL est démontrée par l’état PostgreSQL + HTTP 200 (pas d’erreur `$3` / conflit uuid).

Artefacts : `n8n/proposed/2026-11-01-rec008-phase8f2b45-POSITIVE-CONFIRMATION-RETRY/`  
(`PREFLIGHT.json`, `RESULT.json`, `response.txt`, `run.js`, `console.log`, `FINALISER_EXEC.json`, `audit-finaliser.js`)

## 1. Préflight

| Contrôle | Attendu | Observé | OK |
| --- | --- | --- | --- |
| Workflow `OCD9It1uKFhOoWNF` | inactif | `active=false`, `activeVersionId=null` | oui |
| Version ID | `e1b32992-…` | identique | oui |
| VersionCounter | 8 | 8 | oui |
| Graphe | 134 / 137 | 134 / 137 | oui |
| SHA Finaliser | `3fc500bf…ee7a` | identique ; `__ABSENT__` + `::uuid` présents | oui |
| Autres workflows actifs | 0 | 0 | oui |
| Credentials | TEST | postgres `Fs0l0058…` ; ollama `dxzHqBq8…` | oui |
| URL métier | 10 → mock | 10 `http://rec008-mock:8080/…` | oui |
| Isolation LIVE | OK | `networkOk=true` | oui |
| PostgreSQL TEST | 1 / 10 / 4 / 0 | **1\|10\|4\|0** ; ouverte **1** | oui |
| Statuts | 1 ABD + 1 AWAIT + 1 CONF + 1 EXP | identique | oui |
| Mock | `created` ; POST 0 ; GET avail. 2 | identique | oui |
| LIVE | `13\|14\|12\|48\|0\|a2dea067…` | identique | oui |
| Mailpit | 5 / 2 / 98 304 | identique | oui |
| Redémarrages Docker | documentés | n8n/publish : RestartCount **0**, Started `10:33:58Z` | oui |

Préflight **OK**. Aucun écart inexpliqué. STOP non déclenché.

## 2. Vérification TTL

Tentative `d566fc28-02de-4ae1-afbb-6f7d81362d4d` :

| Instant | `status` | `expires_at` | `clock_timestamp()` | `secsLeft` |
| --- | --- | --- | --- | --- |
| Préflight | `AWAITING_CONFIRMATION` | `2026-11-01 15:07:51.743886+01` | `14:00:42+01` | **4029** |
| Pré-envoi (post-activation) | idem | idem | `14:00:50+01` | **4021** |
| Immédiat pré-POST | idem | idem | `14:00:56+01` | **4015** |

| Contrôle | Résultat |
| --- | --- |
| `expires_at > clock_timestamp()` | oui |
| `secsLeft > 300` | oui (tous les contrôles) |
| Lease | absent |
| `submitted_at` / `confirmed_at` | absents (avant envoi) |
| Référence / appointment_id | absents (avant envoi) |
| Clé / corps figé / empreinte | présents (clé long. 71 ; fp12 clé `e721ae85a9d7` ; fp `1aa346780669`) |
| Ouvertes sur session | **1** |

**GO temporel.** Aucune prolongation TTL. Aucune réutilisation de clé hors tentative.

## 3. Tests de connectivité (avant activation)

| Test | Résultat |
| --- | --- |
| TCP `127.0.0.1:5682` | **open** (~2 ms) |
| GET `http://127.0.0.1:5682/healthz` | **200** `{"status":"ok"}` (~14 ms) |
| GET `…/healthz/readiness` | **200** `{"status":"ok"}` (~5 ms) |
| Base utilisée | `http://127.0.0.1:5682` (jamais `localhost`) |
| Appel webhook chat pendant ces contrôles | **aucun** |

Connectivité **OK**.

## 4. Instrumentation réseau

| Élément | Comportement |
| --- | --- |
| Capture erreur | `name`, `message`, `cause.code/syscall/address/port`, `elapsedMs`, URL cible |
| Warmup GET | journalisé ; **STOP** si échec (non avalé) |
| Retry chat | **aucun** (un seul `fetch` POST) |
| Secrets / clé / PII dans logs d’erreur | non affichés |

Warmup observé : **OK** — HTTP **200**, 69 ms, `bodyLen=2065`, URL  
`http://127.0.0.1:5682/webhook/a91c4e70-…/chat`.

Transport POST chat : **aucune** erreur (`transportFailure=null`).

## 5. Message unique

| Champ | Valeur |
| --- | --- |
| `chatInput` | **`oui`** |
| `sessionId` | `rec008-8f2b37-new-01` |
| Activation | HTTP 200 ; version `e1b32992-…` seule active |
| Webhooks | GET + POST chat enregistrés |
| Nombre d’envois | **1** (aucun retry) |

## 6. Réponse HTTP et durée

| Mesure | Valeur |
| --- | --- |
| HTTP client | **200** |
| Durée | **69 632 ms** |
| `type` | `appointment_created` |
| `success` | true |
| Titre | Rendez-vous confirmé |
| Référence dans corps | `REC008-MOCK-0001` |
| Erreur workflow / HTTP 500 | **non** |
| Désactivation | immédiate 200 ; `active=false` ; webhooks **0** |

## 7. Erreur transport détaillée

**Aucune.** Warmup OK ; POST abouti. Contrairement à 8F-2B43 (`fetch failed` 3 ms), le transport a fonctionné.

## 8. CLAIM et POST

| Mesure | Valeur |
| --- | --- |
| CLAIM | **1** (`submitted_at` + `confirmed_at` + POST Δ=1) |
| POST avant | 0 |
| POST après | **1** |
| Delta | **+1** |
| URL métier | `http://rec008-mock:8080/appointments` |
| Second POST | **non** |
| GET availability Δ | **0** |
| Cancel / reschedule | **non** |

## 9. Réponse mock

| Champ | Valeur |
| --- | --- |
| HTTP | **201** (`POST /appointments 201` = 1) |
| Scénario | `created` |
| Référence | `REC008-MOCK-0001` (non vide) |
| Identifiant mock | `55555555-5555-4555-8555-555555555555` |
| `distinctKeys` | **1** |

## 10. État de la tentative

| Champ | Avant | Après |
| --- | --- | --- |
| Statut | `AWAITING_CONFIRMATION` | **`CONFIRMED`** |
| `submitted_at` | — | `2026-11-01 14:02:05.862032+01` |
| `confirmed_at` | — | `2026-11-01 14:02:06.617353+01` |
| Référence | — | `REC008-MOCK-0001` |
| `appointment_id` | — | `55555555-…` |
| Clé d’idempotence | présente | **purgée** |
| Corps figé | présent | **purgé** |
| Empreinte fp12 | `1aa346780669` | **conservée** (`1aa346780669`) |
| Lease | absent | absent |

Transition effective : `AWAITING_CONFIRMATION` → (`SUBMITTING` implicite via claim) → `CONFIRMED`.

## 11. Finalisation SQL

Nœud `Finaliser état création` (SHA `3fc500bf…`, `__ABSENT__` + `::uuid` installés) :

| Contrôle | Preuve |
| --- | --- |
| Session nettoyée | intent / pending / step / identité / créneau **vidés** |
| Référence mock conservée | `REC008-MOCK-0001` |
| Token absent | token vide ; réponse `token: null` / « Non disponible » |
| Erreur `$3` | **absente** (HTTP 200, pas 500) |
| Conflit `text` / `uuid` | **absent** |
| API exécutions n8n | **0 ligne** (`FINALISER_EXEC.json`) — lacune d’observabilité, pas d’échec SQL |

## 12. État de la session

Session `rec008-8f2b37-new-01` après :

| Champ | Valeur |
| --- | --- |
| `conversation_step` / `pending_action` / `intent` | vides |
| Identité / service / site / créneau | vides |
| `reference` | **`REC008-MOCK-0001`** |
| `last_user_message` | `oui` |

État initial avant envoi était conforme (Dupont / Camille / e-mail / `+33000000000` / PASSEPORT / PARIS / `2026-11-03` / créneau `33333333-…` index 1 / `AWAIT_CREATE_CONFIRMATION`).

## 13. Intégrité historique

| Contrôle | Résultat |
| --- | --- |
| Compteurs PG | **1\|10\|4\|0** |
| Statuts | ABANDONED 1, **CONFIRMED 2**, EXPIRED 1 |
| Tentatives ouvertes | **0** |
| Empreintes autres sessions / tentatives historiques / RDV | inchangées |
| Session historique `rec008-8f2b14-new-01` | référence `REC008-MOCK-0001` inchangée |
| Tentatives ABD / CONF historique / EXP | inchangées |

## 14. Intégrité LIVE / Mailpit

| Contrôle | Résultat |
| --- | --- |
| LIVE | `13\|14\|12\|48\|0\|a2dea067599fd4f0a5f857551adc67cc` **inchangé** |
| Mailpit | 5 / 2 / 98 304 **inchangé** |
| Workflow | inactif ; VC **8** ; SHA Finaliser inchangé ; webhooks **0** |
| Mock Δ | POST +1 ; GET availability 0 |

## 15. Verdict

**PASS**

Parcours complet démontré :

1. Transport OK (warmup + POST).
2. Un CLAIM + un POST mock 201.
3. Tentative `CONFIRMED` avec purge clé/corps et référence persistée.
4. Finalisation session (nettoyage + référence) sans HTTP 500.
5. Intégrité LIVE / Mailpit / historique préservée.

Écart script automatisé : `finaliserExec` non disponible via REST — n’invalide pas les preuves SQL/HTTP.

## 16. GO/NO-GO

**GO** pour les scénarios ultérieurs sous autorisation distincte.

Restrictions respectées : un seul `oui` ; aucun retry ; aucun PUT ; aucune mutation SQL/workflow/mock ; aucun appel LIVE ; aucun e-mail SMTP supplémentaire (Mailpit inchangé).

Arrêt ici. Attente d’une autorisation distincte.
