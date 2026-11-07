'use strict';
const fs = require('fs');
const path = require('path');
const wf = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '..', 'diag-034', 'after-OCD9It1uKFhOoWNF.json'),
    'utf8'
  )
);
const n = wf.nodes.find((x) => x.name === 'Aiguiller tentative');
const conns = wf.connections['Aiguiller tentative'] || {};
const outs = [];
for (const [outType, branches] of Object.entries(conns)) {
  (branches || []).forEach((branch, bi) =>
    (branch || []).forEach((t) => outs.push({ outType, branch: bi, to: t.node }))
  );
}
const rules =
  n.parameters && n.parameters.rules && n.parameters.rules.values
    ? n.parameters.rules.values.map((r, i) => ({
        i,
        outputKey: r.outputKey,
        rightValue:
          r.conditions &&
          r.conditions.conditions &&
          r.conditions.conditions[0] &&
          r.conditions.conditions[0].rightValue,
      }))
    : null;
const out = { rules, outs, options: n.parameters && n.parameters.options };
fs.writeFileSync(path.join(__dirname, 'AIGUILLER-META.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
