'use strict';

const fs = require('fs');
const path = require('path');
const { loadJson, LoadJsonError, REC008_ROOT } = require('./load-json.cjs');
const { VERDICTS } = require('./verdicts.cjs');
const { loadVc9Workflow, CRITICAL_NODES, nodeContentSha } = require('./workflow-source.cjs');
const { runSqlContractSuite } = require('./sql-contracts.cjs');
const {
  runIdentityCapture,
  runExpiredFreeText,
  runExplicitResume,
  runAbandon,
  runAwaitConfirmationNoReserve,
  runUncertainResumeFlag,
  runModifyField
} = require('./assertions/vc9-turn.cjs');
const {
  runCollectWithoutConfirm,
  runPositiveOuiClaimGate,
  runSecondOuiSameKey,
  runKeyBodyConflict,
  runDoubleOuiLease,
  runHttp400,
  runHttp409Slot,
  runHttp500,
  runTransportTimeout
} = require('./assertions/coverage-004.cjs');
const {
  runS01AskPrenomActive,
  runS02AskPrenomExpired,
  runS03AskPrenomResumeVc9Actual,
  runS03BriefExpectationsFailAgainstVc9,
  runNegativeExpiredMustNotCapturePrenom
} = require('./assertions/readiness-007-ask-prenom.cjs');
const {
  runR04AValidEmail,
  runR04BInvalidEmail,
  runR04CExpiredAskEmail
} = require('./assertions/readiness-031-r04-email.cjs');
const fix008 = require('./assertions/fix-008-explicit-resume.cjs');

function listScenarioFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const full = path.join(rootDir, entry.name);
    if (entry.isDirectory()) out.push(...listScenarioFiles(full));
    else if (entry.name.endsWith('.json')) out.push(full);
  }
  return out;
}

function timed(fn) {
  const started = Date.now();
  try {
    const result = fn();
    return Object.assign({ durationMs: Date.now() - started }, result);
  } catch (err) {
    return {
      durationMs: Date.now() - started,
      verdict: VERDICTS.ERROR,
      reason: err.message,
      assertions: [],
      nodes: [],
      error: { code: err.code || 'ERROR', message: err.message }
    };
  }
}

function notImplemented(id, reason) {
  return {
    id,
    verdict: VERDICTS.NOT_IMPLEMENTED,
    reason: reason || 'Aucune assertion exécutable branchée',
    assertions: [],
    nodes: [],
    durationMs: 0
  };
}

function skipped(id, reason) {
  return {
    id,
    verdict: VERDICTS.SKIPPED,
    reason: reason || 'Scénario ignoré',
    assertions: [],
    nodes: [],
    durationMs: 0
  };
}

function evaluateScenarioDescriptor(descriptor, ctx) {
  if (!descriptor || !descriptor.id) {
    return {
      id: 'unknown',
      verdict: VERDICTS.ERROR,
      reason: 'Descripteur invalide',
      assertions: [],
      nodes: [],
      durationMs: 0
    };
  }

  if (descriptor.mode && descriptor.mode !== 'offline') {
    return skipped(descriptor.id, 'mode!=' + descriptor.mode + ' — offline only');
  }

  if (descriptor.expects && descriptor.expects.skeletonOnly === true) {
    return {
      id: descriptor.id,
      verdict: VERDICTS.NOT_IMPLEMENTED,
      reason: 'skeletonOnly=true interdit comme PASS — scénario non branché',
      assertions: [],
      nodes: [],
      durationMs: 0
    };
  }

  const handler = descriptor.handler || (descriptor.expects && descriptor.expects.handler);
  if (!handler) {
    return notImplemented(descriptor.id, 'Pas de handler exécutable');
  }

  if (!ctx || !ctx.workflow) {
    return {
      id: descriptor.id,
      verdict: VERDICTS.INCONCLUSIVE,
      reason: 'Workflow VC9 non chargé — preuves insuffisantes',
      assertions: [],
      nodes: [],
      durationMs: 0
    };
  }

  return timed(() => {
    const outcome = dispatchHandler(handler, descriptor, ctx);
    return Object.assign(
      {
        id: descriptor.id,
        family: descriptor.family || null,
        workflowVersionId: ctx.meta.versionId,
        workflowSha256: ctx.meta.sha256,
        handler
      },
      outcome
    );
  });
}

