# EXPLICIT-RESUME-FIX-008 — JUSTIFICATION

## Diagnostic

**Cause :** dans « Gérer collecte progressive », branche TTL expirée + `explicitResumeMsg` :

1. Flags posés (`refreshSessionTtl=true`, `sessionExpired=false`, `preserveDraft=true`, intent CREATE si pending CREATE)
2. **Pas de return** → exécution continue vers § capture identité / progression CREATE
3. Si `conversationStep` ∈ {ASK_NOM, ASK_PRENOM} (et symétriquement EMAIL / TELEPHONE si le message matche), le texte de reprise (« reprendre », « continuer… ») est traité comme donnée métier

**Chemin nœuds :** Chat → … → Fusionner → **Gérer collecte progressive** → Sauvegarder → Router

**Preuve structurelle :** le `return` early free-text expiré (non-reprise) existe déjà et alimente Sauvegarder ; la branche reprise posait les flags puis tombait dans la collecte — asymétrie bugguée.

## Correctif

Early return **après** flags / **avant** capture de champs, miroir du return non-reprise (free-text expiré).

**Persistance :** le `return` sort uniquement du jsCode de **Gérer** ; le nœud aval **Sauvegarder état conversation** reçoit toujours l’item JSON (TTL + brouillon). Ce n’est **pas** un bypass des nœuds de persistance n8n — aligné sur le pattern P4F déjà utilisé pour `session_expired`.

Flags / champs du return :

| Flag / champ | Valeur |
| --- | --- |
| `sessionExpired` | `false` |
| `refreshSessionTtl` | `true` |
| `preserveDraft` | `true` |
| `conversationStep` | inchangé (`previousConversationStep`) |
| champs métier | depuis `previous` (pas le message courant) |
| `intent` | CREATE si `previousPendingAction === 'CREATE_APPOINTMENT'` (via `x.intent` avant spread) |

Exclut ainsi la capture pour **ASK_NOM / ASK_PRENOM / ASK_EMAIL / ASK_TELEPHONE** et toute progression/écriture service dérivée du message de reprise (return avant §7+).

## Impacts / non-régressions à vérifier (sous autorisation future)

1. Session expirée + message libre ≠ reprendre → message session_expired, TTL non prolongé, draft intact
2. Session expirée + « reprendre » à ASK_NOM/ASK_PRENOM → step inchangé, pas de nom/prénom = « reprendre », TTL refresh, draft intact, intent CREATE si pending CREATE
3. Même scénario à ASK_EMAIL / ASK_TELEPHONE / ASK_CREATE_SERVICE → aucune capture depuis le message de reprise
4. Sauvegarder reçoit le JSON (persistence + TTL) — pas de skip de nœud
5. Aucun POST CreateAppointment / CLAIM

## Plan d'install (manuel, autorisation distincte requise)

1. Préflight TEST VC9 (empreintes nœuds, active=false attendu hors fenêtre autorisée)
2. Backup export courant
3. PUT workflow = `after-OCD9It1uKFhOoWNF.json` de ce dossier (**sans** activation implicite)
4. Postflight SHA Gérer = `f75d4984…`
5. Scénario runtime autorisé séparé (P4G-like) puis désactivation
6. `evidence-reviewer` → verdict ; **stop** (n’autorise pas la phase suivante)

## Verdict préparation hors ligne

**PASS** — patch minimal local prêt ; installation / activation / message runtime **non autorisés** par cette mission.
