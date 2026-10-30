# REC-008 phase 8E-2B-2 — Déploiement contrôlé de l'environnement test

L'infrastructure `govsuite-rec008-test` est démarrée. Le workflow chatbot n'a pas été importé. Aucune exécution, aucun message de chat et aucun appel aux webhooks GovSuite. La base `govsuite` n'a pas été modifiée.

## Préflight et empreintes

Les quatre artefacts de la phase 8E-2B-1 ont les empreintes attendues :

| Artefact | SHA-256 |
| --- | --- |
| Docker Compose | `dc658c1cdf12fd5d922596dd014b6a8c636e9841c29e2f4de994706720b4fc0b` |
| API mock | `2ba746fff8bae736cd0616defb0083832680ff7d387ad807ae3659b56311a51c` |
| Seed synthétique | `7900a2b0eae7298e5c4d6062dd9bb7a08ee423b88dfd2c45f7d25d7b07ff556f` |
| Workflow isolé | `b534c58bfe644b157d0fe5b2edcc1c1150df5e4ed628c30cefa9acbb44c0b59c` |

GovSuite avant et après le déploiement :

| Contrôle | Résultat |
| --- | --- |
| Rendez-vous, notifications, historiques, sessions | 13, 14, 12, 48 |
| Tentatives REC-008 | 0 |
| Empreinte | `a2dea067599fd4f0a5f857551adc67cc` |
| Workflow 03 `SXCesRUmGrV5FMzm` | actif, version `2d72700c-d731-47e1-b6d6-82c5c684f055`, 12 nœuds |
| Workflow 08 `ZbZoj4yF1s5a3B5E` | inactif, version `43167625-0a3b-42fa-861c-60f55f316379` |
| Workflow 10 `R7TKt5mqZYpeKapl` | inactif, 84 nœuds, version `88a1f42a-ab9e-4eff-bfd9-996c31976b16` |
| Copie installée `hRfHsSeKpRMo0c6Z` | inactive, 134 nœuds, version `1c7f444e-fca3-4576-9dfa-ae19017db743`, 0 exécution |
| Mailpit v1.30.6 | 5 messages, 2 non lus, 0 supprimé, 0 accepté par SMTP, base 98 304 octets |

`docker compose config --quiet` a réussi avant le premier démarrage. Aucun `docker compose down -v` n'a été lancé sur GovSuite.

## Écarts par rapport au plan

Les fichiers empreintés en 8E-2B-1 ne sont pas modifiés. Le déploiement utilise des copies dans `n8n/proposed/2026-10-30-rec008-phase8e2b2-TEST-DEPLOY/`.

1. Le Compose d'origine faisait de `rec008_test` le superutilisateur créé par l'image PostgreSQL. La copie utilise `postgres` pour l'initialisation, puis crée `rec008_test` sans superuser. SHA-256 du Compose déployé : `91e9a633e0b402d6e93465ec3f194df314446c78fefdb671ff23c6d992f11201`.
2. `127.0.0.1:5681` est déjà occupé par `adgendoc-n8n-1`. Le relais de test écoute `127.0.0.1:5682`.
3. Un réseau Docker `internal` n'expose aucun port sur cet hôte. `rec008-n8n` reste sur le réseau interne. `rec008-publish` relaie uniquement TCP `5682` vers `rec008-n8n:5678`.
4. Le parseur du chatbot ne reconnaît que `PASSEPORT`, `VISA`, `LEGALISATION`, `ETAT_CIVIL` et `PARIS`. Les codes `REC008SVC` et `REC008TEST` du seed d'origine ont été remplacés dans la copie. SHA-256 du seed déployé : `f9d6d95c09546d3057f59092121d9cecf095cfc089ec14fbe67571410e602d2c`. SHA-256 du mock déployé : `aa58ee9ccde0deac537697f5e459b5c6339fb22dc388dbd5a3bdd67364b52451`.
5. Les `GRANT ... TO govsuite` sont commentés dans les copies REC-007 et REC-008. Les scripts de production ne sont pas modifiés.
6. Aucun Ollama n'est présent sur le réseau de test. Le credential Ollama n'a pas été créé.

