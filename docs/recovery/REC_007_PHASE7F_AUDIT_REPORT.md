# REC-007 — Phase 7F — Audit avant migration

Audit statique des artefacts de la phase 7E. La migration n'a pas été exécutée. Le workflow n'a pas été publié. Aucun rendez-vous n'a été créé et aucun courriel n'a été envoyé. Les lectures PostgreSQL sont des `SELECT`. Le serveur est PostgreSQL 16.14, isolation `read committed`, rôle `govsuite`, extension `pgcrypto` dans `public`. Le comportement PL/pgSQL a été comparé au source `REL_16_STABLE` de `pl_handler.c` et `pl_exec.c`.

## 1. Anomalie bloquante corrigée

La fonction déclarait `id` et `statut` dans `RETURNS TABLE`, puis les utilisait sans qualificatif dans l'`UPDATE` du créneau :

```sql
WHERE id = p_slot
  AND statut = 'DISPONIBLE'
```

Le défaut PostgreSQL 16 est `plpgsql.variable_conflict = error`. À la première exécution, au moment où l'instruction est planifiée, PostgreSQL lève `42702`, `column reference "id" is ambiguous`. Ce code n'est ni `unique_violation` ni l'erreur de place. Il sort de la fonction. La sous-transaction annule l'insertion. n8n répond HTTP 500. Aucune ligne ne reste. `CREATE FUNCTION` ne le voit pas : PL/pgSQL planifie chaque requête SQL à son premier appel.

Ce n'était pas un HTTP 409 faux. C'était l'échec de toute création. Le fichier corrigé qualifie les colonnes (`c.id`, `c.statut`, `c.places_reservees`, `c.capacite`) et fixe `#variable_conflict use_column` pour cette fonction. Les noms de retour ne servent qu'à `RETURN QUERY`.

Trois autres corrections accompagnent ce correctif.

| Sujet | Avant | Après |
|---|---|---|
| Place non mise à jour | `RAISE` avec `P0001`, le SQLSTATE générique de tout `RAISE EXCEPTION` | `GX001`, rattrapé seul. Aucun trigger utilisateur n'existe sur les quatre tables |
| Unicode | Le validateur coupait la chaîne avant NFC. Deux formes canoniques longues pouvaient donner `KEY_CONFLICT` | Le validateur fait `trim` puis `normalize('NFC')`. `left()` dans la fonction est la seule limite de longueur |
| Réponses 201 et 200 | `$('Créer rendez-vous').item`, qui dépend du chaînage à travers le Switch | `$json.<champ>` de la ligne transmise par `Conserver le résultat` puis par le Switch. `issue` reste hors du JSON public |
| Appel et hash | Noms non qualifiés | `public.creer_rendez_vous_idempotent` et `public.digest` |

## 2. Audit SQL

Fichier : `postgres/migrations/20261029_rec007_idempotence.sql`.

La signature est `public.creer_rendez_vous_idempotent(uuid, text, text, text, text, text, text, text)`, soit `p_slot`, `p_nom`, `p_prenom`, `p_email`, `p_telephone`, `p_document`, `p_langue`, `p_cle`. Elle est `VOLATILE`, `SECURITY INVOKER`, `search_path = pg_catalog, public`. `REVOKE ALL FROM PUBLIC` puis `GRANT EXECUTE TO govsuite`. Le rôle lu dans la base est `govsuite`. `digest` est dans `public` ; `normalize` et `gen_random_uuid` sont dans `pg_catalog`. Il n'y a pas de `EXECUTE` dynamique. Le seul `EXECUTE` du fichier est le `GRANT`.

Les noms ont été relus dans `information_schema` et `pg_constraint`.

| Objet réel | Usage dans la fonction |
|---|---|
| `rendez_vous` | Insertion `CONFIRME`, valeur présente dans `rendez_vous_statut_check` |
| `creneaux.statut` | `DISPONIBLE` et `COMPLET`, présents dans `creneaux_statut_check`. `BLOQUE` et `ANNULE` ne passent pas le filtre |
| `creneaux.places_reservees`, `capacite` | Incrément sous `ck_creneau_places` (`places_reservees <= capacite`) |
| `historique_rendez_vous` | `action` `varchar(50)` sans liste fermée, `nouveau_statut`, `details jsonb`. `acteur` reste au défaut `SYSTEM` |
| `notifications` | `CONFIRMATION`, `EMAIL`, `A_ENVOYER`, `destinataire` non nul. `ON CONFLICT (rendez_vous_id, type, canal)` vise `notifications_rendez_vous_id_type_canal_key` |
| `services.code`, `sites.code` | `varchar(30)`, renvoyés comme code de service et de site |
| Référence | `varchar(40)`. La forme `GB-YYYY-XXXXXXXX` tient dans la colonne. L'unicité réelle est `rendez_vous_reference_key` |
| Jeton | Défaut `gen_random_uuid()`, unicité `rendez_vous_token_gestion_key` |

