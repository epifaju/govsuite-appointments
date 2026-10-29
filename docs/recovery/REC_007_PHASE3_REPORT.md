# Rapport REC-007 — phase 3

**Date :** 29 octobre 2026  
**Périmètre :** nettoyage des trois rendez-vous synthétiques de la phase 2, puis diagnostic du HTTP 200 vide.  
**Suite :** le workflow 03 n'a pas été modifié. Le correctif HTTP n'est pas déployé.

## 1. Sauvegardes avant suppression

| Fichier | Taille | Contrôle |
|---|---:|---|
| `backups/govsuite-pre-rec007-20261029.dump` | 596 983 octets | SHA-256 `7859b0c80ef1f074d2e5d2e3ef3728933b02f10ac0f9f2a275f30013f0493112`, inchangé. `pg_restore -l` lit `creneaux`, `rendez_vous`, `notifications`, `historique_rendez_vous` et `ai_conversation_state` |
| `backups/govsuite-pre-rec006-apply-20261029.dump` | 560 901 octets | présent, non restauré |
| `backups/govsuite-pre-rec003-20261028.dump` | 524 319 octets | présent, non restauré |

Aucun dump n'a été restauré. Les workflows 08 et 10 étaient inactifs. Leurs versions n'ont pas changé.

## 2. Lignes identifiées

Horloge du contrôle : 29 octobre 2026, 19:43:15 +01. La base contenait 16 rendez-vous, 17 notifications, 15 historiques et 48 sessions.

Les seules lignes `REC007-TEST` étaient les trois créations de la phase 2. Leurs empreintes de référence sont celles du rapport de phase 2. Les tokens n'ont pas été relus.

| Rendez-vous | Prénom | Créneau | Créé | Référence, empreinte |
|---|---|---|---|---|
| `7bcca21f-11d7-4290-b3b1-3256412d1f17` | `SYNTHE-A` | `63428f11-0fed-4ab7-a457-472d846a4bbb` | 01:18:17 +01 | `76769b6d392d` |
| `14b5577b-d087-4ff0-a40f-bb0df9e0cf32` | `SYNTHE-B` | `63428f11-0fed-4ab7-a457-472d846a4bbb` | 01:18:20 +01 | `c60728c5d1d4` |
| `06429a86-73d6-44ce-b1fc-e80fd01dceaa` | `SYNTHE-D2` | `43a9bb39-b14a-439f-bcd0-76eb93f22114` | 01:18:21 +01 | `4538b9c3301a` |

Chaque ligne était `CONFIRME`, portait l'adresse `rec007-…@example.test` prévue, et avait exactement une notification `CONFIRMATION` / `EMAIL` / `A_ENVOYER` et une ligne d'historique `CREATION`.

Les deux créneaux ne portaient aucun autre rendez-vous : le passeport était `COMPLET` avec 2 places sur 2, l'état civil `COMPLET` avec 1 place sur 1.

Les seules clés étrangères vers `rendez_vous` sont `notifications` et `historique_rendez_vous`, toutes deux en `ON DELETE CASCADE`. Aucune des 48 sessions ne référençait ces rendez-vous, leur référence ou leur token.

Empreintes avant suppression :

| Périmètre | Empreinte |
|---|---|
| 13 rendez-vous préexistants | `a2dea067599fd4f0a5f857551adc67cc` |
| Créneaux autres que les deux cibles | `90054f5ae918b7f2bd6c082a6e9c30d5` |

## 3. Transaction

La suppression a tenu dans une transaction unique, validée à 19:44:26 +01. Les contrôles ont été refaits sous verrou, avant toute suppression : identités, empreintes de référence, absence d'autre rendez-vous sur les deux créneaux, trois notifications et trois historiques du type attendu, 48 sessions, aucune session liée. Les places ont ensuite été recalculées à partir des rendez-vous actifs restants.

Le `COMMIT` n'a eu lieu qu'après ces contrôles et après la vérification de l'état final dans la même transaction. Aucun `ROLLBACK` n'a été nécessaire.

