# Rapport REC-007 — phase 6B, préflight de publication

**Date :** 29 octobre 2026  
**Périmètre :** préparer la publication des corrections SQL, date et UUID du workflow 03, sans modifier le workflow vivant.  
**Suite :** aucune version n'a été publiée. Le correctif attend une validation.

## 1. État initial

L'export `n8n/live-exports/2026-10-29-rec007-phase6-before/SXCesRUmGrV5FMzm.json` correspond encore au workflow en base. Le MD5 du code de `Valider demande` est `b3d60b26cbbfc295b4a835eda36eae85`. Le MD5 de la requête de `Créer rendez-vous` est `b0591dfd1461f76c9c32a155d341a1d6`.

| Élément | Valeur |
|---|---|
| n8n | 2.32.6 |
| PostgreSQL | 16.14, fuseau `Europe/Paris` |
| Workflow 03 | actif, `SXCesRUmGrV5FMzm`, 12 nœuds, version `269708a1-ad45-4c90-b223-033d9163a92e`, `versionCounter` 27 |
| Workflow 02 | actif, version `37f59d20-4687-4c2c-aed6-ac14aed1a232`, 5 nœuds, `versionCounter` 39 |
| Workflow 08 | inactif, 5 nœuds, `versionCounter` 5 |
| Workflow 10 | inactif, 84 nœuds, `versionCounter` 654 |
| Historique du workflow 03 | `93ebd7e4-ee13-4fd8-8104-564e0c6ca3c8` (8 nœuds), `740ca2ae-87ea-4323-aa69-cfd57d869fc1` (11 nœuds), `269708a1-ad45-4c90-b223-033d9163a92e` (12 nœuds) |
| Rendez-vous | 13, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Notifications | 14 |
| Historique des rendez-vous | 12 |
| Sessions | 48 |
| Créneau futur de référence | `3f3b3cba-30e2-43d2-b2e5-dcb1ee01d2c0`, 0 place, `DISPONIBLE` |
| Créneau passé de référence | `de6733bf-8d82-4946-84a9-4535e10037a1`, 0 place, `DISPONIBLE` |

`workflow_entity` et `workflow_history` n'ont pas été modifiés. Les workflows 08 et 10 n'ont pas été activés. Aucun rendez-vous n'a été créé. Aucun courriel n'a été envoyé. REC-008 n'a pas été lancé.

## 2. Contrôles de l'API publique

`GET http://127.0.0.1:5680/api/v1/workflows/SXCesRUmGrV5FMzm` sans clé répond **401**. La variable `N8N_API_KEY` est absente du conteneur `govsuite-n8n` et de l'environnement de l'opérateur. Le secret n'a pas été lu, affiché, journalisé ni enregistré.

Une clé d'audience `public-api` existe. Elle possède `workflow:read`, `workflow:update` et `workflow:activate`. Elle possède aussi `workflow:deactivate`, ainsi que les droits d'administration des identifiants, des utilisateurs, des variables, des projets et des tables de données. Les droits utiles à la publication et au retour arrière sont donc présents. Le secret de cette clé n'est pas disponible dans cette session, donc aucun `GET` authentifié n'a été envoyé.

Schémas relevés dans n8n 2.32.6, sans appel d'écriture :

| Opération | Portée | Corps accepté |
|---|---|---|
| `GET /api/v1/workflows/{id}` | `workflow:read` | aucun |
| `PUT /api/v1/workflows/{id}` | `workflow:update`, et le projet doit autoriser `workflow:update` | `additionalProperties: false`. Champs requis : `name`, `nodes`, `connections`, `settings`. Le traitement force `publishIfActive: true` : un workflow déjà publié est republié. |
| `POST /api/v1/workflows/{id}/activate` | `workflow:activate`, et le projet doit autoriser `workflow:publish` | `versionId`, `name` et `description` facultatifs. Sans `versionId`, la dernière version est publiée. |
| `POST /api/v1/workflows/{id}/deactivate` | `workflow:deactivate` | à ne pas appeler |

`settings` refuse les propriétés inconnues. `binaryMode` n'en fait pas partie et ne doit pas être envoyé. Le service fusionne les réglages reçus avec ceux déjà enregistrés, donc `binaryMode: separate` est conservé si l'on envoie seulement `executionOrder` et `availableInMCP`. Les champs en lecture seule (`id`, `active`, `versionId`, `meta`, `tags`, dates) ne font pas partie du corps préparé. `active: false` n'est pas envoyé.

