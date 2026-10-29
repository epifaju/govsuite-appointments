# Rapport REC-007 — phase 6D, publication contrôlée

**Date :** 29 octobre 2026  
**Périmètre :** publier les trois corrections du workflow 03, puis exécuter la matrice HTTP sans écriture.  
**Résultat :** publication acceptée. Les tests sans écriture passent. Aucun rollback n'a été nécessaire.

## 1. État avant publication

Les contrôles ont été relus immédiatement avant le `PUT`.

| Contrôle | Résultat |
|---|---|
| Workflow 03 | actif, 12 nœuds, version `269708a1-ad45-4c90-b223-033d9163a92e` |
| Workflow 02 | actif, `37f59d20-4687-4c2c-aed6-ac14aed1a232`, 5 nœuds |
| Workflow 08 | inactif, 5 nœuds |
| Workflow 10 | inactif, 84 nœuds |
| Rendez-vous | 13, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Notifications | 14 |
| Historique | 12 |
| Sessions | 48 |
| SHA-256 de `put-body.json` | `e1ba1cdec6542e312431b8bf84ffa79f383269c9ebdc250de5236f0afd33349b` |
| Champ `active` dans le payload | absent |

Le créneau passé `de6733bf-8d82-4946-84a9-4535e10037a1` était `DISPONIBLE`, avec 0 place réservée. Le créneau futur `3f3b3cba-30e2-43d2-b2e5-dcb1ee01d2c0` était dans le même état. La clé d'API a été lue depuis `.env.n8n.local` et n'est pas reproduite ici.

## 2. Publication

`PUT /api/v1/workflows/SXCesRUmGrV5FMzm` a répondu **HTTP 200**.

| Champ de la réponse | Valeur |
|---|---|
| Nom | `03_API_CreateAppointment` |
| Identifiant | `SXCesRUmGrV5FMzm` |
| Actif | oui |
| Nœuds | 12 |
| Nouvelle version | `f5079298-6e66-400d-9c44-69522aa68a49` |

Le `GET` authentifié suivant confirme la même version active. `versionCounter` est passé de 27 à 28. La version a été enregistrée à 22:45:13+01. L'ancienne version `269708a1-ad45-4c90-b223-033d9163a92e` reste lisible par `GET` et présente dans `workflow_history`.

Les trois corrections sont présentes sur la version publiée :

- l'expression UUID canonique remplace l'expression à 36 caractères ;
- la requête utilise `$1::uuid` jusqu'à `$7`, sans interpolation `{{ }}` ;
- le créneau verrouillé exige `c.debut > now()`.

Les sept paramètres sont liés dans l'ordre `slotId`, `nom`, `prenom`, `email`, `telephone`, `numeroDocument`, `langue`.

## 3. Tests HTTP sans écriture

Appels envoyés à `http://127.0.0.1:5680/webhook/appointments`. Aucune réponse ne contient de SQL ni de `token_gestion`.

### Validation

| Cas | HTTP | Corps |
|---|---|---|
| `slotId` absent | 400 | `VALIDATION_ERROR`, « Le champ slotId est obligatoire. » |
| `nom` absent | 400 | `VALIDATION_ERROR`, « Le champ nom est obligatoire. » |
| `prenom` absent | 400 | `VALIDATION_ERROR`, « Le champ prénom est obligatoire. » |
| `nom` composé d'espaces | 400 | `VALIDATION_ERROR`, « Le champ nom est obligatoire. » |
| `zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz` | 400 | `VALIDATION_ERROR`, « Le champ slotId est invalide. » |
| 36 tirets | 400 | `VALIDATION_ERROR`, « Le champ slotId est invalide. » |

Après ce groupe : 13 rendez-vous, empreinte inchangée, 14 notifications, 12 historiques, 48 sessions. Les deux créneaux de référence restent à 0 place.

### Conflit de créneau

Le créneau passé a été relu juste avant ces appels : `DISPONIBLE`, 0 place, début déjà passé.

| Cas | HTTP | Corps |
|---|---|---|
| UUID canonique inexistant `00000000-0000-4000-8000-000000000000` | 409 | « Créneau introuvable ou complet » |
| Le même UUID entouré d'espaces | 409 | « Créneau introuvable ou complet » |
| Créneau passé `de6733bf-8d82-4946-84a9-4535e10037a1` | 409 | « Créneau introuvable ou complet » |

## 4. État final

| Élément | Valeur |
|---|---|
| Rendez-vous | 13, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Notifications | 14 |
| Historique | 12 |
| Sessions | 48 |
| Créneau passé | `DISPONIBLE`, 0 place |
| Créneau futur | `DISPONIBLE`, 0 place |
| Workflow 02 | actif, `37f59d20-4687-4c2c-aed6-ac14aed1a232`, 5 nœuds, `versionCounter` 39 |
| Workflow 03 | actif, `f5079298-6e66-400d-9c44-69522aa68a49`, 12 nœuds, `versionCounter` 28 |
| Workflow 08 | inactif, 5 nœuds, `versionCounter` 5 |
| Workflow 10 | inactif, 84 nœuds, `versionCounter` 654 |

Historique du workflow 03 :

| Version | Nœuds | Création |
|---|---|---|
| `740ca2ae-87ea-4323-aa69-cfd57d869fc1` | 11 | 29 octobre 2026, 20:44:38+01 |
| `269708a1-ad45-4c90-b223-033d9163a92e` | 12 | 29 octobre 2026, 20:52:47+01 |
| `f5079298-6e66-400d-9c44-69522aa68a49` | 12 | 29 octobre 2026, 22:45:13+01 |

## 5. Rollback

Aucun rollback n'a été exécuté. La procédure reste disponible :

`POST /api/v1/workflows/SXCesRUmGrV5FMzm/activate`

```json
{"versionId":"269708a1-ad45-4c90-b223-033d9163a92e"}
```

La version intermédiaire à 11 nœuds ne doit pas être republiée.

## 6. Anomalies résiduelles

Le HTTP 409 utilise encore le message « Créneau introuvable ou complet » pour un UUID inconnu, un créneau complet et un créneau passé.

Le second nœud `Créer notification CONFIRMATION` est toujours présent. Une création sans adresse peut encore échouer après l'enregistrement du rendez-vous.

L'idempotence et la confirmation explicite du workflow 10 ne font pas partie de cette publication. Le workflow 10 est resté inactif. Aucun courriel n'a été envoyé. REC-008 n'a pas été lancé.

La version à 8 nœuds n'est plus dans `workflow_history`. L'export de fichier de la phase 4 est toujours sur disque. Il ne doit pas être importé.

## 7. Recommandation

**GO** pour un seul test HTTP 201, après une autorisation séparée.

Ce test doit viser le créneau futur `3f3b3cba-30e2-43d2-b2e5-dcb1ee01d2c0`, avec une adresse présente, puis s'arrêter avant un second appel. Une création sans adresse reste hors de ce GO tant que le second nœud de notification n'est pas retiré.

Aucun rendez-vous n'a été créé dans cette phase.
