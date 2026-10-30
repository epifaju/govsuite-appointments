# REC-008 phase 8E-2B-3 — Import contrôlé dans n8n TEST

Le workflow isolé est importé dans n8n TEST, sur `127.0.0.1:5682`. Il est inactif. Il n'a pas été exécuté. L'instance GovSuite du port 5680 n'a reçu aucune requête.

## Préflight

| Contrôle | Résultat |
| --- | --- |
| n8n TEST | 2.32.6, `http://127.0.0.1:5682/healthz` répond `ok` |
| PostgreSQL TEST | `govsuite_rec008_test`, 16.14, rôle `rec008_test` non superutilisateur |
| Mock | `rec008-mock:8080` ouvert depuis n8n TEST |
| Isolement | `govsuite-postgres` introuvable en DNS ; `192.168.112.4:5432` et `192.168.112.2:5678` en `ENETUNREACH` |
| Workflows TEST avant import | 0 |
| Exécutions TEST avant import | 0 |
| Credential PostgreSQL | `Fs0l0058q5CEadRw`, nom `REC008 PostgreSQL TEST` |
| Credential Ollama | absent |

GovSuite avant l'import : 13 rendez-vous, 14 notifications, 12 historiques, 48 sessions, 0 tentative, empreinte `a2dea067599fd4f0a5f857551adc67cc`. Workflow 03 actif en version `2d72700c-d731-47e1-b6d6-82c5c684f055`. Workflow 08 inactif. Workflow 10 inactif, 84 nœuds, version `88a1f42a-ab9e-4eff-bfd9-996c31976b16`. Copie `hRfHsSeKpRMo0c6Z` inactive, 134 nœuds, 0 exécution. Mailpit : 5 messages, 2 non lus, base 98 304 octets.

## Source et payload

Source inchangée : `n8n/proposed/2026-10-30-rec008-phase8e2b1-NON-IMPORTE/REC008_TEST_ISOLE_134_NON_IMPORTE.json`.

SHA-256 source : `b534c58bfe644b157d0fe5b2edcc1c1150df5e4ed628c30cefa9acbb44c0b59c`.

Payload : `n8n/proposed/2026-10-30-rec008-phase8e2b3-IMPORT-PAYLOAD/create-body.json`.

SHA-256 payload : `c4bd28bd8c76bf17c7dd3d0442f226fad651f230ba4a1a9fa612d51ab80a6ceb`.

Le payload contient `name`, `nodes`, `connections`, `settings`, `staticData` et `pinData`. Il ne contient pas d'identifiant de workflow. Les 30 références PostgreSQL portent l'identifiant `Fs0l0058q5CEadRw` et le nom `REC008 PostgreSQL TEST`. Les 134 nœuds et les 137 liens sont conservés. Le workflow n'est pas marqué actif. La conservation des exécutions est `none` pour les succès et les erreurs, et `false` pour les exécutions manuelles et la progression.

Le nœud Ollama garde la référence non résolue `REC008OLLMTEST01`, nom `REC008 Ollama TEST`. Aucun secret Ollama n'a été créé. L'API de création a accepté cette référence. Le nœud n'est pas exécutable.

Les seules URL sont celles de `http://rec008-mock:8080`. Aucune expression des nœuds ne reconstruit `localhost:5678`, le port 5680 ou un webhook GovSuite. Le webhook de chat est `a91c4e70-6b18-4f0d-9c55-2e7d8a14b603`.

## Résultat de l'API

Un seul `POST /api/v1/workflows` a été envoyé à `127.0.0.1:5682`.

| Champ | Valeur |
| --- | --- |
| Statut | 200 |
| Identifiant | `OCD9It1uKFhOoWNF` |
| Nom | `REC008_TEST_ISOLE_134_NON_IMPORTE` |
| Actif | non |
| Version active | aucune |
| Nœuds renvoyés | 134 |

Aucune requête n'a été envoyée au port 5680.

## Comparaison après import

La relecture de `OCD9It1uKFhOoWNF` correspond au payload, hors métadonnées produites par n8n.

| Contrôle | Résultat |
| --- | --- |
| Nœuds | 134, paramètres identiques |
| Connexions | 137, identiques |
| État | inactif, sans version active |
| Exécutions | 0 |
| PostgreSQL | 30 références `Fs0l0058q5CEadRw` |
| Ollama | 1 référence non résolue `REC008OLLMTEST01` |
| Credentials réels `LlHYqyFvq4IkYbhP` et `1VegSXfDpTY1hQUI` | absents |
| Endpoints | uniquement `rec008-mock:8080` |
| Webhook de chat | `a91c4e70-6b18-4f0d-9c55-2e7d8a14b603`, non activé |
| Identifiants GovSuite | absents |

Le workflow inactif n'inscrit pas de webhook. Aucun appel de création, d'annulation ou de replanification n'a été fait.

## PostgreSQL TEST

Inchangé : 4 services, 1 site, 2 créneaux, 1 rendez-vous fictif, 1 session, 0 tentative. Le mock compte toujours deux lectures de contrôle et aucun POST.

## GovSuite final

| Contrôle | Résultat |
| --- | --- |
| Rendez-vous, notifications, historiques, sessions | 13, 14, 12, 48 |
| Tentatives | 0 |
| Empreinte | `a2dea067599fd4f0a5f857551adc67cc` |
| Workflow 03 | actif, version `2d72700c-d731-47e1-b6d6-82c5c684f055` |
| Workflow 08 | inactif |
| Workflow 10 | inactif, 84 nœuds, version `88a1f42a-ab9e-4eff-bfd9-996c31976b16` |
| `hRfHsSeKpRMo0c6Z` | inactif, 134 nœuds, 0 exécution |
| Mailpit | 5 messages, 2 non lus, 0 accepté par SMTP, base 98 304 octets |

## Risques résiduels

- Le nœud Ollama n'a pas de credential réel. Toute exécution qui l'atteint échouera, ou exigerait un Ollama isolé qui n'existe pas encore.
- Les nœuds HTTP visent le mock. Une exécution ultérieure peut écrire dans PostgreSQL TEST, pas dans GovSuite, tant que le réseau interne reste sans passerelle.
- L'identifiant `OCD9It1uKFhOoWNF` ne doit pas être activé tant qu'une phase d'exécution n'est pas autorisée.

## Verdict

Préparer un Ollama TEST sur le réseau interne, sans route vers GovSuite et sans secret factice : **GO**.

Exécuter ou activer `OCD9It1uKFhOoWNF` : **NO-GO**.
