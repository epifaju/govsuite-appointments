# EXPLICIT-RESUME-FIX-008 — Invariants de persistance S03

Mode : **offline / proposition locale** — aucun `psql`, Docker, mutation, LIVE.

Session synthétique de référence : `rec008-syn-s03-ask-prenom-resume`  
(fixture `tests/rec008/fixtures/ask-prenom-readiness-007/s03-expired-resume-state.json`)

## Chaîne nœuds (inchangée)

`Charger état conversation` → … → `Gérer collecte progressive` → **`Sauvegarder état conversation`** → Router

FIX-008 modifie uniquement le `jsCode` de **Gérer**. Le SQL de **Sauvegarder** est **bit-identique** before/after.

| Empreinte | Valeur |
| --- | --- |
| SHA-256 query Sauvegarder (before = after) | `0f864cbcfb1995154042212a34b761d8ae2ec0cbe88de072e2323d524e5b6439` |
| `preserveDraft` dans SQL Sauvegarder | **absent** (flag JS uniquement) |
| Contrats Fix C | `_authorizedNulls` (text[] / `= ANY`), `refreshSessionTtl` → `refresh_session_ttl`, `FOR UPDATE`, `ON CONFLICT (session_id)`, TTL `NOW() + INTERVAL '2 hours'` |

## Invariants S03 (reprise explicite, contrat FIX-008)

Précondition ligne : `expires_at <= NOW()`, `pending_action = CREATE_APPOINTMENT`, `conversation_step = ASK_PRENOM`, `nom` non null, `prenom` null, message allowlist (`reprendre`, …).

| # | Invariant | Mécanisme | Attendu après Sauvegarder |
| --- | --- | --- | --- |
| I1 | TTL prolongé | Gérer pose `refreshSessionTtl=true` → SQL `WHEN refresh_session_ttl THEN NOW() + INTERVAL '2 hours'` | `expires_at ≈ NOW()+2h` et `expires_at > NOW()` |
| I2 | Draft conservé | Gérer pose `preserveDraft=true` **sans** `_authorizedNulls` | Pas de purge via branche abandon ; nulls non autorisés → colonnes existantes gardées |
| I3 | Identité non capturée | Early return avant capture ASK_* ; payload reprend `previous.prenom/nom/email/telephone` | `prenom`/`email`/`telephone` inchangés (null restant null) ; `nom` inchangé ; **pas** la valeur du message « reprendre » |
| I4 | Step conservé | Early return force `conversationStep: previousConversationStep` | `conversation_step = ASK_PRENOM` (pas ASK_EMAIL) |
| I5 | SQL Sauvegarder inchangé | Diff nœud limité à Gérer | Query/params SHA inchangés (voir table ci-dessus) |

### Mapping flag JS → SQL

| Champ JSON entrant Sauvegarder | Effet SQL |
| --- | --- |
| `refreshSessionTtl: true` | `expires_at = NOW() + INTERVAL '2 hours'` |
| `refreshSessionTtl: false` | `expires_at` conservé (`COALESCE(previous_expires_at, NOW())`) |
| `_authorizedNulls` absent / `[]` | Null payload → **retain** colonne existante (pas de wipe) |
| `_authorizedNulls` contient clé | Null payload → colonne forcée à NULL (chemin abandon — **hors** S03) |
| `preserveDraft` | **Non lu** par SQL ; garantit côté Gérer l’absence de `_authorizedNulls` + conservation des clés métier sur early return |

## Contraste VC9 (avant FIX-008) vs contrat FIX-008

| Champ | VC9-ACTUAL (bug) | FIX-008 (cible) |
| --- | --- | --- |
| `conversation_step` | `ASK_EMAIL` | `ASK_PRENOM` |
| `prenom` | `reprendre` | `NULL` (précédent) |
| `refreshSessionTtl` | `true` | `true` |
| `preserveDraft` | `true` | `true` |
| `_authorizedNulls` | absent | absent |

## Rollback proposition

Aucun SQL métier à rollbacker : FIX-008 = patch JS local uniquement.  
Restaurer export `before-OCD9It1uKFhOoWNF.json` annule le correctif nœud ; table `ai_conversation_state` non migrée.

## Risques

| Risque | Mitigation |
| --- | --- |
| Lecture SQL directe sans filtre TTL vs nœud Charger | Charger calcule `session_expired` ; SELECT preuve doit **exposer** `expires_at` et le booléen, pas filtrer les expirées |
| Confusion `preserveDraft` ↔ `_authorizedNulls` | Documenter : preserveDraft n’est pas une colonne SQL |
| Race double message | `FOR UPDATE` sur session existante ; preuve S03 séquentielle mono-session |
| PII dans preuves | SELECT masqué : présence/longueur uniquement pour nom/email/tel |

## Lien TEST-INSTALL-READINESS-009

Campagne runtime future **R03** réutilise ces invariants (I1–I5).  
Gate SQL + R01/R02 : `R009_SQL_UNCHANGED_GATE.md`, `R009_POST_INSTALL_INVARIANTS.md`, `R01_R02_R03_SELECT_CONTRACTS.sql`.

## Verdict analyse offline

**PASS** — invariants et contrats SELECT documentés ; SQL Sauvegarder inchangé ; aucune exécution DB.