Configuration à fournir avant tout appel authentifié :

1. Rendre le secret disponible dans la session d'opérateur, par variable d'environnement, sans le coller dans le dépôt, dans ce rapport ni dans la conversation.
2. Ou créer une clé limitée à `workflow:read`, `workflow:update` et `workflow:activate`, puis la fournir de la même façon.
3. Autoriser ensuite explicitement le `PUT`.

La clé actuelle suffit pour ces trois opérations, mais elle autoriserait aussi une désactivation si cet appel était lancé par erreur. La procédure ci-dessous ne l'utilise pas.

## 3. Validation SQL

La requête proposée est une seule instruction. PostgreSQL l'exécute dans une transaction : un échec annule ensemble l'insertion, l'incrément des places, l'historique et la notification.

| CTE | Dépendance | Effet |
|---|---|---|
| `slot` | `$1::uuid` | Sélectionne le créneau `DISPONIBLE`, avec des places libres, dont `debut` est postérieur à `now()`, et le verrouille. |
| `ins` | `slot` | Insère un rendez-vous `CONFIRME` seulement si `slot` a renvoyé une ligne. |
| `upd` | `ins` | Incrémente `places_reservees` et passe à `COMPLET` lorsque la capacité est atteinte. |
| `hist` | `ins` | Ajoute une action `CREATION`. |
| `notif` | `ins` | Ajoute `CONFIRMATION` / `EMAIL` / `A_ENVOYER` lorsque `email` n'est pas nul. `ON CONFLICT DO NOTHING`. |

Le `SELECT` final ne lit que `ins`, puis joint le créneau, le service et le site. Les CTE `upd`, `hist` et `notif` ne sont pas cités par ce `SELECT`. PostgreSQL 16.14 les exécute quand même, parce que ce sont des CTE qui modifient des données. Le test annulé l'a mesuré : une ligne future a produit une place réservée, une ligne d'historique et une notification, puis `ROLLBACK` a tout retiré.

Un créneau absent, complet ou passé donne zéro ligne. Aucune écriture n'a lieu, et le chemin actuel vers HTTP 409 reste valable. Le message 409 ne distingue pas encore le motif « passé ».

Les sept paramètres sont liés par `options.queryReplacement`, dans cet ordre : `slotId`, `nom`, `prenom`, `email`, `telephone`, `numeroDocument`, `langue`. Le validateur envoie toujours sept chaînes. `NULLIF` transforme la chaîne vide des trois champs facultatifs en SQL `NULL`. Une valeur `undefined` serait sautée par le nœud PostgreSQL 2.6 et décalerait les paramètres suivants : le validateur actuel ne produit pas cette valeur. Le texte SQL ne contient aucune expression `{{ }}` et ne concatène aucune donnée utilisateur. Les paramètres ne sont pas écrits entre apostrophes, donc l'option qui traiterait `'$1'` comme du texte n'a rien à réinterpréter.

## 4. Tests isolés

Les contrôles d'UUID ont été exécutés dans Node, hors n8n. La requête a été exécutée dans PostgreSQL 16.14, dans une transaction terminée par `ROLLBACK`.

| Contrôle | Résultat |
|---|---|
| UUID canonique du créneau futur | accepté par l'expression |
| UUID canonique inexistant `00000000-0000-4000-8000-000000000000` | accepté par l'expression |
| UUID canonique entouré d'espaces, après trim | accepté par l'expression |
| 36 tirets | refusé par l'expression |
| `zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz` | refusé par l'expression |
| 32 caractères hexadécimaux sans tirets | refusé par l'expression |
| Cast SQL des 36 tirets | erreur `invalid input syntax`, annulée jusqu'au point de sauvegarde |
| Cast SQL de l'UUID canonique | accepté |
| Sept paramètres, dans l'ordre | `$1` créneau, `$2` `D'ARTAGNAN`, `$3` `ÉLOÏSE`, `$4` vide devenu `NULL`, `$5` téléphone, `$6` `P6B-O'HARA`, `$7` `fr` |
| Créneau passé | 0 ligne, 0 place, statut `DISPONIBLE` |
| Créneau futur, dans la transaction | 1 rendez-vous `CONFIRME`, référence `GB-2026-` suivie de 8 caractères hexadécimaux, nom, prénom, document et accents conservés, place passée de 0 à 1, une action `CREATION`, une notification `A_ENVOYER` |
| `ROLLBACK` | confirmé |
| Après annulation | 13 rendez-vous, empreinte inchangée, 14 notifications, 12 historiques, 48 sessions, 0 ligne résiduelle, les deux créneaux à 0 place |

