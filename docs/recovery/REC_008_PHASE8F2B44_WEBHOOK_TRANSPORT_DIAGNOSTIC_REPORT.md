# REC-008 phase 8F-2B44 — Diagnostic non destructif de l’échec de transport webhook

Diagnostic **lecture seule** de l’échec 8F-2B43 (`TypeError: fetch failed`, 3 ms) lors de l’envoi de `oui`.

**Aucun** message de chat, **aucun** `oui`/`non`, **aucune** activation du workflow principal, **aucun** PUT, **aucune** mutation SQL, **aucun** CLAIM, **aucun** POST CreateAppointment, **aucun** e-mail, **aucun** appel LIVE.

Verdict diagnostic : **INCONCLUSIVE** (échec transport client confirmé ; cause système exacte non démontrée — `error.cause` non capturé en 8F-2B43)  
GO/NO-GO nouvelle confirmation : **GO conditionnel** (tentative encore valide au diagnostic ; stack TCP/`/healthz` OK ; re-vérifier marge > 300 s avant tout `oui`)

Artefacts : `n8n/proposed/2026-10-31-rec008-phase8f2b44-WEBHOOK-TRANSPORT-DIAGNOSTIC/`  
(`DIAG.json`, `POSTFLIGHT.json`, `diag.js`, `postflight.js`)  
Sources 8F-2B43 : `…/phase8f2b43-POSITIVE-CONFIRMATION-FINALIZATION/` (`PREFLIGHT.json`, `RESULT.json`, `run.js`, `console.log`, `response.txt`)

## 1. Préflight

| Contrôle | Attendu | Observé | OK |
| --- | --- | --- | --- |
| Workflow TEST `OCD9It1uKFhOoWNF` | inactif | `active=false`, `activeVersionId=null` | oui |
| Version ID | `e1b32992-bc68-46af-86ce-c80af46f5305` | identique | oui |
| VersionCounter | 8 | 8 | oui |
| Graphe | 134 / 137 | 134 / 137 | oui |
| SHA Finaliser | `3fc500bf…ee7a` | identique | oui |
| Autres workflows actifs | 0 | 0 | oui |
| Webhooks actifs | 0 | 0 | oui |
| Chat Trigger | public + webhook `a91c4e70-…` | OK | oui |
| PostgreSQL TEST | 1 / 10 / 4 / 0 | **1 / 10 / 4 / 0** ; ouverte **1** | oui |
| Statuts tentatives | 1 ABANDONED + 1 AWAITING + 1 CONFIRMED + 1 EXPIRED | identique | oui |
| Mock | `created` ; POST 0 ; GET avail. 2 | identique | oui |
| LIVE | `13\|14\|12\|48\|0\|a2dea067…` | identique | oui |
| Mailpit | 5 / 2 / 98 304 | identique | oui |

Préflight **OK**. Aucun écart inexpliqué. STOP non déclenché.

## 2. Chronologie de l’échec 8F-2B43

Horodatages issus des artefacts / horloges PG TEST (Europe/Paris) :

| Instant | Événement |
| --- | --- |
| ~13:37:36 | Préflight ; tentative `AWAITING_CONFIRMATION`, `secsLeft≈5416` |
| ~13:37:40 | `PREFLIGHT.json` écrit |
| juste après | `POST /rest/workflows/…/activate` → **200** ; version `e1b32992-…` seule active |
| | Webhooks chat enregistrés : **GET + POST** `a91c4e70-…/chat` |
| 13:37:56 | Recontrôle tentative pré-envoi ; `secsLeft≈5396` |
| +5 s | Attente script |
| | Warmup `GET` webhook (erreurs avalées) |
| +1 s | Attente |
| 13:38:06 | Recontrôle immédiat ; `secsLeft≈5386` |
| ~13:38:06 | `POST` chat `oui` → **échec transport 3 ms** (`TypeError: fetch failed`) |
| ~13:38:11 | `response.txt` vide écrit |
| immédiat | Désactivation 200 ; webhooks = 0 |
| ~13:38:24 | `RESULT.json` / `console.log` ; verdict **UNCERTAIN** |

Effets métier : **aucun** (session/tentative/mock/LIVE/Mailpit inchangés — confirmé en 8F-2B43 et ici).

## 3. Analyse de `run.js`

Environnement d’exécution du client : **hôte Windows** (`win32`), Node (diagnostic actuel : `v20.19.4`), chemins `C:/…`, appels `docker exec` pour PG/mock/webhooks.

