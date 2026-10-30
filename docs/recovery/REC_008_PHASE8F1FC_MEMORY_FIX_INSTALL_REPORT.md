# REC-008 phase 8F-1F-C — Installation contrôlée de la correction mémoire

Un seul `PUT` a installé la correction 8F-1F-B dans n8n TEST. Le workflow reste inactif. Aucun message, aucune activation, aucun POST métier.

Verdict pour un test de reprise de session après autorisation distincte : **GO**.

## Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow `OCD9It1uKFhOoWNF` | inactif, `activeVersionId = null` |
| Version / compteur | `bb9aad73-3cf5-4c1b-bb08-132df3ccbb45` / 3 |
| Graphe | 134 nœuds, 137 connexions |
| Autres workflows TEST actifs | 0 |
| Chat Trigger | `public: true`, webhook `a91c4e70-6b18-4f0d-9c55-2e7d8a14b603` |
| PostgreSQL credential | `Fs0l0058q5CEadRw` (30 nœuds) |
| Ollama credential | `dxzHqBq8Q60R8BOz` |
| HTTP | 10 URL vers `http://rec008-mock:8080/...` |
| Isolation réseau | aucun TCP ouvert vers GovSuite depuis n8n TEST |
| PostgreSQL TEST | 1 rendez-vous, 3 sessions, 0 tentative, 0 notification |
| Mock `server.mjs` | SHA-256 `845c9f6be8b099e0a2068379f6e8f3a12a90aec73f2c496e1a25898b4d225535` |
| Mock compteurs | `total` 2, `GET /appointments/availability 200` × 2, 0 POST |
| GovSuite | 13, 14, 12, 48, 0 tentative, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Mailpit GovSuite (`:8026`) | 5 messages, 2 non lus, base 98 304 octets |
| Exécutions persistées | 0 |

## SHA-256 du candidat

Fichier : `n8n/proposed/2026-10-30-rec008-phase8f1fb-NON-PUBLIE/10_AI_ConsularAssistant_MEMORY_FIX_NON_PUBLIE.json`

SHA-256 : `1cf46a9fabb58d2beb83ad084a8eeb30b7758ab5fb1e9c7f95b2715db623c64b` — conforme.

134 nœuds, 137 connexions, `active: false`.

## Export avant installation

Chemin : `n8n/proposed/2026-10-30-rec008-phase8f1fc-MEMORY-FIX-INSTALL/before-OCD9It1uKFhOoWNF.json`

SHA-256 : `58ca88a2788a799a7f13438179c41a73a3258d25609da8a8dd4158537ddd0543`

Identique à l’export 8F-1B utilisé comme source de la copie NON PUBLIÉE.

## Diff exact des trois nœuds

Seuls ces nœuds Code diffèrent (paramètre `jsCode`) :

| Nœud | SHA avant | SHA après | Octets |
| --- | --- | --- | --- |
| `Parser intention` | `72e1c19c…f6bce` | `c423a632…d160` | 17 147 → 18 842 |
| `Fusionner état conversation` | `3bdfb6a2…e7cd54` | `f5c98a99…90656` | 22 465 → 23 044 |
| `Gérer collecte progressive` | `de3ded17…e32f68` | `55c05423…0886d` | 26 710 → 26 724 |

Changements :

1. **Parser** — dates qualifiées (`date de fin`, `du … au …`, début explicite), validation calendaire, rejet des dates invalides.
2. **Fusionner** — branche sans action métier active utilise `pick(current, previous)` au lieu de `current ?? null`.
3. **Gérer** — `pendingAction = 'GET_AVAILABILITY'` conservé pour les tours suivants.

Connexions, credentials, webhook, settings de conservation : inchangés.

## Vérifications de sécurité métier

Contrôle statique avant PUT :

| Propriété | Résultat |
| --- | --- |
| Date de fin explicite → `dateFin` (pas écrasement forcé de `dateDebut`) | OK |
| Date invalide rejetée (`isValidNormalizedDate`) | OK |
| Valeur absente ne remplace pas via `pick` | OK |
| Modification explicite remplace | OK (même `pick`) |
| Nouvelle action métier : branche `startingNewAction` inchangée | OK |
| Tentative / UNCERTAIN / SQL concurrence inchangés hors patch | OK |
| Aucun `method: 'POST'` dans les 3 nœuds | OK |
| Nœuds HTTP Request inchangés | OK |
| Aucun nouveau chemin CreateAppointment | OK |
| Pas de réutilisation de clé d’idempotence dans le patch | OK |

## Payload API et SHA-256

Construit depuis le workflow live, avec uniquement les trois `jsCode` du candidat. Champs : `name`, `nodes`, `connections`, `settings`, `staticData`, `pinData`. Pas de `active: true`.

Fichier : `n8n/proposed/2026-10-30-rec008-phase8f1fc-MEMORY-FIX-INSTALL/update-body.json`

SHA-256 : `7ea4aff34f92beb01dc9096de6d1a43d7e728b430682cada862f903eb876638f`

## Résultat du PUT

`PUT http://127.0.0.1:5682/api/v1/workflows/OCD9It1uKFhOoWNF` → **200**.

Aucun appel à `/activate`. Port 5680 non utilisé.

## Nouvelle version et compteur

| Champ | Avant | Après |
| --- | --- | --- |
| `versionId` | `bb9aad73-3cf5-4c1b-bb08-132df3ccbb45` | `2fea54b3-ed59-4b83-a404-7166bad06fb2` |
| `versionCounter` | 3 | 4 |
| `active` | false | false |
| `activeVersionId` | null | null |

## Comparaison installé / candidat

Export après : `after-OCD9It1uKFhOoWNF.json` — SHA-256 `36259a0f8400570c22a3a255611c3a2e18ccc3fa83945b29fd492a4d37812e78`.

Les trois `jsCode` installés sont byte-identiques au candidat. Différences hors métadonnées n8n (`versionId`, `versionCounter`, timestamps) uniquement. Credentials et connexions identiques au préflight.

## État d’activation

Inactif. Aucun webhook enregistré (`webhook_entity` vide). 0 exécution conversationnelle. 0 workflow TEST actif.

## Compteurs PostgreSQL TEST

Inchangés : `1|3|0|0` (rendez-vous, sessions, tentatives, notifications). Session `rec008-8f1d-availability-01` laissée telle quelle (altérée en 8F-1F-A).

## Compteurs mock

Inchangés : `total` 2, uniquement 2 GET availability, 0 POST, `distinctKeys` 0.

## État GovSuite

Inchangé : 13, 14, 12, 48, 0 tentative, empreinte `a2dea067599fd4f0a5f857551adc67cc`. Mailpit : 5 / 2 / 98 304 octets.

## Anomalies

Aucune bloquante. Note : l’API Mailpit sur `:8025` n’est pas celle de GovSuite (publiée sur `:8026`) ; le contrôle postflight a utilisé le conteneur `govsuite-mailpit`.

## Artefacts

`n8n/proposed/2026-10-30-rec008-phase8f1fc-MEMORY-FIX-INSTALL/` :

- `before-OCD9It1uKFhOoWNF.json`
- `after-OCD9It1uKFhOoWNF.json`
- `update-body.json`
- `RESULT.json`
- `node-excerpts.json`
- `put-response.json`

## Verdict

Test de reprise de session (après autorisation distincte, avec activation temporaire contrôlée) : **GO**.

Activer, chatter ou exécuter maintenant sans autorisation : **NO-GO**.

Arrêt 8F-1F-C.
