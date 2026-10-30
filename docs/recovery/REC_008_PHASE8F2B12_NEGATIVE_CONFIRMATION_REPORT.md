# REC-008 phase 8F-2B12 — Test de refus de confirmation

Un message `non` sur `rec008-8f2b4-slot-01` (version `e84ee0d2-…` / 6). Tentative passée à `ABANDONED` avec purge clé/corps. Aucun POST, aucun CancelAppointment, rendez-vous fictif inchangé.

Verdict : **PASS**.

Artefacts : `n8n/proposed/2026-10-30-rec008-phase8f2b12-NEGATIVE-CONFIRMATION/` (`CONTRACT.json`, `RESULT.json`, `response.txt`).

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow | inactif, `activeVersionId = null` |
| Version / compteur | `e84ee0d2-7af9-417e-8d47-0a28580dccac` / 6 |
| Graphe | 134 / 137 |
| Autres actifs | 0 |
| Credentials / URL / isolation | TEST / 10 mock / OK |
| PostgreSQL TEST | 1 / 7 / **1** / 0 |
| Mock | total 6, GET 6, POST 0 |
| GovSuite | 13, 14, 12, 48, 0, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Mailpit | 5 / 2 / 98 304 |
| Session | `AWAIT_CREATE_CONFIRMATION`, données C5 intactes |
| Tentative | 1× `AWAITING_CONFIRMATION`, corps+clé présents, pas de lease |

## 2. Contrat du refus

| Point | Constat |
| --- | --- |
| Parser | `non` ∈ `negativeDecisions` → `createDecision = NEGATIVE` |
| Décider | `NEGATIVE` → `attemptAction = ABANDON` |
| Aiguiller | branche ABANDON → `Préparer abandon ou modification` |
| SQL | `cloturer_tentative_rendez_vous(..., 'ABANDONED')` depuis `AWAITING_CONFIRMATION` uniquement ; purge `idempotency_key` + `request_payload` |
| Suite | `Effacer brouillon abandonné` → `Réponse demande abandonnée` |
| CreateAppointment | **non atteignable** depuis cette branche |
| CancelAppointment | **non atteignable** depuis cette branche |

**GO activation.**

## 3. État initial de la tentative

| Attribut | Valeur |
| --- | --- |
| Id | `8ae63b62-…` (inchangé après) |
| Statut | `AWAITING_CONFIRMATION` |
| Clé / corps | présents (non exposés) |
| Lease / référence | absents |

## 4. Activation

`POST .../activate` → 200. Version `e84ee0d2-…`. Seul workflow actif.

## 5. Message unique

`non` — un seul message. Pas de `oui`.

## 6. Réponse HTTP

| Mesure | Valeur |
| --- | --- |
| HTTP | 200 |
| Durée | 97 324 ms |
| `type` | `create_abandoned` |
| Texte | `La demande de rendez-vous est abandonnée. Aucun rendez-vous n'a été créé.` |

Aucune affirmation d’annulation d’un rendez-vous existant.

## 7. Transition conversationnelle

Contrat observé (`Effacer brouillon abandonné`) :

- `conversation_step` / `pending_action` → vides
- brouillon identité / créneau / e-mail / téléphone vidé
- `last_user_message = non`

Transition sûre, sans étape imposée artificiellement.

## 8. Statut de la tentative

| Attribut | Avant | Après |
| --- | --- | --- |
| Id | `8ae63b62-…` | **identique** |
| Statut | `AWAITING_CONFIRMATION` | **`ABANDONED`** |
| Tentatives ouvertes | 1 | **0** |
| SUBMITTING / CONFIRMED | — | non |

Une confirmation ultérieure sur cette tentative est impossible (statut terminal + clé/corps purgés). Non testée ici.

## 9. Vérification de purge

| Champ | Après |
| --- | --- |
| `idempotency_key` | NULL |
| `request_payload` | NULL |
| lease | NULL |
| référence / appointment_id | absents |
| empreinte technique | conservée (métadonnée) |

Aucune nouvelle tentative. Pas de token de gestion.

## 10. Absence de POST et d’annulation

| Contrôle | Résultat |
| --- | --- |
| POST mock | 0 |
| CancelAppointment / cancel | 0 |
| Empreinte rendez-vous TEST | inchangée (`986b715d…`) |
| Rendez-vous count | 1 |

## 11. Compteurs mock

Total 6, GET availability 6, POST 0.

## 12. Compteurs PostgreSQL TEST

1 rendez-vous, 7 sessions, 1 tentative (`ABANDONED`), 0 ouverte, 0 notification.

## 13. Durée et mémoire Ollama

97 324 ms ; 89,19 Mio → 1,195 Gio ; OOM false.

## 14. Désactivation

`active = false`, `activeVersionId = null`, 0 webhook, compteur 6, graphe 134/137.

## 15. Intégrité GovSuite et Mailpit

GovSuite inchangé. Mailpit 5 / 2 / 98 304.

## 16. Verdict

**PASS**.

## 17. GO/NO-GO

Scénario suivant (nouvelle collecte / confirmation positive sur **nouvelle** session, la présente étant abandonnée), après autorisation distincte : **GO**.

Activer ou confirmer (`oui`) maintenant sans autorisation : **NO-GO**.

Arrêt 8F-2B12.
