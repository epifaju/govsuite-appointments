# REC-008 phase 8F-2B26 — Installation contrôlée du correctif Finaliser (runtime-validé 8F-2B25)

Un seul PUT sur le workflow TEST `OCD9It1uKFhOoWNF` : nœud `Finaliser état création` uniquement (sentinelle `__ABSENT__` + cast `::uuid`). **Pas d’activation, pas de chat, pas de POST métier, pas de réconciliation.**

Verdict : **PASS**  
GO/NO-GO réconciliation distincte : **GO**

Artefacts : `n8n/proposed/2026-10-31-rec008-phase8f2b26-FINALIZATION-FIX-INSTALL/`  
(`before-…json`, `after-…json`, `BACKUP.json`, `DIFF.json`, `update-body.json`, `put-response.json`, `RESULT.json`, `install.js`)

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow | inactif, `activeVersionId = null` |
| Version / compteur | `32f405ee-424e-49af-8d4a-60598393849e` / **7** |
| Graphe | 134 / 137 |
| Autres actifs | 0 |
| Credentials / URL / réseau | TEST (`Fs0l0058q5CEadRw`, Ollama `dxzHqBq8…`) / 10 mock / isolation OK |
| PostgreSQL TEST | 1 / 8 / 2 / 0 |
| Tentatives | 1 `ABANDONED` + 1 `CONFIRMED` ; 0 ouverte |
| Session `rec008-8f2b14-new-01` | `AWAIT_CREATE_CONFIRMATION` / `oui` / référence vide |
| Tentative confirmée | `REC008-MOCK-0001` ; clé/corps NULL ; sans lease |
| Mock POST | **1** |
| GovSuite / Mailpit | empreinte `a2dea067…` ; 5 / 2 / 98 304 |
| Finaliser avant | SHA `dfeaf3a4…` (install 8F-2B22) |

Préflight **OK**.

## 2. Empreintes source / candidat

| Artefact | SHA-256 | Attendu |
| --- | --- | --- |
| Export LIVE avant PUT | `2df97627118c840d59d8b3b9b97226106df082382b02b6c3c973d761142f8fb8` | conforme 8F-2B25 |
| Candidat 8F-2B25 | `b1fcf780ba1dfc06cb432c19a9cc25b8d658171b831256035974130cf4f7b293` | conforme |
| Finaliser avant | `dfeaf3a439ea362bdf40453d27e25631274bc20ae9eb8d8aecb823a8118a741d` | conforme |
| Finaliser après (candidat) | `3fc500bfed99c202156005d252a864cdc25514c93e7e47c842ae896381e8ee7a` | conforme |

## 3. Diff autorisé

Seul `Finaliser état création` (query + `queryReplacement`). Connexions, credentials, URL, Chat Trigger, settings, CLAIM/POST, fonctions REC-008 : inchangés.

| Zone | Avant → Après |
| --- | --- |
| `queryReplacement` `$3` | `\|\| ''` → `\|\| '__ABSENT__'` |
| SQL token | `NULLIF($3::text, '')` → `NULLIF(NULLIF($3::text, ''), '__ABSENT__')::uuid` |
| SQL reference | inchangé (`NULLIF($2::text, '')`) |

Payload PUT = export LIVE + paramètres Finaliser du candidat (nom workflow LIVE conservé).

## 4. Sauvegarde avant installation

| Élément | Valeur |
| --- | --- |
| Fichier | `before-OCD9It1uKFhOoWNF.json` |
| SHA-256 | `2df97627…` |
| Version / compteur | `32f405ee-…` / 7 |
| Finaliser | `dfeaf3a4…` |
| Rollback | documenté dans `BACKUP.json` (**non exécuté**) |

## 5. PUT unique

| Mesure | Valeur |
| --- | --- |
| Méthode | `PUT /api/v1/workflows/OCD9It1uKFhOoWNF` |
| HTTP | **200** |
| Retry PUT | **aucun** |
| Activation | non |

## 6. Version après installation

| Champ | Avant | Après |
| --- | --- | --- |
| `versionId` | `32f405ee-…` | **`e1b32992-bc68-46af-86ce-c80af46f5305`** |
| `versionCounter` | 7 | **8** |
| `active` | false | false |
| `activeVersionId` | null | null |

## 7. Empreinte du nœud installé

| Contrôle | Résultat |
| --- | --- |
| SHA Finaliser installé | `3fc500bfed99c202156005d252a864cdc25514c93e7e47c842ae896381e8ee7a` |
| Sentinelle `__ABSENT__` dans `queryReplacement` | présente |
| Cast `::uuid` après double NULLIF | présent |
| Conformité candidat | oui |

## 8. Comparaison avant / après

| Contrôle | Résultat |
| --- | --- |
| Nœuds / connexions | 134 / 137 |
| `parameterDiffs` | **[`Finaliser état création`]** uniquement |
| `credentialDiffs` | [] |
| Connections / settings | inchangés |
| Export after SHA-256 | `b08556caec837f9b095ab4707d530e21ea549aa5a4549e4224fe9919ff3f35ea` |

## 9. Credentials et URL

| Contrôle | Résultat |
| --- | --- |
| Postgres | `Fs0l0058q5CEadRw` uniquement |
| Ollama | `dxzHqBq8Q60R8BOz` |
| URL HTTP | 10, toutes `http://rec008-mock:8080/…` |
| Chat Trigger webhookId | `a91c4e70-6b18-4f0d-9c55-2e7d8a14b603` inchangé |

## 10. Inactivité

Workflow principal inactif ; `activeVersionId = null` ; 0 autre workflow actif ; 0 ligne webhook active.

## 11. Compteurs PostgreSQL TEST

`1|8|2|0` inchangés. Session `rec008-8f2b14-new-01` inchangée. Tentatives CONFIRMED / ABANDONED inchangées.

## 12. Compteurs mock

POST CreateAppointment historique : **1** (inchangé).

## 13. Intégrité LIVE et Mailpit

GovSuite LIVE : `13|14|12|48|0|a2dea067599fd4f0a5f857551adc67cc` inchangé.  
Mailpit : 5 / 2 / 98304 inchangé.

## 14. Risques résiduels

1. Token non UUID : rejet Postgres possible (documenté en 8F-2B25 A3) — validation amont toujours recommandée.
2. `$2` référence vide : coercion `\|\| ''` inchangée (hors scénario métier actuel).
3. Correctif installé mais **non exercé** sur le chemin conversationnel principal (aucune activation / chat / réconciliation dans cette phase).
4. Session historique `rec008-8f2b14-new-01` toujours en `AWAIT_CREATE_CONFIRMATION` — réconciliation distincte requise.

## 15. Verdict

**PASS**

- Un seul PUT HTTP 200.
- VersionCounter **8**, nouvelle version `e1b32992-…`.
- Finaliser SHA conforme au candidat runtime-validé 8F-2B25.
- Isolation / postflight OK.
- Aucune activation, CLAIM, POST, ni réconciliation.

## 16. GO/NO-GO réconciliation

**GO** pour une réconciliation de session **distinctement autorisée** (sans second PUT Finaliser ; sans activation tant que non demandée).

Arrêt ici — attendre autorisation distincte.
