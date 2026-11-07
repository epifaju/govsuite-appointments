# REC-008 phase 8F-2B25 — Correctif binding PostgreSQL + revalidation runtime isolée

Candidat NON PUBLIÉ + exécution n8n réelle du nœud `Finaliser état création` dans un workflow éphémère TEST. Aucun PUT sur le workflow principal, aucune activation, aucun CLAIM, aucun POST CreateAppointment.

Verdict : **PASS**  
GO/NO-GO installation TEST : **GO** (autorisation distincte requise)

Artefacts : `n8n/proposed/2026-10-31-rec008-phase8f2b25-NON-PUBLIE/`  
(`candidate-OCD9It1uKFhOoWNF.json`, `PROPOSED_FIX_NON_PUBLIE.json`, `FINGERPRINTS.json`, `DIFF_FINALISER.txt`, `runtime/A1.json` … `A3.json`, `RESULT.json`)

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow principal `OCD9It1uKFhOoWNF` | inactif, `activeVersionId = null` |
| Version / VersionCounter | `32f405ee-424e-49af-8d4a-60598393849e` / **7** |
| Graphe | 134 nœuds / 137 connexions |
| Finaliser installé (SHA) | `dfeaf3a439ea362bdf40453d27e25631274bc20ae9eb8d8aecb823a8118a741d` |
| Autres workflows actifs | 0 |
| URL HTTP | 10, toutes `http://rec008-mock:8080/…` |
| Isolation réseau LIVE | intacte |
| PostgreSQL TEST | 1 RDV / 8 sessions / 2 tentatives (ABANDONED+CONFIRMED) / 0 ouverte / 0 notification |
| Session synthétique préalable | absente |
| Mock POST CreateAppointment | 1 |
| GovSuite LIVE | `13\|14\|12\|48\|0\|a2dea067599fd4f0a5f857551adc67cc` |
| Mailpit | Messages 5 / Unread 2 / DB 98304 |

Préflight **OK**.

## 2. Analyse des deux défauts (8F-2B24)

| Défaut | Cause | Effet observé en 8F-2B24 |
| --- | --- | --- |
| D1 | `queryReplacement` n8n **omet** les segments évalués à `''` | Token absent → `\|\| ''` → `$3` non lié → `there is no parameter $3` |
| D2 | `token = NULLIF($3::text, '')` reste typé **text** | Token présent → `$3` lié mais `column "token" is of type uuid but expression is of type text` |

Correctif candidat :

1. Sentinelle non vide `__ABSENT__` dans `queryReplacement` (jamais de segment vide).
2. SQL : `token = NULLIF(NULLIF($3::text, ''), '__ABSENT__')::uuid`.

## 3. Vérification du schéma PostgreSQL (lecture seule)

| Colonne | Type (udt) | Nullable |
| --- | --- | --- |
| `session_id` | varchar | NO |
| `reference` | varchar | YES |
| `token` | **uuid** | YES |

Contraintes relevées : PK (`id`), UNIQUE (`session_id`). Aucun CHECK bloquant sur `token`/`reference` au-delà du typage UUID. Aucune modification de table/fonction.

Le cast final `::uuid` est **requis** pour l’affectation ; `NULLIF` sur text avant cast est compatible avec `token` nullable.

## 4. Correctif candidat

**queryReplacement :**

```text
={{ $('Lorsqu\'un message de chat est reçu').item.json.sessionId }},{{ $('Paramètres clôture confirmation').item.json.appointmentReference || '' }},{{ (($('Paramètres clôture confirmation').item.json.appointment || {}).token_gestion || ($('Paramètres clôture confirmation').item.json.appointment || {}).token || '__ABSENT__') }}
```

**Ligne SQL token :**

```sql
token = NULLIF(NULLIF($3::text, ''), '__ABSENT__')::uuid,
```

`reference = NULLIF($2::text, '')` inchangé. `$1` = `sessionId`.

