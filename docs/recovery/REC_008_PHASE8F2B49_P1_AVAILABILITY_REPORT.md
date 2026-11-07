# REC-008 phase 8F-2B49-P1 — Création de session et disponibilités (préparation CONV-07)

Un seul message de disponibilités sur `rec008-8f2b49-edit-01`. Activation temporaire uniquement. **Aucune tentative, aucun CLAIM, aucun POST CreateAppointment.**

Verdict : **PASS**  
GO/NO-GO 8F-2B49-P2 (sélection créneau) : **GO**

Artefacts : `n8n/proposed/2026-11-01-rec008-phase8f2b49-P1-AVAILABILITY/`  
(`PREFLIGHT.json`, `RESULT.json`, `response.txt`, `run.js`)

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow `OCD9It1uKFhOoWNF` | inactif, `activeVersionId = null` |
| Version / compteur | `e1b32992-…` / **8** |
| Graphe / Finaliser | 134 / 137 ; SHA `3fc500bf…` |
| Autres actifs / webhooks | 0 / 0 |
| Credentials / URL / isolation | TEST / 10 mock / OK |
| PostgreSQL | **1 / 10 / 4 / 0** ; 0 ouverte |
| Statuts | ABANDONED 1, CONFIRMED 2, EXPIRED 1 |
| Session `rec008-8f2b49-edit-01` | **absente** |
| Mock | `created` ; POST **1** ; GET availability **2** |
| LIVE / Mailpit | `13\|14\|12\|48\|0\|a2dea067…` ; 5 / 2 / 98 304 |
| Créneau seed | `33333333-…` PASSEPORT/PARIS 09:00–09:30, 2 places, DISPONIBLE |

## 2. Connectivité

Depuis l’hôte Windows, base `http://127.0.0.1:5682` uniquement :

| Probe | Résultat |
| --- | --- |
| TCP `127.0.0.1:5682` | OK |
| GET `/healthz` | **200** `{"status":"ok"}` |
| GET `/healthz/readiness` | **200** `{"status":"ok"}` |

## 3. Message unique

Activation 200 ; seul workflow actif ; webhook chat enregistré (GET+POST).  
Warmup GET webhook : **200** (311 ms).

Message exact :

`Je souhaite connaître les disponibilités pour un passeport à Paris du 03/11/2026 au 03/11/2026.`

`sessionId = rec008-8f2b49-edit-01` — aucun second message, aucun retry.

## 4. Réponse HTTP

| Mesure | Valeur |
| --- | --- |
| HTTP | **200** |
| Durée | **82 321 ms** |
| `type` | `availability` |
| Transport | aucune erreur |

Pas de confirmation de réservation ; pas de demande d’identité complète.

## 5. Créneaux retournés

1 créneau :

| Champ | Valeur |
| --- | --- |
| Index | **1** |
| ID | `33333333-3333-4333-8333-333333333333` |
| Service / site | PASSEPORT / PARIS |
| Début / fin | 2026-11-03 09:00–09:30 +01 |
| Places | **2** |

Note texte : l’exemple conversationnel cite « Je prends le 2 » alors qu’un seul créneau (index 1) est listé — même formulation historique qu’en 8F-2B37 ; non bloquant pour P1 (créneau index 1 cohérent).

## 6. Session persistée

`rec008-8f2b49-edit-01` :

| Champ | Valeur |
| --- | --- |
| Intent / pending | `GET_AVAILABILITY` |
| Service / site / dates | PASSEPORT / PARIS / `2026-11-03` |
| `available_slots` | 1 créneau (index 1, UUID attendu, 2 places) |
| `slot_id` / identité / référence / token | absents |

## 7. Compteurs PostgreSQL

| Avant | Après |
| --- | --- |
| 1 / 10 / 4 / 0 | **1 / 11 / 4 / 0** |

0 tentative ouverte. Tentatives liées à la nouvelle session : **0**. Statuts inchangés (ABD1 / CONF2 / EXP1). Empreintes sessions historiques, tentatives et rendez-vous TEST inchangées.

## 8. Compteurs mock

| Appel | Avant | Après | Δ |
| --- | --- | --- | --- |
| GET availability | 2 | **3** | **+1** |
| POST CreateAppointment | 1 | 1 | **0** |
| Cancel / reschedule | — | absents | — |
| Scénario | `created` | `created` | — |

## 9. Contrôles anti-réservation

| Contrôle | Résultat |
| --- | --- |
| INSERT `ai_appointment_attempt` | non |
| CLAIM | non |
| POST CreateAppointment | Δ = 0 |
| Nouveau rendez-vous / notification | non |
| Texte confirmation création | absent |

## 10. Désactivation

Immédiate après le message : `active=false`, `activeVersionId=null`, webhooks **0**, VC **8**, graphe 134/137, SHA Finaliser inchangé.

## 11. Intégrité LIVE / Mailpit

LIVE `13|14|12|48|0|a2dea067599fd4f0a5f857551adc67cc` inchangé. Mailpit 5 / 2 / 98 304 inchangé.

## 12. Verdict

**PASS**

## 13. GO/NO-GO

**GO** pour **8F-2B49-P2** : sélection du créneau index 1 (`Je prends le 1.`) sur `rec008-8f2b49-edit-01`, sous **autorisation distincte**.

Restrictions respectées : un seul message ; pas de `oui` / `non` / `modifier le nom` ; pas de PUT ; pas de SQL manuelle ; pas de changement mock/Compose ; pas de POST CreateAppointment ; pas d’e-mail ; pas d’appel LIVE ; artefacts historiques non modifiés.

Arrêt ici. Attente d’une nouvelle autorisation.
