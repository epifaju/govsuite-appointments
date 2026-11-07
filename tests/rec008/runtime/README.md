# REC-008 runtime readiness

Artefacts **locaux non exécutés**. Aucune commande Docker / n8n / SQL / webhook n’est lancée depuis ce dossier.

## Campagnes documentées

| Campagne | Mission | Checklists |
| --- | --- | --- |
| **P4G2** (`reprendre` post-P4G1) | READINESS-005 | `PREFLIGHT-P4G2.md`, `POSTFLIGHT-P4G2.md`, `STOP-CONDITIONS.md`, `COMMAND-MATRIX.md` |
| **ASK_PRENOM S01–S03** | ASK-PRENOM-READINESS-007 | `PREFLIGHT-ASK-PRENOM.md`, `POSTFLIGHT-ASK-PRENOM.md`, `STOP-CONDITIONS-ASK-PRENOM.md`, `COMMAND-MATRIX-ASK-PRENOM.md` |
| **Install TEST FIX-008** | TEST-INSTALL-READINESS-009 | `PREFLIGHT-FIX008-INSTALL.md`, `POSTFLIGHT-FIX008-INSTALL.md`, `STOP-CONDITIONS-FIX008-INSTALL.md`, `COMMAND-MATRIX-FIX008-INSTALL.md`, `BACKUP-ROLLBACK-FIX008-INSTALL.md` — canonique sous `n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/install-readiness/` |

## Contenu ASK_PRENOM (007)

| Fichier | Rôle |
| --- | --- |
| `PREFLIGHT-ASK-PRENOM.md` | Préflight commun + S01 / S02 / S03 |
| `POSTFLIGHT-ASK-PRENOM.md` | Deactivate, mock, LIVE ancre, attentes métier |
| `STOP-CONDITIONS-ASK-PRENOM.md` | STOP / fail-fast (0 retry) |
| `COMMAND-MATRIX-ASK-PRENOM.md` | Lecture vs écriture ; 1 message / S0x |
| `preflight-ask-prenom.stub.cjs` | Stub ; `throw` si `main` |
| `postflight-ask-prenom.stub.cjs` | Stub ; `throw` si `main` |

## Cible métier ASK_PRENOM (rappel, hors exécution)

| S0x | Message | Session (placeholder) | Attente |
| --- | --- | --- | --- |
| S01 | `Camille` | active `ASK_PRENOM` | capture → `ASK_EMAIL` |
| S02 | `Camille` | expirée `ASK_PRENOM` | pas de capture ; `session_expired` |
| S03 | `reprendre` | expirée `ASK_PRENOM` | reprise ; step/nom conservés ; prenom null |

- Workflow TEST : `OCD9It1uKFhOoWNF`, VC9, `versionId=e7867799-2a18-4aec-9ee5-3ba9cbc40766`.
- Offline refs : `C03-ask-prenom`, `T02-ask-prenom-after-ttl-routing`, `T03-explicit-resume`.
- **PASS offline ≠ PASS runtime.**

## Contenu P4G2 (005) — inchangé

| Fichier | Rôle |
| --- | --- |
| `PREFLIGHT-P4G2.md` / `POSTFLIGHT-P4G2.md` | Checklists reprise `reprendre` |
| `STOP-CONDITIONS.md` / `COMMAND-MATRIX.md` | STOP + matrice P4G2 |
| `preflight-p4g2.stub.cjs` / `postflight-p4g2.stub.cjs` | Stubs throw-main |

## Règles

1. **LIVE interdit.** TEST ≠ LIVE.
2. **Aucune activation n8n** depuis ces fichiers.
3. **Aucun POST CreateAppointment.**
4. **Aucune mutation SQL métier** ; lectures documentées seulement.
5. **Aucun retry** après timeout / erreur réseau → STOP / UNCERTAIN.
6. Préflight **et** postflight obligatoires si une phase runtime est autorisée plus tard.
7. Une phase / un S0x n’autorise pas le suivant.

## Contenu install FIX-008 (009)

| Fichier | Rôle |
| --- | --- |
| `PREFLIGHT-FIX008-INSTALL.md` | Pointeur préflight (baseline VC9 → candidat `849201dd…`) |
| `POSTFLIGHT-FIX008-INSTALL.md` | Pointeur postflight PUT inactif |
| `STOP-CONDITIONS-FIX008-INSTALL.md` | STOP / fail-fast install |
| `COMMAND-MATRIX-FIX008-INSTALL.md` | Lecture vs écriture (1 PUT) |
| `BACKUP-ROLLBACK-FIX008-INSTALL.md` | Backup + SHA + rollback + escalade |
| `preflight-fix008-install.stub.cjs` | Stub ; `throw` si `main` |
| `postflight-fix008-install.stub.cjs` | Stub ; `throw` si `main` |
| `install-fix008.stub.cjs` | Stub ; `throw` si `main` |

Cible : workflow `OCD9It1uKFhOoWNF`, candidat SHA `849201dd…`. **Install ≠ activation ≠ campagne chat.**

## Verdict ASK-PRENOM-READINESS-007 (devops)

Artefacts de préparation uniquement. Les stubs ne prouvent pas le runtime. **Aucune exécution** Docker / PG / n8n dans cette mission.

## Verdict TEST-INSTALL-READINESS-009 (devops)

Pack offline prêt (runtime pointeurs + `install-readiness/`). **PASS** préparation. **NO-GO install** sans autorisation distincte. Aucune exécution Docker / n8n / PUT dans cette mission.
