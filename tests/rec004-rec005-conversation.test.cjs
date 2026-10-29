'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = 'C:\\Open Source PME\\govsuite-appointments';
const workflowPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(root, 'n8n', 'live-exports', '2026-10-28-rec003', 'R7TKt5mqZYpeKapl.json');

const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
const codeOf = (name) => {
  const node = workflow.nodes.find((item) => item.name === name);
  if (!node || !node.parameters.jsCode) throw new Error('Script absent : ' + name);
  return node.parameters.jsCode;
};
const saveQuery = workflow.nodes.find((item) => item.name === 'Sauvegarder état conversation').parameters.query;
const availabilityParams = workflow.nodes
  .find((item) => item.name === 'Appeler GetAvailability')
  .parameters.queryParameters.parameters.map((item) => item.name);

const CREATE = 'Je souhaite prendre rendez-vous pour renouveler mon passeport.';
const SLOT_1 = '11111111-1111-4111-8111-111111111111';
const SLOT_2 = '22222222-2222-4222-8222-222222222222';
const slots = [
  { index: 1, id: SLOT_1, service: 'PASSEPORT', site: 'PARIS', debut: '2026-11-02T09:00:00.000Z', fin: '2026-11-02T09:20:00.000Z' },
  { index: 2, id: SLOT_2, service: 'PASSEPORT', site: 'PARIS', debut: '2026-11-02T09:20:00.000Z', fin: '2026-11-02T09:40:00.000Z' }
];

function run(script, json, nodes) {
  const lookup = (name) => {
    if (!Object.prototype.hasOwnProperty.call(nodes, name)) throw new Error('Noeud absent : ' + name);
    return { item: { json: nodes[name] } };
  };
  const result = new Function('$json', '$', script)(json, lookup);
  if (!result || !result[0] || !result[0].json) throw new Error('Retour invalide');
  return result[0].json;
}

function previousOf(sessionId, fields) {
  return {
    session_id: sessionId,
    pending_action: fields.pending ?? null,
    conversation_step: fields.step ?? null,
    intent: fields.pending ?? null,
    service: fields.service ?? null,
    site: fields.site ?? null,
    date_debut: fields.dateDebut ?? null,
    date_fin: fields.dateFin ?? null,
    slot_id: fields.slotId ?? null,
    token: fields.token ? '33333333-3333-4333-8333-333333333333' : null,
    new_slot_id: fields.newSlotId ?? null,
    reference: fields.reference ?? null,
    nom: fields.nom ?? null,
    prenom: fields.prenom ?? null,
    email: fields.email ?? null,
    telephone: fields.telephone ?? null,
    available_slots: fields.slots || [],
    selected_slot_index: fields.index ?? null,
    last_user_message: 'tour precedent'
  };
}

function turn(sessionId, previous, message, llmText) {
  const trigger = { chatInput: message, sessionId };
  const parser = run(codeOf('Parser intention'), { text: llmText || '{}' }, {
    "Lorsqu'un message de chat est reçu": trigger,
    'Charger état conversation': previous
  });
  const fusion = run(codeOf('Fusionner état conversation'), parser, {
    'Charger état conversation': previous
  });
  const collecte = run(codeOf('Gérer collecte progressive'), fusion, {
    'Charger état conversation': previous,
    'Parser intention': parser
  });
  return { parser, fusion, collecte };
}

