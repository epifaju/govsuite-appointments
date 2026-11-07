# TEST-INSTALL-READINESS-009 — FIX-008

Mode : **offline / doc only** — aucune API n8n, aucun PUT, aucune activation, aucune mutation SQL, aucun POST métier.

Date de contrôle : 2026-11-05  
Candidat : `after-OCD9It1uKFhOoWNF.json`  
Preuve machine : `TEST-INSTALL-READINESS-009.json`

## Artefacts comparés

| Rôle | Chemin | SHA-256 |
| --- | --- | --- |
| VC9 P4F after | `n8n/proposed/2026-11-01-rec008-phase8f2b49-P4F-TTL-FIX-TEST-INSTALL/after-OCD9It1uKFhOoWNF.json` | `6284f867054879d00292b45b5a8560f25dc778a56979ea354b18af2f5f82b889` |
| FIX-008 before | `n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/before-OCD9It1uKFhOoWNF.json` | `6284f867054879d00292b45b5a8560f25dc778a56979ea354b18af2f5f82b889` |
| FIX-008 after (candidat) | `n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/after-OCD9It1uKFhOoWNF.json` | `849201ddd7cb17c158de292ed5479bfd024d83ac89b9a1f135b9422ae973618c` |

`before` ≡ VC9 P4F after (bit-identique). Candidat ≠ before / ≠ P4F. Empreinte cible `849201dd…` **confirmée**.

## Tableau de compatibilité (prêt-à-installer)

| Contrôle | Attendu | Observé | OK |
| --- | --- | --- | --- |
| SHA candidat `849201dd…` | `849201ddd7cb17c158de292ed5479bfd024d83ac89b9a1f135b9422ae973618c` | exact match | PASS |
| Un seul nœud **Gérer** modifié | `Gérer collecte progressive` (`cc3403f1-6f07-4ab5-ab26-b0fee396a46d`), `parameters.jsCode` seul | 1/134 nœud ; meta + autres params inchangés ; Δ jsCode +967 chars | PASS |
| IDs nœuds | 134 IDs identiques before/after/P4F | inchangés | PASS |
| Connexions | graphe inchangé | 99 clés connections bit-identiques | PASS |
| Credentials | inchangés | bit-identiques | PASS |
| Webhooks | inchangés | bit-identiques (liste webhook/chat inchangée) | PASS |
| Métadonnées workflow | `id`, `versionId`, `versionCounter=9`, settings | inchangés (`versionId=e7867799…`, counter=9) — **pas VC10** | PASS |
| Pas LIVE | `active=false`, nom TEST, path `proposed/` | `REC008_TEST_ISOLE_134_NON_IMPORTE`, `active=false`, hors `live-exports/` | PASS |
| Pas de changement SQL | nœuds Postgres / Sauvegarder | queries + credentials SQL bit-identiques | PASS |
| Early-return patch | marqueur `EXPLICIT-RESUME-FIX-008` + `return` avant capture `ASK_*` | présent, avant `ASK_NOM` | PASS |
| Allowlist 4 phrases | `reprendre` / `reprendre ma demande` / `continuer` / `continuer ma demande` | littéral identique before/after | PASS |

## Diff structurel

### Périmètre

| Dimension | before ↔ after | P4F ↔ before |
| --- | --- | --- |
| Nœuds (134) | **1** modifié | 0 |
| Champ modifié | `parameters.jsCode` uniquement | — |
| Connections / credentials / webhooks / SQL | 0 | 0 |
| Top-level (`id`, `active`, `version*`, settings) | 0 | 0 |

### Nœud touché

| Champ | Valeur |
| --- | --- |
| Nom | Gérer collecte progressive |
| Id | `cc3403f1-6f07-4ab5-ab26-b0fee396a46d` |
| Type | `n8n-nodes-base.code` |
| jsCode SHA before | `16c3d063dee7f32df970e1d7c0d8ad81eee56f6dd603a6949c1a89622b36c961` |
| jsCode SHA after | `f75d49849231f956bb9ae5383111ea84b362dc58de6711cc75d2e7e2a26917fe` |

### Patch sémantique (jsCode)

Branche `sessionExpired` + `explicitResumeMsg` : après pose des flags (`refreshSessionTtl` / `sessionExpired=false` / `preserveDraft` / intent CREATE), le before **tombait** dans la machine de collecte et pouvait capturer le message de reprise.

After : **early return** immédiat (sortie JSON vers Sauvegarder), **avant** toute capture de champ.

```diff
   // reprise explicite : poursuivre CREATE sans CLAIM/POST automatique
+  // EXPLICIT-RESUME-FIX-008: early return AFTER flags, BEFORE field capture
   x.refreshSessionTtl = true;
   x.sessionExpired = false;
   x.preserveDraft = true;
   if (previousPendingAction === 'CREATE_APPOINTMENT') {
     x.intent = 'CREATE_APPOINTMENT';
   }
+  return [{ json: { ...x, pendingAction, conversationStep, champs previous/x, flags, originalMessage } }];
 }
```

Allowlist inchangée :

```js
['reprendre', 'reprendre ma demande', 'continuer', 'continuer ma demande']
```

## Plan d’install (manuel, autorisation future distincte)

Non exécuté dans cette mission. Séquence future typique (rappel doc) :

1. Préflight TEST (workflow `OCD9It1uKFhOoWNF`, `active=false`, backup).
2. PUT candidat `after-OCD9It1uKFhOoWNF.json` **sans** activation.
3. Postflight SHA runtime + contrôles inactive.
4. Revue evidence-reviewer → GO/NO-GO phase suivante.

**Cette readiness n’autorise ni install, ni activation, ni phase runtime suivante.**

## Verdict

| Question | Réponse |
| --- | --- |
| Candidat structurellement prêt-à-installer (offline) ? | **OUI** |
| Install / activation effectuée ? | **NON** |
| Verdict mission | **PASS** |

**PASS** — FIX-008 (`849201dd…`) compatible VC9 P4F, surface minimale (1 nœud Gérer / jsCode), early-return + allowlist 4 phrases OK. **NO-GO install** sans autorisation écrite distincte.
