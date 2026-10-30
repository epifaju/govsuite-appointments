# REC-007 — Phase 7E — Préparation de l'idempotence

Préparation seulement. La migration n'a pas été exécutée. Le payload n8n n'a pas été envoyé. Aucun rendez-vous n'a été créé, aucun courriel n'a été envoyé, les workflows 08 et 10 sont restés inactifs, et REC-008 n'est pas commencé.

## 1. État relu

| Contrôle | Résultat |
|---|---|
| Workflow 03 `SXCesRUmGrV5FMzm` | Actif, 11 nœuds, version `c48ffad5-4f36-4c7e-9abf-11ce6fa2d9e6`, `versionCounter` 29 |
| Workflow 08 `ZbZoj4yF1s5a3B5E` | Inactif, version `43167625-0a3b-42fa-861c-60f55f316379`, 5 nœuds |
| Workflow 10 `R7TKt5mqZYpeKapl` | Inactif, version `88a1f42a-ab9e-4eff-bfd9-996c31976b16`, 84 nœuds |
| Rendez-vous | 13, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Notifications, historiques, sessions | 14, 12, 48 |
| Colonnes `cle_idempotence` et `empreinte_requete` | Absentes |
| Fonction `creer_rendez_vous_idempotent` | Absente |

La lecture API et la lecture des compteurs concordent. L'état n'a pas changé depuis la phase 7D. La sauvegarde du workflow actif est `n8n/live-exports/2026-10-29-rec007-phase7e-before/SXCesRUmGrV5FMzm.json`, 10 705 octets, SHA-256 `6406c3c63d0e4125b41e52e90c803b4ee8d537525841a234f8114c3deca73754`.

## 2. Course sur un créneau à une place

Le rapport 7D tranchait deux insertions simultanées par `unique_violation`. Ce chemin est exact quand les deux appels dépassent le contrôle de capacité et tentent tous les deux l'insertion. Il ne couvre pas le cas demandé ici.

Avec une seule place, les deux appels portent la même clé et le même contenu.

1. Aucun des deux ne voit encore la clé. `SELECT FOR UPDATE` sur une clé absente ne bloque personne.
2. Les deux demandent le verrou de ligne du créneau. Le premier l'obtient, insère le rendez-vous, incrémente la place et valide.
3. Le second, qui attendait ce verrou, relit le créneau. Sous `read committed`, la condition `places_reservees < capacite` est réévaluée. Elle échoue. Il n'y a pas d'insertion, donc pas de `unique_violation`.
4. La fonction relit alors la clé. La ligne du premier est visible. L'empreinte est identique. Le second répond `REPLAYED`.

Cette seconde lecture est aussi faite si la mise à jour de la place touche zéro ligne (`SQLSTATE P0001`). La sous-transaction annule alors l'insertion déjà tentée, puis la clé est relue.

Comportement si le premier appel n'aboutit pas :

- Annulation ou erreur avant `COMMIT` : aucune ligne, verrou libéré. Le second réévalue le créneau. La place est libre, il crée et répond `CREATED`.
- La connexion HTTP du premier est coupée après `COMMIT` : la ligne existe. Le nouvel essai répond `REPLAYED`.
- Un autre rendez-vous, porté par une autre clé, a pris la dernière place : la relecture de clé ne trouve rien. La réponse est `SLOT_UNAVAILABLE`.
- Même clé et contenu différent sur ce créneau saturé : la relecture trouve la ligne, l'empreinte diffère, la réponse est `KEY_CONFLICT`, sans identifiant ni jeton.

Deux créneaux différents et la même clé restent couverts par l'index unique. La perdante annule sa sous-transaction, donc sa place, puis relit la gagnante.

Aucun verrou n'est posé dans n8n. Le verrou est celui de la ligne `creneaux`, et l'unicité est celle de l'index partiel.

## 3. Contrat de sécurité

La clé brute fait 16 à 128 caractères, alphabet `A-Za-z0-9._~-`, sensible à la casse. Elle n'est pas mise en minuscules. `cleIdempotence` dans le corps et `Idempotency-Key` dans l'en-tête sont deux alias d'une seule valeur. S'ils sont tous les deux présents et différents, la réponse est HTTP 400, avant SQL. Une valeur vide ou faite d'espaces signifie qu'il n'y a pas de clé. L'exemple `req-123` est trop court et reçoit HTTP 400, sans que la valeur soit recopiée dans le message.

