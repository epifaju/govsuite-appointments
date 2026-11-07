'use strict';
/** RO probe n8n sqlite — no PII, no mutate. */
const { execFileSync } = require('child_process');
const out = execFileSync(
  'docker',
  [
    'exec',
    'govsuite-rec008-test-rec008-n8n-1',
    'node',
    '-e',
    "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('/home/node/.n8n/database.sqlite',{readOnly:true});const c=db.prepare('select count(*) as c from execution_entity').get().c;const rows=db.prepare('select id, finished, status, mode from execution_entity order by id desc limit 8').all();console.log(JSON.stringify({executionCount:c,recent:rows}));",
  ],
  { encoding: 'utf8' }
);
console.log(out.trim());
