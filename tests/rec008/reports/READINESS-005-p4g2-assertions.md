# READINESS-005 — Assertions P4G2 (catalogue, non exécuté)

**Verdict mission : PASS** (catalogue + classifieur hors ligne)  
**Runtime P4G2 : non exécuté** → **NO-GO** jusqu’à autorisation  
**LIVE / webhook / POST CreateAppointment : non touchés**

## Cible

| Champ | Valeur |
| --- | --- |
| Session | `rec008-8f2b1-slot-01` |
| chatInput | `reprendre` |
| Messages | 1, aucun retry |
| Env | TEST uniquement |

## Offline déjà OK (T03)

| Assertion T03 | Maps to |
| --- | --- |
| resume_intent_create | R005-A04 (partiel VM) |
| refresh_ttl_true | R005-A03 (flag only) |
| session_expired_cleared | A03/A04 flags |
| preserve_draft | R005-A05 (flag only) |
| no_claim_post | R005-A06 (chemin VM) |

Preuve = simulation VM — **pas** HTTP/PG/mock/deactivate.

## Runtime required (à prouver plus tard)

| ID | PASS | FAIL | UNCERTAIN |
| --- | --- | --- | --- |
| A01 HTTP200 | 200 + JSON | 4xx/5xx clair | timeout / tronqué |
| A02 type | `create_appointment_question` + step ASK_CREATE_SERVICE + ready/claim false | `session_expired` / ready\|claim true | type manquant |
| A03 TTL | renew +2h, futur | non renouvelé | horloge/snapshot |
| A04 intent/pending/step | GENERAL→CREATE, pending CREATE, step ASK_CREATE_SERVICE | purge / mauvais intent | lecture KO |
| A05 draft | flags/slots préservés, attempts=0 | invention / purge | fingerprint incomparable |
| A06 CLAIM/POST | Δ=0 hard | CLAIM/POST>0 | compteurs KO |
| A07 deactivate | active=false, webhooks=0 | reste actif | deactivate illisible |
| A08 protocole | 1 msg / 0 retry | retry / 2e msg | count inconnu |
| A09 LIVE | empreinte + Mailpit inchangés | divergence | non lu |

## STOP

- FAIL hardStop A06/A07
- UNCERTAIN transport → pas de retry
- Session non expirée au préflight (P4G2 historique déjà joué) → STOP readiness / reset autorisé requis
- LIVE divergente

## Commandes (catalogue only)

```bash
node tests/rec008/unit/readiness-005-p4g2.test.cjs
node tests/rec008/scripts/run-self-tests.cjs
```

## Artefacts

- `tests/rec008/readiness/R005-p4g2-explicit-resume-assertions.json`
- `tests/rec008/lib/assertions/readiness-005-p4g2.cjs`
- `tests/rec008/fixtures/readiness-005-p4g2-synthetic-evidence.json`

Phase runtime suivante **non autorisée**.
