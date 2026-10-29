# Rapport REC-007 — phase 4B

**Date :** 29 octobre 2026  
**Périmètre :** une seule création synthétique HTTP 201 sur le workflow actif `03_API_CreateAppointment`.  
**Suite :** le rendez-vous synthétique est en base. Son nettoyage est préparé et n'a pas été exécuté.

## 1. Contrôles avant l'appel

Tous les contrôles ont été refaits immédiatement avant le POST. Aucun n'a échoué.

| Contrôle | Observé |
|---|---|
| Workflow 03 | actif, 12 nœuds, version `269708a1-ad45-4c90-b223-033d9163a92e` |
| Workflow 08 | inactif, version `43167625-0a3b-42fa-861c-60f55f316379`, 5 nœuds |
| Workflow 10 | inactif, version `88a1f42a-ab9e-4eff-bfd9-996c31976b16`, 84 nœuds |
| Rendez-vous | 13, empreinte `a2dea067599fd4f0a5f857551adc67cc`, 0 ligne `REC007-PHASE4` |
| Notifications / historique / sessions | 14 / 12 / 48 |
| Créneau `3f3b3cba-30e2-43d2-b2e5-dcb1ee01d2c0` | PASSEPORT PARIS, 2026-11-10 09:00, futur, capacité 2, 0 place, `DISPONIBLE`, 0 rendez-vous lié |

Sauvegardes relues, non restaurées :

| Fichier | Taille | SHA-256 |
|---|---:|---|
| `n8n/live-exports/2026-10-29-rec007-phase4-before/SXCesRUmGrV5FMzm.json` | 8 820 | `0ab58c7ea25ffc21aa189b4f323b8299c000f0d3963275c32ffdd145e0c84daf` |
| `n8n/live-exports/2026-10-29-rec007-phase4-after/SXCesRUmGrV5FMzm.json` | 12 241 | `06c77b75fff22268989f3d4c2eb8c00212cd96fc8b2940274496c227622dcd85` |
| `backups/govsuite-pre-rec007-20261029.dump` | 596 983 | `7859b0c80ef1f074d2e5d2e3ef3728933b02f10ac0f9f2a275f30013f0493112` |

## 2. Appel unique

Un seul `POST http://127.0.0.1:5680/webhook/appointments`, le 29 octobre 2026 à 21:07:27 +01.

Corps envoyé : créneau `3f3b3cba-30e2-43d2-b2e5-dcb1ee01d2c0`, nom `REC007-PHASE4`, prénom `SYNTHE-CREATE`, adresse `rec007-phase4-create@example.test`, téléphone `0600000401`, document `P4-SYNTH-01`, langue `fr`.

Réponse HTTP 201, JSON valide, 356 octets. `success` vaut `true`. Le rendez-vous renvoyé est `3fcc7d62-f586-485d-8313-cce4373a8642`, référence `GB-2026-E3074815`, statut `CONFIRME`, service `PASSEPORT`, site `PARIS`. Les horaires du JSON sont en UTC : début `2026-11-10T08:00:00.000Z`, soit 09:00 à Paris. Le jeton est un UUID. Son empreinte MD5 commence par `9b22c8107713`. Le jeton complet n'est pas recopié ici.

Aucun second appel n'a été envoyé.

## 3. Résultats

| Contrôle | Résultat | Observé |
|---|---|---|
| HTTP 201 et JSON valide | PASS | 201, `success: true` |
| Un seul nouveau rendez-vous `CONFIRME` | PASS | `3fcc7d62-f586-485d-8313-cce4373a8642`, créé à 21:07:27 +01 |
| Référence unique | PASS | `GB-2026-E3074815`, une seule occurrence |
| Jeton UUID présent | PASS | présent, format UUID, empreinte `9b22c8107713` |
| Compteur du créneau | PASS | 0 → 1 |
| Créneau toujours `DISPONIBLE` | PASS | capacité 2, 1 place réservée |
| Une notification | PASS | `CONFIRMATION` / `EMAIL` / `A_ENVOYER` vers l'adresse synthétique |
| Une ligne d'historique | PASS | `CREATION` / `CONFIRME` |
| Les 13 rendez-vous précédents | PASS | empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Aucun courriel envoyé | PASS | notification encore `A_ENVOYER`, workflow 08 inactif |
| Workflows 08 et 10 | PASS | toujours inactifs, versions inchangées |
| Workflow 03 | PASS | toujours actif, 12 nœuds, version `269708a1-ad45-4c90-b223-033d9163a92e` |

Compteurs :

| Mesure | Avant | Après |
|---|---:|---:|
| Rendez-vous | 13 | 14 |
| Lignes `REC007-PHASE4` | 0 | 1 |
| Notifications | 14 | 15 |
| Historique | 12 | 13 |
| Sessions | 48 | 48 |
| Places du créneau cible | 0 | 1 |
| Rendez-vous liés à ce créneau | 0 | 1 |