## Conteneurs, volumes et réseau

| Conteneur | État | Port hôte |
| --- | --- | --- |
| `govsuite-rec008-test-rec008-postgres-1` | sain | aucun |
| `govsuite-rec008-test-rec008-mock-1` | démarré | aucun |
| `govsuite-rec008-test-rec008-n8n-1` | démarré | aucun |
| `govsuite-rec008-test-rec008-publish-1` | démarré | `127.0.0.1:5682` |

Images : `postgres:16.14-alpine`, `node:24-alpine`, `docker.n8n.io/n8nio/n8n:2.32.6`. La commande `n8n --version` dans le conteneur répond `2.32.6`.

Volumes créés : `govsuite-rec008-test_rec008_postgres_data` et `govsuite-rec008-test_rec008_n8n_data`. Ils sont distincts de `govsuite-appointments_postgres_data` et `govsuite-appointments_n8n_data`. Aucun volume GovSuite n'est monté. Les identifiants de conteneurs PostgreSQL diffèrent.

Réseau `govsuite-rec008-test_rec008_test` : interne, sans passerelle. `rec008-n8n` n'y a qu'une route vers `192.168.224.0/20`. Réseau `govsuite-rec008-test_rec008_publish` : seul le relais y est connecté, avec la passerelle `192.168.240.1`. Aucun conteneur de test n'est attaché à `govsuite-appointments_govsuite`.

Les secrets sont dans `.env.rec008-test.local`, ignoré par git. Ils ne reprennent ni le mot de passe ni la clef de GovSuite.

## PostgreSQL TEST

Base active : `govsuite_rec008_test`, PostgreSQL 16.14, répertoire `/var/lib/postgresql/data` du volume de test.

Ordre appliqué, une fois, avec `ON_ERROR_STOP=1` :

| Fichier | SHA-256 | Résultat |
| --- | --- | --- |
| `010_schema_base.sql` | `578839a0eedff12692facfb932797cf0d0df776e2c442ae3b2189e91208d07cf` | DDL jusqu'aux index, sans les données de démonstration |
| `011_ai_conversation_state.sql` | copie de `database/migrations/001_ai_conversation_state.sql` | table créée |
| `012_rec007_test.sql` | `9453246e29b93c3b74da0cd32cc91cc99bcacf512dd3df8b5ac242cac3e1a51d` | fonction installée, grant retiré |
| rôle `rec008_test` | secret hors dépôt | `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE` |
| `013_rec008_test.sql` | `54d9b4959c5300a9f3503bb9d40fadbc7e388f658d76e5bbb0c028243bd3666c` | table et cinq fonctions |
| `020_grants.sql` | `57f7fa64d8e6dab77dd43a61a5fac7002c00899674bdad3a3ace32ce4422d9d5` | droits minimaux |
| `030_seed_synthetique.sql` | `f9d6d95c09546d3057f59092121d9cecf095cfc089ec14fbe67571410e602d2c` | données fictives |

Le script de seed refuse de s'exécuter si la base s'appelle `govsuite`.

Données présentes : 4 services (`ETAT_CIVIL`, `LEGALISATION`, `PASSEPORT`, `VISA`), 1 site `PARIS`, 2 créneaux, 1 rendez-vous fictif, 1 session, 0 notification, 0 historique, 0 tentative. La seule adresse est `@example.test`. Le créneau disponible du 3 novembre 2026 est visible par `rec008_test` pour `PASSEPORT` et `PARIS`. Les identifiants UUID respectent l'expression du chatbot.

