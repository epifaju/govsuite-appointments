# REC-008 phase 8E-2B-1 — Préparation de l'environnement de test isolé

Les artefacts sont hors ligne. Aucun conteneur de test n'a été créé. Le workflow installé `hRfHsSeKpRMo0c6Z` n'a pas été modifié. Le workflow original n'a pas été modifié. Aucune exécution, aucun appel de webhook et aucune écriture dans `govsuite`.

## Préflight

| Contrôle | Résultat |
| --- | --- |
| `hRfHsSeKpRMo0c6Z` | inactif, 134 nœuds, version `1c7f444e-fca3-4576-9dfa-ae19017db743`, compteur 1, 0 exécution |
| `R7TKt5mqZYpeKapl` | inactif, 84 nœuds, version `88a1f42a-ab9e-4eff-bfd9-996c31976b16`, compteur 654 |
| Workflow 03 `SXCesRUmGrV5FMzm` | actif, 12 nœuds, version `2d72700c-d731-47e1-b6d6-82c5c684f055` |
| Workflow 08 `ZbZoj4yF1s5a3B5E` | inactif, version `43167625-0a3b-42fa-861c-60f55f316379` |
| Compteurs | 13 rendez-vous, 14 notifications, 12 historiques, 48 sessions |
| `ai_appointment_attempt` | 0 ligne |
| Empreinte | `a2dea067599fd4f0a5f857551adc67cc` |
| Mailpit v1.30.6 | 5 messages, 2 non lus, 0 supprimé, 0 accepté par SMTP, base 98 304 octets |

La relecture après écriture des artefacts donne les mêmes valeurs. Aucune ligne ne porte le nom `REC008_TEST_ISOLE_134_NON_IMPORTE`.

## Inventaire des dépendances

Lecture seule du workflow `hRfHsSeKpRMo0c6Z`. 134 nœuds, 137 liens.

| Type | Nombre |
| --- | --- |
| Code | 71 |
| Postgres | 30 |
| If | 16 |
| HTTP | 10 |
| Switch | 4 |
| Déclencheur de chat | 1 |
| Chaîne LLM | 1 |
| Ollama | 1 |

Aucun nœud d'e-mail. Aucune URL SMTP.

### PostgreSQL

Les 30 nœuds utilisent le credential `LlHYqyFvq4IkYbhP`, nom `credentials PostgreSQL`. Les requêtes n'embarquent pas d'hôte. L'isolation ne peut donc pas reposer sur le texte SQL : elle dépend du serveur ouvert par le credential et du réseau du runtime.

| Effet | Nœuds |
| --- | --- |
| Lecture de `ai_conversation_state` | `Charger état conversation` |
| Insertion et mise à jour de `ai_conversation_state` | `Sauvegarder état conversation`, les nœuds `Mémoriser…`, `Finaliser…`, `Effacer collecte…`, `Effacer brouillon abandonné`, `Mettre à jour champ modifié`, `Libérer créneau indisponible` |
| Lecture de `ai_appointment_attempt` | `Lire tentative de session` |
| Insertion dans `ai_appointment_attempt` | `Insérer tentative` |
| Mise à jour de `ai_appointment_attempt` par fonction | `Réclamer tentative`, `Reprendre tentative`, `Clôturer confirmation`, `Clôturer refus`, `Clôturer créneau indisponible`, `Marquer tentative incertaine`, `Abandonner tentative`, `Expirer tentatives en attente` |
| Lecture de `services`, `sites`, `creneaux` | `Rechercher nouveaux créneaux1` |
| Aléa et empreinte, sans écriture | `Tirer aléa de tentative`, `Calculer empreinte du corps` |

Fonctions appelées : `reclamer_tentative_rendez_vous`, `reprendre_tentative_rendez_vous`, `marquer_tentative_incertaine`, `cloturer_tentative_rendez_vous`, `expirer_tentatives_en_attente`, `gen_random_uuid`, `gen_random_bytes`, `digest`.

Ces cinq fonctions ne modifient que `ai_appointment_attempt`. Le chatbot n'écrit pas directement dans `rendez_vous`, `notifications` ni `historique_rendez_vous`. `creer_rendez_vous_idempotent` n'est pas appelée par ce workflow. Elle appartient au workflow 03, atteint seulement par HTTP.

