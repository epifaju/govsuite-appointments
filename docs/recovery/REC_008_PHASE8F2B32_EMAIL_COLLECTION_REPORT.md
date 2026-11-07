# REC-008 phase 8F-2B32 — Collecte contrôlée de l’e-mail (`rec008-8f2b28-new-01`)

Un message `camille.essai@example.test` sur la session en `ASK_EMAIL` (après 8F-2B31). E-mail persisté, identité et contexte métier conservés, transition `ASK_EMAIL` → `ASK_TELEPHONE`. **Aucune tentative, aucun CLAIM, aucun POST.**

Verdict : **PASS**  
GO/NO-GO collecte du téléphone : **GO**

Artefacts : `n8n/proposed/2026-10-31-rec008-phase8f2b32-EMAIL-COLLECTION/`  
(`PREFLIGHT.json`, `RESULT.json`, `response.txt`, `run.js`)

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow | inactif, `activeVersionId = null` |
| Version / compteur | `e1b32992-…` / **8** |
| Graphe / Finaliser | 134 / 137 ; SHA `3fc500bf…` |
| Credentials / URL / isolation | TEST / 10 mock / OK |
| PostgreSQL | 1 / 9 / 2 / 0 ; 0 ouverte |
| Mock | POST = 1 ; GET availability = 2 |
| LIVE / Mailpit | `a2dea067…` ; 5 / 2 / 98 304 |

## 2. État initial de la session

| Champ | Valeur |
| --- | --- |
| Intent / pending / step | `CREATE_APPOINTMENT` / `CREATE_APPOINTMENT` / `ASK_EMAIL` |
| Service / site / dates | PASSEPORT / PARIS / `2026-11-03` |
| `slot_id` / index | `33333333-…` / 1 |
| `nom` / `prenom` | Dupont / Camille |
| `email` / `telephone` | vides |
| Tentatives liées | 0 |

## 3. Message exact envoyé

`camille.essai@example.test` — un seul message, `sessionId = rec008-8f2b28-new-01`.

## 4. Activation temporaire

`POST .../activate` → 200. Version `e1b32992-…` seule active. Webhooks chat OK.

## 5. Réponse HTTP et durée

| Mesure | Valeur |
| --- | --- |
| HTTP | **200** |
| Durée | 13 635 ms |
| Retry | **aucun** |

## 6. Réponse conversationnelle

| Champ | Valeur |
| --- | --- |
| `type` | `create_appointment_question` |
| `conversationStep` | `ASK_TELEPHONE` |
| Texte | demande uniquement le **numéro de téléphone** |
| `claimAcquired` / `ready` | false / false |
| `validation.emailValide` | true |

## 7. État PostgreSQL avant / après

| Champ | Avant | Après |
| --- | --- | --- |
| `nom` / `prenom` | Dupont / Camille | Dupont / Camille |
| `email` | (vide) | **camille.essai@example.test** |
| `telephone` | vide | vide |
| `conversation_step` | `ASK_EMAIL` | `ASK_TELEPHONE` |
| Compteurs | `1\|9\|2\|0` | `1\|9\|2\|0` |

## 8. Conservation du contexte

Nom, prénom, PASSEPORT / PARIS / dates / `slot_id` / index 1 / `available_slots` inchangés.

## 9. Absence de tentative, CLAIM et POST

0 tentative sur la session ; GET availability Δ = 0 ; POST = **1** ; pas de cancel/reschedule.

## 10. Désactivation

Workflow inactif ; VC **8** ; Finaliser SHA et graphe inchangés ; webhooks = 0.

## 11. Intégrité sessions historiques

Empreinte des autres sessions inchangée. `rec008-8f2b14-new-01` / tentatives CONFIRMED·ABANDONED inchangées.

## 12. LIVE et Mailpit

Inchangés.

## 13. Verdict

**PASS**

## 14. GO/NO-GO

**GO** pour la collecte du téléphone sur `rec008-8f2b28-new-01`, après autorisation distincte.

Arrêt ici — attendre autorisation distincte.
