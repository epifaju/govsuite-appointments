# REC-008 phase 8F-2B21 — Correction hors ligne de la finalisation après confirmation

Analyse et correctif **non publié** du nœud `Finaliser état création` après l’échec conversationnel 8F-2B20 (`there is no parameter $3`). Chemin métier CLAIM→POST→CONFIRMED inchangé. **Aucun PUT, activation, chat, POST métier, SQL ni mock.**

Verdict : **PASS** (candidat hors ligne + T1–T20).

Artefacts : `n8n/proposed/2026-10-31-rec008-phase8f2b21-NON-PUBLIE/`  
(`candidate-OCD9It1uKFhOoWNF.json`, `AUDIT.json`, `OFFLINE_TESTS.json`, `FINGERPRINTS.json`, `DIFF_FINALISER.txt`, `PREFLIGHT.json`, `POSTFLIGHT.json`, `RESULT.json`).

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow | inactif, `activeVersionId = null` |
| Version / compteur | `e84ee0d2-…` / **6** |
| Graphe | 134 / 137 |
| Autres actifs | 0 |
| Credentials / URL | `Fs0l0058q5CEadRw` / 10× mock |
| Mock POST CreateAppointment | **1** (inchangé depuis 8F-2B20) |
| PostgreSQL TEST | 1 / 8 / 2 / 0 |
| Tentatives | 1 `ABANDONED` + 1 `CONFIRMED` ; 0 ouverte |
| Session `rec008-8f2b14-new-01` | `AWAIT_CREATE_CONFIRMATION` / `oui` / référence vide |
| Tentative `ad71a155-…` | `CONFIRMED` / `REC008-MOCK-0001` / clé·corps purgés / sans lease |
| GovSuite / Mailpit | empreinte LIVE + Mailpit inchangés |

Aucune donnée modifiée.

## 2. Cause racine

| Élément | Détail |
| --- | --- |
| Nœud | `Finaliser état création` (PostgreSQL) |
| Expression `$3` | `appointment.token_gestion \|\| appointment.token` |
| Cas 8F-2B20 | mock : référence présente, **aucun** `token` / `token_gestion` |
| Évaluation | expression → `undefined` / falsy |
| Binding n8n | le 3ᵉ segment de `queryReplacement` est **omis** |
| PostgreSQL | requête utilise `$3` → **`there is no parameter $3`** |
| Ordre | `Clôturer confirmation` a déjà passé la tentative en `CONFIRMED` **avant** cet échec |

`$1` (session) et `$2` (référence) étaient liés ; seul `$3` manquait. Une valeur absente **n’est pas** convertie automatiquement en SQL `NULL`.

### Chaîne auditée

| Nœud | Entrée | Sortie / rôle | Token absent |
| --- | --- | --- | --- |
| `Appeler CreateAppointment` | `frozenBody` | HTTP mock | n/a |
| `Classer réponse HTTP` | status/body | `CONFIRMED` si 201 (ou 200 replayed) ; forward `appointment` | token non exigé |
| `Clôturer confirmation` | id/session/lease/réf | `cloturer_…('CONFIRMED',…)` | token non utilisé ; réf obligatoire |
| `Préparer réponse création` | appointment | texte succès ; token via `valueOrNull` | « Non disponible » |
| `Finaliser état création` | `$1,$2,$3` | clear session + `reference`/`token` | **échec binding `$3`** |

## 3. Contrat mock CreateAppointment

Objet mock (scénario `created`) :

- Fournit `id`, `reference` (`REC008-MOCK-0001`), créneau, identité.
- **Ne fournit pas** `token` ni `token_gestion`.

Alignement workflow :

- `Clôturer confirmation` exige référence + `appointment_id`, pas de token.
- `Préparer réponse création` traite déjà le token comme **facultatif**.

**Conclusion contractuelle :** le token de gestion est **facultatif** pour finaliser après confirmation réussie. Stratégie retenue : lier `$3` toujours ; persister le token seulement s’il est non vide ; sinon SQL `NULL` ; **ne jamais** inventer de token ; **ne pas** modifier le mock.

## 4. Analyse des paramètres SQL

Avant :

```text
reference = $2,
token = $3,
queryReplacement: sessionId, appointmentReference, token_gestion || token
```

Si le 3ᵉ segment est absent → moins de 3 paramètres liés → erreur `$3`.

Après (candidat) :

```text
reference = NULLIF($2::text, ''),
token = NULLIF($3::text, ''),
queryReplacement: sessionId, appointmentReference || '', (appointment||{}).token_gestion || (appointment||{}).token || ''
```