### HTTP

| Nœud | Méthode | Cible actuelle |
| --- | --- | --- |
| `Appeler GetServices` | GET implicite | `http://localhost:5678/webhook/services` |
| `Appeler GetAvailability` | GET implicite | `http://localhost:5678/webhook/appointments/availability` |
| `Appeler CreateAppointment` | POST | `http://localhost:5678/webhook/appointments` |
| `Appeler GetAppointment` | GET implicite | `http://localhost:5678/webhook/appointments/manage` |
| `Charger rendez-vous pour annulation` | GET implicite | `http://localhost:5678/webhook/appointments/manage` |
| `Charger rendez-vous à replanifier` | GET implicite | `http://localhost:5678/webhook/appointments/manage` |
| `Charger rendez-vous à replanifier2` | GET implicite | `http://localhost:5678/webhook/appointments/manage` |
| `Appeler CancelAppointment` | POST | `http://localhost:5678/webhook/appointments/cancel` |
| `Appeler RescheduleAppointment` | POST | `http://localhost:5678/webhook/appointments/reschedule` |
| `Rechercher nouveaux créneaux` | GET implicite | `http://n8n:5678/webhook/appointments/availability` |

`Rechercher nouveaux créneaux` n'a ni lien entrant ni lien sortant. Il reste une cible de production latente et doit quand même être retiré du réseau métier.

Depuis le n8n actuel, `localhost:5678` est le webhook du workflow 03 et des workflows associés. Un POST de création, d'annulation ou de replanification écrit dans `govsuite` et peut provoquer un e-mail. Le délai du nœud de création est de 20 secondes.

### Ollama et déclencheur

`Ollama Chat Model` demande le modèle `qwen2.5:1.5b`, température 0. L'URL est dans le credential `1VegSXfDpTY1hQUI`, qui n'a pas été déchiffré. Le déclencheur de chat est inactif. Son webhook installé est `c3d90b82-dd35-442b-bc71-ed1d6dc8f232`. Il n'est pas enregistré dans `webhook_entity`.

## Architecture Docker proposée

Fichier non démarré : `n8n/proposed/2026-10-30-rec008-phase8e2b1-NON-IMPORTE/docker-compose.rec008-test.yml`.

SHA-256 : `dc658c1cdf12fd5d922596dd014b6a8c636e9841c29e2f4de994706720b4fc0b`.

Projet `govsuite-rec008-test`, réseau `rec008_test` avec `internal: true`. Ce réseau n'est pas relié au réseau `govsuite`.

| Service | Image | Rôle |
| --- | --- | --- |
| `rec008-postgres` | `postgres:16.14-alpine` | base `govsuite_rec008_test`, sans port publié |
| `rec008-mock` | `node:24-alpine` | HTTP `rec008-mock:8080`, sans port publié |
| `rec008-n8n` | `n8n:2.32.6` | runtime du workflow isolé, SQLite propre, port hôte `127.0.0.1:5681` seulement après démarrage autorisé |

Le n8n de test n'a pas de variables `DB_POSTGRESDB_*`. Il ne stocke donc pas ses workflows dans `govsuite`. Aucun Mailpit n'est attaché. Les mots de passe et la clef de chiffrement sont des variables exigées au démarrage. Ils ne sont pas ceux de `.env.n8n.local` et ne sont pas écrits dans cette phase.

## Plan PostgreSQL TEST

Cluster distinct. Ne pas créer le rôle `rec008_test` dans le conteneur `govsuite-postgres`. Ne pas exécuter `postgres/init.sql` tel quel : après le DDL, il insère un rendez-vous de démonstration.

Ordre prévu pour la phase autorisée :

