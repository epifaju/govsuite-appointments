# Rapport REC-007 — phase 6C, vérification finale avant publication

**Date :** 29 octobre 2026  
**Périmètre :** contrôler les préconditions de publication du workflow 03, sans envoyer le correctif.  
**Résultat :** toutes les préconditions sont au vert. Recommandation **GO**. La publication n'a pas été lancée.

## 1. Tableau des préconditions

| Précondition | Résultat | Constat |
|---|---|---|
| `.env.n8n.local` existe | PASS | Fichier présent à la racine du projet |
| Fichier exclu de Git | PASS | Cité par `.gitignore` (`.env.n8n.local` et `.env.*.local`). Aucun dépôt `.git` n'existe dans ce dossier, donc le fichier n'est dans aucun index |
| `N8N_API_KEY`, `N8N_API_URL`, `N8N_WORKFLOW_CREATE_ID` chargées | PASS | Les trois variables sont présentes dans le processus. Le secret n'est pas reproduit |
| `GET` authentifié du workflow 03 | PASS | HTTP 200 sur `SXCesRUmGrV5FMzm` |
| Workflow 03 actif, 12 nœuds, version `269708a1-ad45-4c90-b223-033d9163a92e` | PASS | `active: true`, 12 nœuds, `versionId` et `activeVersionId` identiques à cette version |
| Workflows 08 et 10 inactifs | PASS | `08_JOB_SendConfirmationEmails` et `10_AI_ConsularAssistant_Complete` répondent `active: false` |
| Compteurs et empreinte des rendez-vous | PASS | 13 rendez-vous, empreinte `a2dea067599fd4f0a5f857551adc67cc`, 14 notifications, 12 historiques, 48 sessions |
| SHA-256 de `put-body.json` | PASS | `e1ba1cdec6542e312431b8bf84ffa79f383269c9ebdc250de5236f0afd33349b` |
| Le payload ne change que deux nœuds | PASS | `Valider demande` et `Créer rendez-vous`. Connexions inchangées |
| Procédure de rollback disponible | PASS | `GET` de la version `269708a1-ad45-4c90-b223-033d9163a92e` répond HTTP 200, avec 12 nœuds. Elle est aussi dans `workflow_history` |

Aucun `PUT`, `POST` ou `DELETE` n'a été envoyé. Les workflows n'ont pas été modifiés. Aucun rendez-vous n'a été créé. Les tables internes de n8n n'ont pas été écrites. La clé d'API n'est pas recopiée dans ce rapport.

## 2. Détail des contrôles

L'adresse chargée vise l'API locale du port 5680. L'identifiant chargé est `SXCesRUmGrV5FMzm`.

| Workflow | État lu par l'API |
|---|---|
| 03 `03_API_CreateAppointment` | actif, 12 nœuds, version `269708a1-ad45-4c90-b223-033d9163a92e` |
| 08 `08_JOB_SendConfirmationEmails` | inactif, 5 nœuds |
| 10 `10_AI_ConsularAssistant_Complete` | inactif, 84 nœuds |

La lecture PostgreSQL donne le même état pour le workflow 03 : actif, 12 nœuds, `versionCounter` 27. Le workflow 02 reste actif sur `37f59d20-4687-4c2c-aed6-ac14aed1a232`.

Le fichier `n8n/live-exports/2026-10-29-rec007-phase6-proposed/put-body.json` ne contient pas `active: false` ni de clé d'API. La requête proposée contient `$1::uuid` jusqu'à `$7`, le garde `c.debut > now()`, et aucune interpolation `{{ }}`. L'expression UUID canonique est présente. L'expression à 36 caractères ne l'est plus.

Le retour arrière préparé reste :

`POST /api/v1/workflows/SXCesRUmGrV5FMzm/activate`

```json
{"versionId":"269708a1-ad45-4c90-b223-033d9163a92e"}
```

Cet appel n'a pas été exécuté. La version cible a seulement été lue.

`workflow_history` contient aujourd'hui deux versions du workflow 03 : `740ca2ae-87ea-4323-aa69-cfd57d869fc1` (11 nœuds) et `269708a1-ad45-4c90-b223-033d9163a92e` (12 nœuds). La version à 8 nœuds `93ebd7e4-ee13-4fd8-8104-564e0c6ca3c8` n'y est plus. L'export de fichier `n8n/live-exports/2026-10-29-rec007-phase4-before/SXCesRUmGrV5FMzm.json` est toujours sur disque. Il ne constitue pas la procédure de retour arrière : un import désactiverait le workflow. `740ca2ae-87ea-4323-aa69-cfd57d869fc1` ne doit pas être republié.

## 3. Recommandation

**GO.** Les préconditions techniques de la phase 6B sont réunies. Le `PUT` du fichier préparé peut être autorisé.

La publication n'est pas effectuée dans cette phase. Elle attend une autorisation explicite.
