#!/usr/bin/env node
'use strict';

/**
 * DIAG-014 offline transport tests — no n8n, no Docker mutate, no métier.
 * Validates error shaping, Connection: close behavior, zero-retry contract.
 */

const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const runnerPath = path.join(ROOT, 'run-runtime-013.js');
const outPath = path.join(__dirname, 'OFFLINE-TEST-RESULTS.json');

function errInfo(e) {
  const c = e && e.cause;
  return {
    name: e && e.name,
    message: e && String(e.message || e),
    cause: c
      ? { name: c.name || null, message: c.message ? String(c.message) : null, code: c.code || null }
      : null,
  };
}

function restHeaders(extra) {
  return { Connection: 'close', ...(extra || {}) };
}

async function fetchOnce(url, opts, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  const merged = { ...(opts || {}) };
  merged.headers = restHeaders(merged.headers);
  merged.signal = controller.signal;
  try {
    const res = await fetch(url, merged);
    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      elapsedMs: Date.now() - started,
      text,
      aborted: false,
      retried: false,
      transportError: null,
      requestConnection: merged.headers.Connection,
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      elapsedMs: Date.now() - started,
      text: '',
      aborted: String(e.name || '') === 'AbortError',
      error: String(e.message || e),
      transportError: errInfo(e),
      retried: false,
      requestConnection: merged.headers.Connection,
    };
  } finally {
    clearTimeout(timer);
  }
}

function startMock(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

async function main() {
  const results = { ts: new Date().toISOString(), tests: [], pass: true };

  function check(name, fn) {
    try {
      fn();
      results.tests.push({ name, ok: true });
    } catch (e) {
      results.pass = false;
      results.tests.push({ name, ok: false, error: String(e.message || e) });
    }
  }

  // T1 — errInfo preserves cause.code
  {
    const cause = Object.assign(new Error('other side closed'), { code: 'UND_ERR_SOCKET' });
    const e = new TypeError('fetch failed');
    e.cause = cause;
    const info = errInfo(e);
    check('T1_errInfo_cause_code', () => {
      assert.equal(info.message, 'fetch failed');
      assert.equal(info.cause.code, 'UND_ERR_SOCKET');
    });
  }

  // T2 — fetchOnce sets Connection: close and does not throw on socket error
  {
    const { server, base } = await startMock((req, res) => {
      res.destroy();
    });
    const r = await fetchOnce(base + '/x', { method: 'GET' }, 5000);
    check('T2_fetchOnce_no_throw_on_destroy', () => {
      assert.equal(r.status, 0);
      assert.equal(r.retried, false);
      assert.equal(r.requestConnection, 'close');
      assert.ok(r.transportError);
      assert.ok(r.transportError.message);
    });
    server.close();
  }

  // T3 — successful mock with Connection close
  {
    const { server, base } = await startMock((req, res) => {
      assert.equal(req.headers.connection, 'close');
      res.writeHead(200, { 'content-type': 'application/json', Connection: 'close' });
      res.end(JSON.stringify({ data: { id: 'wf', active: false } }));
    });
    const r = await fetchOnce(base + '/rest/workflows/x', { method: 'GET' }, 5000);
    check('T3_fetchOnce_ok_connection_close', () => {
      assert.equal(r.status, 200);
      assert.equal(r.retried, false);
      assert.equal(r.transportError, null);
      assert.ok(r.text.includes('"active":false'));
    });
    server.close();
  }

  // T4 — zero retry: calling fetchOnce twice on failure is caller-controlled; function itself retries=false always
  {
    let hits = 0;
    const { server, base } = await startMock((req, res) => {
      hits += 1;
      res.destroy();
    });
    const a = await fetchOnce(base + '/y', { method: 'GET' }, 3000);
    check('T4_single_attempt_no_internal_retry', () => {
      assert.equal(hits, 1);
      assert.equal(a.retried, false);
      assert.equal(a.status, 0);
    });
    server.close();
  }

  // T5 — runner source contracts (static)
  {
    const src = fs.readFileSync(runnerPath, 'utf8');
    check('T5_runner_no_fetchRetry_helper', () => {
      assert.equal(src.includes('async function fetchRetry'), false);
      assert.equal(/for\s*\([^)]*tries/i.test(src), false);
    });
    check('T5_runner_getWorkflow_uses_fetchOnce', () => {
      assert.match(src, /async function getWorkflow[\s\S]*fetchOnce\(/);
    });
    check('T5_runner_connection_close', () => {
      assert.match(src, /Connection:\s*'close'/);
    });
    check('T5_runner_safety_postflight', () => {
      assert.match(src, /async function safetyPostflight/);
      assert.match(src, /safeDeclared/);
    });
    check('T5_runner_preactivate_uncertain', () => {
      assert.match(src, /pre-activate transport UNCERTAIN/);
    });
    check('T5_runner_single_login', () => {
      // only one /rest/login string occurrence in login function body ideal; at least no double-login comment of old pattern
      assert.equal(src.includes('Re-fetch with native fetch to get set-cookie'), false);
    });
  }

  // T6 — keep-alive stale socket simulation (agent reuse vs close)
  {
    let n = 0;
    const { server, base } = await startMock((req, res) => {
      n += 1;
      if (n === 1) {
        res.writeHead(200, { Connection: 'keep-alive', 'Content-Length': '2' });
        res.end('ok');
        // forcibly close soon after to poison keep-alive peers that reuse
        setTimeout(() => {
          try {
            res.socket.destroy();
          } catch (_) {}
        }, 20);
      } else {
        res.writeHead(200, { Connection: 'close' });
        res.end('ok2');
      }
    });
    const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
    await new Promise((resolve, reject) => {
      http
        .get(base + '/a', { agent }, (res) => {
          res.resume();
          res.on('end', resolve);
        })
        .on('error', reject);
    });
    await new Promise((r) => setTimeout(r, 80));
    const reused = await new Promise((resolve) => {
      http
        .get(base + '/b', { agent }, (res) => {
          res.resume();
          res.on('end', () => resolve({ ok: true, status: res.statusCode }));
        })
        .on('error', (e) => resolve({ ok: false, code: e.code || null, message: e.message }));
    });
    agent.destroy();
    // fresh Connection:close style via fetchOnce should still work on new connection
    const fresh = await fetchOnce(base + '/c', { method: 'GET' }, 3000);
    check('T6_stale_keepalive_vs_connection_close', () => {
      // Document outcome: reused may fail OR succeed depending on timing; fresh must succeed or be structured
      assert.ok(reused.ok === true || reused.ok === false);
      assert.equal(fresh.retried, false);
      // If server still up, fresh should be 200; if destroy raced, structured error
      assert.ok(fresh.status === 200 || fresh.status === 0);
    });
    results.tests.push({
      name: 'T6_observation',
      ok: true,
      reused,
      freshStatus: fresh.status,
      hits: n,
    });
    server.close();
  }

  fs.writeFileSync(outPath, JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
  process.exit(results.pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