La base ne reçoit que le SHA-256 hexadécimal de la clé, dans `cle_idempotence varchar(64)`. L'empreinte SHA-256 du contenu est une seconde colonne, `empreinte_requete`. La clé brute n'entre pas dans cette empreinte. `varchar` est retenu : `char(64)` compléterait avec des espaces et casserait l'égalité.

La fonction est l'autorité de normalisation. Chaque champ texte est trimé, passé en Unicode NFC, puis limité à sa longueur de colonne. L'adresse est ensuite comparée en minuscules dans l'empreinte seulement. La valeur stockée conserve la casse du premier appel. `slotId` est mis en minuscules dans l'empreinte. L'ordre des clés `jsonb` est stable, donc le texte haché l'est aussi.

La portée de la clé est la table `rendez_vous` entière. Elle n'est pas limitée à un site, à un service ni à un appelant : le webhook n'a pas d'identité d'appelant. Deux demandes qui présentent la même clé se rapportent au même rendez-vous, ou entrent en conflit.

Le replay `CREATED` et `REPLAYED` renvoie `token_gestion`. C'est le rattrapage d'une réponse perdue. `KEY_CONFLICT` et `SLOT_UNAVAILABLE` renvoient l'issue et des champs nuls : pas d'identifiant, pas de référence, pas de jeton. Une clé seule ne suffit pas. Il faut la même empreinte de contenu. Une clé accompagnée d'un autre corps obtient un HTTP 409 sans donnée métier.

Ce renvoi du jeton reste un accès pour quiconque possède à la fois la clé et le corps d'origine. Aucune authentification nouvelle n'est ajoutée dans cette phase. Pour un webhook public ultérieur, le mécanisme prévu est de lier l'identité de l'appelant au hash stocké, sous la forme `SHA-256(identifiant d'appelant || clé brute)`, ou de cesser de renvoyer le jeton au replay le jour où une lecture authentifiée séparée existera. Les deux restent hors de ce palier. Les exécutions n8n conservent encore la clé brute dans le corps reçu. Le hash en base ne les efface pas. Les journaux ne doivent pas la recopier.

## 4. Annulation et replanification

L'annulation et la replanification modifient la même ligne. La clé et l'empreinte d'origine restent. Un replay du corps initial répond `REPLAYED` avec le statut courant, `ANNULE` ou `REPLANIFIE`, et avec les horaires du créneau actuellement lié. Le contrôle `debut > now()` et le contrôle de capacité ne sont pas refaits. Le même corps reste donc rejouable après un déplacement de créneau.

Le même clé avec un nouveau `slotId` produit `KEY_CONFLICT`. Une nouvelle réservation après annulation demande une nouvelle clé. Une suppression physique retire l'index avec la ligne et libère la clé. Elle reste réservée au nettoyage des tests. En service, l'annulation passe par le statut.

Un premier refus, créneau complet ou passé, n'insère rien et ne consomme pas la clé.

## 5. Fichiers et empreintes

| Fichier | Octets | SHA-256 |
|---|---:|---|
| `postgres/migrations/20261029_rec007_idempotence.sql` | 10 575 | `8df62d2319b75a9e8f2ad1cbe02a80b8de3a29b9cdd442c9e40950b70a033b4e` |
| `postgres/migrations/20261029_rec007_idempotence_rollback.sql` | 1 777 | `dc006846bb7ee48d72b93b990a74f2d637307fd5eba4f79719ebc5c8c07019d7` |
| `n8n/live-exports/2026-10-29-rec007-phase7e-proposed/put-body.json` | 13 833 | `f6fd66f2885c8297da58bf021ce1dab49da9e11feb37d36d09f43c1f15ecffac` |
| `n8n/live-exports/2026-10-29-rec007-phase7e-before/SXCesRUmGrV5FMzm.json` | 10 705 | `6406c3c63d0e4125b41e52e90c803b4ee8d537525841a234f8114c3deca73754` |

