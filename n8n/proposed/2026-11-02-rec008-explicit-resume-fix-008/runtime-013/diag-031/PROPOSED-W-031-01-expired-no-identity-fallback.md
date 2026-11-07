# PROPOSED W-031-01 — Pas de fallback `x.email` sur session expirée

**Statut :** PROPOSED — **non installé**. Mission 031 offline ; artefacts patch Mission 032 sous `../diag-032/`.

## Symptôme (VM FIX-008 / VC9)

Sur `conversation_step=ASK_EMAIL` + `sessionExpired=true` + message email-shaped (non `reprendre`) :

- `sessionExpired=true`, `refreshSessionTtl=false`, reply `session_expired` → OK
- **mais** `managed.email` peut être rempli (longueur > 0) alors que `previous.email` est null
- step ne passe **pas** à `ASK_TELEPHONE` ; aucun CLAIM/POST

## Cause probable

Early-return Gerer (branche expirée non-resume) :

```js
email: previous.email ?? x.email ?? null
```

Si Fusionner a déjà écrit `x.email` depuis le message courant, `previous.email ?? x.email` retient la valeur Fusionner (`null ?? captured`).

Même schéma pour `prenom` / `telephone` / etc.

## Correctif proposé (hors ligne)

Dans la branche `sessionExpiredFlag && !explicitResumeMsg`, **ne pas** retomber sur `x.*` pour les champs d’identité :

```js
email: previous.email ?? null,
telephone: previous.telephone ?? null,
prenom: previous.prenom ?? null,
nom: previous.nom ?? null,
```

(ou équivalent : snapshot `previous` uniquement).

**Implémentation proposée (032) :**

| Fichier | Rôle |
| --- | --- |
| `../diag-032/DIAGNOSTIC-W-031-01.md` | Cause / parcours / persistance |
| `../diag-032/Gerer_collecte_progressive.AFTER.js` | jsCode minimal |
| `../diag-032/PROPOSED_FIX.diff.txt` | Diff 4 lignes identité |
| `../diag-032/offline-tests.cjs` | Vérif offline |
| `../diag-032/PATCH-NOTE.md` | Plan d’install manuel |

Branche `reprendre` : **inchangée** (`previous ?? x`). Parser / Fusionner / Sauvegarder : **inchangés**.

## Tests

- Offline : `r04.cExpiredAskEmail` — après patch, `r04c_email_not_captured` → PASS ; `anomalies=[]`
- Suite locale : `node …/diag-032/offline-tests.cjs`
- Ne pas activer / PUT sans mission runtime distincte

## Risques

- Faible : les champs déjà persistés en `previous` restent préservés via `previous.*`
- Vérifier non-régression S02/S05 FIX-008 (`reprendre` / Camille expired)
