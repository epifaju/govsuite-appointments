# RUNTIME-R01-RETRY-015 — offline note

**Verdict: UNCERTAIN** — transport timeout; not a métier FAIL.

## Observed (TEST)

| Step | Result |
| --- | --- |
| Activate | OK (`active: true`, versionCounter 10) |
| Chat webhook POST | timeout / abort ~45s (`elapsedMs` 45018, `status` 0, `retried: false`) |
| PG before → after | unchanged: `ASK_PRENOM`, `prenom` null, fingerprint `1\|14\|4\|0` |
| Deactivate | OK (inactive, webhooks 0, verified) |

Artifacts: `artifacts-r01-015/`.

## Path (unchanged)

Webhook chat path remains **FIX-008** (`Gérer collecte progressive` install-012). R01 expected advance `ASK_PRENOM` → `ASK_EMAIL` on « Camille » was **not** runtime-proven: no HTTP body, PG unmoved.

## Interpretation

Client abort at 45s proves **transport UNCERTAIN** only. It does **not** prove métier FAIL (or PASS). No retry.

## Non-actions

No re-activate, no workflow edit, no CreateAppointment POST from this note.
