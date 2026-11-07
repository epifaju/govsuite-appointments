'use strict';
/**
 * RUNTIME-024 — backup R01 + warm Ollama (1 synth) + TTL refresh.
 * No activate, no chat trigger, no LIVE, no R02/R03 mutate.
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('path');
const { evaluateOllamaGate } = require('../runner-021/lib/ollama-gate.cjs');

const ART = path.resolve(__dirname);
const N8N_CTR = 'govsuite-rec008-test-rec008-n8n-1';
const PG_CTR = 'govsuite-rec008-test-rec008-postgres-1';
const OLLAMA = 'http://rec008-ollama:11434';
const SYNTH = 'Réponds uniquement par le mot OK.';

const out = {
  mission: 'R01-RUNTIME-024-warm-ttl',
  ts: new Date().toISOString(),
  liveProbed: false,
  chatTriggerUsed: false,
  ollamaCalls: 0,
  issues: [],
};

function docker(args, opts) {
  return execFileSync('docker', args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    input: opts && opts.input,
    timeout: opts && opts.timeout,
  });
}

function pg(sql) {
  return docker([
    'exec', '-i', PG_CTR, 'psql', '-U', 'postgres', '-d', 'govsuite_rec008_test',
    '-t', '-A', '-F', '|', '-c', sql,
  ]).trim();
}

function backupR01() {
  const sql = fs.readFileSync(path.join(ART, '..', 'preflight-023', 'BACKUP-R01-SELECT.sql'), 'utf8');
  // run via file copy to avoid escaping
  const tmp = path.join(ART, '_backup-r01.sql');
  fs.writeFileSync(tmp, sql);
  docker(['cp', tmp, PG_CTR + ':/tmp/r024-backup.sql']);
  const raw = docker(['exec', PG_CTR, 'psql', '-U', 'postgres', '-d', 'govsuite_rec008_test', '-t', '-A', '-F', '|', '-f', '/tmp/r024-backup.sql']);
  docker(['exec', PG_CTR, 'rm', '-f', '/tmp/r024-backup.sql']);
  try { fs.unlinkSync(tmp); } catch (_) {}
  const line = (raw || '').trim().split(/\r?\n/).filter(Boolean).pop();
  if (!line) throw new Error('backup empty');
  const p = line.split('|');
  return {
    session_id: p[0],
    conversation_step: p[1],
    pending_action: p[2],
    slot_id_present: p[3] === 't' || p[3] === 'true',
    slot_id_synth: p[4],
    prenom_null: p[5] === 't' || p[5] === 'true',
    prenom_len: Number(p[6]),
    nom_present: p[7] === 't' || p[7] === 'true',
    nom_len: Number(p[8]),
    last_user_message_len: Number(p[9]),
    has_camille: p[10] === 't' || p[10] === 'true',
    expires_at: p[11],
    ttl_future: p[12] === 't' || p[12] === 'true',
    date_debut: p[13],
    date_fin: p[14],
    slots_len: Number(p[15]),
    updated_at: p[16],
  };
}

function snapR02R03() {
  return {
    r02: pg("SELECT session_id, expires_at::text, CASE WHEN expires_at>NOW() THEN 't' ELSE 'f' END, conversation_step, CASE WHEN prenom IS NULL THEN 't' ELSE 'f' END FROM ai_conversation_state WHERE session_id='rec008-runtime013-r02-expired';"),
    r03: pg("SELECT session_id, expires_at::text, CASE WHEN expires_at>NOW() THEN 't' ELSE 'f' END, conversation_step, CASE WHEN prenom IS NULL THEN 't' ELSE 'f' END FROM ai_conversation_state WHERE session_id='rec008-runtime013-r03-resume';"),
  };
}

function wget(pathUrl, timeoutSec) {
  return docker([
    'exec', N8N_CTR, 'wget', '-qO-', '--timeout=' + String(timeoutSec || 15), pathUrl,
  ]).trim();
}

function warmOnce() {
  out.ollamaCalls += 1;
  const payload = JSON.stringify({
    model: 'qwen2.5:1.5b',
    stream: false,
    keep_alive: '10m',
    options: { num_predict: 8, temperature: 0 },
    messages: [{ role: 'user', content: SYNTH }],
  });
  docker(['exec', '-i', N8N_CTR, 'sh', '-c', 'cat > /tmp/r024-warm.json'], { input: payload, timeout: 15000 });
  const t0 = Date.now();
  let raw = '';
  try {
    raw = docker(
      [
        'exec', N8N_CTR, 'wget', '-qO-', '--timeout=300',
        '--header=Content-Type: application/json',
        '--post-file=/tmp/r024-warm.json',
        OLLAMA + '/api/chat',
      ],
      { timeout: 320000 },
    );
  } finally {
    try {
      docker(['exec', '-u', 'root', N8N_CTR, 'rm', '-f', '/tmp/r024-warm.json']);
    } catch (_) {}
  }
  const wallMs = Date.now() - t0;
  let body = null;
  try { body = JSON.parse(raw); } catch (_) {}
  return {
    wallMs,
    done: !!(body && body.done),
    responsePreview: body && body.message && String(body.message.content || '').slice(0, 20),
    load_duration_ms: body && body.load_duration != null ? Math.round(body.load_duration / 1e6) : null,
    total_duration_ms: body && body.total_duration != null ? Math.round(body.total_duration / 1e6) : null,
    retried: false,
  };
}

function main() {
  out.openAttempts = Number(
    pg("SELECT count(*) FROM ai_appointment_attempt WHERE status IN ('AWAITING_CONFIRMATION','SUBMITTING','UNCERTAIN');") || '0',
  );
  if (out.openAttempts !== 0) {
    out.issues.push('open attempts');
    fs.writeFileSync(path.join(ART, 'WARM-TTL.json'), JSON.stringify(out, null, 2) + '\n');
    process.exit(1);
  }

  out.backupBefore = backupR01();
  out.r02r03Before = snapR02R03();
  fs.writeFileSync(path.join(ART, 'BACKUP-R01-BEFORE.json'), JSON.stringify(out.backupBefore, null, 2) + '\n');

  // tags
  const tags = JSON.parse(wget(OLLAMA + '/api/tags', 15));
  out.modelListed = (tags.models || []).some((m) => m.name === 'qwen2.5:1.5b');
  if (!out.modelListed) {
    out.issues.push('model missing');
    fs.writeFileSync(path.join(ART, 'WARM-TTL.json'), JSON.stringify(out, null, 2) + '\n');
    process.exit(1);
  }

  let psBefore = JSON.parse(wget(OLLAMA + '/api/ps', 15));
  out.psBefore = psBefore;
  let gate = evaluateOllamaGate({ expectedModel: 'qwen2.5:1.5b', psBody: psBefore, nowMs: Date.now() });
  out.gateBefore = gate;

  if (!gate.ready) {
    console.error('warm-up: one synth /api/chat (no retry)');
    out.warm = warmOnce();
    if (!out.warm.done) {
      out.issues.push('warm failed');
      fs.writeFileSync(path.join(ART, 'WARM-TTL.json'), JSON.stringify(out, null, 2) + '\n');
      process.exit(1);
    }
  } else {
    out.warm = { skipped: true, reason: 'already_in_api_ps' };
  }

  const psAfter = JSON.parse(wget(OLLAMA + '/api/ps', 15));
  out.psAfter = psAfter;
  out.gateAfter = evaluateOllamaGate({
    expectedModel: 'qwen2.5:1.5b',
    psBody: psAfter,
    nowMs: Date.now(),
  });
  try {
    out.mem = docker([
      'stats', 'govsuite-rec008-test-rec008-ollama-1', '--no-stream', '--format', '{{.MemUsage}}',
    ]).trim();
  } catch (_) {}

  if (!out.gateAfter.ready) {
    out.issues.push('gate not ready after warm: ' + out.gateAfter.reason);
    fs.writeFileSync(path.join(ART, 'WARM-TTL.json'), JSON.stringify(out, null, 2) + '\n');
    process.exit(1);
  }

  // TTL refresh
  console.error('TTL refresh R01');
  docker(['cp', path.join(ART, 'TTL-REFRESH-R01.sql'), PG_CTR + ':/tmp/r024-ttl.sql']);
  let ttlOut = '';
  try {
    ttlOut = docker([
      'exec', PG_CTR, 'psql', '-U', 'postgres', '-d', 'govsuite_rec008_test',
      '-v', 'ON_ERROR_STOP=1', '-f', '/tmp/r024-ttl.sql',
    ]);
  } catch (e) {
    out.issues.push('TTL failed: ' + String(e.message || e).slice(0, 300));
    out.ttlOut = String(e.stdout || e.message || e).slice(0, 500);
    fs.writeFileSync(path.join(ART, 'WARM-TTL.json'), JSON.stringify(out, null, 2) + '\n');
    process.exit(1);
  } finally {
    try { docker(['exec', PG_CTR, 'rm', '-f', '/tmp/r024-ttl.sql']); } catch (_) {}
  }
  out.ttlOut = (ttlOut || '').slice(0, 800);
  out.ttlOk = /TTL_R01_OK/.test(ttlOut);
  out.backupAfter = backupR01();
  out.r02r03After = snapR02R03();
  if (!out.backupAfter.ttl_future) out.issues.push('R01 ttl still not future');
  if (out.r02r03Before.r02 !== out.r02r03After.r02) out.issues.push('R02 changed');
  if (out.r02r03Before.r03 !== out.r02r03After.r03) out.issues.push('R03 changed');
  if (!out.ttlOk) out.issues.push('TTL_R01_OK marker missing');

  out.ok = out.issues.length === 0;
  fs.writeFileSync(path.join(ART, 'WARM-TTL.json'), JSON.stringify(out, null, 2) + '\n');
  fs.writeFileSync(path.join(ART, 'BACKUP-R01-AFTER-TTL.json'), JSON.stringify(out.backupAfter, null, 2) + '\n');
  console.log(JSON.stringify({ ok: out.ok, issues: out.issues, gate: out.gateAfter.reason, ttl_future: out.backupAfter.ttl_future, warmMs: out.warm && out.warm.wallMs }, null, 2));
  process.exit(out.ok ? 0 : 1);
}

main();
