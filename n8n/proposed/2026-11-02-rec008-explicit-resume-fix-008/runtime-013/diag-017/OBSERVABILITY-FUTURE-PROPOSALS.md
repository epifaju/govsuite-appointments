# DIAG-017 — Propositions observabilité FUTURE (hors application)

**Mission :** GOVSUITE-MULTIAGENT-OBSERVABILITY-DIAG-017  
**Cible :** TEST uniquement (`govsuite-rec008-test`, workflow `OCD9It1uKFhOoWNF`)  
**Statut :** propositions documentées — **aucune** application Docker / runtime / settings / PUT / activation / chat / mutation PG  
**Ancrage 015/016 :** abort client 45 s ; Ollama cold+chat ~3 m10 s ; écriture PG tardive ~21:04:30Z ; `execution_entity=0` (rétention nulle / `saveData*=none`)

---

## Matrice lecture vs écriture (futures missions)

| Intent | Classe | Notes |
| --- | --- | --- |
| GET workflow / settings / executions | **L** | Préflight / postflight |
| `docker logs --tail` (n8n, ollama, publish) | **L** | Pas de secret / PII dans artefacts |
| SELECT compteurs / snap session (masqué) | **L** | Empreinte + `updated_at` |
| Probe Ollama `/api/tags` (sans generate) | **L** | Santé modèle listé |
| Warm-up Ollama `/api/chat` ou `/api/generate` | **E** | Inférence ; auth campagne |
| PUT settings workflow `saveData*` | **E** | Mutation settings TEST |
| Activate / deactivate | **E** | Déjà protocole R0x |
| POST chat message | **E** | 1 msg max ; 0 retry |
| Purge exécutions / prune volume | **E** | Post-campagne contrôlée |
| Compose up/down/recreate/ports | **E** | **Hors scope** DIAG-017 ; interdit sans ordre distinct |
| LIVE | — | **Interdit** |

---

## STOP conditions (si une mission future applique)

| Code | Condition | Action |
| --- | --- | --- |
| `retention-leak-live` | Settings `saveData*` touchés hors TEST / confusion projet | STOP immédiat |
| `pii-in-trace` | Trace branchement contient email/téléphone/nom réel | STOP ; expurger ; ne pas committer |
| `active-after-deactivate` | Exécution `running`/`waiting` après deactivate + fenêtre latence | STOP / **UNCERTAIN** ; pas de R0x suivant |
| `late-write-unbound` | Δ`updated_at` après abort **sans** `sessionId` / runId corrélable | **UNCERTAIN** ; ne pas classer PASS métier |
| `warmup-failed` | Warm Ollama timeout / modèle absent | NO-GO campagne |
| `timeout-blind-bump` | `CHAT_TIMEOUT_MS` augmenté sans mesure warm+cold | NO-GO (interdit par QA 016) |
| `docker-mutate` | Tentative compose mutate pendant observabilité | STOP |

---

## 1) Rétention temporaire exécutions TEST

| Champ | Contenu |
| --- | --- |
| **But** | Persister success+error dans `execution_entity` / REST `/executions` pendant une campagne R0x pour obtenir `executionId`, `startedAt`/`stoppedAt`, `lastNodeExecuted`, durée par nœud — combler le trou 016 (`execution_entity=0`). |
| **Mécanisme proposé** | Fenêtre bornée : préflight PUT settings workflow TEST `saveDataSuccessExecution=all` + `saveDataErrorExecution=all` (ou équivalent UI) ; postflight **restaurer** `none` + purge sélective des runs de campagne (IDs capturés) ; jamais de rétention permanente. |
| **Risque** | Volume sqlite/n8n_data ; fuite PII dans payloads d’exécution ; oubli de rollback → divergence vs baseline 8F-2B46/47 (`saveData*=none`) ; confusion LIVE. |
| **Prérequis auth** | Ordre humain **explicite** « activer rétention TEST campagne Xx » + autorisation rollback postflight ; **pas** d’auto-activation workflow ; backup settings pré-mutation. |
| **Classe** | **E** (settings) ; lecture exécutions ensuite = **L**. |

---

## 2) Corrélation `sessionId` synthétique

