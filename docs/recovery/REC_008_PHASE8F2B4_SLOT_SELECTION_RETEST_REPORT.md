# REC-008 phase 8F-2B4 — Revalidation C1 après correction

Deux messages sur une nouvelle session après le correctif 8F-2B3. La sélection « Je prends le 1. » conserve la mémoire, résout l’UUID et entre en `ASK_NOM`. Aucun POST, aucune tentative.

Verdict du scénario : **PASS**.

## Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow | inactif, `activeVersionId = null` |
| Version / compteur | `12e6b201-6173-457e-97c4-a17cc1900eb6` / 5 |
| Graphe | 134 / 137 |
| Autres workflows actifs | 0 |
| Chat Trigger | `public: true`, webhook `a91c4e70-6b18-4f0d-9c55-2e7d8a14b603` |
| Credentials | PostgreSQL `Fs0l0058q5CEadRw`, Ollama `dxzHqBq8Q60R8BOz` |
| HTTP | 10 URL mock |
| Isolation | OK |
| PostgreSQL TEST | 1 rendez-vous, 6 sessions, 0 tentative |
| Mock | total 5, GET availability 5, POST 0 |
| GovSuite | 13, 14, 12, 48, 0, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Mailpit | 5 / 2 / 98 304 |

## Activation

`POST .../activate` → 200. Version active `12e6b201-…`. Seul ce workflow actif. Webhooks chat enregistrés. Endpoints mock inchangés.

## Version active

`12e6b201-6173-457e-97c4-a17cc1900eb6` (compteur 5).

## Nouvelle session

`rec008-8f2b4-slot-01` — absente au préflight. Pas de réutilisation de `rec008-8f2b1-slot-01`.

## Message 1 et réponse

Entrée : `Je souhaite connaître les disponibilités pour un passeport à Paris du 03/11/2026 au 03/11/2026.`

| Mesure | Valeur |
| --- | --- |
| HTTP | 200 |
| Durée | 95 284 ms |
| Type | `availability` |
| Créneau | 09:00–09:30, 2 places, UUID `33333333-…` |
| 10:00 | exclu |
| Mock | total 5 → 6 (+1 GET) ; 0 POST |
| Ollama | 83,17 Mio → 1,091 Gio ; OOM false |

## État PostgreSQL après message 1

| Champ | Valeur |
| --- | --- |
| `intent` | `GET_AVAILABILITY` |
| `service` / `site` | `PASSEPORT` / `PARIS` |
| Dates | `2026-11-03` |
| `available_slots` | contient UUID attendu, index 1 |
| `pending_action` | `GET_AVAILABILITY` |
| Tentatives | 0 |

Premier tour conforme → second message autorisé.

## Message 2 et réponse

Entrée : `Je prends le 1.`

| Mesure | Valeur |
| --- | --- |
| HTTP | 200 |
| Durée | 19 876 ms |
| Texte | demande du **nom** (`ASK_NOM`) |
| Mock | inchangé (total 6, 0 POST) |
| Ollama | 1,087 → 1,109 Gio ; OOM false |

## État PostgreSQL après message 2

| Champ | Valeur |
| --- | --- |
| `intent` | `CREATE_APPOINTMENT` |
| `pending_action` | `CREATE_APPOINTMENT` |
| `service` / `site` | `PASSEPORT` / `PARIS` |
| `date_debut` / `date_fin` | `2026-11-03` |
| `selected_slot_index` | `1` |
| `slot_id` | `33333333-3333-4333-8333-333333333333` |
| `available_slots` | conservé (UUID présent) |
| `conversation_step` | `ASK_NOM` |
| Tentatives | 0 |

## Comparaison 8F-2B1 / 8F-2B4

| Champ (après « Je prends le 1 ») | 8F-2B1 | 8F-2B4 |
| --- | --- | --- |
| `slot_id` | vide | UUID attendu |
| `service` / `site` | vides | PASSEPORT / PARIS |
| `available_slots` | `[]` | conservé |
| `conversation_step` | `ASK_CREATE_SERVICE` | `ASK_NOM` |
| Verdict | FAIL | **PASS** |

## Résolution index → UUID

Index `1` → `slot_id = 33333333-3333-4333-8333-333333333333`. Observé en PostgreSQL.

## Transition CREATE_APPOINTMENT

`intent` et `pending_action` passent à `CREATE_APPOINTMENT` avec mémoire métier intacte.

## Vérification ASK_NOM

`conversation_step = ASK_NOM`. Texte utilisateur : « Quel est votre **nom** ? ».

## Compteurs mock

| Moment | total | GET availability | POST |
| --- | --- | --- | --- |
| Préflight | 5 | 5 | 0 |
| Après msg1 | 6 | 6 | 0 |
| Après msg2 | 6 | 6 | 0 |

## Compteurs PostgreSQL TEST

1 rendez-vous, 7 sessions, 0 tentative, 0 notification.

## Durées et mémoire Ollama

| Tour | Durée | Mémoire |
| --- | --- | --- |
| 1 | 95,3 s | ~83 Mio → ~1,09 Gio |
| 2 | 19,9 s | ~1,09 → ~1,11 Gio |

## Désactivation

`POST .../deactivate` → 200. `active = false`, `activeVersionId = null`, version/compteur inchangés (`12e6b201-…` / 5), 134/137, 0 webhook.

## Intégrité GovSuite

Inchangée : 13, 14, 12, 48, 0, empreinte stable. Mailpit inchangé.

## Anomalies

Mineure : le JSON de réponse du tour 2 inclut encore un bloc `validation` / `missing` listant « le créneau choisi » avec `slotIdValide: false`, alors que PostgreSQL a bien `slot_id`. Le texte et l’étape exposés sont correctement `ASK_NOM`. Non bloquant pour C1 ; à surveiller en C2 si la validation amont reste désalignée.

## Verdict

**PASS**.

Scénario C2 (collecte du nom), après autorisation distincte : **GO**.

Activer ou chatter maintenant sans autorisation : **NO-GO**.

Arrêt 8F-2B4.
