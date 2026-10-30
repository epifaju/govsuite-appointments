# REC-008 phase 8E-2A — Installation contrôlée d'une copie inactive

Une copie de test distincte a été créée dans n8n. Elle est inactive. Le workflow 10 original n'a pas été modifié. Aucun rendez-vous n'a été créé, aucun message de chat n'a été envoyé, et le webhook de création n'a pas été appelé.

## Préflight

Contrôles lus avant l'appel de création, puis relus après l'installation. Les deux lectures concordent sur l'état métier et sur les workflows d'origine.

| Contrôle | Résultat |
| --- | --- |
| n8n | 2.32.6, API `127.0.0.1:5680` accessible |
| Workflow 10 `R7TKt5mqZYpeKapl` | inactif, 84 nœuds, version `88a1f42a-ab9e-4eff-bfd9-996c31976b16`, compteur 654 |
| Workflow 03 `SXCesRUmGrV5FMzm` | actif, 12 nœuds, version `2d72700c-d731-47e1-b6d6-82c5c684f055`, compteur 30 |
| Workflow 08 `ZbZoj4yF1s5a3B5E` | inactif, 5 nœuds, version `43167625-0a3b-42fa-861c-60f55f316379`, compteur 5 |
| `ai_appointment_attempt` | 0 ligne |
| Fonctions SQL | cinq empreintes inchangées, voir l'état PostgreSQL |
| Compteurs | 13 rendez-vous, 14 notifications, 12 historiques, 48 sessions |
| Empreinte métier | `a2dea067599fd4f0a5f857551adc67cc` |
| Mailpit v1.30.6 | 5 messages, 2 non lus, 0 supprimé, 0 accepté par SMTP, base 98 304 octets |

Aucun contrôle n'a échoué.

## Candidat

Source unique : `n8n/proposed/2026-10-30-rec008-phase8e1b-NON-PUBLIE/10_AI_ConsularAssistant_Complete.json`.

SHA-256 : `3aaee103f38ccb3a22481cf87da650894e38709bc381054b8a79e672db7879ff`.

134 nœuds, 137 liens, inactif. Le rapport `docs/recovery/REC_008_PHASE8E1B_CORRECTIONS.md` est présent. Son SHA-256 est `c3dabb1c2a65feda141dc7f559bc66f179c325d3649db3dda0fd2fa74933911f`. La copie à 130 nœuds et le fichier historique à 33 nœuds n'ont pas été ouverts.

## Identifiant du workflow de test

| Champ | Valeur |
| --- | --- |
| Identifiant | `hRfHsSeKpRMo0c6Z` |
| Nom | `REC008_TEST_ConsularAssistant_134_INACTIF` |
| Actif | non |
| Version active | aucune |
| Version | `1c7f444e-fca3-4576-9dfa-ae19017db743` |
| Compteur de version | 1 |
| Nœuds | 134 |
| Exécutions | 0 |
| Webhook de chat | `c3d90b82-dd35-442b-bc71-ed1d6dc8f232` |

L'identifiant `R7TKt5mqZYpeKapl` n'est pas réutilisé. Il n'apparaît pas dans le payload.

## Isolation des déclencheurs

Le seul nœud à l'écoute est le déclencheur de chat. Les autres occurrences de webhook sont des clients HTTP, dont `Appeler CreateAppointment` vers `http://localhost:5678/webhook/appointments`. Ces URL n'ont pas été réécrites.

Le webhook de chat du workflow 10 reste `d755b4f6-7d28-4347-b39e-7b9b5d02c9ad`. Le payload de création porte un autre identifiant, `c3d90b82-dd35-442b-bc71-ed1d6dc8f232`. n8n conserve un `webhookId` déjà présent ; le laisser identique à l'original aurait stocké le même identifiant de chat.

Après création, `webhook_entity` contient toujours exactement cinq chemins, tous antérieurs :

| Workflow | Méthode | Chemin |
| --- | --- | --- |
| `CLnuFnZnejHNUkg9` | GET | `appointments/availability` |
| `G4DGUyeawxcZze2D` | GET | `services` |
| `IGc8cMlPqPKISuDz` | POST | `appointments/cancel` |
| `SXCesRUmGrV5FMzm` | POST | `appointments` |
| `sLWErwgNoc3TDEPV` | GET | `appointments/manage` |

Aucune ligne n'est enregistrée pour `hRfHsSeKpRMo0c6Z` ni pour le webhook de chat d'origine. La création n'active pas le workflow et n'inscrit pas ses déclencheurs.

## Payload de création

Fichier posté : `n8n/proposed/2026-10-30-rec008-phase8e2a-CREATE-PAYLOAD/create-body.json`.

SHA-256 du corps accepté : `928cd9eb74bab4242e38575a7ea91a337b8d0c837a6c0a44388315a5f4d7870a` (233 944 octets).

Clés envoyées : `name`, `nodes`, `connections`, `settings`, `staticData`, `pinData`, `nodeGroups`.

Paramètres d'exécution envoyés et relus :

- `saveDataSuccessExecution` : `none`
- `saveDataErrorExecution` : `none`
- `saveManualExecutions` : `false`
- `saveExecutionProgress` : `false`
- `availableInMCP` : `false`
- `executionOrder` : `v1`

Le schéma public `workflowCreate` de n8n 2.32.6 refuse les propriétés supplémentaires. Le premier corps contenait `description`, `meta` et `settings.binaryMode`, absents de ce schéma. Il a été rejeté. Son SHA-256, relevé avant la correction du fichier, était `1ee196231eba7fab5d968ee6304b20411c75fc79e52b7e9b6373f87f9561c890`. La recherche par nom exact après ce refus a retourné zéro workflow. Le corps a ensuite été réduit aux propriétés autorisées, sans retirer les quatre drapeaux de conservation. `binaryMode: separate` du candidat n'est donc pas stocké. Les requêtes SQL métier n'ont pas été réécrites.

