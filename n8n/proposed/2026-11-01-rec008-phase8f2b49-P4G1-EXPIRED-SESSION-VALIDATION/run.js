/**
 * REC-008 phase 8F-2B49-P4G1 — validation session expirée (1 message Camille).
 * TEST VC9 only. Pas de retry. Désactivation immédiate.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const net = require('net');
const { execFileSync } = require('child_process');

const envText = fs.readFileSync(
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-30-rec008-phase8e2b2-TEST-DEPLOY/.env.rec008-test.local',
  'utf8'
);
const value = (name) => envText.match(new RegExp('^' + name + '=(.*)$', 'm'))[1];

const base = 'http://127.0.0.1:5682';
const workflowId = 'OCD9It1uKFhOoWNF';
const expectedVersionId = 'e7867799-2a18-4aec-9ee5-3ba9cbc40766';
const expectedCounter = 9;
const expectedFinaliserSha =
  '3fc500bfed99c202156005d252a864cdc25514c93e7e47c842ae896381e8ee7a';
const expectedGov = '13|14|12|48|0|a2dea067599fd4f0a5f857551adc67cc';
const chatWebhookPath = 'a91c4e70-6b18-4f0d-9c55-2e7d8a14b603/chat';
const chatWebhookUrl = base + '/webhook/' + chatWebhookPath;
const chatInput = 'Camille';
const excludedSession = 'rec008-8f2b49-edit-01';
const outDir = __dirname;
const webhookFile = path.join(outDir, 'webhooks-probe.js');
const netProbeFile = path.join(outDir, 'net-probe.js');

const expectedNodeShas = {
  'Charger état conversation':
    'fca043913c5a27f7cc1e82261f8a1908a43ee8ad9d356eabec9de68a5f97ff8b',
  'Joindre tentative de session':
    'c295cd4851cf045230a33346987536670f80b58db75b1334daafcc7da2a4b3d4',
  'Parser intention': 'bd0bf9db4db88cb563d5b0766d528ec00894e3fb3843e260aa95031c52e35357',
  'Gérer collecte progressive':
    '5bc5b967c71e219c88f1bfc6f8c2a70b7ef2e79d2a56475733650c0d20855e6e',
  'Réponse générale': 'd58106f6f7fdc27efba1c2211e0aefa7c3945f3944745ba9dae4f50ae8e03373',
  'Sauvegarder état conversation':
    '7c8597781429d7c282e69b908ae28bebcb97f6a84650423cfbd48b67fef00387',
};

function sha(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}
function docker(args) {
  return execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
}
function edgesOf(connections) {
  let edges = 0;
  for (const outputs of Object.values(connections || {})) {
    for (const groups of Object.values(outputs || {})) {
      for (const group of groups || []) edges += Array.isArray(group) ? group.length : 0;
    }
  }
  return edges;
}
function urlsOf(nodes) {
  const urls = [];
  const walk = (v) => {
    if (typeof v === 'string' && /^https?:\/\//.test(v)) urls.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  for (const n of nodes || []) walk(n.parameters);
  return urls;
}
function finaliserCodeSha(parameters) {
  return sha(
    ((parameters && parameters.query) || '') +
      '\n' +
      ((parameters && parameters.options && parameters.options.queryReplacement) || '')
  );
}
function nodeParamsSha(n) {
  return sha(JSON.stringify((n && n.parameters) || {}));
}
function errInfo(e) {
  const c = e && e.cause;
  return {
    name: e && e.name,
    message: e && e.message,
    cause: c
      ? {
          name: c.name,
          message: c.message,
          code: c.code,
          errno: c.errno,
          syscall: c.syscall,
          address: c.address,
          port: c.port,
        }
      : null,
  };
}
function tcpProbe(host, port, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const sock = net.connect({ host, port }, () => {
      const elapsedMs = Date.now() - t0;
      sock.end();
      resolve({ ok: true, elapsedMs });
    });
    sock.setTimeout(timeoutMs);
    sock.on('timeout', () => {
      sock.destroy();
      resolve({ ok: false, elapsedMs: Date.now() - t0, error: 'timeout' });
    });
    sock.on('error', (e) =>
      resolve({ ok: false, elapsedMs: Date.now() - t0, error: e.code || e.message })
    );
  });
}
async function httpGetProbe(url, timeoutMs = 15000) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(timeoutMs) });
    const text = await res.text();
    return { ok: res.status === 200, status: res.status, elapsedMs: Date.now() - t0, len: text.length };
  } catch (e) {
    return { ok: false, elapsedMs: Date.now() - t0, ...errInfo(e) };
  }
}
function pg(sql) {
  return docker([
    'exec', '-i', 'govsuite-rec008-test-rec008-postgres-1',
    'psql', '-U', 'postgres', '-d', 'govsuite_rec008_test',
    '-t', '-A', '-F', '|', '-c', sql,
  ]).trim();
}
function gov() {
  return docker([
    'exec', '-i', 'govsuite-postgres',
    'psql', '-U', 'govsuite', '-d', 'govsuite', '-t', '-A', '-c',
    "SELECT (SELECT count(*) FROM rendez_vous)||'|'||(SELECT count(*) FROM notifications)||'|'||(SELECT count(*) FROM historique_rendez_vous)||'|'||(SELECT count(*) FROM ai_conversation_state)||'|'||(SELECT count(*) FROM ai_appointment_attempt)||'|'||(SELECT md5(string_agg(id::text || '|' || reference || '|' || statut || '|' || creneau_id::text || '|' || updated_at::text, ',' ORDER BY id)) FROM rendez_vous);",
  ]).trim();
}
function mockMeta() {
  const probe =
    "const http=require('http');http.get('http://rec008-mock:8080/_meta/calls',res=>{let b='';res.on('data',c=>b+=c);res.on('end',()=>console.log(b));});";
  const tmp = path.join(outDir, '_mock.js');
  fs.writeFileSync(tmp, probe);
  docker(['cp', tmp, 'govsuite-rec008-test-rec008-n8n-1:/tmp/_m4g1.js']);
  const t = docker(['exec', 'govsuite-rec008-test-rec008-n8n-1', 'node', '/tmp/_m4g1.js']).trim();
  docker(['exec', '-u', 'root', 'govsuite-rec008-test-rec008-n8n-1', 'rm', '-f', '/tmp/_m4g1.js']);
  try { fs.unlinkSync(tmp); } catch (_) {}
  return JSON.parse(t);
}
function pathCount(meta, key) {
  return Number((meta.byPath && meta.byPath[key]) || 0);
}
function postCount(meta) {
  return Object.entries(meta.byPath || {})
    .filter(([k]) => /^POST \/appointments /.test(k) && !/cancel|reschedule/i.test(k))
    .reduce((n, [, v]) => n + Number(v || 0), 0);
}
function hasCancel(meta) {
  return Object.keys(meta.byPath || {}).some((k) => /cancel|reschedule/i.test(k));
}
function networkOk() {
  const netProbe = fs.readFileSync(netProbeFile, 'utf8');
  const tmp = path.join(outDir, '_net.js');
  fs.writeFileSync(tmp, netProbe);
  docker(['cp', tmp, 'govsuite-rec008-test-rec008-n8n-1:/tmp/_n4g1.js']);
  const text = docker(['exec', 'govsuite-rec008-test-rec008-n8n-1', 'node', '/tmp/_n4g1.js']);
  docker(['exec', '-u', 'root', 'govsuite-rec008-test-rec008-n8n-1', 'rm', '-f', '/tmp/_n4g1.js']);
  try { fs.unlinkSync(tmp); } catch (_) {}
  const netRes = JSON.parse(text);
  return {
    ok: !(netRes.results || []).some((r) => r.expect === 'forbidden' && r.tcp === 'open'),
    summary: (netRes.results || []).map((r) => ({
      host: r.host,
      expect: r.expect,
      tcp: r.tcp,
    })),
  };
}
function readWebhooks() {
  docker(['cp', webhookFile, 'govsuite-rec008-test-rec008-n8n-1:/tmp/rec008-8f1-webhooks.js']);
  const text = docker(['exec', 'govsuite-rec008-test-rec008-n8n-1', 'node', '/tmp/rec008-8f1-webhooks.js']);
  docker(['exec', '-u', 'root', 'govsuite-rec008-test-rec008-n8n-1', 'rm', '-f', '/tmp/rec008-8f1-webhooks.js']);
  return JSON.parse(text);
}
function stop(reason, detail, extra) {
  const payload = {
    ok: false,
    stopped: true,
    reason,
    detail,
    ...(extra || {}),
    verdict: reason === 'no-suitable-expired-session' ? 'NO-GO' : 'FAIL',
  };
  fs.writeFileSync(path.join(outDir, 'STOP.json'), JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
  process.exit(2);
}
async function fetchRetry(url, opts, tries = 5) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try {
      const controller = new AbortController();
      const outer = setTimeout(() => controller.abort(), (opts && opts.timeoutMs) || 120000);
      const merged = { ...opts };
      delete merged.timeoutMs;
      if (!merged.signal) merged.signal = controller.signal;
      try {
        const res = await fetch(url, merged);
        clearTimeout(outer);
        return res;
      } catch (e) {
        clearTimeout(outer);
        throw e;
      }
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
  throw last;
}

function isTrueFlag(v) {
  return v === 't' || v === 'true' || v === '1';
}
function listExpiredCandidates() {
  // Une seule ligne SQL pour éviter les problèmes de quoting multiligne via docker exec.
  const sql =
    "SELECT s.session_id, CASE WHEN s.expires_at <= NOW() THEN 't' ELSE 'f' END, coalesce(s.intent,''), coalesce(s.pending_action,''), coalesce(s.conversation_step,''), CASE WHEN s.service IS NOT NULL THEN 't' ELSE 'f' END, CASE WHEN s.site IS NOT NULL THEN 't' ELSE 'f' END, CASE WHEN s.date_debut IS NOT NULL THEN 't' ELSE 'f' END, CASE WHEN s.slot_id IS NOT NULL THEN 't' ELSE 'f' END, CASE WHEN s.nom IS NOT NULL THEN 't' ELSE 'f' END, CASE WHEN s.available_slots IS NOT NULL THEN 't' ELSE 'f' END, CASE WHEN s.available_slots IS NULL THEN -1 ELSE jsonb_array_length(s.available_slots) END::text, s.expires_at::text, s.updated_at::text, (SELECT count(*) FROM ai_appointment_attempt a WHERE a.session_id=s.session_id AND a.status IN ('AWAITING_CONFIRMATION','SUBMITTING','UNCERTAIN'))::text, (SELECT count(*) FROM ai_appointment_attempt a WHERE a.session_id=s.session_id AND a.status IN ('SUBMITTING','UNCERTAIN'))::text, md5(coalesce(s.service,'')||'|'||coalesce(s.site,'')||'|'||coalesce(s.date_debut::text,'')||'|'||coalesce(s.date_fin::text,'')||'|'||coalesce(s.slot_id::text,'')||'|'||coalesce(s.pending_action,'')||'|'||coalesce(s.conversation_step,'')||'|'||coalesce(s.available_slots::text,'')||'|'||coalesce(s.intent,'')||'|'||CASE WHEN s.nom IS NOT NULL THEN 't' ELSE 'f' END||'|'||CASE WHEN s.prenom IS NOT NULL THEN 't' ELSE 'f' END||'|'||CASE WHEN s.email IS NOT NULL THEN 't' ELSE 'f' END||'|'||CASE WHEN s.telephone IS NOT NULL THEN 't' ELSE 'f' END) FROM ai_conversation_state s WHERE s.expires_at IS NOT NULL AND s.expires_at <= NOW() ORDER BY s.updated_at DESC;";
  return pg(sql)
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const p = line.split('|');
      return {
        sessionId: p[0],
        expired: isTrueFlag(p[1]),
        intent: p[2],
        pendingAction: p[3],
        conversationStep: p[4],
        hasService: isTrueFlag(p[5]),
        hasSite: isTrueFlag(p[6]),
        hasDateDebut: isTrueFlag(p[7]),
        hasSlot: isTrueFlag(p[8]),
        hasNom: isTrueFlag(p[9]),
        hasAvailableSlots: isTrueFlag(p[10]),
        slotsLen: Number(p[11]),
        expiresAt: p[12],
        updatedAt: p[13],
        openAttempts: Number(p[14]),
        resumeAttempts: Number(p[15]),
        draftFingerprint: p[16],
      };
    });
}

function sessionSafeSnap(id) {
  const sid = id.replace(/'/g, "''");
  const line = pg(
    `SELECT session_id, coalesce(intent,''), coalesce(pending_action,''), coalesce(conversation_step,''), expires_at::text, updated_at::text, CASE WHEN service IS NOT NULL THEN 't' ELSE 'f' END, CASE WHEN site IS NOT NULL THEN 't' ELSE 'f' END, CASE WHEN date_debut IS NOT NULL THEN 't' ELSE 'f' END, CASE WHEN date_fin IS NOT NULL THEN 't' ELSE 'f' END, CASE WHEN slot_id IS NOT NULL THEN 't' ELSE 'f' END, CASE WHEN selected_slot_index IS NOT NULL THEN 't' ELSE 'f' END, CASE WHEN available_slots IS NOT NULL THEN 't' ELSE 'f' END, CASE WHEN available_slots IS NULL THEN -1 ELSE jsonb_array_length(available_slots) END::text, CASE WHEN nom IS NOT NULL THEN 't' ELSE 'f' END, CASE WHEN prenom IS NOT NULL THEN 't' ELSE 'f' END, CASE WHEN email IS NOT NULL THEN 't' ELSE 'f' END, CASE WHEN telephone IS NOT NULL THEN 't' ELSE 'f' END, CASE WHEN reference IS NOT NULL AND reference <> '' THEN 't' ELSE 'f' END, CASE WHEN token IS NOT NULL THEN 't' ELSE 'f' END, left(coalesce(last_user_message,''), 40), md5(coalesce(service,'')||'|'||coalesce(site,'')||'|'||coalesce(date_debut::text,'')||'|'||coalesce(date_fin::text,'')||'|'||coalesce(slot_id::text,'')||'|'||coalesce(pending_action,'')||'|'||coalesce(conversation_step,'')||'|'||coalesce(available_slots::text,'')||'|'||coalesce(intent,'')||'|'||CASE WHEN nom IS NOT NULL THEN 't' ELSE 'f' END||'|'||CASE WHEN prenom IS NOT NULL THEN 't' ELSE 'f' END||'|'||CASE WHEN email IS NOT NULL THEN 't' ELSE 'f' END||'|'||CASE WHEN telephone IS NOT NULL THEN 't' ELSE 'f' END), md5(coalesce(available_slots::text,'')||'|'||coalesce(selected_slot_index::text,'')) FROM ai_conversation_state WHERE session_id='${sid}';`
  );
  if (!line) return null;
  const p = line.split('|');
  return {
    sessionId: p[0],
    intent: p[1],
    pendingAction: p[2],
    conversationStep: p[3],
    expiresAt: p[4],
    updatedAt: p[5],
    flags: {
      service: isTrueFlag(p[6]),
      site: isTrueFlag(p[7]),
      dateDebut: isTrueFlag(p[8]),
      dateFin: isTrueFlag(p[9]),
      slotId: isTrueFlag(p[10]),
      selectedSlotIndex: isTrueFlag(p[11]),
      availableSlots: isTrueFlag(p[12]),
      slotsLen: Number(p[13]),
      nom: isTrueFlag(p[14]),
      prenom: isTrueFlag(p[15]),
      email: isTrueFlag(p[16]),
      telephone: isTrueFlag(p[17]),
      reference: isTrueFlag(p[18]),
      token: isTrueFlag(p[19]),
    },
    lastUserMessagePreviewLen: (p[20] || '').length,
    lastUserMessageStartsWithCamille: /^Camille/i.test(p[20] || ''),
    draftFingerprint: p[21],
    slotsFingerprint: p[22],
  };
}

function attemptsForSession(id) {
  const lines = pg(`
SELECT status, count(*)::text
FROM ai_appointment_attempt
WHERE session_id='${id.replace(/'/g, "''")}'
GROUP BY status ORDER BY status;`)
    .split(/\r?\n/)
    .filter(Boolean);
  return {
    total: Number(
      pg(`SELECT count(*) FROM ai_appointment_attempt WHERE session_id='${id.replace(/'/g, "''")}';`) ||
        '0'
    ),
    byStatus: lines,
    open: Number(
      pg(
        `SELECT count(*) FROM ai_appointment_attempt WHERE session_id='${id.replace(/'/g, "''")}' AND status IN ('AWAITING_CONFIRMATION','SUBMITTING','UNCERTAIN');`
      ) || '0'
    ),
    hasIdempotencyKey: Number(
      pg(
        `SELECT count(*) FROM ai_appointment_attempt WHERE session_id='${id.replace(/'/g, "''")}' AND idempotency_key IS NOT NULL;`
      ) || '0'
    ),
  };
}

(async () => {
  if (new URL(base).hostname !== '127.0.0.1' || new URL(base).port !== '5682') {
    stop('bad-base', {});
  }
  fs.mkdirSync(outDir, { recursive: true });

  const login = await fetchRetry(base + '/rest/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      emailOrLdapLoginId: value('REC008_N8N_OWNER_EMAIL'),
      password: value('REC008_N8N_OWNER_PASSWORD'),
    }),
  });
  const cookie = (login.headers.getSetCookie ? login.headers.getSetCookie() : [])
    .map((i) => i.split(';')[0])
    .join('; ');
  if (login.status !== 200 || !cookie) stop('login', { status: login.status });
  const session = { cookie, accept: 'application/json', 'content-type': 'application/json' };

  const wf = (
    await (await fetch(base + '/rest/workflows/' + workflowId, { headers: session })).json()
  ).data;
  const activeList = await (await fetch(base + '/rest/active-workflows', { headers: session })).json();
  const activeIds = (activeList.data || activeList || []).map((x) => x.id || x).filter(Boolean);
  const nodes = wf.nodes || [];
  const finaliser = nodes.find((n) => n.name === 'Finaliser état création');
  const urls = urlsOf(nodes);
  const postgresIds = [
    ...new Set(
      nodes.filter((n) => n.credentials && n.credentials.postgres).map((n) => n.credentials.postgres.id)
    ),
  ];
  const nodeShas = {};
  const nodeShaOk = {};
  for (const [name, expected] of Object.entries(expectedNodeShas)) {
    const n = nodes.find((x) => x.name === name);
    nodeShas[name] = n ? nodeParamsSha(n) : null;
    nodeShaOk[name] = nodeShas[name] === expected;
  }

  const webhooksBefore = fs.existsSync(webhookFile) ? readWebhooks() : { rows: [] };
  const mock = mockMeta();
  const mail = JSON.parse(
    docker(['exec', 'govsuite-mailpit', 'wget', '-qO-', 'http://127.0.0.1:8025/api/v1/info'])
  );
  const pgCounts = pg(
    'SELECT (SELECT count(*) FROM rendez_vous),(SELECT count(*) FROM ai_conversation_state),(SELECT count(*) FROM ai_appointment_attempt),(SELECT count(*) FROM notifications);'
  );
  const open = pg(
    "SELECT count(*) FROM ai_appointment_attempt WHERE status IN ('AWAITING_CONFIRMATION','SUBMITTING','UNCERTAIN');"
  );
  const govFp = gov();
  const net = networkOk();

  const preflight = {
    phase: '8F-2B49-P4G1',
    at: new Date().toISOString(),
    observed: {
      active: wf.active === true,
      activeVersionId: wf.activeVersionId || null,
      versionId: wf.versionId,
      versionCounter: Number(wf.versionCounter),
      nodes: nodes.length,
      edges: edgesOf(wf.connections),
      finaliserSha: finaliserCodeSha(finaliser && finaliser.parameters),
      activeIds,
      webhookRowsBefore: (webhooksBefore.rows || []).length,
      urlsCount: urls.length,
      urlsOk: urls.length === 10 && urls.every((u) => u.startsWith('http://rec008-mock:8080/')),
      postgresIds,
      nodeShas,
      nodeShaOk,
      pg: pgCounts,
      open,
      mockPosts: postCount(mock),
      getAvailability: pathCount(mock, 'GET /appointments/availability 200'),
      getServices: pathCount(mock, 'GET /services 200'),
      mockScenario: mock.scenario,
      gov: govFp,
      mailpit: { messages: mail.Messages, unread: mail.Unread, dbSize: mail.DatabaseSize },
      networkOk: net.ok,
    },
  };
  preflight.checks = {
    inactive: preflight.observed.active === false && preflight.observed.activeVersionId === null,
    versionId: preflight.observed.versionId === expectedVersionId,
    versionCounter: preflight.observed.versionCounter === expectedCounter,
    graph: preflight.observed.nodes === 134 && preflight.observed.edges === 137,
    finaliserSha: preflight.observed.finaliserSha === expectedFinaliserSha,
    nodeShas: Object.values(nodeShaOk).every(Boolean),
    noOtherActive: activeIds.length === 0,
    noActiveWebhooks: (webhooksBefore.rows || []).length === 0,
    urlsOk: preflight.observed.urlsOk,
    credentialsTest: postgresIds.length === 1 && postgresIds[0] === 'Fs0l0058q5CEadRw',
    networkOk: net.ok,
    pg: pgCounts === '1|11|4|0',
    open: open === '0',
    mockPosts: postCount(mock) === 0,
    getAvailability: pathCount(mock, 'GET /appointments/availability 200') === 0,
    getServices: pathCount(mock, 'GET /services 200') === 0,
    mockScenario: mock.scenario === 'created',
    live: govFp === expectedGov,
    mailpit: mail.Messages === 5 && mail.Unread === 2 && mail.DatabaseSize === 98304,
  };
  preflight.preflightOk = Object.values(preflight.checks).every(Boolean);
  fs.writeFileSync(path.join(outDir, 'PREFLIGHT.json'), JSON.stringify(preflight, null, 2));
  if (!preflight.preflightOk) stop('preflight-failed', preflight.checks);

  // --- Session selection (read-only) ---
  const candidates = listExpiredCandidates();
  const ranked = candidates
    .filter((c) => c.sessionId !== excludedSession)
    .filter((c) => c.expired)
    .filter((c) => c.openAttempts === 0 && c.resumeAttempts === 0)
    .filter((c) => {
      const hasDraft =
        !!c.pendingAction ||
        !!c.conversationStep ||
        c.hasService ||
        c.hasSite ||
        c.hasSlot ||
        c.hasNom ||
        c.hasAvailableSlots ||
        c.hasDateDebut;
      return hasDraft;
    })
    .map((c) => {
      let score = 0;
      if (c.pendingAction === 'CREATE_APPOINTMENT') score += 100;
      if (/^ASK_/.test(c.conversationStep || '')) score += 50;
      if (c.hasService || c.hasSite || c.hasSlot) score += 20;
      if (c.hasAvailableSlots) score += 10;
      return { ...c, score };
    })
    .sort((a, b) => b.score - a.score || a.sessionId.localeCompare(b.sessionId));

  const selection = {
    excludedSession,
    candidateCount: candidates.length,
    eligibleCount: ranked.length,
    candidatesSafe: candidates.map((c) => ({
      sessionId: c.sessionId,
      expired: c.expired,
      intent: c.intent || null,
      pendingAction: c.pendingAction || null,
      conversationStep: c.conversationStep || null,
      flags: {
        service: c.hasService,
        site: c.hasSite,
        slot: c.hasSlot,
        nom: c.hasNom,
        availableSlots: c.hasAvailableSlots,
        slotsLen: c.slotsLen,
      },
      openAttempts: c.openAttempts,
      resumeAttempts: c.resumeAttempts,
      draftFingerprint: c.draftFingerprint,
      excluded: c.sessionId === excludedSession,
    })),
    selected: ranked[0] || null,
  };
  fs.writeFileSync(path.join(outDir, 'SESSION_SELECTION.json'), JSON.stringify(selection, null, 2));

  if (!ranked[0]) {
    stop('no-suitable-expired-session', selection, { goNoGoNext: 'NO-GO' });
  }

  const sessionId = ranked[0].sessionId;
  const beforeSnap = sessionSafeSnap(sessionId);
  const beforeAttempts = attemptsForSession(sessionId);
  const beforeState = {
    sessionId,
    snap: beforeSnap,
    attempts: beforeAttempts,
    justification: {
      priority: 'collecte CREATE interrompue' ,
      pendingAction: beforeSnap.pendingAction,
      conversationStep: beforeSnap.conversationStep,
      expired: true,
      openAttempts: beforeAttempts.open,
      excludedPurgedP4: excludedSession,
    },
  };
  fs.writeFileSync(path.join(outDir, 'STATE_BEFORE.json'), JSON.stringify(beforeState, null, 2));

  if (!(beforeSnap && beforeSnap.expiresAt)) stop('before-snap-missing', beforeSnap);
  // confirm still expired at capture time
  const stillExpired = pg(
    `SELECT CASE WHEN expires_at IS NOT NULL AND expires_at <= NOW() THEN 't' ELSE 'f' END FROM ai_conversation_state WHERE session_id='${sessionId.replace(/'/g, "''")}';`
  );
  if (!isTrueFlag(stillExpired)) stop('session-not-expired-anymore', { stillExpired, sessionId });

  // --- Connectivity ---
  const tcp = await tcpProbe('127.0.0.1', 5682);
  const healthz = await httpGetProbe(base + '/healthz');
  const readiness = await httpGetProbe(base + '/healthz/readiness');
  const connectivity = { tcp, healthz, readiness };
  fs.writeFileSync(path.join(outDir, 'CONNECTIVITY.json'), JSON.stringify(connectivity, null, 2));
  if (!tcp.ok || !healthz.ok || !readiness.ok) stop('connectivity', connectivity);

  const result = {
    phase: '8F-2B49-P4G1',
    sessionId,
    chatInput,
    messageSent: false,
    executed: false,
  };

  let activated = false;
  async function deactivateAndCollect(tag) {
    let deactivate;
    try {
      deactivate = await fetchRetry(base + '/rest/workflows/' + workflowId + '/deactivate', {
        method: 'POST',
        headers: session,
        body: '{}',
      });
    } catch (e) {
      deactivate = { status: 0, text: async () => String(e.message) };
    }
    const deactivateText = await deactivate.text();
    const afterWf = (
      await (await fetch(base + '/rest/workflows/' + workflowId, { headers: session })).json()
    ).data;
    const activeAfter = await (await fetch(base + '/rest/active-workflows', { headers: session })).json();
    const activeIdsAfter = (activeAfter.data || activeAfter || []).map((x) => x.id || x).filter(Boolean);
    let webhooksAfter = { rows: [] };
    try {
      webhooksAfter = readWebhooks();
    } catch (_) {}
    activated = false;
    return {
      tag,
      status: deactivate.status,
      bodyPreview: (deactivateText || '').slice(0, 200),
      active: afterWf.active === true,
      activeVersionId: afterWf.activeVersionId || null,
      versionId: afterWf.versionId,
      versionCounter: Number(afterWf.versionCounter),
      activeIds: activeIdsAfter,
      webhookRows: (webhooksAfter.rows || []).length,
    };
  }

  try {
    const activate = await fetchRetry(base + '/rest/workflows/' + workflowId + '/activate', {
      method: 'POST',
      headers: session,
      body: JSON.stringify({ versionId: expectedVersionId }),
      timeoutMs: 60000,
    });
    const activateJson = JSON.parse(await activate.text());
    const published = activateJson.data || activateJson;
    result.activate = {
      status: activate.status,
      active: published.active === true,
      activeVersionId: published.activeVersionId || null,
      versionId: published.versionId,
      versionCounter: Number(published.versionCounter),
    };
    if (
      activate.status !== 200 ||
      published.active !== true ||
      published.activeVersionId !== expectedVersionId
    ) {
      stop('activate', result.activate);
    }
    activated = true;

    const liveListed = (
      (await (await fetch(base + '/rest/workflows?limit=50', { headers: session })).json()).data || []
    );
    result.activate.activeIds = liveListed.filter((r) => r.active).map((r) => r.id);
    if (result.activate.activeIds.join() !== workflowId) {
      const deact = await deactivateAndCollect('other-active');
      stop('other-active', { activate: result.activate, deact });
    }

    const webhooks = readWebhooks();
    result.activate.webhooks = (webhooks.rows || []).map((row) => ({
      workflowId: row.workflowId,
      webhookPath: row.webhookPath || row.path || null,
      method: row.method || null,
    }));
    const chatWebhook = (webhooks.rows || []).find(
      (r) =>
        String(r.workflowId) === workflowId &&
        String(r.method || '').toUpperCase() === 'POST' &&
        String(r.webhookPath || r.path || '') === chatWebhookPath
    );
    if (!chatWebhook || result.activate.webhooks.some((r) => String(r.workflowId) !== workflowId)) {
      const deact = await deactivateAndCollect('webhook');
      stop('webhook', { webhooks: result.activate.webhooks, deact });
    }

    await new Promise((r) => setTimeout(r, 5000));

    const warmupStarted = Date.now();
    let warmup = null;
    try {
      const warmupRes = await fetch(chatWebhookUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(30000),
      });
      const warmupText = await warmupRes.text();
      warmup = {
        ok: true,
        status: warmupRes.status,
        elapsedMs: Date.now() - warmupStarted,
        bodyLen: (warmupText || '').length,
      };
    } catch (warmupErr) {
      warmup = { ok: false, elapsedMs: Date.now() - warmupStarted, ...errInfo(warmupErr) };
    }
    result.warmup = warmup;
    if (!warmup.ok) {
      const deact = await deactivateAndCollect('warmup-failed');
      stop('warmup-failed', { warmup, deact }, { activationPerformed: true, messageSent: false });
    }

    await new Promise((r) => setTimeout(r, 1000));

    const mockBefore = mockMeta();
    const started = Date.now();
    let response;
    let responseText;
    let transportFailure = null;
    try {
      response = await fetch(chatWebhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ action: 'sendMessage', sessionId, chatInput }),
        signal: AbortSignal.timeout(180000),
      });
      responseText = await response.text();
    } catch (chatErr) {
      transportFailure = {
        ...errInfo(chatErr),
        elapsedMs: Date.now() - started,
        targetUrl: chatWebhookUrl,
        method: 'POST',
      };
      response = { status: 0 };
      responseText = '';
    }
    const elapsedMs = Date.now() - started;
    result.messageSent = true;
    result.executed = true;
    const mockAfter = mockMeta();
    fs.writeFileSync(path.join(outDir, 'response.txt'), responseText || '');

    let responseJson = null;
    try {
      responseJson = JSON.parse(responseText);
    } catch (_) {}

    result.message = {
      status: response.status,
      elapsedMs,
      targetUrl: chatWebhookUrl,
      transportFailure,
      responsePreview: (responseText || '').slice(0, 1200),
      responseJson: responseJson
        ? {
            type: responseJson.type || null,
            textPreview: String(responseJson.text || '').slice(0, 400),
            keys: Object.keys(responseJson),
            hasAppointmentCreated: !!(
              responseJson.appointment_created ||
              responseJson.appointmentCreated ||
              responseJson.reference
            ),
            conversationStep: responseJson.conversationStep || null,
            claimAcquired: responseJson.claimAcquired === true,
            ready: responseJson.ready === true,
          }
        : null,
      mockBefore: {
        scenario: mockBefore.scenario,
        posts: postCount(mockBefore),
        getAvailability: pathCount(mockBefore, 'GET /appointments/availability 200'),
        getServices: pathCount(mockBefore, 'GET /services 200'),
      },
      mockAfter: {
        scenario: mockAfter.scenario,
        posts: postCount(mockAfter),
        getAvailability: pathCount(mockAfter, 'GET /appointments/availability 200'),
        getServices: pathCount(mockAfter, 'GET /services 200'),
        byPath: mockAfter.byPath,
      },
      getServicesDelta:
        pathCount(mockAfter, 'GET /services 200') - pathCount(mockBefore, 'GET /services 200'),
      getAvailabilityDelta:
        pathCount(mockAfter, 'GET /appointments/availability 200') -
        pathCount(mockBefore, 'GET /appointments/availability 200'),
      postDelta: postCount(mockAfter) - postCount(mockBefore),
      cancelSeen: hasCancel(mockAfter),
    };

    result.deactivate = await deactivateAndCollect(
      transportFailure ? 'after-transport-failure' : 'after-message'
    );

    const afterSnap = sessionSafeSnap(sessionId);
    const afterAttempts = attemptsForSession(sessionId);
    const pg1 = pg(
      'SELECT (SELECT count(*) FROM rendez_vous),(SELECT count(*) FROM ai_conversation_state),(SELECT count(*) FROM ai_appointment_attempt),(SELECT count(*) FROM notifications);'
    );
    const open1 = pg(
      "SELECT count(*) FROM ai_appointment_attempt WHERE status IN ('AWAITING_CONFIRMATION','SUBMITTING','UNCERTAIN');"
    );
    const gov1 = gov();
    const mail1 = JSON.parse(
      docker(['exec', 'govsuite-mailpit', 'wget', '-qO-', 'http://127.0.0.1:8025/api/v1/info'])
    );
    const mockEnd = mockMeta();

    result.after = {
      snap: afterSnap,
      attempts: afterAttempts,
      pg: pg1,
      open: open1,
      mockPosts: postCount(mockEnd),
      getAvailability: pathCount(mockEnd, 'GET /appointments/availability 200'),
      getServices: pathCount(mockEnd, 'GET /services 200'),
      mockScenario: mockEnd.scenario,
      gov: gov1,
      mailpit: { messages: mail1.Messages, unread: mail1.Unread, dbSize: mail1.DatabaseSize },
    };

    const text = String((responseJson && responseJson.text) || responseText || '');
    const type = responseJson && responseJson.type;
    const ttlUnchanged = beforeSnap.expiresAt === afterSnap.expiresAt;
    const pendingPreserved =
      beforeSnap.pendingAction === afterSnap.pendingAction &&
      beforeSnap.conversationStep === afterSnap.conversationStep;
    const flagsPreserved =
      JSON.stringify(beforeSnap.flags) === JSON.stringify(afterSnap.flags);
    const slotsPreserved = beforeSnap.slotsFingerprint === afterSnap.slotsFingerprint;
    // Brouillon métier : pending/step/flags/slots. intent peut passer à GENERAL (routage expiration).
    const draftPreserved = pendingPreserved && flagsPreserved && slotsPreserved;
    const updatedAtChanged = beforeSnap.updatedAt !== afterSnap.updatedAt;
    const lastMsgChanged = afterSnap.lastUserMessageStartsWithCamille === true;
    const intentRoutedToGeneral = afterSnap.intent === 'GENERAL';

    const responseOk =
      !transportFailure &&
      response.status === 200 &&
      type === 'session_expired' &&
      /expir/i.test(text) &&
      !/sessionFound|sessionExpired|pendingAction|conversationStep|refreshSessionTtl|_authorizedNulls/i.test(
        text
      ) &&
      type !== 'create_appointment_question' &&
      type !== 'services' &&
      type !== 'availability' &&
      !(responseJson && responseJson.appointment_created) &&
      !(responseJson && responseJson.claimAcquired === true) &&
      !(responseJson && responseJson.ready === true) &&
      !/pr[eé]nom|e-?mail|confirmez/i.test(text);

    const antiReservationOk =
      result.message.postDelta === 0 &&
      result.message.getAvailabilityDelta === 0 &&
      result.message.getServicesDelta === 0 &&
      !result.message.cancelSeen &&
      afterAttempts.total === beforeAttempts.total &&
      afterAttempts.open === 0 &&
      afterAttempts.hasIdempotencyKey === beforeAttempts.hasIdempotencyKey;

    const stateOk =
      ttlUnchanged &&
      draftPreserved &&
      pendingPreserved &&
      flagsPreserved &&
      slotsPreserved &&
      intentRoutedToGeneral &&
      pg1 === '1|11|4|0' &&
      open1 === '0';

    const deactivateOk =
      result.deactivate &&
      result.deactivate.active === false &&
      result.deactivate.activeVersionId === null &&
      result.deactivate.activeIds.length === 0 &&
      result.deactivate.webhookRows === 0 &&
      result.deactivate.versionCounter === expectedCounter;

    const liveOk =
      gov1 === expectedGov &&
      mail1.Messages === 5 &&
      mail1.Unread === 2 &&
      mail1.DatabaseSize === 98304;

    let verdict = 'PASS';
    if (transportFailure && !responseJson) verdict = 'UNCERTAIN';
    else if (!(responseOk && antiReservationOk && stateOk && deactivateOk && liveOk)) verdict = 'FAIL';

    result.comparisons = {
      ttlUnchanged,
      expiresAtBefore: beforeSnap.expiresAt,
      expiresAtAfter: afterSnap.expiresAt,
      draftPreserved,
      draftMetierPreserved: draftPreserved,
      slotsPreserved,
      intentBefore: beforeSnap.intent,
      intentAfter: afterSnap.intent,
      intentRoutedToGeneral,
      pendingPreserved,
      flagsPreserved,
      updatedAtChanged,
      lastUserMessageUpdatedToCamille: lastMsgChanged,
      nonBusinessMetadataNote:
        'Métadonnées non métier observées sans reprise: intent→GENERAL (routage session_expired), updated_at rafraîchi, last_user_message=Camille. expires_at non prolongé.',
    };
    result.checks = {
      responseOk,
      antiReservationOk,
      stateOk,
      deactivateOk,
      liveOk,
      singleMessage: result.messageSent === true,
      sessionWasExpired: true,
    };
    result.verdict = verdict;
    result.goNoGoNext =
      verdict === 'PASS'
        ? 'GO (sous autorisation distincte) pour P4G2 / validations TTL suivantes'
        : 'NO-GO';

    fs.writeFileSync(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2));
    fs.writeFileSync(
      path.join(outDir, 'STATE_AFTER.json'),
      JSON.stringify({ snap: afterSnap, attempts: afterAttempts }, null, 2)
    );
    console.log(
      JSON.stringify(
        {
          verdict,
          sessionId,
          type,
          ttlUnchanged,
          draftPreserved,
          postDelta: result.message.postDelta,
          deactivateOk,
          elapsedMs,
        },
        null,
        2
      )
    );
    process.exit(verdict === 'PASS' ? 0 : 2);
  } catch (e) {
    if (activated) {
      try {
        await deactivateAndCollect('catch');
      } catch (_) {}
    }
    stop('exception', errInfo(e));
  }
})().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
