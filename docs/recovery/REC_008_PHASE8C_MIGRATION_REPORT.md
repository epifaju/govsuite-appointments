# REC-008 — Phase 8C — Application de la migration

La migration a été appliquée une fois. La table `public.ai_appointment_attempt` est vide. Les compteurs métier, l'empreinte et les workflows sont inchangés. Les tests SQL n'ont pas été exécutés.

## 1. Préflight

Lecture seule, avant le dump et avant la migration. Tous les contrôles sont passés.

| Contrôle | Résultat |
|---|---|
| Base | `govsuite` |
| PostgreSQL | 16.14 |
| `public.ai_appointment_attempt` | Absente |
| Workflow 03 `SXCesRUmGrV5FMzm` | Actif, 12 nœuds, version `2d72700c-d731-47e1-b6d6-82c5c684f055` |
| Workflow 08 `ZbZoj4yF1s5a3B5E` | Inactif |
| Workflow 10 `R7TKt5mqZYpeKapl` | Inactif, 84 nœuds |
| Rendez-vous | 13 |
| Notifications | 14 |
| Historiques | 12 |
| Sessions | 48 |
| Clés d'idempotence renseignées | 0 |
| Empreinte | `a2dea067599fd4f0a5f857551adc67cc` |
| Sessions PostgreSQL non inactives | 0 |
| Exécutions n8n `running`, `new`, `waiting`, `unknown` | 0 |
| Mailpit | 5 messages, 2 non lus |

Aucune exécution métier concurrente n'était visible.

## 2. Empreintes SHA-256

Les trois fichiers ont été relus et hachés avant toute exécution. Les empreintes correspondent.

| Fichier | Taille | SHA-256 | Exécuté |
|---|---:|---|---|
| `postgres/migrations/20261030_rec008_attempts.sql` | 14 357 octets | `b443b1ccd8ccd47ba79537942a60deed934c2c44ec33798d8b3c39fcffd52327` | Oui, une fois |
| `postgres/migrations/20261030_rec008_attempts_rollback.sql` | 937 octets | `45c752fd23a1e88dc86db8fa16aeae1d8145be551e32fd1eceb63b41f204f887` | Non |
| `postgres/tests/20261030_rec008_attempts_tests.sql` | 10 734 octets | `541b99e04ef67dc62330ac527c641af9fdc7a873ab9b90e77ebe92412b878ab6` | Non |

## 3. Audit statique

Les trois scripts ont été lus intégralement. Aucune anomalie bloquante.

La migration tient dans un seul `BEGIN` / `COMMIT`. `ON_ERROR_STOP=1` a été passé à `psql`. Le DDL PostgreSQL 16 est transactionnel : un échec avant `COMMIT` n'aurait rien laissé. Il n'y a pas de SQL dynamique. Le seul mot `EXECUTE` du fichier est dans `GRANT EXECUTE`. `p_status` est affecté comme valeur après une liste blanche (`CONFIRMED`, `REJECTED`, `SLOT_UNAVAILABLE`), jamais interpolé. Aucun trigger. Aucun `ALTER`, `DELETE` ou `TRUNCATE` de `rendez_vous`, `notifications`, `historique_rendez_vous` ou `ai_conversation_state`.

Les cinq fonctions sont `LANGUAGE plpgsql`, `VOLATILE`, `SECURITY INVOKER`, avec `search_path = pg_catalog, public` et `#variable_conflict use_column`. `PUBLIC` perd `EXECUTE`. Seul `govsuite` le reçoit. Les comparaisons de bail utilisent `clock_timestamp()`, ce qui reste correct à l'intérieur d'une transaction. Un détenteur hors du motif `^[A-Za-z0-9._~-]{16,64}$` est refusé sans écriture.

La table ne contient pas `token_gestion`. Les colonnes personnelles sont `idempotency_key` et `request_payload`. Les contraintes les rendent obligatoires tant que le statut est ouvert, et les interdisent dès qu'il est définitif.

### Contraintes et transitions

Les statuts ouverts sont `AWAITING_CONFIRMATION`, `SUBMITTING` et `UNCERTAIN`. Les statuts définitifs sont `CONFIRMED`, `ABANDONED`, `REJECTED`, `SLOT_UNAVAILABLE` et `EXPIRED`.

Chaque transition prévue reste compatible avec les `CHECK` :

| Transition | Effet sur les contraintes |
|---|---|
| Insertion en attente | Corps et clé présents, pas de bail, `submitted_at` nul, `resume_count` à 0 |
| Réclamation | `SUBMITTING`, bail posé, `submitted_at` renseigné, corps et clé conservés |
| Marquage incertain | `UNCERTAIN`, bail retiré, corps et clé conservés, `submitted_at` conservé |
| Reprise | Retour à `SUBMITTING`, nouveau bail, `resume_count` incrémenté, corps et clé inchangés |
| Confirmation | `CONFIRMED`, identifiant et référence posés, corps, clé et bail effacés |
| Refus ou créneau indisponible | Statut définitif, corps, clé et bail effacés, aucun identifiant de rendez-vous |
| Abandon | Depuis l'attente seulement, corps et clé effacés, `submitted_at` reste nul |
| Expiration | Depuis l'attente échue seulement, même effacement, sans `DELETE` |

