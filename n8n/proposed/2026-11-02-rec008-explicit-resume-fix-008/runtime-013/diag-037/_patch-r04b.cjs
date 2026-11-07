'use strict';
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'run-r04b-037.js');
let s = fs.readFileSync(p, 'utf8');

s = s.replace(
  /R04A-RUNTIME-036 — R04-A ONLY[\s\S]*?Derived from run-runtime-013\.js \(R01–R03\)\./,
  `R04B-RUNTIME-037 — R04-B ONLY on installed W-031-01 (TEST only).
 * Invalid email → stay ASK_EMAIL. 1 message, 0 retry. No R04-C. No LIVE.
 * ART dir hard-pinned to artifacts-r04b-037 (refuse polluted RUNTIME_ART).
 * Derived from diag-036/run-r04a-036.js.`
);

s = s.replace(
  /const ART_DIR_NAME = String\(process\.env\.RUNTIME_ART \|\| 'artifacts-r04a-036'\)\.replace\(\s*\/\[\^a-zA-Z0-9\._-\]\/g,\s*'',\s*\);\s*const ART = path\.join\(ROOT, ART_DIR_NAME \|\| 'artifacts-r04a-036'\);/,
  `const REQUIRED_ART = 'artifacts-r04b-037';
const envArtRaw = process.env.RUNTIME_ART;
const envArt = envArtRaw ? String(envArtRaw).replace(/[^a-zA-Z0-9._-]/g, '') : '';
if (envArt && envArt !== REQUIRED_ART) {
  console.error(
    JSON.stringify({
      ok: false,
      stopped: true,
      reason: 'polluted-RUNTIME_ART',
      envArt,
      required: REQUIRED_ART,
      hint: 'Unset RUNTIME_ART or set RUNTIME_ART=' + REQUIRED_ART,
    })
  );
  process.exit(2);
}
const ART_DIR_NAME = REQUIRED_ART;
const ART = path.join(ROOT, REQUIRED_ART);`
);

s = s.replace(
  /\/\*\* Synthetic email — never written into artefacts \(messageClass only\)\. \*\/\s*const R04A_EMAIL_SYNTHETIC = 'camille\.r04a\.035@example\.test';\s*const ALL_SCENARIOS = \[\s*\{\s*id: 'R04-A',\s*sessionId: 'rec008-r04a-035-active-ask-email',\s*message: R04A_EMAIL_SYNTHETIC,\s*messageClass: 'email_like_valid_synthetic',\s*\},\s*\];\s*const SCENARIOS = ALL_SCENARIOS;/,
  `/** Invalid non-email — class only in artefacts (value may appear in http preview → redact). */
const R04B_INVALID_MESSAGE = 'pas-un-email';
const ALL_SCENARIOS = [
  {
    id: 'R04-B',
    sessionId: 'rec008-r04b-035-active-ask-email',
    message: R04B_INVALID_MESSAGE,
    messageClass: 'email_like_invalid',
  },
];
const SCENARIOS = ALL_SCENARIOS;`
);

