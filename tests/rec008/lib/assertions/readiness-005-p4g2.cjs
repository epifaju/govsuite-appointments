'use strict';

/**
 * READINESS-005 — classifieur d'assertions P4G2 (catalogue uniquement).
 * Aucun réseau, webhook, activation n8n, ni POST CreateAppointment.
 * Évalue une forme d'évidence synthétique / figée → PASS | FAIL | UNCERTAIN.
 */

const path = require('path');
const { loadJson, REC008_ROOT } = require('../load-json.cjs');

const RUNTIME_VERDICTS = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  UNCERTAIN: 'UNCERTAIN'
});

const CATALOG_REL = path.join('readiness', 'R005-p4g2-explicit-resume-assertions.json');
const FIXTURE_REL = path.join('fixtures', 'readiness-005-p4g2-synthetic-evidence.json');

function loadCatalog() {
  return loadJson(path.join(REC008_ROOT, CATALOG_REL)).data;
}

function loadSyntheticEvidence() {
  return loadJson(path.join(REC008_ROOT, FIXTURE_REL)).data;
}

function deepMerge(base, overrides) {
  if (!overrides || typeof overrides !== 'object') return base;
  const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
  for (const key of Object.keys(overrides)) {
    const bv = out[key];
    const ov = overrides[key];
    if (
      ov &&
      typeof ov === 'object' &&
      !Array.isArray(ov) &&
      bv &&
      typeof bv === 'object' &&
      !Array.isArray(bv)
    ) {
      out[key] = deepMerge(bv, ov);
    } else {
      out[key] = ov;
    }
  }
  return out;
}

function resolveCase(fixture, caseId) {
  const raw = fixture.cases[caseId];
  if (!raw) throw new Error('Unknown evidence case: ' + caseId);
  if (!raw.inherits) return raw;
  const parent = resolveCase(fixture, raw.inherits);
  return deepMerge(parent, Object.assign({}, raw.overrides, {
    label: raw.label,
    expectedAggregate: raw.expectedAggregate,
    inherits: raw.inherits
  }));
}

function result(id, verdict, reason, evidenceClass) {
  return { id, verdict, reason, evidenceClass };
}

function evalHttp200(ev) {
  const m = ev.message || {};
  if (m.transportFailure) {
    return result(
      'R005-A01-http-200',
      RUNTIME_VERDICTS.UNCERTAIN,
      'transportFailure=' + m.transportFailure,
      'runtimeRequired'
    );
  }
  if (m.status === 200 && m.responseJson && typeof m.responseJson === 'object') {
    return result('R005-A01-http-200', RUNTIME_VERDICTS.PASS, 'HTTP 200 + JSON', 'runtimeRequired');
  }
  if (m.status == null) {
    return result('R005-A01-http-200', RUNTIME_VERDICTS.UNCERTAIN, 'status absent', 'runtimeRequired');
  }
  if (m.status >= 400) {
    return result('R005-A01-http-200', RUNTIME_VERDICTS.FAIL, 'HTTP ' + m.status, 'runtimeRequired');
  }
  return result('R005-A01-http-200', RUNTIME_VERDICTS.UNCERTAIN, 'réponse ambiguë', 'runtimeRequired');
}

function evalResponseType(ev) {
  const rj = (ev.message && ev.message.responseJson) || null;
  if (!rj) {
    return result(
      'R005-A02-response-type',
      RUNTIME_VERDICTS.UNCERTAIN,
      'responseJson absent',
      'runtimeRequired'
    );
  }
  const ok =
    rj.type === 'create_appointment_question' &&
    rj.conversationStep === 'ASK_CREATE_SERVICE' &&
    rj.ready === false &&
    rj.claimAcquired === false &&
    rj.hasAppointmentCreated !== true;
  if (ok) {
    return result(
      'R005-A02-response-type',
      RUNTIME_VERDICTS.PASS,
      'type create_appointment_question',
      'runtimeRequired'
    );
  }
  if (rj.type === 'session_expired' || rj.ready === true || rj.claimAcquired === true) {
    return result(
      'R005-A02-response-type',
      RUNTIME_VERDICTS.FAIL,
      'type/ready/claim hors contrat: ' + rj.type,
      'runtimeRequired'
    );
  }
  return result(
    'R005-A02-response-type',
    RUNTIME_VERDICTS.FAIL,
    'contrat réponse non satisfait',
    'runtimeRequired'
  );
}

