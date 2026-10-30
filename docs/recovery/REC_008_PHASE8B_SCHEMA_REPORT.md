# REC-008 — Phase 8B — Schéma des tentatives

Les fichiers SQL sont préparés. La migration n'a pas été exécutée. Les tests n'ont pas été lancés. Aucune table existante n'a été modifiée.

## 1. Préflight

PostgreSQL 16.14. Lecture seule du 30 octobre 2026.

| Contrôle | Résultat |
|---|---|
| `ai_conversation_state.session_id` | `varchar(255)`, obligatoire |
| Clé primaire de session | `ai_conversation_state_pkey` sur `id` |
| Unicité de session | `ai_conversation_state_session_id_key` sur `session_id` |
| Autres index de session | `idx_ai_conversation_state_expires`, `idx_ai_conversation_state_session` |
| `rendez_vous.id` | `uuid` |
| `rendez_vous.reference` | `varchar(40)` |
| `rendez_vous.token_gestion` | `uuid`, présent sur le rendez-vous, absent du schéma proposé |
| Workflow 03 | Actif, 12 nœuds, `2d72700c-d731-47e1-b6d6-82c5c684f055` |
| Workflow 10 | Inactif, 84 nœuds |
| Workflow 08 | Inactif, 5 nœuds |
| Compteurs | 13 rendez-vous, 14 notifications, 12 historiques, 48 sessions |
| Empreinte | `a2dea067599fd4f0a5f857551adc67cc` |
| `ai_appointment_attempt` | Absente |
| `pgcrypto` | Présente dans `public` ; la migration n'en a pas besoin |

Aucune clé étrangère n'est proposée. Une référence vers `ai_conversation_state(session_id)` ajouterait un contrôle d'intégrité sur les 48 sessions et lierait la durée de vie d'une tentative incertaine à la suppression de la session. Une référence vers `rendez_vous(id)` ferait la même chose sur les rendez-vous. `session_id` reprend seulement le type `varchar(255)`. `appointment_reference` reprend la longueur 40 de `rendez_vous.reference`.

## 2. Schéma préparé

Fichier : `postgres/migrations/20261030_rec008_attempts.sql`.

Table `public.ai_appointment_attempt`.

| Colonne | Type | Rôle |
|---|---|---|
| `id` | `uuid`, clé primaire, `gen_random_uuid()` | Identité de tentative, créée une fois |
| `session_id` | `varchar(255)` obligatoire | Session du chat |
| `idempotency_key` | `varchar(128)` nullable | Clé brute, une par tentative |
| `request_payload` | `jsonb` nullable | Corps figé envoyé au workflow 03 |
| `request_fingerprint` | `varchar(64)` obligatoire | SHA-256 hexadécimal du corps canonique |
| `status` | `varchar(32)` obligatoire | Cycle de vie |
| `appointment_id` | `uuid` nullable | Rendez-vous confirmé |
| `appointment_reference` | `varchar(40)` nullable | Référence confirmée |
| `created_at`, `updated_at` | `timestamptz` obligatoires | Création et dernière transition |
| `expires_at` | `timestamptz` obligatoire | Fin de l'attente |
| `submitted_at` | `timestamptz` nullable | Premier passage à `SUBMITTING` |
| `confirmed_at` | `timestamptz` nullable | Passage à `CONFIRMED` |
| `lease_owner` | `varchar(64)` nullable | Détenteur du traitement |
| `lease_until` | `timestamptz` nullable | Fin du bail de 90 secondes |
| `resume_count` | `integer` obligatoire, défaut 0 | Nombre de reprises |

Les statuts ouverts sont `AWAITING_CONFIRMATION`, `SUBMITTING` et `UNCERTAIN`. Les statuts définitifs sont `CONFIRMED`, `ABANDONED`, `REJECTED`, `SLOT_UNAVAILABLE` et `EXPIRED`.

L'index unique partiel `uq_ai_appointment_attempt_session_ouverte` ne porte que sur les trois statuts ouverts. Une tentative abandonnée, expirée, refusée, indisponible ou confirmée ne bloque pas la suivante.

`uq_ai_appointment_attempt_idempotency_key` est unique tant que la clé est renseignée. Après effacement, la valeur nulle sort de l'index.

`idx_ai_appointment_attempt_reprise` couvre `SUBMITTING` et `UNCERTAIN`. `idx_ai_appointment_attempt_session_recent` retrouve la dernière tentative d'une session.

