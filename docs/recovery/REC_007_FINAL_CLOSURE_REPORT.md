# REC-007 — Clôture

REC-007 est clos. La relecture du 30 octobre 2026 confirme l'état de référence. Aucun workflow, aucune donnée et aucune fonction n'ont été modifiés pour cette clôture.

## 1. Objectif initial

Remettre en état, en local, la création d'un rendez-vous consulaire : réponses HTTP distinctes, une seule notification, requêtes paramétrées, refus des créneaux passés, puis une clé d'idempotence qui empêche le doublon. Les essais devaient préserver les 13 rendez-vous d'origine, laisser les workflows 08 et 10 inactifs, et n'envoyer aucun courriel.

## 2. Vérification finale

Lecture seule, PostgreSQL 16.14 et compteur Mailpit.

| Contrôle | Résultat |
|---|---|
| Workflow 03 `SXCesRUmGrV5FMzm` | Actif, 12 nœuds, `2d72700c-d731-47e1-b6d6-82c5c684f055` |
| Workflow 08 `ZbZoj4yF1s5a3B5E` | Inactif, 5 nœuds |
| Workflow 10 `R7TKt5mqZYpeKapl` | Inactif, 84 nœuds |
| `public.creer_rendez_vous_idempotent` | Présente, huit arguments |
| `uq_rendez_vous_cle_idempotence` | Présent, unique, partiel, `WHERE cle_idempotence IS NOT NULL` |
| Rendez-vous, notifications, historiques, sessions | 13, 14, 12, 48 |
| Clés et empreintes renseignées | 0 |
| Identités et documents `REC007%` | 0 |
| Services et sites `REC007%` | 0 |
| Empreinte | `a2dea067599fd4f0a5f857551adc67cc` |
| Créneau `3f3b3cba-30e2-43d2-b2e5-dcb1ee01d2c0` | Futur, `DISPONIBLE`, capacité 2, 0 place |
| Mailpit | 5 messages, dont 2 non lus |

Aucun écart. La clôture documentaire continue.

## 3. Chronologie

| Phase | Résultat retenu |
|---|---|
| 2 | Créations HTTP sur deux créneaux du 9 novembre 2026. Le nettoyage est resté en attente. |
| 3 | Nettoyage des lignes synthétiques et diagnostic d'une réponse HTTP 200 vide. |
| 4 et 4B | Réponses 400 et 500, puis une création 201 contrôlée. |
| 5 | Retour aux compteurs d'origine et plan des priorités suivantes. |
| 6 à 6E | SQL paramétré, créneau passé refusé, une création 201, puis nettoyage. |
| 7A et 7B | Le second nœud de notification est retiré. La notification reste dans la transaction SQL. |
| 7C | Création avec adresse, puis création sans adresse et sans notification. |
| 7D | Conception de l'idempotence sur les colonnes du rendez-vous. |
| 7E | Migration, rollback et payload préparés, non appliqués. |
| 7F | Audit. La collision `id` / `statut` est corrigée avant toute exécution. |
| 7G | Migration appliquée une fois. Le workflow n'est pas encore publié. |
| 7H | `CREATED`, `REPLAYED` et `KEY_CONFLICT` dans une transaction annulée. |
| 7I | Deux connexions réelles. Le verrou est observé. Le catalogue synthétique est retiré. |
| 7J | Publication unique du workflow 03. Essais HTTP négatifs seulement. |
| 7K | HTTP 201, 200 et 409, avec et sans adresse, puis nettoyage des deux lignes. |

## 4. Architecture finale du workflow 03

Version active `2d72700c-d731-47e1-b6d6-82c5c684f055`, douze nœuds, webhook `POST /webhook/appointments`, `responseMode: responseNode`.

`POST /appointments` arrive sur `Valider demande`. `Demande valide ?` envoie une demande correcte vers `Créer rendez-vous` et une demande incorrecte vers `Répondre validation`. Le nœud SQL appelle `public.creer_rendez_vous_idempotent($1::uuid, $2, $3, NULLIF($4,''), NULLIF($5,''), NULLIF($6,''), NULLIF($7,''), NULLIF($8,''))`. Les huit valeurs sont `slotId`, `nom`, `prenom`, `email`, `telephone`, `numeroDocument`, `langue`, `cleIdempotence`.

`Conserver le résultat` ne laisse pas une erreur SQL emprunter aussi la voie du succès. `Classer le résultat` est un Switch 3.4. Ses sorties sont `CREATED`, `REPLAYED`, `KEY_CONFLICT`, `SLOT_UNAVAILABLE`, puis le repli. Elles aboutissent à `Répondre`, `Répondre replay`, `Répondre conflit idempotence`, `Répondre créneau indisponible` et `Répondre erreur interne`. La sortie d'erreur du nœud Postgres rejoint aussi l'erreur interne.

Le credential PostgreSQL reste `LlHYqyFvq4IkYbhP`. `binaryMode: separate` est conservé par la fusion des réglages.

## 5. Clé d'idempotence

