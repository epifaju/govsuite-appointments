# GOVSUITE-MULTIAGENT-RUNTIME-READINESS-005 — Rapport

Préparation de la validation runtime REC-008 **P4G2** (reprise explicite) — **READ-ONLY / OFFLINE**.

**P4G2 n’a pas été exécuté dans cette mission.**

**Verdict mission : PASS**  
**GO/NO-GO exécution P4G2 (autorisation distincte) : NO-GO conditionnel**  
**Phase suivante : non autorisée automatiquement**

---

## 1. Préflight documentaire

| Source | Usage |
| --- | --- |
| COVERAGE-004 / RUNNER-003 | Banc offline 22/22 ; SHA VC9 épinglé |
| P4F installation | Baseline VC9 installée TEST |
| P4G1 | Session expirée + `Camille` → `session_expired`, TTL non prolongé |
| P4G2 historique | Déjà **PASS** sur `reprendre` (TTL renouvelé) — état post-P4G1 **peut avoir dérivé** |
| AGENTS.md / govsuite-safety.mdc | LIVE interdit ; no retry ; verdicts ; pas d’auto-phase |

### Référence VC9 (artefacts locaux uniquement — pas d’API n8n)

| Contrôle | Observé | OK |
| --- | --- | --- |
| Workflow ID | `OCD9It1uKFhOoWNF` | oui |
| `versionCounter` | **9** | oui |
| `versionId` | `e7867799-2a18-4aec-9ee5-3ba9cbc40766` | oui |
| Nœuds / connexions | **134** / **137** | oui |
| `active` / `activeVersionId` | false / null (export) | oui |
| SHA after- JSON | `6284f867…f82b889` = banc 003/004 | oui |
| Markers P4F (6 zones) | Parser, Joindre, Gérer, Réponse, Charger `session_expired`/`session_found`, Sauvegarder `refreshSessionTtl`/`_authorizedNulls` | oui |
| Dépendances LIVE dans candidat | `liveishHints=[]` (scan paramètres) | oui |

Fichier : `n8n/proposed/2026-11-01-rec008-phase8f2b49-P4F-TTL-FIX-TEST-INSTALL/after-OCD9It1uKFhOoWNF.json`

---

## 2. Résultats des agents (délégations réelles)

| Agent | ID | Livrable |
| --- | --- | --- |
| [govsuite-planner](6d3f1f7d-d276-4a12-bf92-19b51419fc18) | Plan campagne ; STOP si dérive ; **NO-GO** exécution maintenant ; GO conditionnel futur | |
| [n8n-developer](cf210624-17b6-4449-a988-c3625cc69710) | Chemin `reprendre` → `create_appointment_question` ; écart T03 (ASK_PRENOM) documenté | **PASS** |
| [postgres-engineer](17f4fe0c-5da3-4b5b-83f2-e816da2417ea) | Contrat TTL + templates SELECT ; session historique probablement non éligible | **PASS** contrat / **UNCERTAIN** DB |
| [qa-automation](a706998c-2b44-4a2a-87da-a5ad05f753b0) | Catalogue assertions A01–A09 + classifieur readiness | **PASS** catalogue |
| [security-auditor](5ee2b67e-01ad-4c83-b714-7fc70c89d7c5) | Conditions GO sécurité ; **UNCERTAIN**/NO-GO replay naïf | |
| [devops-engineer](8d567ad8-4d3c-4bef-b9e2-099ad98880b8) | `tests/rec008/runtime/` checklists + stubs throw | **PASS** |
| [evidence-reviewer](ae44663c-5d93-45a0-9f9b-ef069c9c5a44) | Approuve plan readiness ; **NO-GO** exécution sans reset/session éligible | **PASS** readiness |

Parent : vérif SHA locale + architecture stubs supplémentaires.

---

## 3. Contrat P4G2

### Intention

Validation TEST : **un** message `reprendre` sur une session **expirée** avec brouillon CREATE, sans CLAIM/POST.

### Cible nominale (historique)

| Champ | Valeur historique post-P4G1 / pré-P4G2 |
| --- | --- |
| `session_id` | `rec008-8f2b1-slot-01` |
| Message | `reprendre` (unique, **0 retry**) |
| Expirée | oui |
| `pending_action` | `CREATE_APPOINTMENT` |
| `conversation_step` | `ASK_CREATE_SERVICE` |
| `intent` (après P4G1) | `GENERAL` |
| Brouillon | conservé ; service/site/slot/identité absents |
| Tentatives ouvertes | 0 |

**Avertissement 005 :** P4G2 historique a **déjà** renouvelé le TTL (`expires_at` futur). **Ne pas présumer** l’éligibilité actuelle. Préflight lecture seule obligatoire → **STOP** si non expirée.

### Alignement code VC9 (n8n-developer)

Sur session expirée + `pending_action=CREATE` + message allowlist `reprendre` :

1. Parser → `intent=CREATE_APPOINTMENT`
2. Gérer → `refreshSessionTtl=true`, `sessionExpired=false`, `preserveDraft=true`, step conservé
3. Sauvegarder → `expires_at = NOW()+2h`
4. Décider → `COLLECT` (`claimAcquired=false`)
5. Réponse via **Demander paramètres création** → `type=create_appointment_question` (**pas** `session_expired`)
6. Aucun `Appeler CreateAppointment`

Écart offline : T03 ancré sur `ASK_PRENOM` (partiel) ≠ fixture P4G2 `ASK_CREATE_SERVICE` — documenté, non bloquant pour le contrat runtime.

---

## 4. Assertions attendues (runtime)

