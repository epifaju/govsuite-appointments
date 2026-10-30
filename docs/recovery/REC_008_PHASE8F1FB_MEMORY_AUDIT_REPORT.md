# REC-008 phase 8F-1F-B — Audit extraction et mémoire conversationnelle

Diagnostic hors ligne du scénario 8F-1F-A. Le workflow installé n'a pas été modifié, activé ni exécuté. Une copie NON PUBLIÉE propose une correction minimale de trois nœuds Code.

## État initial

| Contrôle | Résultat |
| --- | --- |
| Workflow installé `OCD9It1uKFhOoWNF` | inactif, version `bb9aad73-3cf5-4c1b-bb08-132df3ccbb45`, compteur 3, 134 nœuds, 137 liens |
| Session `rec008-8f1d-availability-01` après 8F-1F-A | intention `GET_AVAILABILITY`, service vide, site vide, `date_debut = 2026-11-03`, `date_fin` vide |
| PostgreSQL TEST | 1 rendez-vous, 3 sessions, 0 tentative |
| GovSuite | 13, 14, 12, 48, 0 tentative, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Mailpit | 5 messages, 2 non lus, base 98 304 octets |

Source analysée : export `n8n/proposed/2026-10-30-rec008-phase8f1b-CHAT-TRIGGER/after-OCD9It1uKFhOoWNF.json`, SHA-256 `58ca88a2788a799a7f13438179c41a73a3258d25609da8a8dd4158537ddd0543`.

## Parcours des données

Chaîne réelle :

`Chat Trigger` → `Charger état conversation` → `Lire tentative de session` → `Joindre tentative de session` → `Comprendre la demande` → `Parser intention` → `Fusionner état conversation` → `Gérer collecte progressive` → `Sauvegarder état conversation` → `Router intention` → `Valider paramètres disponibilité`.

| Nœud | Rôle | Risque observé |
| --- | --- | --- |
| `Charger état conversation` | `SELECT * FROM ai_conversation_state WHERE session_id = $1` | Lecture correcte ; colonnes snake_case |
| `Lire tentative de session` | Lecture tentative ouverte | Sans effet sur service/site |
| `Joindre tentative de session` | Fusionne previous + `openAttempt` | Préserve previous |
| `Comprendre la demande` | LLM | Peut proposer intent/dates ; le parseur regex reste déterminant pour service/site/dates FR |
| `Parser intention` | Extraction déterministe | Date unique → `dateDebut` ; pas de qualificatif « date de fin » |
| `Fusionner état conversation` | Priorité mémoire | Branche « aucune action métier » ignore previous |
| `Gérer collecte progressive` | Machine à états | Pour `GET_AVAILABILITY`, force `pendingAction = null` |
| `Sauvegarder état conversation` | UPSERT JSON | `payload ? 'service'` écrase même si la valeur est null |
| `Valider paramètres disponibilité` | Contrôle ready | Demande les champs manquants ; n'appelle pas le mock |

## Cause racine — mauvaise extraction de `dateFin`

Dans `Parser intention`, le code actuel fait :

```javascript
const dateDebut = dateMatches[0] ?? null;
const dateFin = dateMatches[1] ?? null;
```

Pour « Ma date de fin est le 03/11/2026. », une seule date est trouvée. Elle est toujours affectée à `dateDebut`. Aucune règle ne lit « date de fin », « jusqu'au », « du … au … ».

Résultat : `dateFin` reste `null`, `dateDebut` redevient `2026-11-03`.

## Cause racine — perte du service et du site

`GET_AVAILABILITY` n'appartient pas à `businessIntents` dans `Fusionner état conversation`. Après 8F-1D, `pending_action` est vide. Donc :

- `startingNewAction` = false ;
- `continuingPreviousAction` = false, faute de `previousPendingAction` ;
- le flux tombe dans la branche « aucune action métier active » :

```javascript
service = current.service ?? null;
site = current.site ?? null;
```

Le message de reprise ne contient ni passeport ni Paris. Le parseur sort `service = null`, `site = null`. La branche n'appelle pas `pick(..., previous.service)`.

`Gérer collecte progressive` propage ces null. `Sauvegarder état conversation` envoie un JSON qui contient les clés `service` et `site`. Le SQL fait :

```sql
CASE WHEN p.payload ? 'service' THEN p.service ELSE e.service END
```

En PostgreSQL, `?` teste la présence de la clé, pas une valeur non nulle. Les null écrasent donc `PASSEPORT` et `PARIS`.

Point d'écrasement principal : **C puis E** — fusion sans `pick`, puis UPSERT qui honore les clés nulles. Le chargement (A) et la validation (aval) ne sont pas la cause initiale.

## Anomalies supplémentaires

