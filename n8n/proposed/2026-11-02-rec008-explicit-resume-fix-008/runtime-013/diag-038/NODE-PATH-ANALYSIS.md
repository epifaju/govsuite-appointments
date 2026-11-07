# DIAG-038 — NODE-PATH-ANALYSIS (R04-B HTTP 500)

Mission offline only. Aucun PUT / activate / chat / Ollama / mutation PG.  
Aucun patch jsCode proposé (pas de correctif spéculatif).

**Pin workflow :** `../diag-034/after-OCD9It1uKFhOoWNF.json`  
VC11 / `versionId` `f5a9181f-…` / inactive / 134 nœuds.  
**Gérer** SHA `44a7064d12755a84dd256acae90abbf67a778178f9947eec3a36dc0c9abcad3f` (`44a7064d…`).  
Settings : `saveDataSuccessExecution=none`, `saveDataErrorExecution=none`.

---

## Verdict

| Champ | Valeur |
| --- | --- |
| HTTP / métier 037 | HTTP **500** `Error in workflow` (~40629 ms) ; PG before ≡ after |
| Locus | **CONFIRMED** : échec **à ou avant** `Sauvegarder état conversation` (Sauvegarder **non atteint avec succès**) |
| Cause nœud exact | **UNKNOWN** (aucune exécution erreur persistée) |
| Suspect principal | **PROBABLE** : `Comprendre la demande` / Ollama, ou échec amont non observé |
| Validation jsCode (email) | **NOT demonstrated** as HTTP 500 source |
| Patch jsCode | **Aucun** (interdit / non justifié) |
| Verdict préparation offline | **PASS** (analyse path complète ; nœud fautif non pinable sans observabilité erreur) |

---

## 1. Preuves runtime 037 (rappel, sans PII)

Source : `../diag-037/artifacts-r04b-037/R04-B-result.json`.

- Message classe `email_like_invalid` (`pas-un-email`), 1 envoi, **0 retry**.
- HTTP : `status=500`, body `{"message":"Error in workflow"}`, `elapsedMs≈40629`.
- PG before ≡ after : `conversationStep=ASK_EMAIL`, `emailPresent=false`, `lastUserMessageLen=0`, `updatedAt` inchangé, fingerprint `1|16|4|0`.
- Mock CreateAppointment : 0 posts / 0 claims.
- Ollama gate : model present / warm OK avant chat ; gate ≠ preuve de succès du nœud LLM dans le workflow.
- Contraste R04-A (036, email valide) : latence comparable (~45 s) mais HTTP **200** + PG muté → ~40 s est **compatible** avec `Comprendre`, pas une preuve isolée de timeout.

**Implication PG :** si `Gérer` puis `Sauvegarder` avaient réussi, `last_user_message` / `updated_at` auraient changé (`Gérer` pose `originalMessage` même quand l’email reste null). Donc **Sauvegarder n’a pas été atteint avec succès** (échec amont, ou erreur Sauvegarder sans commit visible — non observée sur R04-A).

**Observabilité :** double `saveData*=none` → impossible de lire le nœud fautif via API executions RO.

---

## 2. Chemin de connexions (CREATE / ASK_EMAIL)

Chaîne amont (toujours avant Router) :

```text
Lorsqu'un message de chat est reçu  (chatTrigger, responseMode=lastNode)
  → Charger état conversation
  → Lire tentative de session
  → Joindre tentative de session
  → Comprendre la demande              (chainLlm ← Ollama qwen2.5:1.5b)
  → Parser intention
  → Fusionner état conversation
  → Gérer collecte progressive         (SHA 44a7064d…)
  → Sauvegarder état conversation      (Postgres UPSERT)
  → Router intention
```

Branche CREATE attendue **si** Sauvegarder réussit (seed R04-B : pending CREATE, step ASK_EMAIL) :

```text
Router intention [CREATE_APPOINTMENT]
  → Décider action tentative           (attemptAction défaut = COLLECT)
  → Aiguiller tentative
       • COLLECT ∉ rules nommées → fallbackOutput=extra
       → Valider paramètres création
       → Création prête ? (false si email manquant)
       → Demander paramètres création  (terminal lastNode ; case ASK_EMAIL)
```

