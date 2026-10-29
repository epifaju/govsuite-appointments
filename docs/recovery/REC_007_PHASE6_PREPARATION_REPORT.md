# Rapport REC-007 — phase 6, préparation

**Date :** 29 octobre 2026  
**Périmètre :** préparer le paramétrage SQL, le refus des créneaux passés et la validation UUID canonique du workflow 03.  
**Suite :** aucune version n'a été publiée. Le workflow vivant n'a pas été modifié.

## 1. État initial

Export relu : `n8n/live-exports/2026-10-29-rec007-phase6-before/SXCesRUmGrV5FMzm.json`.  
12 241 octets, SHA-256 `06c77b75fff22268989f3d4c2eb8c00212cd96fc8b2940274496c227622dcd85`, identique à l'export d'après la phase 4.

| Élément | Valeur |
|---|---|
| Workflow 03 | actif, `SXCesRUmGrV5FMzm`, 12 nœuds, version `269708a1-ad45-4c90-b223-033d9163a92e`, `versionCounter` 27 |
| Workflow 02 | actif, `37f59d20-4687-4c2c-aed6-ac14aed1a232` |
| Workflow 08 | inactif, `43167625-0a3b-42fa-861c-60f55f316379` |
| Workflow 10 | inactif, `88a1f42a-ab9e-4eff-bfd9-996c31976b16` |
| Rendez-vous | 13, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Notifications | 14 |
| Historique | 12 |
| Sessions | 48 |

Les 12 nœuds sont `POST /appointments`, `Valider demande`, `Demande valide ?`, `Répondre validation`, `Créer rendez-vous`, `Conserver le résultat`, `Répondre erreur interne`, `Vérifier création`, `If`, `Créer notification CONFIRMATION`, `Répondre`, `Répondre créneau indisponible`.

## 2. Point bloquant : API publique

`GET http://127.0.0.1:5680/api/v1/workflows/SXCesRUmGrV5FMzm` sans clé répond **401**. Le conteneur n'a pas la variable `N8N_API_KEY`. L'API est donc joignable, mais elle n'est pas utilisable pour publier.

Aucune écriture n'a été faite dans `workflow_entity` ni dans `workflow_history`. La publication attend les deux actions suivantes.

1. Dans l'éditeur n8n, le propriétaire crée une clé d'API qui possède le droit `workflow:update`. La clé ne doit pas être collée dans le dépôt, dans ce rapport, ni dans la conversation.
2. Un accord explicite autorise ensuite `PUT /api/v1/workflows/SXCesRUmGrV5FMzm` avec le diff de la section 4.

Sans cette clé, la seule autre voie serait une écriture directe des tables n8n, qui est exclue.

## 3. Compatibilité de `queryReplacement`

Le nœud installé est PostgreSQL v2. `Créer rendez-vous` est en `typeVersion` 2.6. `Créer notification CONFIRMATION` est en 2.7 et utilise déjà `options.queryReplacement` avec une expression qui produit un tableau.

Le routeur du nœud fait `options.nodeVersion = node.typeVersion`. Dans `executeQuery`, à partir de la version 2.5, une expression qui s'évalue en tableau devient la liste ordonnée des paramètres `$1`, `$2`, `$3`… Une valeur `undefined` est sautée et décalerait les paramètres suivants. `null` et la chaîne vide sont conservés. Les occurrences `'$1'` entre apostrophes seraient réinterprétées si l'option « treat query parameters in single quotes as text » n'est pas activée. La requête proposée n'en contient pas : elle écrit `$1::uuid`, sans apostrophes autour du paramètre.

La version 2.6 suit donc le même chemin que la 2.7 déjà en service. `queryReplacement` est compatible, à condition de transmettre sept chaînes, jamais `undefined`, et de ne laisser aucun `{{ }}` dans le texte SQL.

## 4. Diff proposé

Deux nœuds changent. Les connexions, les autres nœuds, le verrou, la capacité, la référence, l'historique et la notification conditionnelle restent.

### `Valider demande`

Une seule expression change, après le trim déjà en place :

```javascript
if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(slotId)) return fail('Le champ slotId est invalide.');
```

Elle remplace `/^[0-9a-fA-F-]{36}$/`. Les contrôles « obligatoire », les messages et les champs transmis à la suite ne changent pas.

### `Créer rendez-vous`

Le texte SQL ne contient plus aucune expression n8n. Les valeurs utilisateur arrivent par des paramètres.

