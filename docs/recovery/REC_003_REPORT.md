# Rapport REC-003

**Date :** 28 octobre 2026  
**Périmètre :** nœud `Sauvegarder état conversation` du workflow vivant `10_AI_ConsularAssistant_Complete` (`R7TKt5mqZYpeKapl`).  
**Suite :** REC-004, REC-005 et REC-006 ne sont pas engagés.

## 1. Cause racine

Le nœud enregistre l'état avec un UPSERT paramétré par `$1::jsonb`. Le document JSON est produit par `JSON.stringify`. Une clé présente avec la valeur `null` est donc envoyée, et PostgreSQL la voit : `data ? 'token'` est vrai, tandis que `data->>'token'` vaut NULL.

L'ancienne requête écrivait chaque colonne métier avec `COALESCE(EXCLUDED.colonne, ai_conversation_state.colonne)`. Un NULL explicite, qui signifie « effacer », était traité comme « valeur absente ». L'ancienne valeur restait. C'est ce qui faisait réapparaître le token, le site, les dates, `new_slot_id` et les données personnelles après une nouvelle création.

`available_slots` et `selected_slot_index` n'étaient pas dans cet UPSERT. Un tableau vide ou un index `null` ne pouvait pas remplacer la mémoire précédente.

`Fusionner état conversation` et `Gérer collecte progressive` émettent déjà ces clés, y compris à `null` ou `[]`. Ils n'ont pas été modifiés.

Le contrôle `TEST-OLD`, exécuté dans la transaction annulée avec l'ancienne requête, a reproduit le symptôme : après une demande de création, le service devenait `PASSEPORT` et l'étape `ASK_CREATE_SITE`, mais le site `LISBONNE`, les dates, le token, `new_slot_id`, les créneaux, l'index et le nom restaient.

## 2. Requête SQL corrigée

Le paramètre reste `$1::jsonb`, via `queryReplacement` inchangé : `={{ JSON.stringify($json) }}`.

`prepared` analyse le document. `existing` verrouille la session déjà présente. `resolved` choisit la valeur dans la même instruction :

- clé JSON présente : prendre la valeur analysée, y compris NULL ;
- clé JSON absente : conserver la colonne existante ;
- session nouvelle et clé absente : NULL, puisqu'il n'y a pas d'ancienne ligne.

`INSERT` et `ON CONFLICT DO UPDATE` utilisent ensuite cette ligne résolue, sans `COALESCE` sur les colonnes métier. `id` et `created_at` ne sont pas réécrits. `updated_at` et `expires_at` sont rafraîchis. Une chaîne vide, ou les textes `null` et `undefined` sur une date ou un UUID, restent convertis en NULL comme auparavant.

