'use strict';

/**
 * MISSION 035 — Runner R04 préparé, NON exécuté.
 * Réutilise les protections R01–R03 (warm gate 180s, 1 msg, 0 retry, sessionIdHash, PG before/after,
 * late-write settle, deactivate, hygiene). Refuse toute exécution sans auth runtime distincte.
 *
 * INTERDIT sans mission R04-RUNTIME autorisée :
 * activate · Chat Trigger · Ollama warm réel · seed PG · CLAIM/POST · LIVE
 */

const path = require('path');
const {
  TIMEOUT_AFTER_WARM_MS,
  evaluateOllamaGate,
  timeoutPolicy,
} = require('../runner-021/lib/ollama-gate.cjs');
const {
  hashSessionId,
  correlationEvent,
} = require('../runner-021/lib/postflight-stability.cjs');

const EXPECT = Object.freeze({
  base: 'http://127.0.0.1:5682',
  workflowId: 'OCD9It1uKFhOoWNF',
  versionCounter: 11,
  versionId: 'f5a9181f-ff8d-4301-976e-57add79badae',
  gererSha: '44a7064d12755a84dd256acae90abbf67a778178f9947eec3a36dc0c9abcad3f',
  nodes: 134,
  edges: 137,
  chatTimeoutMs: TIMEOUT_AFTER_WARM_MS,
  messagesPerCampaign: 1,
  retried: false,
  saveDataSuccessExecution: 'none',
  saveDataErrorExecution: 'none',
});

const SCENARIOS = Object.freeze([
  {
    id: 'R04-A',
    sessionId: 'rec008-r04a-035-active-ask-email',
    messageClass: 'email_like_valid_synthetic',
    ttl: 'ACTIVE',
    expectStep: 'ASK_TELEPHONE',
    expectEmailPresent: true,
  },
  {
    id: 'R04-B',
    sessionId: 'rec008-r04b-035-active-ask-email',
    messageClass: 'email_like_invalid',
    ttl: 'ACTIVE',
    expectStep: 'ASK_EMAIL',
    expectEmailPresent: false,
  },
  {
    id: 'R04-C',
    sessionId: 'rec008-r04c-035-expired-ask-email',
    messageClass: 'email_like_valid_synthetic',
    ttl: 'EXPIRED',
    expectStep: 'ASK_EMAIL',
    expectEmailPresent: false,
  },
]);

const ARTIFACT_ALLOW = Object.freeze([
  'emailPresent',
  'emailLen',
  'emailValide',
  'conversationStep',
  'sessionExpired',
  'ttlActive',
  'mockPostsDelta',
  'mockClaimsDelta',
  'sessionIdHash',
]);

function buildCorrelation(scenarioId, sessionId) {
  const crypto = require('crypto');
  const sessionIdHash = hashSessionId(sessionId, (s) =>
    crypto.createHash('sha256').update(s, 'utf8').digest('hex')
  );
  return correlationEvent('r04-prepared', {
    scenarioId,
    sessionIdHash,
    note: 'retried=false',
  });
}

function assertRunnerContractOffline() {
  if (EXPECT.chatTimeoutMs !== 180000) {
    throw new Error('chat timeout must be 180000 after warm');
  }
  if (EXPECT.messagesPerCampaign !== 1 || EXPECT.retried !== false) {
    throw new Error('one message / no retry required');
  }
  if (
    EXPECT.saveDataSuccessExecution !== 'none' ||
    EXPECT.saveDataErrorExecution !== 'none'
  ) {
    throw new Error('default retention must remain none (no open window in 035)');
  }
  const gate = evaluateOllamaGate({
    psBody: { models: [] },
    warmVerified: false,
  });
  // Cold without warm → not ready (expected for stub)
  void gate;
  void timeoutPolicy;
  return {
    ok: true,
    expect: EXPECT,
    scenarios: SCENARIOS.map((s) => ({
      id: s.id,
      sessionIdHash: buildCorrelation(s.id, s.sessionId).sessionIdHash,
      messageClass: s.messageClass,
      ttl: s.ttl,
      expectStep: s.expectStep,
      expectEmailPresent: s.expectEmailPresent,
    })),
    artifactAllow: ARTIFACT_ALLOW,
    executed: false,
  };
}

function runR04Runtime(/* opts */) {
  throw new Error(
    '[R04-RUNTIME-READINESS-035] run-r04-runtime.stub.cjs refuses execution. ' +
      'R04-RUNTIME is NOT_AUTHORIZED. Require explicit human mission + activate auth. ' +
      'No Chat Trigger, no Ollama, no seed apply from this stub.'
  );
}

module.exports = {
  EXPECT,
  SCENARIOS,
  ARTIFACT_ALLOW,
  assertRunnerContractOffline,
  buildCorrelation,
  runR04Runtime,
  TIMEOUT_AFTER_WARM_MS,
};

if (require.main === module) {
  // Offline self-check only — never starts campaign
  const contract = assertRunnerContractOffline();
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        mission: 'R04-RUNTIME-READINESS-035',
        mode: 'stub-selfcheck',
        executed: false,
        r04Runtime: 'NOT_AUTHORIZED',
        contractOk: contract.ok,
        chatTimeoutMs: EXPECT.chatTimeoutMs,
        scenarios: contract.scenarios.map((s) => s.id),
      },
      null,
      2
    )
  );
  try {
    runR04Runtime();
  } catch (e) {
    if (!String(e.message).includes('NOT_AUTHORIZED')) throw e;
  }
}
