const wf = require('C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-30-rec008-phase8f2b3-SLOT-FIX-INSTALL/after-OCD9It1uKFhOoWNF.json');
const get = (n) => wf.nodes.find((x) => x.name === n);

const aigu = get('Aiguiller tentative');
const rules = aigu.parameters.rules.values || [];
console.log('=== Aiguiller rule order ===');
rules.forEach((r, i) => {
  const cond = (((r.conditions || {}).conditions) || [])[0] || {};
  console.log(i, r.outputKey, cond.leftValue, cond.rightValue);
});
console.log('fallback?', JSON.stringify(aigu.parameters.options || aigu.parameters.fallbackOutput || null));

const decide = get('Décider action tentative');
console.log('\n=== Décider action tentative ===');
console.log(decide.parameters.jsCode);

const dem = get('Demander paramètres création');
console.log('\n=== Demander contains missing/validation? ===');
console.log(/missing|validation|slotIdValide/.test(dem.parameters.jsCode));
console.log('Demander tail:\n', dem.parameters.jsCode.slice(-1200));

// Who else produces missing array
console.log('\n=== Nodes producing missing/slotIdValide ===');
for (const n of wf.nodes) {
  const code = (n.parameters && n.parameters.jsCode) || '';
  if (/slotIdValide|missing\.push/.test(code)) {
    console.log('-', n.name);
  }
}

// Check if Demander path receives pre-validated json from Gérer
const ger = get('Gérer collecte progressive');
console.log('\n=== Gérer produces missing? ===', /missing|validation/.test(ger.parameters.jsCode));
const idx = ger.parameters.jsCode.indexOf('attemptAction');
console.log(ger.parameters.jsCode.slice(idx, idx + 800));

// Final response formatter for create
for (const n of wf.nodes) {
  const code = (n.parameters && n.parameters.jsCode) || '';
  if (/create_appointment_question|conversationStep/.test(code) && /missing/.test(code)) {
    console.log('\nFormatter:', n.name);
    console.log(code.slice(0, 800));
  }
}
