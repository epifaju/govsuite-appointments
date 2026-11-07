# REC-008 — Contrat SQL R04-A/B/C (ASK_EMAIL)

Mission **031** — **docs only.** Aucune mutation PG. Aucun runtime R04.

Catalogue machine : `tests/rec008/readiness/R031-r04-abc-sql-contract.json`.

---

## Règle PII

Preuves = champs **Present / Len** (et flags TTL / compteurs) uniquement.  
Interdit : `nom` / `prenom` / `email` / `telephone` / message utilisateur en clair.

---

## État initial (avant 1 msg)

| Champ | A / B | C |
| --- | --- | --- |
| `conversation_step` | `ASK_EMAIL` | `ASK_EMAIL` |
| `slotIdPresent` | true | true |
| `nomPresent` / `prenomPresent` | true (Len ≥ 1) | true |
| `emailPresent` / `emailLen` | false / 0 | false / 0 |
| `ttlActive` / `sessionExpired` | true / false | **false / true** |
| `openAttempts` | 0 | 0 |

---

## Après message

| Scénario | Entrée (classe) | Step après | Email | Identité / slot | TTL | ΔCLAIM / ΔPOST |
| --- | --- | --- | --- | --- | --- | --- |
| **R04-A** | `email_like_valid_synthetic` | `ASK_TELEPHONE` | Present=true, Len≥5 | conservés | actif | **0 / 0** |
| **R04-B** | invalide / non-email | `ASK_EMAIL` | Present=false, Len=0 | conservés | actif | **0 / 0** |
| **R04-C** | même si email_like valide | `ASK_EMAIL` | **pas de capture** | conservés | `expires_at` **figé** | **0 / 0** |

---

## SELECT lecture (futur, autorisation distincte)

Projection Present/Len + TTL — voir `preflightSelectContract.sharedTemplate` du JSON.  
Side-check : `openAttempts` sur `ai_appointment_attempt` (statuts ouverts).

---

## Gates

| Gate | Issue |
| --- | --- |
| Contrat docs 031 | **PASS** |
| Exécution SQL | **NOT_RUN** |
| R04-RUNTIME | **NO-GO** |
| LIVE / auto-next | **NO-GO** |