### Dix cas exigés

1. Deux confirmations simultanées. `reclamer_tentative_rendez_vous` est un seul `UPDATE` filtré sur `AWAITING_CONFIRMATION`. Le verrou de ligne ne laisse passer qu'un détenteur. Le second ne trouve plus la ligne et reçoit `acquired = false`, sans corps ni clé.
2. Une tentative confirmée ne peut pas être reprise. `reprendre_tentative_rendez_vous` n'accepte que `UNCERTAIN`, ou `SUBMITTING` dont le bail est échu. La confirmation a déjà effacé la clé, ce que le `WHERE` exige non nulle.
3. Un bail expiré ne peut être repris que par un seul appelant. La reprise est un seul `UPDATE`. Le second relit la ligne déjà repassée à `SUBMITTING` avec un bail encore valide, et échoue.
4. L'ancien détenteur ne peut plus clôturer après un nouveau bail. `cloturer_tentative_rendez_vous` et `marquer_tentative_incertaine` exigent `lease_owner` égal à l'appelant et `lease_until` encore valide. Le nouveau détenteur a remplacé les deux.
5. Une réponse HTTP incertaine conserve le corps et la clé. `marquer_tentative_incertaine` n'efface que le bail. `ck_ai_appointment_attempt_open_body` interdit un statut ouvert sans corps ni clé.
6. Les transitions définitives effacent les données personnelles dans le même `UPDATE` que le changement de statut. `CONFIRMED` conserve `appointment_id` et `appointment_reference`. Le jeton de gestion n'est pas une colonne.
7. Une tentative abandonnée ne bloque pas la suivante. L'index unique partiel `uq_ai_appointment_attempt_session_ouverte` ne couvre que les trois statuts ouverts.
8. Les contraintes restent compatibles avec toutes les transitions du tableau ci-dessus. Aucune transition prévue ne laisse un corps sur un statut définitif, ni un bail hors de `SUBMITTING`.
9. L'expiration d'une attente ne supprime pas une tentative déjà soumise. `expirer_tentatives_en_attente` ne met à jour que `AWAITING_CONFIRMATION` dont `expires_at` est dépassé. Elle ne fait pas de `DELETE`. La reprise ne reteste pas `expires_at` : une tentative soumise ou incertaine peut encore être rejouée après la fin de la fenêtre d'attente.
10. Aucune fonction ne crée une nouvelle clé. La clé n'a pas de valeur par défaut. Les fonctions la recopient telle quelle, ou la passent à `NULL` lors d'une clôture. Un HTTP ambigu ne produit donc pas une seconde clé.

### Rollback et tests

Le rollback est une transaction. S'il existe au moins une ligne, il lève une exception et n'efface rien. Sinon il retire les cinq fonctions puis la table. Il ne touche pas aux tables métier. Il n'a pas été exécuté.

Le fichier de tests est une transaction `BEGIN` / `ROLLBACK`. Il couvre l'unicité d'une tentative ouverte, la réclamation gagnante et perdante, la conservation du corps en cas d'incertitude, la reprise unique d'un bail expiré, la clôture, l'abandon suivi d'une nouvelle tentative, et l'expiration qui laisse intacte une ligne incertaine. Il n'écrit pas dans `rendez_vous`. Il n'a pas été exécuté.

### Risque résiduel, non bloquant

`govsuite` est propriétaire de la table. Outre `SELECT`, `INSERT`, `UPDATE` et `DELETE`, le propriétaire dispose par défaut de `TRUNCATE`, `REFERENCES` et `TRIGGER`. `PUBLIC` n'a aucun droit sur la table, et aucun droit d'exécution sur les fonctions.

Un `DELETE` ou un `TRUNCATE` direct peut donc retirer une ligne `UNCERTAIN` ou `CONFIRMED` sans passer par les fonctions. Les `CHECK` empêchent en revanche un `UPDATE` incohérent : un statut ouvert sans corps, ou une confirmation qui conserverait le corps. Les fonctions elles-mêmes ne suppriment aucune ligne. Ce droit a été choisi en phase 8B pour une purge ultérieure. Modifier le fichier aurait changé son empreinte. Il n'a pas été modifié.

Un second point est déjà prévu par le bail de 90 secondes. Si un appel HTTP dure plus longtemps, le détenteur d'origine ne peut plus marquer ni clôturer. Le travailleur suivant reprend le même corps et la même clé. Deux envois qui se chevauchent restent donc le même appel idempotent.

`govsuite` peut aussi lire `idempotency_key` par un `SELECT` direct. Aucun secret n'est écrit dans cette table au-delà de cette clé et du corps figé, et les deux sont effacés aux statuts définitifs.

## 4. Sauvegarde

Dump pris avant la migration, format custom, code de retour 0.