Les exécutions n8n de la phase 2 n'ont pas été supprimées. Douze exécutions du workflow 03 restent entre 01:18 et 02:00. Elles peuvent encore contenir l'identité synthétique et le token. Les effacer demanderait une autorisation distincte.

## 4. État final

| Mesure | Avant | Après |
|---|---:|---:|
| Rendez-vous | 16 | 13 |
| dont `CONFIRME` | 13 | 10 |
| dont `ANNULE` | 3 | 3 |
| `REC007-TEST` | 3 | 0 |
| Notifications | 17 | 14 |
| dont `A_ENVOYER` | 13 | 10 |
| dont `ENVOYE` | 4 | 4 |
| Historique | 15 | 12 |
| Sessions | 48 | 48 |
| Créneaux | 994 | 994 |
| Somme des places | 13 | 10 |
| Messages Mailpit | 5 | 5 |

| Créneau | Avant | Après |
|---|---|---|
| `63428f11-0fed-4ab7-a457-472d846a4bbb` | 2 places, `COMPLET` | 0 place, `DISPONIBLE` |
| `43a9bb39-b14a-439f-bcd0-76eb93f22114` | 1 place, `COMPLET` | 0 place, `DISPONIBLE` |

L'empreinte des 13 rendez-vous restants est `a2dea067599fd4f0a5f857551adc67cc`. L'empreinte des autres créneaux est `90054f5ae918b7f2bd6c082a6e9c30d5`. Les deux sont identiques à l'état d'avant la suppression. Aucun écart entre `places_reservees` et les rendez-vous actifs.

Le workflow 03 est resté actif, version `93ebd7e4-ee13-4fd8-8104-564e0c6ca3c8`. Les workflows 08 et 10 sont restés inactifs. Aucun courriel n'a été envoyé.

## 5. Diagnostic HTTP

Le webhook `POST /appointments` est en mode `responseNode`. Seuls deux nœuds répondent au client :

- `Répondre`, code 201, après une création ;
- `Répondre créneau indisponible`, code 409, quand la requête SQL ne renvoie aucune ligne.

`Valider demande` s'exécute avant le SQL. Pour un champ absent ou un `slotId` qui n'a pas 36 caractères hexadécimaux ou tirets, il lève une exception. Aucun nœud de réponse n'est alors atteint, et le SQL n'est pas exécuté. C'est pour cela que la phase 2 n'a créé aucune ligne sur ces cas. L'exécution n8n est bien enregistrée au statut `error`.

La réponse HTTP 200 vide vient ensuite de n8n 2.32.6, pas du SQL :

1. À la fin de l'exécution, `workflow-runner.js` appelle `resolveExecutionResponsePromise`.
2. Cette méthode, dans `active-executions.js`, résout la promesse du webhook avec un objet vide lorsque l'exécution n'est pas en attente. Elle le fait aussi quand l'erreur est portée par le résultat, car la promesse d'exécution est alors tenue et non rejetée.
3. `setupResponseNodePromise`, dans `webhook-helpers.js`, lit `body` et `statusCode` sur cet objet. Les deux sont absents.
4. `sendLegacyResponse` appelle `res.json` sans code de statut. Le statut reste donc 200, et le corps JSON est vide.

Le filet interne qui enverrait 500 avec le texte « Error in workflow » ne s'applique plus : la réponse a déjà été expédiée par cette résolution vide.

Un créneau complet ou inconnu ne passe pas par cette voie. La requête aboutit, `Vérifier création` produit `created: false`, et le nœud 409 répond. Ce contrat-là reste valide.

## 6. Correction proposée, non déployée

Le changement minimal conserve le SQL, le 201 et le 409. Il empêche `Valider demande` de lever une exception.

