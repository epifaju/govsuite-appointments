# STOP conditions — install TEST FIX-008 (documentation)

Fail-fast. **Aucun retry** automatique après timeout, erreur réseau, ou réponse ambiguë.

Ces conditions s’appliquent à une future install autorisée ; **TEST-INSTALL-READINESS-009 n’exécute rien**.

Complète (ne remplace pas) `tests/rec008/runtime/STOP-CONDITIONS.md` (P4G2) et `STOP-CONDITIONS-ASK-PRENOM.md`.

---

## Préflight → STOP (ne pas PUT)

| Code | Condition |
| --- | --- |
| `auth-missing` | Autorisation humaine absente, ambiguë, ou élargie (activation / chat / LIVE) |
| `test-live-confusion` | Ports / credentials / volumes / URLs suggèrent LIVE ou mélange |
| `offline-pass-confused` | PASS `run-fix-008` traité comme GO install |
| `preflight-failed` | Ancrage workflow / SHA / graphe / compteurs échoue |
| `workflow-active-unexpected` | Workflow déjà actif ou `activeVersionId` non null |
| `other-active` | Autre workflow actif |
| `webhooks-already-active` | Webhooks actifs avant fenêtre |
| `baseline-sha-mismatch` | Export TEST ≠ VC9 `6284f867…f82b889` |
| `version-mismatch` | `versionId` / counter ≠ ancre VC9 documentée |
| `candidate-sha-mismatch` | Fichier local after ≠ `849201dd…` |
| `wrong-candidate` | Payload ≠ `after-OCD9It1uKFhOoWNF.json` de ce dossier FIX-008 |
| `backup-missing` | Pas d’export / BACKUP avant PUT |
| `open-attempts` | Tentatives ouvertes ≠ 0 |
| `pg-fingerprint-drift` | Empreinte PG TEST ≠ ancre |
| `mock-drift` | Mock hors ancre |
| `live-fingerprint-drift` | Empreinte LIVE ≠ ancre |
| `mailpit-drift` | Mailpit ≠ ancre |
| `urls-or-credentials` | URLs hors `rec008-mock` ou Postgres non-TEST |
| `network-isolation` | Isolation TEST ↛ LIVE KO |
| `connectivity` | TCP / healthz KO **avant** PUT (pas de retry boucle) |
| `createappointment-unguarded` | Plan d’action inclut CreateAppointment / chat |

## Pendant PUT unique → STOP

| Code | Condition |
| --- | --- |
| `second-put` | Tentative de 2ᵉ PUT / retry |
| `activate` | Toute activation / publish / enable webhook |
| `timeout-or-transport` | Timeout / reset / status ambigu → **UNCERTAIN**, conserver backup, **ne pas** re-PUT |
| `chat-or-createappointment` | Tout message chat ou POST métier |
| `sql-mutation` | Écriture SQL métier |
| `docker-mutate` | compose up/down/recreate/prune/ports |
| `live-touch` | Toute action LIVE |

## Postflight → STOP / non-PASS

| Code | Condition |
| --- | --- |
| `deactivate-needed` | Workflow actif après install → désactiver puis FAIL |
| `after-sha-mismatch` | SHA after ≠ candidat `849201dd…` / jsCode Gérer ≠ `f75d4984…` |
| `unexpected-node-drift` | Nœud hors Gérer modifié |
| `settings-or-connections-drift` | Settings / connections changés |
| `claim-or-post-delta` | Δ mock CreateAppointment / avail / CLAIM |
| `pg-or-live-changed` | Empreinte PG métier ou LIVE hors attendu |
| `retry-performed` | Un retry a été effectué → FAIL process |
| `phase-auto-advance` | Tentative d’autoriser activation / S0x depuis ce run |
| `rollback-without-auth` | Rollback lancé sans ordre distinct |

## Comportement attendu au STOP

1. Ne pas activer ; désactiver si une activation a démarré.
2. Conserver backup + clé de contexte ; **pas** de second PUT.
3. Artefact d’échec (raison + checks) **sans** PII/secrets.
4. Verdict **FAIL** (écart clair) ou **UNCERTAIN** (transport ambigu).
5. Escalade selon `BACKUP-SHA-ROLLBACK.md` §3 — **halt**.
