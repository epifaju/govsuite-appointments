const fs = require('fs');
const { randomUUID } = require('crypto');

const envText = fs.readFileSync(
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-30-rec008-phase8e2b2-TEST-DEPLOY/.env.rec008-test.local',
  'utf8'
);
const value = (n) => envText.match(new RegExp('^' + n + '=(.*)$', 'm'))[1];
const base = 'http://127.0.0.1:5682';
const outDir =
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-31-rec008-phase8f2b24-FINALIZATION-RUNTIME';

(async () => {
  const login = await fetch(base + '/rest/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      emailOrLdapLoginId: value('REC008_N8N_OWNER_EMAIL'),
      password: value('REC008_N8N_OWNER_PASSWORD'),
    }),
  });
  const cookie = (login.headers.getSetCookie ? login.headers.getSetCookie() : [])
    .map((i) => i.split(';')[0])
    .join('; ');
  const session = { cookie, accept: 'application/json', 'content-type': 'application/json' };

  const listed =
    (await (await fetch(base + '/rest/workflows?limit=100', { headers: session })).json()).data || [];
  for (const w of listed) {
    if (/REC008-8F2B24/.test(w.name)) {
      if (!w.isArchived) {
        await fetch(base + '/rest/workflows/' + w.id + '/archive', { method: 'POST', headers: session });
      }
      await fetch(base + '/rest/workflows/' + w.id, { method: 'DELETE', headers: session });
    }
  }

  const main = (await (await fetch(base + '/rest/workflows/OCD9It1uKFhOoWNF', { headers: session })).json()).data;
  const finaliser = main.nodes.find((n) => n.name === 'Finaliser état création');
  const body = {
    name: 'REC008-8F2B24-DEBUG3',
    nodes: [
      {
        id: randomUUID(),
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        typeVersion: 1,
        position: [0, 0],
        parameters: {},
      },
      {
        id: randomUUID(),
        name: "Lorsqu'un message de chat est reçu",
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [220, 0],
        parameters: {
          jsCode: "return [{ json: { sessionId: 'rec008-8f2b24-dry-nonexistent' } }];",
        },
      },
      {
        id: randomUUID(),
        name: 'Paramètres clôture confirmation',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [440, 0],
        parameters: {
          jsCode:
            "return [{ json: { appointmentReference: 'REC008-RUNTIME-DRY-000', appointment: { reference: 'REC008-RUNTIME-DRY-000' } } }];",
        },
      },
      {
        id: randomUUID(),
        name: 'Finaliser état création',
        type: 'n8n-nodes-base.postgres',
        typeVersion: 2.7,
        position: [660, 0],
        parameters: JSON.parse(JSON.stringify(finaliser.parameters)),
        credentials: JSON.parse(JSON.stringify(finaliser.credentials)),
      },
    ],
    connections: {
      'Manual Trigger': {
        main: [[{ node: "Lorsqu'un message de chat est reçu", type: 'main', index: 0 }]],
      },
      "Lorsqu'un message de chat est reçu": {
        main: [[{ node: 'Paramètres clôture confirmation', type: 'main', index: 0 }]],
      },
      'Paramètres clôture confirmation': {
        main: [[{ node: 'Finaliser état création', type: 'main', index: 0 }]],
      },
    },
    settings: { executionOrder: 'v1' },
  };

  const created = await (
    await fetch(base + '/rest/workflows', {
      method: 'POST',
      headers: session,
      body: JSON.stringify(body),
    })
  ).json();
  const wf = created.data || created;
  console.log('created', wf.id, 'active', wf.active);

  const runPayload = {
    triggerToStartFrom: { name: 'Manual Trigger' },
    destinationNode: { nodeName: 'Finaliser état création', mode: 'inclusive' },
  };
  const run = await fetch(base + '/rest/workflows/' + wf.id + '/run', {
    method: 'POST',
    headers: session,
    body: JSON.stringify(runPayload),
  });
  const runText = await run.text();
  console.log('RUN', run.status, runText.slice(0, 1500));
  fs.writeFileSync(outDir + '/debug-run3-result.json', runText);

  let runJson = {};
  try {
    runJson = JSON.parse(runText);
  } catch {}
  const executionId =
    runJson.executionId ||
    (runJson.data && runJson.data.executionId) ||
    (runJson.data && runJson.data.id);

  if (executionId) {
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const ex = await fetch(base + '/rest/executions/' + executionId + '?includeData=true', {
        headers: session,
      });
      const et = await ex.text();
      console.log('EX', i, ex.status, et.slice(0, 400));
      fs.writeFileSync(outDir + '/debug-exec.json', et);
      try {
        const ej = JSON.parse(et);
        const data = ej.data || ej;
        if (data.finished || data.status === 'success' || data.status === 'error') break;
      } catch {}
    }
  }

  await fetch(base + '/rest/workflows/' + wf.id + '/archive', { method: 'POST', headers: session });
  await fetch(base + '/rest/workflows/' + wf.id, { method: 'DELETE', headers: session });
  console.log('cleaned');
})().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
