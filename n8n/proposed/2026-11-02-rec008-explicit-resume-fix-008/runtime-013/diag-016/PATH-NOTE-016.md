# CHAT-TIMEOUT-DIAG-016 — ASK_PRENOM path (offline)

**Verdict: UNCERTAIN** (prep only) — hang locus inferred, not runtime-proven.  
Source: `install-012/after-OCD9It1uKFhOoWNF.json` (FIX-008, `Gérer` jsSha `f75d4984…`). No activate / edit.

## Pre-collecte path (unique, main)

```
Lorsqu'un message de chat est reçu          [chatTrigger, responseMode=lastNode]
→ Charger état conversation                 [Postgres SELECT]
→ Lire tentative de session                 [Postgres SELECT]
→ Joindre tentative de session              [Code]
→ Comprendre la demande                     [chainLlm] ← Ollama Chat Model (qwen2.5:1.5b)
→ Parser intention                          [Code]
→ Fusionner état conversation               [Code]
→ Gérer collecte progressive                [Code, FIX-008]
```

Only LLM on this path: **Comprendre la demande** ← `Ollama Chat Model` (`ai_languageModel`). No node-level timeout / retry on either.

## Who returns HTTP chat body

Trigger `responseMode: lastNode` — no `respondToWebhook`. Body = last main-leaf JSON.

Expected **R01** after collecte (active `ASK_PRENOM`, no open attempt):  
`Sauvegarder` → `Router[CREATE]` → `Décider` → `Aiguiller` fallback **COLLECT** → `Valider paramètres création` → `Création prête?` (false) → **`Demander paramètres création`** (`ASK_EMAIL` text).  
`Appeler CreateAppointment` (HTTP timeout 20s) is **not** on that leaf.

## Timeout risks

| Locus | Risk | Notes |
| --- | --- | --- |
| **Comprendre la demande / Ollama** | **HIGH** | Always on path before any PG write; no timeout; sole external wait |
| Charger / Lire PG | low | SELECTs only; 015 PG readable |
| Code nodes pre-collecte | low | CPU-bound |
| Post-`Sauvegarder` CREATE leaf | n/a for 015 | Would have written `last_user_message` first |

## Tie-in 015 Camille (45s abort)

PG before=after: step `ASK_PRENOM`, `prenom` null, `last_user_message` empty, `updatedAt` unchanged.  
`last_user_message` is set only in **`Sauvegarder état conversation`** (`originalMessage`). Unchanged ⇒ execution **did not complete Sauvegarder** ⇒ stall **before** that write.

**Hang confidence: HIGH → `Comprendre la demande` / Ollama.** Alternate (stuck Code after LLM) LOW. Post-collecte / CreateAppointment ruled out by missing PG write.

## Non-actions

No activation, workflow edit, CreateAppointment POST, or retry.
