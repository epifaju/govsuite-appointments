# REC-008 phase 8F-2B3 — Installation contrôlée du correctif de sélection

Un seul `PUT` a installé le correctif `Fusionner état conversation` (8F-2B2) dans n8n TEST. Le workflow reste inactif. Aucun message, aucune activation, aucun POST métier.

Verdict du scénario d’installation : **PASS**.

Verdict pour un nouveau test C1 (après autorisation distincte) : **GO**.

## Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow | inactif, `activeVersionId = null` |
| Version / compteur | `2fea54b3-ed59-4b83-a404-7166bad06fb2` / 4 |
| Graphe | 134 nœuds, 137 connexions |
| Autres workflows actifs | 0 |
| Chat Trigger | `public: true`, webhook `a91c4e70-6b18-4f0d-9c55-2e7d8a14b603` |
| Credentials | PostgreSQL `Fs0l0058q5CEadRw`, Ollama `dxzHqBq8Q60R8BOz` |
| HTTP | 10 URL `http://rec008-mock:8080/...` |
| Isolation | OK |
| PostgreSQL TEST | 1 rendez-vous, 6 sessions, 0 tentative, 0 notification |
| Mock | total 5, GET availability 5, POST 0 |
| GovSuite | 13, 14, 12, 48, 0, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Mailpit | 5 / 2 / 98 304 |

## SHA-256 du candidat

`n8n/proposed/2026-10-30-rec008-phase8f2b2-NON-PUBLIE/10_AI_ConsularAssistant_SLOT_SELECT_FIX_NON_PUBLIE.json`

SHA-256 : `0fa348271753909b4faf3248e2374e83dbba7387eb8acbdf33c13f1f1dda6cb2` — conforme.

`jsCode` Fusionner : `d1c7f99122e1bdb4ae18e0636bbee9d36af816084300c3336eaa6acb57ac79b1` — conforme.

## Export avant installation

`n8n/proposed/2026-10-30-rec008-phase8f2b3-SLOT-FIX-INSTALL/before-OCD9It1uKFhOoWNF.json`

SHA-256 : `36259a0f8400570c22a3a255611c3a2e18ccc3fa83945b29fd492a4d37812e78`

Correspond à la version initiale `2fea54b3-…` / 4.

## Diff exact

Seul nœud modifié : **`Fusionner état conversation`** (`jsCode` uniquement).

Ajout de `slotSelectionFromAvailability` : conservation service/site/dates/`availableSlots` lors de `GET_AVAILABILITY` → `CREATE` via index de créneau.

Connexions, credentials, URLs, webhook, settings : inchangés.

## Payload PUT et empreinte

Champs : `name`, `nodes`, `connections`, `settings`, `staticData`, `pinData`. Pas de `active: true`.

Fichier : `update-body.json`

SHA-256 : `8967913fb1a30cafaca057c6f66a03809811c1c4d59a03f80a21cfa97d497838`

## Résultat HTTP

`PUT http://127.0.0.1:5682/api/v1/workflows/OCD9It1uKFhOoWNF` → **200**.

Aucun `/activate`. Port 5680 non utilisé.

## Nouveau versionId / versionCounter

| Champ | Avant | Après |
| --- | --- | --- |
| `versionId` | `2fea54b3-ed59-4b83-a404-7166bad06fb2` | `12e6b201-6173-457e-97c4-a17cc1900eb6` |
| `versionCounter` | 4 | 5 |
| `active` | false | false |
| `activeVersionId` | null | null |

## Export après installation

`after-OCD9It1uKFhOoWNF.json` — SHA-256 `be5037e4664875c0a927d21181ea4bc81a6d11ffb70889956993c8ddb67ed8d4`.

## Comparaison installé / candidat

`jsCode` Fusionner installé byte-identique au candidat (`d1c7f991…ac79b1`). Un seul écart de paramètres entre avant/après : ce nœud. Credentials et connexions identiques au préflight.

## Vérification des invariants REC-008

| Contrôle | Résultat |
| --- | --- |
| `slotSelectionFromAvailability` présent | OK |
| `createFlowLocked` conservé | OK |
| Claim SQL (`Réclamer tentative`) inchangé | OK |
| `Classer réponse HTTP` inchangé | OK |
| `Marquer tentative incertaine` inchangé | OK |
| Aucun POST dans Fusionner | OK |
| `AWAIT_CREATE_CONFIRMATION` toujours présent ailleurs | OK |
| 0 webhook enregistré (workflow inactif) | OK |

## État d’activation

Inactif. Aucun webhook. Aucun autre workflow TEST actif. 134 / 137.

## Compteurs PostgreSQL TEST

Inchangés : `1|6|0|0`.

## Compteurs mock

Inchangés : total 5, GET availability 5, POST 0.

## Intégrité GovSuite

Inchangée : 13, 14, 12, 48, 0, empreinte stable. Mailpit inchangé.

## Anomalies

Aucune.

## Verdict

**PASS**.

Nouveau test C1 (activation temporaire + session neuve, après autorisation distincte) : **GO**.

Activer ou chatter maintenant sans autorisation : **NO-GO**.

Arrêt 8F-2B3.
