# PATCH-NOTE — W-031-01 (MISSION 032)

## Scope

- **Nœud unique :** `Gérer collecte progressive`
- **Zone unique :** `sessionExpired && !explicitResumeMsg`
- **Champs :** `nom`, `prenom`, `email`, `telephone` — retirer `?? x.*`
- **Inchangé :** branche `reprendre` (FIX-008), Parser, Fusionner, Sauvegarder SQL, service/site/dates/slots

## SHA-256 (Gérer jsCode)

| | SHA-256 |
| --- | --- |
| BEFORE (FIX-008 after) | `f75d49849231f956bb9ae5383111ea84b362dc58de6711cc75d2e7e2a26917fe` |
| AFTER (proposé) | `44a7064d12755a84dd256acae90abbf67a778178f9947eec3a36dc0c9abcad3f` |

Détail : `SHA256.json`.

## Install (manuel, autorisation future)

1. Préflight TEST (pas LIVE) + backup workflow.
2. Remplacer uniquement le jsCode Gérer par `Gerer_collecte_progressive.AFTER.js` (ou importer le candidat offline **sans** activate).
3. Vérifier SHA Gérer = AFTER.
4. Postflight + evidence-reviewer.
5. **Ne pas** auto-enchaîner R04 runtime.

## Non-régressions à vérifier (sous autorisation)

- R04-A / R04-B (capture email session active)
- FIX-008 S02/S05 (`reprendre` / Camille expired)
- Pas de CLAIM/POST sur expired non-resume

## Interdits

PUT implicite, activate, POST CreateAppointment, mutation PG métier, LIVE.