Catalogue : `tests/rec008/readiness/R005-p4g2-explicit-resume-assertions.json`

| ID | Attendu PASS |
| --- | --- |
| A01 | HTTP **200** (nécessaire, non suffisant) |
| A02 | `type=create_appointment_question`, step `ASK_CREATE_SERVICE`, `ready=false`, `claimAcquired=false` |
| A03 | TTL renouvelé (`expires_at ≈ updated_at + 2h`, futur) |
| A04 | `intent=CREATE_APPOINTMENT`, `pending_action=CREATE_APPOINTMENT`, step conservé |
| A05 | Brouillon conservé ; aucun champ métier inventé ; attempts=0 |
| A06 | CLAIM=0 ; POST CreateAppointment Δ=0 ; avail/services Δ=0 |
| A07 | Workflow désactivé : `active=false`, webhooks 0 (**hardStop** si échec) |
| A08 | Un seul message ; aucun retry |
| A09 | Empreinte LIVE + Mailpit inchangés |

**FAIL** si CLAIM/POST>0, `session_expired` (reprise non reconnue), purge draft, TTL non renouvelé, reste actif.  
**UNCERTAIN** si timeout/transport ambigu → STOP, pas de second `reprendre`.

---

## 5. Risques identifiés

| Risque | Sévérité | Mitigation |
| --- | --- | --- |
| Session déjà active post-P4G2 historique | **High** | STOP préflight ; reset/reseed sous autorisation distincte ou autre session |
| Replay naïf = faux scénario | High | Ne pas réutiliser PASS historique comme preuve actuelle |
| Oubli désactivation | High | Postflight A07 hardStop |
| Retry activation (historique fetchRetry) vs no-retry métier | Medium | Documenter ; **0 retry** sur chat |
| Confusion TEST/LIVE | High | Allowlist URL/ports/credentials ; fingerprint LIVE lecture seule |
| T03 offline ≠ P4G2 fixture | Low | Ne pas confondre preuves |

**Aucune divergence critique code VC9 vs attentes P4G2** (chemin ASK_CREATE_SERVICE). Divergence d’**état DB** = bloqueur d’exécution, pas FAIL mission readiness.

---

## 6. Contrôles TEST / LIVE

Prévoir (futur, non exécuté ici) :

- Isolation réseau n8n TEST ↛ LIVE (net-probe)
- Credentials PG TEST uniquement
- 10 URL → `rec008-mock`
- Préflight PG TEST lecture seule (session + tentatives + compteurs)
- Mock avant/après (POST/avail/services)
- Version workflow VC9 / SHA
- 0 autre actif / 0 webhook avant ; deactivate après
- Fingerprint LIVE `13|14|12|48|0|a2dea067…` (ancre historique)
- Mailpit inchangé
- Indisponibilité / dérive → **STOP** sans réparation automatique

Checklists : `tests/rec008/runtime/PREFLIGHT-P4G2.md`, `POSTFLIGHT-P4G2.md`, `STOP-CONDITIONS.md`, `COMMAND-MATRIX.md`

---

## 7. Architecture futur runner runtime

Sous `tests/rec008/runtime/` (séparé de l’offline) :

- `ARCHITECTURE.md` — exigences autorisation, single-action, no retry, deactivate
- Stubs non exécutants (`*.stub.cjs` : throw si `main`) :
  - préflight / postflight
  - `single-action-http.stub.cjs`
  - `compare-before-after.stub.cjs`
  - `report-runtime.stub.cjs`

**Aucun fetch** dans 005. Implémentation active = mission ultérieure après GO humain.

---

## 8. Procédure d’arrêt

1. Timeout / erreur transport → UNCERTAIN, **pas de retry**, désactiver quand même  
2. Préflight fail / session non expirée → STOP, pas d’activation  
3. CLAIM/POST détecté → FAIL hardStop, deactivate  
4. Deactivate fail → FAIL hardStop (escalade humaine)  
5. LIVE touché → FAIL immédiat  
6. Phase suivante **non** auto-autorisée

---

## 9. Revue Evidence Reviewer

Verdict readiness : **PASS** (catalogue, plan, stubs, alignement VC9).  
Exécution : **NO-GO** aujourd’hui ; **GO conditionnel** si préflight prouve session expirée (ou équivalente) + autorisation humaine écrite + contrôles A–F.

---

## 10. Verdict

| Critère 005 | Statut |
| --- | --- |
| Scénario P4G2 spécifié | OK |
| Assertions ↔ code VC9 | OK |
| Prérequis vérifiables (templates/checklists) | OK |
| Contrôles sécurité définis | OK |
| Plan désactivation | OK |
| Preuves identifiées | OK |
| Evidence Reviewer | Approuve le plan |
| Divergence critique code | Aucune |
| Éligibilité session jour J | **Non prouvée** (probable dérive) — hors claim « exécuter maintenant » |

**Verdict : PASS** (préparation readiness)

---

## 11. GO/NO-GO — autorisation distincte d’exécution P4G2

| Question | Décision |
| --- | --- |
| Exécuter P4G2 dans / suite immédiate de 005 | **NO-GO** |
| Autoriser une exécution future sous ordre humain | **GO conditionnel** : préflight session **encore expirée** (ou session synthétique post-P4G1 équivalente préparée sous mission dédiée) + VC9 inactif + isolation TEST + 1× `reprendre` + 0 retry + deactivate + postflight A01–A09 |
| Réutiliser le PASS P4G2 historique comme preuve actuelle | **NO-GO** |
| LIVE / CreateAppointment / déploiement | **NO-GO** |

**Mission arrêtée après ce rapport. P4G2 non déclenché.**
