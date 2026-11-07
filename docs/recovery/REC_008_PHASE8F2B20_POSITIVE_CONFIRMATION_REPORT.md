# REC-008 phase 8F-2B20 — Confirmation positive sur mock isolé

Un message `oui` sur `rec008-8f2b14-new-01` (version `e84ee0d2-…` / 6). Claim atomique + **un seul** POST CreateAppointment mock **HTTP 201** → tentative `CONFIRMED` (`REC008-MOCK-0001`). Réponse conversationnelle **HTTP 500** après clôture (`Finaliser état création` : paramètre `$3` token absent). **Aucun appel LIVE.**

Verdict : **FAIL** (chemin métier CLAIM→POST→CONFIRMED prouvé ; finalisation conversationnelle / session non clôturée).

Artefacts : `n8n/proposed/2026-10-30-rec008-phase8f2b20-POSITIVE-CONFIRMATION/` (`CONTRACT.json`, `RESULT.json`, `response.txt`).

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow | inactif, `activeVersionId = null` |
| Version / compteur | `e84ee0d2-7af9-417e-8d47-0a28580dccac` / 6 |
| Graphe | 134 / 137 |
| Autres actifs | 0 |
| Credentials / URL / isolation | TEST / 10 mock / OK |
| PostgreSQL TEST | 1 / 8 / 2 / 0 |
| Tentatives | 1 `ABANDONED` + 1 `AWAITING_CONFIRMATION` (1 ouverte) |
| Mock | scenario `created` ; GET services 1 ; GET availability 1 ; POST 0 |
| Bruit mock | +1 `GET /_meta 404` (sonde diagnostic lecture seule, **expliqué**) → total 3 |
| GovSuite | 13, 14, 12, 48, 0, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Mailpit | 5 / 2 / 98 304 |
| Session | `AWAIT_CREATE_CONFIRMATION`, identité + créneau complets |

## 2. Validité temporelle de la tentative

Tentative `ad71a155-…` :

| Champ | Valeur |
| --- | --- |
| Statut | `AWAITING_CONFIRMATION` |
| `expires_at` | 2026-10-31 18:01:06+01 |
| Validité à l’activation | oui (~6483 s restantes, seuil ≥ 90 s) |
| Clé / corps / empreinte | présents (clé longueur 71 ; empreinte 64 hex) |
| Clé = `cleIdempotence` du corps | oui |
| Lease / référence / appointment_id | absents |
| Corps inchangé depuis création | `created_at` = `updated_at` |
| Distincte de `ABANDONED` | oui (`8ae63b62-…`) |

**Pas de prolongation artificielle.** GO temporel.

Empreinte = SHA-256 du corps figé reconstruit (`70be27ad…`) ; hash de clé (non affiché en clair) capturé avant claim.

## 3. Audit AFFIRM → CLAIM → POST

| # | Point | Constat |
| --- | --- | --- |
| 1 | `oui` → AFFIRM seulement en attente | oui (`Parser intention` + `AWAIT_CREATE_CONFIRMATION`) |
| 2 | AFFIRM → CLAIM | oui (`Décider action tentative`) |
| 3 | CLAIM = `reclamer_tentative_rendez_vous` | oui (nœud `Réclamer tentative`) |
| 4 | Claim atomique unique | oui (UPDATE conditionnel `AWAITING_CONFIRMATION`) |
| 5 | SUBMITTING avant POST | oui |
| 6 | POST = corps figé | oui (`frozenBody` → HTTP raw) |
| 7 | Idempotence réutilisée | oui (pas de régénération) |
| 8 | URL | `http://rec008-mock:8080/appointments` |
| 9 | 201 → CONFIRMED | oui (`Classer réponse HTTP`) |
| 10 | Clôture après succès | oui (`Clôturer confirmation`) |
| 11 | Timeout / 500 / ambigu → UNCERTAIN | oui (classement) |
| 12 | Cancel / LIVE | non atteignables sur la branche CLAIM |

`CONTRACT.json` : `safeToActivate = true`.

## 4. Scénario mock

| Contrôle | Résultat |
| --- | --- |
| `REC008_MOCK_SCENARIO` | `created` (inchangé) |
| Réponse nominale | HTTP **201** + `appointment.reference = REC008-MOCK-0001` |
| Configuration mock | **non modifiée** |

## 5. Autorisation d’activation

**GO** (préflight + validité + contrat + mock 201 déterminé).

Effets autorisés uniquement : message `oui`, claim TEST, POST mock, mise à jour tentative selon résultat réel.

## 6. Message unique

Session `rec008-8f2b14-new-01` — exactement **`oui`**. Aucun retry client.

## 7. Réponse HTTP conversationnelle

| Mesure | Valeur |
| --- | --- |
| HTTP | **500** |
| Corps | `{"message":"Error in workflow"}` |
| Durée | 54 310 ms |