**Hors chemin ASK_EMAIL / R04-B :**

- `Préparer réponse création` : inbound depuis `Clôture confirmation enregistrée ?` → voie **succès CreateAppointment** (`type: appointment_created`), **pas** la re-demande email.
- `Appeler CreateAppointment` : plus loin (CLAIM/RESUME + corps figé) ; mock 037 = 0 posts confirme non-atteint **ou** échec amont.

Offline : `OFFLINE-TESTS.json` 16/16 PASS ; `SIM-POLLUTE.json` Parser→Fusionner→Gérer sans throw sur `pas-un-email`.

---

## 3. Analyse nœud par nœud

Pour chaque nœud : entrées attendues, nulls, branche `pas-un-email`, risque HTTP 500.

### 3.1 Comprendre la demande

| | |
| --- | --- |
| Type | `@n8n/n8n-nodes-langchain.chainLlm` v1.9 (+ `lmChatOllama` qwen2.5:1.5b) |
| SHA jsCode | N/A (pas de jsCode) |
| Entrées | `text` = `chatInput` du trigger ; system prompt JSON-only (intent + champs, null si absent) |
| Null / malformed | Sortie LLM libre (`text`/`output`/`response`) ; peut être vide, non-JSON, ou JSON partiel — **toléré en aval** par Parser (`JSON.parse` try/catch → `{}`) |
| Branche `pas-un-email` | Aucune logique email métier ; le modèle peut classer GENERAL ou CREATE ; **ne valide pas** l’email |
| Risque 500 | **PROBABLE #1** — erreur runtime chainLlm / Ollama / LangChain sans atteindre Parser ; latence ~40 s compatible ; seul maillon amont **non** prouvé sain offline |
| Rang 500+PG figé | **PROBABLE** |

### 3.2 Parser intention

| | |
| --- | --- |
| Type | Code v2 ; SHA `1f4c0839…` |
| Entrées | Sortie LLM (`$json.text`/`output`/`response`) ; trigger `chatInput` ; état via `Joindre` / `Charger` |
| Null | `JSON.parse` catch → `parsed={}` ; extractions message déterministes ; champs métier absents → null |
| Branche `pas-un-email` | Verrou P4E/P4F : `pendingAction=CREATE` + step ∈ ASK_* (dont `ASK_EMAIL`) + session non expirée → **force `CREATE_APPOINTMENT`** même si LLM dit GENERAL ; email métier depuis le **message**, pas depuis `parsed.email` inventé |
| Risque 500 | Aucun `throw` ; offline OK (`SIM-POLLUTE`, harness R04-B) |
| Rang | **UNLIKELY** — jsCode validation **non** source démontrée du 500 |

### 3.3 Fusionner état conversation

| | |
| --- | --- |
| Type | Code v2 ; SHA `d1c7f991…` |
| Entrées | Sortie Parser + previous PG / tentative |
| Null | `hasValue` filtre `null` / `'null'` / vide ; conserve dates / slot / identité seed sous flux CREATE ; email null reste null |
| Branche `pas-un-email` | Ne capture pas d’email invalide ; fusionne intent CREATE + état ASK_EMAIL |
| Risque 500 | Aucun `throw` ; simu pollution dates/slot LLM → champs typés restent sains |
| Rang | **UNLIKELY** |

### 3.4 Gérer collecte progressive (`44a7064d…`)

| | |
| --- | --- |
| Type | Code v2 ; SHA pin W-031-01 |
| Entrées | Sortie Fusionner + `$('Parser intention')` pour candidats |
| Null | `isValidEmail` false sur null/vide/non-email ; `email` reste null ; `conversationStep` reste `ASK_EMAIL` ; `originalMessage` = message courant |
| Branche `pas-un-email` | Step `ASK_EMAIL` + `!isValidEmail(email)` → candidate = `parser.email` **ou** regex email sur message → si échec, **pas de capture** ; step inchangé (offline CONFIRMED) |
| Risque 500 | Aucun `throw` ; validation email = garde métier, **pas** une exception |
| Rang | **ÉCARTÉ** comme cause 500 (logique conforme offline) |

### 3.5 Sauvegarder état conversation