`RETURN QUERY` vers `character varying` sans longueur est compatible avec un `varchar(n)` source. Dans `compatible_tupdescs` de PostgreSQL 16, le typmod de destination vaut -1 et n'est pas comparé. Ce n'est pas une erreur de structure.

`GET DIAGNOSTICS v_places = ROW_COUNT` suit immédiatement l'`UPDATE`. `GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME` est dans le handler `unique_violation`, le seul endroit où cette forme est valide. Si le nom n'est pas `uq_rendez_vous_cle_idempotence`, l'exception est relancée. PostgreSQL signale un index unique avec ce nom comme contrainte homonyme. Un nom différent donnerait HTTP 500, la place de la perdante serait annulée, et un nouvel essai lirait la ligne gagnante.

Une clé nulle laisse les deux colonnes nulles. L'index partiel ignore ces lignes. Une chaîne vide devient nulle dans le nœud, puis encore dans la fonction. L'empreinte est le SHA-256 du texte d'un `jsonb_build_object` dont les clés sont stables. `slotId` est en minuscules. Le courriel n'est mis en minuscules que dans l'empreinte. `normalize(..., NFC)` utilise le mot-clé SQL, pas une chaîne. Un courriel nul reste nul dans le jsonb.

Les quatre écritures d'un `CREATED` tiennent dans la même sous-transaction : rendez-vous, place, historique, notification si l'adresse est présente. `unique_violation` et `GX001` annulent cette sous-transaction ensemble. Le verrou de ligne du créneau, pris avant elle, reste tenu jusqu'à la fin de l'appel. Aucun secret n'est écrit dans les réponses `KEY_CONFLICT` et `SLOT_UNAVAILABLE` : tous les champs métier y sont nuls.

### Course et HTTP 409

Après correction, un rendez-vous déjà validé avec la même clé et la même empreinte ne reçoit pas HTTP 409.

1. Capacité 1, deux appels identiques. Le verrou de `creneaux` les sérialise. Le gagnant valide. Le second, au réveil, voit le filtre `places_reservees < capacite` échouer sous `read committed`. Il relit la clé. La ligne est visible. L'empreinte est égale. L'issue est `REPLAYED`, donc HTTP 200.
2. Capacité supérieure à 1, même clé, même corps. Les deux peuvent dépasser le filtre de place. La perdante prend `unique_violation`, annule sa place, relit la gagnante et répond `REPLAYED`.
3. Le premier appel est annulé avant `COMMIT`. Le second voit la place libre et répond `CREATED`.
4. Une autre clé a pris la dernière place. La relecture ne trouve pas la clé de l'appelant. L'issue est `SLOT_UNAVAILABLE`. Aucun rendez-vous de cette clé n'existe.
5. Même clé, corps différent. L'issue est `KEY_CONFLICT`, HTTP 409, sans jeton. C'est le seul HTTP 409 possible lorsqu'une ligne porte déjà cette clé.

Le chemin `P0001` d'origine, qui aurait pu transformer un `UPDATE` à zéro ligne en `SLOT_UNAVAILABLE` alors qu'une autre transaction venait d'insérer la même clé, est remplacé par `GX001` puis par la même relecture. Si la ligne identique est déjà validée, la réponse est `REPLAYED`.

## 3. Audit du rollback

Fichier : `postgres/migrations/20261029_rec007_idempotence_rollback.sql`.

La transaction active contient un seul ordre : `DROP FUNCTION IF EXISTS` sur la signature à huit arguments. Elle ne contient pas de `DELETE`, ni de `DROP COLUMN`, ni de `DROP INDEX`. Les clés déjà stockées restent dans les colonnes. Le retrait des colonnes, de l'index et de la contrainte est commenté et précédé d'un refus si une `cle_idempotence` est non nulle.

L'en-tête, complété par cet audit, arrête l'exécution dans quatre cas : le workflow 03 n'est pas revenu à `c48ffad5-4f36-4c7e-9abf-11ce6fa2d9e6` ; une création est en cours ; on voudrait enchaîner le bloc commenté alors qu'une clé doit survivre ; `DROP FUNCTION` échoue, ce qui annule la transaction. Seul le workflow préparé appelle la fonction. La version active ne la référence pas. Les colonnes nullables ne changent pas son SQL.

## 4. Audit n8n

