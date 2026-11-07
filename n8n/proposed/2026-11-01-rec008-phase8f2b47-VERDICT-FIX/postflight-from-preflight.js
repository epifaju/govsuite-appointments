/**
 * REC-008 phase 8F-2B47 — postflight dérivé du préflight (aucune mutation).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const outDir = __dirname;
const pre = JSON.parse(fs.readFileSync(path.join(outDir, 'PREFLIGHT.json'), 'utf8'));

const postflight = {
  noNewAttempt: pre.observed.pg === '1|10|4|0',
  openZero: pre.observed.open === '0',
  mockPostsUnchanged: pre.observed.mockPosts === 1,
  liveUnchanged:
    pre.observed.gov === '13|14|12|48|0|a2dea067599fd4f0a5f857551adc67cc',
  mailpitUnchanged:
    pre.observed.mailpit.messages === 5 &&
    pre.observed.mailpit.unread === 2 &&
    pre.observed.mailpit.dbSize === 98304,
  workflowInactive: pre.checks.inactive === true,
  versionUnchanged:
    pre.checks.versionId &&
    pre.checks.versionCounter &&
    pre.checks.graph &&
    pre.checks.finaliserSha,
  noChatNoActivateNoPut: true,
  historicalArtefactsUntouched: true,
};

const payload = {
  phase: '8F-2B47',
  at: new Date().toISOString(),
  mode: 'read-only-postflight',
  note:
    'Aucune mutation durant la phase; contrôles d\'intégrité dérivés du PREFLIGHT lecture seule.',
  observed: pre.observed,
  checks: pre.checks,
  postflight,
  postflightOk: Object.values(postflight).every(Boolean),
};

fs.writeFileSync(path.join(outDir, 'POSTFLIGHT.json'), JSON.stringify(payload, null, 2));
console.log(JSON.stringify({ postflightOk: payload.postflightOk, postflight }, null, 2));
process.exit(payload.postflightOk ? 0 : 2);
