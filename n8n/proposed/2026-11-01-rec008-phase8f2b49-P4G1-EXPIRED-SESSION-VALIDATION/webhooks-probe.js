const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/home/node/.n8n/database.sqlite', { readOnly: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '%webhook%'").all();
const output = { tables };
if (tables.some((table) => table.name === 'webhook_entity')) {
  output.columns = db.prepare("SELECT name FROM pragma_table_info('webhook_entity')").all().map((column) => column.name);
  output.rows = db.prepare('SELECT * FROM webhook_entity').all();
}
console.log(JSON.stringify(output));
