# TEST-INSTALL-READINESS-009 — pack offline (FIX-008)

Procédures **locales non exécutées** pour une future installation TEST du candidat EXPLICIT-RESUME-FIX-008.

**Aucune** commande Docker / n8n API / PUT / activation / SQL métier / chat n’est lancée par cette mission.

## Cible

| Champ | Valeur |
| --- | --- |
| Workflow | `OCD9It1uKFhOoWNF` |
| Baseline attendue (pré-install) | VC9 P4F — fichier SHA `6284f867…f82b889` ; `versionId=e7867799-2a18-4aec-9ee5-3ba9cbc40766` ; `versionCounter=9` |
| Candidat | `../after-OCD9It1uKFhOoWNF.json` — SHA `849201ddd7cb17c158de292ed5479bfd024d83ac89b9a1f135b9422ae973618c` |
| Rollback source | `../before-OCD9It1uKFhOoWNF.json` (= VC9) — SHA `6284f867…f82b889` |
| jsCode Gérer after | `f75d49849231f956bb9ae5383111ea84b362dc58de6711cc75d2e7e2a26917fe` |
| Port TEST | `127.0.0.1:5682` uniquement |
| LIVE | **interdit** |

## Contenu

| Fichier | Rôle |
| --- | --- |
| `INSTALL-CHECKLIST.md` | Procédure install TEST future (ne pas exécuter) |
| `PREFLIGHT.md` | Ancrages avant PUT |
| `POSTFLIGHT.md` | Vérifs après PUT (sans activation) |
| `BACKUP-SHA-ROLLBACK.md` | Sauvegarde, SHA, rollback, escalade |
| `STOP-CONDITIONS.md` | Fail-fast / 0 retry |
| `COMMAND-MATRIX.md` | Lecture vs écriture |
| `*.stub.cjs` | Stubs ; `throw` si `require.main === module` |

Miroirs runtime : `tests/rec008/runtime/*-FIX008-INSTALL*` (pointeurs + stubs).

## Règles (rappel P4F / ASK-PRENOM)

1. LIVE interdit. TEST ≠ LIVE.
2. Aucune activation n8n implicite (PUT ≠ activate).
3. Aucun POST CreateAppointment / chat métier dans la fenêtre install.
4. Aucune mutation SQL métier.
5. Aucun retry réseau → STOP / UNCERTAIN.
6. Préflight **et** postflight obligatoires si install autorisée plus tard.
7. Install ≠ autorisation de campagne runtime (ASK_PRENOM / P4G2).

## Verdict devops (009)

Artefacts de préparation uniquement. **PASS** préparation offline.  
**NO-GO install** tant qu’aucune autorisation humaine distincte n’est donnée.  
Phase suivante **non** auto-autorisée.