1. Démarrer seulement `rec008-postgres`.
2. Vérifier `current_database() <> 'govsuite'`.
3. Appliquer le DDL de `postgres/init.sql` jusqu'aux index, avant les données de démonstration.
4. Appliquer `database/migrations/001_ai_conversation_state.sql`. Ses colonnes correspondent à la table observée.
5. Appliquer `postgres/migrations/20261029_rec007_idempotence.sql` pour installer `creer_rendez_vous_idempotent`, sans exécuter son `GRANT` vers `govsuite`.
6. Appliquer `postgres/migrations/20261030_rec008_attempts.sql`, sans exécuter ses `GRANT` vers `govsuite`.
7. Créer le rôle `rec008_test`, sans superuser. Lui donner `SELECT`, `INSERT` et `UPDATE` sur `ai_conversation_state` et `ai_appointment_attempt`, `SELECT` sur `services`, `sites` et `creneaux`, et `EXECUTE` sur les cinq fonctions REC-008 ainsi que sur `digest`, `gen_random_bytes` et `gen_random_uuid`. Ne pas lui donner `EXECUTE` sur `creer_rendez_vous_idempotent`.
8. Appliquer `postgres/030_seed_synthetique.sql`. Le script s'arrête si la base s'appelle `govsuite`.

Le jeu synthétique contient un site `REC008TEST`, un service `REC008SVC`, un créneau disponible, un créneau complet, un rendez-vous `REC008-MOCK-0001` au nom fictif `ESSAI Camille`, et une session `rec008-session-synthetique`. Aucune ligne de `govsuite` n'est copiée. L'adresse utilisée est `camille.essai@example.test`. La table des tentatives reste vide. SHA-256 du script : `7900a2b0eae7298e5c4d6062dd9bb7a08ee423b88dfd2c45f7d25d7b07ff556f`.

## Plan de l'API MOCK

Fichier non démarré : `mock/server.mjs`. SHA-256 : `2ba746fff8bae736cd0616defb0083832680ff7d387ad807ae3659b56311a51c`. `node --check` accepte le fichier. Le serveur n'a pas été lancé.

Le scénario est choisi par `REC008_MOCK_SCENARIO`, pas par le chatbot. Le journal garde la date, la méthode, le chemin, le statut, l'empreinte SHA-256 du corps et l'empreinte SHA-256 de `cleIdempotence` lorsqu'elle est présente. Il ne garde ni le corps, ni la clé, ni le jeton. `GET /_meta/calls` expose seulement les compteurs et le nombre de clés distinctes.

| Scénario | Réponse de `POST /appointments` |
| --- | --- |
| `created` | 201, `created: true` |
| `replayed` | 200, `created: false`, `replayed: true` |
| `double` | 201 au premier appel d'une empreinte, 200 rejoué au second |
| `validation` | 400 `VALIDATION_ERROR` |
| `conflict` | 409 `IDEMPOTENCY_KEY_CONFLICT`, sans rendez-vous |
| `slot` | 409 dont le message est exactement `Créneau introuvable ou complet` |
| `unknown409` | 409 `UNCLASSIFIED_CONFLICT` |
| `error` | 500 `INTERNAL_ERROR` |
| `timeout` | aucune réponse pendant 25 secondes |
| `empty` | 200 et corps vide |
| `malformed` | 200 et corps `<<<` |

Les lectures de services, de disponibilité et de consultation, ainsi que l'annulation et la replanification, répondent avec les mêmes identifiants fictifs que le jeu SQL. Le mock n'écrit pas dans PostgreSQL. Après une annulation simulée, la ligne SQL ne change donc pas. Cette divergence est volontaire : le mock ne reçoit pas le mot de passe de la base.

## Séparation des credentials et copie hors ligne

Copie supplémentaire, non importée : `REC008_TEST_ISOLE_134_NON_IMPORTE.json`.

SHA-256 : `b534c58bfe644b157d0fe5b2edcc1c1150df5e4ed628c30cefa9acbb44c0b59c`.

| Élément | Valeur |
| --- | --- |
| Nom | `REC008_TEST_ISOLE_134_NON_IMPORTE` |
| Actif | non |
| Nœuds et liens | 134 et 137 |
| Webhook de chat | `a91c4e70-6b18-4f0d-9c55-2e7d8a14b603` |
| Postgres | identifiant `REC008PGTEST0001`, nom `REC008 PostgreSQL TEST`, 30 références |
| Ollama | identifiant `REC008OLLMTEST01`, nom `REC008 Ollama TEST`, 1 référence |
| Conservation | succès `none`, erreurs `none`, manuelles `false`, progression `false` |

