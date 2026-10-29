# Rapport REC-007 — phase 5

**Date :** 29 octobre 2026  
**Périmètre :** nettoyage du rendez-vous synthétique de la phase 4B, puis plan de durcissement et de test conversationnel.  
**Suite :** le workflow 03 n'a pas été modifié. Aucun déploiement n'a été lancé.

## 1. Nettoyage

Sauvegardes relues, non restaurées :

| Fichier | Taille | SHA-256 |
|---|---:|---|
| `n8n/live-exports/2026-10-29-rec007-phase4-before/SXCesRUmGrV5FMzm.json` | 8 820 | `0ab58c7ea25ffc21aa189b4f323b8299c000f0d3963275c32ffdd145e0c84daf` |
| `n8n/live-exports/2026-10-29-rec007-phase4-after/SXCesRUmGrV5FMzm.json` | 12 241 | `06c77b75fff22268989f3d4c2eb8c00212cd96fc8b2940274496c227622dcd85` |
| `backups/govsuite-pre-rec007-20261029.dump` | 596 983 | `7859b0c80ef1f074d2e5d2e3ef3728933b02f10ac0f9f2a275f30013f0493112` |

Avant la transaction, `3fcc7d62-f586-485d-8313-cce4373a8642` était la seule ligne `REC007-PHASE4`. Référence `GB-2026-E3074815`, statut `CONFIRME`, prénom `SYNTHE-CREATE`, adresse `rec007-phase4-create@example.test`, téléphone `0600000401`, document `P4-SYNTH-01`, langue `fr`, créneau `3f3b3cba-30e2-43d2-b2e5-dcb1ee01d2c0`. L'empreinte MD5 du jeton commence par `9b22c8107713`. Une notification `CONFIRMATION` / `EMAIL` / `A_ENVOYER` et une ligne d'historique `CREATION` / `CONFIRME` y étaient liées. Aucun autre rendez-vous n'occupait ce créneau. Les 13 autres rendez-vous avaient l'empreinte `a2dea067599fd4f0a5f857551adc67cc`. Totaux : 14 rendez-vous, 15 notifications, 13 historiques, 48 sessions. Le créneau avait 1 place réservée et restait `DISPONIBLE`.

La transaction a verrouillé `rendez_vous` en `SHARE ROW EXCLUSIVE` et le créneau en `FOR UPDATE`, puis a refait ces contrôles. La suppression a visé cette seule ligne. La notification et l'historique sont partis par `ON DELETE CASCADE`. Les places du créneau ont été recalculées à partir des rendez-vous non annulés qui y restaient. Les contrôles d'après suppression ont été refaits avant `COMMIT`. Horodatage de la mise à jour du créneau : 29 octobre 2026, 21:17:34 +01.

Les créneaux `63428f11-0fed-4ab7-a457-472d846a4bbb` et `43a9bb39-b14a-439f-bcd0-76eb93f22114` sont restés à 0 place, `DISPONIBLE`, avec leur horodatage du 29 octobre à 19:44:26 +01. Les exécutions n8n n'ont pas été supprimées.

## 2. État final

| Mesure | Valeur |
|---|---|
| Rendez-vous | 13, dont 0 `REC007-PHASE4` |
| Empreinte | `a2dea067599fd4f0a5f857551adc67cc` |
| Notifications | 14 |
| Historique | 12 |
| Sessions | 48 |
| Créneau `3f3b3cba-30e2-43d2-b2e5-dcb1ee01d2c0` | 0 place, `DISPONIBLE`, capacité 2 |
| Workflow 03 | actif, 12 nœuds, version `269708a1-ad45-4c90-b223-033d9163a92e` |
| Workflow 02 | actif, version `37f59d20-4687-4c2c-aed6-ac14aed1a232`, 5 nœuds |
| Workflow 08 | inactif, version `43167625-0a3b-42fa-861c-60f55f316379` |
| Workflow 10 | inactif, version `88a1f42a-ab9e-4eff-bfd9-996c31976b16`, 84 nœuds |