| Élément | Valeur |
|---|---|
| Fichier | `backups/govsuite-pre-rec008-phase8c-20261030-122150.dump` |
| Taille | 631 978 octets |
| SHA-256 | `0249dcac0ebfbe2d4edd80691b0e8bbebfee0dd4fe1f510dc068c7dc8d832ae4` |
| `pg_restore -l` | Code 0 ; les données de `rendez_vous`, `notifications`, `historique_rendez_vous`, `creneaux` et `ai_conversation_state` sont listées |

Les dumps précédents sont conservés : `govsuite-pre-rec003-20261028.dump`, `govsuite-pre-rec006-apply-20261029.dump`, `govsuite-pre-rec007-20261029.dump` et `govsuite-pre-rec007-phase7g-20261030-002948.dump`. Aucune restauration n'a été faite.

## 5. Commande exécutée

Une seule fois, code de retour 0. La sortie se termine par `COMMIT`, après `CREATE TABLE`, quatre index, cinq fonctions, les `REVOKE` et les `GRANT`.

```text
Get-Content -Raw "postgres\migrations\20261030_rec008_attempts.sql" | docker exec -i govsuite-postgres psql -U govsuite -d govsuite -v ON_ERROR_STOP=1
```

Aucun secret n'est passé sur la ligne de commande. Le rollback n'a pas été lancé. La commande n'a pas été rejouée.

## 6. Structure installée

Table `public.ai_appointment_attempt`, 0 ligne, 0 trigger utilisateur.

Colonnes : `id uuid` défaut `gen_random_uuid()`, `session_id varchar(255)`, `idempotency_key varchar(128)`, `request_payload jsonb`, `request_fingerprint varchar(64)`, `status varchar(32)`, `appointment_id uuid`, `appointment_reference varchar(40)`, `created_at` et `updated_at` défaut `clock_timestamp()`, `expires_at`, `submitted_at`, `confirmed_at`, `lease_owner varchar(64)`, `lease_until`, `resume_count integer` défaut 0. Pas de colonne de jeton.

Contraintes présentes : clé primaire, `ck_ai_appointment_attempt_status`, `_fingerprint`, `_key`, `_dates`, `_lease`, `_resume`, `_open_body`, `_terminal_privacy`, `_result`, `_submitted`, `_payload_shape`.

Index présents :

| Index | Définition constatée |
|---|---|
| `ai_appointment_attempt_pkey` | Unique sur `id` |
| `uq_ai_appointment_attempt_idempotency_key` | Unique sur `idempotency_key` quand elle n'est pas nulle |
| `uq_ai_appointment_attempt_session_ouverte` | Unique sur `session_id` pour les trois statuts ouverts |
| `idx_ai_appointment_attempt_reprise` | `(lease_until, id)` pour `SUBMITTING` et `UNCERTAIN` |
| `idx_ai_appointment_attempt_session_recent` | `(session_id, created_at DESC)` |

Fonctions, toutes `SECURITY INVOKER` et `search_path=pg_catalog, public`. Seul `govsuite` a `EXECUTE`.

| Fonction | Signature constatée | Résultat |
|---|---|---|
| `reclamer_tentative_rendez_vous` | `(uuid, text, text)` | table `acquired`, identité, statut, corps, clé, empreinte, compteur |
| `reprendre_tentative_rendez_vous` | `(uuid, text, text)` | même table |
| `marquer_tentative_incertaine` | `(uuid, text, text)` | `boolean` |
| `cloturer_tentative_rendez_vous` | `(uuid, text, text, text, uuid, text)` | `boolean` |
| `expirer_tentatives_en_attente` | `()` | `integer` |

## 7. Intégrité après migration

| Contrôle | Résultat |
|---|---|
| Table | Présente, vide |
| Rendez-vous, notifications, historiques, sessions | 13, 14, 12, 48 |
| Clés d'idempotence renseignées | 0 |
| Empreinte | `a2dea067599fd4f0a5f857551adc67cc` |
| Workflow 03 | Actif, 12 nœuds, version `2d72700c-d731-47e1-b6d6-82c5c684f055` |
| Workflow 08 | Inactif, 5 nœuds |
| Workflow 10 | Inactif, 84 nœuds |
| Mailpit | 5 messages, 2 non lus |

Aucun workflow n'a été modifié, activé ou appelé. Aucun e-mail n'a été envoyé. Aucune tentative synthétique n'a été créée.

## 8. Anomalies

Aucune anomalie bloquante. Le droit direct de suppression du propriétaire, décrit en section 3, reste un risque résiduel accepté. Il ne change pas le verdict.

## 9. Verdict

**GO** pour la phase 8D : exécuter plus tard, après une nouvelle autorisation, le fichier de tests `postgres/tests/20261030_rec008_attempts_tests.sql` dans sa transaction qui se termine par `ROLLBACK`.

**NO-GO** pour lancer ces tests dans la phase 8C, pour modifier ou activer un workflow, et pour exécuter le rollback.
