# REC-008 — Diff canonique W-031-01 (pré-install 033)

**Candidat :** `n8n/proposed/.../diag-032/after-OCD9It1uKFhOoWNF.W03101-candidate.json`  
**Référence FIX-008 :** `.../after-OCD9It1uKFhOoWNF.json` (Gérer `f75d4984…`)  
**Install :** **NOT_EXECUTED**

## Intégrité structurelle (033)

| Contrôle | Résultat |
| --- | --- |
| Workflow ID | `OCD9It1uKFhOoWNF` |
| Nœuds | **134** |
| Arêtes connexions | **137** |
| Nœuds/connexions hors Gerer jsCode | **identiques** à FIX-008 |
| Credentials / URLs / triggers | **inchangés** |
| Remplacements identité non-resume | **4** |
| Gérer SHA AFTER | `44a7064d12755a84dd256acae90abbf67a778178f9947eec3a36dc0c9abcad3f` |
| File SHA candidate | `57e08d2281247cf2030ae2734d6c096cdad9c049a53a120cce796fcb11c7d8af` |
| STOP (écart inattendu) | **non** |

Preuve machine : `…/diag-033/CANDIDATE-INTEGRITY.json`

## Diff unique autorisé (Gérer, zone `!explicitResumeMsg`)

```diff
-        nom: previous.nom ?? x.nom ?? null,
+        nom: previous.nom ?? null,
-        prenom: previous.prenom ?? x.prenom ?? null,
+        prenom: previous.prenom ?? null,
-        email: previous.email ?? x.email ?? null,
+        email: previous.email ?? null,
-        telephone: previous.telephone ?? x.telephone ?? null,
+        telephone: previous.telephone ?? null,
```

Branche `reprendre` : **inchangée** (`previous ?? x` conservé).  
Source complète : `diag-032/PROPOSED_FIX.diff.txt`
