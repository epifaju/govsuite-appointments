# REC-008 phase 8F-2B33 — Téléphone et tentative en attente de confirmation

Un message `+33000000000` sur `rec008-8f2b28-new-01`. Téléphone persisté, transition `ASK_TELEPHONE` → `AWAIT_CREATE_CONFIRMATION`, récapitulatif exact, **une** tentative `AWAITING_CONFIRMATION` créée. **Aucun CLAIM, aucun POST CreateAppointment.**

Verdict : **PASS**  
GO/NO-GO confirmation positive explicite (phase distincte) : **GO**

Artefacts : `n8n/proposed/2026-10-31-rec008-phase8f2b33-PHONE-CONFIRMATION/`  
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
| Step | `ASK_TELEPHONE` |
| Identité | Dupont / Camille / `camille.essai@example.test` ; téléphone vide |
| Créneau | `33333333-…` index 1 ; 09:00–09:30 |
| Tentatives liées | 0 |

## 3. Message unique

`+33000000000` — aucun `oui` / `non` / retry.

## 4. Réponse HTTP et durée

| Mesure | Valeur |
| --- | --- |
| Activation | 200 ; version `e1b32992-…` seule active |
| Message | **200** ; 46 337 ms |
| Désactivation | immédiate ; webhooks = 0 |

## 5. Réponse conversationnelle

`type = create_appointment_question` ; `conversationStep = AWAIT_CREATE_CONFIRMATION`.  
Demande : « Répondez exactement **oui** … **non** pour abandonner … ».  
Pas d’annonce de rendez-vous déjà confirmé. Pas de fuite de clé / empreinte.

## 6. Récapitulatif affiché

PASSEPORT / PARIS / mardi 03 novembre 2026 / 09:00–09:30 / Dupont / Camille / `camille.essai@example.test` / `+33000000000`.

## 7. Validation du téléphone

`telephone = +33000000000` en session ; demandé uniquement avant ce message.

## 8. Tentative créée et statut

| Champ | Valeur |
| --- | --- |
| Id | `57bf7de8-9a5e-469d-858a-a6bd389223e6` |
| Statut | **`AWAITING_CONFIRMATION`** |
| Session | `rec008-8f2b28-new-01` |
| Ouvertes globales | **1** |
| Compteurs | `1\|9\|3\|0` |

Distincte des tentatives historiques CONFIRMED / ABANDONED.

## 9. Corps figé et idempotence (sans secrets)

| Indicateur | Résultat |
| --- | --- |
| Clé d’idempotence | présente (longueur **71** ; fp12 `3864497c21f6`) |
| Corps figé | présent ; slot / nom / prénom / e-mail / téléphone conformes |
| Champ d’idempotence dans le corps | présent |
| Empreinte | présente (fp12 `81bd3c88c8e5`) |
| Lease / référence / appointment_id / submitted / confirmed | absents |

## 10. Absence de CLAIM / POST

Réponse sans `claimAcquired` / `ready` (interprétés comme absents = non acquis). Mock POST toujours **1**. GET availability Δ = 0. Pas de cancel/reschedule.

## 11. Désactivation

Workflow inactif ; VC **8** ; Finaliser SHA et graphe inchangés.

## 12. Intégrité historique

Autres sessions inchangées. Tentatives CONFIRMED (`ad71a155-…`) et ABANDONED (`8ae63b62-…`) inchangées.

## 13. LIVE et Mailpit

Inchangés.

## 14. Verdict

**PASS**

Note technique : le premier scoring automatisé exigeait `claimAcquired === false` littéral ; la réponse omet le champ. Réévaluation sans second message : absence = non-CLAIM. Correctif appliqué dans `run.js` pour les phases suivantes.

## 15. GO/NO-GO

**GO** pour une future confirmation positive explicite (`oui`) sur `rec008-8f2b28-new-01`, **après autorisation distincte**.

Arrêt ici — attendre une nouvelle autorisation.