| Champ | Contenu |
| --- | --- |
| **But** | Lier client abort ↔ logs Ollama ↔ late PG write ↔ (si rétention) `executionId` via un `sessionId` synthétique unique par run (`rec008-runtimeNNN-r0X-<shortRunToken>`), déjà partiellement présent (`rec008-runtime013-r01-active`) mais non propagé dans artefacts multi-sources. |
| **Mécanisme proposé** | Runner : générer `runToken` ; logger `sessionId` + `runToken` + `t0` ISO dans artefact ; postflight : greps logs Ollama/n8n sur fenêtre `[t0, t0+budget]` ; PG snap filtré `session_id = …` ; si rétention : filtre executions `startedAt` ∈ fenêtre. |
| **Risque** | Collision si réutilisation du même `sessionId` fixture entre campagnes ; sur-corrélation temporelle sans ID (faux positifs type 016 « forte mais sans executionId »). |
| **Prérequis auth** | Auth campagne runtime (message chat) si corrélation post-message ; sinon auth diagnostic **L** seule (relecture logs/PG existants) — **aucun** nouveau message sans ordre. |
| **Classe** | Instrumentation runner = doc/code hors ligne d’abord ; runtime = **E** chat seulement si campagne autorisée. |

---

## 3) Traces branchement expurgées

| Champ | Contenu |
| --- | --- |
| **But** | Conserver une preuve de chemin (nœuds traversés / sorties IF) sans stocker PII ni corps LLM complets — utile quand rétention est `none` ou pour artefacts commitables. |
| **Mécanisme proposé** | Format fixe : `{ runToken, sessionIdHash, tNode[], branchDecisions[], lastNode, status }` ; hash non réversible du `sessionId` ; `chatInput` → longueur + classe (`prenom_like` / `resume_cmd`) ; sortie LLM → `intent`/`slots` keys only, jamais texte libre. Fichiers sous `tests/rec008/` ou `n8n/proposed/…/artifacts/` gitignorés si bruts. |
| **Risque** | Sous-expurgation (PII résiduelle) ; sur-expurgation (inutile pour clôturer nœud exact) ; dérive si ajoutée dans nœuds Code prod sans revue security. |
| **Prérequis auth** | Auth **écriture locale** hors ligne pour prototype ; si nœud Code / webhook debug en TEST : auth install distincte (PUT) + security-auditor ; **pas** LIVE. |
| **Classe** | Prototype offline = écriture locale proposée ; inject runtime = **E**. |

---

## 4) Détection écritures tardives

| Champ | Contenu |
| --- | --- |
| **But** | Détecter le pattern 015/016 : client `UNCERTAIN` (abort) alors que `ai_conversation_state.updated_at` (ou équivalent) avance **après** `CHAT_TIMEOUT_MS` — éviter de conclure « message non traité ». |
| **Mécanisme proposé** | Postflight étendu : `tAbort` client ; poll **lecture seule** PG à `tAbort+30s`, `+90s`, `+180s`, `+240s` (bornes, **pas** de retry chat) ; flag `lateWriteSuspected` si `updated_at > tAbort` et contenu corrélé `sessionId` ; verdict transport `UNCERTAIN` + annotation `server_continued`. |
| **Risque** | Poll trop agressif (charge) ; fenêtre trop courte (miss) ou trop longue (bruit autre run) ; confusion avec écriture d’un autre scénario si `sessionId` non unique. |
| **Prérequis auth** | Auth postflight runtime de la campagne concernée (déjà dans protocole R0x) ; **aucune** mutation SQL ; **aucun** second POST chat. |
| **Classe** | **L** (SELECT répétés fail-fast individuels ; un échec réseau → STOP/UNCERTAIN, pas de retry auto). |

---

## 5) Contrôle exécutions encore actives après désactivation

| Champ | Contenu |
| --- | --- |
| **But** | Après `deactivate`, prouver qu’aucune exécution `running`/`waiting` ne continue (cas `lastNode` post-abort 016) avant de déclarer `safeDeclared` / enchaîner un autre R0x. |
| **Mécanisme proposé** | Postflight : si rétention on → REST/SQL `execution_entity` status ∈ {running,waiting,unknown} pour `workflowId` ; si rétention off → proxy : logs n8n « Execution … finished » + absence d’appels Ollama `/api/chat` après `tDeactivate+grace` + PG `updated_at` stable sur fenêtre grace (ex. 60–120 s). `safeDeclared=false` si activité détectée. |
| **Risque** | Faux négatif sans rétention ; faux positif si prune/async logging retardé ; bloquer indéfiniment la campagne. |
| **Prérequis auth** | Inclus dans auth postflight de la campagne ; grâce bornée documentée ; pas d’activate pendant la grâce. |
| **Classe** | **L** (+ deactivate déjà **E** autorisé en fin de scénario). |