Fichier : `n8n/live-exports/2026-10-29-rec007-phase7e-proposed/put-body.json`. Douze nœuds. Le credential PostgreSQL reste `LlHYqyFvq4IkYbhP`, nom `credentials PostgreSQL`. Le nœud Postgres garde `typeVersion` 2.6, `alwaysOutputData` et `onError: continueErrorOutput`. Le payload n'a ni `active`, ni `versionId`, ni `binaryMode`.

| Nœud | Rôle vérifié |
|---|---|
| `POST /appointments` | Inchangé, `responseMode: responseNode`, chemin `appointments` |
| `Valider demande` | Alias corps et en-tête, clé 16 à 128, NFC avant tout envoi SQL, `null` si la clé est absente |
| `Demande valide ?` | Inchangé, vrai vers la création, faux vers HTTP 400 |
| `Créer rendez-vous` | `$1::uuid` à `$8`, huit valeurs dans `queryReplacement`, aucune accolade dans le SQL |
| `Conserver le résultat` | Inchangé. Si la sortie d'erreur a des éléments, il ne laisse pas partir un second succès |
| `Classer le résultat` | Switch 3.4, `rules.values`, quatre règles puis `fallbackOutput: extra` |
| `Répondre` | HTTP 201, `success` et `appointment`, dix champs, sans `issue` |
| `Répondre replay` | HTTP 200, `created: false`, `replayed: true`, mêmes champs, y compris le jeton |
| `Répondre conflit idempotence` | HTTP 409 statique, `IDEMPOTENCY_KEY_CONFLICT`, sans appointment |
| `Répondre créneau indisponible` | HTTP 409, message fixe `Créneau introuvable ou complet` |
| `Répondre validation` | HTTP 400 inchangé |
| `Répondre erreur interne` | HTTP 500 inchangé, sans donnée SQL |

Sorties du Switch, dans l'ordre : `CREATED`, `REPLAYED`, `KEY_CONFLICT`, `SLOT_UNAVAILABLE`, repli vers HTTP 500. La sortie d'erreur Postgres va aussi vers HTTP 500. Aucune connexion ne cite un nœud absent. `Vérifier création` et `If` sont absents.

La correspondance des champs est la même de bout en bout : `slotId`, `nom`, `prenom`, `email`, `telephone`, `numeroDocument`, `langue`, `cleIdempotence` deviennent `$1` à `$8`, puis les paramètres de la fonction. L'issue lue par le Switch est la colonne `issue`. Les réponses 201 et 200 lisent la ligne courante, qui est cette même sortie, et n'y reprennent pas `issue`.

Le contrat HTTP 201 actuel reste `success: true` et `appointment` avec `id`, `reference`, `token_gestion`, `statut`, `email`, `telephone`, `debut`, `fin`, `service`, `site`. Le nœud 201 d'aujourd'hui sérialisait déjà l'objet renvoyé par le SQL, pas le champ `created` ajouté plus loin par `Vérifier création`.

## 5. Empreintes

| Fichier | Avant l'audit | Après correction |
|---|---|---|
| Migration | 10 431 octets, `15c25636ad17919a0c31beae242a032913367689b83567468c7ec0ea9d8bf832` | 10 575 octets, `8df62d2319b75a9e8f2ad1cbe02a80b8de3a29b9cdd442c9e40950b70a033b4e` |
| Rollback | 1 144 octets, `44ea62bcee1f30ecb648d6642b94ecb2773c2d61c8379dcc3bd1b020b8df6106` | 1 777 octets, `dc006846bb7ee48d72b93b990a74f2d637307fd5eba4f79719ebc5c8c07019d7` |
| Payload | 14 422 octets, `edbc7a76b63579aa9a4f75c7baccb48b1a630becdc67ce395f17b4805f92dd68` | 13 833 octets, `f6fd66f2885c8297da58bf021ce1dab49da9e11feb37d36d09f43c1f15ecffac` |

Le rapport 7E citait les empreintes d'avant correction et le SQLSTATE `P0001`. Son tableau d'empreintes et cette ligne ont été alignés sur les fichiers corrigés. L'export de la version active est inchangé : `6406c3c63d0e4125b41e52e90c803b4ee8d537525841a234f8114c3deca73754`.

## 6. Jeton de gestion au replay

`CREATED` et `REPLAYED` renvoient le jeton. C'est le rattrapage d'une réponse perdue : le client qui possède la clé et le même contenu retrouve le rendez-vous qu'il vient de créer. `KEY_CONFLICT` et le refus de créneau ne le renvoient pas. Une clé seule, ou la même clé avec un autre corps, ne suffit pas.

Ce risque est acceptable pour les essais locaux tant que le webhook reste sur la machine, que les clés de test sont tirées pour l'occasion, et qu'aucun journal ne recopie la clé brute. Les exécutions n8n conservent encore cette clé dans le corps reçu. Ce n'est pas un secret de production.