function replyFor(state, previous) {
  const intent = state.intent;
  const base = {
    branch: intent,
    wouldMutate: null,
    calledHttp: false,
    tokenNull: state.token == null,
    text: null,
    ready: null
  };

  if (intent === 'GENERAL' || !intent) {
    base.text = run(codeOf('Réponse générale'), state, {}).text;
    return base;
  }

  if (intent === 'GET_AVAILABILITY') {
    const validated = run(codeOf('Valider paramètres disponibilité'), state, {});
    base.ready = validated.ready === true;
    base.tokenNull = validated.token == null;
    base.tokenKeyPresent = Object.prototype.hasOwnProperty.call(validated, 'token');
    base.httpParams = availabilityParams.slice();
    if (!validated.ready) {
      base.text = run(codeOf('Demander paramètres disponibilité'), validated, {}).text;
    }
    return base;
  }

  if (intent === 'CREATE_APPOINTMENT') {
    const validated = run(codeOf('Valider paramètres création'), state, {});
    base.ready = validated.ready === true;
    base.replyStep = validated.conversationStep;
    if (!validated.ready) {
      base.text = run(codeOf('Demander paramètres création'), validated, {}).text;
    } else {
      base.wouldMutate = 'CREATE';
    }
    return base;
  }

  if (intent === 'GET_APPOINTMENT') {
    if (state.conversationStep === 'ASK_TOKEN' || !state.token) {
      base.text = run(codeOf('Demander token consultation'), state, {}).text;
    } else {
      base.wouldMutate = 'GET';
    }
    return base;
  }

  if (intent === 'CANCEL_APPOINTMENT') {
    if (state.conversationStep === 'ASK_CANCEL_CONFIRMATION') {
      const analyzed = run(codeOf('Analyser confirmation annulation'), state, {});
      base.recognized = analyzed.confirmationRecognized === true;
      base.confirmed = analyzed.cancelConfirmed;
      if (analyzed.cancelConfirmed === true) {
        base.wouldMutate = 'CANCEL';
      } else if (analyzed.cancelConfirmed === false) {
        base.text = run(codeOf('Préparer réponse abandon annulation'), analyzed, {}).text;
      } else {
        base.text = run(codeOf('Redemander confirmation annulation'), analyzed, {}).text;
      }
      return base;
    }
    base.text = run(codeOf('Demander token annulation'), state, {}).text;
    return base;
  }

  if (intent === 'RESCHEDULE_APPOINTMENT') {
    if (previous.conversation_step === 'ASK_RESCHEDULE_CONFIRMATION') {
      const analyzed = run(codeOf('Analyser confirmation replanification'), state, {});
      base.recognized = analyzed.confirmationRecognized === true;
      base.confirmed = analyzed.rescheduleConfirmed;
      if (analyzed.rescheduleConfirmed === true) base.wouldMutate = 'RESCHEDULE';
      else if (analyzed.rescheduleConfirmed === false) {
        base.text = run(codeOf('Préparer abandon replanification'), analyzed, {}).text;
      } else {
        base.text = run(codeOf('Redemander confirmation replanification'), analyzed, {}).text;
      }
      return base;
    }
    if (state.conversationStep === 'ASK_RESCHEDULE_CONFIRMATION') {
      base.text = run(codeOf('Préparer confirmation replanification'), state, {}).text;
      return base;
    }
    if (state.conversationStep === 'ASK_RESCHEDULE_TOKEN' || state.conversationStep === 'ASK_TOKEN' || !state.token) {
      base.text = run(codeOf('Demander token replanification'), state, {}).text;
      return base;
    }
    return base;
  }

  base.text = run(codeOf('Réponse générale'), state, {}).text;
  return base;
}

function hasUuid(value) {
  return /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.test(String(value || ''));
}

const scenarios = [];

function add(id, sessionId, previous, message, expect) {
  scenarios.push({ id, sessionId, previous, message, expect });
}

add('T01', 'rec004-test-t01', previousOf('rec004-test-t01', {
  pending: 'RESCHEDULE_APPOINTMENT', step: 'ASK_RESCHEDULE_SLOT', service: 'VISA', site: 'LISBONNE',
  dateDebut: '2026-09-01', dateFin: '2026-09-03', token: true, newSlotId: SLOT_2, slots, index: 2, nom: 'SILVA'
}), CREATE, {
  pending: 'CREATE_APPOINTMENT', step: 'ASK_CREATE_SITE', service: 'PASSEPORT', site: null,
  tokenNull: true, datesNull: true, slotsEmpty: true, textIncludes: 'Dans quel site'
});

add('T02', 'rec004-test-t02', previousOf('rec004-test-t02', {
  pending: 'CANCEL_APPOINTMENT', step: 'ASK_CANCEL_CONFIRMATION', service: 'PASSEPORT', site: 'PARIS', token: true, reference: 'REF-TEST'
}), CREATE, {
  pending: 'CREATE_APPOINTMENT', step: 'ASK_CREATE_SITE', service: 'PASSEPORT', site: null, tokenNull: true, textIncludes: 'Dans quel site'
});

add('T03', 'rec004-test-t03', previousOf('rec004-test-t03', {
  pending: 'CREATE_APPOINTMENT', step: 'READY_CREATE_SEARCH', service: 'PASSEPORT', site: 'PARIS',
  dateDebut: '2026-09-01', dateFin: '2026-09-03', slots, nom: 'SILVA'
}), CREATE, {
  pending: 'CREATE_APPOINTMENT', step: 'ASK_CREATE_SITE', service: 'PASSEPORT', site: null, tokenNull: true, datesNull: true, textIncludes: 'Dans quel site'
});

