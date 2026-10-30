# REC-008 phase 8F-1F-D — Validation conversationnelle de la correction mémoire

Deux messages synthétiques sur une nouvelle session. La mémoire partielle est conservée, `dateFin` est extraite, un seul GET availability est émis, et le créneau de 09:00 avec 2 places est présenté. Aucun POST métier.

Verdict du scénario : **PASS**.

## Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow | inactif, `activeVersionId = null` |
| Version / compteur | `2fea54b3-ed59-4b83-a404-7166bad06fb2` / 4 |
| Graphe | 134 nœuds, 137 connexions |
| Autres workflows actifs | 0 |
| Chat Trigger | `public: true`, webhook `a91c4e70-6b18-4f0d-9c55-2e7d8a14b603` |
| Credentials | PostgreSQL `Fs0l0058q5CEadRw`, Ollama `dxzHqBq8Q60R8BOz` / `qwen2.5:1.5b` |
| HTTP | 10 URL `http://rec008-mock:8080/...` |
| Isolation | aucun TCP GovSuite ouvert depuis n8n TEST |
| PostgreSQL TEST | 1 rendez-vous, 3 sessions, 0 tentative, 0 notification |
| Session `rec008-8f1fd-memory-01` | absente |
| Mock | `total` 2, 2 GET availability, 0 POST ; SHA `845c9f6b…5535` |
| GovSuite | 13, 14, 12, 48, 0, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Mailpit | 5 messages, 2 non lus, 98 304 octets |

## Version du workflow

Version active pendant le test : `2fea54b3-ed59-4b83-a404-7166bad06fb2` (compteur 4).

## Activation

`POST .../activate` → 200. Seul `OCD9It1uKFhOoWNF` actif. Webhooks GET/POST du chat enregistrés. URL toujours sur le mock.

## Session utilisée

`rec008-8f1fd-memory-01` — nouvelle. Pas de réutilisation de `rec008-8f1d-availability-01`.

## Message 1

Entrée : `Je souhaite connaître les disponibilités pour un passeport à Paris à partir du 03/11/2026.`

| Mesure | Valeur |
| --- | --- |
| HTTP | 200 |
| Durée | 80 109 ms |
| Réponse | demande de la date de fin (YYYY-MM-DD) |
| Mock | inchangé (`total` 2) |
| Ollama | 80,48 Mio → 1,084 Gio ; `OOMKilled` false |

## État PostgreSQL après message 1

| Champ | Valeur |
| --- | --- |
| Intention | `GET_AVAILABILITY` |
| Service | `PASSEPORT` |
| Site | `PARIS` |
| `date_debut` | `2026-11-03` |
| `date_fin` | vide |
| `pending_action` | `GET_AVAILABILITY` |
| Tentatives | 0 |
| Sessions totales | 4 |

Premier tour conforme → second message autorisé.

## Message 2

Entrée : `Ma date de fin est le 03/11/2026.` (même session, sans répéter service/site/début)

| Mesure | Valeur |
| --- | --- |
| HTTP | 200 |
| Durée | 15 279 ms |
| Mock | `total` 2 → 3 ; GET availability 2 → 3 (+1) ; 0 POST |
| Ollama | 1,086 Gio → 1,109 Gio ; `OOMKilled` false |

Réponse structurée `type: availability` avec un créneau 09:00–09:30, `placesDisponibles: 2`. Aucune mention de 10:00.

## État PostgreSQL après message 2

| Champ | Après msg1 | Après msg2 |
| --- | --- | --- |
| Intention | `GET_AVAILABILITY` | `GET_AVAILABILITY` |
| Service | `PASSEPORT` | `PASSEPORT` |
| Site | `PARIS` | `PARIS` |
| `date_debut` | `2026-11-03` | `2026-11-03` |
| `date_fin` | vide | `2026-11-03` |
| `pending_action` | `GET_AVAILABILITY` | `GET_AVAILABILITY` |

## Comparaison champ par champ

Tous les champs métier du premier tour sont conservés. Seule `date_fin` est ajoutée. Aucun écrasement par null.

## Appels mock et paramètres

Un seul nouvel appel `GET /appointments/availability`. Aucun POST.

Le journal `_meta/calls` ne conserve pas la query string. Paramètres inférés de la session persistée au moment de l’appel et du filtre mock (slots vides si service/site/dates incorrects) :

`service=PASSEPORT`, `site=PARIS`, `dateDebut=2026-11-03`, `dateFin=2026-11-03`.

## Créneaux présentés

| Créneau | Présenté |
| --- | --- |
| 09:00–09:30, 2 places (`33333333-…`) | oui |
| 10:00–10:30 COMPLET | non |

## Durées et mémoire Ollama

| Tour | Durée | Mémoire |
| --- | --- | --- |
| 1 | 80,1 s | ~80 Mio → ~1,08 Gio |
| 2 | 15,3 s | ~1,09 Gio → ~1,11 Gio |

## Désactivation

`POST .../deactivate` → 200. `active = false`, `activeVersionId = null`, version/compteur inchangés (`2fea54b3-…` / 4), 134/137, 0 webhook, 0 workflow actif.

## Postflight PostgreSQL TEST

1 rendez-vous, 4 sessions (dont `rec008-8f1fd-memory-01`), 0 tentative, 0 notification. Pas de session parasite hors les quatre attendues.

## Postflight GovSuite

13, 14, 12, 48, 0 tentative, empreinte inchangée. Mailpit inchangé (5 / 2 / 98 304).

## Anomalies

Aucune. La correction 8F-1F-C se comporte comme prévu sur ce scénario de reprise partielle.

## Verdict

**PASS** — les 10 critères de la mission sont satisfaits.

Scénario de demande complète en un seul message (après autorisation distincte) : **GO**.

Activer ou chatter maintenant sans autorisation : **NO-GO**.

Arrêt 8F-1F-D.
