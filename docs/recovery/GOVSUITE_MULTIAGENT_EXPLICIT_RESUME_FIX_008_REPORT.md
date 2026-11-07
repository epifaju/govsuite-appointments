# GOVSUITE-MULTIAGENT-EXPLICIT-RESUME-FIX-008 — Rapport

Correctif **hors ligne** : sur session expirée `ASK_PRENOM`, le message `reprendre` ne doit plus être enregistré comme prénom.

**Aucune installation TEST. Aucune activation. Aucun LIVE. Aucune mutation PG.**

**Verdict mission : PASS**  
**GO/NO-GO install TEST : NO-GO** (autorisation distincte requise)  
**Phase suivante : non autorisée automatiquement**

---

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| READINESS-007 | Divergence S03 brief vs VC9 confirmée (`prenom=reprendre` → `ASK_EMAIL`) |
| Source VC9 | `after-OCD9It1uKFhOoWNF.json` P4F SHA `6284f867…f82b889` ; `versionId=e7867799…` ; VC9 |
| Export original | **Non modifié** |
| Workflow distant TEST | **Non touché** |
| AGENTS.md / safety | Offline only ; LIVE interdit |

---

## 2. Agents mobilisés

| Agent | ID | Livrable |
| --- | --- | --- |
| [govsuite-planner](fa829997-8cde-47a1-922e-5fe15f673cdd) | Périmètre minimal ; NO-GO install | |
| [n8n-developer](4f3b2c05-a7bb-46e8-a76c-5f45807740ec) | Candidat early-return + artefacts proposed/ | |
| [postgres-engineer](4437dc6c-5879-4d83-9eca-df5a112cd103) | Invariants TTL/brouillon (`sql/`) | |
| [qa-automation](ac73cc4b-9832-48b7-91ba-c775bc786906) | Plan S01–S10 + négatifs | |
| [security-auditor](46f084d1-ad4f-43ee-ab6c-f31c835e60c5) | Garde-fous ; candidat ≠ installé | |
| [devops-engineer](d2b1c255-5663-4124-a3b6-609ffeabbd38) | Validation SHA statique | |
| [evidence-reviewer](0190cb96-0ff0-4192-b840-22068b4e3f77) | PASS offline ; NO-GO install | |
| Parent | Suite `run-fix-008.cjs` ; invite Demander ; rapport | |

---

## 3. Cause racine

Nœud : **Gérer collecte progressive**.

1. `explicitResumeMsg` détecte l’allowlist (`reprendre`, `reprendre ma demande`, `continuer`, `continuer ma demande`).
2. Branche session expirée + reprise : pose `refreshSessionTtl=true`, `sessionExpired=false`, `preserveDraft=true`, restore intent CREATE.
3. **Sans return** : exécution continue vers capture `ASK_NOM` / `ASK_PRENOM` / … avec `candidate = message`.
4. Résultat bug : `prenom="reprendre"`, step → `ASK_EMAIL`.

`ASK_CREATE_SERVICE` + `reprendre` (P4G2) ne capturait pas le service — asymétrie ; identity steps oui.

Parser / allowlist **non** en cause pour la capture (le Parser force CREATE correctement).

---

## 4. Nœuds modifiés

| Nœud | Modification |
| --- | --- |
| **Gérer collecte progressive** | Early return **après** flags de reprise, **avant** capture de champs (miroir du return free-text `session_expired`) |

Aucun autre nœud. Allowlist inchangée. Contrats SQL Sauvegarder inchangés.

**Persistance :** le return sort uniquement du jsCode Gérer ; **Sauvegarder** aval reçoit l’item JSON (TTL + brouillon). Pas de bypass des nœuds de persistance.

---

## 5. Diff (résumé)

```text
// reprise explicite : …
// EXPLICIT-RESUME-FIX-008: early return AFTER flags, BEFORE field capture
x.refreshSessionTtl = true;
x.sessionExpired = false;
x.preserveDraft = true;
if (previousPendingAction === 'CREATE_APPOINTMENT') {
  x.intent = 'CREATE_APPOINTMENT';
}
return [{ json: {
  ...x,
  pendingAction: previousPendingAction,
  conversationStep: previousConversationStep,
  nom/prenom/email/… depuis previous (pas le message),
  …
}}];
```

Détail : `n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/DIFF.md`

---

## 6. SHA

