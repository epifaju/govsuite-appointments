# REC-008 phase 8F-2B22 — Installation contrôlée du correctif de finalisation

Un seul PUT sur le workflow TEST `OCD9It1uKFhOoWNF` : nœud `Finaliser état création` uniquement (binding `$3` / token facultatif). **Pas d’activation, pas de chat, pas de POST métier, pas de réconciliation.**

Verdict : **PASS**.

Artefacts : `n8n/proposed/2026-10-31-rec008-phase8f2b22-FINALIZATION-FIX-INSTALL/`  
(`before-…json`, `after-…json`, `BACKUP.json`, `DIFF.json`, `update-body.json`, `put-response.json`, `RESULT.json`, `install.js`).

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow | inactif, `activeVersionId = null` |
| Version / compteur | `e84ee0d2-7af9-417e-8d47-0a28580dccac` / **6** |
| Graphe | 134 / 137 |
| Autres actifs | 0 |
| Credentials / URL / réseau | TEST / 10 mock / isolation OK |
| PostgreSQL TEST | 1 / 8 / 2 / 0 |
| Tentatives | 1 `ABANDONED` + 1 `CONFIRMED` ; 0 ouverte |
| Session `rec008-8f2b14-new-01` | `AWAIT_CREATE_CONFIRMATION` / `oui` / référence vide |
| Tentative confirmée | `REC008-MOCK-0001` ; clé/corps NULL ; sans lease |
| Mock POST | **1** |
| GovSuite / Mailpit | empreinte `a2dea067…` ; 5 / 2 / 98 304 |
| Finaliser avant | SHA `27b731be…` (conforme 8F-2B21) |

## 2. Vérification du candidat

| Contrôle | Résultat |
| --- | --- |
| SHA candidat | `2263c4bbe906129e89b8ac6b860299d523042c455897c5f7f8426dabcde43c72` |
| SHA Finaliser candidat | `dfeaf3a439ea362bdf40453d27e25631274bc20ae9eb8d8aecb823a8118a741d` |
| Diff autorisé live ↔ candidat | **uniquement** `Finaliser état création` (query + `queryReplacement`) |
| Connexions / credentials / URL / Chat Trigger / CLAIM / POST / clôture | inchangés |
| Payload PUT | export LIVE + paramètres Finaliser du candidat (nom workflow LIVE conservé) |

## 3. Empreintes avant installation

| Élément | Valeur |
| --- | --- |
| Export before SHA-256 | `cbb56243bf997dbda3c97c1418593297d2a6858fb17c07132a456b564b526ba1` |
| Version ID | `e84ee0d2-…` |
| VersionCounter | 6 |
| Finaliser | `27b731be…` |

## 4. Diff exact

| Zone | Avant → Après |
| --- | --- |
| `queryReplacement` | `token_gestion \|\| token` → `(appointment\|\|{}).token_gestion \|\| … \|\| ''` + `appointmentReference \|\| ''` |
| SQL | `reference = $2, token = $3` → `NULLIF($2::text,'')` / `NULLIF($3::text,'')` |

Voir aussi `DIFF.json` et le diff 8F-2B21.

## 5. Sauvegarde

| Élément | Valeur |
| --- | --- |
| Fichier | `before-OCD9It1uKFhOoWNF.json` |
| SHA-256 | `cbb56243…` |
| Métadonnées | `BACKUP.json` (procédure de retour arrière **non exécutée**) |

## 6. PUT unique

| Mesure | Valeur |
| --- | --- |
| Méthode | `PUT /api/v1/workflows/OCD9It1uKFhOoWNF` |
| HTTP | **200** |
| Retry PUT | **aucun** |
| Activation | non |

## 7. Version après installation

| Champ | Avant | Après |
| --- | --- | --- |
| `versionId` | `e84ee0d2-…` | **`32f405ee-424e-49af-8d4a-60598393849e`** |
| `versionCounter` | 6 | **7** |
| `active` | false | false |
| `activeVersionId` | null | null |

## 8. Comparaison de l’export installé

| Contrôle | Résultat |
| --- | --- |
| Nœuds / connexions | 134 / 137 |
| `parameterDiffs` | **[`Finaliser état création`]** uniquement |
| `credentialDiffs` | [] |
| Connections / settings | inchangés |
| Export after SHA-256 | `2df97627118c840d59d8b3b9b97226106df082382b02b6c3c973d761142f8fb8` |

## 9. Nœud corrigé

| Contrôle | Résultat |
| --- | --- |
| SHA Finaliser installé | `dfeaf3a439ea362bdf40453d27e25631274bc20ae9eb8d8aecb823a8118a741d` |
| `NULLIF($3::text, '')` | présent |
| Coercion `\|\| ''` dans `queryReplacement` | présente |
| Conformité candidat | oui |

## 10. Credentials et URL

| Contrôle | Résultat |
| --- | --- |
| PostgreSQL | `Fs0l0058q5CEadRw` |
| Ollama | `dxzHqBq8Q60R8BOz` |
| URL | 10 × `http://rec008-mock:8080/…` |
| Chat Trigger | public ; webhook `a91c4e70-…` |

## 11. Inactivité

| Contrôle | Résultat |
| --- | --- |
| Workflow actif | non |
| Webhooks actifs | **0** |
| Autres workflows actifs | 0 |

## 12. Compteurs PostgreSQL TEST

`1|8|2|0` — session et tentative CONFIRMED **inchangées** (aucune réconciliation).

## 13. Compteurs mock

POST CreateAppointment = **1** (aucun nouveau POST).

## 14. Intégrité GovSuite LIVE et Mailpit

| Contrôle | Résultat |
| --- | --- |
| GovSuite | 13 / 14 / 12 / 48 / 0 / `a2dea067599fd4f0a5f857551adc67cc` |
| Mailpit | 5 / 2 / 98 304 |
| E-mail | aucun |

## 15. Risques résiduels

| Risque | Commentaire |
| --- | --- |
| Runtime non validé | le binding `$3` n’a pas été exercé par une exécution réelle |
| Session incohérente | toujours `AWAIT_CREATE_CONFIRMATION` malgré tentative `CONFIRMED` |
| Validation chatbot | réservée à une phase distincte |

## 16. Verdict

**PASS**

## 17. GO / NO-GO runtime

**GO** pour une **validation runtime distinctement autorisée** (activation temporaire + scénario contrôlé / réconciliation, selon mission ultérieure).

S’arrêter ici.
