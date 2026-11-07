# STOP conditions — campagne ASK_PRENOM S01–S03 (documentation)

Fail-fast. **Aucun retry** automatique après timeout, erreur réseau, ou réponse ambiguë.

Ces conditions s’appliquent à une future exécution autorisée ; **ASK-PRENOM-READINESS-007 n’exécute rien**.

Complète (ne remplace pas) `STOP-CONDITIONS.md` (P4G2).

---

## Préflight → STOP (ne pas activer, ne pas poster)

| Code | Condition |
| --- | --- |
| `auth-missing` | Autorisation humaine absente, ambiguë, ou couvrant plusieurs S0x à la fois |
| `test-live-confusion` | Ports / credentials / volumes / URLs suggèrent LIVE ou mélange |
| `preflight-failed` | Ancrage workflow / SHA / graphe / compteurs échoue |
| `workflow-active-unexpected` | Workflow déjà actif ou `activeVersionId` non null avant fenêtre contrôlée |
| `other-active` | Autre workflow actif détecté |
| `webhooks-already-active` | Lignes webhook actives avant activation prévue |
| `session-id-collision` | Même `sessionId` réutilisé pour deux S0x sans reset autorisé |
| `target-state-mismatch-s01` | S01 : session absente, expirée, step ≠ `ASK_PRENOM`, ou prénom déjà présent |
| `target-state-mismatch-s02` | S02 : session absente, **non** expirée, ou step/pending hors profil ASK_PRENOM+Dupont |
| `target-state-mismatch-s03` | S03 : session absente, **non** expirée, step ≠ `ASK_PRENOM`, ou profil type P4G2 sans identité |
| `wrong-message-for-scenario` | Plan message ≠ `Camille` (S01/S02) ou ≠ `reprendre` (S03) |
| `open-attempts` | Tentatives ouvertes ≠ 0 |
| `pg-fingerprint-drift` | Empreinte PG ≠ ancre préflight |
| `mock-drift` | Mock scenario / compteurs hors ancre |
| `live-fingerprint-drift` | Empreinte LIVE ≠ ancre (ne pas « corriger » LIVE) |
| `mailpit-drift` | Mailpit ≠ ancre préflight |
| `urls-or-credentials` | URLs mock hors `rec008-mock` ou credential Postgres non-TEST |
| `network-isolation` | Isolation TEST ↛ LIVE KO |
| `connectivity` | TCP / healthz / readiness KO **avant** message (pas de retry boucle) |
| `createappointment-unguarded` | Endpoint CreateAppointment joignable dans le plan d’action |
| `offline-pass-confused` | Tentative de traiter PASS offline C03/T02/T03 comme autorisation runtime |

## Pendant l’action unique → STOP

| Code | Condition |
| --- | --- |
| `activate` | Activation VC9 échoue ou `activeVersionId` ≠ attendu |
| `other-active` | Autre id actif après activation |
| `chat-webhook-missing` | Webhook chat POST attendu absent |
| `timeout-or-transport` | Timeout / reset / status HTTP ambigu → **UNCERTAIN**, conserver contexte, **ne pas renvoyer** le message |
| `second-message` | Toute tentation d’envoyer un 2ᵉ message (même S0x ou enchaînement S0y) |
| `cross-scenario-send` | Message S01 sur session S02/S03 (ou réciproque) |
| `createappointment-post` | Tout POST CreateAppointment (même « pour vérifier ») |
| `sql-mutation` | Toute écriture SQL métier hors lecture documentée |

## Postflight → STOP / verdict non-PASS

| Code | Condition |
| --- | --- |
| `deactivate-failed` | Workflow encore actif ou webhooks résiduels |
| `claim-or-post-delta` | CLAIM > 0 ou Δ mock CreateAppointment / availability (ou services non attendu) |
| `s01-no-capture` | S01 : prénom non persisté ou step ≠ `ASK_EMAIL` |
| `s01-draft-purged` | S01 : purge contexte / bascule `services` / `GET_SERVICES` |
| `s02-prenom-captured` | S02 : capture prénom ou refresh TTL sur free-text expired |
| `s02-get-services` | S02 : routage `GET_SERVICES` / purge brouillon |
| `s03-step-lost` | **S03-brief seulement** : step ≠ `ASK_PRENOM` après `reprendre` — **NO-GO brief** sur VC9 actuel (observé → `ASK_EMAIL`) |
| `s03-prenom-invented` | **S03-brief seulement** : `reprendre` capturé comme prénom — **NO-GO brief** (VC9 capture effectivement `prenom=reprendre`) |
| `s03-ttl-not-renewed` | S03 : session toujours expirée ou politique +2 h non respectée |
| `s03-brief-unauthorized` | Tentative d’accepter S03-brief sans correctif VC9 (skip collect sur `explicitResumeMsg`) |
| `s03-vc9-actual-as-product` | Campagne « VC9-actual » présentée comme acceptation produit (diagnostic seulement) |
| `pg-or-live-changed` | Empreinte PG métier ou LIVE changée hors attendu |
| `retry-performed` | Un retry a été effectué → FAIL process |
| `phase-auto-advance` | Tentative d’autoriser S0y ou phase suivante depuis ce run |

## Comportement attendu au STOP

1. Désactiver le workflow si une activation avait démarré (quand runtime autorisé).
2. Écrire l’artefact d’échec (raison + checks + `scenarioId`) **sans PII/secrets**.
3. Verdict **FAIL** (écart clair) ou **UNCERTAIN** (transport ambigu).
4. **Halt** — pas de S0y, pas de LIVE, pas de retry.
