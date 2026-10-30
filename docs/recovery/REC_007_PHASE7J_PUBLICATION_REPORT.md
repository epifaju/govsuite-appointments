# REC-007 — Phase 7J — Publication du workflow 03

Le workflow `03_API_CreateAppointment` a été publié une fois. Aucun rendez-vous n'a été créé. Aucun test HTTP 201 n'a été envoyé. Le retour arrière n'a pas été nécessaire.

## 1. Préflight

| Contrôle | Résultat |
|---|---|
| PostgreSQL | 16.14 |
| Fonction `public.creer_rendez_vous_idempotent` | Présente, huit paramètres |
| Index `uq_rendez_vous_cle_idempotence` | Présent |
| Workflow 03 | Actif, 11 nœuds, `c48ffad5-4f36-4c7e-9abf-11ce6fa2d9e6` |
| Workflows 08 et 10 | Inactifs |
| Compteurs | 13 rendez-vous, 14 notifications, 12 historiques, 48 sessions |
| Clés d'idempotence | 0 |
| Empreinte | `a2dea067599fd4f0a5f857551adc67cc` |
| Transactions occupées et exécutions `running`, `new` ou `waiting` | Aucune |
| Créneau passé `de6733bf-8d82-4946-84a9-4535e10037a1` | `DISPONIBLE`, 0 place, déjà passé |
| UUID `00000000-0000-4000-8000-000000000099` | Absent des créneaux |

Le payload `n8n/live-exports/2026-10-29-rec007-phase7e-proposed/put-body.json` fait 13 833 octets, SHA-256 `f6fd66f2885c8297da58bf021ce1dab49da9e11feb37d36d09f43c1f15ecffac`. Il contient 12 nœuds, les cinq sorties du Switch, les réponses 201, 200, 400, 409 de créneau, 409 de conflit et 500, les paramètres `$1` à `$8`, et le credential `LlHYqyFvq4IkYbhP`. Il n'a ni `active`, ni `versionId`, ni connexion orpheline, ni second nœud de notification.

## 2. Sauvegarde

Export de la version alors active : `n8n/live-exports/2026-10-30-rec007-phase7j-before/SXCesRUmGrV5FMzm.json`, 23 457 octets, SHA-256 `9709d89d74be6d24984d0038dd400d2af90b71181c0b38ec9ab73cba84a86f81`.

| Champ | Valeur |
|---|---|
| Workflow | `SXCesRUmGrV5FMzm` |
| versionId | `c48ffad5-4f36-4c7e-9abf-11ce6fa2d9e6` |
| Nœuds | 11 |
| Activation | Active |
| Réglages | `executionOrder: v1`, `availableInMCP: false`, `binaryMode: separate` |

Les sauvegardes précédentes n'ont pas été écrasées.

## 3. Publication

Un seul `PUT /api/v1/workflows/SXCesRUmGrV5FMzm`, corps égal au fichier de payload, sans clé d'API dans le rapport. Réponse HTTP 200. Aucune seconde tentative.

Relecture immédiate :

| Contrôle | Résultat |
|---|---|
| Actif | Oui |
| Nœuds | 12 |
| versionId | `2d72700c-d731-47e1-b6d6-82c5c684f055` |
| Connexions | Identiques au payload |
| Nœuds comparés un à un | Aucune différence de requête, de validateur, de codes HTTP ni de credential |
| `binaryMode` | Conservé par la fusion des réglages, il n'était pas dans le corps envoyé |
| Workflow 08 | Inactif, `43167625-0a3b-42fa-861c-60f55f316379`, 5 nœuds |
| Workflow 10 | Inactif, `88a1f42a-ab9e-4eff-bfd9-996c31976b16`, 84 nœuds |

La requête SQL publiée appelle `public.creer_rendez_vous_idempotent` avec `$1` à `$8`.

## 4. Tests HTTP sans création

Chaque appel a été suivi d'une relecture des compteurs. Aucun n'a changé. Aucune réponse ne contient de rendez-vous ni de jeton.

| Test | HTTP | Corps |
|---|---:|---|
| `slotId` absent | 400 | `VALIDATION_ERROR`, champ obligatoire |
| UUID mal formé | 400 | `VALIDATION_ERROR`, champ invalide |
| Nom vide | 400 | `VALIDATION_ERROR`, nom obligatoire |
| Clé `req-123` | 400 | `VALIDATION_ERROR`, clé invalide |
| Corps et en-tête divergents | 400 | Les alias ne correspondent pas |
| UUID valide, créneau absent | 409 | `Créneau introuvable ou complet` |
| Créneau passé | 409 | `Créneau introuvable ou complet` |

Aucun appel n'a visé le créneau futur disponible.

## 5. Intégrité

| | Avant | Après les tests |
|---|---|---|
| Rendez-vous, notifications, historiques, sessions | 13, 14, 12, 48 | 13, 14, 12, 48 |
| Clés renseignées | 0 | 0 |
| Empreinte | `a2dea067599fd4f0a5f857551adc67cc` | `a2dea067599fd4f0a5f857551adc67cc` |

Aucune anomalie. La fonction SQL et les colonnes n'ont pas été modifiées. Le retour arrière vers `c48ffad5-4f36-4c7e-9abf-11ce6fa2d9e6` n'a pas été lancé. La version `740ca2ae-87ea-4323-aa69-cfd57d869fc1` n'a pas été restaurée.

## 6. Verdict

**GO** pour une phase 7K d'essais HTTP de bout en bout, sur autorisation séparée : création 201, replay 200, conflit 409, puis nettoyage de chaque ligne synthétique avant la suivante.

**NO-GO** pour commencer ces créations dans cette phase.

Cette phase s'arrête ici.
