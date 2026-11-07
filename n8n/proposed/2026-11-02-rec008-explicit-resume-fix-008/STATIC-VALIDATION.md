# EXPLICIT-RESUME-FIX-008 — STATIC-VALIDATION

Mode : **offline / lecture seule** — aucun Docker, mutation, install, activation n8n, ni POST métier.

Date de contrôle : 2026-11-02  
Artefacts :

| Rôle | Chemin |
| --- | --- |
| Baseline P4F (after) | `n8n/proposed/2026-11-01-rec008-phase8f2b49-P4F-TTL-FIX-TEST-INSTALL/after-OCD9It1uKFhOoWNF.json` |
| before (copie locale) | `n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/before-OCD9It1uKFhOoWNF.json` |
| after (candidat) | `n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/after-OCD9It1uKFhOoWNF.json` |

Algo : SHA-256 sur octets fichier ; empreinte nœud = SHA-256(`JSON.stringify(parameters)`) (convention P4F) ; jsCode = SHA-256 UTF-8 du champ seul.

## Checklist

| # | Contrôle | Attendu | Observé | OK |
| --- | --- | --- | --- | --- |
| 1 | before SHA = P4F after | `6284f867054879d00292b45b5a8560f25dc778a56979ea354b18af2f5f82b889` | before = `6284f867…82b889` ; P4F = `6284f867…82b889` | PASS |
| 2 | after candidat SHA différent | ≠ before / ≠ P4F | after = `849201ddd7cb17c158de292ed5479bfd024d83ac89b9a1f135b9422ae973618c` | PASS |
| 3 | Seul nœud Gérer modifié | 1 nœud, `parameters.jsCode` seul | 133/134 nœuds inchangés (params + objet complet) ; seul `Gérer collecte progressive` (`cc3403f1-6f07-4ab5-ab26-b0fee396a46d`) diffère ; connexions / métadonnées top-level inchangées | PASS |
| 4 | `active=false` export candidat | `false` | `active=false`, `activeVersionId=null` ; nom `REC008_TEST_ISOLE_134_NON_IMPORTE` | PASS |
| 5 | Pas de hints LIVE | aucun `LIVE` / prod-host / govsuite-live dans params / settings / meta | 0 match `\bLIVE\b` ; 0 `production` ; scan params+credentials+settings vide | PASS |

## Empreintes nœud — Gérer collecte progressive

| Empreinte | before | after |
| --- | --- | --- |
| parameters (P4F) | `5bc5b967c71e219c88f1bfc6f8c2a70b7ef2e79d2a56475733650c0d20855e6e` | `4a94125b3ab79a37598b40dea9b0bb18611c30f883ab835bfd5ea4bd1aefb833` |
| jsCode seul | `16c3d063dee7f32df970e1d7c0d8ad81eee56f6dd603a6949c1a89622b36c961` | `f75d49849231f956bb9ae5383111ea84b362dc58de6711cc75d2e7e2a26917fe` |

Marqueur code présent : `EXPLICIT-RESUME-FIX-008` dans jsCode after.

## STOP conditions (aucune déclenchée)

- before ≠ SHA P4F attendu
- after == before
- >1 nœud modifié, ou champs hors `jsCode`
- `active !== false`
- hint LIVE / prod-host dans paramètres ou métadonnées export

## Matrice lecture vs écriture (hors périmètre exécuté)

| Action | Classe | Statut mission |
| --- | --- | --- |
| Hash / parse JSON locaux | lecture | fait |
| Docker / compose / volumes | écriture runtime | **non exécuté** |
| PUT / activate n8n | écriture | **non exécuté** |
| SQL métier / POST CreateAppointment | écriture | **non exécuté** |

## Verdict

**PASS** — validation statique offline OK ; n’autorise ni install, ni activation, ni phase runtime suivante.
