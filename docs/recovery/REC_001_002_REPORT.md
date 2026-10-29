# Rapport REC-001 et REC-002

**Date :** 28 octobre 2026  
**Périmètre :** Lot 0 seulement. Aucune correction de logique métier, aucun réimport, aucune suppression de données.  
**Suite :** le Lot 1 (REC-003 et suivants) n'est pas engagé.

## 1. Environnement au moment de l'export

| Conteneur | Avant | Action | Après |
|---|---|---|---|
| `govsuite-postgres` | déjà démarré, sain, port hôte `5433` | aucune | sain |
| `govsuite-n8n` | arrêté depuis environ deux semaines | `docker compose up -d n8n` | démarré |
| `govsuite-mailpit` | arrêté | démarré comme dépendance de n8n | démarré |

n8n `2.32.6` répond `200` sur `http://localhost:5680/healthz`. Aucun volume n'a été supprimé. `docker compose down -v` n'a pas été utilisé.

Le dossier n'est pas un dépôt Git. Les JSON déjà présents dans `n8n/workflows/` n'ont pas été remplacés.

## 2. Workflows exportés

Commande exécutée dans le conteneur, sans déchiffrement de credentials :

```text
n8n export:workflow --all --pretty --separate --output=/tmp/govsuite-live-export
```

Résultat : 11 workflows. Copie distincte :

`n8n/live-exports/2026-10-28/`

L'inventaire lisible, hors du dossier d'import, est `n8n/live-exports/2026-10-28-MANIFEST.json`.

| Fichier | Identifiant | Nom | Actif | Nœuds | Connexions | Version |
|---|---|---|---|---:|---:|---|
| `G4DGUyeawxcZze2D.json` | `G4DGUyeawxcZze2D` | `01_API_GetServices` | oui | 3 | 2 | `4330a501-f6d5-40c9-b6c7-314e18622fd9` |
| `CLnuFnZnejHNUkg9.json` | `CLnuFnZnejHNUkg9` | `02_API_GetAvailability` | oui | 5 | 4 | `37f59d20-4687-4c2c-aed6-ac14aed1a232` |
| `SXCesRUmGrV5FMzm.json` | `SXCesRUmGrV5FMzm` | `03_API_CreateAppointment` | oui | 8 | 7 | `93ebd7e4-ee13-4fd8-8104-564e0c6ca3c8` |
| `sLWErwgNoc3TDEPV.json` | `sLWErwgNoc3TDEPV` | `04_API_GetAppointment` | oui | 5 | 4 | `516e0840-63ea-4608-9cf5-49fad90c76b2` |
| `IGc8cMlPqPKISuDz.json` | `IGc8cMlPqPKISuDz` | `05_API_CancelAppointment` | oui | 5 | 4 | `a142db05-6972-403a-9022-e5e320f69a00` |
| `on120FN4hblm31jZ.json` | `on120FN4hblm31jZ` | `06_API_RescheduleAppointment` | non | 5 | 4 | `ae145a47-82eb-4584-8cdf-eac57f18254f` |
| `XQ4o7VjWeAOBkvTu.json` | `XQ4o7VjWeAOBkvTu` | `07_JOB_AppointmentReminders` | non | 6 | 5 | `b54006a0-9ea7-457a-a42d-e3b71d636963` |
| `ZbZoj4yF1s5a3B5E.json` | `ZbZoj4yF1s5a3B5E` | `08_JOB_SendConfirmationEmails` | non | 5 | 4 | `43167625-0a3b-42fa-861c-60f55f316379` |
| `iBPXUoYhm2Ztq0DJ.json` | `iBPXUoYhm2Ztq0DJ` | `09_JOB_SendReminderEmails` | non | 5 | 4 | `85155622-ac64-4d5c-8b3f-8984c6d00980` |
| `R7TKt5mqZYpeKapl.json` | `R7TKt5mqZYpeKapl` | `10_AI_ConsularAssistant_Complete` | non | 84 | 82 | `f71a06b3-1ccb-432a-b6ac-703720c166a2` |
| `p7MBug0Sjh3wjfHI.json` | `p7MBug0Sjh3wjfHI` | `10_AI_ConsularAssistant_old` | non | 11 | 7 | `56365e0d-d42f-40da-9cbf-3d6374883db6` |

Les dates de mise à jour vont du 29 juillet 2026 au 21 septembre 2026. Le workflow 10 complet est le plus récent.

## 3. Corrections récentes du workflow 10

Présentes dans `R7TKt5mqZYpeKapl.json`, absentes du JSON historique du dépôt :

| Nœud | Présent | Contrôle |
|---|---|---|
| `Fusionner état conversation` | oui | le script force `token = null` sur une création |
| `Gérer collecte progressive` | oui | le commentaire et le code prennent les données métier depuis l'état fusionné ; `previous.token` n'est pas relu pour réinjecter le token |
| `Sauvegarder état conversation` | oui | l'UPSERT contient encore `token = COALESCE(EXCLUDED.token, ai_conversation_state.token)` |

La chaîne exportée est :

