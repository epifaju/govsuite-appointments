# DIAG-038 — EVIDENCE-INVENTORY (offline)

Mission : inventaire technique **lecture seule**.  
Aucun Docker mutate, aucun changement de rétention `saveData*`, aucune activation, aucun chat, aucun POST métier, aucun toucher LIVE.

| Champ | Valeur |
| --- | --- |
| Isolation | Artefacts sous `n8n/proposed/…/runtime-013/` uniquement |
| LIVE | **non touché** (cette mission ; préflight 037 : `liveTouched=false`, port LIVE `5680` interdit) |
| Rétention / activate | **non modifiés** ici |
| Cause nœud exact (500 R04-B) | **UNKNOWN** — dump d’exécution manquant |
| Verdict inventaire | **PASS** |

---

## 1. Source A — `diag-037/artifacts-r04b-037/*`

Campagne runtime R04-B (mission 037). 11 fichiers JSON. Hygiene : `secretOrEmailHits=[]`, verdict PASS.

| Fichier | Rôle technique (sans PII) | Signal clé |
| --- | --- | --- |
| `preflight.json` | Préflight TEST | `ok=true` ; `liveTouched=false` ; n8n `5682` ; WF `OCD9It1uKFhOoWNF` inactif ; VC11 / `versionId` `f5a9181f-…` ; Gerer SHA `44a7064d…` ; fingerprint `1\|16\|4\|0` |
| `R04-B-before.json` | Snapshot PG+mock avant chat | step `ASK_EMAIL` ; `emailPresent=false` ; `lastUserMessageLen=0` ; mock 0 |
| `R04-B-activate.json` | Activate TEST (historique 037) | HTTP 200 ; `active=true` ; même `versionId` |
| `R04-B-ollama-gate.json` | Gate modèle | modèle attendu présent (détail dans `R04-B-result`) |
| `R04-B-http.json` | Réponse chat | HTTP **500** ; `elapsedMs=40629` ; body générique `Error in workflow` ; `retried=false` |
| `R04-B-after.json` | Snapshot après | before ≡ after (PG figé) |
| `R04-B-result.json` | Corrélation complète | verdict scénario **UNCERTAIN** ; running counts 0 ; deactivate OK ; mockPosts/claims 0 ; fingerprint before≡after |
| `deactivate-R04-B-post.json` | Désactivation | `active=false` ; `webhookRows=0` ; `verified=true` |
| `safety-postflight-stop-R04-B.json` | Postflight STOP | `active=false` ; `running.count=0` ; `webhooksClear=true` ; `safeDeclared=true` |
| `campaign-result.json` | Synthèse campagne | `stoppedAfter=R04-B` ; UNCERTAIN |
| `HYGIENE.json` | Contrôle secrets/PII fichiers | PASS ; 10 fichiers scannés (hors ce fichier) |

**Présent :** preuve HTTP 500 + latence ~40 s + PG/mock figés + isolation TEST documentée.  
**Absent dans 037 :** aucun dump d’exécution n8n (runData / node error), aucun `executionId` corrélé au chat 500.

---

## 2. Source B — probes et inspect JSON (`diag-038/`)

### 2.1 Scripts probe RO (présents ; résultats d’exécution **non** archivés ici)

| Fichier | Intent | Note inventaire |
| --- | --- | --- |
| `probe-executions-ro.js` | `SELECT` RO `execution_entity` (count + 8 récents) via `docker exec` sqlite `readOnly` | Script uniquement ; **pas** de capture JSON/stdout versionnée sous `diag-038/` |
| `probe-exec-57-ro.js` | Métadonnées exec `id=57` + `length(data)` ; note explicite `no data payload dumped` | Idem ; **pas** de dump payload |

Attente documentée (settings + historique observabilité) : avec `saveDataSuccessExecution=none` **et** `saveDataErrorExecution=none`, un probe RO peut légitimement montrer **0 exécutions retenues** (ou aucune ligne exploitable pour le chat 500). Aucun artefact de sortie probe n’est présent pour confirmer le count courant sans runtime.

### 2.2 Inspect / extract / sims (artefacts offline présents)

