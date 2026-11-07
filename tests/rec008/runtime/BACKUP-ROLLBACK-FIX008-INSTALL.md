# Backup / SHA / rollback / escalade — install FIX-008 (pointeur)

Canonique : `n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/install-readiness/BACKUP-SHA-ROLLBACK.md`

| Étape | Attendu |
| --- | --- |
| Backup | Export + `BACKUP.json` + SHA avant PUT ; ne pas écraser before/after proposed |
| SHA candidat | `849201ddd7cb17c158de292ed5479bfd024d83ac89b9a1f135b9422ae973618c` |
| SHA rollback VC9 | `6284f867054879d00292b45b5a8560f25dc778a56979ea354b18af2f5f82b889` |
| Rollback | Désactiver → 1 PUT backup/before → vérifs → halt (ordre distinct) |
| Escalade | Timeout PUT → UNCERTAIN sans retry ; LIVE drift → ne pas toucher LIVE |

Tant que non installé : **aucun rollback runtime nécessaire**.
