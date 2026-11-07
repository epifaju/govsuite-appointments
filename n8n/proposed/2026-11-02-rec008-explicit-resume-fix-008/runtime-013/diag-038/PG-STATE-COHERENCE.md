# DIAG-038 — PG-STATE-COHERENCE (R04-B 037 vs Sauvegarder)

Mission offline. Lecture seule. Aucune mutation SQL / LIVE / `psql` d’écriture.

## Verdict

**PASS** — cohérence PG démontrée : pas de commit visible de `Sauvegarder état conversation` (ou rollback avant commit visible). Aucune proposition de mutation SQL.

---

## 1. Preuves 037 (session hash `9f40d3739cbaebec`)

| Signal | Before | After |
| --- | --- | --- |
| `conversationStep` | `ASK_EMAIL` | `ASK_EMAIL` |
| `updatedAt` | `2026-11-07 00:25:36.187022+01` | identique |
| `expiresAt` | inchangé | inchangé |
| `lastUserMessageLen` | `0` | `0` |
| `emailPresent` | `false` | `false` |
| Fingerprint | `1\|16\|4\|0` | `1\|16\|4\|0` |

before ≡ after (immédiat + settled). Mock CreateAppointment : 0 posts / 0 claims.

---

## 2. Analyse vs SQL `Sauvegarder`

Extract : `_nodes/Sauvegarder_etat_conversation.json`.

- CTE `prepared` caste `dateDebut`/`dateFin` → `::date`, `slotId`/`token`/`newSlotId` → `::uuid`, `selectedSlotIndex` → `::integer` ; `email` / `originalMessage` restent text (`NULLIF`).
- UPSERT avec `FOR UPDATE` sur `ai_conversation_state` ; un succès committerait typiquement `updated_at`, `last_user_message` (= `originalMessage`), et éventuellement TTL.

**Implication :** Gerer (offline, ASK_EMAIL + email invalide) pose `originalMessage` non vide et laisse `email` null / step `ASK_EMAIL`. Si Sauvegarder avait **commité**, on attendrait au minimum `lastUserMessageLen > 0` et `updatedAt` avancé — même sans capture d’email.

**Démontré :** aucun commit visible de Sauvegarder, **ou** transaction annulée avant commit visible (erreur nœud / rollback client n8n). L’état seed reste figé.

---

## 3. Hypothèse cast-failure (champs typés pollués)

| Hypothèse | Évaluation |
| --- | --- |
| Cast `::date` / `::uuid` / `::integer` sur payload pollué → erreur SQL au nœud Sauvegarder | **Possible** (mécanisme réel dans la query) |
| Probabilité relative vs latence HTTP ~40 s | **Moins probable** que l’attente LLM (`Comprendre`) : un échec cast est rapide ; ~40 s colle à Ollama, pas à un rejet Postgres immédiat |
| Offline Gerer / Parser / Fusionner sous seed ASK_EMAIL | Champs typés seed restent date-like / uuid-like ; email invalide → null, step ASK_EMAIL (OFFLINE-TESTS PASS) |

Cause nœud exacte : **UNKNOWN** sans `saveDataErrorExecution`. Locus : échec **à ou avant** Sauvegarder (cohérent avec PG figé).

---

## 4. Proposition SQL

**Aucune.** Pas de migration, seed, ALTER, ni script mutatif. Pas de rollback SQL à préparer : la session n’a pas changé.

---

## 5. Risques / contrôles

- **Locks :** `FOR UPDATE` dans Sauvegarder non exercé en commit (pas d’empreinte de mutation).
- **Partial unique / purge PII :** hors scope ; aucune écriture.
- **Contrôles de preuve (sans PII) :** hash session, FP `1|16|4|0`, `updatedAt` byte-identique, `lastUserMessageLen=0`, `emailPresent=false`.

---

## 6. Synthèse

1. **Démontré :** pas de commit Sauvegarder visible (before≡after ASK_EMAIL).
2. **Cast-failure :** possible mécaniquement, **moins probable** que wait LLM vu ~40 s.
3. **Mutation SQL proposée :** aucune.