s = s.replace(/function assertR04A\([\s\S]*?return issues;\n\}/, `function assertR04B(before, after, http) {
  const issues = [];
  if (!http || http.status === 0) {
    issues.push('HTTP transport failure: ' + (http && (http.error || http.status)));
  }
  if (!after) {
    issues.push('session missing after');
    return issues;
  }
  if (!before) {
    issues.push('session missing before');
    return issues;
  }
  if (before.conversationStep !== 'ASK_EMAIL') {
    issues.push('before step expected ASK_EMAIL got ' + before.conversationStep);
  }
  if (before.emailPresent === true) issues.push('before emailPresent expected false');
  if (before.ttlActive !== true) issues.push('before ttlActive expected true');
  if (after.conversationStep !== 'ASK_EMAIL') {
    issues.push('step expected ASK_EMAIL got ' + after.conversationStep);
  }
  if (after.emailPresent === true) issues.push('emailPresent expected false');
  if (after.emailLen !== 0) issues.push('emailLen expected 0 got ' + after.emailLen);
  if (after.nomPresent !== true || after.nomLen !== before.nomLen) {
    issues.push('nom not preserved (Present/Len)');
  }
  if (after.prenomPresent !== true || after.prenomLen !== before.prenomLen) {
    issues.push('prenom not preserved (Present/Len)');
  }
  if (after.slotIdPresent !== true) issues.push('slotIdPresent expected true after');
  if (before.slotIdPresent !== true) issues.push('slotIdPresent expected true before');
  if (after.ttlActive !== true) issues.push('ttlActive expected true after');
  if (after.telephonePresent === true) issues.push('telephonePresent expected false');
  const blob = flattenText(http.json || http.textPreview).toLowerCase();
  if (blob.includes('session_expired')) issues.push('unexpected session_expired');
  const asksEmail =
    blob.includes('email') ||
    blob.includes('courriel') ||
    blob.includes('mail') ||
    blob.includes('adresse');
  if (!asksEmail && http.ok) {
    issues.push('response does not clearly ask to correct email');
  }
  if (after.conversationStep === 'ASK_TELEPHONE') {
    issues.push('CRITICAL: step advanced to ASK_TELEPHONE on invalid email');
  }
  return issues;
}`);

s = s.replace(
  /if \(sc\.id === 'R04-A'\) assertIssues = assertR04A\(result\.before, result\.after, result\.http\);/,
  `if (sc.id === 'R04-B') assertIssues = assertR04B(result.before, result.after, result.http);`
);

s = s.replace(
  /messageClass: sc\.messageClass \|\| 'email_like_valid_synthetic',/,
  `messageClass: sc.messageClass || 'email_like_invalid',`
);

s = s.replace(
  /mission: 'R04A-RUNTIME-036',\s*runtimeOnly: \['R04-A'\],/,
  `mission: 'R04B-RUNTIME-037',\n      runtimeOnly: ['R04-B'],`
);

s = s.replace(
  /emailPresent: r\.after && r\.after\.emailPresent,\s*emailLen: r\.after && r\.after\.emailLen,/,
  `emailPresent: r.after && r.after.emailPresent,
        emailLen: r.after && r.after.emailLen,
        emailValide: r.after && r.after.emailValide,`
);

s = s.replace(
  /r04b: 'NOT_AUTHORIZED',\s*r04c: 'NOT_AUTHORIZED',/,
  `r04a: 'NOT_REPLAYED',
      r04c: 'NOT_AUTHORIZED',`
);

s = s.replace(
  /return \{ cleaned: false, reason: 'R04A-036 forbids auto cleanup' \};/,
  `return { cleaned: false, reason: 'R04B-037 forbids auto cleanup' };`
);

s = s.replace(
  /assertR04A,\s*redactHttpArtifact,/,
  `assertR04B,
  redactHttpArtifact,`
);

s = s.replace(
  /SCENARIOS,\s*R04A_EMAIL_SYNTHETIC,/,
  `SCENARIOS,
  R04B_INVALID_MESSAGE,
  REQUIRED_ART,`
);

// Guard: refuse second message — already one sendMessageOnce; add explicit counter
if (!s.includes('messageSendCount')) {
  s = s.replace(
    /result\.http = await sendMessageOnce\(sc\.sessionId, sc\.message, result\.chatTimeoutMs\);\s*result\.messageSent = true;/,
    `if (result.messageSendCount) {
    result.issues.push('CRITICAL: second message refused');
    result.verdict = 'FAIL';
    try { result.deactivate = await deactivate(session, sc.id + '-second-msg'); } catch (_) {}
    writeJson(sc.id + '-result.json', result);
    return result;
  }
  result.messageSendCount = 1;
  result.http = await sendMessageOnce(sc.sessionId, sc.message, result.chatTimeoutMs);
  result.messageSent = true;
  result.retried = false;`
  );
}

fs.writeFileSync(p, s);
console.log('patched r04b');
