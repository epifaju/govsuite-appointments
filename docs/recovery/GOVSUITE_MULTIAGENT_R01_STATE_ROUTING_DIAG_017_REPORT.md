# GOVSUITE-MULTIAGENT-R01-STATE-ROUTING-DIAG-017 — Rapport

Diagnostic **hors ligne** de l’anomalie métier R01 après exécution tardive (015/016) : `Camille` → `prenom` null + `ASK_CREATE_DATE_RANGE` au lieu de `ASK_EMAIL`.

**TEST uniquement. Aucune activation. Aucun webhook. Aucun message. Aucune inférence Ollama. Aucun PUT. Aucune mutation PG. Aucun Docker. Aucun LIVE. Aucun nettoyage fixtures.**

**Verdict mission : PASS** (cause racine démontrée offline + patch local proposé non installé)  
**Installation patch : NO-GO** (mission install séparée + autorisation humaine requise)  
**Nouvelle campagne R01 : NO-GO** (tant que patch non installé / préconditions 016 non levées)  
**Phase suivante auto : non autorisée**

Artefacts : `n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/runtime-013/diag-017/`

---

## 1. Baseline VC10

| Champ | Valeur |
| --- | --- |
| Workflow | `OCD9It1uKFhOoWNF` (`REC008_TEST_ISOLE_134_NON_IMPORTE`) |
| `versionId` | `fd75ba32-f018-40e4-9f79-8f2a5400320b` |
| `versionCounter` | **10** |
| Gérer jsCode SHA-256 | `f75d49849231f956bb9ae5383111ea84b362dc58de6711cc75d2e7e2a26917fe` |
| Marqueur | EXPLICIT-RESUME-FIX-008 (install-012) |
| Export de référence | `n8n/proposed/…/install-012/after-OCD9It1uKFhOoWNF.json` |
| Chat Trigger | `responseMode=lastNode` |
| Isolation | TEST ports/credentials ; LIVE non touché |

SHA Gérer extrait `diag-017` = SHA VC10 attendu (`shaMatch=true` dans `OFFLINE-TEST-RESULTS.json`).

---

## 2. État R01 attendu et observé

### Entrée (seed + message)

| Champ | Valeur |
| --- | --- |
| `sessionId` | `rec008-runtime013-r01-active` (synthétique) |
| Session | active (TTL non expiré au moment du POST 015) |
| `pending_action` | `CREATE_APPOINTMENT` |
| `conversation_step` | `ASK_PRENOM` |
| `nom` | présent (synthétique `Dupont`, len 6) |
| `prenom` | `null` |
| `slot_id` | `NULL` |
| `service` / `site` | présents |
| `date_debut` / `date_fin` | `NULL` |
| Message | `Camille` |

Source seed : `runtime-013/SEED.sql` ; snap avant : `artifacts-r01-015/R01-before.json`.

### Attendu (contrat R01 / PATH-NOTE-013)

| Champ | Attendu |
| --- | --- |
| `prenom` | `Camille` |
| `conversation_step` | `ASK_EMAIL` |
| Données confirmées | `nom` / service / site préservés |

### Observé (late write ~21:04:30Z, rapport 016)

| Champ | Observé |
| --- | --- |
| `last_user_message` | `Camille` (len 7) |
| `prenom` | **`null`** |
| `conversation_step` | **`ASK_CREATE_DATE_RANGE`** |
| TTL | **renouvelé** |
| Empreinte | `1\|14\|4\|0` (inchangée hors session) |

Le timeout client 45 s (015) et le cold-start Ollama (016) expliquent le **délai**, pas la **valeur métier** écrite.

---

## 3. Graphe exact

Chemin unique pré-réponse (export VC10 / `PATH-EDGES.json` + `diag-016/PATH.json`) :

```text
Lorsqu'un message de chat est reçu          [chatTrigger, lastNode]
→ Charger état conversation                 [Postgres SELECT]
→ Lire tentative de session                 [Postgres SELECT]
→ Joindre tentative de session              [Code]
→ Comprendre la demande                     [chainLlm + Ollama qwen2.5:1.5b]
→ Parser intention                          [Code]
→ Fusionner état conversation               [Code]
→ Gérer collecte progressive                [Code, FIX-008]  ← première divergence métier
→ Sauvegarder état conversation             [Postgres UPSERT] ← première écriture
→ Router intention                          [Switch sur intent]
→ … branche CREATE → Décider / COLLECT → Demander paramètres création
```

---

## 4. Analyse nœud par nœud

### 4.1 Chat Trigger

| | |
| --- | --- |
| Reçoit | `sessionId`, `chatInput=Camille` |
| Produit | payload trigger |
| Effet R01 | démarre le graphe ; `responseMode=lastNode` (réponse HTTP après feuille) |

### 4.2 Charger état conversation

