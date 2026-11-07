'use strict';
const { execFileSync } = require('child_process');
const script = `
const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync('/home/node/.n8n/database.sqlite',{readOnly:true});
const row=db.prepare('select id, finished, status, mode, workflowId, startedAt, stoppedAt from execution_entity where id=57').get();
const meta=db.prepare('select count(*) as c from execution_data').get();
let dataLen=null;
try {
  const d=db.prepare('select length(data) as len from execution_data where executionId=57').get();
  dataLen=d&&d.len;
} catch(e) { dataLen='err'; }
console.log(JSON.stringify({row, executionDataRows:meta.c, dataLen57:dataLen, note:'no data payload dumped'}));
`;
const out = execFileSync(
  'docker',
  ['exec', 'govsuite-rec008-test-rec008-n8n-1', 'node', '-e', script],
  { encoding: 'utf8' }
);
console.log(out.trim());
