# REC-008 phase 8F-2B42 — Collecte du téléphone et tentative en attente (`rec008-8f2b37-new-01`)

Un message `+33000000000` sur la session en `ASK_TELEPHONE` (après 8F-2B41). Téléphone persisté, récapitulatif complet, transition `ASK_TELEPHONE` → `AWAIT_CREATE_CONFIRMATION`, **une** tentative `AWAITING_CONFIRMATION` créée avec clé d’idempotence nouvelle et corps figé. **Aucun CLAIM, aucun POST CreateAppointment, aucun `oui`/`non`.**

Verdict : **PASS**  
GO/NO-GO confirmation positive explicite (phase distincte) : **GO**  
(TTL 2 h — re-vérifier `expires_at` et la marge avant tout `oui`.)

Artefacts : `n8n/proposed/2026-10-31-rec008-phase8f2b42-PHONE-CONFIRMATION/`  
(`PREFLIGHT.json`, `RESULT.json`, `response.txt`, `run.js`)

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow | inactif, `activeVersionId = null` |
| Version / compteur | `e1b32992-…` / **8** |
| Graphe / Finaliser | 134 / 137 ; SHA `3fc500bf…` |
| Credentials / URL / isolation | TEST / 10 mock / OK |
| PostgreSQL | **1 / 10 / 3 / 0** ; 0 ouverte |
| Tentatives | 1 ABANDONED + 1 CONFIRMED + 1 EXPIRED |
| Mock | scénario `created` ; POST **0** ; GET availability **2** |
| LIVE / Mailpit | `a2dea067…` ; 5 / 2 / 98 304 |

Préflight **OK**.

## 2. État initial de la session

| Champ | Valeur |
| --- | --- |
| Intent / pending / step | `CREATE_APPOINTMENT` / `CREATE_APPOINTMENT` / `ASK_TELEPHONE` |
| Identité | Dupont / Camille / `camille.essai@example.test` ; téléphone vide |
| Service / site / dates | PASSEPORT / PARIS / `2026-11-03` |
| `slot_id` / index | `33333333-…` / 1 ; 09:00–09:30 |
| Tentatives liées | **0** |

## 3. Message unique

Exactement : `+33000000000` — `sessionId = rec008-8f2b37-new-01`. Aucun `oui` / `non` / retry.

## 4. Réponse HTTP et durée

| Mesure | Valeur |
| --- | --- |
| Activation | 200 ; version `e1b32992-…` seule active |
| Message | **200** ; **49 179 ms** |
| Désactivation | immédiate ; webhooks = 0 |

## 5. Validation du téléphone

| Champ | Valeur |
| --- | --- |
| `type` | `create_appointment_question` |
| `conversationStep` | **`AWAIT_CREATE_CONFIRMATION`** |
| `telephone` (PG) | **`+33000000000`** |
| `ready` / `claimAcquired` | **false** / **false** (absents → non acquis) |
| Annonce RDV confirmé | non |

## 6. Récapitulatif affiché

PASSEPORT / PARIS / mardi 03 novembre 2026 / 09:00–09:30 / Dupont / Camille / `camille.essai@example.test` / `+33000000000`.  
Demande : « Répondez exactement **oui** … **non** pour abandonner … ».

## 7. État PostgreSQL (session)

| Champ | Après |
| --- | --- |
| `nom` / `prenom` | Dupont / Camille |
| `email` | `camille.essai@example.test` |
| `telephone` | **`+33000000000`** |
| `conversation_step` | `AWAIT_CREATE_CONFIRMATION` |
| Intent / pending | `CREATE_APPOINTMENT` |
| Service / site / dates / créneau | inchangés |
| Compteurs | **`1\|10\|4\|0`** ; ouverte **1** |

## 8. Identifiant de la nouvelle tentative

| Champ | Valeur |
| --- | --- |
| Id | `d566fc28-02de-4ae1-afbb-6f7d81362d4d` |
| Session | `rec008-8f2b37-new-01` |
| Distinct des historiques | oui (`ad71a155…`, `8ae63b62…`, `57bf7de8…`) |

## 9. Statut, TTL et expiration

| Champ | Valeur |
| --- | --- |
| Statut | **`AWAITING_CONFIRMATION`** |
| `created_at` | `2026-11-01 13:07:51+01` |
| `expires_at` | `2026-11-01 15:07:51+01` |
| TTL à la création | **7200 s** (2 h) |
| Marge restante (mesure) | ~7196 s |
| Lease / référence / appointment / submitted / confirmed | absents |

## 10. Clé nouvelle et corps figé (sans secrets)

| Indicateur | Résultat |
| --- | --- |
| Clé d’idempotence | présente (longueur **71** ; fp12 `e721ae85a9d7`) |
| Corps figé | présent ; slot / nom / prénom / e-mail / téléphone conformes |
| Champ d’idempotence dans le corps | présent et cohérent avec la clé |
| Empreinte | présente (fp12 `1aa346780669`) |
| Clé ≠ historiques | oui (nouvelle clé pour cette session) |

## 11. Absence de CLAIM / POST

Mock POST Δ = **0** ; GET availability Δ = **0** ; pas de cancel/reschedule.  
Réponse sans `claimAcquired` / `ready`. Aucun e-mail (Mailpit inchangé).

## 12. Intégrité historique

Autres sessions inchangées. Tentatives ABANDONED / CONFIRMED / EXPIRED inchangées.  
Statuts globaux : 1 ABANDONED + 1 AWAITING_CONFIRMATION + 1 CONFIRMED + 1 EXPIRED.

## 13. Intégrité LIVE / Mailpit

Inchangés (`a2dea067…` ; 5 / 2 / 98 304). Workflow inactif ; VC **8** ; Finaliser SHA et graphe inchangés.

## 14. Verdict

**PASS**

## 15. GO/NO-GO

**GO** pour une confirmation positive explicite (`oui`) sur `rec008-8f2b37-new-01`, sous **autorisation distincte**.

**Important :** re-vérifier `expires_at` et la marge temporelle avant le `oui`. Si la tentative est expirée → protocole STOP ; ne jamais prolonger le TTL ni réutiliser la clé.

Arrêt ici.
