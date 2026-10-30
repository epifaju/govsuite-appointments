# REC-008 phase 8E-2B-4 — Ollama TEST isolé

Le service `rec008-ollama` est démarré dans le projet Docker `govsuite-rec008-test`. Le modèle `qwen2.5:1.5b` est reconnu. Le workflow `OCD9It1uKFhOoWNF` reste inactif. Son nœud `Ollama Chat Model` pointe vers le credential `dxzHqBq8Q60R8BOz`. Aucun message de chat n'a été envoyé.

## Préflight

| Contrôle | Résultat |
| --- | --- |
| n8n TEST | 2.32.6, `http://127.0.0.1:5682/healthz` répond `ok` |
| Workflow `OCD9It1uKFhOoWNF` | inactif, version `ef814397-66f7-4315-abd5-36dcaa230c99`, compteur 1, 134 nœuds, 137 liens, 0 exécution |
| Workflows actifs dans n8n TEST | aucun |
| PostgreSQL TEST | `govsuite_rec008_test`, 4 services, 1 site, 2 créneaux, 1 rendez-vous, 1 session, 0 tentative |
| Mock | `rec008-mock:8080` ouvert ; 2 lectures de contrôle, 0 POST |
| Réseau | `govsuite-rec008-test_rec008_test`, `internal: true`, sans passerelle |
| Credential PostgreSQL | `Fs0l0058q5CEadRw`, nom `REC008 PostgreSQL TEST`, 30 références |
| Référence Ollama avant mise à jour | `REC008OLLMTEST01`, nom `REC008 Ollama TEST` |
| Modèle du nœud | `qwen2.5:1.5b` |

GovSuite avant l'ajout : 13 rendez-vous, 14 notifications, 12 historiques, 48 sessions, 0 tentative, empreinte `a2dea067599fd4f0a5f857551adc67cc`. Workflow 03 actif en version `2d72700c-d731-47e1-b6d6-82c5c684f055`. Workflow 08 inactif, version `43167625-0a3b-42fa-861c-60f55f316379`. Workflow 10 inactif, 84 nœuds, version `88a1f42a-ab9e-4eff-bfd9-996c31976b16`. Copie `hRfHsSeKpRMo0c6Z` inactive, 134 nœuds, version `1c7f444e-fca3-4576-9dfa-ae19017db743`. Mailpit : 5 messages, 2 non lus, base 98 304 octets, 0 message SMTP accepté.

Mémoire et disque avant démarrage : hôte Windows 16 107 Mo, dont 1 935 Mo libres ; moteur Docker 4 106 862 592 octets et 4 CPU ; volume C libre 215,3 Go. La limite retenue pour Ollama est 1 536 Mo et 1,5 CPU, afin qu'un dépassement reste contenu dans ce conteneur.

Le Compose déployé en 8E-2B-2 est inchangé. SHA-256 `91e9a633e0b402d6e93465ec3f194df314446c78fefdb671ff23c6d992f11201`.

## Configuration Docker

Copie : `n8n/proposed/2026-10-30-rec008-phase8e2b4-OLLAMA-TEST/docker-compose.rec008-test.yml`.

SHA-256 : `ae7671be6f6b99061024227b2bec2555ce9dc5034df2630a2f2822b492df383e`, 2 455 octets.

Le service ajouté est `rec008-ollama` :

- image épinglée `ollama/ollama@sha256:1868fd51253099b8f48b89b981e5d8ba23e4db161a501b86e29593071c1c069b` ;
- binaire constaté dans le conteneur : `ollama version is 0.11.6` ;
- identifiant local de l'image déjà présente : `sha256:de497dd882834f4aa5286983e6b969d476f1c9c8605cbe58775056a32578a198` ;
- réseau `rec008_test` seul, passerelle vide, adresse `192.168.224.6` ;
- volume `govsuite-rec008-test_rec008_ollama_data` monté sur `/root/.ollama` ;
- aucun port publié (`11434/tcp` sans liaison hôte) ;
- redémarrage `unless-stopped` ;
- limites `mem_limit: 1536m` et `cpus: 1.5`.

Démarrage : `docker compose up -d --no-deps --pull never rec008-ollama`. Aucun autre service du projet n'a été recréé. Aucun volume GovSuite n'est monté. Le volume de modèles a été créé avant le démarrage, puis rempli hors ligne. Il n'a pas été supprimé.

## Installation du modèle

`qwen2.5:1.5b` était déjà présent dans le volume Ollama local `adgendoc_ollama-data`. Empreinte annoncée par cet Ollama : `65ec06548149b04c096a120e4a6da9d4017ea809c91734ea5631e89f96ddc57b`, famille `qwen2`, quantification `Q4_K_M`, 986 061 892 octets. Les modèles `qwen2.5:3b` et `llama3.1:latest` présents au même endroit n'ont pas été copiés.

