'use strict';

/**
 * W-031-01 — correctif minimal (aligné diag-032 / PATCH-NOTE).
 * Zone: sessionExpired && !explicitResumeMsg uniquement.
 * Champs: nom, prenom, email, telephone — retirer ?? x.*
 * Branche reprendre: inchangée.
 */

function patchExpiredIdentityFallbacks(code) {
  const start = code.indexOf('const sessionExpiredFlag');
  const endMarker = '// --- P4E/P4F END GERER ---';
  const end = code.indexOf(endMarker);
  if (start < 0 || end < 0) {
    const err = new Error('W03101_MARKERS_MISSING');
    err.code = 'W03101_MARKERS_MISSING';
    throw err;
  }
  const head = code.slice(0, start);
  let mid = code.slice(start, end);
  const tail = code.slice(end);

  // Only the non-resume return block (first occurrence of identity coalesce cluster)
  const nonResumeAnchor = 'if (!explicitResumeMsg)';
  const anchorIdx = mid.indexOf(nonResumeAnchor);
  if (anchorIdx < 0) {
    const err = new Error('W03101_NON_RESUME_MISSING');
    err.code = 'W03101_NON_RESUME_MISSING';
    throw err;
  }
  // Limit to first return's json identity fields: until refreshSessionTtl: false in that block
  const blockStart = anchorIdx;
  const refreshIdx = mid.indexOf('refreshSessionTtl: false', blockStart);
  if (refreshIdx < 0) {
    const err = new Error('W03101_NON_RESUME_BLOCK_MISSING');
    err.code = 'W03101_NON_RESUME_BLOCK_MISSING';
    throw err;
  }
  const before = mid.slice(0, blockStart);
  let block = mid.slice(blockStart, refreshIdx);
  const after = mid.slice(refreshIdx);

  const replacements = [
    [/nom:\s*previous\.nom \?\? x\.nom \?\? null/g, 'nom: previous.nom ?? null'],
    [/prenom:\s*previous\.prenom \?\? x\.prenom \?\? null/g, 'prenom: previous.prenom ?? null'],
    [/email:\s*previous\.email \?\? x\.email \?\? null/g, 'email: previous.email ?? null'],
    [/telephone:\s*previous\.telephone \?\? x\.telephone \?\? null/g, 'telephone: previous.telephone ?? null']
  ];
  let count = 0;
  for (const [re, rep] of replacements) {
    const n = (block.match(re) || []).length;
    count += n;
    block = block.replace(re, rep);
  }
  mid = before + block + after;
  return { code: head + mid + tail, count };
}

function applyW03101ToWorkflow(workflow) {
  const node = workflow.nodes.find((n) => n.name === 'Gérer collecte progressive');
  if (!node || !node.parameters || !node.parameters.jsCode) {
    const err = new Error('GERER_NODE_MISSING');
    err.code = 'GERER_NODE_MISSING';
    throw err;
  }
  const before = node.parameters.jsCode;
  const { code, count } = patchExpiredIdentityFallbacks(before);
  if (count !== 4) {
    const err = new Error('W03101_EXPECTED_4_GOT_' + count);
    err.code = 'W03101_COUNT';
    throw err;
  }
  const cloned = JSON.parse(JSON.stringify(workflow));
  const g = cloned.nodes.find((n) => n.name === 'Gérer collecte progressive');
  g.parameters.jsCode = code;
  return { workflow: cloned, replacements: count, beforeCode: before, afterCode: code };
}

module.exports = {
  patchExpiredIdentityFallbacks,
  applyW03101ToWorkflow
};