Les requêtes SQL des 30 nœuds sont identiques à celles de `hRfHsSeKpRMo0c6Z`. Seuls les credentials, les URL HTTP et le webhook de chat diffèrent. Aucun secret n'a été copié. Le credential de test n'existe pas encore : il devra être créé dans le n8n de test, avec l'hôte `rec008-postgres`, la base `govsuite_rec008_test` et le rôle `rec008_test`.

Le simple changement de nom ne suffit pas. La copie installée conserve les credentials réels et les URL réelles. Elle reste inactive et ne doit pas être exécutée. La copie isolée ne doit être importée que dans `rec008-n8n`, après le contrôle réseau.

## Isolation réseau

Règles à vérifier avant toute exécution, depuis `rec008-n8n` :

- la résolution et la connexion TCP vers `govsuite-postgres` échouent ;
- la connexion vers le n8n publié sur `5680` et vers les webhooks `5678` du projet govsuite échoue ;
- la connexion vers Mailpit échoue ;
- la connexion vers `rec008-postgres:5432` et `rec008-mock:8080` réussit ;
- aucune variable d'environnement du conteneur ne contient le mot de passe ou la clef de `govsuite`.

Le réseau interne bloque la sortie du conteneur. Le port `5681` n'autorise qu'une entrée depuis l'hôte, et seulement une fois le projet démarré. Ollama sur l'hôte n'est pas joignable. Un essai conversationnel qui a besoin du modèle demandera plus tard un conteneur Ollama ajouté à `rec008_test`, pas une route vers le réseau govsuite.

La copie statique ne contient plus `localhost:5678`, `n8n:5678`, `/webhook/`, `LlHYqyFvq4IkYbhP`, `1VegSXfDpTY1hQUI`, `R7TKt5mqZYpeKapl` ni `hRfHsSeKpRMo0c6Z`. Les six URL restantes visent `http://rec008-mock:8080`.

## Vérifications statiques

| Contrôle | Résultat |
| --- | --- |
| JSON | valide, 134 nœuds, 137 liens, toutes les cibles existent |
| SQL | inchangé par rapport à la copie installée |
| Credentials PostgreSQL réels | absents |
| Webhook réel de création | absent |
| Écriture dans `govsuite` | aucune |
| Activation | aucune, fichier `active: false`, copie non importée |
| Message de chat | aucun |
| Mock | syntaxe JavaScript acceptée, processus non lancé |
| Conteneurs | non créés |

## Scénarios à tester plus tard

1. Lecture des services et d'un créneau fictif, sans création.
2. Collecte puis confirmation : un seul POST, statut 201, une tentative puis une clôture dans la base de test.
3. Double confirmation : deux POST, une seule empreinte de clé, 201 puis 200 rejoué, pas de seconde tentative.
4. 400, puis 409 de conflit, puis 409 de créneau complet.
5. 409 inconnu, 500, délai et corps illisible : tentative laissée incertaine, pas de nouvelle clé.
6. Abandon, modification et expiration sur la base de test.
7. Consultation, annulation et replanification : réponses du mock seulement, ligne SQL de rendez-vous inchangée.
8. Contrôle négatif : aucun appel arrivé sur les webhooks govsuite, compteurs et empreinte de `govsuite` inchangés.

## Nettoyage

Lorsque l'environnement aura été créé par une phase ultérieure :

1. Arrêter le projet `govsuite-rec008-test`.
2. Supprimer seulement ses volumes `rec008_postgres_data` et `rec008_n8n_data`.
3. Ne pas toucher aux volumes `postgres_data`, `n8n_data` et `mailpit_data`.
4. Ne pas supprimer `hRfHsSeKpRMo0c6Z` ni `R7TKt5mqZYpeKapl`.
5. Vérifier de nouveau les compteurs, l'empreinte et Mailpit.

La suppression de la copie installée resterait soumise à l'autorisation déjà prévue en phase 8E-2A.

## Verdict

Préparation hors ligne : réalisée.

Création des conteneurs et essais d'exécution : **NO-GO**.

Un GO ultérieur exige, dans cet ordre : démarrage autorisé du projet isolé, preuve que `rec008-n8n` ne joint ni `govsuite` ni ses webhooks, import de la copie isolée uniquement dans ce n8n, workflow laissé inactif, puis une autorisation séparée pour un seul scénario. Le premier scénario autorisé doit être une lecture de services, avant toute confirmation de création.
