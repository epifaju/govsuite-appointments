const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const net = require('net');
const outDir = 'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-31-rec008-phase8f2b44-WEBHOOK-TRANSPORT-DIAGNOSTIC';
function docker(args){return execFileSync('docker', args, {encoding:'utf8', maxBuffer:10*1024*1024});}
function pg(sql){return docker(['exec','-i','govsuite-rec008-test-rec008-postgres-1','psql','-U','postgres','-d','govsuite_rec008_test','-t','-A','-F','|','-c',sql]).trim();}
function gov(){return docker(['exec','-i','govsuite-postgres','psql','-U','govsuite','-d','govsuite','-t','-A','-c',"SELECT (SELECT count(*) FROM rendez_vous)||'|'||(SELECT count(*) FROM notifications)||'|'||(SELECT count(*) FROM historique_rendez_vous)||'|'||(SELECT count(*) FROM ai_conversation_state)||'|'||(SELECT count(*) FROM ai_appointment_attempt)||'|'||(SELECT md5(string_agg(id::text || '|' || reference || '|' || statut || '|' || creneau_id::text || '|' || updated_at::text, ',' ORDER BY id)) FROM rendez_vous);"]).trim();}
function mockMeta(){
  const probe="const http=require('http');http.get('http://rec008-mock:8080/_meta/calls',res=>{let b='';res.on('data',c=>b+=c);res.on('end',()=>console.log(b));});";
  const tmp=path.join(outDir,'_mock_post.js'); fs.writeFileSync(tmp,probe);
  docker(['cp',tmp,'govsuite-rec008-test-rec008-n8n-1:/tmp/_m44p.js']);
  const t=docker(['exec','govsuite-rec008-test-rec008-n8n-1','node','/tmp/_m44p.js']).trim();
  docker(['exec','-u','root','govsuite-rec008-test-rec008-n8n-1','rm','-f','/tmp/_m44p.js']);
  try{fs.unlinkSync(tmp);}catch{}
  return JSON.parse(t);
}
function pack(e){const c=e&&e.cause; return {name:e.name,message:e.message,elapsedHint:'n/a',cause:c?{code:c.code,errno:c.errno,syscall:c.syscall,address:c.address,port:c.port,message:c.message}:null};}
(async()=>{
  const t0=Date.now();
  let refused;
  try { await fetch('http://127.0.0.1:59999/',{signal:AbortSignal.timeout(2000)}); } catch(e){ refused={...pack(e), elapsedMs:Date.now()-t0}; }
  const publishListen = docker(['exec','govsuite-rec008-test-rec008-publish-1','sh','-lc','ps aux; (netstat -lntp 2>/dev/null || ss -lntp 2>/dev/null || true)']).trim();
  const hostNetstat = execFileSync('cmd',['/c','netstat -ano | findstr :5682'],{encoding:'utf8'});
  const mail=JSON.parse(docker(['exec','govsuite-mailpit','wget','-qO-','http://127.0.0.1:8025/api/v1/info']));
  const mock=mockMeta();
  const posts=Object.entries(mock.byPath||{}).filter(([k])=>/^POST \/appointments /.test(k)&&!/cancel|reschedule/i.test(k)).reduce((n,[,v])=>n+Number(v||0),0);
  const postflight={
    at:new Date().toISOString(),
    pg:pg('SELECT (SELECT count(*) FROM rendez_vous),(SELECT count(*) FROM ai_conversation_state),(SELECT count(*) FROM ai_appointment_attempt),(SELECT count(*) FROM notifications);'),
    open:pg("SELECT count(*) FROM ai_appointment_attempt WHERE status IN ('AWAITING_CONFIRMATION','SUBMITTING','UNCERTAIN');"),
    statusCounts:pg("SELECT status || '|' || count(*)::text FROM ai_appointment_attempt GROUP BY status ORDER BY status;").split(/\r?\n/).filter(Boolean),
    attempt: (()=>{const line=pg("SELECT status, EXTRACT(EPOCH FROM (expires_at - clock_timestamp()))::int, (expires_at > clock_timestamp()), clock_timestamp()::text, (lease_owner IS NOT NULL AND lease_owner<>''), coalesce(appointment_reference,''), (idempotency_key IS NOT NULL), (request_payload IS NOT NULL), coalesce(submitted_at::text,''), coalesce(confirmed_at::text,''), updated_at::text FROM ai_appointment_attempt WHERE id='d566fc28-02de-4ae1-afbb-6f7d81362d4d'::uuid;"); const p=line.split('|'); return {status:p[0],secsLeft:Number(p[1]||0),stillValid:p[2]==='t'||p[2]==='true',clockNow:p[3],hasLease:p[4]==='t'||p[4]==='true',reference:p[5]||'',hasKey:p[6]==='t'||p[6]==='true',hasPayload:p[7]==='t'||p[7]==='true',submittedAt:p[8]||'',confirmedAt:p[9]||'',updatedAt:p[10]};})(),
    mock:{scenario:mock.scenario,total:mock.total,posts,getAvailability:Number((mock.byPath||{})['GET /appointments/availability 200']||0),distinctKeys:mock.distinctKeys},
    gov:gov(),
    mailpit:{messages:mail.Messages,unread:mail.Unread,dbSize:mail.DatabaseSize},
    fetchFailedCauseBaselineRefused:refused,
    publishListen,
    hostNetstat:hostNetstat.trim(),
    containers:{
      n8n:docker(['inspect','govsuite-rec008-test-rec008-n8n-1','--format','Status={{.State.Status}} Started={{.State.StartedAt}} Restarts={{.RestartCount}}']).trim(),
      publish:docker(['inspect','govsuite-rec008-test-rec008-publish-1','--format','Status={{.State.Status}} Started={{.State.StartedAt}} Restarts={{.RestartCount}}']).trim(),
      postgres:docker(['inspect','govsuite-rec008-test-rec008-postgres-1','--format','Status={{.State.Status}} Health={{if .State.Health}}{{.State.Health.Status}}{{end}}']).trim(),
      mock:docker(['inspect','govsuite-rec008-test-rec008-mock-1','--format','Status={{.State.Status}}']).trim()
    }
  };
  // integrity expectations vs 8F-2B43 postflight baseline
  postflight.integrity={
    noNewAttempt: postflight.pg==='1|10|4|0',
    stillAwaiting: postflight.attempt.status==='AWAITING_CONFIRMATION' && !postflight.attempt.submittedAt && !postflight.attempt.confirmedAt && !postflight.attempt.hasLease && !postflight.attempt.reference,
    mockUnchanged: postflight.mock.posts===0 && postflight.mock.getAvailability===2 && postflight.mock.scenario==='created',
    govUnchanged: postflight.gov==='13|14|12|48|0|a2dea067599fd4f0a5f857551adc67cc',
    mailUnchanged: postflight.mailpit.messages===5 && postflight.mailpit.unread===2 && postflight.mailpit.dbSize===98304,
    openStillOne: postflight.open==='1'
  };
  postflight.integrityOk=Object.values(postflight.integrity).every(Boolean);
  fs.writeFileSync(path.join(outDir,'POSTFLIGHT.json'), JSON.stringify(postflight,null,2));
  console.log(JSON.stringify({integrityOk:postflight.integrityOk,integrity:postflight.integrity,attempt:postflight.attempt,refusedBaseline:refused,containers:postflight.containers,hostNetstat:postflight.hostNetstat},null,2));
})().catch(e=>{console.error(e); process.exit(1);});