function dispatchHandler(handler, descriptor, ctx) {
  const wf = ctx.workflow;
  switch (handler) {
    case 'sql.contracts': {
      const suite = runSqlContractSuite(wf);
      const assertions = suite.charger.concat(suite.sauvegarder);
      const failed = assertions.some((a) => a.verdict === VERDICTS.FAIL);
      return {
        verdict: failed ? VERDICTS.FAIL : VERDICTS.PASS,
        reason: failed ? 'Contrats SQL VC9 en échec' : 'Contrats SQL Charger/Sauvegarder OK',
        nodes: suite.nodes,
        assertions,
        observed: { staticAnalysis: true }
      };
    }
    case 'ttl.expiredFreeText':
      return runExpiredFreeText(wf);
    case 'ttl.explicitResume':
      return runExplicitResume(wf);
    case 'identity.askNom':
      return runIdentityCapture(wf, 'ASK_NOM', 'Dupont', 'GET_SERVICES', 'nom', 'ASK_PRENOM');
    case 'identity.askPrenom':
      return runIdentityCapture(wf, 'ASK_PRENOM', 'Camille', 'GET_SERVICES', 'prenom', 'ASK_EMAIL');
    case 'identity.askEmail':
      return runIdentityCapture(
        wf,
        'ASK_EMAIL',
        'camille.dupont@example.test',
        'GENERAL',
        'email',
        'ASK_TELEPHONE'
      );
    case 'identity.askTelephone':
      return runIdentityCapture(
        wf,
        'ASK_TELEPHONE',
        '+33000000001',
        'GENERAL',
        'telephone',
        'AWAIT_CREATE_CONFIRMATION'
      );
    case 'confirm.awaitNoReserve':
      return runAwaitConfirmationNoReserve(wf);
    case 'confirm.modifyField':
      return runModifyField(wf);
    case 'confirm.abandon':
      return runAbandon(wf);
    case 'uncertain.resume':
      return runUncertainResumeFlag(wf);
    case 'collect.fullWithoutConfirm':
      return runCollectWithoutConfirm(wf);
    case 'confirm.affirmClaimGate':
      return runPositiveOuiClaimGate(wf);
    case 'idempotence.secondOuiSameKey':
      return runSecondOuiSameKey(wf);
    case 'http.classifyIdempotencyConflict':
      return runKeyBodyConflict(wf);
    case 'concurrency.submittingLease':
      return runDoubleOuiLease(wf);
    case 'http.classify400':
      return runHttp400(wf);
    case 'http.classifySlotUnavailable':
      return runHttp409Slot(wf);
    case 'http.classify500':
      return runHttp500(wf);
    case 'http.classifyTimeout':
      return runTransportTimeout(wf);
    case 'askPrenom.s01Active':
      return runS01AskPrenomActive(wf);
    case 'askPrenom.s02Expired':
      return runS02AskPrenomExpired(wf);
    case 'askPrenom.s03ResumeVc9Actual':
      return runS03AskPrenomResumeVc9Actual(wf);
    case 'askPrenom.s03BriefDivergence':
      return runS03BriefExpectationsFailAgainstVc9(wf);
    case 'askPrenom.negativeExpiredNoPrenom':
      return runNegativeExpiredMustNotCapturePrenom(wf);
    case 'r04.aValidEmail':
      return runR04AValidEmail(wf);
    case 'r04.bInvalidEmail':
      return runR04BInvalidEmail(wf);
    case 'r04.cExpiredAskEmail':
      return runR04CExpiredAskEmail(wf);
    case 'regression.markers': {
      const assertions = CRITICAL_NODES.map((name) => {
        const sha = nodeContentSha(wf, name);
        return {
          id: 'node_sha_' + name,
          expected: 'sha256 present',
          observed: sha.slice(0, 16),
          verdict: sha && sha.length === 64 ? VERDICTS.PASS : VERDICTS.FAIL
        };
      });
      const codeChecks = [
        {
          name: 'Parser intention',
          needle: 'P4E/P4F START PARSER'
        },
        {
          name: 'Gérer collecte progressive',
          needle: 'P4E/P4F START GERER'
        },
        {
          name: 'Réponse générale',
          needle: 'session_expired'
        }
      ];
      for (const c of codeChecks) {
        const node = wf.nodes.find((n) => n.name === c.name);
        const code = (node && node.parameters && (node.parameters.jsCode || node.parameters.query)) || '';
        assertions.push({
          id: 'marker_' + c.name,
          expected: c.needle,
          observed: code.includes(c.needle),
          verdict: code.includes(c.needle) ? VERDICTS.PASS : VERDICTS.FAIL
        });
      }
      const failed = assertions.some((a) => a.verdict === VERDICTS.FAIL);
      return {
        verdict: failed ? VERDICTS.FAIL : VERDICTS.PASS,
        reason: failed ? 'Markers/SHA VC9 incomplets' : 'Markers VC9 présents sur nœuds critiques',
        nodes: CRITICAL_NODES,
        assertions
      };
    }
    default:
      return notImplemented(descriptor.id, 'Handler inconnu: ' + handler);
  }
}

function loadScenario(filePath) {
  try {
    const loaded = loadJson(filePath);
    return { ok: true, descriptor: loaded.data, path: loaded.path };
  } catch (err) {
    if (err instanceof LoadJsonError) {
      return {
        ok: false,
        error: err,
        result: {
          id: path.basename(filePath, '.json'),
          verdict: err.code === 'INVALID_JSON' ? VERDICTS.ERROR : VERDICTS.ERROR,
          reason: err.message,
          assertions: [],
          nodes: [],
          durationMs: 0
        }
      };
    }
    throw err;
  }
}

function createVc9Context() {
  const loaded = loadVc9Workflow();
  return {
    workflow: loaded.workflow,
    meta: {
      label: loaded.label,
      path: loaded.path,
      sha256: loaded.sha256,
      versionId: loaded.versionId
    }
  };
}

module.exports = {
  listScenarioFiles,
  loadJson,
  LoadJsonError,
  evaluateScenarioDescriptor,
  loadScenario,
  createVc9Context,
  notImplemented,
  skipped,
  REC008_ROOT,
  VERDICTS
};
