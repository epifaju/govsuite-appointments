# REC-008 phase 8F-2B36 — Expiration contrôlée d’une tentative périmée

Un message `oui` tardif sur `rec008-8f2b28-new-01`. Branche officielle **EXPIRE** : tentative `57bf7de8-…` → `EXPIRED`, secrets purgés, session nettoyée, réponse `create_expired`. **Aucun CLAIM, aucun POST CreateAppointment.**

Verdict : **PASS**  
GO/NO-GO reconstruction d’une nouvelle tentative valide : **GO**

Artefacts : `n8n/proposed/2026-10-31-rec008-phase8f2b36-EXPIRED-CONFIRMATION/`  
(`PREFLIGHT.json`, `RESULT.json`, `response.txt`, `run.js`)

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow | inactif, `activeVersionId = null` |
| Version / compteur | `e1b32992-…` / **8** |
| Graphe / Finaliser | 134 / 137 ; SHA `3fc500bf…` |
| Credentials / URL / isolation | TEST / 10 mock / OK |
| PostgreSQL | 1 / 9 / 3 / 0 ; 1 ouverte |
| Tentatives | 1 ABANDONED + 1 CONFIRMED + 1 AWAITING expirée |
| Mock baseline (post-restart) | `created` ; POST **0** ; GET availability **0** |
| LIVE / Mailpit | `a2dea067…` ; 5 / 2 / 98 304 |

Préflight **OK**.

## 2. Vérification du périmètre global

`SELECT … WHERE status = 'AWAITING_CONFIRMATION' AND expires_at <= clock_timestamp()` :

| Résultat | Valeur |
| --- | --- |
| Nombre de lignes | **1** |
| Id | `57bf7de8-9a5e-469d-858a-a6bd389223e6` |
| Session | `rec008-8f2b28-new-01` |

Aucune autre tentative ouverte hors cette ligne. GO périmètre.

## 3. État initial (tentative + session)

| Tentative | Valeur |
| --- | --- |
| Statut | `AWAITING_CONFIRMATION` |
| `expires_at` | `2026-11-01 00:30:40+01` (déjà échue, ~41 337 s) |
| Clé / corps / empreinte | présents (long. 71 ; fp12 `3864497c21f6` / `81bd3c88c8e5`) |
| Lease / référence / appointment / submitted / confirmed | absents |

| Session | Valeur |
| --- | --- |
| Step / pending | `AWAIT_CREATE_CONFIRMATION` / `CREATE_APPOINTMENT` |
| Identité | Dupont / Camille / `camille.essai@example.test` / `+33000000000` |
| Créneau | `33333333-…` |

## 4. Message unique

Exactement **`oui`** — `sessionId = rec008-8f2b28-new-01`. Aucun retry.

## 5. Réponse HTTP et durée

| Mesure | Valeur |
| --- | --- |
| Activation | 200 ; version `e1b32992-…` seule active |
| Message | **200** ; **59 092 ms** |
| Corps | `type = create_expired` ; texte d’expiration + « Aucun rendez-vous n'a été créé » |
| Désactivation | immédiate ; webhooks = 0 |

## 6. Branche exécutée

Observée par effets + contrat code (8F-2B35) :

`Décider action tentative` (`waitExpired` → **EXPIRE**)  
→ `Aiguiller tentative`  
→ `Expirer tentatives en attente`  
→ `Effacer collecte expirée`  
→ `Réponse attente expirée`

Pas d’annonce de réservation confirmée. Pas de `claimAcquired` / `ready`.

## 7. Statut final de la tentative

| Champ | Après |
| --- | --- |
| Statut | **`EXPIRED`** |
| `updated_at` | `2026-11-01 12:00:48+01` |
| Référence / appointment_id / submitted / confirmed | absents |

## 8. Preuve de purge

| Secret | Après |
| --- | --- |
| `idempotency_key` | **NULL** |
| `request_payload` | **NULL** |
| Lease | **NULL** |
| Empreinte | conservée (`81bd3c88c8e5…`) — non personnelle |

## 9. Nettoyage de la session

| Champ | Après |
| --- | --- |
| `conversation_step` / `pending_action` | vides |
| nom / prénom / e-mail / téléphone / `slot_id` | vides |
| service / site / dates / slots | vides (observé) |
| `reference` / `token` | absents (non inventés) |
| `last_user_message` | `oui` |
| `intent` | encore `CREATE_APPOINTMENT` (non touché par `Effacer collecte expirée`) |

## 10. Absence de CLAIM et POST

| Contrôle | Résultat |
| --- | --- |
| `claimAcquired` | absent / false |
| Mock POST Δ | **0** |
| GET availability Δ | **0** |
| Cancel / reschedule | absents |

## 11. Compteurs PostgreSQL et mock

| Entité | Après |
| --- | --- |
| RDV / sessions / tentatives / notifs | **1 / 9 / 3 / 0** |
| Statuts | 1 ABANDONED + 1 CONFIRMED + **1 EXPIRED** |
| Ouvertes | **0** |
| Mock POST / GET avail. | 0 / 0 (inchangés vs baseline) |

## 12. Intégrité historique

Tentatives `ad71a155-…` (CONFIRMED / `REC008-MOCK-0001`) et `8ae63b62-…` (ABANDONED) **inchangées**. Empreintes autres sessions / tentatives hors cible / RDV **identiques**.

## 13. Intégrité LIVE et Mailpit

Inchangés (`a2dea067…` ; 5 / 2 / 98 304). Workflow inactif ; VC **8** ; Finaliser SHA et graphe inchangés.

## 14. Verdict

**PASS**

## 15. GO/NO-GO

**GO** pour reconstruire une **nouvelle** tentative `AWAITING_CONFIRMATION` valide (nouvelle session / nouvelle clé), puis confirmation positive sous **autorisation distincte**.

Arrêt ici.
