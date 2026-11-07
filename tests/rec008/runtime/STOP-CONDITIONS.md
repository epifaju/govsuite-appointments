# STOP conditions — P4G2 runtime (documentation)

Fail-fast. **Aucun retry** automatique après timeout, erreur réseau, ou réponse ambiguë.

Ces conditions s’appliquent à une future exécution autorisée ; **cette mission READINESS-005 n’exécute rien**.

## Préflight → STOP (ne pas activer, ne pas poster)

| Code | Condition |
| --- | --- |
| `auth-missing` | Autorisation humaine absente, ambiguë, ou hors périmètre P4G2 |
| `test-live-confusion` | Ports / credentials / volumes / URLs suggèrent LIVE ou mélange |
| `preflight-failed` | Un contrôle d’ancrage workflow / SHA / graphe / compteurs échoue |
| `workflow-active-unexpected` | Workflow déjà actif ou `activeVersionId` non null avant fenêtre contrôlée |
| `other-active` | Autre workflow actif détecté |
| `webhooks-already-active` | Lignes webhook actives avant activation prévue |
| `target-state-mismatch-p4g1` | Session cible absente, non expirée, intent/step/pending hors profil post-P4G1 |
| `open-attempts` | Tentatives ouvertes ≠ 0 |
| `pg-fingerprint-drift` | Empreinte PG ≠ ancre préflight |
| `mock-drift` | Mock scenario ≠ `created` ou compteurs mock ≠ 0 |
| `live-fingerprint-drift` | Empreinte LIVE ≠ ancre (ne pas « corriger » LIVE) |
| `mailpit-drift` | Mailpit ≠ ancre préflight |
| `urls-or-credentials` | URLs mock hors `rec008-mock` ou credential Postgres non-TEST |
| `network-isolation` | Isolation TEST ↛ LIVE KO |
| `connectivity` | TCP / healthz / readiness KO **avant** message (pas de retry boucle) |
| `createappointment-unguarded` | Endpoint CreateAppointment joignable dans le plan d’action |

## Pendant l’action unique → STOP

| Code | Condition |
| --- | --- |
| `activate` | Activation VC9 échoue ou `activeVersionId` ≠ attendu |
| `other-active` | Autre id actif après activation |
| `chat-webhook-missing` | Webhook chat POST attendu absent |
| `timeout-or-transport` | Timeout / reset / status HTTP ambigu → **UNCERTAIN**, conserver contexte, **ne pas renvoyer** `reprendre` |
| `second-message` | Toute tentation d’envoyer un 2ᵉ message |
| `createappointment-post` | Tout POST CreateAppointment (même « pour vérifier ») |
| `sql-mutation` | Toute écriture SQL métier hors lecture documentée |

## Postflight → STOP / verdict non-PASS

| Code | Condition |
| --- | --- |
| `deactivate-failed` | Workflow encore actif ou webhooks résiduels |
| `claim-or-post-delta` | CLAIM > 0 ou Δ mock CreateAppointment / availability |
| `draft-invented` | Service / site / slot / identité apparus sans collecte |
| `ttl-not-renewed` | Session toujours expirée ou politique +2 h non respectée |
| `intent-not-restored` | `intent` ≠ `CREATE_APPOINTMENT` après reprise |
| `pg-or-live-changed` | Empreinte PG métier ou LIVE changée hors attendu (attendu PG : inchangé) |
| `retry-performed` | Un retry a été effectué → FAIL process |
| `phase-auto-advance` | Tentative d’autoriser la phase suivante depuis ce run |

## Comportement attendu au STOP

1. Désactiver le workflow si une activation avait démarré (quand runtime autorisé).
2. Écrire l’artefact d’échec (raison + checks) **sans PII/secrets**.
3. Verdict **FAIL** (écart clair) ou **UNCERTAIN** (transport ambigu).
4. **Halt** — pas de phase suivante.