function evalTtl(ev) {
  const c = ev.comparisons || {};
  if (c.ttlRenewed === true && c.ttlPolicyOk === true && c.expiresStillFuture === true) {
    return result('R005-A03-ttl-renew', RUNTIME_VERDICTS.PASS, 'TTL +2h / futur', 'runtimeRequired');
  }
  if (c.ttlRenewed === false || c.expiresStillFuture === false || c.ttlPolicyOk === false) {
    return result('R005-A03-ttl-renew', RUNTIME_VERDICTS.FAIL, 'TTL non renouvelé', 'runtimeRequired');
  }
  return result('R005-A03-ttl-renew', RUNTIME_VERDICTS.UNCERTAIN, 'TTL non observable', 'runtimeRequired');
}

function evalIntentPendingStep(ev) {
  const c = ev.comparisons || {};
  const ok =
    c.intentBefore === 'GENERAL' &&
    c.intentAfter === 'CREATE_APPOINTMENT' &&
    c.pendingAction === 'CREATE_APPOINTMENT' &&
    c.conversationStep === 'ASK_CREATE_SERVICE';
  if (ok) {
    return result(
      'R005-A04-intent-pending-step',
      RUNTIME_VERDICTS.PASS,
      'intent/pending/step OK',
      'runtimeRequired'
    );
  }
  if (c.intentAfter == null || c.pendingAction == null || c.conversationStep == null) {
    return result(
      'R005-A04-intent-pending-step',
      RUNTIME_VERDICTS.UNCERTAIN,
      'état session incomplet',
      'runtimeRequired'
    );
  }
  return result(
    'R005-A04-intent-pending-step',
    RUNTIME_VERDICTS.FAIL,
    'intent/pending/step hors contrat',
    'runtimeRequired'
  );
}

function evalDraft(ev) {
  const c = ev.comparisons || {};
  const ok =
    c.draftMetierPreserved === true &&
    c.slotsPreserved === true &&
    c.flagsPreserved === true &&
    c.pendingPreserved === true &&
    c.attemptsTotal === 0 &&
    c.slotsFingerprintUnchanged === true;
  if (ok) {
    return result('R005-A05-draft-preserved', RUNTIME_VERDICTS.PASS, 'brouillon métier OK', 'runtimeRequired');
  }
  if (
    c.draftMetierPreserved === false ||
    c.slotsPreserved === false ||
    c.flagsPreserved === false ||
    c.pendingPreserved === false ||
    (typeof c.attemptsTotal === 'number' && c.attemptsTotal > 0)
  ) {
    return result('R005-A05-draft-preserved', RUNTIME_VERDICTS.FAIL, 'brouillon altéré', 'runtimeRequired');
  }
  return result(
    'R005-A05-draft-preserved',
    RUNTIME_VERDICTS.UNCERTAIN,
    'brouillon non comparable',
    'runtimeRequired'
  );
}

function evalClaimPost(ev) {
  const a = ev.antiReservation || {};
  const fail =
    a.claimAcquired === true ||
    (typeof a.postDelta === 'number' && a.postDelta > 0) ||
    (typeof a.openAttempts === 'number' && a.openAttempts > 0) ||
    (typeof a.hasIdempotencyKey === 'number' && a.hasIdempotencyKey > 0);
  if (fail) {
    return result(
      'R005-A06-claim-zero-post-zero',
      RUNTIME_VERDICTS.FAIL,
      'CLAIM/POST/tentative non nuls',
      'runtimeRequired'
    );
  }
  const pass =
    a.claimAcquired === false &&
    a.postDelta === 0 &&
    a.getAvailabilityDelta === 0 &&
    a.getServicesDelta === 0 &&
    a.openAttempts === 0 &&
    a.hasIdempotencyKey === 0 &&
    a.cancelSeen === false;
  if (pass) {
    return result(
      'R005-A06-claim-zero-post-zero',
      RUNTIME_VERDICTS.PASS,
      'CLAIM=0 POST=0',
      'runtimeRequired'
    );
  }
  return result(
    'R005-A06-claim-zero-post-zero',
    RUNTIME_VERDICTS.UNCERTAIN,
    'compteurs incomplets',
    'runtimeRequired'
  );
}

function evalDeactivate(ev) {
  const d = ev.deactivate || {};
  if (d.unreadable === true || d.active == null || d.webhookRows == null) {
    return result(
      'R005-A07-deactivate',
      RUNTIME_VERDICTS.UNCERTAIN,
      'deactivate illisible',
      'runtimeRequired'
    );
  }
  const pass =
    d.active === false && d.activeVersionId == null && d.webhookRows === 0 && d.versionCounter === 9;
  if (pass) {
    return result('R005-A07-deactivate', RUNTIME_VERDICTS.PASS, 'workflow inactif', 'runtimeRequired');
  }
  if (d.active === true || d.webhookRows > 0) {
    return result(
      'R005-A07-deactivate',
      RUNTIME_VERDICTS.FAIL,
      'reste actif ou webhooks résiduels',
      'runtimeRequired'
    );
  }
  return result('R005-A07-deactivate', RUNTIME_VERDICTS.UNCERTAIN, 'deactivate ambigu', 'runtimeRequired');
}

