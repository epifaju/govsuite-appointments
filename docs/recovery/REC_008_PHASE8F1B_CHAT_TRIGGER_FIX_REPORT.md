# REC-008 phase 8F-1B — Correction du déclencheur de chat TEST

Le nœud `Lorsqu'un message de chat est reçu` du workflow `OCD9It1uKFhOoWNF` a maintenant `public: true`. Le workflow reste inactif. Aucun message n'a été envoyé.

## Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow TEST | inactif, version `e499b802-f345-44bf-85b7-4a929fe4bbf5`, compteur 2, 134 nœuds, 137 liens, 0 exécution |
| Webhooks | aucun |
| Workflows actifs dans n8n TEST | aucun |
| PostgreSQL TEST | `Fs0l0058q5CEadRw`, 30 références |
| Ollama TEST | `dxzHqBq8Q60R8BOz`, modèle `qwen2.5:1.5b` |
| HTTP | les 10 URL visent `http://rec008-mock:8080` |
| Déclencheur avant correction | webhook `a91c4e70-6b18-4f0d-9c55-2e7d8a14b603`, seul paramètre `options.responseMode` = `lastNode` |

PostgreSQL TEST : 4 services, 1 site, 2 créneaux, 1 rendez-vous, 1 session `rec008-session-synthetique`, 0 tentative, 0 notification.

Mock : `total` 2, une lecture `GET /services` et une lecture `GET /appointments/availability`, `distinctKeys` 0.

GovSuite : 13 rendez-vous, 14 notifications, 12 historiques, 48 sessions, 0 tentative, empreinte `a2dea067599fd4f0a5f857551adc67cc`. Workflow 03 actif en version `2d72700c-d731-47e1-b6d6-82c5c684f055`. Workflow 08 inactif. Workflow 10 inactif, 84 nœuds, version `88a1f42a-ab9e-4eff-bfd9-996c31976b16`. Copie `hRfHsSeKpRMo0c6Z` inactive, version `1c7f444e-fca3-4576-9dfa-ae19017db743`. Mailpit : 5 messages, 2 non lus, base 98 304 octets, 0 message SMTP accepté.

## Cause dans l'implémentation installée

Nœud Chat Trigger v1.3, paquet `@n8n/n8n-nodes-langchain` de n8n 2.32.6.

Le paramètre qui ouvre le webhook de production s'appelle `public`. C'est un booléen, affiché « Make Chat Publicly Available », valeur par défaut `false`.

Dans `webhook()`, la valeur effective est `public` lu sur le nœud, sauf si `ChatTriggerConfig.disablePublicChat` est vrai. Cette option vaut `false` par défaut. La variable `N8N_DISABLE_PUBLIC_CHAT_TRIGGER` n'est pas définie dans le conteneur TEST.

Quand `public` est faux et que l'appel n'est pas un essai manuel de l'éditeur, le nœud répond 404 avec un corps vide et ne démarre pas le workflow. C'est le comportement observé en 8F-1.

Les paramètres associés n'ont pas besoin d'être ajoutés :

| Paramètre | Valeur utilisée | Origine |
| --- | --- | --- |
| `mode` | `hostedChat` | défaut du nœud, déjà compatible avec le chemin `…/chat` |
| `authentication` | `none` | défaut ; `validateAuth` ne demande alors aucune identité |
| `options.responseMode` | `lastNode` | déjà présent sur le nœud |

Après une activation ultérieure, le même webhook de production pourra dépasser ce contrôle. Cette phase ne l'a pas activé, donc ce comportement reste celui du code installé.

## Correction

Export avant mise à jour : `n8n/proposed/2026-10-30-rec008-phase8f1b-CHAT-TRIGGER/before-OCD9It1uKFhOoWNF.json`.

SHA-256 : `199da6c4f62bb0b09f7dd2d56f8f7ce11d04a7f99aaeaec6d9d516f64c604aa3`, 284 613 octets.

Payload : `n8n/proposed/2026-10-30-rec008-phase8f1b-CHAT-TRIGGER/update-body.json`.

SHA-256 : `824c8c2f2d81d7b68bc3fdf29e36501ccd8e699adfea2971fef1d13614672649`, 233 884 octets.

Le corps contient `name`, `nodes`, `connections`, `settings`, `staticData` et `pinData`. Il ne contient pas `active`.

Diff du nœud `Lorsqu'un message de chat est reçu` :

```json
{
  "options": { "responseMode": "lastNode" }
}
```

devient :

```json
{
  "public": true,
  "options": { "responseMode": "lastNode" }
}
```

Propriété modifiée : `parameters.public`. L'identifiant de webhook, les 137 connexions, les credentials, les URL, le SQL et les réglages de conservation restent identiques.

## PUT

Un seul `PUT http://127.0.0.1:5682/api/v1/workflows/OCD9It1uKFhOoWNF`. Réponse 200. L'endpoint d'activation n'a pas été appelé.

| Champ | Avant | Après |
| --- | --- | --- |
| Version | `e499b802-f345-44bf-85b7-4a929fe4bbf5` | `bb9aad73-3cf5-4c1b-bb08-132df3ccbb45` |
| Compteur | 2 | 3 |
| Actif | non | non |
| `activeVersionId` | null | null |
| Nœuds / liens | 134 / 137 | 134 / 137 |
| Exécutions | 0 | 0 |
| Paramètres modifiés | — | uniquement le Chat Trigger |
| Webhook | `a91c4e70-6b18-4f0d-9c55-2e7d8a14b603` | inchangé |
| PostgreSQL | `Fs0l0058q5CEadRw` | inchangé |
| Ollama | `dxzHqBq8Q60R8BOz` | inchangé |

Relecture installée : `parameters.public` vaut `true` et `options.responseMode` vaut `lastNode`.

Relecture enregistrée : `n8n/proposed/2026-10-30-rec008-phase8f1b-CHAT-TRIGGER/after-OCD9It1uKFhOoWNF.json`.

SHA-256 : `58ca88a2788a799a7f13438179c41a73a3258d25609da8a8dd4158537ddd0543`, 284 637 octets.

La table `webhook_entity` est vide. Aucun message n'a été envoyé.

## Exposition

Le seul port publié du projet TEST est `127.0.0.1:5682`. Aucune autre liaison hôte n'est ouverte pour ce service. Depuis n8n TEST, la route reste `192.168.224.0/20` sans passerelle. PostgreSQL, le mock et Ollama TEST sont joignables. Les noms GovSuite échouent en DNS, et `192.168.112.4:5432`, `192.168.112.2:5678` ainsi que `192.168.112.3:8025` répondent `ENETUNREACH`. Le workflow inactif n'enregistre pas le chat.

## État final

PostgreSQL TEST : 4 services, 1 site, 2 créneaux, 1 rendez-vous, 1 session, 0 tentative, 0 notification.

Mock : toujours `total` 2, sans POST.

GovSuite : 13, 14, 12, 48, 0 tentative, empreinte `a2dea067599fd4f0a5f857551adc67cc`, fonctions REC-008 inchangées. Les quatre workflows contrôlés gardent leurs versions. Mailpit reste à 5 messages, 2 non lus, base 98 304 octets, 0 message SMTP accepté.

## Verdict

Rejouer le scénario de consultation des services après une autorisation distincte : **GO**.

Le déclencheur pourra accepter un appel de production une fois le workflow activé. Il reste inactif dans cette phase.

Activer `OCD9It1uKFhOoWNF` ou envoyer le message maintenant : **NO-GO**.
