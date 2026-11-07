'use strict';

/**
 * OLLAMA-READINESS-020 — TEST only.
 * Synthetic Ollama probes + readonly n8n/PG preflight.
 * No activate, chat trigger, PUT, PG mutate, Docker mutate, LIVE.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const OUT = __dirname;
const ENV_FILE =
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-30-rec008-phase8e2b2-TEST-DEPLOY/.env.rec008-test.local';
const BASE = 'http://127.0.0.1:5682';
const WF_ID = 'OCD9It1uKFhOoWNF';
const PG_CTR = 'govsuite-rec008-test-rec008-postgres-1';
const OLLAMA_CTR = 'govsuite-rec008-test-rec008-ollama-1';
const N8N_CTR = 'govsuite-rec008-test-rec008-n8n-1';
const OLLAMA_HTTP = 'http://rec008-ollama:11434'; // from n8n TEST network
const DOCKER_PROJ = 'govsuite-rec008-test';
const MODEL = 'qwen2.5:1.5b';
const EXPECT_VERSION_ID = 'fd75ba32-f018-40e4-9f79-8f2a5400320b';
const EXPECT_COUNTER = 10;
const EXPECT_GERER_SHA =
  'f75d49849231f956bb9ae5383111ea84b362dc58de6711cc75d2e7e2a26917fe';
const SYNTH_PROMPT = 'Réponds uniquement par le mot OK.';
const MAX_OLLAMA_CALLS = 4; // unload + cold + warm + optional verify

function envValue(name) {
  const text = fs.readFileSync(ENV_FILE, 'utf8');
  const m = text.match(new RegExp('^' + name + '=(.*)$', 'm'));
  if (!m) throw new Error('missing env ' + name);
  return m[1];
}

function restHeaders(extra) {
  return Object.assign({ Connection: 'close' }, extra || {});
}

function docker(args, opts) {
  return execFileSync('docker', args, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    ...(opts || {}),
  });
}

function pg(sql) {
  return docker([
    'exec',
    '-i',
    PG_CTR,
    'psql',
    '-U',
    'postgres',
    '-d',
    'govsuite_rec008_test',
    '-t',
    '-A',
    '-c',
    sql,
  ]).trim();
}

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

async function fetchOnce(url, opts, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const merged = Object.assign({}, opts || {});
  merged.headers = restHeaders(merged.headers);
  merged.signal = controller.signal;
  const t0 = Date.now();
  try {
    const res = await fetch(url, merged);
    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      text,
      elapsedMs: Date.now() - t0,
      error: null,
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      text: '',
      elapsedMs: Date.now() - t0,
      error: String(e && e.message ? e.message : e),
    };
  } finally {
    clearTimeout(timer);
  }
}

function ollamaExec(args) {
  return docker(['exec', OLLAMA_CTR, ...args]).trim();
}

function parseOllamaJson(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

function statsFromChat(body) {
  if (!body || typeof body !== 'object') return null;
  return {
    model: body.model || null,
    done: body.done === true,
    total_duration_ns: body.total_duration || null,
    load_duration_ns: body.load_duration || null,
    prompt_eval_count: body.prompt_eval_count || null,
    prompt_eval_duration_ns: body.prompt_eval_duration || null,
    eval_count: body.eval_count || null,
    eval_duration_ns: body.eval_duration || null,
    total_duration_ms: body.total_duration
      ? Math.round(body.total_duration / 1e6)
      : null,
    load_duration_ms: body.load_duration
      ? Math.round(body.load_duration / 1e6)
      : null,
    prompt_eval_duration_ms: body.prompt_eval_duration
      ? Math.round(body.prompt_eval_duration / 1e6)
      : null,
    eval_duration_ms: body.eval_duration
      ? Math.round(body.eval_duration / 1e6)
      : null,
    responseLen: body.message && body.message.content
      ? String(body.message.content).length
      : 0,
    responsePreview:
      body.message && body.message.content
        ? String(body.message.content).slice(0, 40)
        : null,
  };
}

function nsToMs(ns) {
  return ns == null ? null : Math.round(Number(ns) / 1e6);
}

(async () => {
  const report = {
    mission: 'OLLAMA-READINESS-020',
    ts: new Date().toISOString(),
    liveProbed: false,
    pgMutated: false,
    dockerMutated: false,
    n8nActivated: false,
    chatTriggerUsed: false,
    ollamaCalls: 0,
    maxOllamaCalls: MAX_OLLAMA_CALLS,
    issues: [],
  };

  // ---------- Prefight docker ----------
  const ps = docker([
    'ps',
    '-a',
    '--filter',
    'label=com.docker.compose.project=' + DOCKER_PROJ,
    '--format',
    '{{.Names}}\t{{.Status}}',
  ]);
  report.docker = (ps || '').trim().split(/\r?\n/).filter(Boolean);
  if (report.docker.filter((l) => (l.split('\t')[1] || '').startsWith('Up')).length !== 5) {
    report.issues.push('expected 5 Up TEST containers');
  }

  const health = await fetchOnce(BASE + '/healthz', { method: 'GET' }, 10000);
  report.healthz = { status: health.status, elapsedMs: health.elapsedMs };
  if (health.status !== 200) report.issues.push('TEST healthz failed');

  // Ollama resources (readonly inspect)
  let memLimit = null;
  let nanoCpus = null;
  try {
    memLimit = Number(
      docker([
        'inspect',
        '-f',
        '{{.HostConfig.Memory}}',
        OLLAMA_CTR,
      ]).trim(),
    );
    nanoCpus = Number(
      docker([
        'inspect',
        '-f',
        '{{.HostConfig.NanoCpus}}',
        OLLAMA_CTR,
      ]).trim(),
    );
  } catch (e) {
    report.issues.push('ollama inspect: ' + e.message);
  }
  let memStats = null;
  try {
    memStats = JSON.parse(
      docker([
        'stats',
        OLLAMA_CTR,
        '--no-stream',
        '--format',
        '{"memUsage":"{{.MemUsage}}","cpu":"{{.CPUPerc}}","memPerc":"{{.MemPerc}}"}',
      ]).trim(),
    );
  } catch (_) {}
  report.ollamaResources = {
    memLimitBytes: memLimit,
    memLimitGiB: memLimit ? +(memLimit / 1024 ** 3).toFixed(2) : null,
    nanoCpus,
    cpuLimitApprox: nanoCpus ? +(nanoCpus / 1e9).toFixed(2) : null,
    statsSample: memStats,
  };

  // Ollama version + tags + ps
  let version = null;
  try {
    version = ollamaExec(['ollama', '--version']);
  } catch (e) {
    try {
      version = ollamaExec(['ollama', 'version']);
    } catch (e2) {
      report.issues.push('ollama version: ' + e2.message);
    }
  }
  report.ollamaVersion = version;

  function ollamaHttpGet(apiPath) {
    return docker([
      'exec',
      N8N_CTR,
      'wget',
      '-qO-',
      '--timeout=15',
      OLLAMA_HTTP + apiPath,
    ]).trim();
  }

  let tagsRaw = '';
  try {
    tagsRaw = ollamaHttpGet('/api/tags');
  } catch (e) {
    // Fallback CLI
    try {
      const list = ollamaExec(['ollama', 'list']);
      report.modelsCli = list;
      if (String(list).includes('qwen2.5:1.5b')) {
        tagsRaw = JSON.stringify({
          models: [{ name: MODEL, size: 986061892 }],
        });
      }
    } catch (e2) {
      report.issues.push('ollama tags: ' + e.message);
    }
  }
  const tags = parseOllamaJson(tagsRaw);
  const models = (tags && tags.models) || [];
  report.models = models.map((m) => ({
    name: m.name,
    size: m.size,
    digest: m.digest ? String(m.digest).slice(0, 16) : null,
  }));
  const hasModel = models.some(
    (m) => m.name === MODEL || String(m.name).startsWith('qwen2.5:1.5b'),
  );
  if (!hasModel) report.issues.push('model ' + MODEL + ' missing');

  let psRaw = '';
  try {
    psRaw = ollamaHttpGet('/api/ps');
  } catch (_) {
    try {
      psRaw = docker(['exec', OLLAMA_CTR, 'ollama', 'ps']);
      report.loadedBeforeCli = psRaw;
    } catch (_) {}
  }
  const psJson = parseOllamaJson(psRaw) || { models: [] };
  report.loadedBefore = (psJson.models || []).map((m) => ({
    name: m.name,
    size: m.size,
    size_vram: m.size_vram,
    expires_at: m.expires_at || null,
  }));

  // ---------- n8n workflow preflight ----------
  const loginRes = await fetch(BASE + '/rest/login', {
    method: 'POST',
    headers: restHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      emailOrLdapLoginId: envValue('REC008_N8N_OWNER_EMAIL'),
      password: envValue('REC008_N8N_OWNER_PASSWORD'),
    }),
  });
  const cookie = (loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [])
    .map((i) => i.split(';')[0])
    .join('; ');
  report.login = { status: loginRes.status, cookiePresent: Boolean(cookie) };
  if (loginRes.status !== 200 || !cookie) {
    report.issues.push('login failed');
    report.preflightOk = false;
    fs.writeFileSync(path.join(OUT, 'PREFLIGHT.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    process.exit(2);
  }
  const hdr = { cookie, accept: 'application/json', Connection: 'close' };

  const wf = await fetchOnce(
    BASE + '/rest/workflows/' + WF_ID,
    { method: 'GET', headers: hdr },
    20000,
  );
  let data = null;
  try {
    const parsed = JSON.parse(wf.text || '{}');
    data = parsed.data || parsed;
  } catch (_) {}
  let gererSha = null;
  if (data && Array.isArray(data.nodes)) {
    const n = data.nodes.find((x) => x.name === 'Gérer collecte progressive');
    if (n && n.parameters && n.parameters.jsCode) gererSha = sha256(n.parameters.jsCode);
  }
  report.workflow = {
    http: wf.status,
    active: data && data.active === true,
    activeVersionId: (data && data.activeVersionId) || null,
    versionId: data && data.versionId,
    versionCounter: data && data.versionCounter,
    gererSha,
  };
  if (report.workflow.active || report.workflow.activeVersionId) {
    report.issues.push('workflow must be inactive');
  }
  if (report.workflow.versionId !== EXPECT_VERSION_ID) report.issues.push('versionId');
  if (Number(report.workflow.versionCounter) !== EXPECT_COUNTER) {
    report.issues.push('versionCounter');
  }
  if (gererSha !== EXPECT_GERER_SHA) report.issues.push('Gérer SHA');

  const act = await fetchOnce(BASE + '/rest/active-workflows', { method: 'GET', headers: hdr }, 15000);
  let ids = [];
  try {
    const j = JSON.parse(act.text || '[]');
    ids = Array.isArray(j) ? j : j.data || j;
    if (!Array.isArray(ids)) ids = [];
  } catch (_) {}
  report.activeWorkflowIds = ids;
  if (ids.length) report.issues.push('active workflows');

  // webhooks via probe
  try {
    const probe = path.join(__dirname, '..', 'webhooks-probe.js');
    docker(['cp', probe, N8N_CTR + ':/tmp/rec008-r020-webhooks.js']);
    const whText = docker(['exec', N8N_CTR, 'node', '/tmp/rec008-r020-webhooks.js']);
    docker(['exec', '-u', 'root', N8N_CTR, 'rm', '-f', '/tmp/rec008-r020-webhooks.js']);
    const whJson = JSON.parse(whText || '{}');
    report.webhookRows = Array.isArray(whJson.rows) ? whJson.rows.length : 0;
  } catch (e) {
    report.issues.push('webhook probe: ' + e.message);
  }
  if (report.webhookRows) report.issues.push('webhooks present');

  const execList = await fetchOnce(
    BASE + '/rest/executions?limit=20&status=running',
    { method: 'GET', headers: hdr },
    15000,
  );
  let runningCount = 0;
  try {
    const j = JSON.parse(execList.text || '{}');
    const results = j.data && j.data.results ? j.data.results : j.data || j;
    if (Array.isArray(results)) runningCount = results.length;
  } catch (_) {}
  report.runningExecutions = runningCount;
  if (runningCount > 0) report.issues.push('running executions');

  // n8n settings / execution retention (readonly)
  const settings = await fetchOnce(
    BASE + '/rest/settings',
    { method: 'GET', headers: hdr },
    15000,
  );
  let settingsJson = null;
  try {
    settingsJson = JSON.parse(settings.text || '{}');
  } catch (_) {}
  const sdata = (settingsJson && (settingsJson.data || settingsJson)) || {};
  report.n8nObservability = {
    settingsHttp: settings.status,
    saveDataErrorExecution: sdata.saveDataErrorExecution || null,
    saveDataSuccessExecution: sdata.saveDataSuccessExecution || null,
    saveExecutionProgress: sdata.saveExecutionProgress,
    saveManualExecutions: sdata.saveManualExecutions,
    executionTimeout: sdata.executionTimeout,
    maxExecutionTimeout: sdata.maxExecutionTimeout,
    note: 'readonly audit — not modified in 020',
  };

  let execEntityCount = null;
  try {
    const cnt = docker([
      'exec',
      N8N_CTR,
      'node',
      '-e',
      "const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync('/home/node/.n8n/database.sqlite',{readOnly:true}); const r=db.prepare('SELECT count(*) AS c FROM execution_entity').get(); console.log(String(r.c));",
    ]).trim();
    execEntityCount = Number(cnt);
  } catch (_) {
    execEntityCount = null;
  }
  report.n8nObservability.executionEntityCount = execEntityCount;

  // PG fixtures
  report.fingerprint = pg(
    "SELECT format('%s|%s|%s|%s', (SELECT count(*) FROM rendez_vous), (SELECT count(*) FROM ai_conversation_state), (SELECT count(*) FROM ai_appointment_attempt), (SELECT count(*) FROM notifications));",
  );
  const fixtures = pg(`
SELECT json_agg(row_to_json(t) ORDER BY session_id) FROM (
  SELECT session_id, conversation_step, pending_action,
    (slot_id IS NOT NULL) AS has_slot,
    (prenom IS NULL) AS prenom_null,
    (expires_at > NOW()) AS ttl_future,
    length(coalesce(last_user_message,'')) AS msg_len
  FROM ai_conversation_state
  WHERE session_id IN (
    'rec008-runtime013-r01-active',
    'rec008-runtime013-r02-expired',
    'rec008-runtime013-r03-resume'
  )
) t;
`);
  report.fixtures = fixtures ? JSON.parse(fixtures) : [];
  if (!report.fixtures || report.fixtures.length !== 3) {
    report.issues.push('fixtures R01-R03 missing');
  } else {
    for (const f of report.fixtures) {
      if (f.conversation_step !== 'ASK_PRENOM' || !f.has_slot || !f.prenom_null) {
        report.issues.push('fixture shape ' + f.session_id);
      }
    }
  }
  const openAttempts = Number(
    pg(`
SELECT count(*) FROM ai_appointment_attempt
WHERE session_id IN (
  'rec008-runtime013-r01-active',
  'rec008-runtime013-r02-expired',
  'rec008-runtime013-r03-resume'
)
AND status IN ('AWAITING_CONFIRMATION','SUBMITTING','UNCERTAIN','CLAIMED');
`),
  );
  report.openAttempts = openAttempts;
  if (openAttempts > 0) report.issues.push('open attempts');

  report.preflightOk = report.issues.length === 0;
  fs.writeFileSync(path.join(OUT, 'PREFLIGHT.json'), JSON.stringify(report, null, 2) + '\n');
  if (!report.preflightOk) {
    report.verdict = 'FAIL';
    report.gate = { r01: 'NO-GO' };
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  // ---------- Ollama measurements ----------
  const measures = {
    calls: [],
    unloadedForCold: false,
    cold: null,
    warm: null,
    loadedAfterWarm: null,
  };

  function chatPayload(keepAlive) {
    return JSON.stringify({
      model: MODEL,
      stream: false,
      keep_alive: keepAlive,
      options: { num_predict: 8, temperature: 0 },
      messages: [{ role: 'user', content: SYNTH_PROMPT }],
    });
  }

  function postChat(keepAlive, label, timeoutMs) {
    if (report.ollamaCalls >= MAX_OLLAMA_CALLS) {
      throw new Error('max ollama calls reached');
    }
    report.ollamaCalls += 1;
    const payload = chatPayload(keepAlive);
    const t0 = Date.now();
    let raw = '';
    try {
      // POST via n8n container (has wget + DNS to rec008-ollama)
      docker(['exec', '-i', N8N_CTR, 'sh', '-c', 'cat > /tmp/r020-chat.json'], {
        input: payload,
        timeout: 15000,
      });
      raw = docker(
        [
          'exec',
          N8N_CTR,
          'wget',
          '-qO-',
          '--timeout=' + String(Math.ceil(timeoutMs / 1000)),
          '--header=Content-Type: application/json',
          '--post-file=/tmp/r020-chat.json',
          OLLAMA_HTTP + '/api/chat',
        ],
        { timeout: timeoutMs + 10000 },
      );
    } catch (e2) {
      try {
        docker(['exec', '-u', 'root', N8N_CTR, 'rm', '-f', '/tmp/r020-chat.json']);
      } catch (_) {
        /* ignore cleanup */
      }
      const entry = {
        label,
        ok: false,
        wallMs: Date.now() - t0,
        error: String(e2.message || e2),
      };
      measures.calls.push(entry);
      return entry;
    }
    try {
      docker(['exec', '-u', 'root', N8N_CTR, 'rm', '-f', '/tmp/r020-chat.json']);
    } catch (_) {
      /* ignore cleanup */
    }
    const body = parseOllamaJson(raw);
    const stats = statsFromChat(body);
    const entry = {
      label,
      ok: !!(stats && stats.done),
      wallMs: Date.now() - t0,
      keepAlive,
      stats,
      httpBodyLen: (raw || '').length,
    };
    measures.calls.push(entry);
    return entry;
  }

  // Unload if loaded (counts as 1 call) for cold measurement
  const alreadyLoaded = (report.loadedBefore || []).some(
    (m) => m.name === MODEL || String(m.name).includes('qwen2.5'),
  );
  if (alreadyLoaded) {
    measures.unloadedForCold = true;
    postChat('0', 'unload_keep_alive_0', 120000);
    // verify unload
    let ps2 = '';
    try {
      ps2 = ollamaHttpGet('/api/ps');
    } catch (_) {}
    const ps2j = parseOllamaJson(ps2) || { models: [] };
    measures.loadedAfterUnload = (ps2j.models || []).map((m) => m.name);
  }

  // Cold generate (long timeout — historical cold ~3m)
  measures.cold = postChat('10m', 'cold_chat', 600000);
  let memDuring = null;
  try {
    memDuring = JSON.parse(
      docker([
        'stats',
        OLLAMA_CTR,
        '--no-stream',
        '--format',
        '{"memUsage":"{{.MemUsage}}","cpu":"{{.CPUPerc}}","memPerc":"{{.MemPerc}}"}',
      ]).trim(),
    );
  } catch (_) {}
  measures.statsAfterCold = memDuring;

  // Warm second call if budget remains
  if (report.ollamaCalls < MAX_OLLAMA_CALLS) {
    measures.warm = postChat('10m', 'warm_chat', 180000);
  }

  let ps3 = '';
  try {
    ps3 = ollamaHttpGet('/api/ps');
  } catch (_) {}
  const ps3j = parseOllamaJson(ps3) || { models: [] };
  measures.loadedAfterWarm = (ps3j.models || []).map((m) => ({
    name: m.name,
    size: m.size,
    expires_at: m.expires_at || null,
  }));

  report.measures = measures;

  // Timeout recommendation
  const coldMs = measures.cold && measures.cold.ok ? measures.cold.wallMs : null;
  const warmMs = measures.warm && measures.warm.ok ? measures.warm.wallMs : null;
  const loadMs =
    measures.cold && measures.cold.stats
      ? measures.cold.stats.load_duration_ms
      : null;
  // Client timeout: warm*3 + 30s margin, floor 120s, or cold+60s if only cold known
  let recommendedMs = null;
  let formula = null;
  if (warmMs != null && coldMs != null) {
    recommendedMs = Math.max(120000, Math.ceil(warmMs * 3 + 30000), Math.ceil(coldMs + 60000));
    formula = 'max(120s, warm*3+30s, cold+60s)';
  } else if (warmMs != null) {
    recommendedMs = Math.max(120000, Math.ceil(warmMs * 3 + 30000));
    formula = 'max(120s, warm*3+30s)';
  } else if (coldMs != null) {
    recommendedMs = Math.ceil(coldMs + 60000);
    formula = 'cold+60s';
  }
  report.timeoutAnalysis = {
    clientCurrentMs: 45000,
    coldWallMs: coldMs,
    warmWallMs: warmMs,
    coldLoadDurationMs: loadMs,
    recommendedClientTimeoutMs: recommendedMs,
    formula,
    noRetry: true,
    note: 'Do not bump lightly (60-120s) if cold >> 45s; warm campaign after preload',
  };

  report.warmupStrategy = {
    command: 'POST /api/chat model=' + MODEL + ' keep_alive=10m num_predict=8 synth prompt',
    verify: 'GET /api/ps must list ' + MODEL,
    keepAliveSuggested: '10m',
    ramLimitGiB: report.ollamaResources.memLimitGiB,
    stableHold:
      measures.loadedAfterWarm && measures.loadedAfterWarm.some((m) => String(m.name).includes('qwen2.5')),
    http200NotEnough: true,
  };

  const coldOk = !!(measures.cold && measures.cold.ok);
  const warmOk = !!(measures.warm && measures.warm.ok);
  report.verdict =
    coldOk && warmOk
      ? 'PASS'
      : coldOk || warmOk
        ? 'INCONCLUSIVE'
        : 'FAIL';
  report.gate = {
    ollamaWarmPrep: coldOk || warmOk ? 'GO-CONDITIONAL' : 'NO-GO',
    r01Campaign: 'NO-GO',
  };

  fs.writeFileSync(path.join(OUT, 'MEASURES.json'), JSON.stringify(measures, null, 2) + '\n');
  fs.writeFileSync(path.join(OUT, 'RESULT.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.verdict === 'FAIL' ? 1 : 0);
})().catch((e) => {
  console.error(String((e && e.stack) || e));
  process.exit(3);
});