Comportement :

| Cas | `$3` lié | Valeur SQL résultante |
| --- | --- | --- |
| Token absent | `__ABSENT__` | `NULL` |
| Token UUID | UUID texte | UUID typé |
| Token non UUID | chaîne invalide | rejet PostgreSQL (cast) |

## 5. Diff exact

Voir `DIFF_FINALISER.txt`. Seul le nœud `Finaliser état création` change (query + queryReplacement). Connexions, credentials, URL mock, Chat Trigger, CLAIM/POST, fonctions REC-008 : inchangés.

## 6. Empreintes SHA-256

| Artefact | SHA-256 |
| --- | --- |
| Source LIVE (export JSON) | `2df97627118c840d59d8b3b9b97226106df082382b02b6c3c973d761142f8fb8` |
| Candidat NON PUBLIÉ | `b1fcf780ba1dfc06cb432c19a9cc25b8d658171b831256035974130cf4f7b293` |
| Finaliser avant (installé) | `dfeaf3a439ea362bdf40453d27e25631274bc20ae9eb8d8aecb823a8118a741d` |
| Finaliser après (candidat) | `3fc500bfed99c202156005d252a864cdc25514c93e7e47c842ae896381e8ee7a` |

`published: false`, `putOnMain: false`.

## 7. Mécanisme d’exécution isolée

Réutilisation de la méthode 8F-2B24 :

| Élément | Détail |
| --- | --- |
| Workflow | Éphémère **inactif** `REC008-8F2B25-FINALISER-RUNTIME-EPHEMERAL` |
| Graphe | Manual Trigger → Code (`Lorsqu'un message de chat est reçu`) → Code (`Paramètres clôture confirmation`) → Postgres (`Finaliser état création`) |
| SQL / credential | **copie exacte du candidat** + credential TEST `Fs0l0058q5CEadRw` |
| Exécution | `POST /rest/workflows/{id}/run` (`ManualRunDto`, destination Finaliser inclusive) |
| Principal | **aucun PUT**, non activé |
| Preuve | Pas une simulation JS/psql seule : nœud Postgres n8n exécuté réellement |

Exécutions : A1=`29`, A2=`30`, A3=`31`. Workflows éphémères archivés puis supprimés après chaque scénario.

## 8. Résultat A1 — Token absent

| Attendu | Observé |
| --- | --- |
| `$1/$2/$3` liés, `$3='__ABSENT__'` | oui |
| Exécution PG succès | **success** |
| `token IS NULL` | oui |
| Référence `REC008-RUNTIME-NULL-003` | enregistrée |
| État conversationnel nettoyé | intent/step/pending/identité vidés |
| CLAIM / POST | absents |

## 9. Résultat A2 — Token UUID présent

Après reset contrôlé de la session synthétique.

| Attendu | Observé |
| --- | --- |
| Trois paramètres liés | oui |
| Typage UUID | **aucun** `uuid but expression is of type text` |
| Token conservé | `22222222-2222-4222-8222-222222222222` |
| Référence `REC008-RUNTIME-TOKEN-004` | enregistrée |
| État nettoyé | oui |
| CLAIM / POST | absents |

## 10. Résultat A3 — Token invalide

Valeur synthétique `NOT-A-UUID-TOKEN` (non inventée comme confirmation métier).

| Attendu | Observé |
| --- | --- |
| Rejet contrôlé | exécution `error`, détection `invalid input syntax for type uuid` |
| Aucun token invalide persisté | session inchangée (`AWAIT_CREATE_CONFIRMATION`, token NULL, référence vide) |
| Historique / CLAIM / POST | inchangés / absents |

**Recommandation résiduelle** : valider le format UUID en amont (`Paramètres clôture confirmation` ou filtre) pour éviter une erreur Postgres brute en production. **Non corrigé dans cette phase** (hors périmètre ; pas de PUT principal).

