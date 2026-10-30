# REC-008 — Phase 8D — Tests SQL

Les tests transactionnels ont été exécutés une fois et annulés par `ROLLBACK`. La table `public.ai_appointment_attempt` est de nouveau vide. Les quatre courses sur deux connexions n'ont pas été lancées : elles exigent des `COMMIT` visibles par l'autre session, donc une autorisation distincte.

## 1. Préflight

Lecture seule, avant le script. Tous les contrôles sont passés.

| Contrôle | Résultat |
|---|---|
| Base | `govsuite` |
| PostgreSQL | 16.14 |
| `public.ai_appointment_attempt` | Présente, 0 ligne |
| Fonctions | `reclamer_tentative_rendez_vous`, `reprendre_tentative_rendez_vous`, `marquer_tentative_incertaine`, `cloturer_tentative_rendez_vous`, `expirer_tentatives_en_attente` |
| Contraintes | Clé primaire et les onze `CHECK` `ck_ai_appointment_attempt_*` du rapport 8C |
| Index | Clé primaire, `uq_ai_appointment_attempt_idempotency_key`, `uq_ai_appointment_attempt_session_ouverte`, `idx_ai_appointment_attempt_reprise`, `idx_ai_appointment_attempt_session_recent` |
| Workflow 03 `SXCesRUmGrV5FMzm` | Actif, 12 nœuds, version `2d72700c-d731-47e1-b6d6-82c5c684f055` |
| Workflow 08 `ZbZoj4yF1s5a3B5E` | Inactif, 5 nœuds |
| Workflow 10 `R7TKt5mqZYpeKapl` | Inactif, 84 nœuds |
| Rendez-vous, notifications, historiques, sessions | 13, 14, 12, 48 |
| Empreinte | `a2dea067599fd4f0a5f857551adc67cc` |
| Mailpit | 5 messages, 2 non lus |

## 2. Script

Fichier : `postgres/tests/20261030_rec008_attempts_tests.sql`.

SHA-256 : `541b99e04ef67dc62330ac527c641af9fdc7a873ab9b90e77ebe92412b878ab6`.

Le fichier commence par `BEGIN` et finit par `ROLLBACK`. Il ne contient aucun `COMMIT`. Il n'insère rien dans `rendez_vous`, `notifications`, `historique_rendez_vous` ni `ai_conversation_state`. Il n'appelle aucun HTTP. Les échecs passent par `RAISE EXCEPTION`. Les lectures de corps et de clé restent dans des variables locales et ne sont pas renvoyées au client : seules des comparaisons booléennes décident du `RAISE`.

## 3. Exécution

Une seule fois :

```text
Get-Content -Raw "postgres\tests\20261030_rec008_attempts_tests.sql" | docker exec -i govsuite-postgres psql -U govsuite -d govsuite -v ON_ERROR_STOP=1
```

Code de retour : 0.

Sortie :

```text
BEGIN
INSERT 0 1
DO
DO
DO
DO
DO
DO
DO
ROLLBACK
```

Aucun `COMMIT`. Aucun `RAISE`. Les sept blocs `DO` correspondent, dans l'ordre, au refus d'unicité, à la réclamation, à la reprise séquentielle, à la confirmation, à l'abandon, à l'expiration et aux compteurs métier.

| Test | Résultat |
|---|---|
| Q1. Insertion d'une tentative en attente | Réussi. `INSERT 0 1` sur l'identifiant synthétique d'attente. |
| Q2. Refus d'une deuxième tentative ouverte pour la même session | Réussi. La seconde insertion lève `unique_violation`, capturée. L'exception `unicite_ouverte_non_appliquee` n'est pas sortie. |
| Q3. Une seule réclamation gagnante | Réussi. Le premier détenteur obtient la tentative, le second reçoit `acquired = false`. |
| Q4. Nouvelle tentative après abandon | Réussi. L'abandon renvoie vrai, puis une seule ligne `AWAITING_CONFIRMATION` existe pour cette session. |
| Q5. Expiration d'une attente, corps et clé effacés | Réussi. `expirer_tentatives_en_attente()` renvoie 1. La ligne échue est `EXPIRED`, corps et clé nuls. |
| Q6. Conservation d'une tentative incertaine | Réussi. La ligne passée à `UNCERTAIN` avant l'expiration reste `UNCERTAIN`, avec corps et clé. L'attente future de l'autre session reste `AWAITING_CONFIRMATION`. |
| Q7. Confirmation | Réussi. La clôture `CONFIRMED` renvoie vrai, le corps et la clé sont nuls, la référence synthétique est conservée. Aucune ligne n'est insérée dans `rendez_vous`. |
| Q8. Sessions existantes | Réussi. Le bloc final exige 48 sessions, 13 rendez-vous, 14 notifications, 12 historiques, et l'absence de `token_gestion`. |
| Q9. Empreinte des rendez-vous | Confirmée après le `ROLLBACK` par une lecture seule : `a2dea067599fd4f0a5f857551adc67cc`. Le script lui-même vérifie le nombre de rendez-vous, pas la chaîne d'empreinte. |

Le même script couvre en plus, dans une seule session, le marquage incertain, une reprise, une reprise après bail forcé dans le passé, et le refus d'une troisième reprise tant que le nouveau bail est valide. Ce n'est pas une course entre deux connexions.

## 4. Transactions

Une transaction cliente : un `BEGIN`, zéro `COMMIT`, un `ROLLBACK`. Le bloc d'unicité ouvre une sous-transaction pour absorber `unique_violation` ; elle est annulée localement, puis la transaction extérieure continue jusqu'au `ROLLBACK`. Aucune écriture n'a été validée.

