# DIAG-017 — proposed patch (NOT installed)

## Scope

- Node: `Gérer collecte progressive` only
- Workflow: TEST `OCD9It1uKFhOoWNF` VC10 baseline
- **No PUT. No activation. No chat. No PG mutate.**

## SHA-256

| Artifact | SHA-256 |
| --- | --- |
| VC10 Gérer jsCode (install-012 / BEFORE) | `f75d49849231f956bb9ae5383111ea84b362dc58de6711cc75d2e7e2a26917fe` |
| Proposed AFTER | `23524b5d075d3fc136904b9a7fb00bba5e06f5ec858afa669e62d1d619685961` |

## Change summary

1. **§12.3** — Identity capture allowed when `slotId` **or** active identity step (`ASK_NOM` / `ASK_PRENOM` / `ASK_EMAIL` / `ASK_TELEPHONE`).
2. **§12.3** — Explicit resume commands (`reprendre`, …) are never captured as nom/prenom.
3. **§12.4** — Identity ladder prioritized when on identity step or partial identity fields present, even without `slotId`. Confirmation (`AWAIT_CREATE_CONFIRMATION`) still requires `slotId`.

## Preserved

- FIX-008 expired-session early returns (no implicit resume; `reprendre` refreshes TTL without capturing prenom).
- Idempotence / confirmation gates unchanged (`skipCreateProgression`, `createDecision`).
- TTL refresh still driven by caller flags / Sauvegarder `refreshSessionTtl`.
- Parser / Fusionner / Sauvegarder SQL untouched.

## Files

- `Gerer_collecte_progressive.BEFORE.js`
- `Gerer_collecte_progressive.AFTER.js`
- Offline regression: `../offline-gerer-r01-routing.test.cjs`