La clé brute circule dans la requête. Elle est stockée uniquement sous la forme `SHA-256` hexadécimale dans `cle_idempotence`. `empreinte_requete` est le SHA-256 du contenu canonique : créneau, nom, prénom, courriel en minuscules dans l'empreinte seulement, téléphone, document et langue. Les deux colonnes sont nulles ensemble, ou toutes deux conformes à `^[0-9a-f]{64}$`.

Une clé absente ou vide ne consomme pas l'index : plusieurs créations restent possibles. Une clé présente suit ces issues :

| Situation | Issue |
|---|---|
| Première demande, créneau futur et libre | `CREATED` |
| Même clé, même contenu, ligne déjà validée | `REPLAYED` |
| Même clé, contenu différent | `KEY_CONFLICT` |
| Créneau inconnu, passé, complet, ou pris par une autre clé | `SLOT_UNAVAILABLE` |
| Même clé, capacité 1, l'autre transaction a validé le même contenu | `REPLAYED` après le verrou |
| La première transaction est annulée | la suivante peut obtenir `CREATED` |
| Erreur SQL hors de ces cas | HTTP 500, clé non consommée si la sous-transaction est annulée |

Le verrou de ligne du créneau sérialise les appels. Après un refus de place, la fonction relit la clé. Un contenu identique déjà validé répond `REPLAYED`. Le premier refus d'un créneau inutilisable ne consomme pas la clé. Une suppression physique de la ligne libère la clé. L'annulation métier et la replanification conservent la ligne et donc la clé. Le replay renvoie alors le statut et le créneau courants.

## 6. Contrats HTTP

| Code | Condition | Corps |
|---:|---|---|
| 201 | `CREATED` | `success: true` et `appointment` : `id`, `reference`, `token_gestion`, `statut`, `email`, `telephone`, `debut`, `fin`, `service`, `site` |
| 200 | `REPLAYED` | `success: true`, `created: false`, `replayed: true`, le même objet, le même jeton |
| 400 | Validateur | `VALIDATION_ERROR` : champ manquant, UUID non canonique, nom vide, clé hors `^[A-Za-z0-9._~-]{16,128}$`, ou divergence entre le corps et l'en-tête `Idempotency-Key` |
| 409 | `KEY_CONFLICT` | `error.code = IDEMPOTENCY_KEY_CONFLICT`, sans rendez-vous et sans jeton |
| 409 | `SLOT_UNAVAILABLE` | Message fixe `Créneau introuvable ou complet`, sans jeton |
| 500 | Erreur SQL ou issue inconnue | Message fixe, sans donnée SQL |

Le validateur normalise par `trim` puis NFC. La fonction tronque. Une clé absente est transmise comme `null`, jamais comme valeur omise, pour ne pas décaler les paramètres.

## 7. Essais

### Séquentiels, transaction annulée — phase 7H

Une seule transaction, terminée par `ROLLBACK`. `CREATED` `866e4e82-979a-4306-bfae-33da5330430f` / `GB-2026-1F83539F`, puis `REPLAYED` du même rendez-vous, puis `KEY_CONFLICT` sans identifiant. Après annulation : compteurs et empreinte d'origine, aucune clé.

### Concurrents — phase 7I

Deux connexions, créneaux synthétiques de capacité 1, retirés ensuite. Le blocage observé est un `ShareLock` sur `transactionid`, non accordé, en 118 ms, 113 ms et 111 ms.

| Scénario | Résultat |
|---|---|
| Même clé, même corps | `CREATED` `a5781e93-fcd1-43c5-a1fa-27e3d365397c` / `GB-2026-16FA1477`, puis `REPLAYED` |
| Première transaction annulée | La seconde obtient `CREATED` `f8712339-7947-4cf3-b3a4-2edbaca3d072` / `GB-2026-6CC62CBB` |
| Deux clés, une place | `CREATED` `4a84e1b1-4880-45db-8900-641e43f80671` / `GB-2026-8899769D`, puis `SLOT_UNAVAILABLE` |

Une place à chaque fois. L'empreinte initiale est revenue. Le catalogue `REC007-P7I` a été supprimé.

### HTTP — phases 7J et 7K

La phase 7J a publié le payload une fois, puis a vérifié les refus : champs invalides en 400, créneau absent ou passé en 409. Aucune création.

La phase 7K a utilisé le créneau futur `3f3b3cba-30e2-43d2-b2e5-dcb1ee01d2c0`.

| Essai | Exécution | HTTP | Rendez-vous |
|---|---:|---:|---|
| Création avec adresse | 552 | 201 | `f661511c-6efd-447d-9aa9-fa7dcaf07e9a`, `GB-2026-E03F6657`, une notification, un historique |
| Replay | 553 | 200 | Même identifiant, même référence, même jeton, aucune écriture |
| Conflit | 554 | 409 | `IDEMPOTENCY_KEY_CONFLICT`, données inchangées |
| Création sans adresse | 555 | 201 | `d279024f-a15e-4f38-9124-1dfeb3e39eae`, `GB-2026-671AEEFF`, adresse `NULL`, aucune notification |
| Replay | 556 | 200 | Même rendez-vous, aucune écriture |

Les deux lignes ont été supprimées par UUID, sous verrou, après contrôle du nom, de l'adresse, du créneau et du hash. Les places ont été recalculées.

