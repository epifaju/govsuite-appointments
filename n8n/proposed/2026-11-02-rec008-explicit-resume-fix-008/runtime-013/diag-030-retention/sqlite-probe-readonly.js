/* MISSION 030 — lecture seule — ne pas écrire dans sqlite */
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/home/node/.n8n/database.sqlite', { readOnly: true });

const tables = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%execution%' ORDER BY 1",
  )
  .all()
  .map((r) => r.name);

const columns = db
  .prepare('PRAGMA table_info(execution_entity)')
  .all()
  .map((r) => r.name);

const execution_entity = db.prepare('SELECT count(*) AS c FROM execution_entity').get().c;

let softDeleted = null;
if (columns.includes('deletedAt')) {
  softDeleted = db
    .prepare('SELECT count(*) AS c FROM execution_entity WHERE deletedAt IS NOT NULL')
    .get().c;
}

let byStatus = [];
if (columns.includes('status')) {
  byStatus = db
    .prepare('SELECT status, count(*) AS c FROM execution_entity GROUP BY status')
    .all();
}

let relatedCounts = {};
for (const t of tables) {
  try {
    relatedCounts[t] = db.prepare(`SELECT count(*) AS c FROM ${t}`).get().c;
  } catch (e) {
    relatedCounts[t] = 'err:' + String(e.message || e).slice(0, 80);
  }
}

console.log(
  JSON.stringify(
    {
      tables,
      columns,
      execution_entity,
      softDeleted,
      byStatus,
      relatedCounts,
    },
    null,
    2,
  ),
);
