# REC-008 phase 8F-2B49-P4 — Collecte du prénom (préparation CONV-07)

Un message `Camille` sur `rec008-8f2b49-edit-01` (après P3). **Échec métier** : le tour a été classé comme `GET_SERVICES` au lieu de poursuivre la collecte. Contexte de création effacé. **Aucune tentative, aucun CLAIM, aucun POST CreateAppointment.**

Verdict : **FAIL**  
GO/NO-GO 8F-2B49-P5 : **NO-GO** (session cible hors parcours `ASK_EMAIL`)

Artefacts : `n8n/proposed/2026-11-01-rec008-phase8f2b49-P4-FIRSTNAME-COLLECTION/`  
(`PREFLIGHT.json`, `RESULT.json`, `response.txt`, `run.js`)

## 1. Préflight

Conforme. STOP non déclenché.

| Contrôle | Résultat |
| --- | --- |
| Workflow | inactif ; VC **8** ; 134/137 ; SHA Finaliser OK |
| PG | `1\|11\|4\|0` ; ouvertes 0 ; ABD1 / CONF2 / EXP1 |
| Mock | `created` ; POST **1** ; GET availability **3** |
| LIVE / Mailpit | `a2dea067…` ; 5 / 2 / 98 304 |

Session avant message :

| Champ | Valeur |
| --- | --- |
| Intent / pending / step | `CREATE_APPOINTMENT` / `CREATE_APPOINTMENT` / **`ASK_PRENOM`** |
| Nom | `Dupont` (prénom/e-mail/téléphone absents) |
| Service / site / dates | PASSEPORT / PARIS / `2026-11-03` |
| `slot_id` / index | `33333333-…` / 1 |
| Tentatives liées | 0 |

## 2. Connectivité

`http://127.0.0.1:5682` : TCP OK ; `/healthz` **200** ; `/healthz/readiness` **200**.

## 3. Message unique

Activation 200 ; webhooks chat OK ; warmup GET **200**.

Exactement un POST : `chatInput=Camille`, `sessionId=rec008-8f2b49-edit-01`. **Aucun retry.**

## 4. Réponse HTTP

| Mesure | Valeur |
| --- | --- |
| HTTP | **200** |
| Durée | **70 297 ms** |
| `type` attendu | `create_appointment_question` / `ASK_EMAIL` |
| `type` observé | **`services`** |
| Transport | aucune erreur |

Texte : liste des services consulaires (PASSEPORT, VISA, …) — pas de demande d’e-mail.

## 5. Prénom mémorisé

**Non.** `prenom` vide après le tour. `nom` Dupont **perdu**.

## 6. Transition conversationnelle

Attendue : `ASK_PRENOM` → `ASK_EMAIL`.  
Observée : bascule vers intention **`GET_SERVICES`** ; `conversation_step` / `pending_action` vidés.

## 7. Contexte conservé

**Non.** Service, site, dates, `slot_id`, `available_slots` et identité **effacés**. `last_user_message=Camille`.

## 8. Contrôles anti-réservation

| Contrôle | Résultat |
| --- | --- |
| Tentatives session | **0** |
| CLAIM | **0** |
| POST CreateAppointment | Δ **0** (reste 1) |
| GET availability | Δ **0** (reste 3) |
| GET /services | Δ **+1** (effet du mauvais routage) |
| Cancel / reschedule | absents |
| Ouvertes / RDV / notifications | inchangés (`1\|11\|4\|0`) |

## 9. Compteurs PostgreSQL / mock

| Domaine | Avant | Après |
| --- | --- | --- |
| PG | `1\|11\|4\|0` | `1\|11\|4\|0` |
| Mock POST | 1 | 1 |
| Mock GET availability | 3 | 3 |
| Mock GET /services | 0 | **1** |
| Scénario | `created` | `created` |

## 10. Désactivation

Immédiate : `active=false`, `activeVersionId=null`, webhooks **0**, VC **8**, graphe et SHA Finaliser inchangés.

## 11. Intégrité LIVE / Mailpit

LIVE `13|14|12|48|0|a2dea067…` inchangé. Mailpit 5 / 2 / 98 304 inchangé. Tentatives historiques / RDV TEST / autres sessions (empreinte hors cible) inchangés.

## 12. Verdict

**FAIL**

Cause : classification d’intention erronée du message `Camille` (parcours services) au lieu de la collecte progressive en `ASK_PRENOM`, avec purge du brouillon de création. Les garde-fous anti-réservation ont tenu (0 CLAIM / 0 POST).

## 13. GO/NO-GO

**NO-GO** pour **8F-2B49-P5** sur l’état actuel de `rec008-8f2b49-edit-01` (plus en `ASK_EMAIL`, contexte perdu).

Toute reprise du scénario CONV-07 (nouvelle session ou reconstruction contrôlée jusqu’au récapitulatif) exige une **autorisation distincte**. Aucun nouveau message envoyé ici.

Restrictions respectées (un seul message, pas de retry, pas de PUT/SQL/mock/LIVE). Arrêt ici.
