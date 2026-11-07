# EXPLICIT-RESUME-FIX-008 — VALIDATION-STATIC

Mode : **offline / lecture seule** — aucun Docker, API n8n, install, activation, mutation SQL, ni POST métier.

**Candidat canonique :** `after-OCD9It1uKFhOoWNF.json` (early-return FIX-008).  
Une variante expérimentale « flag skip collect » (`1504dd29…`) a été **retirée** ; ne pas l’utiliser.

## Tableau SHA

| Artefact | SHA-256 | Verdict |
| --- | --- | --- |
| `before-OCD9It1uKFhOoWNF.json` (VC9) | `6284f867054879d00292b45b5a8560f25dc778a56979ea354b18af2f5f82b889` | PASS |
| `after-OCD9It1uKFhOoWNF.json` (candidat) | `849201ddd7cb17c158de292ed5479bfd024d83ac89b9a1f135b9422ae973618c` | PASS (≠ before) |
| jsCode Gérer before | `16c3d063dee7f32df970e1d7c0d8ad81eee56f6dd603a6949c1a89622b36c961` | — |
| jsCode Gérer after | `f75d49849231f956bb9ae5383111ea84b362dc58de6711cc75d2e7e2a26917fe` | PASS |

## Checklist

| Contrôle | OK |
| --- | --- |
| Seul nœud **Gérer collecte progressive** modifié | oui |
| Allowlist `reprendre` (4 phrases) inchangée | oui |
| `versionId` / `versionCounter=9` inchangés (pas VC10 installé) | oui |
| `active=false` | oui |
| Marqueur `EXPLICIT-RESUME-FIX-008` + early return avant capture | oui |
| Sauvegarder aval toujours alimenté (return item JSON) | oui |
| Install TEST / activation | **non effectuée** |

## Verdict validation statique

**PASS** — candidat local cohérent. **NO-GO install** sans autorisation distincte.