| | |
| --- | --- |
| Reçoit | `sessionId` |
| Produit | ligne `ai_conversation_state` (ASK_PRENOM, pending CREATE, nom, prenom null, slot_id null, …) |
| Effet R01 | **préserve** ASK_PRENOM — pas de divergence |

### 4.3 Lire tentative de session

| | |
| --- | --- |
| Produit | éventuelle tentative ouverte (R01 : aucune) |
| Effet R01 | neutre |

### 4.4 Joindre tentative de session

| | |
| --- | --- |
| Reçoit | previous + row attempt |
| Produit | spread previous + `sessionFound` / `sessionExpired` / `openAttempt` |
| ASK_PRENOM | **conservé** (`conversation_step` inchangé) |
| H3 | **réfutée** — Joindre ne perd pas l’étape |

### 4.5 Comprendre la demande (LLM)

| | |
| --- | --- |
| Rôle | classification / extraction libre |
| Preuve 016 | `/api/chat` ~3 m10 s après cold start |
| Priorité aval | **subordonnée** au Parser (pending CREATE + ASK_PRENOM force `CREATE_APPOINTMENT`) |
| H1 | **non nécessaire** pour expliquer prenom null / ASK_CREATE_DATE_RANGE : même avec intent correct, Gérer diverge |

### 4.6 Parser intention

| | |
| --- | --- |
| `prenom` | uniquement si libellé `Prénom:` — `Camille` seul → `prenom=null` (attendu) |
| Intent | si session active + `pending=CREATE` + step ∈ {ASK_NOM, ASK_PRENOM, …} → force `CREATE_APPOINTMENT` sauf override explicite |
| pending / step | **non écrasés** en sortie (mémoire seulement dans `memoryContext`) |
| H2 | **réfutée** comme première cause — Parser ne produit pas ASK_CREATE_DATE_RANGE |

### 4.7 Fusionner état conversation

| | |
| --- | --- |
| Produit | intent + champs métier fusionnés ; **pas** de `conversationStep` en sortie |
| `prenom` | `pick(current, previous)` → reste null (Parser n’a rien extrait) |
| Effet R01 | **pas** de perte ASK_PRENOM (Gérer relit `previous.conversation_step`) |

### 4.8 Gérer collecte progressive — **point de divergence**

Entrée logique R01 :

- `previousConversationStep = ASK_PRENOM`
- `previousPendingAction = CREATE_APPOINTMENT` → `pendingAction` / `conversationStep` restaurés
- `slotId = null`, `service`+`site` set, dates null, `message = Camille`, `prenom = null`, `nom` set

Contrôle VC10 (§12.3–12.4, lignes ~958–1144 de `G_rer_collecte_progressive.js`) :

1. **§12.3** `if (slotId) { … capture ASK_PRENOM … }` → **faux** → **aucune capture** → `prenom` reste null  
2. **§12.4** `else if (slotId) { échelle identité }` → faux  
3. **else** (pas de créneau) : service+site OK, dates manquantes → **`ASK_CREATE_DATE_RANGE`**

Preuve offline T1 / T1b (`OFFLINE-TEST-RESULTS.json`) :

- Sans `slotId` : `prenom=null`, step=`ASK_CREATE_DATE_RANGE` (**reproduit l’observé late PG**)
- Avec `slotId` synthétique : `prenom=Camille`, step=`ASK_EMAIL` (**contrat R01**)

→ **Premier nœud responsable : Gérer collecte progressive** (gate `slotId` sur capture + calcul d’étape).  
H4 **soutenue** (primaire). H6 : combinaison Joindre/Parser/Fusionner **non requise** pour la divergence ; LLM ralentit seulement.

### 4.9 Sauvegarder état conversation

| | |
| --- | --- |
| Reçoit | JSON Gérer (`prenom`, `conversationStep`, `originalMessage`, `refreshSessionTtl`, …) |
| Produit | UPSERT fidèle + `expires_at` si `refreshSessionTtl` |
| H5 | **réfutée** comme inventeur d’étape — écrit ce que Gérer fournit ; TTL renouvelé = write réussie post-Ollama |

### 4.10 Traitement de `Camille` / réinit brouillon

| Cas | VC10 |
| --- | --- |
| ASK_PRENOM actif + Camille + slotId null | non capturé → ASK_CREATE_DATE_RANGE |
| ASK_PRENOM + slotId | capturé → ASK_EMAIL |
| Session expirée + Camille | early-return FIX-008 : pas de capture, step inchangé, TTL non rafraîchi |
| Session expirée + reprendre | early-return : pas de prenom, TTL refresh, step conservé |
| Réinit brouillon | seulement `createDecision=NEGATIVE` sur étapes identité (hors R01 Camille) |

---

## 5. Matrice des hypothèses

