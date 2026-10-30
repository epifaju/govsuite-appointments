# Rapport REC-007 — phase 7B, publication du correctif notifications

**Date :** 29 octobre 2026  
**Périmètre :** publier le retrait du nœud `Créer notification CONFIRMATION`, puis tester les réponses HTTP sans création.  
**Résultat :** publication acceptée. Les tests 400 et 409 passent. Aucun rollback n'a été nécessaire.

## 1. État avant publication

| Contrôle | Résultat |
|---|---|
| Workflow 03 | actif, 12 nœuds, version `f5079298-6e66-400d-9c44-69522aa68a49` |
| Workflow 08 | inactif |
| Workflow 10 | inactif |
| Rendez-vous | 13, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Notifications | 14 |
| Historique | 12 |
| Sessions | 48 |
| SHA-256 du payload | `7c876ee482cd1ff48de9627e32ad3e1fedf904268c1fdbbaf72b03df544eab15` |
| Diff | suppression du nœud redondant et branche vraie de `If` vers `Répondre`. Les onze autres nœuds sont identiques |
| Créneau passé | `de6733bf-8d82-4946-84a9-4535e10037a1`, `DISPONIBLE`, 0 place, déjà passé |

L'export de la version alors active est `n8n/live-exports/2026-10-29-rec007-phase7b-before/SXCesRUmGrV5FMzm.json`, SHA-256 `6b477f3a63e02a5938c7e48a49af01f2e2e8a5cb050c4053f6814e865073e5e8`. Il est identique à la sauvegarde de la phase 7A.

## 2. Publication

`PUT /api/v1/workflows/SXCesRUmGrV5FMzm` a répondu **HTTP 200**. Le corps envoyé est le payload validé. Il ne contient pas `active: false`.

Le `GET` suivant confirme :

| Champ | Valeur |
|---|---|
| Actif | oui |
| Nœuds | 11 |
| Nouvelle version | `c48ffad5-4f36-4c7e-9abf-11ce6fa2d9e6` |
| `versionCounter` | 29 |
| Horodatage | 29 octobre 2026, 23:30:08+01 |
| `Créer notification CONFIRMATION` | absent |
| Branche vraie de `If` | `Répondre` |
| Branche fausse de `If` | `Répondre créneau indisponible` |
| SQL et `queryReplacement` de `Créer rendez-vous` | inchangés |

Nœuds restants : `POST /appointments`, `Valider demande`, `Créer rendez-vous`, `Répondre`, `Vérifier création`, `If`, `Répondre créneau indisponible`, `Demande valide ?`, `Répondre validation`, `Répondre erreur interne`, `Conserver le résultat`.

La version précédente `f5079298-6e66-400d-9c44-69522aa68a49` reste lisible. Les workflows 08 et 10 sont restés inactifs. Le workflow 02 est resté actif sur `37f59d20-4687-4c2c-aed6-ac14aed1a232`.

## 3. Tests HTTP sans écriture

Appels envoyés à `http://127.0.0.1:5680/webhook/appointments`. Aucune réponse ne contient de SQL ni de jeton de gestion.

| Cas | HTTP | Corps |
|---|---|---|
| `slotId` absent | 400 | « Le champ slotId est obligatoire. » |
| `nom` absent | 400 | « Le champ nom est obligatoire. » |
| `prenom` absent | 400 | « Le champ prénom est obligatoire. » |
| `nom` vide | 400 | « Le champ nom est obligatoire. » |
| `nom` composé d'espaces | 400 | « Le champ nom est obligatoire. » |
| UUID mal formé | 400 | « Le champ slotId est invalide. » |
| 36 tirets | 400 | « Le champ slotId est invalide. » |
| UUID canonique inexistant | 409 | « Créneau introuvable ou complet » |
| Créneau passé, relu `DISPONIBLE` avec 0 place | 409 | « Créneau introuvable ou complet » |

Après les deux groupes, les compteurs et l'empreinte sont inchangés. Les deux créneaux de référence restent à 0 place.

## 4. État final

| Élément | Valeur |
|---|---|
| Rendez-vous | 13, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Notifications | 14 |
| Historique | 12 |
| Sessions | 48 |
| Créneau passé | `DISPONIBLE`, 0 place |
| Créneau futur `3f3b3cba-30e2-43d2-b2e5-dcb1ee01d2c0` | `DISPONIBLE`, 0 place |
| Workflow 02 | actif, 5 nœuds, `versionCounter` 39 |
| Workflow 03 | actif, `c48ffad5-4f36-4c7e-9abf-11ce6fa2d9e6`, 11 nœuds, `versionCounter` 29 |
| Workflow 08 | inactif, `versionCounter` 5 |
| Workflow 10 | inactif, `versionCounter` 654 |

Historique du workflow 03 : `740ca2ae-87ea-4323-aa69-cfd57d869fc1` (11 nœuds, ancienne version intermédiaire), `269708a1-ad45-4c90-b223-033d9163a92e` (12), `f5079298-6e66-400d-9c44-69522aa68a49` (12), `c48ffad5-4f36-4c7e-9abf-11ce6fa2d9e6` (11, version active).

## 5. Rollback

Aucun rollback n'a été exécuté. La procédure reste :

`POST /api/v1/workflows/SXCesRUmGrV5FMzm/activate`

```json
{"versionId":"f5079298-6e66-400d-9c44-69522aa68a49"}
```

La version intermédiaire `740ca2ae-87ea-4323-aa69-cfd57d869fc1` ne doit pas être republiée, même si elle compte aussi 11 nœuds. Ce n'est pas le correctif qui vient d'être publié.

## 6. Recommandation

**GO** pour deux tests HTTP 201 séparés, après autorisation, dans cet ordre :

1. Une création avec adresse, sur le créneau futur relu juste avant l'appel, puis nettoyage ciblé.
2. Une création sans adresse, seulement si la première a répondu HTTP 201 et que les données sont revenues à l'état initial. Attendu : HTTP 201, rendez-vous `CONFIRME`, aucune notification `EMAIL`.

Aucun de ces deux appels n'a été envoyé dans cette phase. Aucun courriel n'a été envoyé. REC-008 et l'idempotence n'ont pas été commencés.
