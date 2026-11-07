# REC-008 — Diff canonique post-install W-031-01 (034)

**Méthode :** jsCode-only sur GET live TEST (pas d’import JSON candidat).

## Métadonnées n8n (attendues)

| Champ | Avant | Après |
| --- | --- | --- |
| `versionCounter` | 10 | **11** |
| `versionId` | `fd75ba32-f018-40e4-9f79-8f2a5400320b` | `f5a9181f-ff8d-4301-976e-57add79badae` |
| `active` | false | false |

## Fonctionnel

Seul nœud modifié : `Gérer collecte progressive` (`cc3403f1-…`) — champ `parameters.jsCode`.

SHA jsCode :

- avant : `f75d49849231f956bb9ae5383111ea84b362dc58de6711cc75d2e7e2a26917fe`
- après : `44a7064d12755a84dd256acae90abbf67a778178f9947eec3a36dc0c9abcad3f`

Zone `sessionExpired && !explicitResumeMsg` — 4 champs identité :

```text
previous.<champ> ?? x.<champ> ?? null  →  previous.<champ> ?? null
```

pour `nom`, `prenom`, `email`, `telephone`.

Branche `reprendre` / connexions / settings / credentials / URLs : **inchangés**.

## Normalisation comparaison backup ↔ after

Ignorer uniquement : `versionId`, `versionCounter`, `updatedAt` (si présent), et le `jsCode` du nœud Gerer.  
Tout autre écart = anomalie.