```sql
WITH input AS (
    SELECT $1::jsonb AS data
),
prepared AS (
    SELECT
        NULLIF(data->>'sessionId', '') AS session_id,
        data AS payload,
        NULLIF(data->>'intent', '') AS intent,
        NULLIF(data->>'service', '') AS service,
        NULLIF(data->>'site', '') AS site,
        CASE
            WHEN NULLIF(data->>'dateDebut', '') IS NULL
              OR LOWER(data->>'dateDebut') IN ('null', 'undefined')
            THEN NULL
            ELSE (data->>'dateDebut')::date
        END AS date_debut,
        CASE
            WHEN NULLIF(data->>'dateFin', '') IS NULL
              OR LOWER(data->>'dateFin') IN ('null', 'undefined')
            THEN NULL
            ELSE (data->>'dateFin')::date
        END AS date_fin,
        CASE
            WHEN NULLIF(data->>'slotId', '') IS NULL
              OR LOWER(data->>'slotId') IN ('null', 'undefined')
            THEN NULL
            ELSE (data->>'slotId')::uuid
        END AS slot_id,
        CASE
            WHEN NULLIF(data->>'token', '') IS NULL
              OR LOWER(data->>'token') IN ('null', 'undefined')
            THEN NULL
            ELSE (data->>'token')::uuid
        END AS token,
        CASE
            WHEN NULLIF(data->>'newSlotId', '') IS NULL
              OR LOWER(data->>'newSlotId') IN ('null', 'undefined')
            THEN NULL
            ELSE (data->>'newSlotId')::uuid
        END AS new_slot_id,
        NULLIF(data->>'reference', '') AS reference,
        NULLIF(data->>'nom', '') AS nom,
        NULLIF(data->>'prenom', '') AS prenom,
        NULLIF(data->>'email', '') AS email,
        NULLIF(data->>'telephone', '') AS telephone,
        NULLIF(data->>'pendingAction', '') AS pending_action,
        NULLIF(data->>'conversationStep', '') AS conversation_step,
        CASE
            WHEN jsonb_typeof(data->'availableSlots') = 'array'
            THEN data->'availableSlots'
            ELSE NULL
        END AS available_slots,
        CASE
            WHEN NULLIF(data->>'selectedSlotIndex', '') IS NULL
              OR LOWER(data->>'selectedSlotIndex') IN ('null', 'undefined')
            THEN NULL
            ELSE (data->>'selectedSlotIndex')::integer
        END AS selected_slot_index,
        NULLIF(data->>'originalMessage', '') AS last_user_message
    FROM input
),
existing AS (
    SELECT s.*
    FROM ai_conversation_state AS s
    INNER JOIN prepared AS p
        ON s.session_id = p.session_id
    FOR UPDATE
),
resolved AS (
    SELECT
        p.session_id,
        CASE WHEN p.payload ? 'intent' THEN p.intent ELSE e.intent END AS intent,
        CASE WHEN p.payload ? 'service' THEN p.service ELSE e.service END AS service,
        CASE WHEN p.payload ? 'site' THEN p.site ELSE e.site END AS site,
        CASE WHEN p.payload ? 'dateDebut' THEN p.date_debut ELSE e.date_debut END AS date_debut,
        CASE WHEN p.payload ? 'dateFin' THEN p.date_fin ELSE e.date_fin END AS date_fin,
        CASE WHEN p.payload ? 'slotId' THEN p.slot_id ELSE e.slot_id END AS slot_id,
        CASE WHEN p.payload ? 'token' THEN p.token ELSE e.token END AS token,
        CASE WHEN p.payload ? 'newSlotId' THEN p.new_slot_id ELSE e.new_slot_id END AS new_slot_id,
        CASE WHEN p.payload ? 'reference' THEN p.reference ELSE e.reference END AS reference,
        CASE WHEN p.payload ? 'nom' THEN p.nom ELSE e.nom END AS nom,
        CASE WHEN p.payload ? 'prenom' THEN p.prenom ELSE e.prenom END AS prenom,
        CASE WHEN p.payload ? 'email' THEN p.email ELSE e.email END AS email,
        CASE WHEN p.payload ? 'telephone' THEN p.telephone ELSE e.telephone END AS telephone,
        CASE WHEN p.payload ? 'pendingAction' THEN p.pending_action ELSE e.pending_action END AS pending_action,
        CASE WHEN p.payload ? 'conversationStep' THEN p.conversation_step ELSE e.conversation_step END AS conversation_step,
        CASE WHEN p.payload ? 'availableSlots' THEN p.available_slots ELSE e.available_slots END AS available_slots,
        CASE WHEN p.payload ? 'selectedSlotIndex' THEN p.selected_slot_index ELSE e.selected_slot_index END AS selected_slot_index,
        CASE WHEN p.payload ? 'originalMessage' THEN p.last_user_message ELSE e.last_user_message END AS last_user_message
    FROM prepared AS p
    LEFT JOIN existing AS e
        ON e.session_id = p.session_id
)
INSERT INTO ai_conversation_state (
    session_id, intent, service, site, date_debut, date_fin,
    slot_id, token, new_slot_id, reference,
    nom, prenom, email, telephone,
    pending_action, conversation_step,
    available_slots, selected_slot_index,
    last_user_message, updated_at, expires_at
)
SELECT
    session_id, intent, service, site, date_debut, date_fin,
    slot_id, token, new_slot_id, reference,
    nom, prenom, email, telephone,
    pending_action, conversation_step,
    available_slots, selected_slot_index,
    last_user_message, NOW(), NOW() + INTERVAL '2 hours'
FROM resolved
ON CONFLICT (session_id) DO UPDATE SET
    intent = EXCLUDED.intent,
    service = EXCLUDED.service,
    site = EXCLUDED.site,
    date_debut = EXCLUDED.date_debut,
    date_fin = EXCLUDED.date_fin,
    slot_id = EXCLUDED.slot_id,
    token = EXCLUDED.token,
    new_slot_id = EXCLUDED.new_slot_id,
    reference = EXCLUDED.reference,
    nom = EXCLUDED.nom,
    prenom = EXCLUDED.prenom,
    email = EXCLUDED.email,
    telephone = EXCLUDED.telephone,
    pending_action = EXCLUDED.pending_action,
    conversation_step = EXCLUDED.conversation_step,
    available_slots = EXCLUDED.available_slots,
    selected_slot_index = EXCLUDED.selected_slot_index,
    last_user_message = EXCLUDED.last_user_message,
    updated_at = NOW(),
    expires_at = NOW() + INTERVAL '2 hours'
RETURNING
    session_id AS "sessionId",
    intent, service, site,
    date_debut AS "dateDebut",
    date_fin AS "dateFin",
    slot_id AS "slotId",
    token,
    new_slot_id AS "newSlotId",
    reference, nom, prenom, email, telephone,
    pending_action AS "pendingAction",
    conversation_step AS "conversationStep",
    available_slots AS "availableSlots",
    selected_slot_index AS "selectedSlotIndex",
    last_user_message AS "originalMessage",
    created_at AS "createdAt",
    updated_at AS "updatedAt",
    expires_at AS "expiresAt";
```