Avant une exposition publique, quatre protections deviennent obligatoires, et aucune n'est ajoutée ici :

1. Lier l'identité de l'appelant au hash stocké, `SHA-256(identifiant d'appelant || clé brute)`, pour qu'un tiers qui rejoue la clé et le corps ne reçoive pas le jeton.
2. Cesser de renvoyer le jeton au replay dès qu'une lecture authentifiée séparée existe.
3. Exiger une clé à entropie réelle, au-delà du seul filtre de 16 caractères.
4. Limiter la conservation des exécutions n8n qui contiennent la clé brute, et ne pas la journaliser.

## 7. Procédure de migration contrôlée

À n'exécuter qu'avec une autorisation distincte. S'arrêter au premier écart.

1. Relire le workflow 03 : actif, 11 nœuds, version `c48ffad5-4f36-4c7e-9abf-11ce6fa2d9e6`. Les workflows 08 et 10 restent inactifs.
2. Relire les compteurs : 13 rendez-vous, empreinte `a2dea067599fd4f0a5f857551adc67cc`, 14 notifications, 12 historiques, 48 sessions.
3. Vérifier l'empreinte `8df62d2319b75a9e8f2ad1cbe02a80b8de3a29b9cdd442c9e40950b70a033b4e` du fichier de migration.
4. L'appliquer en une transaction, avec arrêt à la première erreur. Le workflow actif n'appelle pas la fonction : les colonnes nullables ne changent pas son comportement.
5. Vérifier la contrainte, l'index partiel, la fonction, le `GRANT`, puis les mêmes compteurs et la même empreinte.
6. Ne pas envoyer le payload dans ce palier.

Avant toute publication ultérieure du workflow, un appel de la fonction dans une transaction explicitement annulée devra montrer `CREATED`, puis `REPLAYED` sur la même clé, puis l'empreinte des 13 rendez-vous inchangée après `ROLLBACK`. Cet appel n'est pas le webhook. S'il échoue, la publication est arrêtée et le rollback SQL ci-dessous s'applique.

## 8. Plan de retour arrière

1. Si seule la migration a été appliquée et que le workflow est encore `c48ffad5`, exécuter le rollback SQL. La fonction disparaît. Les colonnes et les éventuelles clés restent. Le workflow actuel continue de créer sans ces colonnes.
2. Si le workflow préparé a été publié et qu'il faut revenir : activer d'abord `c48ffad5-4f36-4c7e-9abf-11ce6fa2d9e6`, vérifier qu'il est actif, puis seulement ensuite retirer la fonction. L'ordre inverse fait répondre HTTP 500 au webhook.
3. Ne pas republier `740ca2ae-87ea-4323-aa69-cfd57d869fc1`.
4. Ne pas exécuter le bloc commenté de suppression des colonnes tant qu'une clé doit survivre. Le bloc s'arrête de lui-même si une clé est présente, mais il ne doit pas être décommenté par défaut.
5. Payload de publication ultérieure, hors de ce palier : empreinte `f6fd66f2885c8297da58bf021ce1dab49da9e11feb37d36d09f43c1f15ecffac`.

## 9. Points non bloquants

| Point | Effet |
|---|---|
| Nom de contrainte d'index inattendu | HTTP 500 pour la perdante, puis `REPLAYED` au nouvel essai. Pas de double place |
| Clé de 16 caractères peu aléatoire | Le filtre de forme ne mesure pas l'entropie |
| Exécutions n8n | Elles gardent la clé brute |
| Collision sur 8 caractères hexadécimaux de référence | HTTP 500, clé non consommée |
| `DELETE` physique | Libère la clé. Réservé aux nettoyages de test |
| Deux formes de HTTP 409 | Le créneau garde son message. Le conflit porte `error.code` |
| Absence de clé | Plusieurs créations restent possibles |
| Pas d'expiration | La clé vit avec la ligne |

## 10. Verdict

**GO** pour appliquer, dans une autorisation ultérieure et dans ce seul palier, la migration corrigée `8df62d2319b75a9e8f2ad1cbe02a80b8de3a29b9cdd442c9e40950b70a033b4e`. L'ambiguïté qui faisait échouer chaque création est corrigée. Le scénario à une place répond `REPLAYED`, pas HTTP 409, lorsque la même clé et le même contenu viennent d'être validés.

**NO-GO** pour exécuter cette migration dans la présente phase.

**NO-GO** pour publier `put-body.json` dans le palier de migration. La publication attend la migration, puis l'appel de fonction annulé décrit à la section 7.

Cette phase s'arrête ici.