Cause journal n8n : **`there is no parameter $3`** sur `Finaliser état création` (binding `token` / `token_gestion` absent dans la réponse mock ; `$3` non fourni à PostgreSQL).

La clôture `CONFIRMED` a déjà eu lieu **avant** ce nœud.

## 8. Transition PostgreSQL de la tentative

| | Avant | Après |
| --- | --- | --- |
| Statut | `AWAITING_CONFIRMATION` | **`CONFIRMED`** |
| Clé / corps | présents | **purgés** |
| Lease | absent | absent |
| Référence | — | `REC008-MOCK-0001` |
| `appointment_id` | — | `55555555-5555-4555-8555-555555555555` |
| Empreinte | `70be27ad…` | **identique** |
| `submitted_at` / `confirmed_at` | absents | **présents** |

Ancienne tentative `8ae63b62-…` : toujours **`ABANDONED`**.

## 9. Nombre exact de claims

**1** acquisition effective (passage unique `AWAITING_CONFIRMATION` → `SUBMITTING` → `CONFIRMED` ; `submitted_at` / `confirmed_at` renseignés une fois).

## 10. Nombre exact de POST mock

| | Valeur |
| --- | --- |
| POST avant | **0** |
| POST après | **1** (`POST /appointments 201`) |
| Delta | **1** |
| Cancel | **0** |
| `distinctKeys` | **1** |

Pas de second POST → pas de FAIL critique multi-POST.

## 11. Statut HTTP mock

**201** (scénario `created`).

## 12. Corps figé et idempotence

| Contrôle | Résultat |
| --- | --- |
| Empreinte avant = SHA-256(corps figé reconstruit) | oui (`70be27ad…`) |
| Empreinte après clôture | inchangée |
| Clé réutilisée (hash capturé, valeur non exposée) | oui ; `distinctKeys = 1` |
| Secrets après CONFIRMED | clé et corps **NULL** |

## 13. Réponse affichée à l’utilisateur

Aucune réponse de succès. Message technique n8n uniquement. Référence mock **non** affichée à l’utilisateur (échec avant `Préparer réponse création` / restauration).

## 14. Absence de faux succès

- Pas de message « rendez-vous confirmé » sans preuve.
- Statut `CONFIRMED` **uniquement** après POST 201 + `cloturer_tentative_rendez_vous(..., 'CONFIRMED', ...)`.
- Pas de transformation artificielle UNCERTAIN → CONFIRMED.
- Incohérence UX : confirmation métier réelle mais HTTP 500 côté chat (échec post-clôture, pas un faux succès).

## 15. Compteurs PostgreSQL TEST

| Entité | Après |
| --- | --- |
| Rendez-vous | **1** (empreinte inchangée — **aucune** création SQL rendez-vous) |
| Sessions | 8 |
| Tentatives | 2 (1 ABANDONED + 1 CONFIRMED) |
| Ouvertes | **0** |
| Notifications | **0** |

Session conversationnelle **non** finalisée : toujours `AWAIT_CREATE_CONFIRMATION` / identité encore présente / `last_user_message = oui` / `reference` vide.

## 16. Durée et mémoire Ollama

54 310 ms ; 68,66 MiB → 1,116 Gio ; OOM false.

## 17. Désactivation

| Contrôle | Résultat |
| --- | --- |
| `active` | false |
| `activeVersionId` | null |
| Webhooks | 0 |
| Autres actifs | 0 |
| VersionCounter | 6 |
| Graphe | 134 / 137 |
| Credentials | inchangés |

## 18. Intégrité GovSuite LIVE et Mailpit

| Contrôle | Résultat |
| --- | --- |
| GovSuite | 13 / 14 / 12 / 48 / 0 / `a2dea067599fd4f0a5f857551adc67cc` **inchangé** |
| Mailpit | 5 / 2 / 98 304 **inchangé** |
| E-mail | aucun |

## 19. Verdict

**FAIL**

Réussi : claim unique, POST mock unique 201, corps/idempotence cohérents, `CONFIRMED` + purge secrets, isolation LIVE/Mailpit, désactivation propre.

Échoué : HTTP conversationnel 200, message de succès post-confirmation, finalisation session (`Finaliser état création` / `$3` token manquant sur mock sans `token` / `token_gestion`).

Aucune correction automatique. Aucun second `oui`. Aucun retry POST.

## 20. GO / NO-GO suites

| Suite | Décision |
| --- | --- |
| Scénarios de répétition (double `oui`, rejeu clé) | **NO-GO** tant que la finalisation conversationnelle n’est pas corrigée / revalidée sous autorisation distincte |
| Scénarios d’erreurs mock (500, timeout, UNCERTAIN) | **NO-GO** (même blocage post-clôture ou besoin d’une session/tentative neuve) |

S’arrêter ici. Attendre une autorisation distincte.
