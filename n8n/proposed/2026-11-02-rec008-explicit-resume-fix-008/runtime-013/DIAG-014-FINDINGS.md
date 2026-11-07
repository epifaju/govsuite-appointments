# DIAG-014 — runtime-013 runner transport failure (offline)

**Scope:** runner-only analysis of `run-runtime-013.js`. No workflow edit. No activation. No POST métier.  
**Verdict (prep offline):** **PASS** (root cause identified; minimal fix proposed; parent applies patch).  
**Root-cause confidence:** **confirmed** (stack + artifact timeline) for throw locus; **likely** for keep-alive idle close as underlying socket cause.

---

## Incident timeline (artifacts)

| t | Artifact | Fact |
| --- | --- | --- |
| 21:40:32 | `artifacts/preflight.json` | `ok: true`, healthz 200, GET workflow 200, inactive, fingerprint `1\|14\|4\|0` |
| 21:40:35 | `artifacts/R01-before.json` | Fixture snap written — scenario entered |
| 21:40:35 | `artifacts/campaign-fatal.json` | `TypeError: fetch failed` at `getWorkflow` L278 ← `runScenario` L571 |
| 21:41:38 | `artifacts/campaign-result.json` | Post-hoc forensics: `UND_ERR_SOCKET` / other side closed; **before activate**; no chat; fixtures kept |

Stack (verbatim locus):

```text
TypeError: fetch failed
  at async getWorkflow (...\run-runtime-013.js:278:15)
  at async runScenario (...\run-runtime-013.js:571:17)
  at async main (...\run-runtime-013.js:742:15)
```

Phase: **R01 pre-activate** (after `R01-before`, before `activate()` / chat). Zero métier side effects.

---

## Exact code loci

| Item | Lines | Behavior |
| --- | --- | --- |
| `fetchOnce` | **212–243** | Catches transport errors → `{ status:0, error, aborted, retried:false }` — **never throws** |
| Double login | **245–275** | `fetchOnce` login **then** bare `fetch` login again for `getSetCookie` |
| `getWorkflow` | **277–281** | Bare `fetch` — **throws** on undici failure |
| `getActiveIds` | **283–287** | Bare `fetch` — same |
| `activate` / `deactivate` / `sendMessageOnce` / healthz | **289–376**, **465** | Correctly use `fetchOnce` (0 retry) |
| Preflight uses unprotected GET | **469**, **472** | Survived this run; same throw risk |
| R01 pre-activate GET | **571** | **Crash site** |
| `deactivate` post-check | **324–325** | Calls bare `getWorkflow` / `getActiveIds` again |
| `main().catch` | **791–798** | Writes `error`/`stack`/`detail` only — **drops `e.cause` / `cause.code`**; **no safety postflight** |

---

## Root cause

### 1. Confirmed — unprotected bare `fetch` on admin GETs

`fetchOnce` exists specifically for “Single fetch — NO retry” and soft-fails.  
`getWorkflow` / `getActiveIds` bypass it. A transient undici `TypeError: fetch failed` therefore escapes to `main().catch` as **campaign-fatal** instead of scenario **UNCERTAIN** with `retried: false`.

### 2. Confirmed — fatal serializer loses `cause.code`

Node undici wraps socket errors as `TypeError: fetch failed` with detail on **`error.cause`** (e.g. `code: 'UND_ERR_SOCKET'`).  
`campaign-fatal.json` only persisted `String(e.message)` → `"fetch failed"`. Forensic code had to be recovered out-of-band (`campaign-result.json` / `PATH-NOTE-013.md`).

### 3. Likely — keep-alive idle socket + no `Connection: close`

Default undici keep-alive reuses a TCP connection to `127.0.0.1:5682`. Sequence:

1. Login (×2 bare/fetchOnce) + preflight healthz + GET workflow + GET active-ids  
2. Long gap: docker/psql fingerprint, mock probe, 3 session snaps (~seconds)  
3. R01: write before → bare GET `/rest/workflows` on possibly **stale keep-alive** → peer already closed → `UND_ERR_SOCKET`

Confidence **likely** (matches undici symptom + idle gap + second GET after successful first); not **confirmed** without a captured `cause` from the original throw.

### 4. Confirmed — unnecessary double login

`fetchOnce` already returns `headers: res.headers` (L225). Login ignores that and issues a **second** POST `/rest/login` via bare `fetch` only for cookies. Extra auth round-trip + extra pooled connection; comment at L261 is stale relative to `fetchOnce` return shape.

### 5. Confirmed — `main.catch` missing safety postflight

On throw: no deactivate-once, no inactive/webhook/fingerprint record. This incident was pre-activate so state stayed safe; a post-activate throw would risk leaving TEST workflow active.

---

## Non-causes (ruled out for this stop)

- Workflow / FIX-008 content — unchanged; preflight SHA/version matched.  
- Activate / chat / CreateAppointment — **not reached**.  
- Retry policy on métier — none fired (`retried: false` everywhere intended).  
- Preflight logic — PASS was valid.

---

## Minimal runner-only fix (0 retry on activate / chat / POST métier)

Preserve: `activate`, `sendMessageOnce`, deactivate POST already go through `fetchOnce` once.  
Change only harness resilience + diagnostics.

1. **Single login** — one `fetchOnce`; read cookie from returned `headers.getSetCookie()`. Drop second bare login.  
2. **Route `getWorkflow` / `getActiveIds` through `fetchOnce`** (timeout ~30s) with soft-fail return `{ status, data, error, aborted }` — **no retry loop**.  
3. **`Connection: 'close'`** on REST admin calls (login, getWorkflow, getActiveIds, activate, deactivate headers) to avoid stale keep-alive across docker gaps. Not a retry.  
4. **`runScenario` L571** — if transport `status===0` / error → verdict **UNCERTAIN**, write result, **STOP**, do not activate, do not chat.  
5. **`main().catch`** — persist `name`, `code`, `cause: { code, message }`; best-effort **one** `deactivate` + inactive/fingerprint snapshot if session cookie exists (same 0-retry `fetchOnce` path). Tag `fatal-safety`.

Do **not**: retry activate/chat/POST; edit workflow; auto-continue R02/R03 after UNCERTAIN.

---

## Proposed patch text

See sibling `DIAG-014-PROPOSED-RUNNER-PATCH.diff.txt` (apply by parent). Not applied by n8n-developer.

---

## Impacts / non-régressions to verify after authorized runner patch

- Preflight still PASS on healthy stack.  
- Transport fail before activate → UNCERTAIN + fixtures kept + workflow inactive.  
- `campaign-fatal` (if any) includes `cause.code`.  
- Activate / chat still exactly one attempt each.  
- Mock CreateAppointment counter unchanged on transport stop.

---

## Install / apply plan (future authorization only)

1. Parent applies runner patch under `runtime-013/run-runtime-013.js`.  
2. Re-run only under explicit RUNTIME authorization + preflight/postflight.  
3. This DIAG does **not** authorize re-execution.

---

## Verdict

| Question | Answer |
| --- | --- |
| Offline diagnosis complete? | **PASS** |
| Root cause | Unprotected bare `fetch` in `getWorkflow` (+ lost `cause`); keep-alive idle close **likely** |
| Confidence | **confirmed** (throw locus) / **likely** (socket close) |
| Workflow action needed? | None |
| Next | Parent applies minimal runner patch; separate auth for any re-run |
