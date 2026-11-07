# MISSION 035 — Contrat workflow TEST pour future R04

**Mode :** lecture seule / documentation. **Aucune mutation** n8n, PG, Docker, chat.  
**Verdict docs :** **PASS**  
**R04-RUNTIME :** **NOT_AUTHORIZED**

---

## 1. Pin confirmé (artefacts)

Sources croisées :

| Source | Fichier |
| --- | --- |
| Post-install 034 | `../diag-034/after-OCD9It1uKFhOoWNF.json` + `RESULT.json` + `POSTFLIGHT.json` + `SHA256.json` |
| Préflight 035 | `PREFLIGHT.json` (`verdict: PASS`, `gate: GO-PREFLIGHT`) |

| Champ | Valeur confirmée |
| --- | --- |
| Workflow id | `OCD9It1uKFhOoWNF` |
| `versionCounter` | **11** |
| `versionId` | `f5a9181f-ff8d-4301-976e-57add79badae` |
| `active` | **false** |
| `activeVersionId` | **null** |
| Nœuds / liens | **134** / **137** |
| Gérer collecte progressive (W-031-01) | SHA **`44a7064d12755a84dd256acae90abbf67a778178f9947eec3a36dc0c9abcad3f`** (`44a7064d…`) |
| `settings.saveDataSuccessExecution` | **`none`** — **ne pas modifier** |
| `settings.saveDataErrorExecution` | **`none`** — **ne pas modifier** |
| Chat trigger | Nœud présent (`Lorsqu'un message de chat est reçu`, `@n8n/n8n-nodes-langchain.chatTrigger`) |
| Webhooks enregistrés | **0** (trigger inactif tant que `active=false`) |
| Running / open attempts | **0** / **0** (PREFLIGHT 035) |

Cohérence 034 after ↔ 035 PREFLIGHT : même `versionId`, VC11, Gerer `44a7064d…`, inactive, webhooks 0.

---

## 2. Actions 035 — interdits / non recommandés

| Action | Statut 035 |
| --- | --- |
| PUT workflow | **Aucun PUT recommandé** (préflight RO ; `putUsed: false`) |
| Activate / publish | **Interdit** |
| Chat / Ollama warm | **Interdit** |
| Seed / mutate PG | **Interdit** (SQL préparés sous `sql/` = NOT_RUN) |
| Modifier `saveData*` | **Interdit** (rester `none` / `none`) |
| LIVE (:5680) | **Interdit** |
| POST CreateAppointment / CLAIM | **Interdit** |
| Auto-next vers R04-RUNTIME | **NO-GO** |

Runner stub : `run-r04-runtime.stub.cjs` — refuse l’exécution (`R04-RUNTIME is NOT_AUTHORIZED`).

---

## 3. Contrat campagne future R04 (quand autorisée séparément)

Ancrage métier offline : `docs/recovery/REC008_R04_FIXTURE_CONTRACT.md` + seeds `sql/seed-r04-{a,b,c}.sql`.

### Règles communes

- Exactement **1 message** chat par scénario (`messagesPerCampaign: 1`).
- **`retried: false`** — aucun retry après timeout / erreur réseau.
- État initial : `conversation_step = ASK_EMAIL` (TTL actif A/B ; expiré C).
- `openAttempts = 0` ; CLAIM/POST Δ **0**.
- Preuves : `emailPresent` / `emailLen` uniquement — pas d’email clair hors `fixtures/**`.
- Warm gate / timeout chat : politique R01–R03 inchangée (180s post-warm) — **hors 035**.

### Matrice attendue

| ID | TTL | Message (classe) | Attendu Gerer W-031-01 | Capture email |
| --- | --- | --- | --- | --- |
| **R04-A** | actif | email synthétique valide | step → `ASK_TELEPHONE` ; `emailPresent=true` | oui (légitime) |
| **R04-B** | actif | non-email | reste `ASK_EMAIL` ; `emailPresent=false` | non |
| **R04-C** | **expiré** | email synthétique valide | `sessionExpired=true` ; `refreshSessionTtl=false` ; step ≠ `ASK_TELEPHONE` | **aucune** (`emailPresent=false`) |

### R04-C — no capture (W-031-01)

Branche `sessionExpired && !explicitResumeMsg` : identité strictement `previous.<champ> ?? null` (nom/prenom/email/telephone) — **pas** de coalescence `?? x.email`.  
Un message email-like sur TTL expiré **ne doit pas** peupler `email` ni avancer vers `ASK_TELEPHONE`.

### Resume path — inchangé

Branche reprise explicite (`reprendre` / `continuer` …) : **inchangée** vs FIX-008.

- Toujours `previous.email ?? x.email ?? null` (et équivalents) sur resume.
- `refreshSessionTtl=true` ; `sessionExpired=false` ; pas de CLAIM/POST automatique.
- Non-régression R03 / R04-D attendue offline déjà **PASS** (R035) ; runtime **non ouvert**.

---

## 4. Plan d’install futur (hors 035 — autorisation distincte requise)

1. Mission humaine écrite **R04-RUNTIME** (≠ readiness 035).
2. Préflight RO (pin VC11 / Gerer `44a7064d…` / inactive / webhooks 0 / saveData `none`).
3. Autorisation **activate** distincte si besoin + seed OPTION A (`sql/`) sous postflight.
4. Campagne A puis B puis C — **1 msg chacun**, 0 retry, deactivate + hygiene.
5. Evidence-reviewer → verdict métier ; **pas** d’auto-next LIVE / R05–R07.

**035 ne recommande aucun PUT** : le pin W-031-01 est déjà installé (034). Toute réécriture jsCode / settings serait une régression.

---

## 5. Impacts / non-régressions à vérifier (future runtime)

- R01–R03 (ASK_PRENOM / expired / resume) inchangés.
- Settings retention `none`/`none` inchangés (pas de fenêtre d’ouverture données en 035).
- Mock POST/CLAIM Δ0 sur A/B/C.
- Isolation TEST port **5682** uniquement.

---

## 6. Verdict

| Gate | Décision |
| --- | --- |
| Docs / contrat workflow 035 | **PASS** |
| Cohérence pin 034 after ↔ 035 PREFLIGHT | **PASS** |
| PUT / activate / chat / seed en 035 | **NOT_RUN** (interdit) |
| **R04-RUNTIME** | **NOT_AUTHORIZED** |
| LIVE | **NO-GO** |
| Auto-next | **NO-GO** |

**STOP.** Attendre ordre humain distinct pour toute campagne R04-RUNTIME.
