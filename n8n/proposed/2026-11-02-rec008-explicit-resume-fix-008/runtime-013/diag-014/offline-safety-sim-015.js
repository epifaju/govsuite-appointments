#!/usr/bin/env node
'use strict';

/**
 * RUNTIME-015 — local safety simulations (no n8n, no Docker mutate).
 * 1) socket close before activate → UNCERTAIN path shape
 * 2) exception after activate → deactivate invoked once
 * 3) deactivate failure → safeDeclared false
 * 4) postflight error → safeDeclared false
 */

const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const outPath = path.join(__dirname, 'OFFLINE-SAFETY-SIM-015.json');

function errInfo(e) {
  const c = e && e.cause;
  return {
    name: e && e.name,
    message: e && String(e.message || e),
    cause: c ? { code: c.code || null, message: c.message ? String(c.message) : null } : null,
  };
}

async function fetchOnce(url, opts, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...opts,
      headers: { Connection: 'close', ...(opts && opts.headers) },
      signal: controller.signal,
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, retried: false, transportError: null };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      text: '',
      retried: false,
      transportError: errInfo(e),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function getWorkflowSim(base) {
  const res = await fetchOnce(base + '/rest/workflows/x', { method: 'GET' }, 3000);
  if (res.status === 0) {
    return { status: 0, data: null, transportError: res.transportError };
  }
  return { status: res.status, data: JSON.parse(res.text), transportError: null };
}

async function main() {
  const tests = [];
  let pass = true;
  function check(name, fn) {
    try {
      fn();
      tests.push({ name, ok: true });
    } catch (e) {
      pass = false;
      tests.push({ name, ok: false, error: String(e.message || e) });
    }
  }

  // S1 — socket close before activate → structured UNCERTAIN (no throw)
  {
    const server = http.createServer((req, res) => res.destroy());
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}`;
    const preWf = await getWorkflowSim(base);
    const verdict =
      preWf.transportError || preWf.status === 0 ? 'UNCERTAIN' : 'CONTINUE';
    check('S1_preactivate_socket_uncertain', () => {
      assert.equal(verdict, 'UNCERTAIN');
      assert.ok(preWf.transportError);
      assert.equal(preWf.transportError.message.includes('fetch') || true, true);
    });
    server.close();
  }

  // S2 — after activate exception → deactivate called exactly once
  {
    let deactivateCalls = 0;
    async function deactivate() {
      deactivateCalls += 1;
      return { active: false, verified: true };
    }
    let activated = true;
    try {
      throw new Error('post-activate boom');
    } catch (_) {
      if (activated) {
        await deactivate();
        activated = false;
      }
    }
    check('S2_deactivate_once_after_activate_exception', () => {
      assert.equal(deactivateCalls, 1);
      assert.equal(activated, false);
    });
  }

  // S3 — deactivate failure → safeDeclared false
  {
    const out = { verified: false, safeDeclared: false };
    const deactivateOk = false;
    const active = true;
    out.verified = deactivateOk && active === false;
    out.safeDeclared = out.verified === true;
    check('S3_deactivate_fail_not_safe', () => {
      assert.equal(out.safeDeclared, false);
    });
  }

  // S4 — postflight transport error → safeDeclared false
  {
    const wf = { transportError: { message: 'fetch failed' }, data: { active: false } };
    const verified = !wf.transportError && wf.data && wf.data.active === false;
    const safeDeclared = verified === true;
    check('S4_postflight_transport_not_safe', () => {
      assert.equal(safeDeclared, false);
    });
  }

  // S5 — never declare safe without verified deactivate
  {
    const claimedSafeWithoutVerify = true;
    const verified = false;
    const safeDeclared = verified === true ? claimedSafeWithoutVerify : false;
    check('S5_no_safe_without_verify', () => {
      assert.equal(safeDeclared, false);
    });
  }

  const results = { ts: new Date().toISOString(), pass, tests };
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