| Objet | SHA256 |
| --- | --- |
| Before (VC9) | `6284f867054879d00292b45b5a8560f25dc778a56979ea354b18af2f5f82b889` |
| After (candidat) | `849201ddd7cb17c158de292ed5479bfd024d83ac89b9a1f135b9422ae973618c` |
| jsCode Gérer before | `16c3d063dee7f32df970e1d7c0d8ad81eee56f6dd603a6949c1a89622b36c961` |
| jsCode Gérer after | `f75d49849231f956bb9ae5383111ea84b362dc58de6711cc75d2e7e2a26917fe` |

`versionId` / `versionCounter=9` inchangés — **candidat local, non VC10 installé**.

---

## 7. Résultats S01–S10

Suite : `node tests/rec008/scripts/run-fix-008.cjs`  
Rapport : `tests/rec008/reports/fix-008-2026-11-05T19-45-28-231Z` (+ fingerprint 16 PASS)

| ID | Attendu | Verdict |
| --- | --- | --- |
| S01 active Camille | prenom Camille → ASK_EMAIL | **PASS** |
| S02 expired Camille | session_expired ; prenom null ; TTL non refresh | **PASS** |
| S03 expired reprendre | TTL+ ; step ASK_PRENOM ; prenom null ; invite prénom | **PASS** |
| S03 variants allowlist | 4 phrases OK ; hors allowlist → session_expired | **PASS** |
| S04 ASK_NOM + reprendre | nom non capturé | **PASS** |
| S05 ASK_EMAIL + reprendre | email non capturé | **PASS** |
| S06 ASK_TELEPHONE + reprendre | tel non capturé | **PASS** |
| S07 ASK_CREATE_SERVICE | step conservé ; service null (P4G2) | **PASS** |
| S08 oui/non / abandon | non-régression | **PASS** |
| S09 modify field | non-régression | **PASS** |
| S10 CLAIM/POST/UNCERTAIN | no claim/post ; uncertain OK | **PASS** |

Banc offline principal (VC9 original) : **27/27 PASS** inchangé.

**PASS technique offline ≠ PASS runtime.**

---

## 8. Tests négatifs

| ID | Attendu | Verdict |
| --- | --- | --- |
| N-original-S03 | VC9 original **échoue** contrat S03 fixé | **PASS** (échec détecté) |
| N-candidate-S03 | Candidat **passe** S03 | **PASS** |
| N-strip-guard | Suppression early-return → S03 échoue | **PASS** |
| N-no-regress S01/S02/S07 | Pas de régression | **PASS** |

Les tests exécutent le **jsCode du candidat** (`loadVc9Workflow` → proposed FIX-008), pas une copie indépendante du correctif.

---

## 9. Risques

| Risque | Sévérité | Mitigation |
| --- | --- | --- |
| Confusion candidat / installé TEST | High | `active=false` ; NO-GO install ; README |
| TTL/HTTP réels non prouvés | Med | runtimeRequired futur |
| Chaîne Router → citoyen non bout-en-bout | Med | invite testée via Demander paramètres offline |
| Doc fantôme variante flag | Low | VALIDATION-STATIC.md corrigé ; variante retirée |

---

## 10. Revue Evidence Reviewer

[evidence-reviewer](0190cb96-0ff0-4192-b840-22068b4e3f77) :

- Mission offline : **PASS**
- Correctif S03 : **confirmé**
- Install TEST : **NO-GO** sans ordre humain
- PASS offline ≠ runtime

---

## 11. Verdict

| Critère 008 | Statut |
| --- | --- |
| Cause racine identifiée | OK |
| Correctif minimal local | OK (1 nœud) |
| SHA / diff documentés | OK |
| S01–S10 + négatifs | 16 PASS |
| Export VC9 original intact | OK |
| Workflow TEST non modifié | OK |
| Evidence Reviewer | Approuve offline |

**Verdict : PASS** (préparation correctif hors ligne)

---

## 12. GO/NO-GO — future installation TEST

| Question | Décision |
| --- | --- |
| Utiliser le candidat pour install TEST | **NO-GO** maintenant |
| Install sous autorisation humaine + préflight/postflight | **GO conditionnel** (mission distincte) |
| Activer / webhook / message runtime | **NO-GO** dans 008 |
| Annoncer VC10 | **NO-GO** (candidat seulement) |
| LIVE | **NO-GO** |
| Auto-phase suivante | **NO-GO** |

Candidat : `n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/after-OCD9It1uKFhOoWNF.json`

---

**Mission arrêtée après ce rapport. Aucune installation déclenchée.**