Les trois segments sont toujours des chaînes ; `''` → `NULL` via `NULLIF`. Pas d’exécution PostgreSQL réelle dans cette phase (construction de paramètres seulement).

## 5. Correctif proposé

| Portée | Valeur |
| --- | --- |
| Nœuds modifiés | **uniquement** `Finaliser état création` |
| Graphe / credentials / URL / CLAIM / SQL REC-008 / mock | **inchangés** |
| Publication | **NON PUBLIÉ** (pas de PUT) |

## 6. Diff exact

Voir `DIFF_FINALISER.txt`.

- `queryReplacement` : coercion `|| ''` + garde `(appointment \|\| {})`.
- SQL : `NULLIF($2::text, '')` / `NULLIF($3::text, '')`.

## 7. Tests hors ligne (T1–T20)

Tous **PASS**. Aucun HTTP métier, aucune écriture PostgreSQL.

| ID | Résultat |
| --- | --- |
| T1 201 + réf + token | PASS |
| T2 201 + réf sans token (régression legacy vs fix) | PASS |
| T3 200 REPLAYED sans token | PASS |
| T4 / T5 token / token_gestion NULL | PASS |
| T6 token_gestion contractuel | PASS |
| T7 référence absente | PASS |
| T8 corps malformé → UNCERTAIN | PASS |
| T9 déjà CONFIRMED → pas CLAIM/POST | PASS |
| T10 UNCERTAIN ≠ succès | PASS |
| T11 ABANDONED | PASS |
| T12 pas de régénération de clé | PASS |
| T13 pas de POST | PASS |
| T14 pas de fuite clé / token fictif | PASS |
| T15 `$3` toujours lié | PASS |
| T16 nettoyage session (forme SQL) | PASS |
| T17 conservation référence | PASS |
| T18 ABANDONED hors Finaliser | PASS |
| T19 graphe/credentials/chat trigger | PASS |
| T20 pas d’accès LIVE | PASS |

Les tests séparent **construction des paramètres** et **exécution PostgreSQL réelle** (non prétendue ici).

## 8. Stratégie de récupération (non exécutée)

Session `rec008-8f2b14-new-01` : tentative `CONFIRMED` + étape encore `AWAIT_CREATE_CONFIRMATION`.

Plan idempotent proposé (phase ultérieure autorisée) :

1. Lire session + tentative `CONFIRMED` (réf réelle).
2. Branche `RECONCILE_CONFIRMED_SESSION` si étape d’attente encore active.
3. **Jamais** CLAIM / POST / nouvelle clé / token fictif.
4. `UPDATE` session : clear collecte/pending/step ; `reference = appointment_reference` ; `token = NULL` (non stocké sur la tentative).
5. Message : déjà confirmé + référence réelle ; pas de « nouvelle création ».
6. Second passage : ack court si déjà nettoyé.

**Non exécuté** dans 8F-2B21.

## 9. Empreintes

| Élément | SHA-256 |
| --- | --- |
| Source `after-OCD9It1uKFhOoWNF.json` | `cbb56243bf997dbda3c97c1418593297d2a6858fb17c07132a456b564b526ba1` |
| Candidat | `2263c4bbe906129e89b8ac6b860299d523042c455897c5f7f8426dabcde43c72` |
| Finaliser avant | `27b731befac7d1877cbf75b4ad9195089ea6d5bf353409665f07733716e78766` |
| Finaliser après | `dfeaf3a439ea362bdf40453d27e25631274bc20ae9eb8d8aecb823a8118a741d` |

134 nœuds / 137 connexions ; credentials et URL inchangés ; Chat Trigger inchangé.

## 10. Postflight

Identique au préflight : workflow inactif, compteur 6, POST mock = 1, PG/LIVE/Mailpit inchangés. Aucune exécution métier.

## 11. Risques résiduels

| Risque | Commentaire |
| --- | --- |
| Binding n8n | Simulation hors ligne de l’omission `$3` ; validation runtime réservée à une install TEST autorisée |
| Session incohérente | Toujours présente jusqu’à réconciliation autorisée |
| Token LIVE | Si LIVE envoie `token_gestion`, le fix le persiste ; s’il envoie un autre nom non prévu, reste NULL (comportement déjà proche de Préparer) |
| Ordre Préparer → Finaliser | Un échec Finaliser masque encore le texte Préparer ; le fix vise à supprimer cet échec |

## 12. Verdict

**PASS**

## 13. GO / NO-GO installation TEST

**GO** pour une **installation TEST distinctement autorisée** du candidat `2026-10-31-rec008-phase8f2b21-NON-PUBLIE` (PUT + validation runtime séparés).

**NO-GO** chatbot / réconciliation session tant que cette installation n’est pas autorisée.

S’arrêter ici.