## 11. Paramètres réellement liés

| Scénario | `$1` | `$2` | `$3` |
| --- | --- | --- | --- |
| A1 | `rec008-8f2b25-runtime-01` | `REC008-RUNTIME-NULL-003` | `__ABSENT__` |
| A2 | idem | `REC008-RUNTIME-TOKEN-004` | `22222222-2222-4222-8222-222222222222` |
| A3 | idem | `REC008-RUNTIME-INVALID-005` | `NOT-A-UUID-TOKEN` (rejeté au cast) |

Plus d’omission de `$3` (D1 corrigé). Plus d’incompatibilité text/uuid (D2 corrigé).

## 12. État PostgreSQL après chaque scénario

| Après | Compteurs (RDV\|sessions\|attempts\|notif) | Session synthétique | Historique 8 sessions / 2 tentatives |
| --- | --- | --- | --- |
| A1 | `1\|9\|2\|0` | ref NULL→`REC008-RUNTIME-NULL-003`, token NULL, état nettoyé | empreinte `bc130f1e…` inchangée |
| A2 | `1\|9\|2\|0` | ref `…TOKEN-004`, token UUID, état nettoyé | inchangé |
| A3 | `1\|9\|2\|0` | **inchangée** (reset pré-A3) | inchangé |

Tentatives : CONFIRMED `REC008-MOCK-0001` / ABANDONED inchangées. RDV fictif : 1. Notifications : 0.

## 13. Contrôle d’absence de CLAIM et POST

- Mock POST CreateAppointment : **toujours 1** après A1/A2/A3/postflight.
- Aucune nouvelle tentative, aucun CLAIM, aucun POST métier.
- Aucun message conversationnel / Chat Trigger.

## 14. Nettoyage

- `DELETE FROM ai_conversation_state WHERE session_id = 'rec008-8f2b25-runtime-01'` uniquement → remaining `0`.
- Workflows éphémères 8F-2B25 archivés/supprimés.
- Aucune session historique ni workflow principal touché.
- Compteurs PG revenus à `1|8|2|0`.

## 15. Postflight

| Contrôle | Résultat |
| --- | --- |
| Principal inactif / `activeVersionId` | oui / `null` |
| VersionCounter / versionId | **7** / `32f405ee-…` **inchangés** |
| Graphe | 134 / 137 |
| Finaliser principal | SHA installé `dfeaf3a4…` **inchangé** (candidat non installé) |
| PG TEST | `1\|8\|2\|0` |
| Mock POST | 1 |
| LIVE | empreinte inchangée |
| Mailpit | inchangé |

## 16. Risques résiduels

1. **Token non UUID** : rejet Postgres (A3) — UX erreur possible ; validation amont recommandée avant install LIVE.
2. **`$2` référence vide** : toujours `\|\| ''` — si un jour la référence est vide, même risque d’omission de segment ; hors scénarios métier actuels (référence toujours présente à la finalisation).
3. **Sentinelle `__ABSENT__`** : ne doit jamais être un UUID réel ni contenir de virgule (césure `queryReplacement`).
4. Installation sur le workflow principal **non effectuée** : le correctif n’est actif que dans le candidat NON PUBLIÉ.

## 17. Verdict

**PASS**

- D1 (omission `$3`) corrigé et prouvé en runtime n8n réel.
- D2 (text vs uuid) corrigé et prouvé.
- A3 documenté (rejet contrôlé, pas de persistance).
- Isolation / intégrité / nettoyage / postflight OK.
- Workflow principal **non modifié**.

## 18. GO/NO-GO installation TEST

**GO** pour une phase d’installation TEST **distinctement autorisée** (PUT contrôlé du seul nœud Finaliser, VersionCounter attendu 8, sans activation chatbot tant que non demandé).

Arrêt ici — attendre autorisation distincte avant toute installation sur `OCD9It1uKFhOoWNF`.
