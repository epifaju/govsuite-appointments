# REC-008 phase 8F-2B9 — Installation contrôlée du correctif validation

Un seul PUT sur le workflow TEST `OCD9It1uKFhOoWNF`. Nœud modifié : `Valider paramètres création` (Option B 8F-2B8). Aucune activation, aucun chat, aucun POST métier.

Verdict : **PASS**.

Artefacts : `n8n/proposed/2026-10-30-rec008-phase8f2b9-VALIDATION-FIX-INSTALL/`.

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow | inactif, `activeVersionId = null` |
| Version / compteur | `12e6b201-6173-457e-97c4-a17cc1900eb6` / 5 |
| Graphe | 134 / 137 |
| Autres actifs | 0 |
| Credentials | PostgreSQL `Fs0l0058q5CEadRw` (30), Ollama `dxzHqBq8Q60R8BOz` |
| HTTP | 10 URL `http://rec008-mock:8080/…` |
| Isolation | OK |
| PostgreSQL TEST | 1 / 7 / 0 / 0 |
| Mock | total 6, GET 6, POST 0 |
| GovSuite | 13, 14, 12, 48, 0, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Mailpit | 5 / 2 / 98 304 |
| Session `rec008-8f2b4-slot-01` | `ASK_TELEPHONE`, Dupont / Camille / `camille.essai@example.test`, slot UUID, téléphone vide |

Préflight OK.

## 2. Vérification du candidat

Fichier : `n8n/proposed/2026-10-30-rec008-phase8f2b8-NON-PUBLIE/10_AI_ConsularAssistant_VALIDATION_FIX_NON_PUBLIE.json`.

- Diff live ↔ candidat : **un seul** nœud (`Valider paramètres création`), uniquement `jsCode`.
- `Décider`, `Aiguiller`, Fusionner, Gérer, claim SQL, classification HTTP, corps figé, empreinte, credentials, URLs, webhook, connexions, settings : inchangés.
- Hydratation informative + `ready = claimAcquired === true` présents.

Candidat non modifié.

## 3. SHA-256

| Artefact | SHA-256 |
| --- | --- |
| Candidat | `d90d5e77165579949b2f520c3fb85ad9f544f8dba3afe8b022ee0a8eb96c6a91` |
| Export avant (= référence 8F-2B8) | `be5037e4664875c0a927d21181ea4bc81a6d11ffb70889956993c8ddb67ed8d4` |
| Valider avant | `6fa62389cdecbc5024081ca51d306e26ffa98b1b27808ba30ee72c22a66772be` |
| Valider après (candidat / installé) | `7b237d3fd446d30cca1cc56ff406cc3a9fc3afccdee50cad62c3248b8607f162` |
| Décider (inchangé) | `eb7b8e3e3da17a1c5c514cf6ef149af6ba8b0c238fd27b3c8549d1f9390c9f95` |
| Payload PUT | `be5fc6c03c00c812a31b76dfc1f5dc6d1fb4d4b33e7cb77b86ba96edd4e65371` |
| Export après | `cbb56243bf997dbda3c97c1418593297d2a6858fb17c07132a456b564b526ba1` |

## 4. Export avant

`before-OCD9It1uKFhOoWNF.json` — version `12e6b201-…`, compteur 5, inactif. Identique à la référence 8F-2B8 (`source-installed.json`).

## 5. Diff exact

Seul changement : `jsCode` de **`Valider paramètres création`** (hydratation depuis `Gérer collecte progressive`). Voir `diff-meta.json`.

## 6. Payload PUT

Construit depuis le workflow LIVE + paramètres Valider du candidat.

Champs : `name`, `nodes`, `connections`, `settings`, `staticData`, `pinData`.

Sans `active: true`. Sans `/activate`. Un seul PUT.

Fichier : `update-body.json`.

## 7. Réponse HTTP

`PUT /api/v1/workflows/OCD9It1uKFhOoWNF` → **200**. Pas de message d’erreur (`put-response.json`).

## 8. Nouveau versionId et versionCounter

| Champ | Avant | Après |
| --- | --- | --- |
| `versionId` | `12e6b201-6173-457e-97c4-a17cc1900eb6` | `e84ee0d2-7af9-417e-8d47-0a28580dccac` |
| `versionCounter` | 5 | **6** |

## 9. Export après

`after-OCD9It1uKFhOoWNF.json` — SHA `cbb56243…`.

## 10. Comparaison installé / candidat

| Contrôle | Résultat |
| --- | --- |
| `jsCode` Valider = candidat | OK (`7b237d3f…`) |
| Diff paramètres nœuds | uniquement `Valider paramètres création` |
| Credentials / webhook | inchangés |
| Connexions / settings | inchangés |
| Décider | inchangé |

## 11. Invariants REC-008

| Invariant | Statut |
| --- | --- |
| Hydratation informative Valider | OK |
| `ready = claimAcquired === true` | OK |
| Décider inchangé | OK |
| Claim SQL / Classer HTTP / UNCERTAIN | OK |
| Corps figé / empreinte | OK |
| `Appeler CreateAppointment` ← `Corps figé présent ?` | OK |

## 12. État d’activation

`active = false`, `activeVersionId = null`, 0 webhook enregistré, 0 autre workflow actif.

## 13. Compteurs PostgreSQL TEST

`1|7|0|0` — inchangés.

## 14. Compteurs mock

Total 6, GET availability 6, POST 0 — inchangés.

## 15. Intégrité GovSuite et Mailpit

GovSuite : 13, 14, 12, 48, 0, empreinte `a2dea067599fd4f0a5f857551adc67cc`.

Mailpit : 5 / 2 / 98 304.

## 16. Anomalies

Aucune.

## 17. Verdict

**PASS**.

## 18. GO/NO-GO test conversationnel

Test conversationnel distinct (ex. reprise C4/C5 ou téléphone) sur version `e84ee0d2-…` / compteur 6, après autorisation distincte : **GO**.

Activer ou chatter maintenant sans autorisation : **NO-GO**.

Arrêt 8F-2B9.