Aucun courriel n'a été envoyé. REC-008 n'est pas commencé.

## 3. Méthode de déploiement proposée

Les corrections ci-dessous ne sont pas appliquées. Quand elles seront autorisées, la mise à jour du workflow 03 devra passer par `PUT /api/v1/workflows/SXCesRUmGrV5FMzm`. Sur n8n 2.32.6, cette opération republie le workflow s'il est déjà actif. Il faut d'abord créer une clé d'API dans l'interface n8n, avec le droit de mise à jour des workflows. Le conteneur n'en possède pas aujourd'hui.

Avant l'appel : nouvel export du workflow actif, contrôle des 12 nœuds et de la version `269708a1-ad45-4c90-b223-033d9163a92e`. Après l'appel : le workflow reste actif, une nouvelle version apparaît, et `269708a1-ad45-4c90-b223-033d9163a92e` reste dans `workflow_history`.

Retour arrière commun : `POST /api/v1/workflows/SXCesRUmGrV5FMzm/activate` avec `{"versionId":"269708a1-ad45-4c90-b223-033d9163a92e"}`. Ne pas republier `740ca2ae-87ea-4323-aa69-cfd57d869fc1`. Ne pas importer. Ne pas appeler `unpublish:workflow --all`.

Une migration PostgreSQL, si elle est retenue, s'exécute avant la publication du workflow qui l'utilise. Son retour arrière est décrit avec la correction concernée.

## 4. Plan de durcissement, par priorité

### Priorité 1 — Paramétrer les données utilisateur

| Point | Contenu |
|---|---|
| Nœud | `Créer rendez-vous` |
| Cause | `nom`, `prenom`, `email`, `telephone`, `numeroDocument`, `langue` et `slotId` sont interpolés dans le texte SQL. Les apostrophes sont dédoublées. Ce n'est pas une requête paramétrée. |
| Modification minimale | Réécrire la requête avec `$1` à `$7` et un `queryReplacement` qui transmet, dans cet ordre, `slotId`, `nom`, `prenom`, `email`, `telephone`, `numeroDocument`, `langue`. Conserver le verrou, l'insertion, l'incrément des places, l'historique et la notification conditionnelle. |
| Contrat API | Inchangé pour une demande légitime. Une valeur qui reposait sur l'interpolation ne peut plus modifier la requête. |
| Migration | Aucune. |
| Non-régression | Rejouer les HTTP 400, le 409 sur UUID inconnu et, après accord, un HTTP 201 synthétique. Vérifier qu'un nom contenant une apostrophe est enregistré tel quel et ne crée qu'une ligne. |
| Risque de déploiement | Un décalage dans l'ordre des paramètres enregistrerait les champs dans les mauvaises colonnes. Le comparer au résultat du 201 de la phase 4B avant de le laisser en service. |
| Rollback | Republier `269708a1-ad45-4c90-b223-033d9163a92e`. Aucune colonne à retirer. |

### Priorité 2 — Refuser les créneaux passés

| Point | Contenu |
|---|---|
| Nœud | `Créer rendez-vous`, dans la même requête que la priorité 1 |
| Cause | Le créneau verrouillé doit être `DISPONIBLE` et avoir des places libres. `debut > now()` n'est pas exigé. Un créneau passé encore `DISPONIBLE` peut être réservé. |
| Modification minimale | Ajouter `AND c.debut > now()` au `SELECT` verrouillé. Aucune ligne n'est alors insérée, et le chemin actuel répond HTTP 409. |
| Contrat API | Un créneau passé qui aurait reçu HTTP 201 reçoit HTTP 409, message « Créneau introuvable ou complet ». Les créneaux futurs ne changent pas. |
| Migration | Aucune. |
| Non-régression | Un UUID futur libre reste réservable après accord. Un créneau passé `DISPONIBLE`, choisi hors de la fenêtre du 2 au 6 novembre, répond 409 et ne change ni ses places ni les rendez-vous. |
| Risque de déploiement | Le fuseau de `now()` est celui de PostgreSQL, `Europe/Paris` dans ce conteneur. Un créneau qui commence pendant l'appel reste accepté tant que `debut` est dans le futur au moment du verrou. |
| Rollback | Republier la version précédente. |