L'audit 7F a corrigé les trois premiers fichiers. Les empreintes de ce tableau sont celles d'après correction. Le détail est dans `docs/recovery/REC_007_PHASE7F_AUDIT_REPORT.md`.

La migration est une transaction `BEGIN` / `COMMIT`. Elle ajoute les deux colonnes nullables, la contrainte `ck_rendez_vous_idempotence`, l'index unique partiel `uq_rendez_vous_cle_idempotence`, les commentaires, puis la fonction. `REVOKE ALL FROM PUBLIC` et `GRANT EXECUTE TO govsuite` portent la signature à huit arguments. `search_path` est `pg_catalog, public`. La fonction est `SECURITY INVOKER`.

Paramètres, dans l'ordre : `p_slot uuid`, `p_nom`, `p_prenom`, `p_email`, `p_telephone`, `p_document`, `p_langue`, `p_cle`. L'appel n8n lie `$1` à `$8` dans le même ordre. Les chaînes vides d'adresse, de téléphone, de document, de langue et de clé deviennent `NULL` avant l'appel. Le SQL du nœud ne contient aucune expression `{{ }}` et aucun texte utilisateur interpolé. La fonction n'exécute pas de SQL dynamique.

Sans clé, les deux colonnes restent nulles et l'index partiel ne s'applique pas. Plusieurs créations restent possibles. Avec clé, une seule ligne peut porter le hash. `CREATED` écrit le rendez-vous, la place, l'historique `CREATION` et, seulement si l'adresse est présente, la notification `CONFIRMATION` / `EMAIL` / `A_ENVOYER`. Les quatre issues sont `CREATED`, `REPLAYED`, `KEY_CONFLICT` et `SLOT_UNAVAILABLE`. La fonction renvoie toujours une ligne sur ces issues. Un `unique_violation` dont le nom n'est pas `uq_rendez_vous_cle_idempotence` est relancé. Les autres erreurs sortent de la fonction et annulent l'instruction.

Le rollback actif retire seulement la fonction, à la signature exacte. Le retrait de l'index, de la contrainte et des colonnes est commenté. Le bloc commenté refuse ce retrait si une `cle_idempotence` est déjà remplie. Il ne faut pas l'activer tant qu'une clé réelle doit survivre, ni tant que le workflow publié appelle la fonction.

La syntaxe a été relue statiquement. Le fichier n'a pas été soumis à PostgreSQL, pour ne pas prendre le verrou d'un `ALTER TABLE` même dans une transaction annulée.

## 6. Différence exacte du workflow

Base : les 11 nœuds de `c48ffad5-4f36-4c7e-9abf-11ce6fa2d9e6`. Le payload préparé en a 12. Il n'envoie ni `active`, ni `versionId`, ni `binaryMode`. Le credential PostgreSQL `LlHYqyFvq4IkYbhP` est conservé.

| Graphe | Détail |
|---|---|
| Retirés | `Vérifier création`, `If` |
| Ajoutés | `Classer le résultat` (`4c1a9e2b-7d55-4f18-9c3a-6e8b0a1d2f47`, Switch 3.4), `Répondre replay` (`a9e3c1d4-2b67-4e90-8f15-3c7d6a0b5e28`), `Répondre conflit idempotence` (`b2d4f6a8-1c35-4a79-9e02-5f8c7b6d4e10`) |
| Modifiés | `Valider demande`, `Créer rendez-vous`, `Répondre`, `Répondre créneau indisponible` |
| Inchangés | `POST /appointments`, `Demande valide ?`, `Conserver le résultat`, `Répondre validation`, `Répondre erreur interne` |

Connexions : `Conserver le résultat` va vers `Classer le résultat`. Les cinq sorties du Switch sont `CREATED` vers `Répondre`, `REPLAYED` vers `Répondre replay`, `KEY_CONFLICT` vers `Répondre conflit idempotence`, `SLOT_UNAVAILABLE` vers `Répondre créneau indisponible`, et la sortie de repli vers `Répondre erreur interne`. La sortie d'erreur de `Créer rendez-vous` va toujours vers HTTP 500. Aucune connexion ne vise un nœud absent. Les nœuds retirés ne sont plus référencés.