```sql
WITH slot AS (
  SELECT c.id,c.service_id,c.site_id,c.capacite,c.places_reservees
  FROM creneaux c
  WHERE c.id=$1::uuid
    AND c.statut='DISPONIBLE'
    AND c.places_reservees<c.capacite
    AND c.debut > now()
  FOR UPDATE
), ins AS (
  INSERT INTO rendez_vous(reference,service_id,site_id,creneau_id,nom,prenom,email,telephone,numero_document,langue,statut)
  SELECT 'GB-'||to_char(now(),'YYYY')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
         service_id,site_id,id,
         $2,$3,NULLIF($4,''),NULLIF($5,''),NULLIF($6,''),$7,'CONFIRME'
  FROM slot
  RETURNING *
), upd AS (
  UPDATE creneaux c SET places_reservees=c.places_reservees+1,
    statut=CASE WHEN c.places_reservees+1>=c.capacite THEN 'COMPLET' ELSE c.statut END, updated_at=now()
  WHERE c.id IN (SELECT creneau_id FROM ins) RETURNING c.id
), hist AS (
  INSERT INTO historique_rendez_vous(rendez_vous_id,action,nouveau_statut,details)
  SELECT id,'CREATION','CONFIRME',jsonb_build_object('reference',reference) FROM ins
), notif AS (
  INSERT INTO notifications(rendez_vous_id,type,canal,destinataire,statut)
  SELECT id,'CONFIRMATION','EMAIL',email,'A_ENVOYER' FROM ins WHERE email IS NOT NULL
  ON CONFLICT DO NOTHING
)
SELECT i.id,i.reference,i.token_gestion,i.statut,i.email,i.telephone,c.debut,c.fin,s.code AS service,si.code AS site
FROM ins i JOIN creneaux c ON c.id=i.creneau_id JOIN services s ON s.id=i.service_id JOIN sites si ON si.id=i.site_id;
```

Paramètres, dans cet ordre, via `options.queryReplacement` :

```text
={{ [$json.slotId, $json.nom, $json.prenom, $json.email, $json.telephone, $json.numeroDocument, $json.langue] }}
```

| Paramètre | Champ | Type SQL | Traitement |
|---|---|---|---|
| `$1` | `slotId` | `uuid` | cast dans la requête verrouillée |
| `$2` | `nom` | texte | valeur déjà trimée, 100 caractères |
| `$3` | `prenom` | texte | valeur déjà trimée, 100 caractères |
| `$4` | `email` | texte | `NULLIF` de la chaîne vide |
| `$5` | `telephone` | texte | `NULLIF` de la chaîne vide |
| `$6` | `numeroDocument` | texte | `NULLIF` de la chaîne vide |
| `$7` | `langue` | texte | défaut `fr` déjà appliqué par le validateur |

`AND c.debut > now()` est dans le `SELECT` qui porte `FOR UPDATE`. Un créneau passé ne peut pas être sélectionné, donc ni verrouillé pour une réservation, ni incrémenté. Le résultat vide suit le chemin actuel vers HTTP 409. Le fuseau de `now()` est celui de PostgreSQL, `Europe/Paris`.

`onError` reste `continueErrorOutput`. Un cast UUID qui échouerait encore, ce que la nouvelle expression doit empêcher, resterait sur le HTTP 500 fixe.

## 5. Publication, après accord et après création de la clé

1. Relire la version active : elle doit encore être `269708a1-ad45-4c90-b223-033d9163a92e`, avec 12 nœuds.
2. Envoyer `PUT /api/v1/workflows/SXCesRUmGrV5FMzm` avec le nom, les nœuds, les connexions et les réglages. Ne pas envoyer `active: false`.
3. Vérifier que la réponse laisse le workflow actif, qu'elle donne une nouvelle version, et que l'ancienne reste dans `workflow_history`.
4. Contrôler que les workflows 02, 08 et 10 n'ont pas changé, puis exécuter seulement la matrice sans écriture.

## 6. Rollback

Tant que la nouvelle version n'est pas publiée, il n'y a rien à annuler.

Après publication, le retour arrière est :

`POST /api/v1/workflows/SXCesRUmGrV5FMzm/activate`

```json
{"versionId":"269708a1-ad45-4c90-b223-033d9163a92e"}
```

Ne pas republier `740ca2ae-87ea-4323-aa69-cfd57d869fc1`. Ne pas importer. Ne pas appeler `unpublish:workflow --all`. Aucune migration PostgreSQL n'accompagne ce diff.

## 7. Matrice de tests

### Sans écriture, à lancer seulement après la publication autorisée

| Cas | Attendu |
|---|---|
| `slotId`, `nom` ou `prenom` absent | HTTP 400 `VALIDATION_ERROR` |
| `nom` composé d'espaces | HTTP 400 |
| `zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz` | HTTP 400 |
| 36 tirets | HTTP 400, et non plus 500 |
| UUID canonique inexistant `00000000-0000-4000-8000-000000000000` | HTTP 409, aucune ligne |
| Le même UUID entouré d'espaces | trim, puis HTTP 409 : la forme interne est valide |
| Créneau passé `de6733bf-8d82-4946-84a9-4535e10037a1`, passeport, 29 octobre 2026 12:30, `DISPONIBLE`, 0 place | HTTP 409, places inchangées |
| Corps des réponses | pas de SQL, pas de jeton, pas de `token_gestion` |
| Compteurs | 13 rendez-vous, empreinte `a2dea067599fd4f0a5f857551adc67cc`, 14 notifications, 12 historiques, 48 sessions |
| Workflows | 03 actif sur la nouvelle version ; 08 et 10 inactifs |