La requête complète a été exécutée par PostgreSQL, `INSERT` compris et `ON CONFLICT` compris. Le CTE `prepared` est lu par `existing` et par `resolved` dans cette même instruction. L'empreinte MD5 de la requête installée est `fef8008b58b71378e45490a19b4a1f75`. Elle contient la règle de présence et `$1::jsonb`. Elle ne contient plus `COALESCE(EXCLUDED.token`.

## 3. Résultats des tests

Les scripts réels de `Parser intention`, `Fusionner état conversation`, `Gérer collecte progressive` et `Valider paramètres disponibilité` ont été exécutés avec le message du tour et la forme de ligne renvoyée par `Charger état conversation`. Le JSON obtenu a été passé à la requête. Chaque scénario a comparé la ligne PostgreSQL avant et après sauvegarde.

Toutes les sessions étaient préfixées `rec003-test-`. La transaction a été annulée. Aucune de ces lignes n'a été conservée. Les 48 sessions existantes et les 13 rendez-vous n'ont pas été réutilisés. Leur nombre et l'empreinte des rendez-vous sont restés identiques dans la transaction, puis après l'annulation : 48 sessions, 0 session de test, 13 rendez-vous.

Les jetons ne sont pas reproduits. La colonne indique seulement s'il y en a un.

| Scénario | Avant | Après |
|---|---|---|
| TEST-001, création après replanification | `RESCHEDULE`, site `LISBONNE`, dates présentes, créneau présent, jeton présent, `new_slot_id` présent, 1 créneau mémorisé, index présent, nom `SILVA` | `CREATE_APPOINTMENT` / `ASK_CREATE_SITE`, service `PASSEPORT`, site vide, dates vides, créneau vide, jeton effacé, `new_slot_id` effacé, 0 créneau, index effacé, identité effacée |
| TEST-002, continuation « Paris » | `CREATE` / `ASK_CREATE_SITE`, service `PASSEPORT`, site vide, jeton déjà absent | service `PASSEPORT`, site `PARIS`, étape `ASK_CREATE_DATE_RANGE`, jeton toujours absent, dates toujours vides |
| TEST-003, redémarrage explicite de CREATE | `CREATE` / `ASK_PRENOM`, site `PARIS`, dates présentes, créneau présent, nom `SILVA`, prénom `MARIE` | retour à `ASK_CREATE_SITE`, site, dates, créneau, index, nom et prénom effacés |
| TEST-004, isolation CANCEL | `CANCEL`, jeton présent, référence présente | `ASK_CREATE_SITE`, jeton effacé, référence effacée |
| TEST-004, isolation GET | `GET`, jeton présent, référence présente | `ASK_CREATE_SITE`, jeton effacé, référence effacée |
| TEST-004, isolation RESCHEDULE | `RESCHEDULE`, service `LEGALISATION`, site `LISBONNE`, jeton présent, `new_slot_id` présent, 1 créneau, index présent | `ASK_CREATE_SITE`, service `PASSEPORT`, jeton et créneaux effacés |
| TEST-005, persistance du jeton | même forme qu'une replanification, jeton présent | jeton absent dans la fusion, absent dans la collecte, absent après sauvegarde ; le nœud de validation, qui recopie l'élément, le laisse absent |
| TEST-INSERT, session nouvelle | aucune ligne | ligne créée, `PASSEPORT`, `ASK_CREATE_SITE`, jeton absent, 0 créneau |
| Continuité d'identité, message « Marie » | `ASK_PRENOM`, nom `SILVA`, prénom vide, site `PARIS`, créneau conservé | nom `SILVA`, prénom `Marie`, site `PARIS`, étape `ASK_EMAIL`, créneau et index conservés |
| Clé `service` absente, `site` fourni | service `PASSEPORT`, site `PARIS`, 1 créneau, index présent | service `PASSEPORT` conservé, site `LISBONNE`, créneau et index conservés |
| `availableSlots: []` et `selectedSlotIndex: null` | 1 créneau, index présent, service et site présents | 0 créneau, index effacé, service `PASSEPORT` et site `PARIS` conservés |