`Créer rendez-vous` appelle `creer_rendez_vous_idempotent` et projette `issue` plus les dix champs historiques. `Répondre` reste HTTP 201. Son corps liste `id`, `reference`, `token_gestion`, `statut`, `email`, `telephone`, `debut`, `fin`, `service` et `site`. La colonne `issue` n'entre pas dans le JSON public. La forme reste `success` et `appointment`.

`Répondre replay` est HTTP 200, avec `created: false`, `replayed: true` et les mêmes champs. `Répondre conflit idempotence` est HTTP 409, corps statique `error.code = IDEMPOTENCY_KEY_CONFLICT`, sans appointment. `Répondre créneau indisponible` reste HTTP 409. Son message est fixé à `Créneau introuvable ou complet`, le texte que `Vérifier création` plaçait aujourd'hui dans `$json.message`. HTTP 400 et HTTP 500 sont inchangés, le second sans donnée SQL.

## 7. Vérifications statiques

| Contrôle | Résultat |
|---|---|
| Transaction et signature à huit paramètres | Présentes |
| Seconde lecture de clé après échec de disponibilité, et après `GX001` | Présente, trois lectures de `cle_idempotence = v_hash` au moins |
| `EXECUTE` dynamique | Absent. Le seul `EXECUTE` est le `GRANT` |
| Rollback actif supprime des colonnes | Non |
| Nœuds et orphelins | 12 nœuds, aucune connexion orpheline |
| `$1` à `$8`, sans interpolation | Oui, huit `$json` dans `queryReplacement` |
| Validateur | Syntaxe acceptée comme corps de fonction n8n |
| HTTP 201, 200, 409 de conflit, 409 de créneau, 500 | Codes et corps conformes |
| Payload sans `active` ni `binaryMode` | Oui |

## 8. Matrice de tests

Aucun de ces tests n'a été exécuté. Ils ne doivent pas partir vers le webhook actif dans cette phase. Chaque création future utilise une clé neuve, relit le créneau juste avant l'appel, puis s'arrête si le compteur, la place, la notification ou l'historique ne correspondent pas. On ne réessaie pas un appel ambigu avant d'avoir lu la base. Un jeton présent dans un HTTP 409 de conflit est un arrêt.

| Test | Attendu | Contrôle SQL | Nettoyage |
|---|---|---|---|
| Création 201 | Clé neuve, adresse présente, HTTP 201, corps actuel sans champ `issue` | 1 rendez-vous, 1 place, 1 `CREATION`, 1 notification `A_ENVOYER`, hash et empreinte remplis | Après le replay et le conflit de cette clé |
| Replay 200 | Même clé, même corps, HTTP 200 `replayed: true`, mêmes identifiant, référence et jeton | Aucune place, notification ou historique supplémentaire | Avec la ligne du premier appel |
| Conflit 409 | Même clé, nom différent, HTTP 409 `IDEMPOTENCY_KEY_CONFLICT`, sans appointment | La première ligne inchangée | Même nettoyage |
| Concurrence, capacité 1 | Deux POST simultanés, même clé, même corps, une place | Un HTTP 201 et un HTTP 200. Une ligne, une place, une notification, un historique | Supprimer cette seule ligne et recalculer la place |
| Premier appel annulé | Le premier transactionnel est annulé avant `COMMIT`, le second attendait le créneau | Le second crée. Une seule ligne | Supprimer cette ligne |
| Dernière place prise par une autre clé | Le second porte une clé neuve | HTTP 409 de créneau. Sa clé n'est pas enregistrée | Aucun, hors la ligne du gagnant si elle est synthétique |
| Avec adresse, puis sans adresse | Deux clés neuves | La première a une notification. La seconde a `email` NULL, zéro notification, un historique. Chaque replay n'ajoute rien | Supprimer chaque ligne avant la suivante |
| Clé absente | Deux corps identiques sans clé | Deux HTTP 201, deux rendez-vous, colonnes d'idempotence nulles | Supprimer les deux |
| Créneau complet | Capacité déjà atteinte, clé neuve | HTTP 409 `Créneau introuvable ou complet`. Clé non enregistrée | Aucun |
| Créneau passé | Début déjà passé, statut encore `DISPONIBLE` | Même HTTP 409. Un second appel identique reste 409 | Aucun |
| Annulation | Ligne créée, puis statut `ANNULE` sur cette seule ligne | Replay HTTP 200, statut `ANNULE`, même jeton, pas de second rendez-vous | Supprimer la ligne de test |
| Replanification | Même ligne déplacée vers un autre créneau de test | Le corps initial rejoue en HTTP 200 avec les horaires courants. Le même clé et un nouveau `slotId` donnent HTTP 409 de conflit | Restaurer ou supprimer la ligne, puis recalculer les deux créneaux |
| Erreur SQL | Appel de la fonction dans une transaction explicitement annulée, hors webhook | Après `ROLLBACK`, aucune ligne, places inchangées | La transaction de test annule déjà tout |
| Nettoyage ciblé | Identité, créneau et clé de la seule ligne synthétique vérifiés sous verrou | Retour à 13 rendez-vous, empreinte `a2dea067599fd4f0a5f857551adc67cc`, 14 notifications, 12 historiques, 48 sessions | `ROLLBACK` si un contrôle échoue |

