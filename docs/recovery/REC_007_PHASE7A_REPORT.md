# Rapport REC-007 — phase 7A, fiabilisation des notifications

**Date :** 29 octobre 2026  
**Périmètre :** préparer le retrait du nœud `Créer notification CONFIRMATION`, sans modifier la version active.  
**Résultat :** le correctif est prêt et non publié. Recommandation **GO** pour une publication ultérieure.

## 1. État de référence

Le `GET` authentifié confirme la version active. La clé d'API n'est pas reproduite.

| Élément | Valeur |
|---|---|
| Workflow 03 | actif, `SXCesRUmGrV5FMzm`, 12 nœuds, version `f5079298-6e66-400d-9c44-69522aa68a49` |
| Workflow 02 | actif, `37f59d20-4687-4c2c-aed6-ac14aed1a232`, 5 nœuds |
| Workflow 08 | inactif, 5 nœuds |
| Workflow 10 | inactif, 84 nœuds |
| Rendez-vous | 13, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Notifications | 14 |
| Historique | 12 |
| Sessions | 48 |

Copie de sauvegarde : `n8n/live-exports/2026-10-29-rec007-phase7a-before/SXCesRUmGrV5FMzm.json`, 11 918 octets, SHA-256 `6b477f3a63e02a5938c7e48a49af01f2e2e8a5cb050c4053f6814e865073e5e8`.

Aucune écriture n'a été envoyée à l'API n8n. Les données métier et les tables internes n8n n'ont pas été modifiées. L'exécution `533` a seulement été lue.

## 2. Diagnostic

### Création dans la transaction

`Créer rendez-vous` (`36c17325-2c1b-4a98-8da3-e10dd4512f53`, PostgreSQL 2.6, identifiant `LlHYqyFvq4IkYbhP`) exécute une seule instruction. Le CTE `notif` insère `CONFIRMATION` / `EMAIL` / `A_ENVOYER` uniquement lorsque `email IS NOT NULL`. Une adresse vide devient `NULL` par `NULLIF`. Sans adresse, le rendez-vous et l'historique sont créés, et aucune notification n'est ajoutée. Un échec de cette instruction annule toute l'écriture.

### Nœud redondant

`Créer notification CONFIRMATION` (`8e43e8da-2758-4372-82ed-9f30053e3dbc`, PostgreSQL 2.7) refait le même `INSERT` après la validation de l'instruction précédente. Il n'a pas de sortie d'erreur. `destinataire` est `NOT NULL`.

Avec une adresse, le second `INSERT` rencontre le conflit unique et n'ajoute pas de seconde ligne. L'exécution `533` le montre : le nœud a émis uniquement `{ "success": true }`, sans les colonnes `RETURNING`. La réponse HTTP 201 contenait pourtant l'identifiant et la référence. Elle est produite par `Répondre`, qui lit `$('Créer rendez-vous').item.json` et non la sortie du nœud de notification.

Sans adresse, ce second `INSERT` reçoit un destinataire nul. Il échoue après que le rendez-vous a déjà été commis. `Répondre` n'est alors pas atteint. La création déjà enregistrée peut donc se terminer sans HTTP 201.

### Chemins HTTP

| Chemin | Enchaînement | Réponse |
|---|---|---|
| Validation refusée | `Demande valide ?`, branche fausse | `Répondre validation`, HTTP 400 |
| Création réussie | `Créer rendez-vous`, `Conserver le résultat`, `Vérifier création`, `If` branche vraie, puis le nœud de notification | `Répondre`, HTTP 201 |
| Créneau vide, complet ou passé | `If`, branche fausse | `Répondre créneau indisponible`, HTTP 409 |
| Erreur SQL | seconde sortie de `Créer rendez-vous` | `Répondre erreur interne`, HTTP 500 |

`Conserver le résultat` écarte l'item vide synthétique lorsque la sortie d'erreur contient déjà un item. Une erreur SQL ne produit donc pas aussi un HTTP 409.

La seule connexion entrante du nœud de notification est la branche vraie de `If`. Sa seule connexion sortante est `Répondre`.

## 3. Diff proposé

Le payload non envoyé est `n8n/live-exports/2026-10-29-rec007-phase7a-proposed/put-body.json`.

11 nœuds, 10 489 octets, SHA-256 `7c876ee482cd1ff48de9627e32ad3e1fedf904268c1fdbbaf72b03df544eab15`.

Deux changements :

1. Suppression du nœud `Créer notification CONFIRMATION`.
2. La branche vraie de `If` va directement à `Répondre`.

Les onze objets de nœuds restants sont identiques, y compris leurs identifiants et l'identifiant PostgreSQL de `Créer rendez-vous`. Le texte SQL, `queryReplacement`, les réponses 400, 409 et 500, et l'expression du HTTP 201 ne changent pas. Le corps ne contient pas `active`. Les réglages envoyés sont `executionOrder: v1` et `availableInMCP: false`. `binaryMode` reste conservé par la fusion des réglages, comme lors de la phase 6D.

Le graphe préparé n'a aucune connexion vers un nœud absent. Les branches fausses de `Demande valide ?` et de `If`, ainsi que la sortie d'erreur de `Créer rendez-vous`, sont inchangées.

## 4. Vérifications statiques