add('T04', 'rec004-test-t04', previousOf('rec004-test-t04', {
  pending: 'CREATE_APPOINTMENT', step: 'ASK_CREATE_SITE', service: 'PASSEPORT'
}), 'Paris', {
  pending: 'CREATE_APPOINTMENT', step: 'ASK_CREATE_DATE_RANGE', service: 'PASSEPORT', site: 'PARIS', tokenNull: true, textIncludes: 'Période souhaitée'
});

add('T05', 'rec004-test-t05', previousOf('rec004-test-t05', {
  pending: 'CREATE_APPOINTMENT', step: 'ASK_CREATE_DATE_RANGE', service: 'PASSEPORT', site: 'PARIS'
}), 'Du 02/11/2026 au 06/11/2026', {
  pending: 'CREATE_APPOINTMENT', step: 'READY_CREATE_SEARCH', intent: 'GET_AVAILABILITY',
  service: 'PASSEPORT', site: 'PARIS', dateDebut: '2026-11-02', dateFin: '2026-11-06', tokenNull: true, ready: true, calledHttp: false
});

add('T06', 'rec004-test-t06', previousOf('rec004-test-t06', {
  pending: 'CREATE_APPOINTMENT', step: 'ASK_CREATE_DATE_RANGE', service: 'PASSEPORT', site: 'PARIS', nom: 'SILVA'
}), 'Je souhaite annuler mon rendez-vous', {
  pending: 'CANCEL_APPOINTMENT', step: 'ASK_TOKEN', tokenNull: true, site: null, textIncludes: 'token'
});

add('T07', 'rec004-test-t07', previousOf('rec004-test-t07', {
  pending: 'CANCEL_APPOINTMENT', step: 'ASK_TOKEN', token: true, reference: 'REF-TEST'
}), 'Je souhaite consulter mon rendez-vous', {
  pending: 'GET_APPOINTMENT', step: 'ASK_TOKEN', tokenNull: true, textIncludes: 'token'
});

add('T08', 'rec004-test-t08', previousOf('rec004-test-t08', {
  pending: 'RESCHEDULE_APPOINTMENT', step: 'ASK_RESCHEDULE_CONFIRMATION', service: 'LEGALISATION', site: 'LISBONNE', token: true, newSlotId: SLOT_2, slots
}), CREATE, {
  pending: 'CREATE_APPOINTMENT', step: 'ASK_CREATE_SITE', service: 'PASSEPORT', tokenNull: true, site: null, textIncludes: 'Dans quel site'
});

add('T09', 'rec004-test-t09', previousOf('rec004-test-t09', {
  pending: 'CANCEL_APPOINTMENT', step: 'ASK_CANCEL_CONFIRMATION', token: true, reference: 'REF-TEST'
}), 'Oui', {
  pending: 'CANCEL_APPOINTMENT', step: 'ASK_CANCEL_CONFIRMATION', confirmed: true, wouldMutate: 'CANCEL', calledHttp: false
});

add('T10', 'rec004-test-t10', previousOf('rec004-test-t10', {
  pending: 'CANCEL_APPOINTMENT', step: 'ASK_CANCEL_CONFIRMATION', token: true, reference: 'REF-TEST'
}), 'Non', {
  pending: 'CANCEL_APPOINTMENT', step: 'ASK_CANCEL_CONFIRMATION', confirmed: false, wouldMutate: null, textIncludes: 'pas été annulé'
});

add('T11', 'rec004-test-t11', previousOf('rec004-test-t11', {
  pending: 'CREATE_APPOINTMENT', step: 'ASK_CREATE_SLOT', service: 'PASSEPORT', site: 'PARIS',
  dateDebut: '2026-11-02', dateFin: '2026-11-06', slots
}), 'Je prends le 2', {
  pending: 'CREATE_APPOINTMENT', step: 'ASK_NOM', tokenNull: true, slotIsSecond: true, newSlotNull: true, textIncludes: 'nom'
});

add('T12', 'rec004-test-t12', previousOf('rec004-test-t12', {
  pending: 'RESCHEDULE_APPOINTMENT', step: 'ASK_RESCHEDULE_SLOT', service: 'PASSEPORT', site: 'PARIS', token: true, slots
}), 'Je prends le 2', {
  pending: 'RESCHEDULE_APPOINTMENT', step: 'ASK_RESCHEDULE_CONFIRMATION', slotNull: true, newSlotIsSecond: true, textIncludes: 'Confirmez-vous'
});

