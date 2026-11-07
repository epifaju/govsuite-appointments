# REC-008 phase 8F-2B34 — Confirmation positive et finalisation complète (TEST isolé)

Objectif : un message `oui` sur `rec008-8f2b28-new-01` pour valider CLAIM → POST mock 201 → `CONFIRMED` → finalisation conversationnelle (correctif Finaliser `$3`).

**STOP avant activation.** La tentative cible est **expirée**. Aucun message, aucun CLAIM, aucun POST.

Verdict : **FAIL**  
GO/NO-GO non-régression suivantes : **NO-GO**

Artefacts : `n8n/proposed/2026-10-31-rec008-phase8f2b34-POSITIVE-CONFIRMATION-FINALIZATION/`  
(`PREFLIGHT.json`, `STOP.json`, `RESULT.json`, `run.js`)

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow | inactif, `activeVersionId = null` |
| Version / compteur | `e1b32992-…` / **8** |
| Graphe / Finaliser | 134 / 137 ; SHA `3fc500bf…` |
| Autres actifs | 0 |
| Credentials / URL / isolation | TEST / 10 mock / OK |
| PostgreSQL TEST | **1 / 9 / 3 / 0** ; 1 ouverte |
| Tentatives | 1 ABANDONED + 1 CONFIRMED + 1 AWAITING_CONFIRMATION |
| Mock scénario | `created` |
| Mock compteurs observés | POST = **0** ; GET availability = **0** (reset mémoire après redémarrage stack TEST — **expliqué**) |
| Mock attendu mission | POST = 1 ; GET availability = 2 |
| LIVE / Mailpit | `a2dea067…` ; 5 / 2 / 98 304 |

Note opérationnelle : les conteneurs TEST (`postgres`, `mock`, `n8n`, `publish`) étaient **Exited** au démarrage de la phase ; redémarrage `docker compose up -d` **lecture seule / accès**. Postgres durable OK. Compteurs mock volatils remis à zéro.

Préflight workflow / PG / LIVE / Mailpit / session / champs tentative : **OK**.  
Préflight temporel tentative + compteurs mock attendus : **NO-GO**.

## 2. Validité temporelle de la tentative

Tentative `57bf7de8-9a5e-469d-858a-a6bd389223e6` :

| Champ | Valeur |
| --- | --- |
| Session | `rec008-8f2b28-new-01` (appartenance exacte) |
| Statut | `AWAITING_CONFIRMATION` |
| Ouverte | oui |
| `expires_at` | `2026-11-01 00:30:40.55687+01` |
| `secsLeft` | **≈ −40 031** |
| `stillValid` | **false** |
| Clé d’idempotence | présente (longueur **71** ; fp12 `3864497c21f6`) |
| Corps figé | présent ; slot / identité conformes |
| Empreinte | présente (fp12 `81bd3c88c8e5`) |
| Lease / référence / appointment_id / submitted / confirmed | absents |
| Cohérence session ↔ corps | oui |

**STOP obligatoire** (mission §3) : tentative expirée.  
**Aucune** prolongation TTL. **Aucune** modification SQL. **Aucune** nouvelle tentative. **Aucune** réutilisation de clé historique.

## 3. État initial de la session

| Champ | Valeur |
| --- | --- |
| Step | `AWAIT_CREATE_CONFIRMATION` |
| Pending | `CREATE_APPOINTMENT` |
| Service / site | PASSEPORT / PARIS |
| Date | `2026-11-03` |
| Créneau | `33333333-…` index 1 |
| Identité | Dupont / Camille / `camille.essai@example.test` / `+33000000000` |
| Référence / token | absents |
| Dernier message | `+33000000000` |

Conforme à l’attendu mission §4.

## 4. Configuration du mock

| Contrôle | Résultat |
| --- | --- |
| Scénario | `created` (HTTP 201 + `REC008-MOCK-0001` au contrat) |
| POST CreateAppointment | **0** (attendu 1 — reset après restart) |
| GET availability | **0** (attendu 2 — reset après restart) |
| Réseau | mock uniquement ; isolation LIVE OK |
| Modification mock | **aucune** |

Écart compteurs **expliqué** (redémarrage). STOP déjà imposé par l’expiration.

## 5. Message exact

Autorisé : `oui` sur `sessionId = rec008-8f2b28-new-01`.  
**Non envoyé** (STOP).

## 6. Réponse HTTP et durée

Non applicable — pas d’activation, pas de webhook métier.

## 7. Nombre de CLAIM

**0** (aucune activation).

## 8. Nombre de POST

**0** nouveau POST CreateAppointment. Compteur mock observé total = 0 (reset).

## 9. Réponse du mock

Aucune soumission métier dans cette phase.

## 10. Statut final de la tentative

Inchangé : `AWAITING_CONFIRMATION`, expirée, secrets encore présents (clé / corps / empreinte), sans lease ni référence.

## 11. Exécution du nœud Finaliser

Non atteinte. SHA installé inchangé `3fc500bf…` (correctif 8F-2B26 présent mais **non revalidé** en parcours conversationnel réel).

## 12. État final de la session

Inchangé : toujours `AWAIT_CREATE_CONFIRMATION` / `CREATE_APPOINTMENT` ; référence absente.

## 13. Purge des données sensibles

Non applicable (pas de clôture `CONFIRMED` sur la tentative cible).

## 14. Intégrité historique

| Entité | État |
| --- | --- |
| Tentative CONFIRMED `ad71a155-…` | inchangée (`REC008-MOCK-0001`) |
| Tentative ABANDONED `8ae63b62-…` | inchangée |
| Session historique `rec008-8f2b14-new-01` | référence `REC008-MOCK-0001` ; step/pending vides |
| Empreintes autres sessions / tentatives / RDV | capturées ; non mutées |
| Compteurs PG | `1\|9\|3\|0` |

## 15. Intégrité GovSuite LIVE et Mailpit

| Contrôle | Résultat |
| --- | --- |
| GovSuite | `13\|14\|12\|48\|0\|a2dea067599fd4f0a5f857551adc67cc` **inchangé** |
| Mailpit | 5 / 2 / 98 304 **inchangé** |
| E-mail | aucun |
| PUT / SQL correctif / mock edit | aucun |

## 16. Verdict

**FAIL**

Réussi (lecture seule) : workflow TEST conforme VC8 / Finaliser SHA ; isolation LIVE ; session et champs tentative cohérents ; aucune mutation métier.

Bloquant : tentative `57bf7de8-…` **expirée** (`expires_at` 2026-11-01 00:30:40+01). Mission interdit prolongation / création / réconciliation. Confirmation positive **non exécutable** dans ces conditions.

Secondaire : compteurs mock volatils remis à 0 après redémarrage stack (écart expliqué).

## 17. GO/NO-GO

| Suite | Décision |
| --- | --- |
| Confirmation positive `oui` sur `rec008-8f2b28-new-01` | **NO-GO** (tentative expirée) |
| Tests de non-régression (double `oui`, rejeu clé, erreurs mock) | **NO-GO** tant qu’une nouvelle tentative `AWAITING_CONFIRMATION` valide n’est pas créée sous **autorisation distincte** |

Arrêt ici. Attendre une autorisation distincte (nouvelle collecte / nouvelle tentative ouverte, sans toucher LIVE).