| ID | Hypothèse | Verdict | Preuve |
| --- | --- | --- | --- |
| H1 | LLM classe incorrectement `Camille` | **Non retenue** (insuffisante / non nécessaire) | Parser force CREATE sur ASK_PRENOM ; divergence même sans extraction prenom |
| H2 | Parser écrase pending/step | **Réfutée** | Parser ne sort pas `conversationStep` ; force CREATE |
| H3 | Joindre perd ASK_PRENOM | **Réfutée** | Spread previous + flags ; step inchangé |
| H4 | Gérer ne priorise pas l’étape active | **Soutenue (cause racine)** | §12.3/§12.4 gated `slotId` ; T1/T1b ; late PG = même résultat |
| H5 | Sauvegarder écrase prenom / recalcule step | **Réfutée** | SQL fidèle au JSON ; pas de recalcul métier |
| H6 | Combinaison multi-nœuds | **Partielle / non primaire** | Ollama explique latence ; état métier = Gérer seul |

---

## 6. Tests offline et résultats

Fichier : `diag-017/offline-gerer-r01-routing.test.cjs`  
Résultats : `diag-017/OFFLINE-TEST-RESULTS.json` — **`pass=true`** (13/13)

| Test | Résultat |
| --- | --- |
| T1 VC10 Camille → ASK_CREATE_DATE_RANGE, prenom null | OK |
| T1b même fixture + slotId → Camille + ASK_EMAIL | OK |
| T2 reprendre actif VC10 (même piège date-range) | OK |
| T3 texte ambigu VC10 | OK |
| T4 message vide VC10 | OK |
| T5 fixed Camille → ASK_EMAIL | OK |
| T6 fixed + slot → ASK_EMAIL | OK |
| T7 intent LLM artificiel sans effet sur gate | OK |
| T8 source VC10 contient gate `if (slotId)` | OK |
| T9 expiré + Camille → pas de capture | OK |
| T10 expiré + reprendre → pas prenom, TTL refresh | OK |
| T11 fixed reprendre actif ≠ prenom | OK |
| T12 SHA AFTER + marqueurs patch | OK |

**Ces tests sont des simulations de contrôle de flux, pas une preuve runtime n8n.** La preuve runtime métier reste le late write PG 016, corrélé au même triplet (message / prenom null / ASK_CREATE_DATE_RANGE).

---

## 7. Cause racine

**Confirmée (offline + cohérence late PG) :**

Dans `Gérer collecte progressive` VC10, la capture d’identité (§12.3) et l’échelle d’étapes identité (§12.4) sont conditionnées à `slotId`.  
La fixture R01 est volontairement à `ASK_PRENOM` avec `slot_id NULL` + service/site sans dates.  
Conséquence déterministe : `Camille` n’est pas stocké comme prénom ; le calcul d’étape bascule en `ASK_CREATE_DATE_RANGE`.

Incohérence de contrat : le seed / scénario R01 suppose une collecte d’identité **sans** créneau, alors que Gérer VC10 ne l’autorise **qu’avec** créneau.

---

## 8. Patch local proposé (non installé)

Emplacement : `diag-017/proposed-patch/`

| Artifact | SHA-256 |
| --- | --- |
| BEFORE (= VC10) | `f75d49849231f956bb9ae5383111ea84b362dc58de6711cc75d2e7e2a26917fe` |
| AFTER | `23524b5d075d3fc136904b9a7fb00bba5e06f5ec858afa669e62d1d619685961` |

Changements minimaux (nœud **Gérer** seul) :

1. Autoriser la capture identité si `slotId` **ou** étape identité active.  
2. Prioriser l’échelle identité dans ce cas (→ `ASK_EMAIL` après prénom).  
3. Ne jamais capturer `reprendre` / synonymes comme nom/prénom.  
4. `AWAIT_CREATE_CONFIRMATION` / INSERT toujours **avec** `slotId`.  
5. Early-returns FIX-008 (session expirée) **inchangés**.

Détail : `proposed-patch/PATCH-NOTE.md`.

**Aucun PUT n8n dans cette mission.**

---

## 9. Risques de régression

| Risque | Mitigation patch / revue |
| --- | --- |
| Collecte identité avant choix de créneau (changement produit) | Aligné sur contrat R01 ; confirmer avec métier avant install |
| Confirmation CREATE sans slotId | Patch refuse : confirmation seulement si `slotId` |
| `reprendre` actif capturé comme prénom (VC10+slot) | Patch bloque via `explicitResumeMsg` |
| Dates / recherche créneau après identité complète sans slot | Retombe sur `ASK_CREATE_DATE_RANGE` / `READY_CREATE_SEARCH` |
| Idempotence / TTL / resume expiré | FIX-008 early-return préservé |
| Seed R01 vs parcours « naturel » post-slot | Travailler fixture **ou** patch — pas les deux à l’aveugle |