## 5. Concurrence réelle

Non exécutée.

Deux connexions en lecture validée ne voient pas les lignes non validées de l'autre. Une course sur la même tentative exige donc d'abord un `COMMIT` de la ligne synthétique, puis un `COMMIT` du gagnant pour libérer le verrou, puis un `DELETE` validé au nettoyage. Un `ROLLBACK` dans une connexion n'efface pas ce que l'autre a déjà validé. Le message de phase demande une autorisation distincte avant toute écriture persistante. Le protocole s'arrête ici.

Identifiants réservés, non insérés :

| Course | Identifiant | Session |
|---|---|---|
| A. Deux réclamations | `00000000-0000-4000-8000-000000008d01` | `rec008-8d-session-claim` |
| B. Deux reprises | `00000000-0000-4000-8000-000000008d02` | `rec008-8d-session-resume` |
| C. Bail expiré | `00000000-0000-4000-8000-000000008d03` | `rec008-8d-session-lease` |
| D. Déjà confirmée | `00000000-0000-4000-8000-000000008d04` | `rec008-8d-session-confirmed` |

La confirmation de D utiliserait l'identifiant de rendez-vous `00000000-0000-4000-8000-000000008d99` et une référence synthétique de moins de 40 caractères. Avant usage, une lecture devra prouver que cet identifiant est absent de `rendez_vous`. Aucune insertion dans `rendez_vous`.

Les corps et les clés resteraient des valeurs synthétiques du jeu de tests. Les requêtes de contrôle ne renverraient que des booléens et des statuts : égalité du corps, égalité de la clé, `acquired`. Aucune clé brute ne serait affichée.

Déroulé prévu, seulement après accord :

1. Relire les compteurs, l'empreinte et le vide de la table.
2. Course A. Valider une attente. Deux sessions appellent `reclamer_tentative_rendez_vous`. La première garde sa transaction ouverte, donc le verrou de ligne. La seconde bloque, puis reçoit `acquired = false` et un corps nul quand la première valide. Le corps et la clé de la ligne restent ceux de l'insertion.
3. Course B. Valider une ligne `UNCERTAIN`. Deux sessions appellent `reprendre_tentative_rendez_vous` de la même façon. Une seule obtient le bail. L'autre reçoit `acquired = false` et aucun corps à envoyer.
4. Course C. Valider un `SUBMITTING`, puis placer `lease_until` dans le passé. Le nouveau détenteur reprend. L'ancien appel à `cloturer_tentative_rendez_vous` renvoie faux. Le corps et la clé restent égaux à ceux d'avant la reprise.
5. Course D. Clôturer en `CONFIRMED` pendant que le bail du détenteur est valide. `reclamer_tentative_rendez_vous` et `reprendre_tentative_rendez_vous` renvoient tous deux faux.
6. Nettoyage, dans une transaction séparée, seulement si toutes les lignes présentes ont un identifiant de la liste et une session `rec008-8d-session-%`, si les compteurs métier sont inchangés, et si `00000000-0000-4000-8000-000000008d99` est absent de `rendez_vous`. Le `DELETE` filtre à la fois sur ces identifiants et sur ce préfixe de session. S'il retire un nombre de lignes différent du décompte préalable, la transaction de nettoyage est annulée et aucune suppression plus large n'est tentée.
7. Relire la table vide, les compteurs, l'empreinte, les workflows et Mailpit.

Si le processus s'arrête entre un `COMMIT` de préparation et ce `DELETE`, les lignes synthétiques restent. C'est le motif de l'arrêt avant exécution.

## 6. Nettoyage constaté

Lecture seule après le `ROLLBACK` du script.

| Contrôle | Résultat |
|---|---|
| Lignes de `ai_appointment_attempt` | 0 |
| Identifiants `00000000-0000-4000-8000-000000008b01` à `008b06` | 0 |
| Sessions `rec008-8b-%` | 0 |
| Rendez-vous, notifications, historiques, sessions | 13, 14, 12, 48 |
| Clés d'idempotence renseignées sur les rendez-vous | 0 |
| Empreinte | `a2dea067599fd4f0a5f857551adc67cc` |
| Workflow 03 | Actif, 12 nœuds, version `2d72700c-d731-47e1-b6d6-82c5c684f055` |
| Workflows 08 et 10 | Inactifs, 5 et 84 nœuds |
| Mailpit | 5 messages, 2 non lus |

Aucun workflow n'a été modifié ni appelé. Aucun e-mail n'a été envoyé. Les fonctions et le schéma n'ont pas été modifiés. Aucun dump n'a été restauré. Le rollback de migration n'a pas été exécuté.

## 7. Anomalies et limites

Aucune assertion n'a échoué. Aucune donnée synthétique ne reste.

Le script ne calcule pas l'empreinte métier. Q9 repose sur la lecture seule faite après le `ROLLBACK`, et sur le fait que le script n'écrit pas dans `rendez_vous`.

La reprise du script est séquentielle, dans la transaction qui est ensuite annulée. Elle ne remplace pas les courses A à D.

## 8. Verdict

**GO** pour exécuter ensuite le protocole de concurrence de la section 5, après une autorisation explicite d'écriture persistante et de nettoyage borné.

**NO-GO** pour la phase 8E. Le workflow 10 n'est pas modifié tant que les courses A à D n'ont pas été exécutées, nettoyées, puis autorisées à part.
