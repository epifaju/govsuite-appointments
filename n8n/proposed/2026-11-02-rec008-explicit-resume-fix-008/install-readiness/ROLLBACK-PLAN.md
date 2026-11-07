# Rollback TEST — FIX-008 (non exécuté en mission 009)

## Sauvegarde de référence

- Fichier : `backup-pre-fix008-<timestamp>.json` produit **avant** apply
- SHA256 du backup enregistré dans le rapport d’install
- Contenu attendu : équivalent VC9 (`6284f867…`) si préflight OK

## Vérification SHA

1. Recalculer SHA du fichier backup sur disque
2. Comparer à l’empreinte consignées pré-apply
3. STOP / escalade si mismatch (backup corrompu)

## Déclencheurs de rollback

| Code | Condition |
| --- | --- |
| `post-apply-sha-mismatch` | Gérer ≠ `f75d4984…` ou diff multi-nœuds |
| `activated-unexpected` | `active=true` après PUT |
| `wrong-workflow-id` | ID ≠ `OCD9It1uKFhOoWNF` |
| `connections-drift` | connexions ≠ backup |
| `credentials-drift` | credentials ≠ backup |
| `human-abort` | ordre d’annulation |

## Procédure de restauration (future)

1. Confirmer TEST + workflow cible
2. Désactiver si actif (obligatoire)
3. PUT backup pré-FIX008 sur **même** ID
4. Relire : SHA ≈ VC9 / Gérer before ; `active=false`
5. Documenter version n8n post-restore
6. Evidence-reviewer → stop

**Aucune restauration automatique** dans 009 ni en boucle retry.

## Escalade humaine

- Backup illisible / SHA KO
- Restore échoue ou laisse workflow actif
- Suspicion LIVE touché
- Ambiguïté d’environnement