| | |
| --- | --- |
| Type | Postgres v2.7 UPSERT (`$1::jsonb` + casts `::date` / `::uuid` / `::integer`) |
| Entrées | JSON sortie `Gérer` |
| Null | `NULLIF` + filtre `'null'`/`'undefined'` avant casts |
| Branche `pas-un-email` | Payload attendu : email null, step ASK_EMAIL, dates/UUID seed propres, `originalMessage` non vide |
| Risque 500 | Cast SQL possible **si** pollution typée ; simu + R04-A → payload sain **PROBABLE** ; si ce nœud avait réussi, PG aurait muté |
| Rang | **UNLIKELY** comme cause primaire ; **CONFIRMED non atteint avec succès** (preuve PG) |

### 3.6 Router intention

| | |
| --- | --- |
| Type | Switch v3.2 sur `$json.intent` |
| Entrées | Sortie **après** Sauvegarder |
| Null | Intent manquant → branche fallback / GENERAL (outs 6–7 → `Réponse générale`) |
| Branche `pas-un-email` | Après verrou Parser : intent CREATE → out branch 2 → `Décider action tentative` |
| Risque 500 | Faible (switch) ; **après** Sauvegarder → aurait laissé PG muté |
| Rang | **ÉCARTÉ** pour symptôme PG figé |

### 3.7 Décider action tentative

| | |
| --- | --- |
| Type | Code v2 ; SHA `eb7b8e3e…` |
| Entrées | `$('Gérer…')` + item courant (try/catch → `{}`) |
| Null | `createDecision` null → `attemptAction='COLLECT'` par défaut |
| Branche `pas-un-email` | Offline `DECIDE-DEMAND.json` : CREATE ou GENERAL amont → toujours `COLLECT` + step ASK_EMAIL ; pas de throw |
| Risque 500 | Aucun `throw` ; **post-Sauvegarder** |
| Rang | **ÉCARTÉ** pour PG figé |

### 3.8 Aiguiller tentative

| | |
| --- | --- |
| Type | Switch v3.2 ; rules INSERT/CLAIM/RESUME/…/RESET_STALE ; **`fallbackOutput=extra`** |
| Entrées | `$json.attemptAction` |
| Null / COLLECT | `COLLECT` **∉** rules → branche extra → `Valider paramètres création` |
| Branche `pas-un-email` | COLLECT → Valider → `Création prête ?` false → `Demander paramètres création` |
| Risque 500 | Faible ; **post-Sauvegarder** |
| Rang | **ÉCARTÉ** pour PG figé |

### 3.9 Demander paramètres création

| | |
| --- | --- |
| Type | Code v2 ; SHA `1d9c8c00…` ; **outs=[]** (terminal `lastNode`) |
| Entrées | État collecte (`conversationStep`, …) |
| Null | `default` → texte générique création ; case `ASK_EMAIL` → demande adresse e-mail |
| Branche `pas-un-email` | **Nœud HTTP contract correct** pour re-demande email (`create_appointment_question`) ; offline `demTextHasEmailWord=true`, no throw |
| Risque 500 | Aucun `throw` ; **post-Sauvegarder** — non atteint en 037 |
| Rang | **ÉCARTÉ** pour PG figé (chemin nominal si amont OK) |

### 3.10 Préparer réponse création — **OFF-PATH**

| | |
| --- | --- |
| Type | Code v2 ; SHA `4dffeee4…` |
| Connexions | Inbound : `Clôture confirmation enregistrée ?` → puis `Finaliser état création` |
| Rôle | Confirmation post-création (`type: appointment_created`) |
| ASK_EMAIL | **Pas de case ASK_EMAIL** (`ROUTING-INSPECT` : `prepHasAskEmail=false`) ; injecter ASK_EMAIL en simu → toujours `appointment_created` (`PREP-INSPECT`) |
| Branche `pas-un-email` | **Hors chemin** ; ne produit pas la question email |
| Risque 500 R04-B | **ÉCARTÉ** (off-path + post-collecte complète + post-HTTP métier) |

Clarification contrat offline : tester `Demander paramètres création` pour ASK_EMAIL, **pas** `Préparer réponse création`.

---

## 4. Synthèse risques HTTP 500 (`pas-un-email`)