function evalSingleMessage(ev) {
  const m = ev.message || {};
  if (typeof m.count !== 'number') {
    return result(
      'R005-A08-single-message-no-retry',
      RUNTIME_VERDICTS.UNCERTAIN,
      'count inconnu',
      'runtimeRequired'
    );
  }
  if (m.count === 1 && (m.retryCount || 0) === 0) {
    return result(
      'R005-A08-single-message-no-retry',
      RUNTIME_VERDICTS.PASS,
      '1 message / 0 retry',
      'runtimeRequired'
    );
  }
  return result(
    'R005-A08-single-message-no-retry',
    RUNTIME_VERDICTS.FAIL,
    'message/retry hors protocole',
    'runtimeRequired'
  );
}

function evalLive(ev) {
  const pre = ev.preflight || {};
  const iso = ev.isolation || {};
  if (!pre.liveFingerprint || !iso.liveFingerprintAfter) {
    return result('R005-A09-live-untouched', RUNTIME_VERDICTS.UNCERTAIN, 'empreinte absente', 'runtimeRequired');
  }
  if (pre.liveFingerprint === iso.liveFingerprintAfter && iso.mailpitUnchanged === true) {
    return result('R005-A09-live-untouched', RUNTIME_VERDICTS.PASS, 'LIVE/Mailpit OK', 'runtimeRequired');
  }
  return result('R005-A09-live-untouched', RUNTIME_VERDICTS.FAIL, 'LIVE/Mailpit divergents', 'runtimeRequired');
}

const EVALUATORS = [
  evalHttp200,
  evalResponseType,
  evalTtl,
  evalIntentPendingStep,
  evalDraft,
  evalClaimPost,
  evalDeactivate,
  evalSingleMessage,
  evalLive
];

function aggregate(assertionResults) {
  if (assertionResults.some((a) => a.verdict === RUNTIME_VERDICTS.FAIL)) {
    return RUNTIME_VERDICTS.FAIL;
  }
  if (assertionResults.some((a) => a.verdict === RUNTIME_VERDICTS.UNCERTAIN)) {
    return RUNTIME_VERDICTS.UNCERTAIN;
  }
  return RUNTIME_VERDICTS.PASS;
}

function evaluateEvidence(evidence) {
  const assertions = EVALUATORS.map((fn) => fn(evidence));
  return {
    verdict: aggregate(assertions),
    assertions,
    evidenceClassSplit: {
      offlineAlreadyOk: 'see catalog.offlineAlreadyOkSummary / T03',
      runtimeRequired: assertions.map((a) => a.id)
    },
    executedRuntime: false,
    disclaimer:
      'Classifieur catalogue READINESS-005 uniquement. Ne constitue pas une exécution runtime P4G2.'
  };
}

function listOfflineAlreadyOk(catalog) {
  return (catalog && catalog.offlineAlreadyOkSummary) || [];
}

function listRuntimeRequired(catalog) {
  return (catalog && catalog.runtimeRequiredSummary) || [];
}

function catalogCompleteness(catalog) {
  const requiredIds = [
    'R005-A01-http-200',
    'R005-A02-response-type',
    'R005-A03-ttl-renew',
    'R005-A04-intent-pending-step',
    'R005-A05-draft-preserved',
    'R005-A06-claim-zero-post-zero',
    'R005-A07-deactivate',
    'R005-A08-single-message-no-retry',
    'R005-A09-live-untouched'
  ];
  const ids = (catalog.assertions || []).map((a) => a.id);
  const missing = requiredIds.filter((id) => !ids.includes(id));
  const targetOk =
    catalog.target &&
    catalog.target.sessionId === 'rec008-8f2b1-slot-01' &&
    catalog.target.chatInput === 'reprendre' &&
    catalog.target.live === false;
  const noExec = catalog.executed === false && catalog.executeForbiddenUntilAuthorized === true;
  return {
    verdict: missing.length === 0 && targetOk && noExec ? RUNTIME_VERDICTS.PASS : RUNTIME_VERDICTS.FAIL,
    missing,
    targetOk,
    noExec,
    offlineCount: listOfflineAlreadyOk(catalog).length,
    runtimeRequiredCount: listRuntimeRequired(catalog).length
  };
}

module.exports = {
  RUNTIME_VERDICTS,
  CATALOG_REL,
  FIXTURE_REL,
  loadCatalog,
  loadSyntheticEvidence,
  resolveCase,
  evaluateEvidence,
  catalogCompleteness,
  listOfflineAlreadyOk,
  listRuntimeRequired
};