Le réseau TEST n'a pas été relié à Internet ni au réseau GovSuite. Aucun `ollama pull` n'a été lancé. Le transfert a utilisé un conteneur temporaire `node:24-alpine` en `--network none`. Le volume source était en lecture seule. Le volume TEST était la seule destination.

Cinq blobs ont été copiés. Leur SHA-256 calculé à l'arrivée est égal au digest du manifeste, et leur taille est égale à la taille annoncée :

| Élément | SHA-256 | Taille |
| --- | --- | --- |
| config | `377ac4d7aeefd5b870c9fccff9a6d4df36901d99fe3277c2f755bc401601ba1c` | 487 |
| modèle | `183715c435899236895da3869489cc30ac241476b4971a20285b1a462818a5b4` | 986 048 512 |
| system | `66b9ea09bd5b7099cbb4fc820f31b575c0366fa439b08245566692c6784e281e` | 68 |
| template | `eb4402837c7829a690fa845de4d7f3fd842c2adee476d5341da8a46ea9255175` | 1 482 |
| licence | `832dd9e00a68dd83b3c3fb9f5588dad7dcf337a0db50f7d9483f310cd292e92e` | 11 343 |

Le manifeste a été écrit dans `models/manifests/registry.ollama.ai/library/qwen2.5/1.5b`.

## Contrôles depuis n8n TEST

Depuis `govsuite-rec008-test-rec008-n8n-1` :

| Cible | Résultat |
| --- | --- |
| DNS `rec008-ollama` | `192.168.224.6` |
| TCP `11434` | ouvert |
| `GET /api/tags` | 200, seul modèle `qwen2.5:1.5b` |
| `rec008-postgres:5432` | ouvert |
| `rec008-mock:8080` | ouvert |
| DNS `govsuite-postgres`, `govsuite-n8n`, `govsuite-mailpit`, `host.docker.internal` | `EAI_AGAIN` |
| `192.168.112.4:5432`, `192.168.112.2:5678`, `192.168.112.3:8025` | `ENETUNREACH` |
| `192.168.112.1:5433`, `192.168.240.1:5433`, `192.168.240.2:5682`, `172.17.0.1:5433`, `192.168.65.1:5433` | `ENETUNREACH` |

La table de routage du conteneur n8n TEST ne contient que `eth0` vers `192.168.224.0/20`, passerelle `00000000`. Les sondes vers GovSuite sont des connexions TCP, sans requête HTTP métier.

## Appel direct du modèle

Un seul appel a été fait, depuis n8n TEST vers `http://rec008-ollama:11434/api/generate`. Il ne passe pas par le workflow. Le prompt est `Reponds uniquement par le mot pret.` Les options limitent la réponse à 8 jetons. Le flux est désactivé.

| Mesure | Valeur |
| --- | --- |
| Statut | 200 |
| Réponse | `O.K` |
| Erreur | aucune |
| Durée de génération | 14 282 ms |
| Durée totale | 14 472 ms |
| Mémoire ensuite | 1,14 Gio sur 1,5 Gio |
| Conteneur | `running`, `OOMKilled=false` |

Les conteneurs `govsuite-n8n`, `govsuite-postgres` et `govsuite-mailpit` étaient toujours démarrés après cet appel.

## Credential Ollama TEST

Créé par `POST /rest/credentials` sur `127.0.0.1:5682`.

| Champ | Valeur |
| --- | --- |
| Identifiant | `dxzHqBq8Q60R8BOz` |
| Nom | `REC008 Ollama TEST` |
| Type | `ollamaApi` |
| Donnée enregistrée | `baseUrl` = `http://rec008-ollama:11434` |
| Clé d'API | absente |

`POST /rest/credentials/test` répond 200. Ce contrôle interroge `GET /api/tags` du credential. Il n'exécute pas le workflow. Le credential GovSuite `1VegSXfDpTY1hQUI` n'a pas été lu ni réutilisé.

## Diff du workflow TEST

Export avant mise à jour : `n8n/proposed/2026-10-30-rec008-phase8e2b4-OLLAMA-TEST/before-OCD9It1uKFhOoWNF.json`.

SHA-256 : `5e9647cc69dd000b5aca54bf166c74e7bddab2f0f0eaf5e0d00b856ef46adf50`, 284 613 octets.

L'API publique n8n 2.32.6 accepte `PUT /api/v1/workflows/{id}` avec le schéma `workflow`, `additionalProperties: false`. Le corps envoyé contient `name`, `nodes`, `connections`, `settings`, `staticData` et `pinData`. Le champ `active` n'est pas envoyé. Le workflow était inactif, donc la mise à jour ne republie pas de version active.

