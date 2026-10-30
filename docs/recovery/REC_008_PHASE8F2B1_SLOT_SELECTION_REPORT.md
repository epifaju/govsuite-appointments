# REC-008 phase 8F-2B1 — Test C1 sélection du créneau

Deux messages sur une nouvelle session. La consultation des disponibilités réussit. La sélection « Je prends le 1. » bascule vers CREATE mais **n’associe pas le UUID du créneau** et **efface** service, site, dates et créneaux mémorisés. Aucun POST, aucune tentative.

Verdict du scénario : **FAIL**.

## Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow | inactif, `activeVersionId = null` |
| Version / compteur | `2fea54b3-ed59-4b83-a404-7166bad06fb2` / 4 |
| Graphe | 134 / 137 |
| Autres workflows actifs | 0 |
| Chat Trigger | `public: true`, webhook `a91c4e70-6b18-4f0d-9c55-2e7d8a14b603` |
| Credentials | PostgreSQL `Fs0l0058q5CEadRw`, Ollama `dxzHqBq8Q60R8BOz` |
| HTTP | 10 URL mock |
| Isolation | OK |
| PostgreSQL TEST | 1 rendez-vous, 5 sessions, 0 tentative |
| Mock | total 4, GET availability 4, POST 0 |
| GovSuite | 13, 14, 12, 48, 0, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Mailpit | 5 / 2 / 98 304 |

Colonnes `ai_conversation_state` observées : notamment `slot_id`, `available_slots`, `selected_slot_index`, `pending_action`, `conversation_step`.

## Activation

`POST .../activate` → 200. Version `2fea54b3-…` active. Webhooks chat enregistrés. Seul ce workflow actif.

## Session utilisée

`rec008-8f2b1-slot-01` — nouvelle (absente au préflight).

## Message 1 et réponse

Entrée : `Je souhaite connaître les disponibilités pour un passeport à Paris du 03/11/2026 au 03/11/2026.`

| Mesure | Valeur observée |
| --- | --- |
| HTTP | 200 |
| Durée | 119 931 ms |
| Type | `availability` |
| Créneau | 09:00–09:30, `placesDisponibles: 2`, id `33333333-…` |
| 10:00 | exclu |
| Mock | total 4 → 5 (+1 GET availability) ; 0 POST |
| Ollama | 77,73 Mio → 1,085 Gio ; OOM false |

## État PostgreSQL après message 1

| Champ | Valeur |
| --- | --- |
| `intent` | `GET_AVAILABILITY` |
| `service` | `PASSEPORT` |
| `site` | `PARIS` |
| `date_debut` / `date_fin` | `2026-11-03` |
| `slot_id` | vide |
| `pending_action` | `GET_AVAILABILITY` |
| `conversation_step` | vide |
| `available_slots` | JSON avec 1 créneau index 1 / UUID attendu |
| Tentatives | 0 |

Premier tour **conforme** → second message autorisé.

## Message 2 et réponse

Entrée : `Je prends le 1.`

| Mesure | Valeur observée |
| --- | --- |
| HTTP | 200 |
| Durée | 35 947 ms |
| Réponse | demande de **service** (`ASK_CREATE_SERVICE`), pas le nom |
| `attemptAction` | `COLLECT` |
| Mock | inchangé (total 5, 0 POST) |
| Ollama | 1,087 → 1,112 Gio ; OOM false |

## État PostgreSQL après message 2

| Champ | Après msg1 | Après msg2 |
| --- | --- | --- |
| `intent` | `GET_AVAILABILITY` | `CREATE_APPOINTMENT` |
| `service` | `PASSEPORT` | **vide** |
| `site` | `PARIS` | **vide** |
| `date_debut` | `2026-11-03` | **vide** |
| `date_fin` | `2026-11-03` | **vide** |
| `slot_id` | vide | **vide** (attendu `33333333-…`) |
| `selected_slot_index` | vide | `1` |
| `available_slots` | 1 créneau | **`[]`** |
| `pending_action` | `GET_AVAILABILITY` | `CREATE_APPOINTMENT` |
| `conversation_step` | vide | `ASK_CREATE_SERVICE` (attendu `ASK_NOM`) |
| Tentatives | 0 | 0 |

## UUID du créneau sélectionné

**Non posé.** `selected_slot_index = 1` est observé, mais `slot_id` reste vide. L’UUID attendu `33333333-3333-4333-8333-333333333333` n’est pas persisté.

## Transition vers CREATE_APPOINTMENT

Oui : `pending_action` / `intent` passent à `CREATE_APPOINTMENT`. La transition est **partielle et incorrecte** : elle repart comme une création à vide (`ASK_CREATE_SERVICE`) au lieu de poursuivre après le créneau choisi.

## Étape de collecte obtenue

`ASK_CREATE_SERVICE` — **échec** par rapport à `ASK_NOM`.

## Compteurs mock avant / après

| Moment | total | GET availability | POST |
| --- | --- | --- | --- |
| Préflight | 4 | 4 | 0 |
| Après msg1 | 5 | 5 | 0 |
| Après msg2 | 5 | 5 | 0 |

## Compteurs PostgreSQL TEST

1 rendez-vous, 6 sessions, **0 tentative**, 0 notification. Le rendez-vous fictif initial est inchangé.

## Mémoire et durées Ollama

| Tour | Durée | Mémoire |
| --- | --- | --- |
| 1 | 119,9 s | ~78 Mio → ~1,09 Gio |
| 2 | 35,9 s | ~1,09 → ~1,11 Gio |

## Désactivation

Immédiate après l’échec du message 2. `active = false`, `activeVersionId = null`, version/compteur inchangés, 134/137, 0 webhook, 0 workflow actif.

## Intégrité GovSuite

Inchangée : 13, 14, 12, 48, 0, empreinte stable. Mailpit inchangé.

## Anomalies et premier nœud suspecté

1. L’index `1` est reconnu (`selected_slot_index`) mais **non résolu** en `slot_id` alors que `available_slots` contenait le bon UUID après le message 1.
2. Service, site, dates et `available_slots` sont **effacés** au même tour — comportement typique d’une **nouvelle action métier** qui ignore la mémoire du tour précédent.
3. Le parcours CREATE redémarre à `ASK_CREATE_SERVICE` au lieu de `ASK_NOM`.

**Premier nœud suspecté :** `Fusionner état conversation` (branche « nouvelle action » / `CREATE_APPOINTMENT` qui repart sans `pick` sur previous), en interaction avec `Parser intention` (intent CREATE + index) et `Gérer collecte progressive` (résolution index → UUID dépend de `availableSlots` encore présents).

Aucune correction n’a été appliquée dans cette phase.

## Critères PASS

| # | Critère | Résultat |
| --- | --- | --- |
| 1 | Consultation initiale | OK |
| 2 | Créneau affiché | OK |
| 3 | UUID sélectionné | **FAIL** |
| 4 | Mémoire service/site/dates | **FAIL** |
| 5 | Bascule CREATE | partielle (mauvaise étape) |
| 6 | Demande du nom | **FAIL** (`ASK_CREATE_SERVICE`) |
| 7 | Aucune tentative | OK |
| 8 | Aucun POST | OK |
| 9 | RDV fictif inchangé | OK |
| 10 | Workflow désactivé | OK |

## Verdict

**FAIL**.

Scénario C2 (collecte du nom) : **NO-GO** tant que C1 n’est pas corrigé et revalidé.

Correction / nouvel essai C1 : **NO-GO** sans autorisation distincte.

Arrêt 8F-2B1.