---

## 6) Warm-up Ollama avant campagne

| Champ | Contenu |
| --- | --- |
| **But** | Éliminer le cold start (~1 min load modèle + chat long) observé 016 avant le premier message métier ; rendre le budget client prédictible. |
| **Mécanisme proposé** | Préflight campagne : `POST` Ollama interne `/api/chat` (ou generate) modèle `qwen2.5:1.5b`, prompt synthétique non-PII, timeout mesuré ; critère GO = réponse HTTP OK + durée &lt; seuil (ex. p95 cible documentée) ; consigner `warmMs` dans artefact ; **pas** via webhook n8n. |
| **Risque** | Charge CPU/RAM TEST (`mem_limit` 1536m) ; saturer Ollama pendant warm ; confusion avec trafic workflow si warm parallèle à activate ; **ne pas** exposer port Ollama hors réseau compose. |
| **Prérequis auth** | Ordre humain « warm-up Ollama TEST avant campagne Xx » **distinct** de l’auth message chat ; vérifier conteneur `rec008-ollama` Up (lecture) ; **aucun** Docker mutate. |
| **Classe** | **E** (inférence) mais hors webhook métier ; préférable à bumper aveugle du timeout. |

---

## 7) Timeout client fondé sur mesure réelle

| Champ | Contenu |
| --- | --- |
| **But** | Remplacer `CHAT_TIMEOUT_MS=45000` fixe (`run-runtime-013.js`) par un budget dérivé de mesures warm (et éventuellement 1 probe cold documenté hors campagne) pour éviter abort pendant traitement serveur légitime. |
| **Mécanisme proposé** | `CHAT_TIMEOUT_MS = ceil(max(warmChatMs, lastColdChatMs) * 1.25) + slack` avec plancher/plafond (QA 016 : **ne pas** bumper à 60–120 s ; ≥240–300 s **seulement** si diagnostic wait explicite + warm échoué ou cold volontaire) ; documenter formule + mesures sources dans préflight ; abort reste **0 retry**. |
| **Risque** | Timeout trop haut → runner bloqué longtemps ; masquer régressions métier ; timeout trop bas si warm non représentatif (premier token vs génération complète path ASK_PRENOM). |
| **Prérequis auth** | Auth modification runner / env campagne + preuves de mesure jointes ; GO planner si budget ≥240 s ; security : pas de secret dans logs de mesure. |
| **Classe** | Changement code/env runner = écriture locale proposée puis **E** à l’exécution campagne. |

---

## Ordre d’implémentation recommandé (FUTURE — non autorisé ici)

1. (2) Corrélation `sessionId`/`runToken` dans artefacts — faible risque, offline d’abord.  
2. (4)+(5) Postflight late-write + active-after-deactivate — **L**, haute valeur.  
3. (6) Warm-up Ollama — auth dédiée.  
4. (7) Timeout mesuré — dépend de (6).  
5. (1) Rétention temporaire — auth settings + rollback obligatoire.  
6. (3) Traces expurgées — après (1) ou en complément si rétention refusée.

---

## Backup / restore (documenté, non exécuté)

| Étape | Contenu |
| --- | --- |
| Avant (1) | Export JSON settings workflow TEST + SHA ; note `saveData*` baseline |
| Après campagne | Restaurer `saveData*=none` ; vérifier REST executions count attendu ; optionnel delete by id des runs campagne |
| Rollback échec | Re-PUT settings baseline ; STOP nouvelle campagne |

---

## Verdict devops

**PASS** — propositions d’observabilité FUTURE uniquement ; **aucune** application Docker/runtime/settings/chat dans cette mission.

| Contrôle | Résultat |
| --- | --- |
| Docker mutate | non effectué |
| Activation / PUT / POST chat | non effectué |
| Mutation PG | non effectuée |
| Secrets / PII dans ce livrable | absents (références synthétiques uniquement) |