Corps : `n8n/proposed/2026-10-30-rec008-phase8e2b4-OLLAMA-TEST/update-body.json`.

SHA-256 : `8cf22e63d6a430085d31ba7107d4f0225dde73f22ec41284d21f8f1e83c421c7`, 233 870 octets.

Un seul `PUT` a été envoyé à `http://127.0.0.1:5682/api/v1/workflows/OCD9It1uKFhOoWNF`. Réponse 200.

Le seul écart de credential est le nœud `Ollama Chat Model` :

| | Identifiant | Nom |
| --- | --- | --- |
| Avant | `REC008OLLMTEST01` | `REC008 Ollama TEST` |
| Après | `dxzHqBq8Q60R8BOz` | `REC008 Ollama TEST` |

Les paramètres des 134 nœuds sont identiques, y compris le modèle `qwen2.5:1.5b`. Les 137 liens sont identiques. Les 30 credentials PostgreSQL restent `Fs0l0058q5CEadRw`. Les URL HTTP restent sur `http://rec008-mock:8080`.

| Champ | Avant | Après |
| --- | --- | --- |
| Version | `ef814397-66f7-4315-abd5-36dcaa230c99` | `e499b802-f345-44bf-85b7-4a929fe4bbf5` |
| Compteur | 1 | 2 |
| Actif | non | non |
| `activeVersionId` | null | null |
| Nœuds / liens | 134 / 137 | 134 / 137 |
| Exécutions | 0 | 0 |

Relecture : `n8n/proposed/2026-10-30-rec008-phase8e2b4-OLLAMA-TEST/after-OCD9It1uKFhOoWNF.json`.

SHA-256 : `1136b631eb27daad4bc8c122928fe84cc4423feeb6bf0a6e694e1986d1369c66`, 284 613 octets.

`R7TKt5mqZYpeKapl`, `hRfHsSeKpRMo0c6Z` et le workflow 03 n'ont pas été modifiés.

## PostgreSQL TEST

| Mesure | Valeur |
| --- | --- |
| Base | `govsuite_rec008_test` |
| Services, sites, créneaux | 4, 1, 2 |
| Rendez-vous fictif | 1 |
| Sessions | 1 |
| Tentatives | 0 |
| Notifications | 0 |

Le mock répond toujours `total: 2`, avec une lecture `GET /services` et une lecture `GET /appointments/availability`. `distinctKeys` vaut 0. Aucun POST n'a été ajouté.

## GovSuite

| Contrôle | Résultat |
| --- | --- |
| PostgreSQL | 16.14 |
| Rendez-vous, notifications, historiques, sessions | 13, 14, 12, 48 |
| Tentatives | 0 |
| Empreinte | `a2dea067599fd4f0a5f857551adc67cc` |
| `cloturer_tentative_rendez_vous` | `d4779f4ffb052a68427e97370a5fa2dc` |
| `expirer_tentatives_en_attente` | `0a3e544a0e6343f3c3a744d2e84c829b` |
| `marquer_tentative_incertaine` | `ddd8c168d3f8e73e70bb52608432dcb5` |
| `reclamer_tentative_rendez_vous` | `fe5c1fc27f9ff22ae37b04f820bc8cea` |
| `reprendre_tentative_rendez_vous` | `096e5236854a355629eab788ecc155ae` |
| Workflow 03 | actif, 12 nœuds, version `2d72700c-d731-47e1-b6d6-82c5c684f055` |
| Workflow 08 | inactif, 5 nœuds, version `43167625-0a3b-42fa-861c-60f55f316379` |
| Workflow 10 | inactif, 84 nœuds, version `88a1f42a-ab9e-4eff-bfd9-996c31976b16` |
| `hRfHsSeKpRMo0c6Z` | inactif, 134 nœuds, version `1c7f444e-fca3-4576-9dfa-ae19017db743` |
| Mailpit | v1.30.6, 5 messages, 2 non lus, base 98 304 octets, 0 accepté par SMTP, 0 supprimé |

## Verdict

Premier test conversationnel limité à la lecture des services, après une autorisation distincte : **GO**.

Le modèle répond, le credential joint `rec008-ollama`, et n8n TEST ne peut pas atteindre PostgreSQL, n8n ni Mailpit de GovSuite. Le workflow reste inactif et devra être activé seulement dans cette autorisation. La première génération a occupé 1,14 Gio sur une limite de 1,5 Gio ; le test devra surveiller cette marge.

Activer `OCD9It1uKFhOoWNF`, envoyer un message au déclencheur de chat, ou appeler un endpoint de création, d'annulation ou de replanification dans cette phase : **NO-GO**.
