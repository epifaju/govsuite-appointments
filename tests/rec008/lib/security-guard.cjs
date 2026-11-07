'use strict';

const fs = require('fs');
const path = require('path');
const { REC008_ROOT, PROJECT_ROOT } = require('./load-json.cjs');

const ALLOWED_WRITE_ROOTS = [
  path.join(REC008_ROOT, 'reports'),
  path.join(REC008_ROOT, 'tmp')
];

const ALLOWED_READ_ROOTS = [
  REC008_ROOT,
  path.join(PROJECT_ROOT, 'n8n', 'proposed')
];

const BLOCKED_READ_FRAGMENTS = [
  path.join('n8n', 'live-exports'),
  path.join('n8n', 'workflows')
];

let installed = false;
const violations = [];

function record(kind, detail) {
  violations.push({ kind, detail, at: new Date().toISOString() });
  const err = new Error('SECURITY_GUARD:' + kind + ' — ' + detail);
  err.code = 'SECURITY_GUARD';
  err.kind = kind;
  throw err;
}

function real(p) {
  return path.resolve(p);
}

function isUnder(root, target) {
  const r = real(root);
  const t = real(target);
  return t === r || t.startsWith(r + path.sep);
}

function assertAllowedWrite(targetPath) {
  const t = real(targetPath);
  if (!ALLOWED_WRITE_ROOTS.some((root) => isUnder(root, t))) {
    record('WRITE_DENY', t);
  }
  for (const root of ALLOWED_WRITE_ROOTS) {
    fs.mkdirSync(root, { recursive: true });
  }
}

function assertAllowedRead(targetPath) {
  const t = real(targetPath);
  for (const frag of BLOCKED_READ_FRAGMENTS) {
    if (t.includes(path.sep + frag + path.sep) || t.endsWith(path.sep + frag)) {
      record('READ_DENY_LIVEISH', t);
    }
  }
  if (!ALLOWED_READ_ROOTS.some((root) => isUnder(root, t))) {
    record('READ_DENY', t);
  }
}

function assertNoLiveSecrets(env) {
  const keys = Object.keys(env || process.env);
  for (const key of keys) {
    const upper = key.toUpperCase();
    if (upper.includes('LIVE') && /PASSWORD|SECRET|TOKEN|KEY|DATABASE_URL/.test(upper)) {
      const val = String((env || process.env)[key] || '');
      if (val.trim()) record('LIVE_SECRET_ENV', key);
    }
    if (/^DATABASE_URL$|^POSTGRES_URI$|^PGURL$/i.test(key)) {
      const val = String((env || process.env)[key] || '');
      if (/postgres(ql)?:\/\//i.test(val)) record('PG_DSN_ENV', key);
    }
  }
}

function assertSyntheticIdentity(obj, label) {
  const text = JSON.stringify(obj || {});
  if (/@(?!example\.test\b)[a-z0-9.-]+\.[a-z]{2,}/i.test(text)) {
    // allow example.test only for emails in fixtures under test
    const emails = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || [];
    for (const email of emails) {
      if (!/@example\.test$/i.test(email)) {
        record('NON_SYNTHETIC_EMAIL', label + ':' + email);
      }
    }
  }
}

function installNetworkAndPgBlocks() {
  if (installed) return;
  installed = true;

  const block = (kind) =>
    function blocked() {
      record(kind, 'attempted');
    };

  globalThis.fetch = block('HTTP_FETCH');

  try {
    const http = require('http');
    const https = require('https');
    http.request = block('HTTP_REQUEST');
    http.get = block('HTTP_GET');
    https.request = block('HTTPS_REQUEST');
    https.get = block('HTTPS_GET');
  } catch (_) {
    /* ignore */
  }

  const Module = require('module');
  const originalRequire = Module.prototype.require;
  Module.prototype.require = function guardedRequire(id) {
    const name = String(id);
    if (
      name === 'pg' ||
      name === 'postgres' ||
      name === 'mysql' ||
      name === 'mysql2' ||
      name === 'tedious'
    ) {
      record('PG_MODULE', name);
    }
    return originalRequire.apply(this, arguments);
  };
}

function installOfflineGuards() {
  assertNoLiveSecrets(process.env);
  installNetworkAndPgBlocks();
}

function getViolations() {
  return violations.slice();
}

function resetViolationsForTests() {
  violations.length = 0;
}

module.exports = {
  installOfflineGuards,
  assertAllowedWrite,
  assertAllowedRead,
  assertNoLiveSecrets,
  assertSyntheticIdentity,
  getViolations,
  resetViolationsForTests,
  ALLOWED_WRITE_ROOTS,
  ALLOWED_READ_ROOTS,
  REC008_ROOT,
  PROJECT_ROOT
};
