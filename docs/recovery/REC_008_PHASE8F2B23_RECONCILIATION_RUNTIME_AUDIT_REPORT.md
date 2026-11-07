# REC-008 phase 8F-2B23 — Audit hors ligne de réconciliation et préparation runtime

Audit strictement hors ligne après installation 8F-2B22. Session `rec008-8f2b14-new-01` incohérente (tentative `CONFIRMED`, conversation encore en attente). Préparation de `RECONCILE_CONFIRMED_SESSION` et choix d’une validation runtime du binding `$3`. **Aucune exécution chatbot, PUT, SQL métier ni réconciliation.**

Verdict : **PASS**.

Artefacts : `n8n/proposed/2026-10-31-rec008-phase8f2b23-RECONCILIATION-RUNTIME-AUDIT/`  
(`PREFLIGHT.json`, `ROUTING.json`, `RISKS.json`, `METHODS.json`, `RECONCILE_CONFIRMED_SESSION.proposed.sql`, `OFFLINE_TESTS.json`, `POSTFLIGHT.json`, `RESULT.json`, snippets Décider / Lire / Joindre / Finaliser).

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow | inactif, `activeVersionId = null` |
| Version / compteur | `32f405ee-424e-49af-8d4a-60598393849e` / **7** |
| Graphe | 134 / 137 |
| Autres actifs | 0 |
| Credentials / URL / isolation | TEST / 10 mock / OK |
| Finaliser SHA | `dfeaf3a4…` (conforme 8F-2B22) |
| PostgreSQL TEST | 1 / 8 / 2 / 0 |
| Tentatives | 1 `ABANDONED` + 1 `CONFIRMED` ; 0 ouverte |
| Mock POST | **1** |
| GovSuite / Mailpit | empreinte `a2dea067…` ; 5 / 2 / 98 304 |

## 2. État session / tentative

| Entité | État |
| --- | --- |
| Session `rec008-8f2b14-new-01` | `AWAIT_CREATE_CONFIRMATION` ; `last_user_message = oui` ; `reference` vide ; identité encore présente |
| Tentative `ad71a155-…` | `CONFIRMED` ; réf. `REC008-MOCK-0001` ; clé/corps NULL ; sans lease |
| Tentative `8ae63b62-…` | `ABANDONED` (autre session) |

## 3. Audit du routage actuel

| Étape | Comportement |
| --- | --- |
| `Lire tentative de session` | Inclut `CONFIRMED` → retrouve la tentative |
| `Joindre tentative de session` | Pose `openAttempt` (id, status, reference, …) |
| `Parser` + étape `AWAIT_*` | `oui` → `AFFIRM` |
| `Décider action tentative` | `status === 'CONFIRMED' && decision === 'AFFIRM'` → **`RECALL`** (pas `CLAIM`) |
| `Aiguiller` | `RECALL` → `Réponse référence déjà connue` |
| Message | « déjà confirmé » + référence ; « ne crée pas un nouveau rendez-vous » |
| CreateAppointment | parents = uniquement `Corps figé présent ?` (CLAIM/RESUME) |

Message non-`AFFIRM` sur `CONFIRMED` → `COLLECT` → fallback Aiguiller → `Valider paramètres création` (`ready` = claim only) → **pas** de POST.

## 4. Risques d’un nouveau `oui`

| Risque | Évaluation |
| --- | --- |
| Retrouver CONFIRMED | oui |
| Redemander confirmation | non (`RECALL`) |
| Nouvelle tentative | non |
| Claim | non |
| POST CreateAppointment | non |
| Nettoyage session | **non** (`RECALL` n’écrit pas la session) |
| Token fictif | non |

Conclusion : un second `oui` est **métier-sûr** (pas de double création) mais **ne réconcilie pas** l’état conversationnel.

## 5. Stratégie de réconciliation

Opération proposée : **`RECONCILE_CONFIRMED_SESSION`** (SQL conditionnel, hors workflow chat).

Conditions :

- même `session_id` ;
- tentative `CONFIRMED` avec référence réelle attendue ;
- session encore en attente / sans référence conversationnelle ;
- **aucun** CLAIM / POST / token inventé ;
- **aucune** écriture sur `ai_appointment_attempt` (ni CONFIRMED ni ABANDONED).

Champs session : clear collecte + `pending_action` + `conversation_step` ; `reference = appointment_reference` ; `token = NULL`.

## 6. Proposition SQL (non exécutée)

Fichier : `RECONCILE_CONFIRMED_SESSION.proposed.sql`

Bindings : `$1` session, `$2` attempt id, `$3` référence attendue.  
`UPDATE … FROM confirmed WHERE … RETURNING` ; second passage → `sessions_updated = 0`.

## 7. Garanties d’idempotence

| Passage | Effet |
| --- | --- |
| 1er | session nettoyée ; `reference` posée |
| 2e | match CONFIRMED toujours vrai ; `sessions_updated = 0` si déjà finalisée |
| Tentatives | inchangées |

## 8. Méthodes de validation runtime `$3`

| | **A — session synthétique / SQL Finaliser isolé** | **B — parcours conversationnel neuf** |
| --- | --- | --- |
| Preuve binding réel | oui | oui |
| CLAIM / POST | non | oui (1 POST) |
| Double création | nulle | 1 création mock intentionnelle |
| Effet PG | session jetable seulement | nouvelle tentative + session |
| Rollback | facile | plus lourd |
| Sécurité | **maximale** | moindre |

## 9. Méthode recommandée

**A** — valider le binding PostgreSQL réel de `$3` (chaîne vide → `NULLIF` → `NULL`, token présent conservé) sur une **session synthétique**, sans CLAIM/POST et sans toucher `rec008-8f2b14-new-01`.

Méthode B : phase d’intégration ultérieure distincte.

## 10. Tests hors ligne T1–T20

Tous **PASS**. Simulation de portes de réconciliation + forme SQL Finaliser ; **pas** une preuve d’exécution PostgreSQL runtime.

| ID | Thème | Résultat |
| --- | --- | --- |
| T1–T9 | portes statut / session / idempotence | PASS |
| T10–T14 | pas CLAIM/POST/token/mutation tentatives | PASS |
| T15–T16 | `$3` lié ; token présent | PASS |
| T17–T19 | LIVE / credentials / graphe | PASS |
| T20 | base inchangée pendant l’audit | PASS |

## 11. Impacts et risques

| Point | Commentaire |
| --- | --- |
| Correctif workflow | **non indispensable** pour réconciliation ni pour `$3` (déjà installé) |
| Session incohérente | persiste jusqu’à phase autorisée |
| Confusion offline ≠ runtime | clairement séparée ; A doit exécuter le SQL sous autorisation |

## 12. Postflight

Identique au préflight : workflow inactif, compteur 7, POST = 1, PG/LIVE/Mailpit inchangés. Aucun PUT / activation / chat / reconcile.

## 13. Verdict

**PASS**

## 14. GO / NO-GO prochaine phase

| Suite | Décision |
| --- | --- |
| Exécuter `RECONCILE_CONFIRMED_SESSION` | **GO** sous autorisation distincte |
| Validation runtime `$3` méthode **A** | **GO** sous autorisation distincte |
| Nouveau `oui` sur la session incohérente | **NO-GO** (sauf mission explicite ; n’apporte pas la finalisation) |
| Parcours conversationnel complet (B) | **NO-GO** tant que A (+ reconcile si prioritaire) non autorisés |
| PUT / activation hors mission | **NO-GO** |

S’arrêter ici.