```text
Lorsqu'un message de chat est reçu
  → Charger état conversation
  → Comprendre la demande
  → Parser intention
  → Fusionner état conversation
  → Gérer collecte progressive
  → Sauvegarder état conversation
  → Router intention
```

Ces trois nœuds sont donc sauvegardés. Leur comportement n'a pas été modifié. Le `COALESCE` reste la cause confirmée de REC-003, laissée telle quelle.

## 4. Différences avec les fichiers du dépôt

Comparaison des noms de nœuds, des arêtes et des scripts JavaScript ou SQL. Les fichiers du dépôt n'ont pas été écrasés.

| Workflow | Nœuds dépôt | Nœuds export | Verdict |
|---|---:|---:|---|
| 01 | 3 | 3 | identique : mêmes nœuds, arêtes et scripts |
| 02 | 4 | 5 | diverge |
| 03 | 4 | 8 | diverge |
| 04 | 4 | 5 | diverge |
| 05 | 4 | 5 | diverge |
| 06 | 4 | 5 | diverge |
| 07 | 2 | 6 | diverge |
| 08 | 5 | 5 | identique : mêmes nœuds, arêtes et scripts |
| 09 | 5 | 5 | identique : mêmes nœuds, arêtes et scripts |
| 10 complet | 33 | 84 | diverge fortement |
| 10 old | absent sous ce nom | 11 | l'archive du dépôt est un autre workflow |

### 02 à 06

La version vivante ajoute un nœud de préparation de réponse et change le SQL ou le validateur. Exemples :

- `02` : nœud `Préparer réponse API disponibilité`. `Chercher créneaux` et `Valider paramètres` diffèrent du dépôt.
- `03` : `Vérifier création`, `If`, `Répondre créneau indisponible`, `Créer notification CONFIRMATION`. La création ne répond plus directement.
- `04` et `05` : nœud `Préparer réponse`. Le SQL et le validateur de token diffèrent.
- `06` : nœud `Préparer réponse`. `Valider demande` et `Replanifier` diffèrent. La version vivante attend `newSlotId`.

### 07

Les deux nœuds du dépôt sont conservés. La version vivante ajoute l'envoi : `Chercher notifications A_ENVOYER`, `Préparer email`, `Envoyer email Mailpit`, `Marquer notification ENVOYEE`.

### 10 complet

Les 33 nœuds du fichier `n8n/workflows/10_AI_ConsularAssistant_Complete.json` existent encore dans l'export. L'export en contient 51 de plus, dont la mémoire, les confirmations et la replanification guidée. Cinq arêtes du dépôt n'existent plus dans la version vivante, parce que le pipeline passe désormais par la mémoire et les confirmations :

- `Lorsqu'un message de chat est reçu → Comprendre la demande`
- `Parser intention → Router intention`
- `Annulation prête ? → Appeler CancelAppointment`
- `Router intention → Valider token annulation`
- `Router intention → Valider paramètres replanification`

Quatorze scripts partagés ont aussi divergé, notamment `Parser intention`, les validateurs, et les préparations de réponse création, disponibilité, consultation et annulation.

### Ancienne version

`archive/10_AI_ConsularAssistant_old.json` s'appelle `10_AI_ConsularAssistant` et contient 4 nœuds. L'instance conserve un autre workflow, `10_AI_ConsularAssistant_old`, de 11 nœuds. Les deux sont gardés. L'archive n'a pas été écrasée.

## 5. Contrôle des secrets

Recherche effectuée sur les 11 exports :

- aucune occurrence des secrets de `.env` ;
- `pinData` vide et `staticData` nul ;
- les credentials ne contiennent que `id` et `name`, jamais de mot de passe, de clé API ni de donnée chiffrée ;
- types référencés : `postgres`, `smtp`, `ollamaApi`.

Le bloc `shared` produit par n8n contenait l'identité du propriétaire de l'instance. Il a été retiré des 11 fichiers avant conservation. Le manifeste est placé à côté du dossier, pour qu'un import de répertoire ne tente pas de le lire comme un workflow.

Les jobs 07, 08 et 09 conservent l'expéditeur local `noreply@govsuite.local`. Ce n'est pas un credential.

## 6. Schéma `ai_conversation_state`

Observé en lecture. 23 colonnes, 2 contraintes, 4 index, aucun trigger, aucune clé étrangère. 48 sessions. Ce décompte n'a pas changé : aucune écriture SQL n'a été lancée.

| Colonne | Type | Null | Défaut |
|---|---|---|---|
| `id` | `uuid` | non | `gen_random_uuid()` |
| `session_id` | `varchar(255)` | non | |
| `intent` | `varchar(50)` | oui | |
| `service` | `varchar(50)` | oui | |
| `site` | `varchar(100)` | oui | |
| `date_debut` | `date` | oui | |
| `date_fin` | `date` | oui | |
| `slot_id` | `uuid` | oui | |
| `token` | `uuid` | oui | |
| `new_slot_id` | `uuid` | oui | |
| `reference` | `varchar(100)` | oui | |
| `nom` | `varchar(150)` | oui | |
| `prenom` | `varchar(150)` | oui | |
| `email` | `varchar(255)` | oui | |
| `telephone` | `varchar(50)` | oui | |
| `last_user_message` | `text` | oui | |
| `created_at` | `timestamptz` | non | `now()` |
| `updated_at` | `timestamptz` | non | `now()` |
| `expires_at` | `timestamptz` | oui | |
| `available_slots` | `jsonb` | oui | |
| `selected_slot_index` | `integer` | oui | |
| `pending_action` | `varchar(50)` | oui | |
| `conversation_step` | `varchar(50)` | oui | |