Le test d'erreur SQL et le test du premier appel annulé n'utilisent pas le webhook. Le nettoyage d'une ligne de test reprend le protocole déjà utilisé : verrou de la ligne et du créneau, contrôle de l'identité, suppression de cette seule ligne, recalcul des places, contrôle de l'empreinte, puis `COMMIT`.

## 9. Risques résiduels

| Risque | Effet |
|---|---|
| Le diagnostic `CONSTRAINT_NAME` d'un index unique diffère du nom prévu | La perdante reçoit HTTP 500, sa place est annulée, et un nouvel essai répond `REPLAYED`. Pas de double réservation |
| Le webhook n'authentifie pas l'appelant | Le détenteur de la clé et du corps d'origine reçoit le jeton au replay. La liaison d'identité est reportée |
| Les exécutions n8n gardent la clé brute | Le hash en base ne couvre pas cet historique |
| Une clé courte mais syntaxiquement valide peut être peu aléatoire | La longueur minimale est 16. L'entropie reste à la charge de l'émetteur. Le workflow 10, plus tard, devra tirer une clé longue |
| Absence de clé | Plusieurs créations du même contenu restent possibles. C'est le contrat de compatibilité |
| `DELETE` physique | Libère la clé. Réservé aux tests |
| Deux HTTP 409 | Le créneau garde son message texte. Le conflit de clé porte `error.code` |
| Collision de référence sur 8 caractères hexadécimaux | HTTP 500, insertion annulée, clé non consommée |
| Pas d'expiration | Une clé vit avec la ligne. Une expiration indépendante justifierait une table dédiée, hors de cette version |
| Ancien workflow après la migration | Il ignore les colonnes nullables. Il ne faut publier le payload qu'après la migration, dans une autorisation séparée |
| Retrait des colonnes | Interdit tant qu'une clé à conserver existe |

## 10. Verdict

**GO** pour appliquer, dans une autorisation ultérieure et dans ce seul palier, la migration `postgres/migrations/20261029_rec007_idempotence.sql`. Elle est additive. Le workflow actif ne l'appelle pas. Avant de l'exécuter, relire la version `c48ffad5-4f36-4c7e-9abf-11ce6fa2d9e6`, les 11 nœuds, les workflows 08 et 10 inactifs, et l'empreinte `a2dea067599fd4f0a5f857551adc67cc`. L'exécuter dans sa transaction, puis revérifier les compteurs et l'empreinte.

**NO-GO** pour envoyer `put-body.json` dans ce même palier. Le payload SHA-256 `f6fd66f2885c8297da58bf021ce1dab49da9e11feb37d36d09f43c1f15ecffac` attend une autorisation distincte, après la migration. Le retour arrière du workflow sera alors l'activation de `c48ffad5-4f36-4c7e-9abf-11ce6fa2d9e6`. Ne pas republier `740ca2ae-87ea-4323-aa69-cfd57d869fc1`. Ne pas retirer les colonnes par défaut.

Cette phase s'arrête ici.
