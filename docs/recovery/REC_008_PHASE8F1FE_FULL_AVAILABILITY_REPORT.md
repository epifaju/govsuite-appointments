# REC-008 phase 8F-1F-E — GET_AVAILABILITY en un seul message

Un message synthétique complet. Les quatre paramètres sont extraits, un seul GET availability est émis, et le créneau de 09:00 avec 2 places est présenté. Aucun POST métier.

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
| PostgreSQL TEST | 1 rendez-vous, 4 sessions, 0 tentative, 0 notification |
| Session `rec008-8f1fe-full-01` | absente |
| Mock | `total` 3, GET availability 3, 0 POST |
| GovSuite | 13, 14, 12, 48, 0, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Mailpit | 5 / 2 / 98 304 octets |

## Version du workflow

`2fea54b3-ed59-4b83-a404-7166bad06fb2`, compteur 4.

## Session et message

Session : `rec008-8f1fe-full-01`.

Message unique :

`Je souhaite connaître les disponibilités pour un passeport à Paris du 03/11/2026 au 03/11/2026.`

## Activation

`POST .../activate` → 200. Version active correcte. Webhooks chat GET/POST enregistrés. Endpoints toujours sur le mock. Seul ce workflow actif.

## Réponse HTTP

Statut **200**. Corps JSON `type: availability` avec un créneau unique.

## Durée

48 854 ms. Aucun retry.

## Extraction et persistance des quatre paramètres

| Champ | Valeur persistée |
| --- | --- |
| Intention | `GET_AVAILABILITY` |
| Service | `PASSEPORT` |
| Site | `PARIS` |
| `date_debut` | `2026-11-03` |
| `date_fin` | `2026-11-03` |
| `pending_action` | `GET_AVAILABILITY` |

## Compteurs mock avant / après

| Mesure | Avant | Après |
| --- | --- | --- |
| `total` | 3 | 4 |
| GET `/appointments/availability` 200 | 3 | 4 |
| POST | 0 | 0 |

Un seul nouvel appel GET. Aucun POST.

### Paramètres HTTP

- **Observés dans les journaux mock** : aucun (le serveur mock et `_meta/calls` ne journalisent pas la query string ; `docker logs` ne contient pas d’URL avec paramètres).
- **Déduits** de la session persistée et de la réponse filtrée (slots vides si paramètres incorrects) : `service=PASSEPORT`, `site=PARIS`, `dateDebut=2026-11-03`, `dateFin=2026-11-03`.

## Créneau présenté

`33333333-3333-4333-8333-333333333333` — PASSEPORT / PARIS — 09:00–09:30 — `placesDisponibles: 2`.

## Exclusion du créneau complet

Le créneau 10:00 (COMPLET) n’apparaît ni dans `slots` ni dans le texte.

## Mémoire Ollama

1,082 Gio → 1,099 Gio. `OOMKilled` false, conteneur `running`.

## Désactivation

`POST .../deactivate` → 200. `active = false`, `activeVersionId = null`, version/compteur inchangés, 134/137, 0 webhook, 0 workflow actif.

## Intégrité PostgreSQL TEST

1 rendez-vous, 5 sessions (dont `rec008-8f1fe-full-01`), 0 tentative, 0 notification.

## Intégrité GovSuite

13, 14, 12, 48, 0 tentative, empreinte inchangée. Mailpit inchangé.

## Verdict

**PASS**.

Préparation des tests de collecte progressive et de confirmation explicite (après autorisation distincte) : **GO**.

Activer ou chatter maintenant sans autorisation : **NO-GO**.

Arrêt 8F-1F-E.