Contraintes : clé primaire `id`, unicité `session_id`.  
Index : les deux index de contraintes, plus `idx_ai_conversation_state_expires` et `idx_ai_conversation_state_session`.

Script préparé, non exécuté :

`database/migrations/001_ai_conversation_state.sql`

Il utilise `CREATE EXTENSION IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS` et `CREATE INDEX IF NOT EXISTS`. Sur la base actuelle, chaque objet existe déjà avec les mêmes colonnes, types, nullabilité, défauts, contraintes et index. L'application du script serait donc un no-op pour les 48 sessions. Il ne modifie pas une table déjà créée si une colonne venait à manquer : ce cas ne se présente pas ici. Il n'a volontairement pas été lancé, pour rester en lecture sur les données.

## 7. Fichiers créés

| Fichier | Rôle |
|---|---|
| `n8n/live-exports/2026-10-28/*.json` | 11 workflows vivants, sans bloc `shared` |
| `n8n/live-exports/2026-10-28-MANIFEST.json` | identifiants, activation, nombre de nœuds |
| `database/migrations/001_ai_conversation_state.sql` | DDL idempotent, non exécuté |
| `docs/recovery/REC_001_002_REPORT.md` | ce rapport |

Fichiers non modifiés : `n8n/workflows/*.json`, `archive/`, `postgres/init.sql`, workflows dans l'instance n8n.

## 8. Tests et contrôles

| Contrôle | Résultat |
|---|---|
| `GET http://localhost:5680/healthz` | `200 {"status":"ok"}` |
| Export CLI | 11 workflows, code de sortie 0 |
| Présence des 3 nœuds de mémoire | confirmée dans l'export |
| `COALESCE` du token | toujours présent, non modifié |
| Comparaison nœuds, arêtes et scripts | faite ; 01, 08 et 09 identiques au dépôt |
| Recherche des secrets de `.env` | aucune occurrence |
| Recherche de champs `password`, `apiKey`, `secret` | aucune valeur |
| Schéma comparé au script | 23 colonnes, 2 contraintes, 4 index alignés |
| Exécution du script SQL | non faite |
| Réimport n8n | non fait |
| Nombre de sessions après l'opération | 48, lecture seule |

## 9. Risques restants

- Réimporter `n8n/workflows/10_AI_ConsularAssistant_Complete.json` remplacerait les 84 nœuds par les 33 du dépôt.
- Un import des exports met à jour les workflows de mêmes identifiants. Par défaut, n8n désactive les workflows importés. La restauration doit donc utiliser `--activeState=fromJson`.
- Les références `id` + `name` des credentials ne contiennent pas le secret, mais elles ne sont valables que sur cette instance.
- Le `COALESCE` de sauvegarde est sauvegardé avec le défaut connu. Il n'est pas corrigé.
- Le DDL versionné ne protège pas contre un `docker compose down -v` tant qu'il n'est pas appliqué à une nouvelle base. Les 48 sessions restent uniquement dans le volume.
- Les workflows 06, 07, 08, 09 et 10 sont inactifs dans l'export, comme dans l'instance.

## 10. Restauration

Ces commandes ne sont pas à lancer maintenant. Elles remplacent, dans n8n, les workflows qui portent les mêmes identifiants. À exécuter seulement pour revenir à la copie du 28 octobre 2026.

Depuis `C:\Open Source PME\govsuite-appointments`, n8n étant démarré :

```powershell
docker compose exec -T n8n mkdir -p /tmp/govsuite-restore
docker cp "n8n/live-exports/2026-10-28/." govsuite-n8n:/tmp/govsuite-restore
docker compose exec -T n8n n8n import:workflow --separate --input=/tmp/govsuite-restore --activeState=fromJson
```

Pour un seul workflow, par exemple l'assistant :

```powershell
docker cp "n8n/live-exports/2026-10-28/R7TKt5mqZYpeKapl.json" govsuite-n8n:/tmp/R7TKt5mqZYpeKapl.json
docker compose exec -T n8n n8n import:workflow --input=/tmp/R7TKt5mqZYpeKapl.json --activeState=fromJson
```

Le schéma conversationnel, sur une base neuve où la table n'existe pas encore :

```powershell
Get-Content -Raw "database\migrations\001_ai_conversation_state.sql" | docker compose exec -T postgres psql -U govsuite -d govsuite -v ON_ERROR_STOP=1
```

Ne pas utiliser cette restauration pour « tester » : l'import écrit dans n8n. La base actuelle possède déjà le schéma.

## 11. Arrêt

Lot 0 terminé. REC-003 et le reste du Lot 1 ne sont pas commencés.
