# REC-008 phase 8F-2B49-P3 — Collecte du nom (préparation CONV-07)

Un message `Dupont` sur `rec008-8f2b49-edit-01` (après P2). Nom persisté, transition `ASK_NOM` → `ASK_PRENOM`, contexte métier conservé. **Aucune tentative, aucun CLAIM, aucun POST CreateAppointment.**

Verdict : **PASS**  
GO/NO-GO 8F-2B49-P4 (collecte du prénom) : **GO**

Artefacts : `n8n/proposed/2026-11-01-rec008-phase8f2b49-P3-NAME-COLLECTION/`  
(`PREFLIGHT.json`, `RESULT.json`, `response.txt`, `run.js`)

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow `OCD9It1uKFhOoWNF` | inactif, `activeVersionId = null` |
| Version / compteur | `e1b32992-…` / **8** |
| Graphe / Finaliser | 134 / 137 ; SHA `3fc500bf…` |
| Autres actifs / webhooks | 0 / 0 |
| URLs métier | 10 × `rec008-mock` |
| PostgreSQL | **1 / 11 / 4 / 0** ; 0 ouverte |
| Statuts | ABANDONED 1, CONFIRMED 2, EXPIRED 1 |
| Mock | `created` ; POST **1** ; GET availability **3** |
| LIVE / Mailpit | `13\|14\|12\|48\|0\|a2dea067…` ; 5 / 2 / 98 304 |

Session cible avant message : `CREATE_APPOINTMENT` / `ASK_NOM` ; PASSEPORT / PARIS / `2026-11-03` ; `slot_id=33333333-…` ; index 1 ; identité absente ; 0 tentative liée.

## 2. Connectivité

Base `http://127.0.0.1:5682` uniquement : TCP OK ; `/healthz` **200** ; `/healthz/readiness` **200**.

## 3. Message unique

Activation 200 ; webhooks chat GET+POST ; warmup GET **200**.

Exactement : `Dupont` — `sessionId = rec008-8f2b49-edit-01`. Aucun retry.

## 4. Réponse HTTP

| Mesure | Valeur |
| --- | --- |
| HTTP | **200** |
| Durée | **34 927 ms** |
| `type` | `create_appointment_question` |
| `conversationStep` | **`ASK_PRENOM`** |
| `ready` / `claimAcquired` | **false** / **false** |
| Texte | demande du **prénom** |
| Transport | aucune erreur |

## 5. Nom mémorisé

`nom = Dupont` en PostgreSQL. Prénom / e-mail / téléphone absents.

## 6. Transition conversationnelle

`ASK_NOM` → **`ASK_PRENOM`**. `pending_action` / intent restent `CREATE_APPOINTMENT`.

## 7. Contexte conservé

PASSEPORT / PARIS / dates / `slot_id` / index 1 / `available_slots` (UUID attendu) inchangés. Aucune référence / token.

## 8. Contrôles anti-réservation

CLAIM = 0 ; POST Δ = 0 ; GET availability Δ = 0 ; cancel/reschedule absents ; 0 tentative session.

## 9. Compteurs PostgreSQL et mock

| Domaine | Avant | Après |
| --- | --- | --- |
| PG | `1\|11\|4\|0` | `1\|11\|4\|0` |
| Ouvertes | 0 | 0 |
| Mock POST | 1 | 1 |
| Mock GET availability | 3 | 3 |
| Scénario | `created` | `created` |

## 10. Désactivation

Immédiate : `active=false`, `activeVersionId=null`, webhooks **0**, VC **8**, graphe et SHA Finaliser inchangés.

## 11. Intégrité LIVE / Mailpit

LIVE fingerprint inchangé. Mailpit 5 / 2 / 98 304 inchangé. Empreintes tentatives / RDV / autres sessions inchangées.

## 12. Verdict

**PASS**

## 13. GO/NO-GO

**GO** pour **8F-2B49-P4** : collecte du prénom (`Camille`) sur `rec008-8f2b49-edit-01`, sous **autorisation distincte**.

Restrictions respectées. Arrêt ici. Attente d’une nouvelle autorisation.