Une première tentative de test utilisait un `SELECT` incomplet, sans `FROM ins`. PostgreSQL l'a rejetée. La transaction a été annulée, et les compteurs étaient déjà identiques avant la seconde tentative. La seconde tentative a utilisé le texte exact proposé.

Aucun test HTTP n'a été envoyé au webhook. Le correctif n'est pas publié, donc la matrice HTTP mesurerait encore l'ancien comportement.

## 5. Diff final proposé

Deux nœuds changent. Les dix autres, les connexions, les identifiants de nœuds, les identifiants d'accès PostgreSQL, `onError` et `alwaysOutputData` restent identiques.

`Valider demande` (`7116ffb2-52f1-40eb-97f1-9131b78334cd`) remplace l'expression :

```javascript
/^[0-9a-fA-F-]{36}$/
```

par :

```javascript
/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
```

Les contrôles obligatoires, les messages et les sept champs transmis ensuite restent les mêmes.

`Créer rendez-vous` (`36c17325-2c1b-4a98-8da3-e10dd4512f53`) remplace la requête interpolée par la requête de la section 3, et remplace `options` vide par :

```text
={{ [$json.slotId, $json.nom, $json.prenom, $json.email, $json.telephone, $json.numeroDocument, $json.langue] }}
```

Le corps `PUT` préparé, non envoyé, est `n8n/live-exports/2026-10-29-rec007-phase6-proposed/put-body.json`. Il contient 12 nœuds, 11 702 octets, SHA-256 `e1ba1cdec6542e312431b8bf84ffa79f383269c9ebdc250de5236f0afd33349b`. Il ne contient pas de clé d'API. Ses réglages sont `executionOrder: v1` et `availableInMCP: false`.

## 6. Procédure de publication

À n'exécuter qu'après validation de ce rapport et après disponibilité du secret.

### Préconditions

1. Le workflow 03 est encore actif, en version `269708a1-ad45-4c90-b223-033d9163a92e`, avec 12 nœuds.
2. L'empreinte des rendez-vous est encore `a2dea067599fd4f0a5f857551adc67cc`.
3. Les workflows 08 et 10 sont inactifs.
4. Le fichier `put-body.json` a encore le SHA-256 ci-dessus.
5. Un `GET` authentifié confirme la même version avant l'envoi.
6. Le corps envoyé est exactement ce fichier. Il ne contient pas `active: false`.

### Envoi

`PUT /api/v1/workflows/SXCesRUmGrV5FMzm`, avec l'en-tête `X-N8N-API-KEY` et le corps préparé. Le traitement republie la version mise à jour parce que le workflow est déjà publié.

### Vérification après publication

1. La réponse est HTTP 200, le workflow reste actif, le nombre de nœuds reste 12, et `versionId` est nouveau.
2. `269708a1-ad45-4c90-b223-033d9163a92e` reste présent dans `workflow_history`.
3. `Valider demande` contient l'expression canonique. `Créer rendez-vous` contient `$1::uuid`, `c.debut > now()` et `queryReplacement`, sans `{{` dans le texte SQL.
4. Les workflows 02, 08 et 10 sont inchangés. 08 et 10 restent inactifs.
5. Les compteurs et l'empreinte sont inchangés avant la matrice HTTP.
6. Exécuter ensuite seulement la matrice sans écriture.

### Matrice HTTP sans écriture

| Cas | Résultat attendu |
|---|---|
| `slotId`, `nom` ou `prenom` absent, ou composé d'espaces | HTTP 400 `VALIDATION_ERROR` |
| `zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz` | HTTP 400 |
| 36 tirets | HTTP 400 |
| UUID canonique inexistant `00000000-0000-4000-8000-000000000000` | HTTP 409, aucune ligne |
| Le même UUID entouré d'espaces | HTTP 409 |
| Créneau passé `de6733bf-8d82-4946-84a9-4535e10037a1` | HTTP 409, places inchangées |
| Corps des réponses | pas de SQL, pas de jeton de gestion |
| Compteurs | 13, 14, 12, 48, empreinte inchangée |
| Workflows | 03 actif sur la nouvelle version, 08 et 10 inactifs |

