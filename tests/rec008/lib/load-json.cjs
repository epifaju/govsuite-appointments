'use strict';

const fs = require('fs');
const path = require('path');

const REC008_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(REC008_ROOT, '..', '..');

class LoadJsonError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'LoadJsonError';
    this.code = code;
    if (cause) this.cause = cause;
  }
}

function candidatesFor(input) {
  const raw = String(input || '');
  if (!raw) return [];
  if (path.isAbsolute(raw)) return [raw];

  return [
    path.resolve(process.cwd(), raw),
    path.resolve(PROJECT_ROOT, raw),
    path.resolve(REC008_ROOT, raw),
    path.resolve(REC008_ROOT, raw.replace(/^tests[\\/]+rec008[\\/]+/i, ''))
  ];
}

function loadJson(relOrAbs) {
  const tried = [];
  const list = candidatesFor(relOrAbs);
  if (!list.length) {
    throw new LoadJsonError('EMPTY_PATH', 'Chemin JSON vide');
  }

  let filePath = null;
  for (const candidate of list) {
    tried.push(candidate);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      filePath = candidate;
      break;
    }
  }

  if (!filePath) {
    throw new LoadJsonError(
      'NOT_FOUND',
      'Fichier JSON introuvable: ' + relOrAbs + ' (tried: ' + tried.join(' | ') + ')'
    );
  }

  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new LoadJsonError('READ_ERROR', 'Lecture impossible: ' + filePath, err);
  }

  try {
    return {
      path: filePath,
      data: JSON.parse(text)
    };
  } catch (err) {
    throw new LoadJsonError('INVALID_JSON', 'JSON invalide: ' + filePath, err);
  }
}

module.exports = {
  loadJson,
  LoadJsonError,
  REC008_ROOT,
  PROJECT_ROOT,
  candidatesFor
};
