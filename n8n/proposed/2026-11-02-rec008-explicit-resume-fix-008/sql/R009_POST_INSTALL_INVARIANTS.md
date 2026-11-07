# TEST-INSTALL-READINESS-009 — Invariants post-install R01–R03

Mode : **offline** — contrats pour campagnes runtime **futures** (non exécutées ici).  
Prérequis gate : `R009_SQL_UNCHANGED_GATE.md` = CONTINUE.  
Réutilise : `S03_PERSISTENCE_INVARIANTS.md`, `S03_SELECT_BEFORE_AFTER.sql`, `R01_R02_R03_SELECT_CONTRACTS.sql`.

Mapping campagne ↔ scénario offline ASK-PRENOM :

| Campagne R009 | Ancre offline | Session synthétique (fixtures R009) | Message | Contrat post-FIX-008 |
| --- | --- | --- | --- | --- |
| **R01** | S01 / FIX008-S01 | `rec008-syn-r009-r01-active-camille` | `Camille` | capture prénom normale |
| **R02** | S02 / FIX008-S02 | `rec008-syn-r009-r02-expired-camille` | `Camille` | session_expired, pas de capture |
| **R03** | S03 / FIX008-S03 (contrat FIX-008, **pas** VC9-ACTUAL) | `rec008-syn-r009-r03-expired-resume` | `reprendre` | TTL+, draft, prenom null |

Sessions **indépendantes** ; 1 message ; 0 retry ; CLAIM/POST = 0 ; deactivate post-campagne.

---

## Commun (toute campagne)

| # | Invariant | Attendu |
| --- | --- | --- |
| G0 | SQL Charger/Sauvegarder | Empreintes gate R009 inchangées |
| G1 | Isolation | TEST only ; LIVE interdit |
| G2 | Tentatives | `open_attempts = 0` (pas de CLAIM / POST CreateAppointment) |
| G3 | Preuves PII | présence / longueur uniquement (pas de dump email/tel/nom brut) |
| G4 | Lecture vs Charger | SELECT preuve **sans** `WHERE expires_at > NOW()` ; exposer `session_expired` / `expires_at` |

---

## R01 — active ASK_PRENOM + Camille (TTL / draft / prenom)

**Préflight :** `expires_at > NOW()`, `pending_action=CREATE_APPOINTMENT`, `conversation_step=ASK_PRENOM`, `nom` présent, `prenom` null.

| Domaine | Invariant post-Sauvegarder |
| --- | --- |
| **TTL** | `refreshSessionTtl` défaut/true → `expires_at` prolongé (~NOW()+2h) ; session reste active |
| **Draft** | `nom` conservé ; `service`/`site` conservés ; `_authorizedNulls` absent |
| **Prenom** | `prenom` = valeur message (empreinte longueur / égalité synthétique `Camille`) ; **pas** null |
| **Step** | `conversation_step = ASK_EMAIL` |
| **Pending** | `pending_action = CREATE_APPOINTMENT` |

Contre-FAIL : `prenom` null, step reste `ASK_PRENOM`, ou open_attempts > 0.

---

## R02 — expired ASK_PRENOM + Camille (TTL / draft / prenom)

**Préflight :** `expires_at <= NOW()`, même pending/step, `prenom` null (session ≠ R03).

| Domaine | Invariant post-Sauvegarder |
| --- | --- |
| **TTL** | `refreshSessionTtl=false` → `expires_at` **non** prolongé (reste ≤ NOW() ou égal snapshot before) |
| **Draft** | `preserveDraft` côté Gérer ; colonnes métier retenues (`nom` présent, service/site) ; pas de purge `_authorizedNulls` |
| **Prenom** | `prenom` **reste null** — message `Camille` **non** capturé |
| **Step** | `conversation_step = ASK_PRENOM` (inchangé) |
| **Flags / reply** | `sessionExpired=true` ; type réponse `session_expired` (HTTP≠métier succès collecte) |

Contre-FAIL : `prenom='Camille'`, `expires_at` sauté à ~NOW()+2h, step `ASK_EMAIL`.

---

## R03 — expired ASK_PRENOM + reprendre (contrat FIX-008)

**Préflight :** identique forme S02 mais `session_id` distinct ; message allowlist `reprendre`.  
Référence SELECT : section B de `S03_SELECT_BEFORE_AFTER.sql` (`fix008_s03_contract_ok`).

| Domaine | Invariant post-Sauvegarder |
| --- | --- |
| **TTL** | `refreshSessionTtl=true` → `expires_at > NOW()` et ≈ NOW()+2h (±10 min) |
| **Draft** | `preserveDraft=true` ; `_authorizedNulls` absent ; `nom` présent ; service/site retenus |
| **Prenom** | `prenom IS NULL` ; `prenom_is_reprendre = false` |
| **Step** | `conversation_step = ASK_PRENOM` (pas `ASK_EMAIL`) |
| **Pending / intent** | `pending_action` / intent CREATE conservés |

**Signature bug VC9 (FAIL R03 post-FIX-008) :**  
`conversation_step='ASK_EMAIL' AND prenom ILIKE 'reprendre'` (`vc9_bug_signature`).

Mapping flags → SQL : voir `S03_PERSISTENCE_INVARIANTS.md` (I1–I5).

---

## Contrôles de preuve (sans PII)

Booléens / compteurs uniquement : `session_expired(_now)`, `ttl_approx_plus_2h` / `ttl_delta_seconds`, `nom_present`, `prenom_is_null`, `prenom_is_reprendre`, `conversation_step`, `pending_action`, `open_attempts`, `fix008_s03_contract_ok`.

## Risques

| Risque | Mitigation |
| --- | --- |
| Confondre R03 avec VC9-ACTUAL offline S03 | Campagne R03 = contrat FIX-008 ; S03 JSON historique reste doc divergence |
| Chaîner R02→R03 même session | Sessions synthétiques distinctes obligatoires |
| `preserveDraft` lu comme colonne SQL | Flag JS seulement ; SQL lit `_authorizedNulls` / `refreshSessionTtl` |

## Verdict analyse offline

**PASS** — invariants R01–R03 documentés ; SQL non divergé → pas de STOP gate.  
**NO-GO** exécution SQL / campagne runtime (hors périmètre 009).