## 8. État final

L'état de la section 2 est aussi l'état après la phase 7K. Le workflow 03 est resté sur la version publiée. Les workflows 08 et 10 sont restés inactifs. Mailpit est resté à 5 messages. Les exécutions 552 à 556 sont conservées.

## 9. Sauvegardes et retour arrière

| Artefact | Empreinte ou identité |
|---|---|
| `backups/govsuite-pre-rec007-20261029.dump` | 596 983 octets, SHA-256 `7859b0c80ef1f074d2e5d2e3ef3728933b02f10ac0f9f2a275f30013f0493112` |
| `backups/govsuite-pre-rec007-phase7g-20261030-002948.dump` | 597 596 octets, SHA-256 `c1628a545a37d1ee859f0a0a104104099a10df08ea3012b6b42be2e63c4a0c1a` |
| Migration appliquée | `postgres/migrations/20261029_rec007_idempotence.sql`, SHA-256 `8df62d2319b75a9e8f2ad1cbe02a80b8de3a29b9cdd442c9e40950b70a033b4e` |
| Rollback SQL, non exécuté | `postgres/migrations/20261029_rec007_idempotence_rollback.sql`, SHA-256 `dc006846bb7ee48d72b93b990a74f2d637307fd5eba4f79719ebc5c8c07019d7` |
| Payload publié | `n8n/live-exports/2026-10-29-rec007-phase7e-proposed/put-body.json`, SHA-256 `f6fd66f2885c8297da58bf021ce1dab49da9e11feb37d36d09f43c1f15ecffac` |
| Export d'avant publication | `n8n/live-exports/2026-10-30-rec007-phase7j-before/SXCesRUmGrV5FMzm.json`, version `c48ffad5-4f36-4c7e-9abf-11ce6fa2d9e6` |

Le rollback SQL retire seulement la fonction à huit arguments. Il suppose que le workflow 03 est d'abord revenu à `c48ffad5-4f36-4c7e-9abf-11ce6fa2d9e6`. Le retrait des colonnes et de l'index reste commenté et refuse de s'exécuter si une clé existe. La version `740ca2ae-87ea-4323-aa69-cfd57d869fc1` ne doit pas être republée : elle renvoyait HTTP 409 pour une erreur SQL.

Aucun de ces retours n'a été lancé. Les dumps n'ont pas été restaurés.

## 10. Anomalie de contrôle de la phase 7K

Le nettoyage du scénario A était validé. `psql` a toutefois imprimé `BEGIN`, l'identifiant du créneau, `DO`, `COMMIT` et `nettoye`. Le programme a comparé l'ensemble à `nettoye` et s'est arrêté. Une relecture a confirmé les compteurs et l'empreinte. Le scénario D a ensuite été exécuté sur cette base propre. Les essais ne sont pas à refaire.

Le contrôle suivant doit utiliser le code de retour du processus, puis une seconde session en lecture seule. Le détail est dans la section 10 du rapport `docs/recovery/REC_007_PHASE7K_HTTP_E2E_REPORT.md`.

## 11. Validé et non implémenté

Validé :

- création `CONFIRME`, avec ou sans adresse ;
- une place, un historique `CREATION`, une notification `CONFIRMATION / EMAIL / A_ENVOYER` seulement si l'adresse est présente ;
- replay HTTP 200 sans seconde écriture ;
- conflit HTTP 409 sans rendez-vous et sans jeton ;
- créneau inconnu ou passé en HTTP 409 ;
- validation HTTP 400 ;
- sérialisation par le verrou du créneau, y compris à capacité 1 ;
- nettoyage par UUID et retour de l'empreinte `a2dea067599fd4f0a5f857551adc67cc`.

Non implémenté :

- lien entre l'appelant et le hash stocké ;
- arrêt du renvoi du jeton au replay ;
- mesure d'entropie au-delà du filtre de 16 à 128 caractères ;
- durée de vie de la clé ;
- purge des exécutions n8n qui conservent la clé brute ;
- authentification du webhook ;
- confirmation explicite dans le workflow 10 ;
- envoi du courriel, le workflow 08 restant inactif.

## 12. Exposition publique

Le webhook peut rester un service local de reprise. Avant une exposition publique, quatre protections deviennent nécessaires :

1. Inclure l'identité de l'appelant dans le hash, pour qu'un tiers qui rejoue la clé et le corps ne reçoive pas le jeton.
2. Cesser de renvoyer le jeton au replay dès qu'une lecture authentifiée existe.
3. Exiger une clé à entropie réelle.
4. Limiter la rétention des exécutions n8n et ne pas journaliser la clé brute.

## 13. Verdict

**GO** pour clôturer REC-007.

L'idempotence publiée répond aux contrats 201, 200, 400, 409 et 500. Les essais séquentiels, concurrents et HTTP ont retrouvé l'état d'origine. Les protections d'exposition publique restent hors de cette clôture.

**NO-GO** pour commencer REC-008 tant qu'une autorisation distincte n'est pas donnée. La préparation est dans `docs/recovery/REC_008_PREPARATION.md`.

Cette clôture s'arrête ici.
