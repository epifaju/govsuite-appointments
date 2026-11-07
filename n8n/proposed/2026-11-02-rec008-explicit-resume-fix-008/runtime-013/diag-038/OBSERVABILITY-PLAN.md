# Plan d'observabilité limité — post-038 (soumis à autorisation distincte)

**Statut :** proposition uniquement · **NOT_AUTHORIZED** · aucun changement appliqué.

## Objectif

Identifier le nœud exact responsable du HTTP 500 R04-B sans élargir la rétention de façon permanente et sans rejeu métier non autorisé.

## Périmètre proposé (une mission dédiée)

1. Préflight TEST uniquement (`5682`, WF `OCD9It1uKFhOoWNF`).
2. Snapshot settings actuels : `saveDataSuccessExecution=none`, `saveDataErrorExecution=none`, `saveExecutionProgress=false`.
3. Activation **temporaire** et **réversible** de `saveDataErrorExecution=all` (ou équivalent minimal) sur le workflow TEST uniquement — **PUT settings uniquement**, pas de changement jsCode métier, **sous ordre explicite**.
4. Un seul message synthétique de diagnostic (même classe `pas-un-email`) **si** une mission runtime distincte l'autorise — sinon inspection d'une exécution d'erreur déjà présente.
5. Lecture RO de `execution_entity` + dump d'erreur **expurgé** (pas de PII, pas de corps brut).
6. Restauration immédiate des settings `saveData*=none` + postflight + hygiene.
7. Evidence-reviewer indépendant avant tout GO R04-B.

## Interdits

- LIVE
- Rétention permanente
- Retry automatique
- CLAIM / POST CreateAppointment
- Lancement automatique R04-C / R05–R07
- Modification Docker / volumes

## Critère de succès

Nœud fautif nommé avec preuve d'exécution d'erreur → alors seulement évaluer un correctif minimal sous `n8n/proposed/`.
