# Diagnostic W-031-01 — Mission 032

**Statut correctif :** PROPOSED sous `diag-032/` — **non installé**.

## Chaîne

`Parser intention` → `Fusionner état conversation` → `Gérer collecte progressive` → `Sauvegarder état conversation`

## Origine de `x.email`

1. **Parser** extrait un email du `chatInput` (champ `email` sur le JSON parser).  
2. **Fusionner** fait `email = pick(current.email, previous.email)` → si previous.email est null, `x.email` = email du message.  
3. Preuve offline : `fusion.email` non null avant Gerer sur R04-C.

## Quand `previous.email ?? x.email` est évalué

Early-return Gerer, zone `sessionExpiredFlag` (avant §12.3 capture) :

- Branche `!explicitResumeMsg` (free-text / email)  
- Branche `explicitResumeMsg` (`reprendre` / continuer…)  

Les deux utilisaient `previous.email ?? x.email ?? null` (idem nom/prenom/telephone/service/…).

## Où l’expiration est vérifiée

Au début de Gerer : `sessionExpiredFlag = previous.sessionExpired || previous.session_expired`, **avant** toute capture d’identité FIX-008. La reprise explicite est donc bien traitée avant §12.3 — mais le fallback `?? x.*` réintroduit les champs Fusionner.

## Persistance

`simulateSaveMerge` : toute valeur `email` non vide dans le payload **écrase** la colonne. Donc la fuite n’est **pas** seulement mémoire : un save post-Gerer **persisterait** l’email. TTL non renouvelé (`refreshSessionTtl=false`) sur free-text expiré.

## Autres champs

Même coalesce sur `nom`, `prenom`, `telephone`, `service`, `site`, `dateDebut`, `dateFin`, `slotId`, `selectedSlotIndex`, `availableSlots` dans les deux branches expirées (22 occurrences sur FIX-008 install-012).

## Correctif minimal (retenu)

Dans `sessionExpired && !explicitResumeMsg` uniquement :  
`nom` / `prenom` / `email` / `telephone` → `previous.* ?? null` (plus de `?? x.*`).  

Branche `reprendre` **inchangée** (garde `previous ?? x`). Autres nœuds inchangés.

## Empreintes

Voir `SHA256.json` — Gérer `f75d4984…` → `44a7064d…` (4 remplacements).
