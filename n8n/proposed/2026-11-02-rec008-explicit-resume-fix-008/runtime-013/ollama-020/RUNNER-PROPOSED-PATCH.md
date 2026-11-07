# Runner proposals for future R01 (NOT applied / NOT executed)

Source measures: `RESULT.json` / `MEASURES.json` (020).

## Measured baselines (synth prompt « OK »)

| Phase | Wall | load_duration | prompt_eval | eval |
| --- | --- | --- | --- | --- |
| Cold (model unloaded) | **88.2 s** | 63.2 s | 23.5 s | 0.2 s |
| Warm (`keep_alive=10m`) | **3.6 s** | 1.6 s | 0.4 s | 0.3 s |

Client actuel : **45 s** → insufficient even for cold load alone.

## Proposed `run-runtime-013.js` changes (local only)

1. **Prefight Ollama**
   - `GET http://rec008-ollama:11434/api/ps` via n8n container (or published URL if added later).
   - Require `qwen2.5:1.5b` in `models[]` **or** run controlled warm-up then re-check.
   - STOP / NO-GO chat if model absent from `/api/ps` after warm.

2. **Warm-up (optional gate)**
   - `POST /api/chat` synth, `keep_alive: "10m"`, `num_predict: 8`.
   - Verify `/api/ps` lists model + `expires_at` future.
   - HTTP 200 alone ≠ warm success.

3. **Timeout**
   - Replace hard `CHAT_TIMEOUT_MS = 45000` with measured value:
     - After verified warm: **`180000` ms** (3 min) — covers Camille-sized prompts above synth 3.6 s with margin.
     - If warm fails / cold risk: **`300000` ms** (5 min) — aligns with 016 ~3m10s chat + margin.
   - Formula documented: `max(180s, cold_wall+60s)` when cold known; never silent bump 60–120s.
   - **`retried` remains false** — no auto-retry.

4. **Correlation**
   - Record `sessionId`, activate/deactivate timestamps, Ollama `/api/ps` snapshot, PG `updated_at` before/after.
   - After client abort: **do not** retry; wait `settleMs` (e.g. 30–60s) then PG snap + note late-write if `updated_at` moved.

5. **Executions**
   - Poll `/rest/executions?status=running` before deactivate and after settle.
   - If running after deactivate → `safeDeclared=false` / UNCERTAIN.

6. **Webhooks**
   - Existing deactivate + webhook count 0 check retained.

## Observability (config proposal — NOT applied in 020)

Settings observed readonly: `saveDataSuccessExecution=all`, `saveDataErrorExecution=all`, but `execution_entity=0`.

Propose future TEST-only mission:

- Confirm env `EXECUTIONS_DATA_SAVE_ON_SUCCESS` / prune / `EXECUTIONS_DATA_MAX_AGE`.
- Temporarily disable prune or raise retention for campaign window.
- Re-enable prune in postflight.
- Correlate `executionId` ↔ `sessionId` in runner logs (no PII).

## Out of scope here

- No R01 chat, no activate, no PUT, no Docker mem bump (document 1.5 GiB holds ~1.1 GiB loaded).
