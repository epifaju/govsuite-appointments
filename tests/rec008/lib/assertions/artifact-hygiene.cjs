'use strict';

/**
 * MISSION 031 — Scanner hygiene artefacts R04+
 * Ne log jamais la valeur sensible détectée (uniquement patternId / stopCode / offset).
 * Hors ligne uniquement. Ne lit jamais LIVE / .env / credentials.
 */

const fs = require('fs');
const path = require('path');
const { loadJson, REC008_ROOT, PROJECT_ROOT } = require('../load-json.cjs');
const { VERDICTS } = require('../verdicts.cjs');

const CATALOGUE_REL = 'readiness/R030-r04-prep-artifact-hygiene.json';

const EXIT = Object.freeze({
  PASS: 0,
  FAIL: 1,
  UNCERTAIN: 2
});

function normPath(p) {
  return String(p || '').replace(/\\/g, '/');
}

function loadCatalogue(overridePath) {
  const loaded = loadJson(overridePath || path.join(REC008_ROOT, CATALOGUE_REL));
  return loaded.data;
}

function compilePatterns(catalogue) {
  return (catalogue.patterns || []).map((p) => {
    let flags = 'g';
    let source = p.regex;
    if (source.startsWith('(?i)')) {
      flags = 'gi';
      source = source.slice(4);
    }
    return {
      id: p.id,
      class: p.class,
      stopCode: p.stopCode,
      onMatch: p.onMatch || 'FAIL',
      re: new RegExp(source, flags)
    };
  });
}

function matchGlobSimple(filePath, globPattern) {
  const f = normPath(filePath);
  const g = normPath(globPattern);
  // Support ** and * only (repo-local globs); also allow substring match for **/prefix
  const escaped = g
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '§§')
    .replace(/\*/g, '[^/]*')
    .replace(/§§/g, '.*');
  const re = new RegExp('^' + escaped + '$', 'i');
  if (re.test(f)) return true;
  // trailing /** means "under this directory"
  if (g.endsWith('/**')) {
    const prefix = g.slice(0, -3);
    if (f === prefix || f.startsWith(prefix + '/')) return true;
  }
  return false;
}

