const fs = require('fs');
const { randomUUID } = require('crypto');

const envText = fs.readFileSync(
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-30-rec008-phase8e2b2-TEST-DEPLOY/.env.rec008-test.local',
  'utf8'
);
const value = (n) => envText.match(new RegExp('^' + n + '=(.*)$', 'm'))[1];
const base = 'http://127.0.0.1:5682';

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

  const main = (await (await fetch(base + '/rest/workflows/OCD9It1uKFhOoWNF', { headers: session })).json()).data;
  const finaliser = main.nodes.find((n) => n.name === 'Finaliser état création');

  const body = {
    name: 'REC008-8F2B24-DEBUG-EPHEMERAL',
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

  fs.writeFileSync(
    'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-31-rec008-phase8f2b24-FINALIZATION-RUNTIME/debug-body.json',
    JSON.stringify(body, null, 2)
  );

  const created = await fetch(base + '/rest/workflows', {
    method: 'POST',
    headers: session,
    body: JSON.stringify(body),
  });
  const createdText = await created.text();
  console.log('CREATE', created.status, createdText.slice(0, 1500));
  let wf;
  try {
    wf = JSON.parse(createdText).data || JSON.parse(createdText);
  } catch {
    process.exit(1);
  }
  console.log('ID', wf.id, 'active', wf.active);

  const runBody = {
    workflowData: {
      id: wf.id,
      name: wf.name,
      nodes: wf.nodes,
      connections: wf.connections,
      settings: wf.settings || { executionOrder: 'v1' },
      active: false,
    },
  };
  const run = await fetch(base + '/rest/workflows/run', {
    method: 'POST',
    headers: session,
    body: JSON.stringify(runBody),
  });
  const runText = await run.text();
  console.log('RUN', run.status, runText.slice(0, 2500));
  fs.writeFileSync(
    'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-31-rec008-phase8f2b24-FINALIZATION-RUNTIME/debug-run.json',
    runText
  );

  const del = await fetch(base + '/rest/workflows/' + wf.id, { method: 'DELETE', headers: session });
  console.log('DELETE', del.status, (await del.text()).slice(0, 300));
})().catch((e) => {
  console.error('ERR', e.name, e.message, e.cause);
  process.exit(1);
});