### Priorité 3 — Validation stricte de l'UUID

| Point | Contenu |
|---|---|
| Nœud | `Valider demande` |
| Cause | Le contrôle `/^[0-9a-fA-F-]{36}$/` accepte toute chaîne de 36 caractères hexadécimaux ou tirets. Trente-six tirets passent ce contrôle, PostgreSQL refuse le cast, et le client reçoit HTTP 500. |
| Modification minimale | Après trim, exiger `/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/`. Le message reste « Le champ slotId est invalide. » et ne répète pas la valeur. |
| Contrat API | Cette forme invalide passe de HTTP 500 à HTTP 400 `VALIDATION_ERROR`. Un UUID canonique, dont celui du créneau de la phase 4B, reste accepté. |
| Migration | Aucune. |
| Non-régression | `slotId` absent, espaces, `zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz` et trente-six tirets répondent 400. L'UUID inexistant `00000000-0000-4000-8000-000000000000` répond encore 409, sans insertion. |
| Risque de déploiement | Un client qui enverrait un UUID sans tirets, forme pourtant acceptée par PostgreSQL, recevrait 400. Le workflow 10 produit déjà des UUID canoniques. |
| Rollback | Republier la version précédente. |

Les priorités 1 à 3 tiennent dans une seule publication du workflow 03.

### Priorité 4 — Notification sans adresse, et erreur après la création

| Point | Contenu |
|---|---|
| Nœuds | `Créer rendez-vous` et `Créer notification CONFIRMATION` |
| Cause | `destinataire` est `NOT NULL`. La requête de création n'insère une notification que si `email` n'est pas nul, puis valide le rendez-vous. Le nœud suivant insère à nouveau la même notification. Si l'adresse est vide, ce second `INSERT` reçoit un destinataire nul et échoue alors que le rendez-vous existe déjà. Le client peut alors ne pas recevoir le HTTP 201. |
| Modification minimale | Retirer le second `INSERT` du chemin de succès. La requête de création reste l'unique écriture de notification : elle l'omet quand l'adresse est vide et elle reste annulée avec le rendez-vous si elle échoue. `Répondre` continue de renvoyer le rendez-vous créé. |
| Contrat API | Avec une adresse, la réponse 201 et l'unique notification `A_ENVOYER` restent les mêmes. Sans adresse, la réponse devient 201 et aucune notification n'est créée, au lieu d'un rendez-vous orphelin d'une réponse vide. Le corps 201 ne gagne pas de champ obligatoire. |
| Migration | Aucune. La contrainte `NOT NULL` et l'unicité `(rendez_vous_id, type, canal)` restent. |
| Non-régression | Création avec adresse : une notification `CONFIRMATION` / `EMAIL` / `A_ENVOYER`. Création sans adresse, après accord : HTTP 201, zéro notification, rendez-vous `CONFIRME`. Le workflow 08 reste inactif, donc aucun envoi. |
| Risque de déploiement | Le second nœud est aujourd'hui redondant grâce à `ON CONFLICT DO NOTHING`. Le retirer supprime aussi le seul filet si la requête de création oubliait sa propre notification. La relecture de cette requête fait partie de la publication. |
| Rollback | Republier `269708a1-ad45-4c90-b223-033d9163a92e`, qui conserve le second nœud. |

### Priorité 5 — Idempotence du POST