| Élément | Valeur |
| --- | --- |
| Base | `http://127.0.0.1:5682` (littéral IPv4, pas `localhost`) |
| URL webhook POST | `http://127.0.0.1:5682/webhook/a91c4e70-6b18-4f0d-9c55-2e7d8a14b603/chat` |
| Méthode | `POST` |
| Headers | `content-type: application/json`, `accept: application/json` |
| Corps | `{ action: 'sendMessage', sessionId, chatInput: 'oui' }` — **non rejoué** |
| Timeout | `AbortSignal.timeout(180000)` (3 min) — incompatible avec un échec à 3 ms |
| AbortController / retry sur le chat | **non** (un seul `fetch` ; pas de `fetchRetry`) |
| Proxy env | aucun observé au diagnostic (`HTTP_PROXY` / `HTTPS_PROXY` nuls) |
| Délai activation → envoi | ≈ 5 s + GET + 1 s après vérif. webhooks (~10 s depuis `attemptPreSend`) |
| Capture d’erreur | `name`, `message`, `elapsedMs` **seulement** — **pas** `error.cause` |

Chaîne réseau réelle (Compose TEST, non modifié) :

`hôte 127.0.0.1:5682` → conteneur `rec008-publish` (`proxy.mjs` TCP pipe) → `rec008-n8n:5678`.

Le même motif d’URL / warmup / POST a **réussi** en 8F-2B42 (`HTTP 200`, ~49 179 ms) quelques dizaines de minutes plus tôt.

## 4. Analyse de `console.log` et de l’erreur réseau

| Observation | Détail |
| --- | --- |
| HTTP status client | **0** |
| Durée | **3 ms** |
| Erreur | `TypeError: fetch failed` |
| Corps | vide |
| `error.cause` | **absent des artefacts** |
| Preuve d’arrivée webhook | **aucune** (`finaliserExec: null` ; mock Δ = 0 ; tentative inchangée) |

Baseline Node actuelle (même hôte) pour un port fermé : `fetch failed` avec  
`cause.code=ECONNREFUSED`, `syscall=connect`, `address=127.0.0.1`, `port=…` en dizaines de ms.  
La signature 8F-2B43 (3 ms, même message) est **compatible** avec une défaillance TCP immédiate (`ECONNREFUSED` / `ECONNRESET` / équivalent), **sans preuve formelle** faute de `cause` historisé.

Le warmup `GET` précédent avale toute erreur : on **ne sait pas** s’il a aussi échoué.

## 5. État Docker et n8n

| Conteneur | État au diagnostic |
| --- | --- |
| `rec008-n8n` | running ; Started `2026-11-01T10:33:58Z` ; **RestartCount=0** |
| `rec008-publish` | running ; Started `2026-11-01T10:33:59Z` ; **RestartCount=0** |
| `rec008-postgres` | healthy |
| `rec008-mock` | running |
| Mapping | `127.0.0.1:5682->5682/tcp` sur **publish** (n8n n’expose pas 5678 sur l’hôte) |

Écoute :

- n8n : `:::5678` (IPv6 any) + broker `127.0.0.1:5679`
- publish : écoute 5682 (proxy vers `rec008-n8n:5678`)
- hôte : `127.0.0.1:5682 LISTENING`

Logs n8n : pas de trace horodatée utile autour de 12:37–12:40 UTC ; messages génériques (`api.n8n.io` DNS, « Last session crashed » au **démarrage** du conteneur). Une ligne historique « unknown webhook POST a91c4e70-…/chat » existe, mais correspond à une réponse HTTP métier, **pas** à un `fetch failed` transport. Publish : aucun log (proxy silencieux).

Webhooks en 8F-2B43 : enregistrés à l’activation (GET+POST chat), retirés à la désactivation (0) — cohérent avec le script.

## 6. Tests de connectivité non métier

| Test | Résultat |
| --- | --- |
| TCP hôte → `127.0.0.1:5682` | **open** (~5 ms) |
| TCP hôte → `::1:5682` | **ECONNREFUSED** (mapping IPv4-only) |
| Résolution `127.0.0.1` | IPv4 uniquement (OK pour l’URL utilisée) |
| Résolution `localhost` | `::1` puis `127.0.0.1` (non utilisé par `run.js`) |
| GET `/healthz`, `/healthz/readiness`, `/rest/settings` | **200** |
| 8× GET `/healthz` séquentiels + 4 parallèles | 0 échec |
| Depuis conteneur n8n → n8n:5678 et publish:5682 | TCP + healthz OK |
| Depuis conteneur publish → idem | OK |
| POST `/healthz` (non chat) | HTTP 404 HTML (transport OK) |

**Aucun** appel au webhook chat avec message. **Aucun** `/appointments`.

## 7. État actuel de la tentative

ID `d566fc28-02de-4ae1-afbb-6f7d81362d4d` (lecture seule) :

| Champ | Valeur |
| --- | --- |
| Statut | **`AWAITING_CONFIRMATION`** |
| `expires_at` | `2026-11-01 15:07:51.743886+01` |
| `clock_timestamp()` (mesure) | `2026-11-01 13:54:29+01` |
| Marge restante | **≈ 4403 s** (> 300 s) |
| Lease | **absent** |
| Référence / appointment_id | **absents** |
| `submitted_at` / `confirmed_at` | **absents** |
| Clé / corps figé / empreinte | **présents** (long. clé 71 ; fp12 clé `e721ae85a9d7` ; fp12 `1aa346780669`) |
| `updated_at` | inchangé depuis création (`13:07:51`) |

