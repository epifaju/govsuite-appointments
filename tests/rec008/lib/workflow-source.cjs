'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PROJECT_ROOT } = require('./load-json.cjs');
const { assertAllowedRead } = require('./security-guard.cjs');

const DEFAULT_VC9_REL = path.join(
  'n8n',
  'proposed',
  '2026-11-01-rec008-phase8f2b49-P4F-TTL-FIX-TEST-INSTALL',
  'after-OCD9It1uKFhOoWNF.json'
);

const EXPECTED_SHA256 =
  '6284f867054879d00292b45b5a8560f25dc778a56979ea354b18af2f5f82b889';

const EXPECTED_VERSION_ID = 'e7867799-2a18-4aec-9ee5-3ba9cbc40766';

const CRITICAL_NODES = [
  'Charger état conversation',
  'Joindre tentative de session',
  'Parser intention',
  'Fusionner état conversation',
  'Gérer collecte progressive',
  'Réponse générale',
  'Sauvegarder état conversation'
];

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function loadVc9Workflow(options) {
  const opts = options || {};
  const abs = path.resolve(PROJECT_ROOT, opts.relativePath || DEFAULT_VC9_REL);
  assertAllowedRead(abs);
  const sha = sha256File(abs);
  if (!opts.skipShaCheck && sha !== EXPECTED_SHA256) {
    const err = new Error(
      'VC9 SHA mismatch: expected ' + EXPECTED_SHA256 + ' got ' + sha
    );
    err.code = 'VC9_SHA_MISMATCH';
    throw err;
  }
  const workflow = JSON.parse(fs.readFileSync(abs, 'utf8'));
  if (!opts.skipVersionCheck && workflow.versionId !== EXPECTED_VERSION_ID) {
    const err = new Error(
      'VC9 versionId mismatch: expected ' +
        EXPECTED_VERSION_ID +
        ' got ' +
        workflow.versionId
    );
    err.code = 'VC9_VERSION_MISMATCH';
    throw err;
  }
  return {
    path: abs,
    sha256: sha,
    versionId: workflow.versionId,
    workflow,
    label: 'VC9'
  };
}

function nodeByName(workflow, name) {
  const node = workflow.nodes.find((n) => n.name === name);
  if (!node) {
    const err = new Error('Nœud absent: ' + name);
    err.code = 'NODE_MISSING';
    throw err;
  }
  return node;
}

function codeOf(workflow, name) {
  const node = nodeByName(workflow, name);
  if (!node.parameters || !node.parameters.jsCode) {
    const err = new Error('jsCode absent: ' + name);
    err.code = 'NODE_NO_JS';
    throw err;
  }
  return node.parameters.jsCode;
}

function queryOf(workflow, name) {
  const node = nodeByName(workflow, name);
  if (!node.parameters || !node.parameters.query) {
    const err = new Error('query absente: ' + name);
    err.code = 'NODE_NO_SQL';
    throw err;
  }
  return node.parameters.query;
}

function nodeContentSha(workflow, name) {
  const node = nodeByName(workflow, name);
  const content =
    (node.parameters && (node.parameters.jsCode || node.parameters.query)) || '';
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

module.exports = {
  DEFAULT_VC9_REL,
  EXPECTED_SHA256,
  EXPECTED_VERSION_ID,
  CRITICAL_NODES,
  loadVc9Workflow,
  nodeByName,
  codeOf,
  queryOf,
  nodeContentSha,
  sha256File
};
