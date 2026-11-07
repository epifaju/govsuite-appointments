# ASK-PRENOM-RUNTIME-013 — conversational path note (offline)

**Verdict: UNCERTAIN** (scenarios not executed) — workflow unchanged during 013.

## Workflow state

| Item | Value |
| --- | --- |
| FIX-008 install | TEST-INSTALL-RETRY-012 PASS — only `Gérer collecte progressive` |
| SHA | `f75d49849231f956bb9ae5383111ea84b362dc58de6711cc75d2e7e2a26917fe` |
| versionId / counter | `fd75ba32-…` / 10 (preflight = post-stop) |
| 013 mutations | none — no PUT, no activate, no chat |
| Stop | REST socket close (`UND_ERR_SOCKET`) on GET `/rest/workflows` **before activate** |

R01 / R02 / R03: **not executed** (no retry). Fixtures preserved.

## Expected paths (still FIX-008)

Unchanged from installed FIX-008; not runtime-proven in 013:

1. **R01** — active session, message `Camille` at `ASK_PRENOM` → capture prénom → advance to **`ASK_EMAIL`** (no `session_expired`).
2. **R02** — expired session, message `Camille` → **`session_expired`** response; draft preserved; step stays `ASK_PRENOM`; prénom **not** captured.
3. **R03** — expired session, message `reprendre` → TTL refresh + stay **`ASK_PRENOM`**; resume token **not** captured as prénom; no advance to `ASK_EMAIL`.

## Non-actions

No activation, no workflow edit, no CreateAppointment POST in this note phase.