Le bail est justifié. Sans lui, deux messages simultanés pourraient lire la même ligne `UNCERTAIN` et envoyer deux fois le même corps. Le bail désigne un seul détenteur. Sa durée de 90 secondes doit rester supérieure au délai HTTP qui sera configuré plus tard. Si deux appels se chevauchent malgré tout, ils portent la même clé et le même corps : le workflow 03 répond `CREATED` puis `REPLAYED`, sans second rendez-vous.

La clé est produite par l'application avec un générateur cryptographique, au format `^[A-Za-z0-9._~-]{16,128}$`. La base ne lui donne pas de valeur par défaut, pour qu'un oubli échoue au lieu de créer une clé faible. Le corps doit contenir les huit champs du contrat, et `cleIdempotence` doit être identique à `idempotency_key`.

L'empreinte est calculée par l'application sur l'UTF-8 du JSON canonique, clés dans l'ordre `slotId`, `nom`, `prenom`, `email`, `telephone`, `numeroDocument`, `langue`, `cleIdempotence`, sans espace superflu. La base vérifie le format hexadécimal de 64 caractères. Elle ne recalcule pas le hash, afin de ne pas introduire une seconde canonisation.

Les contraintes de dates, de bail, de résultat et d'effacement sont dans le fichier. Un statut ouvert exige le corps et la clé. Un statut définitif exige leur absence. `CONFIRMED` exige l'identifiant et la référence, et aucun jeton. `SUBMITTING` est le seul statut qui porte un bail.

Cinq fonctions, `SECURITY INVOKER`, `search_path` fixé à `pg_catalog, public`, exécution retirée à `PUBLIC` et accordée à `govsuite` :

| Fonction | Effet |
|---|---|
| `reclamer_tentative_rendez_vous` | `AWAITING_CONFIRMATION` vers `SUBMITTING`, une seule fois, si l'attente n'est pas expirée |
| `reprendre_tentative_rendez_vous` | `UNCERTAIN`, ou `SUBMITTING` dont le bail est échu, vers un nouveau bail |
| `marquer_tentative_incertaine` | Le détenteur courant passe à `UNCERTAIN` sans effacer le corps |
| `cloturer_tentative_rendez_vous` | Abandon, refus, créneau indisponible ou confirmation, avec effacement du corps et de la clé |
| `expirer_tentatives_en_attente` | Seulement les attentes dont `expires_at` est dépassé |

`govsuite` reçoit `SELECT`, `INSERT`, `UPDATE` et `DELETE` sur la table. Aucun autre rôle n'est autorisé. Aucun trigger n'est créé. Aucun SQL dynamique n'est utilisé. Le fichier tient dans une transaction.

## 3. Concurrence et reprise

La réclamation est un seul `UPDATE ... WHERE status = 'AWAITING_CONFIRMATION' ... RETURNING`. La ligne mise à jour est verrouillée. La seconde exécution lit le nouveau statut et reçoit `acquired = false`, avec un corps nul. Elle ne doit pas envoyer le `POST`.

La reprise utilise le même modèle. Elle ne modifie ni `request_payload` ni `idempotency_key`. Elle n'atteint une ligne `SUBMITTING` que si `lease_until` est déjà passé. Deux reprises simultanées : une obtient le bail et incrémente `resume_count`, l'autre reçoit `acquired = false`.

`submitted_at` est posé à la première réclamation et n'est pas déplacé par une reprise. `resume_count` reste 0 jusqu'à la première reprise.

Si `cloturer_tentative_rendez_vous` retourne faux après un HTTP déjà parti, l'exécution relit la ligne. Elle ne crée pas une nouvelle tentative.

## 4. Confidentialité

La clé brute reste dans la table seulement pendant les statuts ouverts. Le corps JSON, qui contient le nom, le prénom, l'adresse, le téléphone et le document, suit la même règle. L'empreinte, l'identifiant de tentative, le statut, l'identifiant de rendez-vous et la référence peuvent rester.

| Situation | Corps et clé | Référence |
|---|---|---|
| Attente, envoi, incertain | Conservés | Absente |
| Confirmation | Effacés | Conservés |
| Abandon, expiration, refus, créneau indisponible | Effacés | Absente |