function pathMatchesAny(filePath, globs) {
  const raw = String(filePath || '');
  const abs = path.isAbsolute(raw)
    ? path.resolve(raw)
    : path.resolve(PROJECT_ROOT, raw);
  const fAbs = normPath(abs);
  const relFromRoot = normPath(path.relative(PROJECT_ROOT, abs));
  const relFromRec = normPath(path.relative(REC008_ROOT, abs));
  const base = path.basename(abs);
  const candidates = [normPath(raw), fAbs, relFromRoot, relFromRec, 'tests/rec008/' + relFromRec];

  for (const g of globs || []) {
    const gn = normPath(g);
    for (const c of candidates) {
      if (matchGlobSimple(c, gn)) return true;
      if (matchGlobSimple(c, '**/' + gn.replace(/^\*\*\//, ''))) return true;
    }
    // basename helpers for R04 reports
    if (/R04-\*/i.test(gn) && /^R04-/i.test(base)) return true;
    if (/\*r04\*/i.test(gn) && /r04/i.test(fAbs)) return true;
    // neverRead .env*
    if (gn === '.env*' && /^\.env/i.test(base)) return true;
    if (gn.includes('*credentials*') && /credentials/i.test(fAbs)) return true;
    if (gn.includes('live-exports') && /live-exports/i.test(fAbs)) return true;
  }
  return false;
}

function classifyPath(filePath, catalogue) {
  const scope = catalogue.scope || {};
  if (pathMatchesAny(filePath, scope.neverRead)) {
    return { kind: 'NEVER_READ', scan: false };
  }
  if (pathMatchesAny(filePath, scope.fixtureAllowlistGlobs)) {
    return { kind: 'FIXTURE_ALLOW', scan: false, allowCleartextSynthetic: true };
  }
  if (pathMatchesAny(filePath, scope.excludeHistoricalDebtB9)) {
    return { kind: 'HISTORICAL_B9', scan: false, skip: true };
  }
  // Explicit R01–R03 artifact paths (never rewrite / never FAIL for debt)
  const n = normPath(filePath);
  if (
    /artifacts-r0[123]-/i.test(n) ||
    /\/R0[123][-_]/i.test(n) ||
    /reports\/R0[123]-/i.test(n)
  ) {
    return { kind: 'HISTORICAL_R0X', scan: false, skip: true };
  }
  if (pathMatchesAny(filePath, scope.scanIncludeGlobs)) {
    return { kind: 'SCAN_TARGET', scan: true };
  }
  // Default: treat as scan target if caller forced content scan
  return { kind: 'UNSPECIFIED', scan: true };
}

/**
 * Scan text content. Never returns matched plaintext.
 */
function scanText(text, patterns, meta) {
  const findings = [];
  const src = String(text || '');
  for (const p of patterns) {
    p.re.lastIndex = 0;
    let m;
    while ((m = p.re.exec(src)) !== null) {
      findings.push({
        patternId: p.id,
        class: p.class,
        stopCode: p.stopCode,
        onMatch: p.onMatch,
        offset: m.index,
        matchLen: m[0] ? m[0].length : 0,
        // intentional: no matchedValue
        path: meta && meta.path ? meta.path : null,
        label: meta && meta.label ? meta.label : null
      });
      if (m[0].length === 0) p.re.lastIndex += 1;
      // first hit per pattern enough for fail-fast callers
      if (meta && meta.firstOnly) break;
    }
  }
  return findings;
}

function scanContent(content, catalogue, meta) {
  const patterns = compilePatterns(catalogue);
  const findings = scanText(content, patterns, meta || {});
  if (!findings.length) {
    return {
      verdict: VERDICTS.PASS,
      stopCode: null,
      findings: [],
      scanned: true
    };
  }
  return {
    verdict: VERDICTS.FAIL,
    stopCode: findings[0].stopCode,
    findings,
    scanned: true
  };
}

function scanFile(filePath, catalogue, options) {
  const opts = options || {};
  const cat = catalogue || loadCatalogue();
  const classification = classifyPath(filePath, cat);

  if (classification.kind === 'NEVER_READ') {
    return {
      path: filePath,
      classification: classification.kind,
      verdict: VERDICTS.PASS,
      reason: 'never-read-skipped',
      findings: [],
      scanned: false
    };
  }

  if (classification.skip) {
    return {
      path: filePath,
      classification: classification.kind,
      verdict: VERDICTS.SKIPPED,
      reason: 'historical-or-debt-excluded',
      findings: [],
      scanned: false
    };
  }

  if (classification.allowCleartextSynthetic && !opts.forceScanFixtures) {
    return {
      path: filePath,
      classification: classification.kind,
      verdict: VERDICTS.PASS,
      reason: 'fixture-allowlist',
      findings: [],
      scanned: false
    };
  }

  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    return {
      path: filePath,
      classification: classification.kind,
      verdict: 'UNCERTAIN',
      reason: 'unreadable:' + (err.code || 'ERR'),
      findings: [],
      scanned: false,
      incomplete: true
    };
  }

  const result = scanContent(text, cat, {
    path: filePath,
    label: opts.label || path.basename(filePath),
    firstOnly: opts.firstOnly !== false
  });

  return Object.assign(
    {
      path: filePath,
      classification: classification.kind,
      reason: result.verdict === VERDICTS.PASS ? 'clean' : result.stopCode
    },
    result
  );
}

/**
 * Aggregate paths → global verdict.
 * Any FAIL → FAIL; any incomplete → UNCERTAIN (unless FAIL already);
 * all SKIP/PASS → PASS if at least one scanned PASS or only skips with allowEmpty.
 */
function aggregateResults(results) {
  const list = results || [];
  let fail = 0;
  let uncertain = 0;
  let pass = 0;
  let skipped = 0;
  for (const r of list) {
    if (r.verdict === VERDICTS.FAIL) fail += 1;
    else if (r.verdict === 'UNCERTAIN' || r.incomplete) uncertain += 1;
    else if (r.verdict === VERDICTS.SKIPPED) skipped += 1;
    else if (r.verdict === VERDICTS.PASS) pass += 1;
    else uncertain += 1;
  }
  let verdict = VERDICTS.PASS;
  if (fail > 0) verdict = VERDICTS.FAIL;
  else if (uncertain > 0) verdict = 'UNCERTAIN';
  else if (pass === 0 && skipped > 0) verdict = VERDICTS.SKIPPED;

  return {
    verdict,
    exitCode:
      verdict === VERDICTS.FAIL
        ? EXIT.FAIL
        : verdict === 'UNCERTAIN'
          ? EXIT.UNCERTAIN
          : EXIT.PASS,
    counts: { fail, uncertain, pass, skipped, total: list.length },
    results: list.map((r) => ({
      path: r.path,
      classification: r.classification,
      verdict: r.verdict,
      reason: r.reason,
      findingCount: (r.findings || []).length,
      // findings without values
      findings: (r.findings || []).map((f) => ({
        patternId: f.patternId,
        stopCode: f.stopCode,
        offset: f.offset,
        matchLen: f.matchLen
      }))
    }))
  };
}

function safeLogFinding(finding) {
  // Never print match text
  return (
    '[hygiene] ' +
    (finding.patternId || '?') +
    ' stop=' +
    (finding.stopCode || '?') +
    ' offset=' +
    (finding.offset != null ? finding.offset : '?') +
    ' len=' +
    (finding.matchLen != null ? finding.matchLen : '?')
  );
}

module.exports = {
  EXIT,
  CATALOGUE_REL,
  loadCatalogue,
  compilePatterns,
  classifyPath,
  scanText,
  scanContent,
  scanFile,
  aggregateResults,
  safeLogFinding,
  matchGlobSimple,
  pathMatchesAny,
  VERDICTS
};
