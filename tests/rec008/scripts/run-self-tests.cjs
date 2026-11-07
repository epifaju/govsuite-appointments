'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const { REC008_ROOT } = require('../lib/load-json.cjs');
const { installOfflineGuards } = require('../lib/security-guard.cjs');

installOfflineGuards();

const tests = [
  path.join(REC008_ROOT, 'unit', 'load-json.test.cjs'),
  path.join(REC008_ROOT, 'unit', 'mutation-engine.test.cjs'),
  path.join(REC008_ROOT, 'unit', 'readiness-005-p4g2.test.cjs')
];

let failed = 0;
for (const file of tests) {
  const res = spawnSync(process.execPath, [file], {
    cwd: path.resolve(REC008_ROOT, '..', '..'),
    encoding: 'utf8'
  });
  process.stdout.write(res.stdout || '');
  process.stderr.write(res.stderr || '');
  if (res.status !== 0) failed += 1;
}

process.exitCode = failed ? 1 : 0;
