# REC-008 phase 8F-2B13 — Non-réutilisation d’une tentative abandonnée

Un message `oui` sur `rec008-8f2b4-slot-01` après abandon 8F-2B12 (version `e84ee0d2-…` / 6). Tentative toujours `ABANDONED`, clé/corps toujours NULL, 0 ouverte, 0 nouvelle tentative. **Aucun POST métier**, aucun CancelAppointment, rendez-vous fictif inchangé.

Verdict : **PASS**.

Artefacts : `n8n/proposed/2026-10-30-rec008-phase8f2b13-ABANDONED-RECONFIRMATION/` (`CONTRACT.json`, `RESULT.json`, `response.txt`).

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow | inactif, `activeVersionId = null` |
| Version / compteur | `e84ee0d2-7af9-417e-8d47-0a28580dccac` / 6 |
| Graphe | 134 / 137 |
| Autres actifs | 0 |
| Credentials / URL / isolation | TEST / 10 mock / OK |
| PostgreSQL TEST | 1 / 7 / **1** / 0 |
| Mock | **baseline 0** (voir note) ; POST 0 |
| GovSuite | 13, 14, 12, 48, 0, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Mailpit | 5 / 2 / 98 304 |
| Session | `conversation_step` / `pending_action` vides ; brouillon vidé ; `last_user_message = non` |
| Tentative | 1× `ABANDONED` (`8ae63b62-…`), clé/corps NULL, 0 ouverte, pas de lease ni référence |

**Note mock** : avant le test, les conteneurs `govsuite-rec008-test` (hors Ollama) étaient arrêtés (`Exited 255`). Relance `docker compose up -d --pull never` sans `-v`. PostgreSQL a conservé l’état ; le mock en mémoire est reparti à **total 0**. Écart **expliqué**, non bloquant.

## 2. Audit du routage de `oui`

| Point | Constat |
| --- | --- |
| Parser | `oui` → `AFFIRM` **uniquement** si `AWAIT_CREATE_CONFIRMATION` ou tentative ouverte `AWAITING_CONFIRMATION` |
| Hors attente | pas de `createDecision` AFFIRM ; brouillon vide → pas d’`INSERT` forcé |
| `Lire tentative de session` | statuts `AWAITING_CONFIRMATION`, `SUBMITTING`, `UNCERTAIN`, `CONFIRMED` — **pas** `ABANDONED` |
| Décider | `CLAIM` seulement si `AWAITING_CONFIRMATION` + `AFFIRM` ; sans ouverte → `COLLECT` |
| Aiguiller | fallback `COLLECT` → `Valider paramètres création` |
| CreateAppointment | **non atteignable** depuis Valider / Demander |
| CancelAppointment | **non atteignable** depuis ce chemin |

**GO activation.**

## 3. Activation

`POST .../activate` → 200. Version `e84ee0d2-…`. Seul workflow actif. Webhooks chat OK.

## 4. Message envoyé

`oui` — un seul message. Aucun retry. Aucun autre champ.

## 5. Réponse HTTP

| Mesure | Valeur |
| --- | --- |
| HTTP | 200 |
| Durée | 57 973 ms |
| `type` | `services` |

Texte : liste des services fictifs + invitation à indiquer service, site et période. Aucune affirmation de réservation, aucune référence, aucun token.

Réponse **sûre** (nouvelle orientation de collecte), sans réactiver l’ancienne tentative.

## 6. État de session après message

| Champ | Avant | Après |
| --- | --- | --- |
| `conversation_step` | vide | vide |
| `pending_action` | vide | vide |
| brouillon identité / créneau | vide | vide |
| `intent` | `CREATE_APPOINTMENT` | `GET_SERVICES` |
| `last_user_message` | `non` | **`oui`** |

## 7. État de la tentative abandonnée

| Attribut | Avant | Après |
| --- | --- | --- |
| Id | `8ae63b62-…` | **identique** |
| Statut | `ABANDONED` | **`ABANDONED`** |
| Tentatives totales | 1 | **1** |
| Tentatives ouvertes | 0 | **0** |
| `idempotency_key` / `request_payload` | NULL | **NULL** |
| Lease / référence / appointment_id | absents | absents |

Aucune réactivation. Aucune nouvelle tentative.

## 8. Compteurs mock

| Moment | Total | Détail |
| --- | --- | --- |
| Préflight (après restart) | 0 | — |
| Après message | **1** | `GET /services 200` × 1 |
| POST | **0** | — |
| GET availability | **0** | — |
| Cancel | **0** | — |

Le `GET /services` est en lecture seule (pas un POST métier). Accepté comme effet collatéral sûr du routage hors confirmation.

## 9. Compteurs PostgreSQL TEST

1 rendez-vous, 7 sessions, 1 tentative (`ABANDONED`), 0 ouverte, 0 notification. Empreinte rendez-vous TEST inchangée (`986b715d…`).

## 10. Durée et mémoire Ollama

57 973 ms ; 14,18 Mio → 1,064 Gio ; OOM false.

## 11. Désactivation

`active = false`, `activeVersionId = null`, 0 webhook, compteur 6, graphe 134/137, 0 autre actif.

## 12. Intégrité GovSuite et Mailpit

GovSuite inchangé : 13, 14, 12, 48, 0, empreinte `a2dea067599fd4f0a5f857551adc67cc`. Mailpit 5 / 2 / 98 304.

## 13. Verdict

**PASS**.

Invariants critiques : tentative abandonnée non réutilisée, pas de POST, pas de création, pas de claim, pas de Cancel, LIVE intact.

## 14. GO/NO-GO

Nouvelle tentative de réservation (nouvelle collecte / nouvelle session), après autorisation distincte : **GO**.

Réactiver ou confirmer une création maintenant sans autorisation : **NO-GO**.

Arrêt 8F-2B13.
