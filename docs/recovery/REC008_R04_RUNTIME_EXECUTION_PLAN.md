# REC-008 — Plan d’exécution futur R04-RUNTIME

**Statut mission 035 :** plan rédigé · **R04-RUNTIME = NOT_AUTHORIZED** · **ne pas exécuter**.

Cible : TEST `127.0.0.1:5682` · WF `OCD9It1uKFhOoWNF` · W-031-01 installé (VC11 · Gerer `44a7064d…`).

---

## 0. Préconditions (gate)

1. Autorisation humaine écrite « R04-RUNTIME » (mission distincte).  
2. Préflight RO = baseline 035 (VC11 / `f5a9181f…` / Gerer `44a7064d…` / inactive / webhooks 0 / open 0).  
3. Seeds SQL R04-A/B/C appliqués **après** auth (scripts `diag-035/sql/`).  
4. Runner réel dérivé de `run-runtime-013.js` + contrat stub `diag-035/run-r04-runtime.stub.cjs` (180 s post-warm, 1 msg, `retried=false`).  
5. `saveData*=none` par défaut — rétention temporaire seulement si auth **séparée** (plan 031).

---

## 1. Séquence par scénario (A puis B puis C — 1 à la fois)

| Étape | Action |
| --- | --- |
| 1 | Préflight RO + mock baseline |
| 2 | Seed SQL scénario (auth) |
| 3 | SELECT verify Present/Len |
| 4 | Warm Ollama + gate `/api/ps` |
| 5 | Activate workflow (TEST only) |
| 6 | **Un** message chat (classe email) — timeout 180 s — **0 retry** |
| 7 | Deactivate |
| 8 | Settle late-write + poll running=0 |
| 9 | SELECT after + mock Δ |
| 10 | Hygiene scanner sur `artifacts-r04-*` |
| 11 | Postflight · `liveTouched=false` |
| 12 | STOP — pas d’auto-next R05 |

Corrélation : `sessionIdHash` (SHA-256 trunc 16) · pas d’email clair dans artefacts.

---

## 2. Assertions métier

| ID | After | ΔCLAIM/POST |
| --- | --- | --- |
| R04-A | `ASK_TELEPHONE` · `emailPresent` · identité+slot | 0 / 0 |
| R04-B | `ASK_EMAIL` · email absent · correction | 0 / 0 |
| R04-C | `ASK_EMAIL` · `emailPresent=false` · TTL figé · `lastUserMessageLen` noté sans corps | 0 / 0 |

---

## 3. STOP

LIVE · 2e message · retry · CLAIM/POST · Docker mutate · rétention sans auth · SHA/VC drift · activate laissé on · PII clair dans artefacts.

## 4. Cleanup

`cleanup-r04.sql` — auth séparée · sessions `rec008-r04*-035-*` seulement.