Le créneau passé doit être relu juste avant l'appel. Ces appels restent à lancer après la publication, pas pendant cette phase.

### Critères d'arrêt immédiat

Arrêter dès qu'un des faits suivants apparaît, puis appliquer le retour arrière avant tout nouvel essai :

- la réponse du `PUT` n'est pas HTTP 200 ;
- le workflow 03 devient inactif, change de nombre de nœuds, ou reste sur `269708a1` alors que la publication était annoncée ;
- le workflow 08 ou 10 devient actif ;
- un compteur ou l'empreinte change pendant la matrice sans écriture ;
- une réponse contient du SQL ou un jeton de gestion ;
- les 36 tirets produisent HTTP 500 ;
- le créneau passé change de nombre de places.

## 7. Procédure de rollback

Tant que la nouvelle version n'est pas publiée, il n'y a rien à annuler. Le workflow vivant reste `269708a1-ad45-4c90-b223-033d9163a92e`.

Après publication, le retour arrière vérifié dans le code de n8n 2.32.6, et non exécuté, est :

`POST /api/v1/workflows/SXCesRUmGrV5FMzm/activate`

```json
{"versionId":"269708a1-ad45-4c90-b223-033d9163a92e"}
```

La clé doit posséder `workflow:activate`. Le propriétaire doit posséder `workflow:publish`. La réponse attendue laisse le workflow actif sur cette version à 12 nœuds. Il faut ensuite relire la version active, les workflows 02, 08 et 10, puis l'empreinte des rendez-vous.

`740ca2ae-87ea-4323-aa69-cfd57d869fc1` ne doit pas être republié : cette version à 11 nœuds transformait aussi une erreur SQL en HTTP 409. L'import est exclu, parce qu'il désactive le workflow importé. `deactivate` et `unpublish:workflow --all` sont exclus. Aucune migration PostgreSQL n'accompagne ce diff.

Si l'activation interne du `PUT` échoue, n8n peut poser `active` à faux et `activeVersionId` à nul. Dans ce cas, le même `POST /activate` avec `269708a1-ad45-4c90-b223-033d9163a92e` est l'opération de rétablissement, puis la mission s'arrête.

## 8. Risques résiduels

Le secret d'API n'est pas disponible ici. La publication et le retour arrière restent donc non exercés par un appel réel. Leur forme a été vérifiée dans le schéma et le code de n8n 2.32.6.

La clé existante est plus large que nécessaire. Elle autorise notamment `workflow:deactivate`. La procédure ne doit pas l'appeler.

Le second nœud `Créer notification CONFIRMATION` reste après la validation de l'instruction SQL. Sans adresse, il peut encore échouer alors que le rendez-vous existe. Son retrait n'est pas dans ce diff.

Le message HTTP 409 ne distingue pas un créneau passé d'un créneau complet. Le refus lui-même est porté par `c.debut > now()`.

Une modification ultérieure du validateur qui omettrait un champ, ou enverrait `undefined`, décalerait les sept paramètres. Le tableau de la section 3 est le contrôle à relire au moment de l'envoi.

L'idempotence et la confirmation explicite `AWAIT_CREATE_CONFIRMATION` du workflow 10 restent hors de ce diff. Le workflow 10 reste inactif.

## 9. Actions qui attendent une autorisation

| Action | État |
|---|---|
| Fournir le secret d'API hors du dépôt, ou créer une clé limitée à `workflow:read`, `workflow:update` et `workflow:activate` | nécessaire avant tout appel authentifié |
| Envoyer le `PUT` du fichier préparé | non fait, en attente de validation |
| Exécuter la matrice HTTP sans écriture | après la publication |
| Création HTTP 201, y compris le nom avec apostrophe | non autorisée |
| Retirer le second nœud de notification | mission suivante |
| Ajouter l'idempotence | mission suivante, avec migration |
| Activer le workflow 08 ou 10, ou ajouter `AWAIT_CREATE_CONFIRMATION` | non fait |
| REC-008 | non commencé |
| Republier `740ca2ae-87ea-4323-aa69-cfd57d869fc1` ou revenir à la version à 8 nœuds | exclu pour ce correctif |

La publication n'a pas été lancée. La prochaine étape attend la validation de ce rapport.
