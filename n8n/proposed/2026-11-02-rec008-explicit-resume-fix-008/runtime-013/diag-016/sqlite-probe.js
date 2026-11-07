'use strict';
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/home/node/.n8n/database.sqlite', { readOnly: true });
const out = { tables: [], executions: [], settings: [], workflowActive: null };

out.tables = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE '%execution%' OR name LIKE '%workflow%') ORDER BY name",
  )
  .all();

try {
  out.executions = db
    .prepare(
      "SELECT id, workflowId, finished, mode, status, startedAt, stoppedAt FROM execution_entity WHERE workflowId = ? ORDER BY startedAt DESC LIMIT 30",
    )
    .all('OCD9It1uKFhOoWNF');
} catch (e) {
  out.executionsError = String(e.message || e);
}

try {
  const cnt = db.prepare('SELECT count(*) AS c FROM execution_entity').get();
  out.executionEntityTotal = cnt.c;
} catch (e) {
  out.executionEntityTotalError = String(e.message || e);
}

try {
  out.settings = db
    .prepare(
      "SELECT key, value FROM settings WHERE key LIKE '%save%' OR key LIKE '%execut%' OR key LIKE '%prun%' OR key LIKE '%timeout%'",
    )
    .all();
} catch (e) {
  out.settingsError = String(e.message || e);
}

try {
  out.workflowRow = db
    .prepare(
      'SELECT id, name, active, versionId FROM workflow_entity WHERE id = ?',
    )
    .get('OCD9It1uKFhOoWNF');
} catch (e) {
  out.workflowRowError = String(e.message || e);
}

console.log(JSON.stringify(out, null, 2));
