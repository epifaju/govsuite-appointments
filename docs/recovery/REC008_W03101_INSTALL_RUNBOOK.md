# REC-008 — Runbook installation TEST W-031-01

**Statut :** exécuté mission **034** (jsCode-only, 1 PUT, inactive) — ne pas rejouer sans nouvelle autorisation.

Cible : n8n TEST `127.0.0.1:5682` · WF `OCD9It1uKFhOoWNF` · projet `govsuite-rec008-test`.  
**LIVE interdit.**

---

## 0. Préconditions (checklist 033)

- Préflight RO **PASS** (VC10, versionId `fd75ba32…`, Gerer `f75d4984…`, inactive, running 0, open 0)
- Candidat pin **PASS** (Gérer `44a7064d…`, 4 remplacements, 134/137)
- Offline R01–R04 + hygiene **PASS**
- Autorisation humaine écrite « INSTALL W-031-01 TEST »

---

## 1. Backup

1. GET workflow complet TEST → fichier `backup-pre-w03101-<ISO>.json`
2. Calculer SHA-256 du backup ; consigner
3. Vérifier Gerer SHA backup = `f75d4984…` (FIX-008)

## 2. Concurrence / version

1. Relire GET : `versionId` / `versionCounter` inchangés vs préflight
2. Si drift → **STOP** (pas de PUT)

## 3. Diff autorisé

Uniquement les 4 lignes identité non-resume (voir `REC008_W03101_CANONICAL_DIFF.md`).  
Tout autre diff → **STOP**.

## 4. Installation (une opération)

**Méthode obligatoire :** patch **jsCode only** du nœud `Gérer collecte progressive` sur l’état GET live TEST.

1. GET workflow live (`versionId` `fd75ba32…`, VC10)  
2. Remplacer **uniquement** `nodes[Gérer].parameters.jsCode` par le contenu de `Gerer_collecte_progressive.AFTER.js` (SHA `44a7064d…`)  
3. **Interdit :** import / PUT du fichier candidat JSON entier (versionId fichier `e7867799…` / VC9 ≠ live VC10 — drift)  
4. **Un seul** PUT contrôlé  
5. **Ne pas** activer / publish webhook

## 5. Vérification GET post-PUT

| Contrôle | Attendu |
| --- | --- |
| `active` | `false` |
| `versionCounter` | 10 → **11** (bump) |
| Gerer SHA | `44a7064d…` |
| nodes/edges | 134 / 137 |
| Connections / settings / creds | inchangés hors Gerer |
| running / webhooks | 0 |

## 6. Postflight

- Fingerprint PG (SELECT-only) + openAttempts=0  
- Mock Δ0  
- `liveTouched=false`  
- Evidence-reviewer  

## 7. Rollback

Restaurer backup pré-install (PUT unique) → Gerer `f75d4984…` · inactive · postflight.  
**Non exécuté en 033.**

## 8. STOP

LIVE · 2e PUT · activate · chat · CLAIM/POST · Docker recreate · confusion version · SHA mismatch