L'expiration n'agit pas sur `SUBMITTING` ni sur `UNCERTAIN`. Une tentative incertaine n'est pas purgée automatiquement : son corps est le seul moyen de rejouer la même clé.

Après confirmation, un « oui » tardif ne trouve plus de corps à renvoyer. Le chatbot doit lire la dernière tentative de la session. Si elle est `CONFIRMED` et qu'aucune nouvelle collecte n'a commencé, il affiche `appointment_reference` et n'insère pas de ligne. Le schéma autorise une nouvelle tentative ouverte après une confirmation, parce qu'une seconde prise de rendez-vous volontaire doit rester possible. Cette insertion appartient au nouveau récapitulatif, pas au message tardif.

La purge automatique n'est pas installée. Une purge ultérieure pourra supprimer les statuts `ABANDONED`, `EXPIRED`, `REJECTED` et `SLOT_UNAVAILABLE` de plus de 30 jours, puis les lignes `CONFIRMED` de plus de 90 jours. Elle ne devra pas supprimer `UNCERTAIN` ni `SUBMITTING`.

## 5. Rollback et tests

Rollback : `postgres/migrations/20261030_rec008_attempts_rollback.sql`.

Si la table contient au moins une ligne, la transaction lève une exception et n'exécute aucun `DROP`. Si elle est vide, le script retire les cinq fonctions puis la table. Il ne contient ni `DELETE`, ni `TRUNCATE`, ni modification des tables existantes.

Tests : `postgres/tests/20261030_rec008_attempts_tests.sql`. Ils commencent par `BEGIN` et finissent par `ROLLBACK`. Ils couvrent l'insertion, le refus d'une seconde tentative ouverte, la réclamation gagnante, la seconde réclamation refusée, l'abandon suivi d'une nouvelle tentative, l'expiration d'une attente, la conservation d'une ligne incertaine, la reprise après bail échu, le refus d'une reprise pendant le bail, l'effacement du corps à la confirmation, et le maintien des compteurs 13, 14, 12 et 48. Ils ne sélectionnent pas la clé brute. Ils n'ont pas été exécutés.

La concurrence réelle à deux connexions reste un essai ultérieur, après application autorisée. Le prédicat du bail est déjà dans le script à une connexion.

## 6. Audit statique

| Contrôle | Résultat |
|---|---|
| Transaction | `BEGIN` puis `COMMIT` dans la migration et le rollback |
| Tables de rendez-vous, notifications, historiques et sessions | Aucune instruction ne les modifie |
| Suppression de données existantes | Absente |
| Trigger | Absent |
| SQL dynamique | Absent |
| `EXECUTE` | Présent seulement dans `GRANT EXECUTE` |
| Droits | `REVOKE` de `PUBLIC`, droits limités à `govsuite` |
| Fonctions | `SECURITY INVOKER`, chemin de recherche fixé |
| Jeton de gestion | Aucune colonne |
| Tests exécutés | Non |
| Migration exécutée | Non |

## 7. Empreintes

| Fichier | Taille | SHA-256 |
|---|---:|---|
| `postgres/migrations/20261030_rec008_attempts.sql` | 14 357 octets | `b443b1ccd8ccd47ba79537942a60deed934c2c44ec33798d8b3c39fcffd52327` |
| `postgres/migrations/20261030_rec008_attempts_rollback.sql` | 937 octets | `45c752fd23a1e88dc86db8fa16aeae1d8145be551e32fd1eceb63b41f204f887` |
| `postgres/tests/20261030_rec008_attempts_tests.sql` | 10 734 octets | `541b99e04ef67dc62330ac527c641af9fdc7a873ab9b90e77ebe92412b878ab6` |

## 8. État final

La relecture après écriture des fichiers retrouve 13 rendez-vous, 14 notifications, 12 historiques, 48 sessions et l'empreinte `a2dea067599fd4f0a5f857551adc67cc`. La table n'existe pas. Le workflow 03 est actif sur la version attendue. Les workflows 08 et 10 sont inactifs.

## 9. Verdict

**GO** pour appliquer plus tard, dans une autorisation séparée, uniquement `postgres/migrations/20261030_rec008_attempts.sql`, après un nouveau préflight et un dump horodaté. L'application devra s'arrêter au premier écart et ne devra pas publier le workflow 10.

**NO-GO** pour exécuter la migration, le rollback ou les tests dans cette phase.

Cette phase s'arrête ici.