| Contrôle | Résultat |
|---|---|
| Connexion orpheline | aucune |
| Contrat HTTP 201 | inchangé : code 201 et `$('Créer rendez-vous').item.json` |
| Notification SQL si l'adresse est présente | oui, dans le CTE `notif` |
| Création sans adresse | le CTE n'insère pas de notification ; plus aucun nœud ultérieur ne peut échouer sur `destinataire` |
| Échec secondaire après commit | retiré avec le nœud |
| HTTP 400, 409 et 500 | mêmes nœuds et mêmes connexions |
| Identifiants et credential PostgreSQL | conservés sur les nœuds restants |

La réponse 201 ne dépend pas de la sortie `{ "success": true }` observée dans l'exécution `533`. Raccorder `If` directement à `Répondre` conserve l'ancêtre `Créer rendez-vous` dans le même fil d'items. Le premier HTTP 201 après publication devra le confirmer sur le webhook.

## 5. Tests à exécuter après publication

Ils ne sont pas lancés dans cette phase. Chaque création synthétique reste unique, puis suit le nettoyage avant l'appel suivant.

### Sans écriture

| Cas | Résultat attendu |
|---|---|
| `slotId`, `nom` ou `prenom` absent, ou nom composé d'espaces | HTTP 400 `VALIDATION_ERROR` |
| UUID mal formé et 36 tirets | HTTP 400 |
| UUID canonique inexistant, avec ou sans espaces | HTTP 409 |
| Créneau passé `de6733bf-8d82-4946-84a9-4535e10037a1` s'il est encore `DISPONIBLE` | HTTP 409, places inchangées |
| Compteurs | 13, 14, 12, 48, empreinte inchangée |

### Avec adresse, un seul POST

Créneau futur relu juste avant l'appel, aujourd'hui `3f3b3cba-30e2-43d2-b2e5-dcb1ee01d2c0`, capacité 2 et 0 place. Identité nouvelle, distincte de la phase 6E, avec une adresse.

Attendu : HTTP 201, un rendez-vous `CONFIRME`, le nom conservé, une place supplémentaire, une seule notification `CONFIRMATION` / `EMAIL` / `A_ENVOYER`, une seule ligne `CREATION`, aucun courriel. Les 13 rendez-vous initiaux gardent leur empreinte.

### Sans adresse, un seul POST

Même créneau, après le nettoyage du cas précédent, avec une autre identité et sans adresse. Attendu : HTTP 201, un rendez-vous `CONFIRME`, aucune notification, une ligne `CREATION`, une place supplémentaire. L'absence de HTTP 201 alors qu'une ligne existe serait un échec de cette publication.

### Nettoyage ciblé

Pour chaque rendez-vous synthétique, dans une transaction : verrouiller la ligne et le créneau, vérifier qu'une seule ligne porte l'identité complète, vérifier la notification attendue ou son absence, supprimer uniquement cette ligne, recalculer les places de ce seul créneau, contrôler l'empreinte et les compteurs, puis valider. Toute incohérence entraîne `ROLLBACK`. Les exécutions n8n restent en place.

## 6. Publication et rollback

À n'exécuter qu'après autorisation.

Préconditions : workflow 03 encore actif sur `f5079298-6e66-400d-9c44-69522aa68a49` avec 12 nœuds, workflows 08 et 10 inactifs, empreinte inchangée, SHA-256 du payload inchangé.

Envoi : `PUT /api/v1/workflows/SXCesRUmGrV5FMzm` avec le fichier préparé. Le traitement republie le workflow déjà actif. Ne pas envoyer `active: false`.

Vérification : HTTP 200, workflow actif, 11 nœuds, nouvelle version, nœud de notification absent, branche vraie de `If` vers `Répondre`, SQL inchangé, workflows 08 et 10 inactifs, compteurs inchangés. Ensuite seulement la matrice sans écriture, puis les deux créations autorisées séparément.

Arrêt immédiat si le `PUT` n'est pas HTTP 200, si le workflow devient inactif, si le nombre de nœuds n'est pas 11, si un compteur change pendant les tests sans écriture, ou si une création sans adresse laisse une ligne sans HTTP 201.

Rollback, non exécuté :

`POST /api/v1/workflows/SXCesRUmGrV5FMzm/activate`

```json
{"versionId":"f5079298-6e66-400d-9c44-69522aa68a49"}
```

Cette version à 12 nœuds reste le retour arrière. La version à 11 nœuds `740ca2ae-87ea-4323-aa69-cfd57d869fc1` ne doit pas être republiée.

## 7. Risques

Le premier HTTP 201 après publication est la preuve que `$('Créer rendez-vous').item` se résout encore. L'exécution `533` et l'expression actuelle rendent cet écart peu probable, mais il n'est pas encore observé sur le graphe raccourci.

Une création sans adresse réussit alors sans notification. C'est le comportement voulu. Le workflow 08 n'aura rien à envoyer pour ce rendez-vous.

L'idempotence et la confirmation explicite du workflow 10 ne sont pas dans ce diff.

## 8. Recommandation

**GO** pour publier ce payload après autorisation, puis exécuter d'abord la matrice sans écriture, ensuite une création avec adresse, enfin une création sans adresse. Chaque création est suivie de son nettoyage avant la suivante.

La publication n'a pas été lancée.