1. `Gérer collecte progressive` remet `pendingAction = null` pour toute intention `GET_AVAILABILITY`, ce qui empêche la branche de continuation au tour suivant.
2. Une date unique non qualifiée reste ambiguë ; la correction proposée ne l'invente pas comme `dateFin`.
3. Le LLM peut encore produire des dates, mais le parseur regex écrase la logique de dates FR pour le message courant.

## Règles de fusion proposées

1. Champ absent / null / `''` / `'null'` du message courant : conserver la valeur persistée valide.
2. Champ explicitement présent dans le message : remplacer.
3. Nouvelle action métier explicite (`CREATE`, `CANCEL`, `RESCHEDULE`, `GET_APPOINTMENT`) : repartir des seules valeurs du message courant.
4. `GET_AVAILABILITY` : conserver la mémoire partielle ; poser `pendingAction = 'GET_AVAILABILITY'`.
5. Ne jamais réutiliser une clé d'idempotence d'une tentative abandonnée.
6. Ne jamais créer de POST métier dans ces nœuds.

## Correction proposée (hors ligne)

Copie : `n8n/proposed/2026-10-30-rec008-phase8f1fb-NON-PUBLIE/`.

| Fichier | SHA-256 | Octets |
| --- | --- | --- |
| `10_AI_ConsularAssistant_MEMORY_FIX_NON_PUBLIE.json` | `1cf46a9fabb58d2beb83ad084a8eeb30b7758ab5fb1e9c7f95b2715db623c64b` | 286 152 |
| `NE_PAS_PUBLIER.txt` | `ce3d08f42ac2841d600cc28a7fa147660d9794d0751b95bd0fea7f73ad7b8ff8` | 81 |
| `DIFF_NODES.txt` | `e3c7b0ec3515cda59f7214af87dee45f29cdd706be66cc0e0a33a3adf58f6fa3` | 277 |

Toujours **134 nœuds** et **137 connexions**. Credentials TEST, URL mock, webhook, settings de conservation et chemins REC-008 inchangés.

Nœuds modifiés uniquement :

1. `Parser intention` — dates qualifiées (`date de fin`, `du … au …`, début explicite), rejet calendaire des dates invalides.
2. `Fusionner état conversation` — branche else utilise `pick()` sur previous.
3. `Gérer collecte progressive` — `pendingAction = 'GET_AVAILABILITY'` au lieu de `null`.

Le SQL d'UPSERT n'a pas été modifié (interdiction SQL de cette phase). Avec la fusion corrigée, les clés ne partent plus à null pour un simple complément de date.

## Tests hors ligne

Script : fonctions extraites, sans n8n ni base.

| Test | Résultat |
| --- | --- |
| T1 conserver PASSEPORT | PASS |
| T2 conserver PARIS | PASS |
| T3 conserver dateDebut si seule dateFin | PASS |
| T4 extraire dateFin depuis la phrase 8F-1F-A | PASS |
| T5 période `du … au …` | PASS |
| T6 date invalide 31/02/2026 | PASS |
| T7 ne pas écraser avec null/`''` | PASS |
| T8 modification explicite service | PASS |
| T9 modification explicite site | PASS |
| T10 verrouillage tentative REC-008 | PASS |
| T11 non-réutilisation clé abandonnée | PASS |
| T12 pas de POST métier | PASS |
| BUG-8F1FA reproduction logique actuelle | PASS (montre l'écrasement) |

Limites : pas d'exécution du runner n8n, pas d'appel Ollama, pas d'UPSERT réel, expressions `$('…')` non évaluées dans le moteur. La fidélité porte sur les règles déterministes des nœuds Code et sur la sémantique `jsonb ?`.

## Invariants REC-008

Contrôle statique de la copie proposée :

- Credentials : uniquement `REC008 PostgreSQL TEST` et `REC008 Ollama TEST`.
- URL HTTP métier : uniquement `http://rec008-mock:8080/...` (services, availability, appointments, manage, cancel, reschedule).
- Occurrences de « GovSuite » : uniquement dans le texte système du nœud LLM (prompt), pas d’endpoint ni de credential réel.
- Aucun nouveau chemin vers CreateAppointment.
- Confirmation explicite, UNCERTAIN, SQL de concurrence et idempotence inchangés.
- Workflow marqué `active: false` ; aucun PUT effectué vers n8n.

## État final des environnements

| Zone | Résultat |
| --- | --- |
| n8n TEST | inchangé, inactif, version `bb9aad73-…`, 134/137 |
| PostgreSQL TEST | inchangé (session déjà altérée par 8F-1F-A, non restaurée) |
| Mock | non modifié |
| GovSuite | inchangé |

## Verdict

Installer la correction dans n8n TEST après une autorisation distincte : **GO**.

Activer, envoyer un message, ou republier maintenant : **NO-GO**.

Arrêt 8F-1F-B. Aucune installation sans autorisation distincte.