| Fichier | Contenu inventorié |
| --- | --- |
| `COMPRENDRE-META.json` | ChatTrigger `lastNode` ; Comprendre chainLlm ; Ollama `qwen2.5:1.5b` ; **settings** `saveDataSuccessExecution=none`, `saveDataErrorExecution=none`, `saveManualExecutions=false`, `saveExecutionProgress=false` |
| `AIGUILLER-META.json` | Règles Switch Aiguiller (INSERT… + fallback) |
| `CREATE-CHAIN.json` | Graphe CREATE : Décider → Aiguiller → Demander (outs vides = terminal) |
| `DECIDE-DEMAND.json` | Sim Décider+Demander non-email (CREATE/GENERAL) — pas de throw |
| `DEMANDER-OUTS.json` | Outs Demander |
| `PREP-INSPECT.json` | Inspect Préparer réponse création |
| `ROUTING-INSPECT.json` | Inspect routing |
| `SIM-POLLUTE.json` / `SIM-TURN-FIELDS.json` | Sims pollution / champs tour |
| `OFFLINE-TESTS.json` | 16 PASS / 0 FAIL (Gerer pin `44a7064d…`, harness R04-A/B/C, etc.) |
| `_nodes-meta.json` / `_trace-out.json` | Extract nœuds + trace connexions VC11 |
| `_nodes/*` | Code/JSON nœuds ciblés (Gerer, Parser, Fusionner, Sauvegarder, Router, Demander, …) |
| `NODE-PATH-ANALYSIS.md` | Locus CONFIRMED ≤ Sauvegarder ; cause nœud UNKNOWN ; suspect PROBABLE Comprendre |
| `PG-STATE-COHERENCE.md` | before≡after ⇒ pas de commit visible Sauvegarder |
| `R04B-BRANCH-MATRIX.md` | Matrice branches ASK_EMAIL / `pas-un-email` |

Scripts d’extract/inspect `.cjs` associés : présents (génération offline des JSON ci-dessus).

---

## 3. Gap — cause nœud **CONFIRMED**

Pour pin le nœud exact du HTTP 500, il manque **au minimum** :

1. **Dump d’exécution** (runData / erreur nœud) pour le run chat R04-B — inexistant dans les artefacts 037/038.
2. Persistance d’erreur exploitable : incompatible avec le pin actuel `saveDataErrorExecution=none` (voir `COMPRENDRE-META.json` settings).
3. Corrélation `executionId` ↔ message R04-B (runToken `7b33ba93e0fa` / session hash `9f40d3739cbaebec`) — non présente.
4. Sortie archivée des probes RO (`executionCount`, éventuel `dataLen`) — scripts seulement.

Conséquence (déjà dans NODE-PATH-ANALYSIS) :

- Locus path : **CONFIRMED** (échec à ou avant `Sauvegarder`).
- Cause nœud exact : **UNKNOWN**.
- Suspect principal : **PROBABLE** `Comprendre la demande` / Ollama (non prouvable sans dump).

Fermer le gap exige une mission **distincte autorisée** (TEST only) : rétention erreur temporaire **ou** capture one-shot — **hors scope** de cet inventaire ; non exécuté ici.

---

## 4. LIVE / périmètre cette mission

| Contrôle | Statut |
| --- | --- |
| Mutation Docker / Compose | **non** |
| Changement `saveData*` / rétention | **non** |
| Activate / deactivate / chat / POST CreateAppointment | **non** |
| Mutation SQL métier | **non** |
| LIVE (port 5680 / empreintes LIVE) | **non touché** |
| Preuve isolation 037 | `preflight.json` → `isolation.liveTouched=false` |

---

## 5. SHA-256 (fichiers clés)

### `diag-037/artifacts-r04b-037/`

```text
b7fea21345793ba02c45e590ada3dc6c311047a0a54e1547159d6b9c48e8df62  campaign-result.json
3bf59f5985d7e6cd243434c28d22fe258e5a8458fe5741d29fbac1f530d4d865  deactivate-R04-B-post.json
4dd781298a732f8ef78bc60abf31a21eca982080fc6b1f26a68f674cf10dd810  HYGIENE.json
8475a3e8f2e0a3a036ec5d618d9f9654ad98928d34c12ae7787d8dee078172bf  preflight.json
2a48d446abab4a53fb488cfcbb0f4105e27d3f8acf96d428a956400b8bd12286  R04-B-activate.json
e2d6ba197f6923db496f24b93e9cfe417fd24b05c5827650deecd4a04bfb9b19  R04-B-after.json
b7dc01010a73cb5112146f5c479f733f00a9f0b2497c92f96002f5bd5fd8d586  R04-B-before.json
e5d4566ffa5f93ab21c35c2bb9e4164d81bf7bb588c653b3e134b5a5599dfb51  R04-B-http.json
2dcb792e77c411425fbd0977e7395ed325240dc84f4bc91c155f5bc72cd09a7d  R04-B-ollama-gate.json
2afa9d619642c0611b49c186df83bb7ba6ceff774eebdb455ad4a263348bda5b  R04-B-result.json
76835516097e456a3517c19e5646e8f36ef726d08af7484d5529429e188b84ce  safety-postflight-stop-R04-B.json
```