add('T13', 'rec004-test-t13', { session_id: 'rec004-test-t13' }, CREATE, {
  pending: 'CREATE_APPOINTMENT', step: 'ASK_CREATE_SITE', service: 'PASSEPORT', tokenNull: true, textIncludes: 'Dans quel site'
});

add('T14', 'rec004-test-t14', { session_id: 'rec004-test-t14' }, 'bonjour', {
  intent: 'GENERAL', pending: null, step: null, tokenNull: true, textIncludes: 'consulter les services'
});

add('T14B', 'rec004-test-t14b', previousOf('rec004-test-t14b', {
  pending: 'CANCEL_APPOINTMENT', step: 'ASK_CANCEL_CONFIRMATION', token: true
}), 'peut-être', {
  pending: 'CANCEL_APPOINTMENT', step: 'ASK_CANCEL_CONFIRMATION', recognized: false, wouldMutate: null, textIncludes: 'Oui'
});

const results = [];
for (const scenario of scenarios) {
  const produced = turn(scenario.sessionId, scenario.previous, scenario.message);
  const state = produced.collecte;
  const response = replyFor(state, scenario.previous);
  const problems = [];
  const expect = scenario.expect;
  const actual = {
    intent: state.intent ?? null,
    pending: state.pendingAction ?? null,
    step: state.conversationStep ?? null,
    service: state.service ?? null,
    site: state.site ?? null,
    dateDebut: state.dateDebut ?? null,
    dateFin: state.dateFin ?? null,
    tokenNull: state.token == null,
    newSlotNull: state.newSlotId == null,
    slotNull: state.slotId == null,
    datesNull: state.dateDebut == null && state.dateFin == null,
    slotsEmpty: !Array.isArray(state.availableSlots) || state.availableSlots.length === 0,
    slotIsSecond: state.slotId === SLOT_2,
    newSlotIsSecond: state.newSlotId === SLOT_2,
    confirmed: response.confirmed,
    recognized: response.recognized,
    wouldMutate: response.wouldMutate,
    calledHttp: response.calledHttp,
    ready: response.ready,
    replyStep: response.replyStep ?? null,
    text: response.text || ''
  };
  for (const [key, value] of Object.entries(expect)) {
    if (key === 'textIncludes') {
      if (!String(actual.text).toLowerCase().includes(String(value).toLowerCase())) problems.push('texte');
      continue;
    }
    if (actual[key] !== value) problems.push(key + '=' + String(actual[key]));
  }
  const secretValues = [scenario.previous.token, scenario.previous.slot_id, scenario.previous.new_slot_id, SLOT_1, SLOT_2]
    .filter(Boolean);
  if (secretValues.some((value) => String(actual.text).includes(value))) problems.push('identifiant dans la reponse');
  if (response.httpParams && response.httpParams.join(',') !== 'service,site,dateDebut,dateFin') {
    problems.push('parametres http');
  }
  results.push({
    id: scenario.id,
    status: problems.length ? 'FAIL' : 'PASS',
    problems,
    actual: {
      intent: actual.intent,
      pending: actual.pending,
      step: actual.step,
      service: actual.service,
      site: actual.site,
      dateDebut: actual.dateDebut,
      dateFin: actual.dateFin,
      tokenNull: actual.tokenNull,
      slotNull: actual.slotNull,
      newSlotNull: actual.newSlotNull,
      slotsEmpty: actual.slotsEmpty,
      slotIsSecond: actual.slotIsSecond,
      newSlotIsSecond: actual.newSlotIsSecond,
      confirmed: actual.confirmed ?? null,
      recognized: actual.recognized ?? null,
      wouldMutate: actual.wouldMutate,
      calledHttp: actual.calledHttp,
      ready: actual.ready,
      textHasUuid: hasUuid(actual.text),
      textStart: String(actual.text).replace(/\s+/g, ' ').slice(0, 140)
    },
    payload: state
  });
}