Le nœud renverrait soit les champs nettoyés avec `ok: true`, soit :

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Le champ slotId est obligatoire."
  }
}
```

Les messages prévus sont fixes : champ `slotId`, `nom` ou `prenom` obligatoire, ou `slotId` invalide. La valeur reçue n'est pas recopiée. Un champ vide ou composé d'espaces est traité comme absent, afin qu'il n'atteigne pas l'insertion.

Un nœud `IF` serait inséré entre `Valider demande` et `Créer rendez-vous` :

- `ok` vrai : la chaîne actuelle, jusqu'au 201 ou au 409 ;
- `ok` faux : un nouveau nœud `Répondre validation`, HTTP 400, avec le corps suivant et rien d'autre.

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Le champ slotId est obligatoire."
  }
}
```

La branche 400 n'a aucune connexion vers PostgreSQL.

Le même mécanisme n8n transforme toute autre exception en 200 vide, y compris une erreur SQL. Le complément proposé, dans le même déploiement si vous l'acceptez, est une sortie d'erreur sur `Créer rendez-vous` vers un nœud HTTP 500 au message fixe :

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "La création du rendez-vous n'a pas pu être traitée."
  }
}
```

Le message d'erreur du nœud PostgreSQL ne serait pas renvoyé : il peut contenir la requête et les valeurs interpolées. Cette sortie 500 ne corrige pas le cas où le rendez-vous est déjà validé et où le second nœud de notification échoue ensuite.

Le déploiement ne doit pas passer par un import brut. Sur cette instance, l'import désactive le workflow importé. Le workflow 03 est actif : un import couperait `POST /appointments` jusqu'à une republication. La méthode à autoriser est une mise à jour en place, puis un contrôle que le workflow est toujours actif et que sa version a changé uniquement pour ces nœuds.

## 7. Plan de tests, non exécuté

Ces appels attendront l'accord de déploiement. Les contrôles sans écriture peuvent précéder une création.

| Cas | Attendu | Écriture |
|---|---|---|
| `slotId` absent | 400, `VALIDATION_ERROR`, message fixe | aucune |
| nom absent | 400, message fixe | aucune |
| prénom absent | 400, message fixe | aucune |
| nom composé d'espaces | 400 | aucune |
| `slotId` mal formé | 400, message « invalide » | aucune |
| UUID bien formé mais absent | 409, corps JSON de créneau indisponible | aucune |
| créneau complet | 409, places inchangées | aucune nouvelle ligne |
| création valide sur un créneau futur libre | 201, une référence, un token UUID, places + 1, une notification | une ligne synthétique, à nettoyer ensuite |
| corps d'erreur | pas de SQL, pas de token, pas de valeur reçue | |
| workflows | 03 reste actif ; 02 inchangé ; 08 et 10 inactifs | |

Le cas 201 et le cas « créneau complet » créent ou présupposent une réservation. Ils demandent une autorisation d'écriture séparée, avec le même cadre que la phase 2 : identité `REC007-TEST`, créneau futur désigné à l'avance, transaction de nettoyage prête.

## 8. Corrections futures, hors de ce déploiement

1. **Créneau passé.** Le SQL accepte encore tout créneau `DISPONIBLE` dont les places sont libres, sans comparer `debut` à `now()`.
2. **Paramètres liés.** `Créer rendez-vous` interpole encore le nom, le prénom, l'adresse, le téléphone et la langue après dédoublement des apostrophes.
3. **E-mail absent.** La notification du premier ordre est sautée si l'adresse est vide, puis le second nœud s'exécute après la validation du rendez-vous. Une adresse vide peut donc laisser un rendez-vous enregistré et une réponse d'échec.
4. **Erreur interne.** Tant que le complément 500 n'est pas en place, une exception après le webhook continue de produire un HTTP 200 au corps vide.

## 9. Autorisations encore nécessaires

- Déployer le correctif 400, avec ou sans la sortie 500.
- Rejouer un test de création ou de créneau complet.
- Supprimer les douze exécutions n8n de la phase 2 si le token ne doit plus rester dans les journaux d'exécution.
- Activer le workflow 10, lancer les tests conversationnels, ou envoyer un courriel.

Aucune de ces actions n'a été commencée.