| Point | Contenu |
|---|---|
| Nœuds | `Valider demande`, puis `Créer rendez-vous` |
| Cause | Aucune clé ne relie deux demandes identiques. Un second POST crée un second rendez-vous tant que le créneau a de la place. |
| Modification minimale | Accepter un champ facultatif `idempotencyKey`, de 8 à 128 caractères `[A-Za-z0-9._:-]`. Le stocker dans une colonne nullable. Un index unique partiel empêche deux lignes avec la même clé. Dans la requête verrouillée, une clé déjà vue avec le même créneau et la même identité renvoie le rendez-vous existant ; la même clé avec une autre identité répond 409 sans écrire. L'absence de clé conserve le comportement actuel. |
| Contrat API | Nouveau champ facultatif. Rejeu avec la même clé : HTTP 200 et le rendez-vous déjà créé, sans seconde ligne. Clé identique et identité différente : HTTP 409. Sans clé : HTTP 201 comme aujourd'hui. |
| Migration | `ALTER TABLE rendez_vous ADD COLUMN cle_idempotence varchar(128);` puis un index unique partiel `WHERE cle_idempotence IS NOT NULL`. À appliquer avant la publication du workflow qui l'écrit. |
| Non-régression | Deux POST sans clé sur un créneau de capacité 2 créent deux lignes. Deux POST avec la même clé n'en créent qu'une. Une clé réutilisée avec un autre nom répond 409. Les 13 rendez-vous préexistants, dont la colonne sera nulle, restent inchangés. |
| Risque de déploiement | Publier le workflow avant la colonne ferait échouer toutes les créations. L'index unique peut aussi refuser une clé déjà utilisée par un essai précédent. |
| Rollback | Republier la version sans ce champ. La colonne et l'index peuvent rester : l'ancien workflow ne les écrit pas. Les retirer seulement si aucune clé n'a été enregistrée : `DROP INDEX` puis `ALTER TABLE rendez_vous DROP COLUMN cle_idempotence`. |

## 5. Parcours conversationnel préparé, non exécuté

Le workflow 10 est inactif. Ce parcours n'a pas été appelé. Il ne doit démarrer qu'après un accord distinct, et le workflow 08 doit rester inactif.

Le déclencheur de chat a l'identifiant `d755b4f6-7d28-4347-b39e-7b9b5d02c9ad`. Tant que le workflow est inactif, son URL de production répond 404. L'activation, si elle est autorisée, devra être limitée à la durée de l'essai, puis annulée.

Messages prévus :

1. « Je souhaite prendre rendez-vous pour un passeport à Paris entre le 2 et le 6 novembre 2026. »
2. Attendre la liste numérotée réellement renvoyée. « Je prends le 2 » choisit `availableSlots[1]`, l'index affiché 2 étant en base 1. Enregistrer l'identifiant, la date et l'heure de cette ligne avant de continuer. Ne pas réutiliser un identifiant relevé lors d'un audit antérieur : la liste peut avoir changé.
3. Fournir ensuite une identité synthétique nouvelle : nom `REC007-CHAT`, prénom `SYNTHE-CHAT`, adresse `rec007-chat@example.test`, téléphone valide au format attendu par `isValidPhone`.
4. Le graphe actuel passe à `READY_CREATE` dès que le téléphone est valide, puis `Création prête ?` appelle `POST /webhook/appointments` dans le même tour. Il n'y a pas d'étape « oui » séparée. Le texte prévu est « Votre rendez-vous peut maintenant être créé. » L'essai doit noter si la création part à ce moment. S'il apparaît malgré tout une demande de confirmation, ne répondre « oui » qu'après avoir vérifié que le résumé désigne le créneau capturé à l'étape 2.

Contrôles autour de l'essai : empreinte des 13 rendez-vous, 14 notifications, 12 historiques et 48 sessions avant l'activation. Après la création : une seule ligne `REC007-CHAT`, `CONFIRME`, sur l'identifiant capturé, une place de plus, une notification `A_ENVOYER`, une ligne `CREATION`. Le workflow 08 inactif ne doit pas faire passer cette notification à `ENVOYE`.

Nettoyage prévu après l'essai, dans une transaction verrouillée : supprimer seulement cette ligne si le nom, le prénom, l'adresse et le créneau capturé correspondent, recalculer ce créneau, puis retirer la seule session créée après le début de l'essai. Les 48 sessions antérieures et les exécutions n8n restent. Le workflow 10 est ensuite désactivé.

## 6. Arrêt

Le nettoyage de la phase 4B est fait. Le plan de durcissement et le parcours conversationnel attendent un accord avant toute publication, migration ou activation.
