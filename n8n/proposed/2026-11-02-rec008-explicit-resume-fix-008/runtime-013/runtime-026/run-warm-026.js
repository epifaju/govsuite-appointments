'use strict';
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('path');
const { evaluateOllamaGate } = require('../runner-021/lib/ollama-gate.cjs');

const ART = __dirname;
const N8N_CTR = 'govsuite-rec008-test-rec008-n8n-1';
const OLLAMA = 'http://rec008-ollama:11434';

function docker(args, opts) {
  return execFileSync('docker', args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    input: opts && opts.input,
    timeout: opts && opts.timeout,
  });
}

const out = { mission: 'R03-RUNTIME-026-warm', ts: new Date().toISOString(), ollamaCalls: 0, retried: false };

const psBefore = JSON.parse(
  docker(['exec', N8N_CTR, 'wget', '-qO-', '--timeout=15', OLLAMA + '/api/ps']),
);
out.psBefore = psBefore;
let gate = evaluateOllamaGate({ expectedModel: 'qwen2.5:1.5b', psBody: psBefore, nowMs: Date.now() });
out.gateBefore = gate;

if (!gate.ready) {
  out.ollamaCalls = 1;
  const payload = JSON.stringify({
    model: 'qwen2.5:1.5b',
    stream: false,
    keep_alive: '10m',
    options: { num_predict: 8, temperature: 0 },
    messages: [{ role: 'user', content: 'Réponds uniquement par le mot OK.' }],
  });
  docker(['exec', '-i', N8N_CTR, 'sh', '-c', 'cat > /tmp/r026-warm.json'], { input: payload, timeout: 15000 });
  const t0 = Date.now();
  try {
    const raw = docker(
      [
        'exec', N8N_CTR, 'wget', '-qO-', '--timeout=300',
        '--header=Content-Type: application/json',
        '--post-file=/tmp/r026-warm.json',
        OLLAMA + '/api/chat',
      ],
      { timeout: 320000 },
    );
    out.warm = { wallMs: Date.now() - t0, done: /"done"\s*:\s*true/.test(raw), responseLen: raw.length };
  } finally {
    try { docker(['exec', '-u', 'root', N8N_CTR, 'rm', '-f', '/tmp/r026-warm.json']); } catch (_) {}
  }
  if (!out.warm || !out.warm.done) {
    out.ok = false;
    out.issues = ['warm failed'];
    fs.writeFileSync(path.join(ART, 'WARM.json'), JSON.stringify(out, null, 2) + '\n');
    process.exit(1);
  }
} else {
  out.warm = { skipped: true };
}

const psAfter = JSON.parse(
  docker(['exec', N8N_CTR, 'wget', '-qO-', '--timeout=15', OLLAMA + '/api/ps']),
);
out.psAfter = psAfter;
out.gateAfter = evaluateOllamaGate({ expectedModel: 'qwen2.5:1.5b', psBody: psAfter, nowMs: Date.now() });
try {
  out.mem = docker([
    'stats', 'govsuite-rec008-test-rec008-ollama-1', '--no-stream', '--format', '{{.MemUsage}}',
  ]).trim();
} catch (_) {}
out.ok = out.gateAfter.ready === true;
fs.writeFileSync(path.join(ART, 'WARM.json'), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify({ ok: out.ok, gate: out.gateAfter.reason, warmMs: out.warm && out.warm.wallMs, mem: out.mem }, null, 2));
process.exit(out.ok ? 0 : 1);
