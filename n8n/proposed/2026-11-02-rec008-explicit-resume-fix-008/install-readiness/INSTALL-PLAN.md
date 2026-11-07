# Plan d'installation TEST — FIX-008 (non exécuté en mission 009)

**Cible :** workflow `OCD9It1uKFhOoWNF` (TEST)  
**Candidat :** `after-OCD9It1uKFhOoWNF.json` SHA `849201dd…`  
**Baseline attendue installée :** VC9 SHA `6284f867…` / `versionId=e7867799…` / `versionCounter=9`  
**Interdit :** importer comme nouveau workflow ; écraser un autre ID ; activer ; LIVE.

## Procédure (mission ultérieure autorisée)

1. **Identité environnement TEST** — base URL `127.0.0.1:5682` ; credentials TEST ; mock `rec008-mock` ; PG TEST. STOP si LIVE.
2. **Workflow désactivé** — `active=false`, `activeVersionId=null`, webhooks 0. STOP si déjà actif.
3. **Comparer installé ↔ baseline VC9** — SHA export / empreinte nœud Gérer before `16c3d063…` ; versionId/counter. STOP si dérive.
4. **STOP dérive** — autre version, multi-actifs, credentials changés, SQL changé.
5. **Sauvegarde** — export JSON installé → `backup-pre-fix008-<timestamp>.json` (hors LIVE).
6. **SHA sauvegarde** — enregistrer SHA256 ; vérifier relecture.
7. **Apply** — PUT/update **uniquement** `OCD9It1uKFhOoWNF` avec le candidat (même `id`). Pas de duplicate.
8. **Relire** installé.
9. **Comparer** — seul Gérer `jsCode` diffère vs backup ; connexions/credentials OK ; marker `EXPLICIT-RESUME-FIX-008` ; Gérer SHA `f75d4984…`.
10. **Nouvelle version n8n** — documenter `versionId` / `versionCounter` attribués (≠ claim VC10 produit).
11. **Toujours désactivé** — confirmer `active=false` post-PUT. STOP si activation collatérale.

Puis : evidence-reviewer install → **stop** (pas d’auto runtime R01–R03).

## STOP immédiat

- Autorisation absente / ambiguë
- TEST/LIVE confusion
- Baseline ≠ VC9
- Workflow actif avant apply
- SHA candidat ≠ `849201dd…`
- Second candidat / dual package
- Apply crée un nouvel ID workflow