Le créneau passé devra être relu juste avant l'appel. L'identité de ces appels reste synthétique et ne doit pas correspondre à un rendez-vous existant.

### Avec écriture, préparés et non exécutés

Ils attendent un accord séparé, après la réussite des tests sans écriture.

| Cas | Préparation |
|---|---|
| HTTP 201 | Créneau futur `3f3b3cba-30e2-43d2-b2e5-dcb1ee01d2c0`, passeport Paris, 10 novembre 2026 09:00, capacité 2, 0 place, aucun rendez-vous lié. À relire avant l'appel. |
| Apostrophe et accents | Nom `D'ARTAGNAN`, prénom `ÉLOÏSE`, adresse `rec007-phase6-create@example.test`. Une seule ligne, les caractères conservés tels quels. |
| Notification | Une seule `CONFIRMATION` / `EMAIL` / `A_ENVOYER`. |
| Historique | Une seule ligne `CREATION`. |
| Capacité | Le créneau passe de 0 à 1 et reste `DISPONIBLE`. |
| Nettoyage | Transaction verrouillée sur cette seule ligne, puis places recalculées. Non exécuté tant que la création n'a pas été autorisée puis réalisée. |

## 8. Risques

Un décalage dans les sept paramètres écrirait un champ dans la mauvaise colonne. Le tableau de la section 4 est le contrôle de publication.

Une valeur `undefined` sauterait un paramètre. Le validateur actuel envoie toujours des chaînes pour les sept champs. Il ne faut pas retirer un champ du tableau sans retirer le paramètre correspondant.

`AND c.debut > now()` change le contrat des créneaux passés : ils passent de « réservables » à HTTP 409. Les créneaux futurs ne changent pas. Le message 409 reste « Créneau introuvable ou complet » et ne distingue pas encore le motif « passé ».

La requête reste une seule instruction. Le verrou, la capacité, la référence, l'historique et la notification conditionnelle sont inchangés. Le second nœud `Créer notification CONFIRMATION` n'est pas retiré dans ce diff.

Si l'activation par l'API échoue, n8n peut marquer le workflow inactif. Le rollback ci-dessus doit alors être lancé tout de suite.

## 9. Mission suivante, analysée et non modifiée

### Second nœud de notification et absence d'adresse

`destinataire` est `NOT NULL`. La requête de création n'insère la notification que si `email` n'est pas nul, puis elle valide le rendez-vous. `Créer notification CONFIRMATION` refait le même `INSERT`. Sans adresse, ce second nœud reçoit un destinataire vide et peut échouer alors que le rendez-vous existe. Le retrait de ce nœud, prévu en priorité 4 du rapport de phase 5, n'est pas dans le diff actuel.

### Idempotence

Aucun champ ne relie deux POST identiques. L'ajouter demande la colonne `cle_idempotence` et un index unique partiel, puis une publication distincte. Ce n'est pas inclus ici, pour ne pas mêler une migration au correctif SQL.

### Confirmation explicite dans le workflow 10

Le workflow 10 est inactif et n'a pas été modifié. Aujourd'hui, dès que le créneau, le nom, le prénom, l'adresse et le téléphone sont valides, `Gérer collecte progressive` pose `conversationStep` à `READY_CREATE`. `Valider paramètres création` pose alors `ready` à vrai, et `Création prête ?` appelle `Appeler CreateAppointment` dans le même tour. Il n'y a pas de réponse « oui ».

Proposition, non appliquée :

- Après le téléphone valide, poser l'état `AWAIT_CREATE_CONFIRMATION` au lieu de `READY_CREATE`.
- `ready` reste faux dans cet état. `Création prête ?` ne peut donc pas appeler la création.
- Le message affiche le créneau choisi, issu de la liste réellement mémorisée, et demande « oui » ou « non ».
- Seule une réponse affirmative explicite, reçue pendant `AWAIT_CREATE_CONFIRMATION`, passe à `READY_CREATE` et autorise `ready`.
- « non », ou toute autre réponse, ne appelle pas `Appeler CreateAppointment`.
- Le contrôle doit vivre dans la machine à états, pas seulement dans le texte affiché.

## 10. Actions qui attendent une autorisation

| Action | État |
|---|---|
| Créer la clé d'API `workflow:update` | nécessaire avant toute publication |
| Publier le diff de la section 4 | non fait |
| Lancer la matrice sans écriture | après la publication |
| Création HTTP 201, y compris le nom avec apostrophe | non fait |
| Retirer le second nœud de notification | mission suivante |
| Ajouter l'idempotence | mission suivante, avec migration |
| Activer le workflow 10 ou y ajouter `AWAIT_CREATE_CONFIRMATION` | non fait |
| REC-008 | non commencé |

Les workflows 08 et 10 sont restés inactifs. Aucun courriel n'a été envoyé. Les 13 rendez-vous n'ont pas été modifiés.
