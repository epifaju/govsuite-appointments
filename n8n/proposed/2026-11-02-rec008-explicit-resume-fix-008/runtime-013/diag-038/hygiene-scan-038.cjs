'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dir = __dirname;
const docsRecovery = path.resolve(dir, '../../../../../../docs/recovery');
const testsReports = path.resolve(dir, '../../../../../../tests/rec008/reports');

// Patterns compiled from parts so this scanner source does not self-match.
const secretRe = new RegExp(
  [
    'rawApiKey',
    '"password"\\s*:',
    'REC008_N8N_OWNER_PASSWORD',
    'Bearer\\s+[A-Za-z0-9._-]{20,}',
    '-----BEGIN',
    'postgres:\\/\\/[^:]+:[^@]+@',
  ].join('|'),
  'i'
);
const piiRe = new RegExp(
  '\\b[A-Z0-9._%+-]+@(?!example\\.test|example\\.com)[A-Z0-9.-]+\\.[A-Z]{2,}\\b',
  'i'
);

const SKIP_NAMES = new Set(['hygiene-scan-038.cjs', 'SHA256.json', 'HYGIENE.json']);

const targets = [];
function addFile(p, label) {
  if (fs.existsSync(p) && fs.statSync(p).isFile()) targets.push({ p, label });
}
function walk(d, prefix) {
  if (!fs.existsSync(d)) return;
  for (const name of fs.readdirSync(d)) {
    if (SKIP_NAMES.has(name)) continue;
    const p = path.join(d, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '_nodes') continue;
      walk(p, prefix + name + '/');
    } else if (/\.(md|json|cjs|js)$/i.test(name)) {
      targets.push({ p, label: prefix + name });
    }
  }
}

walk(dir, 'diag-038/');
addFile(
  path.join(docsRecovery, 'GOVSUITE_MULTIAGENT_R04B_HTTP500_DIAG_038_REPORT.md'),
  'docs/GOVSUITE_MULTIAGENT_R04B_HTTP500_DIAG_038_REPORT.md'
);
addFile(
  path.join(docsRecovery, 'REC008_R04B_HTTP500_ROOT_CAUSE_ANALYSIS.md'),
  'docs/REC008_R04B_HTTP500_ROOT_CAUSE_ANALYSIS.md'
);
addFile(
  path.join(testsReports, 'R038-offline-diag-run.json'),
  'tests/R038-offline-diag-run.json'
);
addFile(
  path.resolve(dir, '../../../../../../tests/rec008/unit/r04b-http500-diag-038.test.cjs'),
  'tests/r04b-http500-diag-038.test.cjs'
);

const hits = [];
const sha = {};
for (const { p, label } of targets) {
  const buf = fs.readFileSync(p);
  sha[label] = crypto.createHash('sha256').update(buf).digest('hex');
  const t = buf.toString('utf8');
  if (secretRe.test(t)) hits.push({ label, kind: 'secret_pattern' });
  if (piiRe.test(t)) hits.push({ label, kind: 'pii_email_pattern' });
}

const hygiene = {
  mission: 'R04B-HTTP500-DIAG-038',
  filesScanned: targets.map((x) => x.label),
  secretOrCredentialOrPiiHits: hits,
  verdict: hits.length === 0 ? 'PASS' : 'FAIL',
};
fs.writeFileSync(path.join(dir, 'HYGIENE.json'), JSON.stringify(hygiene, null, 2));
fs.writeFileSync(path.join(dir, 'SHA256.json'), JSON.stringify(sha, null, 2));
console.log(JSON.stringify({ hygieneVerdict: hygiene.verdict, fileCount: targets.length, hits }, null, 2));
process.exit(hits.length === 0 ? 0 : 2);
