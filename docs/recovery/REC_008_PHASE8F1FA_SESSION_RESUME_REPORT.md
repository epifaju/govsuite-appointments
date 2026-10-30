# REC-008 phase 8F-1F-A — Reprise conversationnelle GET_AVAILABILITY

Un seul message a complété la session existante. Le webhook a accepté la requête. La mémoire de service et de site n'a pas été conservée, la date de fin n'a pas été enregistrée, et le mock n'a pas été rappelé. Le workflow TEST a été désactivé.

Verdict du scénario : **FAIL**.

## Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow `OCD9It1uKFhOoWNF` | inactif, version `bb9aad73-3cf5-4c1b-bb08-132df3ccbb45`, compteur 3, 134 nœuds, 137 liens |
| Chat Trigger | `public: true`, webhook `a91c4e70-6b18-4f0d-9c55-2e7d8a14b603` |
| Credentials | PostgreSQL `Fs0l0058q5CEadRw`, Ollama `dxzHqBq8Q60R8BOz` |
| HTTP | 10 URL vers `http://rec008-mock:8080` |
| Isolation | services TEST ouverts ; GovSuite en `EAI_AGAIN` / `ENETUNREACH` |
| PostgreSQL TEST | 1 rendez-vous, 3 sessions, 0 tentative |
| Mock | `total` 2, `GET /appointments/availability` 2, 0 GET services, 0 POST |
| GovSuite | 13, 14, 12, 48, 0 tentative, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Mailpit | 5 messages, 2 non lus, base 98 304 octets |

## État de session avant le message

Session `rec008-8f1d-availability-01` :

| Champ | Valeur |
| --- | --- |
| Intention | `GET_AVAILABILITY` |
| Service | `PASSEPORT` |
| Site | `PARIS` |
| `date_debut` | `2026-11-03` |
| `date_fin` | vide |
| Identité | absente |

## Activation

`POST .../activate` avec la version `bb9aad73-3cf5-4c1b-bb08-132df3ccbb45` a répondu 200. Seul ce workflow était actif. Le webhook GET et POST du chat était enregistré. Les URL restaient sur le mock.

## Message

Session : `rec008-8f1d-availability-01`.

URL : `http://127.0.0.1:5682/webhook/a91c4e70-6b18-4f0d-9c55-2e7d8a14b603/chat`.

Action : `sendMessage`.

Message : `Ma date de fin est le 03/11/2026.`

Un seul envoi, sans retry.

| Mesure | Valeur |
| --- | --- |
| Code HTTP | 200 |
| Durée | 94 743 ms |
| Réponse | `{"text":"Pour rechercher les disponibilités, j'ai besoin de le service, le site, la date de fin (YYYY-MM-DD)."}` |
| Ollama avant | 69,54 Mio / 1,5 Gio |
| Ollama après | 1,09 Gio / 1,5 Gio |
| `OOMKilled` | false, conteneur `running` |

## État de session après le message

| Champ | Avant | Après |
| --- | --- | --- |
| Intention | `GET_AVAILABILITY` | `GET_AVAILABILITY` |
| Service | `PASSEPORT` | vide |
| Site | `PARIS` | vide |
| `date_debut` | `2026-11-03` | `2026-11-03` |
| `date_fin` | vide | vide |
| Message | demande initiale | `Ma date de fin est le 03/11/2026.` |
| Identité | absente | absente |

Nombre de sessions : toujours 3. Aucune session parasite. Toujours 1 rendez-vous, 0 tentative, 0 notification.

## Appel mock

Aucun nouvel appel. Les compteurs restent à `GET /appointments/availability` 2 et `total` 2. Aucun POST. Aucune comparaison de créneaux n'est possible.

## Désactivation

`POST .../deactivate` a répondu 200. Le workflow est inactif, `activeVersionId` est null, la version et le compteur restent `bb9aad73-3cf5-4c1b-bb08-132df3ccbb45` et 3. Aucun webhook n'est enregistré. Les 134 nœuds, 137 liens et credentials sont inchangés.

## GovSuite

Inchangé : 13, 14, 12, 48, 0 tentative, empreinte `a2dea067599fd4f0a5f857551adc67cc`, fonctions REC-008 et Mailpit inchangés.

## Anomalies

1. La date unique du message a été traitée comme date de début par le nœud `Parser intention`, qui place `dateMatches[0]` dans `dateDebut` et n'utilise `dateFin` que s'il existe une seconde date. Le texte « date de fin » n'a donc pas alimenté `date_fin`.
2. Après le tour, `service` et `site` ont été effacés alors qu'ils étaient présents avant. La mémoire attendue n'a pas été conservée jusqu'à `Valider paramètres disponibilité`.
3. Ce nœud a demandé le service, le site et la date de fin. Le mock n'a pas été appelé.

Premier point de défaillance observable : extraction et fusion des paramètres dans le parcours `Parser intention` / conservation d'état, avant `Appeler GetAvailability`.

Aucune correction fonctionnelle n'a été appliquée.

## Verdict

Scénario A de reprise : **FAIL**.

Scénario B, demande complète en un message, après une autorisation distincte : **GO** pour l'essai isolé, car il ne dépend pas de cette reprise. Confirmation, création, annulation et replanification : **NO-GO**. Cette phase s'arrête ici.