function psql(script) {
  return execFileSync('docker', [
    'compose', 'exec', '-T', 'postgres',
    'sh', '-c', 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -q -A -t'
  ], { cwd: root, input: script, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
}

let sql = 'BEGIN;\n';
sql += `CREATE TEMP TABLE rec004_guard AS
SELECT (SELECT count(*) FROM rendez_vous) AS rv,
       (SELECT count(*) FROM ai_conversation_state WHERE session_id NOT LIKE 'rec004-test-%') AS sessions,
       (SELECT md5(COALESCE(string_agg(id::text || statut || COALESCE(updated_at::text, ''), ',' ORDER BY id), '')) FROM rendez_vous) AS fp;\n`;
for (const result of results) {
  const payload = JSON.stringify(result.payload);
  if (payload.includes('$rec004$')) throw new Error('Separateur SQL present');
  const scenario = scenarios.find((item) => item.id === result.id);
  if (scenario.previous.pending_action) {
    sql += `INSERT INTO ai_conversation_state (
              session_id, pending_action, conversation_step, intent, service, site,
              token, new_slot_id, nom, available_slots, selected_slot_index, expires_at
            ) VALUES (
              '${scenario.sessionId}',
              '${scenario.previous.pending_action}',
              '${scenario.previous.conversation_step}',
              '${scenario.previous.pending_action}',
              ${scenario.previous.service ? "'" + scenario.previous.service + "'" : 'NULL'},
              ${scenario.previous.site ? "'" + scenario.previous.site + "'" : 'NULL'},
              ${scenario.previous.token ? 'gen_random_uuid()' : 'NULL'},
              ${scenario.previous.new_slot_id ? 'gen_random_uuid()' : 'NULL'},
              ${scenario.previous.nom ? "'" + scenario.previous.nom + "'" : 'NULL'},
              '${JSON.stringify(scenario.previous.available_slots || []).replace(/'/g, "''")}'::jsonb,
              ${scenario.previous.selected_slot_index == null ? 'NULL' : String(scenario.previous.selected_slot_index)},
              NOW() + INTERVAL '2 hours'
            );\n`;
  }
  sql += `DO $body$ BEGIN EXECUTE $q$${saveQuery}$q$ USING $rec004$${payload}$rec004$::jsonb; END $body$;\n`;
}
sql += `
DO $$
DECLARE g rec004_guard%ROWTYPE; rv int; sessions int; fp text;
BEGIN
  SELECT * INTO g FROM rec004_guard;
  SELECT count(*) INTO rv FROM rendez_vous;
  SELECT count(*) INTO sessions FROM ai_conversation_state WHERE session_id NOT LIKE 'rec004-test-%';
  SELECT md5(COALESCE(string_agg(id::text || statut || COALESCE(updated_at::text, ''), ',' ORDER BY id), '')) INTO fp FROM rendez_vous;
  IF rv <> g.rv OR sessions <> g.sessions OR fp IS DISTINCT FROM g.fp THEN
    RAISE EXCEPTION 'donnees metier modifiees';
  END IF;
END $$;
SELECT 'SQL|' || session_id || '|' || COALESCE(intent, '') || '|' || COALESCE(pending_action, '') || '|' || COALESCE(conversation_step, '') || '|' ||
       COALESCE(service, '') || '|' || COALESCE(site, '') || '|' || (token IS NULL) || '|' || (slot_id IS NULL) || '|' || (new_slot_id IS NULL)
FROM ai_conversation_state WHERE session_id LIKE 'rec004-test-%' ORDER BY session_id;
SELECT 'GUARD|' || rv || '|' || sessions FROM rec004_guard;
ROLLBACK;
`;
const sqlOut = psql(sql);
const after = psql(`SELECT 'AFTER|' || (SELECT count(*) FROM ai_conversation_state) || '|' || (SELECT count(*) FROM ai_conversation_state WHERE session_id LIKE 'rec004-test-%') || '|' || (SELECT count(*) FROM rendez_vous);`);

const report = {
  workflowPath,
  nodes: workflow.nodes.length,
  active: workflow.active,
  availabilityParams,
  results: results.map(({ payload, ...rest }) => rest),
  sql: sqlOut.trim().split(/\r?\n/).filter((line) => line.startsWith('SQL|') || line.startsWith('GUARD|')),
  after: after.trim()
};
fs.writeFileSync('C:\\Users\\epifa\\AppData\\Local\\Temp\\govsuite-rec004-results.json', JSON.stringify(report, null, 2));
const failed = results.filter((item) => item.status !== 'PASS');
console.log(results.map((item) => item.status + ' ' + item.id + (item.problems.length ? ' ' + item.problems.join(',') : '')).join('\n'));
console.log(after.trim());
process.exit(failed.length ? 2 : 0);