## 4. Régressions

Aucune régression constatée sur le périmètre contrôlé.

- `Fusionner état conversation` et `Gérer collecte progressive` ont le même script qu'avant l'import.
- Les paramètres du nœud de sauvegarde, en dehors de la requête, sont inchangés.
- Les connexions et les 83 autres nœuds ont les mêmes paramètres.
- Les 10 autres workflows ont le même état actif, la même date de mise à jour et le même nombre de nœuds.
- Les 5 workflows qui étaient actifs le sont toujours.
- Les 48 sessions et les 13 rendez-vous sont intacts.
- La copie `n8n/live-exports/2026-10-28/R7TKt5mqZYpeKapl.json` a toujours l'empreinte SHA-256 `6e8227584945b15bc506dd5448787062734aec9c489bddcfe3b2466995d53a5d`.

## 5. État du workflow après modification

| Élément | Valeur |
|---|---|
| Identifiant | `R7TKt5mqZYpeKapl` |
| Nom | `10_AI_ConsularAssistant_Complete` |
| Actif | non |
| Nœuds | 84 |
| Version | `0d34d7f2-abbf-47d3-983f-fd134622dd3a` |
| `updatedAt` en base | 21 septembre 2026, 23:17:43 +02 |
| Workflows dans n8n | 11 |
| Workflows actifs | 5, inchangés |

L'import a créé une nouvelle version. Il a conservé la date `updatedAt` portée par le document importé, lui-même issu de la sauvegarde du 28 octobre. Le contenu de la requête en base est pourtant bien la requête corrigée : sa présence a été relue après l'import.

Le drapeau `--activeState=fromJson` est refusé par cette instance, qui n'est pas en mode file d'attente. L'import a donc utilisé le comportement par défaut, qui désactive le workflow importé. Le workflow 10 était déjà inactif. Il l'est resté. Aucun autre workflow n'a été désactivé.

Le workflow principal n'a pas été activé. Le parcours de chat n8n, avec Ollama, n'a donc pas été rejoué.

## 6. Fichiers modifiés

| Fichier | Rôle |
|---|---|
| `docs/recovery/REC_003_REPORT.md` | ce rapport |
| `n8n/live-exports/2026-10-28-rec003/R7TKt5mqZYpeKapl.json` | export du workflow corrigé, bloc `shared` retiré |
| `n8n/live-exports/2026-10-28-rec003-MANIFEST.json` | inventaire, hors du dossier importable |

La base n8n contient la requête corrigée dans `workflow_entity`. Aucun fichier de `n8n/live-exports/2026-10-28/` n'a été réécrit. Aucun autre workflow du dépôt n'a été modifié. Le script de migration `database/migrations/001_ai_conversation_state.sql` n'a pas été réexécuté : la table existait déjà.

## 7. Procédure de retour arrière

La procédure n'a pas été exécutée. Elle réimporte uniquement la copie du 28 octobre et laisse le workflow inactif :

```text
docker compose cp n8n/live-exports/2026-10-28/R7TKt5mqZYpeKapl.json n8n:/tmp/rec003-rollback.json
docker compose exec -T n8n n8n import:workflow --input=/tmp/rec003-rollback.json
```

Ne pas restaurer `backups/govsuite-pre-rec003-20261028.dump` sur la base actuelle. Cette restauration écraserait les données présentes. Le retour arrière du nœud ne nécessite pas ce dump.

## 8. Critères d'acceptation

Les critères demandés pour REC-003 sont satisfaits.

- Une clé présente est enregistrée, y compris lorsqu'elle vaut `null`.
- Une clé absente conserve l'ancienne colonne.
- `availableSlots: []` vide les créneaux.
- `selectedSlotIndex: null` efface la sélection.
- Les deux chemins `INSERT` et `ON CONFLICT DO UPDATE` ont été exécutés.
- Les données personnelles restent pendant la collecte et sont effacées par une nouvelle création.
- Les sauvegardes du 28 octobre, les autres workflows et les rendez-vous existants sont inchangés.

## 9. Points résiduels

- Le chat complet dans n8n reste à vérifier lors d'une activation explicitement autorisée. Le workflow 10 est inactif.
- La colonne `updatedAt` du workflow affiche toujours le 21 septembre 2026. La version, elle, a changé.
- Une chaîne vide est encore enregistrée comme NULL, par les mêmes `NULLIF` que l'ancienne requête.
- Un UUID mal formé provoque encore une erreur PostgreSQL.
- Les créneaux métier s'arrêtent au 3 septembre 2026. Ce n'est pas l'objet de REC-003.
- REC-004, REC-005 et REC-006 n'ont pas été commencés.
