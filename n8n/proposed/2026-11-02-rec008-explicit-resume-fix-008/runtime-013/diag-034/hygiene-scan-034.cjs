'use strict';
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const meta = [
  'RESULT.json',
  'PREFLIGHT.json',
  'BACKUP.json',
  'POSTFLIGHT.json',
  'PAYLOAD-META.json',
  'put-response.json',
  'SHA256.json',
];
const secretRe = /rawApiKey|"password"\s*:|REC008_N8N_OWNER_PASSWORD|Bearer\s+[A-Za-z0-9._-]{20,}/;
const hits = [];
for (const f of meta) {
  const p = path.join(dir, f);
  if (!fs.existsSync(p)) continue;
  const t = fs.readFileSync(p, 'utf8');
  if (secretRe.test(t)) hits.push(f);
}
const out = {
  mission: 'W03101-TEST-INSTALL-034',
  metaFilesScanned: meta.filter((f) => fs.existsSync(path.join(dir, f))),
  secretOrCredentialHits: hits,
  verdict: hits.length === 0 ? 'PASS' : 'FAIL',
};
fs.writeFileSync(path.join(dir, 'HYGIENE.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
process.exit(hits.length === 0 ? 0 : 2);
