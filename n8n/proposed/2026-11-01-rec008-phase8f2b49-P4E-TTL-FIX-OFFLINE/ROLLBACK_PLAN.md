# Rollback plan — 8F-2B49-P4E (TTL / routage / brouillon)

**Statut actuel :** correctifs **non installés**. Ce plan s’applique uniquement si une phase ultérieure autorisée publie le patch sur le workflow TEST `OCD9It1uKFhOoWNF`.

## 1. Préconditions de rollback

- Conserver l’export VC8 : `n8n/proposed/2026-10-31-rec008-phase8f2b26-FINALIZATION-FIX-INSTALL/after-OCD9It1uKFhOoWNF.json`
  (`versionId=e1b32992-bc68-46af-86ce-c80af46f5305`, `versionCounter=8`, SHA Finaliser `3fc500bf…`).
- Workflow LIVE hors scope : ne jamais y appliquer ni y rollbacker ce patch.
- Aucune migration schéma PostgreSQL n’est proposée (requêtes de nœuds uniquement) → pas de downgrade SQL DDL.

## 2. Procédure (TEST uniquement, sous autorisation)

1. Désactiver immédiatement le workflow TEST si actif (`active=false`, `activeVersionId=null`).
2. Restaurer le JSON VC8 via l’API n8n (PUT workflow = export `after-OCD9It1uKFhOoWNF.json`) **sans** activer.
3. Vérifier : `versionCounter` / graphe 134/137 / SHA Finaliser / inactive.
4. Préflight PG `1|11|4|0`, ouvertes 0, LIVE fingerprint inchangé, Mailpit inchangé.
5. Ne pas rejouer de messages chat tant que le préflight n’est pas vert.

## 3. Données

- Les lignes `ai_conversation_state` éventuellement touchées après install restent en base ; le rollback code ne les réécrit pas automatiquement.
- Si un brouillon a été préservé par Fix C puis une reprise manuelle a eu lieu : documenter `session_id` avant toute purge manuelle.
- Ne jamais réutiliser une clé d’idempotence `EXPIRED` / `CONFIRMED` / `ABANDONED`.

## 4. Critères de succès du rollback

| Contrôle | Attendu |
| --- | --- |
| Workflow TEST | inactif, nœuds Charger/Parser/Sauvegarder = VC8 |
| PG / mock / LIVE / Mailpit | ancrages préflight |
| Aucun CLAIM/POST de rollback | oui |

## 5. Hors P4E

Tant que le patch n’est pas installé, **aucun rollback n’est nécessaire** : seuls des artefacts `n8n/proposed/...-P4E-...` et un rapport docs existent.