Aucune autre ligne n'est liée à ce créneau. Aucune anomalie sur les critères demandés.

## 4. Nettoyage préparé, non exécuté

Une transaction ultérieure ne devra supprimer que `3fcc7d62-f586-485d-8313-cce4373a8642`, et seulement si toutes les conditions suivantes sont vraies sous verrou :

- le nom est `REC007-PHASE4`, le prénom `SYNTHE-CREATE`, l'adresse `rec007-phase4-create@example.test`, le créneau `3f3b3cba-30e2-43d2-b2e5-dcb1ee01d2c0`, le statut `CONFIRME` et la référence `GB-2026-E3074815` ;
- il existe exactement une ligne de ce nom ;
- les rendez-vous sont au nombre de 14, et l'empreinte des treize autres est `a2dea067599fd4f0a5f857551adc67cc` ;
- cette ligne a exactement une notification `CONFIRMATION` / `EMAIL` / `A_ENVOYER` et une ligne d'historique `CREATION` ;
- les sessions sont au nombre de 48.

La suppression de cette seule ligne emporte sa notification et son historique par `ON DELETE CASCADE`. Les places du créneau sont ensuite recalculées à partir des rendez-vous non annulés qui y restent. Le résultat attendu est 0 place et `DISPONIBLE`. Si une condition manque, la transaction est annulée. Les treize rendez-vous préexistants ne sont pas visés.

Ce nettoyage n'a pas été lancé.

## 5. Validation UUID proposée, non déployée

Le contrôle actuel est `/^[0-9a-fA-F-]{36}$/` après trim. Il accepte toute chaîne de 36 caractères faite de chiffres hexadécimaux et de tirets. La chaîne de 36 tirets utilisée en phase 4 passe ce contrôle, puis PostgreSQL refuse le cast et le workflow répond HTTP 500.

Proposition, à la place de cette expression, toujours après trim et sans renvoyer la valeur reçue :

```text
/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
```

C'est la forme textuelle canonique `8-4-4-4-12`. Elle rejette les 36 tirets, une chaîne sans tirets et un UUID mal groupé, qui deviennent alors HTTP 400. Elle accepte le créneau de ce test. Elle n'a pas été installée.

## 6. Risques qui restent

**Créneaux passés.** La requête de création verrouille un créneau `DISPONIBLE` dont les places sont inférieures à la capacité. Elle n'exige pas `debut > now()`. Un créneau passé encore `DISPONIBLE` peut donc être réservé.

**Interpolation SQL.** `nom`, `prenom`, `email`, `telephone`, `numeroDocument` et `langue` sont insérés dans le texte de la requête après dédoublement des apostrophes. `slotId` est interpolé après le contrôle de forme. Ce n'est pas une requête paramétrée.

**Notification après la création.** L'insertion du rendez-vous, l'incrément des places, l'historique et une première notification tiennent dans une seule requête. Le nœud `Créer notification CONFIRMATION` s'exécute ensuite. S'il échoue, le rendez-vous peut déjà être validé alors que le client ne reçoit pas le HTTP 201. Dans cet essai, ce nœud a abouti : une seule notification `A_ENVOYER` existe. Le risque demeure pour un échec ultérieur, notamment avec un destinataire vide.

**Absence d'idempotence.** Rien n'identifie une demande déjà traitée. Un second POST identique créerait un second rendez-vous tant que le créneau a de la place. Ce second POST n'a pas été envoyé.

**Écriture directe des tables n8n.** La phase 4 a mis à jour `workflow_entity` et `workflow_history` puis a redémarré n8n, parce que le conteneur n'a pas de clé d'API. Ce chemin ne passe pas par la validation et la republication en mémoire de l'API publique. Une définition invalide peut empêcher l'activation au démarrage, et la version intermédiaire `740ca2ae-87ea-4323-aa69-cfd57d869fc1` reste dans l'historique. Les prochaines modifications du workflow devraient passer par `PUT /api/v1/workflows/{id}` une fois une clé disponible, afin que le processus actif recharge la version sans second écrivain.

## 7. Corrections recommandées

Aucune n'est déployée.

1. Remplacer le contrôle de `slotId` par l'expression canonique de la section 5.
2. Exiger un créneau futur dans la requête verrouillée.
3. Lier les champs d'identité par des paramètres, au lieu de les interpoler.
4. Rendre l'échec du second nœud de notification visible sans perdre le rendez-vous déjà créé, ou l'inclure dans la même requête de façon à ce qu'un échec annule toute la création.
5. Introduire une clé d'idempotence avant d'exposer la création à des retries clients.
6. Réserver les prochaines mises à jour du workflow 03 à l'API publique de n8n.

Les workflows 08 et 10 n'ont pas été activés. REC-008 n'est pas commencé. Le nettoyage du rendez-vous `3fcc7d62-f586-485d-8313-cce4373a8642` attend un accord.
