const fs = require('fs');
const env = fs.readFileSync(
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-10-30-rec008-phase8e2b2-TEST-DEPLOY/.env.rec008-test.local',
  'utf8'
);
const v = (n) => env.match(new RegExp('^' + n + '=(.*)$', 'm'))[1];
const outDir =
  'C:/Open Source PME/govsuite-appointments/n8n/proposed/2026-11-01-rec008-phase8f2b45-POSITIVE-CONFIRMATION-RETRY';

(async () => {
  const base = 'http://127.0.0.1:5682';
  const login = await fetch(base + '/rest/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      emailOrLdapLoginId: v('REC008_N8N_OWNER_EMAIL'),
      password: v('REC008_N8N_OWNER_PASSWORD'),
    }),
  });
  const cookie = (login.headers.getSetCookie ? login.headers.getSetCookie() : [])
    .map((i) => i.split(';')[0])
    .join('; ');
  const h = { cookie, accept: 'application/json' };
  const list = await (
    await fetch(base + '/rest/executions?limit=10&workflowId=OCD9It1uKFhOoWNF', { headers: h })
  ).json();
  const rows = (list.data && list.data.results) || list.data || [];
  const summary = rows.map((r) => ({
    id: r.id,
    status: r.status,
    finished: r.finished,
    mode: r.mode,
    startedAt: r.startedAt,
    stoppedAt: r.stoppedAt,
  }));
  let finaliser = null;
  if (rows[0] && rows[0].id) {
    const detail = await (
      await fetch(base + '/rest/executions/' + rows[0].id + '?includeData=true', { headers: h })
    ).json();
    const exec = detail.data || detail;
    const runData =
      (exec.data && exec.data.resultData && exec.data.resultData.runData) || {};
    const fin = runData['Finaliser état création'] || [];
    const last = fin[fin.length - 1];
    const err = last && last.error ? String(last.error.message || last.error) : null;
    const wfErr =
      exec.data && exec.data.resultData && exec.data.resultData.error
        ? String(exec.data.resultData.error.message || exec.data.resultData.error)
        : null;
    finaliser = {
      executionId: rows[0].id,
      finished: !!exec.finished,
      status: exec.status || rows[0].status,
      nodeNames: Object.keys(runData),
      finaliserRan: fin.length > 0,
      finaliserItems:
        last && last.data && last.data.main && last.data.main[0]
          ? last.data.main[0].length
          : 0,
      finaliserError: err,
      hasParam3Error: !!(err && /no parameter \$3/i.test(err)),
      hasUuidConflict: !!(
        err &&
        (/uuid/i.test(err) || /text.*uuid|uuid.*text/i.test(err))
      ),
      workflowError: wfErr,
    };
  }
  const payload = { count: rows.length, summary, finaliser };
  fs.writeFileSync(outDir + '/FINALISER_EXEC.json', JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