**Non expirée** au moment du diagnostic → pas de NO-GO pour expiration.  
**Ne pas prolonger le TTL.** Re-vérifier la marge immédiatement avant tout futur `oui`.

## 8. Analyse des causes possibles

| Hypothèse | Preuve | Test non destructif | Résultat | Conclusion |
| --- | --- | --- | --- | --- |
| Port 5682 inaccessible | Échec 3 ms compatible refus/reset | TCP + healthz hôte | Accessible **maintenant** | **Écartée** comme état permanent ; **indéterminée** comme transient à 13:38:06 |
| Conteneur n8n indisponible / redémarré | RestartCount, StartedAt | `docker inspect` + logs | Pas de redémarrage ; uptime continu depuis 10:33Z | **Écartée** (redémarrage) ; hang bref **indéterminé** |
| Mauvaise URL webhook | URL vs Chat Trigger / 8F-2B42 | Lecture `run.js` + webhooks activés en 8F-2B43 | URL correcte ; 8F-2B42 OK | **Écartée** |
| Course activation ↔ webhook | Délai + enregistrement | Chronologie RESULT | Webhooks POST présents ; ~10 s après vérif. | **Écartée** (comme cause principale) |
| Contexte réseau client (hôte / proxy publish) | Proxy TCP naïf ; IPv6 `::1` refusé | Compose + probes | Client Windows → publish → n8n ; IPv4 OK, IPv6 non utilisé | **Plausible (transitoire)** mais **non démontrée** |
| Config fetch / Node (timeout, proxy, Abort) | `AbortSignal` 180 s ; pas de proxy env | Lecture code + env | Timeout non en cause ; cause non loguée | **Écartée** pour timeout/proxy ; lacune de télémétrie **confirmée** |
| IPv4/IPv6 mismatch sur l’URL | URL = `127.0.0.1` | DNS + TCP `::1` | Script en IPv4 | **Écartée** |
| Autre (connexion pool / pipe proxy) | 3 ms ; REST OK juste avant | Keep-alive healthz | Stable **maintenant** | **Indéterminée** |

## 9. Cause racine démontrée ou limites

**Démontré :**

1. L’échec est un **échec de transport HTTP client** avant toute réponse utilisable (status 0, 3 ms, corps vide).
2. **Aucun effet métier** n’a été produit (pas de CLAIM, pas de POST appointments, tentative inchangée).
3. L’URL, la méthode et le chemin chat étaient **corrects** et avaient fonctionné en 8F-2B42.
4. La stack TEST (n8n + publish:5682) est **saine au diagnostic** pour TCP et endpoints non métier.

**Non démontré :**

- Le code système exact (`ECONNREFUSED`, `ECONNRESET`, etc.), l’adresse/port dans `error.cause`, faute de capture en 8F-2B43.
- Qu’un composant précis (publish, n8n, pile Windows) ait été hors service à la milliseconde de l’échec.

**Limite principale du diagnostic :** impossibilité de rejouer le POST chat / d’activer le workflow pour reproduire, par restriction de phase.

## 10. Vérification d’intégrité (postflight)

| Contrôle | Résultat |
| --- | --- |
| Nouvelles tentatives | **non** (`1\|10\|4\|0`) |
| Changement de statut tentative cible | **non** (`AWAITING_CONFIRMATION`) |
| CLAIM / lease / submitted / confirmed | **non** |
| POST CreateAppointment | **0** (Δ mock = 0) |
| GET availability métier | **2** inchangé |
| Sessions | compteur 10 inchangé ; pas de mutation diagnostiquée |
| E-mail / Mailpit | 5 / 2 / 98 304 |
| Workflow modifié / activé | **non** (inactif, VC 8, SHA inchangé) |
| LIVE | empreinte `a2dea067…` inchangée |
| Docker Compose / mock / credentials | **non modifiés** |

Intégrité **OK**.

## 11. Verdict

**INCONCLUSIVE**

Le diagnostic non destructif est complet et l’intégrité est préservée, mais la cause technique fine du `fetch failed` à 3 ms **n’est pas démontrable** avec les artefacts 8F-2B43.

## 12. GO/NO-GO

**GO conditionnel** pour une **phase distincte** de confirmation positive, sous autorisation explicite, **si et seulement si** au moment de l’exécution :

1. `expires_at` encore dans le futur et marge **> 300 s** (sinon **NO-GO** — ne jamais prolonger le TTL ni réutiliser la clé).
2. Précontrôles non métier verts : TCP `127.0.0.1:5682` + GET `/healthz`.
3. Capture renforcée d’erreur transport : au minimum `error.cause` (`code`, `syscall`, `address`, `port`) — et résultat du warmup GET (ne plus l’avaler silencieusement).

Recommandation opérationnelle (hors exécution ici) : conserver `127.0.0.1` (éviter `localhost` / IPv6) ; un seul essai `oui` autorisé par phase, comme en 8F-2B43.

Arrêt ici. Attente d’une autorisation distincte.