Droits de `rec008_test` : lecture, insertion et mise à jour sur l'état conversationnel et les tentatives ; lecture des services, sites et créneaux ; exécution des cinq fonctions REC-008, de `digest`, `gen_random_bytes` et `gen_random_uuid`. Pas de lecture ni d'écriture sur `rendez_vous`. `has_function_privilege` vaut faux pour `creer_rendez_vous_idempotent`. Un appel direct sous `SET ROLE rec008_test` renvoie `permission denied for function creer_rendez_vous_idempotent`. Le nombre de rendez-vous de test reste 1.

## API mock

`http://rec008-mock:8080` répond sur le réseau de test. Le premier `GET /_meta/calls` donnait un total de 0. Après les deux lectures de contrôle, le compteur est :

| Appel | Nombre |
| --- | --- |
| `GET /services` 200 | 1 |
| `GET /appointments/availability` 200 | 1 |

Aucun POST. Les réponses de lecture portent les codes `PASSEPORT`, `VISA`, `LEGALISATION`, `ETAT_CIVIL` et `PARIS`. Le point `/_meta/calls` ne renvoie que le scénario, le total, les compteurs par chemin et le nombre de clés distinctes. Il ne renvoie ni corps, ni empreinte, ni clé, ni adresse. Le conteneur mock n'a aucune variable de secret ou de base. La sonde TCP depuis n8n vers le mock n'a pas ajouté d'appel HTTP.

## n8n TEST

`http://127.0.0.1:5682/healthz` répond `{"status":"ok"}` à travers le relais. Le stockage est `database.sqlite` dans le volume `rec008_n8n_data`. Aucune variable `DB_POSTGRESDB` n'est définie. `WEBHOOK_URL` vise `http://localhost:5682/`.

| Contrôle | Résultat |
| --- | --- |
| Propriétaire | `rec008-test@example.test`, créé dans cette instance |
| Workflows | 0 |
| Workflows actifs | 0 |
| Exécutions | 0 |
| Credentials | un seul, PostgreSQL |

Credential créé, sans secret dans ce rapport :

| Champ | Valeur |
| --- | --- |
| Identifiant | `Fs0l0058q5CEadRw` |
| Nom | `REC008 PostgreSQL TEST` |
| Type | `postgres` |
| Hôte | `rec008-postgres` |
| Base | `govsuite_rec008_test` |
| Rôle | `rec008_test` |

Cet identifiant n'est pas `REC008PGTEST0001`, qui reste celui écrit dans la copie hors ligne. L'import devra le remplacer. Le credential Ollama n'existe pas.

## Preuves d'isolation depuis `rec008-n8n`

Sondes TCP seulement. Aucun octet HTTP n'a été envoyé vers GovSuite.

| Cible | Résultat |
| --- | --- |
| `rec008-postgres:5432` | ouvert |
| `rec008-mock:8080` | ouvert |
| `govsuite-postgres`, `govsuite-n8n`, `govsuite-mailpit`, `host.docker.internal` | DNS `EAI_AGAIN` |
| `192.168.112.4:5432`, `192.168.112.2:5678`, `192.168.112.3:8025` | `ENETUNREACH` |
| Passerelle GovSuite `192.168.112.1:5433` | `ENETUNREACH` |
| Passerelle du relais `192.168.240.1:5433` et `192.168.240.2:5682` | `ENETUNREACH` |
| `172.17.0.1:5433` et `192.168.65.1:5433` | `ENETUNREACH` |

La table de routage du conteneur n8n ne contient pas de passerelle par défaut. Les volumes et variables de GovSuite ne sont pas montés. L'appel sortant de n8n vers `api.n8n.io` échoue en DNS, ce qui confirme l'absence de résolution extérieure.

## Verdict

Import inactif du workflow isolé dans `rec008-n8n` : **GO**, à condition de remplacer l'identifiant PostgreSQL `REC008PGTEST0001` par `Fs0l0058q5CEadRw`, de laisser le workflow inactif, et de ne pas créer de credential Ollama tant qu'aucun Ollama n'est attaché au réseau de test.

Exécution du chatbot : **NO-GO**. Elle attend une autorisation distincte.