Audit avant l'appel retenu : JSON valide, 134 nœuds, 137 liens, cibles de connexion présentes, types inchangés, deux identités de credentials seulement, aucun identifiant du workflow 10, aucune clé d'idempotence codée en dur.

## Résultat de l'appel API

1. `POST /api/v1/workflows` du premier corps : HTTP 400, `request/body must NOT have additional properties`. Aucune ligne créée.
2. Recherche par nom exact : aucun workflow `REC008_TEST_ConsularAssistant_134_INACTIF`.
3. `POST /api/v1/workflows` du corps conforme : HTTP 200. Identifiant `hRfHsSeKpRMo0c6Z`, `active: false`, 134 nœuds.

Aucun PUT n'a été envoyé. Aucune activation, aucune publication, aucune exécution manuelle, aucun message de chat, aucun appel à `/webhook/appointments`.

## Comparaison des nœuds et des connexions

La copie installée a été relue par `GET /api/v1/workflows/hRfHsSeKpRMo0c6Z`.

| Comparaison | Résultat |
| --- | --- |
| Nœuds du payload et du candidat, hors `webhookId` du chat | identiques, 134 noms |
| Paramètres, credentials, types et versions de nœuds | identiques entre le payload et la copie installée |
| Connexions | identiques au candidat et à la copie installée, 137 liens |
| Écart volontaire | webhook de chat `c3d90b82-dd35-442b-bc71-ed1d6dc8f232` au lieu de `d755b4f6-7d28-4347-b39e-7b9b5d02c9ad` |
| Écart de schéma | `binaryMode` absent de la copie installée |
| Métadonnées produites par n8n | nouvel identifiant, nouveau nom, version `1c7f444e-fca3-4576-9dfa-ae19017db743`, compteur 1, inactif |

## Credentials

31 références, deux identités, sans lecture de secret :

| Type | Identifiant | Nom | Références |
| --- | --- | --- | --- |
| `ollamaApi` | `1VegSXfDpTY1hQUI` | Ollama account | 1 |
| `postgres` | `LlHYqyFvq4IkYbhP` | credentials PostgreSQL | 30 |

Les mêmes identifiants sont présents dans `credentials_entity`. La copie installée porte les mêmes références que le payload.

## État final de PostgreSQL

| Mesure | Valeur |
| --- | --- |
| Tentatives | 0 |
| Rendez-vous | 13 |
| Notifications | 14 |
| Historique | 12 |
| Sessions | 48 |
| Empreinte | `a2dea067599fd4f0a5f857551adc67cc` |
| `cloturer_tentative_rendez_vous` | `d4779f4ffb052a68427e97370a5fa2dc` |
| `expirer_tentatives_en_attente` | `0a3e544a0e6343f3c3a744d2e84c829b` |
| `marquer_tentative_incertaine` | `ddd8c168d3f8e73e70bb52608432dcb5` |
| `reclamer_tentative_rendez_vous` | `fe5c1fc27f9ff22ae37b04f820bc8cea` |
| `reprendre_tentative_rendez_vous` | `096e5236854a355629eab788ecc155ae` |

Aucune écriture métier. Mailpit reste à 5 messages, 2 non lus, 0 message SMTP accepté.

## État final des workflows

| Identifiant | Nom | Actif | Nœuds | Version |
| --- | --- | --- | --- | --- |
| `R7TKt5mqZYpeKapl` | 10_AI_ConsularAssistant_Complete | non | 84 | `88a1f42a-ab9e-4eff-bfd9-996c31976b16` |
| `SXCesRUmGrV5FMzm` | 03_API_CreateAppointment | oui | 12 | `2d72700c-d731-47e1-b6d6-82c5c684f055` |
| `ZbZoj4yF1s5a3B5E` | 08_JOB_SendConfirmationEmails | non | 5 | `43167625-0a3b-42fa-861c-60f55f316379` |
| `hRfHsSeKpRMo0c6Z` | REC008_TEST_ConsularAssistant_134_INACTIF | non | 134 | `1c7f444e-fca3-4576-9dfa-ae19017db743` |

## Risques et limites

- La copie est inactive et son webhook de chat n'est pas enregistré. Elle ne reçoit pas les messages du workflow 10.
- `Appeler CreateAppointment` vise toujours le webhook réel du workflow 03. Une exécution, même manuelle, peut créer un rendez-vous. L'inactivité n'isole pas cet appel.
- Les credentials sont ceux de l'instance. Les activer sur cette copie n'a pas été fait ; les références restent partagées.
- `binaryMode` n'est pas conservé, parce que le schéma public le refuse. Les quatre drapeaux de conservation des exécutions sont bien `none` ou `false`.
- La suppression de `hRfHsSeKpRMo0c6Z` n'est pas faite. Elle demanderait une autorisation distincte, après vérification de l'identifiant, du nom, de l'inactivité et de l'absence d'exécution. Le workflow 10 ne doit ni être supprimé ni être restauré.

## Verdict

Installation inactive : réalisée. Identifiant `hRfHsSeKpRMo0c6Z`.

Essais d'exécution isolés : **NO-GO**. Le déclencheur de chat est distinct et non enregistré, mais le nœud HTTP de création pointe encore vers le webhook de rendez-vous en service. Une exécution ne serait pas isolée des écritures métier.