### `diag-038/` (inspect / analyse / probes)

```text
15aa6c852f0d514105b11638b067f249b9f4616b8efe5921aed5825531f58be0  AIGUILLER-META.json
231e45e4a515d06492f74575ad987c5c093766b4a407f04a1a1397e9f606f348  COMPRENDRE-META.json
d5c8c31d4ed864004ffcc61a3dccb798d0346a0a81e864188fc1597f7b028ace  CREATE-CHAIN.json
ae7ee80496d0ebff94638bd7f01e2b318306f3f3f0b35b3e6f25dc5c3d5030b9  DECIDE-DEMAND.json
dcd374647504814caf47479801e23a2c8fb6e5f32fc3d7dfa076c230b3696c9c  DEMANDER-OUTS.json
575f1e2700b4255333d80755a2ebec0e544b2bc34207edec4e229fb607f672ae  OFFLINE-TESTS.json
af5f9f01ad97d459ef4bf9f732fc060e2ce4a4ed91a7d379b1b13848900546c0  PREP-INSPECT.json
07e7140fd9b191706bdc1d1d4b3fc45567aeb65386bd1d83fedfbcead7c6c643  ROUTING-INSPECT.json
c327f9148ee8766630d832670358754003c2725e76f379f980a5239d49f28b75  SIM-POLLUTE.json
6a670e610f4608c8353dbc5a7440a1a77b4b7bfe75bf89d19e443ffdc4f5e682  SIM-TURN-FIELDS.json
aaf00a21de06eba24c0171684885b7b2ab4862132c62bf4d226278f53bb8d2a5  _nodes-meta.json
457aa0890654656710c3f40da73a4156ee79718566393b977ea2a780e1226224  _trace-out.json
746acd27b3899f9a52e0994af4dccc718526eac1e2deef69c13713defdb1a882  NODE-PATH-ANALYSIS.md
9c2ff33489b76f3bc793f3dd4699d00c3370ec4367661904606695951d8d1c05  PG-STATE-COHERENCE.md
bc0c3db1ca5e448afbb8dc5b812753d056ca2fee4aae64ce75661ab17b3601fb  R04B-BRANCH-MATRIX.md
d58e22af61891148a2a7fdc60701adfc78b4877b5a5c87ef46b41d45c21b827e  probe-exec-57-ro.js
d0af340f76f1f018a69f4377a48771bb3c4eb03648bad613514a70472b765c79  probe-executions-ro.js
```

*(SHA de ce fichier `EVIDENCE-INVENTORY.md` non auto-inclus.)*

---

## 6. Matrice lecture vs écriture (rappel)

| Action | Classe | Cette mission |
| --- | --- | --- |
| Lire artefacts sous `n8n/proposed/…` | lecture | **fait** |
| Écrire `EVIDENCE-INVENTORY.md` local | écriture locale autorisée | **fait** |
| `docker exec` / probe RO runtime | lecture runtime | **non exécuté** |
| PUT workflow / `saveData*` / activate | écriture dangereuse | **interdit / non fait** |
| LIVE | interdit | **non touché** |

---

## 7. STOP conditions (si reprise runtime future)

- Écart fingerprint / `liveTouched` / port LIVE → **STOP**.
- Workflow actif ou webhooks inattendus hors fenêtre autorisée → **STOP**.
- Timeout / erreur réseau ambiguë → **UNCERTAIN**, pas de retry auto.
- Probe `executionCount=0` avec `saveData*=none` → **attendu** ; ne pas conclure à « pas d’échec » ; cause nœud reste UNKNOWN sans dump.

---

**Verdict inventaire : PASS** — sources listées, gap dump exécution explicite, LIVE non touché, aucune action runtime.
