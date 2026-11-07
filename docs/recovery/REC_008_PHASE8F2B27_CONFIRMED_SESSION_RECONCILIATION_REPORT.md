# REC-008 phase 8F-2B27 — Réconciliation contrôlée d’une session déjà confirmée

Mise à jour SQL conditionnelle exclusive de `ai_conversation_state` pour `rec008-8f2b14-new-01` (tentative déjà `CONFIRMED`). Aucun PUT n8n, activation, chat, CLAIM ni POST CreateAppointment.

Verdict : **PASS**  
GO/NO-GO nouvelle session conversationnelle TEST : **GO**

Artefacts : `n8n/proposed/2026-10-31-rec008-phase8f2b27-CONFIRMED-SESSION-RECONCILIATION/`  
(`PREFLIGHT.json`, `SQL_AUDIT.json`, `BACKUP.json`, `PASS1.json`, `PASS2.json`, `POSTFLIGHT.json`, `RESULT.json`, SQL exécuté)

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow `OCD9It1uKFhOoWNF` | inactif, `activeVersionId = null` |
| Version / compteur | `e1b32992-bc68-46af-86ce-c80af46f5305` / **8** |
| Graphe | 134 / 137 |
| Finaliser SHA | `3fc500bf…` (install 8F-2B26) |
| Autres actifs / credentials / URL / isolation | 0 / TEST / 10 mock / OK |
| PostgreSQL TEST | 1 / 8 / 2 / 0 ; ABANDONED+CONFIRMED ; 0 ouverte |
| Mock POST | **1** |
| LIVE / Mailpit | `a2dea067…` ; 5 / 2 / 98 304 |

## 2. Identité exacte (lue dans PostgreSQL TEST)

| Entité | Identifiant complet |
| --- | --- |
| Session | `rec008-8f2b14-new-01` |
| Tentative CONFIRMED | `ad71a155-4d3a-45b9-8445-2ec98377feaa` |
| Référence | `REC008-MOCK-0001` |
| Tentative ABANDONED (autre session) | `8ae63b62-9f87-4a15-9011-4554b7766918` (`rec008-8f2b4-slot-01`) |

## 3. Vérification statut CONFIRMED

| Contrôle | Résultat |
| --- | --- |
| Appartenance session cible | oui |
| Statut | `CONFIRMED` |
| Référence | `REC008-MOCK-0001` |
| Clé d’idempotence / corps figé | déjà NULL |
| Lease (`lease_owner` / `lease_until`) | NULL |
| Session avant | `AWAIT_CREATE_CONFIRMATION` ; `pending_action=CREATE_APPOINTMENT` ; `reference` vide |

## 4. Audit du SQL proposé (8F-2B23)

Fichier source : `RECONCILE_CONFIRMED_SESSION.proposed.sql` (SHA `b574d34e…`).

| Point | Conforme |
| --- | --- |
| Colonnes `ai_conversation_state` (collecte, step, pending, reference, token uuid) | oui |
| Jointure session/tentative via CTE `confirmed` | oui |
| Filtres `status='CONFIRMED'` + référence exacte `$3` | oui |
| UPDATE conditionnel (AWAIT / pending CREATE / référence vide) + `RETURNING` | oui |
| Aucune écriture `ai_appointment_attempt` | oui |
| `token = NULL` (jamais inventé) | oui |

Bindings exécutés : `$1=rec008-8f2b14-new-01`, `$2=ad71a155-…`, `$3=REC008-MOCK-0001` (valeurs lues en base, pas déduites d’abréviations).

## 5. Sauvegarde ciblée

`BACKUP.json` : ligne session complète (SHA `aa4e919e…`), tentative CONFIRMED, tentative ABANDONED, empreintes des autres sessions / tentatives / RDV. Procédure de retour arrière documentée, **non exécutée**.

## 6. Conditions de sécurité de l’UPDATE

- Cible unique : `session_id` + `attempt id` + référence attendue.
- Mutation uniquement si l’état conversationnel est encore « ouvert » (step / pending / référence vide).
- Atomique via CTE + `RETURNING` ; comptage `sessions_updated`.
- Tentatives hors scope d’écriture.

## 7. Résultat du premier passage

| Mesure | Valeur |
| --- | --- |
| `confirmed_matched` | **1** |
| `sessions_updated` | **1** |
| `reference_set` | `REC008-MOCK-0001` |
| `step_after` | NULL |
| Token | NULL |
| Collecte / pending / intent | nettoyés |

## 8. Résultat du second passage

| Mesure | Valeur |
| --- | --- |
| `confirmed_matched` | **1** |
| `sessions_updated` | **0** |
| Retry automatique | aucun |

## 9. Preuve d’idempotence

Après finalisation, les portes OR (`AWAIT_CREATE_CONFIRMATION` / `CREATE_APPOINTMENT` / référence vide) sont toutes fausses → second passage no-op. Timestamps session et lignes tentative inchangés entre PASS1 et PASS2. Exactement **deux** exécutions SQL métier (pas de troisième).

## 10. État final de la session

| Champ | Valeur |
| --- | --- |
| `reference` | `REC008-MOCK-0001` |
| `token` | NULL |
| `conversation_step` | NULL |
| `pending_action` | NULL |
| `intent` / `service` / `nom` | NULL |
| `last_user_message` | `oui` (historique conservé) |

## 11. Intégrité des tentatives

CONFIRMED et ABANDONED : JSON lignes **identiques** au backup. Empreinte globale des tentatives inchangée. 0 tentative ouverte.

## 12. Compteurs PostgreSQL

`1|8|2|0` inchangés. Autres sessions et rendez-vous fictif : empreintes inchangées. Notifications : 0.

## 13. Compteurs mock

POST CreateAppointment : **1** (aucun nouveau POST).

## 14. LIVE et Mailpit

GovSuite LIVE : `13|14|12|48|0|a2dea067599fd4f0a5f857551adc67cc`.  
Mailpit : 5 / 2 / 98304.

## 15. Postflight

Workflow inactif ; version `e1b32992-…` / compteur **8** ; graphe 134/137 ; Finaliser SHA inchangé ; 0 autre actif. (Postflight n8n finalisé après une panne transitoire `fetch` ; **aucune** troisième écriture SQL.)

## 16. Verdict

**PASS**

## 17. GO/NO-GO

**GO** pour reprendre les tests conversationnels sur une **nouvelle** session TEST (activation / chat uniquement sous autorisation distincte).

Arrêt ici — attendre autorisation distincte.