| Nœud | Throw jsCode ? | Sur chemin ASK_EMAIL nominal ? | Rang 500 + PG figé |
| --- | --- | --- | --- |
| Comprendre / Ollama | N/A (runtime LLM) | Oui (amont) | **PROBABLE #1** |
| Parser / Fusionner / Gérer | Non (scan + simu) | Oui | UNLIKELY / écarté validation |
| Sauvegarder | SQL possible | Oui si amont OK | UNLIKELY ; **non atteint avec succès** |
| Router / Décider / Aiguiller / Demander | Non / faible | Oui **après** save | **Écarté** (PG aurait muté) |
| Préparer réponse création | Non | **Non** (off-path) | Écarté |

Aucun nœud Code du pin exporté n’utilise `throw` / `new Error(` (scan offline).

**Conclusion causale :**

1. **CONFIRMED** — validation jsCode email **n’est pas démontrée** comme source du 500 ; Gérer ASK_EMAIL invalide est conforme offline.
2. **CONFIRMED** — `Sauvegarder` **non atteint avec succès** (PG before≡after, `lastUserMessageLen=0`).
3. **PROBABLE** — `Comprendre la demande` / Ollama, **ou** échec amont non observé (Charger/Joindre moins probable vu R04-A).
4. **UNKNOWN** — nœud exact tant que `saveDataErrorExecution=none`.
5. **NO speculative jsCode patch** — aucun correctif Gerer/Parser/Demander justifié pour ce symptôme.

---

## 5. Plan d’observabilité uniquement (proposition — **NE PAS IMPLÉMENTER ici**)

Objectif : pin le nœud exact du 500, **sans** changer la logique métier.

| Étape | Action | Garde-fous |
| --- | --- | --- |
| 0 | Autorisation écrite **distincte** (TEST only) | Pas d’activation implicite ; pas LIVE |
| 1 | Backup / export pin VC11 avant tout setting | Artefact sous `n8n/proposed/…` |
| 2 | Temporaire : `saveDataErrorExecution=all` (ou équivalent minimal) ; laisser `saveDataSuccessExecution=none` si possible | Diff settings **seulement** ; pas de jsCode |
| 3 | Préflight RO (VC11, Gerer `44a7064d…`, webhooks, Ollama gate) | STOP si drift |
| 4 | **Une** exécution R04-B contrôlée (1 message, 0 retry auto) | Clé idempotence conservée si UNCERTAIN |
| 5 | Lire exécution en erreur RO → noter `lastNodeExecuted` / message erreur (sans PII) | Corréler `executionId` |
| 6 | Remettre `saveDataErrorExecution=none` + postflight | Vérifier inactive / webhooks 0 |
| 7 | Si Comprendre confirmé → proposition hors ligne filet LLM (réponse dégradée vs 500) sous `n8n/proposed/` | Nouvelle autorisation ; **pas** de patch email jsCode spéculatif |

Cette note **n’autorise pas** l’étape 2–6.

---

## 6. Impacts / non-régressions (phase future)

- Ne pas « corriger » Gérer ASK_EMAIL pour le 500 R04-B (déjà OK offline).
- Ne pas retargeter `Préparer réponse création` pour ASK_EMAIL.
- Après pin nœud : non-régression R04-A (email valide → ASK_TELEPHONE) et R01–R03 harness offline.
- Toute mutation settings / workflow = autorisation séparée.

---

## 7. Plan d’install

**Aucun.** DIAG-038 = diagnostic path + plan observabilité proposé.  
Install / PUT / activate / chat / Ollama / PG mutate : **hors scope**.

---

## 8. Références locales

- Workflow pin : `../diag-034/after-OCD9It1uKFhOoWNF.json`
- Runtime 037 : `../diag-037/artifacts-r04b-037/`
- Méta / sims : `_nodes-meta.json`, `COMPRENDRE-META.json`, `AIGUILLER-META.json`, `ROUTING-INSPECT.json`, `CREATE-CHAIN.json`, `DECIDE-DEMAND.json`, `PREP-INSPECT.json`, `SIM-POLLUTE.json`, `OFFLINE-TESTS.json`
- Sources nœuds : `_nodes/*.js` / `Sauvegarder_etat_conversation.json`