---

## 10. Règle conversationnelle proposée (non implémentée hors patch Gérer)

- Session **active** à `ASK_PRENOM` : message traité d’abord comme réponse prénom (validation + exclusions commandes).  
- Session **expirée** : pas de reprise implicite (déjà FIX-008).  
- `reprendre` : commande de contrôle, jamais un prénom.  
- Modification explicite : logique de réinit autorisée uniquement.  
- Données confirmées préservées.

Le patch AFTER implémente le sous-ensemble nécessaire à R01 (priorité étape identité + exclusion reprendre) **sans** toucher Parser/Fusionner.

---

## 11. Observabilité future (non appliquée en 017)

Propositions séparées (devops) — **aucune application** :

1. Rétention temporaire des exécutions TEST (aujourd’hui `execution_entity=0`).  
2. Corrélation par `sessionId` synthétique (logs / PG / Ollama).  
3. Traces de branchement expurgées (nœud + step in/out).  
4. Détection des écritures tardives (`updated_at` post-désactivation).  
5. Contrôle des exécutions encore actives après désactivation.  
6. Warm-up Ollama avant campagne.  
7. Timeout client fondé sur mesure réelle (cold+chat), pas 45 s arbitraire.

---

## 12. Evidence Reviewer

Agent : [evidence-reviewer](85b43b72-126c-4ac9-86df-d18d681e0c2d)

| Item | Verdict indépendant |
| --- | --- |
| Diagnostic 017 | **PASS** |
| Timeout 016 vs routage 017 | **Distincts** — délai ≠ valeur métier |
| Offline simu comme preuve de cause | **Acceptable** pour clôture diagnostic (pas pour install/R01) |
| Install patch | **NO-GO** |
| Campagne R01 | **NO-GO** |
| Trace nœud runtime 015 | **Manquante** (corrélation forte late PG + code ; pas de `execution_entity`) |

---

## 13. Délégations multi-agents

| Agent | ID | Verdict |
| --- | --- | --- |
| [govsuite-planner](670f5897-af38-436f-ab36-8b05236b15a5) | Plan initial **GO** offline-only ; install/R01 non autorisés |
| [govsuite-planner](eabaada5-420a-4f37-b585-8baf22c98749) | DIAG **PASS** ; install **NO-GO** ; R01 **NO-GO** ; stop |
| [n8n-developer](a81f2c9d-c0a2-4a9d-99de-2c6ba2ebf7b7) | **PASS** — 1ʳᵉ divergence = Gérer ; patch AFTER OK |
| [postgres-engineer](f0466b62-12aa-4ac9-bb6c-001e6a360bae) | Persistance **PASS** ; H5 **réfutée** |
| [qa-automation](06c05279-929a-4f86-81cb-6d91359962c7) | Offline **PASS** 13/13 ; gaps T7 mineurs |
| [devops-engineer](5f1fb7af-2eae-492c-81a4-c7989ede6e79) | Obs. future **PASS** (non appliquée) ; livrable `OBSERVABILITY-FUTURE-PROPOSALS.md` |
| [security-auditor](0c22d941-c4cb-4ff5-b81b-ec6f36b3ee20) | Garde-fous **PASS** ; FIX-008 confirmation/`slotId` préservé |
| [evidence-reviewer](85b43b72-126c-4ac9-86df-d18d681e0c2d) | Diagnostic **PASS** ; install/R01 **NO-GO** |

Parent : extraction nœuds, tests offline, patch local, rédaction rapport. **Aucune installation.**

---

## 14. Verdict mission et GO/NO-GO

| Décision | Statut |
| --- | --- |
| Diagnostic ROUTING-DIAG-017 | **PASS** |
| Cause racine | **Confirmée** — Gérer `slotId` gate (§12.3 + §12.4) |
| Installation patch | **NO-GO** (pas d’auto-install) |
| Nouvelle campagne R01 | **NO-GO** jusqu’à mission install + warm Ollama / timeout mesuré + auth |
| LIVE | non touché |
| Phase suivante | **stop** |

---

## Références

- `GOVSUITE_MULTIAGENT_TEST_INSTALL_RETRY_012_REPORT.md`
- `GOVSUITE_MULTIAGENT_ASK_PRENOM_RUNTIME_013_REPORT.md`
- `GOVSUITE_MULTIAGENT_N8N_REST_TRANSPORT_DIAG_014_REPORT.md`
- `GOVSUITE_MULTIAGENT_RUNTIME_R01_RETRY_015_REPORT.md`
- `GOVSUITE_MULTIAGENT_CHAT_TIMEOUT_DIAG_016_REPORT.md` (+ variantes si présentes)
- `AGENTS.md`, `.cursor/rules/govsuite-safety.mdc`
