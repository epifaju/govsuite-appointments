# Analyse de l'existant — GovSuite AI Consular Assistant

**Date :** 28 octobre 2026  
**Périmètre :** audit en lecture du dépôt, du schéma PostgreSQL vivant et des workflows stockés dans n8n.  
**Hors périmètre de cette passe :** aucune modification de workflow, de SQL applicatif, de seed, ni de test.

## 1. Méthode et niveau de preuve

| Vérifié | Preuve |
|---|---|
| Arborescence, Compose, `.env` (noms et valeurs non secrètes), `postgres/init.sql`, JSON exportés, README | Lecture des fichiers |
| Schéma vivant, sites, services, créneaux, rendez-vous, table `ai_conversation_state` | `psql` en lecture sur le volume existant |
| Workflows réellement enregistrés dans n8n, leur activation, leurs nœuds et le SQL de sauvegarde | Table `workflow_entity` |
| Chaîne Chat → charger → comprendre → parser → fusionner → collecte → sauvegarder → router → disponibilité | Connexions du workflow 10 en base |

| Non vérifié dans cette passe | Conséquence |
|---|---|
| Exécution d'un message de chat | n8n est arrêté |
| Appels HTTP des webhooks | n8n est arrêté |
| Ollama et le contenu du credential `Ollama account` | URL et disponibilité du modèle non testées |
| Contenu de `tests.docx` | Fichier binaire non analysé |
| Comparaison octet à octet de tous les SQL des workflows 01 à 09 entre fichier et base | Seuls les styles de requêtes et les nœuds critiques ont été comparés |

PostgreSQL a été démarré uniquement pour cet audit (`docker compose up -d postgres`). n8n et Mailpit sont restés arrêtés. Aucun volume n'a été supprimé.

## 2. Architecture réellement observée

```text
Citoyen (chat n8n, éditeur)
        |
        v
n8n  (image docker.n8n.io/n8nio/n8n:latest)
  workflow 10, version en base du 21 septembre 2026
  Chat → PostgreSQL (état) → Ollama → JavaScript → PostgreSQL (UPSERT)
        → routeur → HTTP vers les webhooks 01 à 06
        |
        +--> PostgreSQL 16 (base govsuite, même instance que n8n)
        +--> Mailpit (workflows 08 et 09, actuellement inactifs)
        +--> Ollama (credential n8n, hors Compose)
```

n8n et le métier partagent la base `govsuite`. Les tables n8n (`workflow_entity`, `execution_entity`, `credentials_entity`, etc.) cohabitent avec `services`, `sites`, `creneaux`, `rendez_vous` et `ai_conversation_state`.

Il n'y a pas d'application web citoyenne dans ce dépôt. Le lien `http://localhost:5680/manage-appointment?token=...` présent dans les e-mails ne correspond à aucune page du projet.

### 2.1 Environnement local vérifié

| Élément | Valeur observée | Source |
|---|---|---|
| Base | `govsuite`, utilisateur `govsuite` | `.env`, Compose |
| PostgreSQL hôte | `5433` → conteneur `5432` | `.env` |
| n8n hôte | `5680` → conteneur `5678` | `.env` |
| URL éditeur / webhooks hôte | `http://localhost:5680` | `.env` |
| Mailpit UI hôte | `8026` | `.env` (`MAILPIT_UI_PORT`) |
| Mailpit SMTP hôte | `1026` → conteneur `1025` | `.env` |
| Fuseau | `Europe/Paris` | `.env` |
| Conteneurs | `govsuite-postgres` démarré pour l'audit ; `govsuite-n8n` et `govsuite-mailpit` arrêtés depuis environ deux semaines | `docker ps -a` |
| Volumes | `govsuite-appointments_postgres_data`, `_n8n_data`, `_mailpit_data` présents | `docker volume ls` |
| Git | Le dossier n'est pas un dépôt Git | `git status` |
| Ollama dans Compose | Absent | `docker-compose.yml` |
| Modèle déclaré dans le workflow 10 | `qwen2.5:1.5b`, température 0, contexte 1024 | Nœud `Ollama Chat Model` en base |
| Credential Ollama | Nom `Ollama account`, type `ollamaApi` | `credentials_entity` (secret non lu) |
| Images | `n8n:latest` et `mailpit:latest`, non épinglées | Compose |

Le README racine décrit encore n8n sur le port 5678, PostgreSQL sur 5432 et Mailpit sur 8025. Ces valeurs ne correspondent pas à `.env`. Le README du workflow 10 indique aussi des URL `localhost:5678` : elles sont valables depuis l'intérieur du conteneur n8n, pas depuis le navigateur Windows.

Les secrets (`POSTGRES_PASSWORD`, `N8N_ENCRYPTION_KEY`) sont présents dans `.env`. `.gitignore` ignore `.env`, mais le projet n'est pas versionné. Les valeurs ne sont pas reproduites ici.

## 3. Deux sources de vérité

Le fichier `n8n/workflows/10_AI_ConsularAssistant_Complete.json` n'est pas le workflow qui a servi aux derniers essais.

| | Fichier exporté | Instance n8n (table `workflow_entity`) |
|---|---|---|
| Mise à jour connue | Non datée dans Git (pas de dépôt) | 21 septembre 2026, 23:17 |
| Nœuds | Environ 25, sans mémoire | 84 |
| `Charger état conversation` | Absent | Présent |
| `Fusionner état conversation` | Absent | Présent, environ 22 Ko de JavaScript |
| `Gérer collecte progressive` | Absent | Présent, environ 26 Ko de JavaScript |
| `Sauvegarder état conversation` | Absent | Présent, UPSERT paramétré |
| Activation | `"active": false` dans le JSON | `active = false` |
| README associé | Dit explicitement que la mémoire multi-tours n'existe pas encore | Contredit par le workflow en base |

Les workflows 01 à 09 du dépôt sont aussi en retard sur la base. Exemple vérifié : le JSON `06_API_RescheduleAppointment.json` attend `slotId` et interpole la requête ; la version en base valide `newSlotId` et lie `$1` / `$2`. Le JSON `03` embarque création, capacité, historique et notification dans une seule requête interpolée ; la version en base a un nœud `Créer rendez-vous` encore interpolé et un nœud séparé `Créer notification CONFIRMATION` paramétré.

Réimporter les JSON du dépôt écraserait la version avancée. Toute correction doit partir d'un export frais de `workflow_entity`, puis être réécrite dans les fichiers.

`archive/10_AI_ConsularAssistant_old.json` est une version antérieure. Elle ne contient pas non plus la machine à états actuelle.

## 4. Inventaire des workflows

État lu dans `workflow_entity` le 28 octobre 2026. « Actif » signifie le drapeau n8n, pas une exécution réussie ce jour.

| Workflow | Actif en base | Rôle observé | Écart fichier / base |
|---|---|---|---|
| `01_API_GetServices` | oui | GET services actifs | Faible sur le SELECT lu dans le fichier |
| `02_API_GetAvailability` | oui | GET créneaux | Base paramétrée ; fichier interpolé |
| `03_API_CreateAppointment` | oui | POST création | Base plus découpée ; création encore interpolée |
| `04_API_GetAppointment` | oui | GET par token | Base paramétrée |
| `05_API_CancelAppointment` | oui | POST annulation | Base paramétrée |
| `06_API_RescheduleAppointment` | non | POST replanification | Base paramétrée `token` + `newSlotId` ; fichier obsolète |
| `07_JOB_AppointmentReminders` | non | Création horaire des rappels | Présent, non réexécuté |
| `08_JOB_SendConfirmationEmails` | non | Envoi toutes les minutes | Présent, non réexécuté |
| `09_JOB_SendReminderEmails` | non | Envoi toutes les minutes | Présent, non réexécuté |
| `10_AI_ConsularAssistant_Complete` | non | Assistant conversationnel | Fichier sans mémoire ; base à 84 nœuds |
| `10_AI_ConsularAssistant_old` | non | Ancienne version conservée dans n8n | Aussi dans `archive/` |

Dépendances observées :

- Le workflow 10 appelle les webhooks 01 à 06 en HTTP sur `http://localhost:5678/...` (port interne du conteneur).
- Les workflows 08 et 09 lisent `notifications` produites par 03, 05, 06 et 07.
- Le workflow 10 lit et écrit `ai_conversation_state`.
- Ollama est requis par le nœud `Comprendre la demande`.
- Les credentials n8n attendus sont `credentials PostgreSQL`, `Ollama account` et `SMTP account`.

## 5. Inventaire des endpoints

Contrats lus dans les fichiers, puis recoupés avec la base lorsque le style a divergé. Aucun appel HTTP n'a été rejoué : n8n est arrêté. Les workflows API 01 à 05 sont marqués actifs, donc ces chemins répondront seulement après démarrage de n8n.

| Méthode | Chemin hôte | Workflow | Entrée observée | Sortie observée dans le JSON |
|---|---|---|---|---|
| GET | `http://localhost:5680/webhook/services` | 01 | aucune | `{ success, count, services }` |
| GET | `http://localhost:5680/webhook/appointments/availability` | 02 | `service`, `site`, `dateDebut`, `dateFin` | `{ success, count, slots }` |
| POST | `http://localhost:5680/webhook/appointments` | 03 | `slotId`, `nom`, `prenom`, e-mail, téléphone | `{ success, appointment }` ou créneau indisponible |
| GET | `http://localhost:5680/webhook/appointments/manage` | 04 | `token` | rendez-vous, y compris identité et `token_gestion` |
| POST | `http://localhost:5680/webhook/appointments/cancel` | 05 | `token`, motif facultatif | référence, statut, `cancelled_at` |
| POST | `http://localhost:5680/webhook/appointments/reschedule` | 06 | base : `token`, `newSlotId` | référence, statut, créneau |

Le chat n'est pas un webhook public : le déclencheur exporté a `"public": false`. L'essai se fait depuis l'éditeur n8n.

La borne de fin de disponibilité est inclusive jusqu'au lendemain de `dateFin` à 00:00 dans la requête du fichier 02 (`dateFin::date + interval '1 day'`). Ce point n'a pas été rejoué sur la requête paramétrée en base.

Aucun de ces webhooks n'a de contrôle d'authentification dans les JSON lus. Le pouvoir d'annuler ou de replanifier repose sur la connaissance de l'UUID `token_gestion`.

## 6. Schéma PostgreSQL

### 6.1 Tables métier dans `postgres/init.sql`

Présentes dans le script et dans la base :

- `sites` (`id`, `code` unique, `nom`, adresse, ville, pays, `timezone`, `actif`)
- `services` (`code` unique, `duree_minutes`, `capacite_par_creneau`)
- `service_sites` (clé primaire composée)
- `creneaux` (`service_id`, `site_id`, `debut`, `fin`, `capacite`, `places_reservees`, `statut`)
- `rendez_vous` (`reference` unique, `token_gestion` UUID unique généré par `gen_random_uuid()`)
- `notifications` (unicité `rendez_vous_id, type, canal`)
- `jours_fermeture`
- `historique_rendez_vous`

Contraintes utiles confirmées dans le DDL :

- statut de créneau : `DISPONIBLE`, `COMPLET`, `BLOQUE`, `ANNULE`
- `places_reservees <= capacite` et `fin > debut`
- unicité `(service_id, site_id, debut)`
- statut de rendez-vous : `EN_ATTENTE`, `CONFIRME`, `ANNULE`, `REPLANIFIE`, `PRESENT`, `ABSENT`, `TERMINE`
- `pgcrypto` pour `gen_random_uuid()`

`service_id` et `site_id` référencent `services(id)` et `sites(id)`.

### 6.2 Table absente du dépôt

`ai_conversation_state` existe dans la base et n'apparaît dans aucun script SQL du dépôt. Colonnes observées :

`id`, `session_id` (unique), `intent`, `service`, `site`, `date_debut`, `date_fin`, `slot_id`, `token`, `new_slot_id`, `reference`, `nom`, `prenom`, `email`, `telephone`, `last_user_message`, `created_at`, `updated_at`, `expires_at`, `available_slots` (jsonb), `selected_slot_index`, `pending_action`, `conversation_step`.

Index : clé primaire, unicité de `session_id`, index sur `expires_at` et `session_id`.

48 sessions sont stockées. Les étapes réellement persistées incluent notamment `READY_RESCHEDULE_SEARCH` (19 lignes), `ASK_CANCEL_CONFIRMATION`, `ASK_CREATE_SLOT`, `ASK_PRENOM`, `ASK_EMAIL`, `READY_CREATE`, `READY_CREATE_SEARCH`, `ASK_RESCHEDULE_CONFIRMATION`, `READY_GET_APPOINTMENT`. La machine à états a donc déjà tourné. Cet audit n'a pas relu les messages, tokens ou coordonnées.

Le chargement ignore une session expirée :

```sql
SELECT *
FROM ai_conversation_state
WHERE session_id = $1
  AND (expires_at IS NULL OR expires_at > NOW())
LIMIT 1;
```

La sauvegarde repousse `expires_at` de deux heures.

L'UPSERT de `Sauvegarder état conversation` n'écrit pas `available_slots` ni `selected_slot_index`. D'autres nœuds (`Mémoriser créneaux proposés`, `Mémoriser créneaux replanification`, nœuds de finalisation) mettent à jour ces champs sur certaines branches.

### 6.3 Données vivantes

| Fait | Résultat |
|---|---|
| Sites | `PARIS` (`Europe/Paris`), `LISBONNE` (`Europe/Lisbon`). Pas de `LYON` |
| Services | `PASSEPORT` 30 min / capacité 2, `VISA` 30 / 2, `LEGALISATION` 20 / 3, `ETAT_CIVIL` 45 / 1 |
| Créneaux | 490 lignes, du 30 juillet 2026 09:00 au 3 septembre 2026 11:00 |
| Statuts de créneaux | 488 `DISPONIBLE`, 2 `COMPLET` |
| Créneaux à partir du 28 octobre 2026 | aucun : le dernier début est le 3 septembre 2026 |
| Rendez-vous | 13 : 10 `CONFIRME`, 3 `ANNULE` |
| Notifications | 10 `CONFIRMATION` / `A_ENVOYER`, 3 `CONFIRMATION` / `ENVOYE`, 1 `RAPPEL_H2` / `ENVOYE` |

Le script d'init génère des créneaux une seule fois, sur les jours ouvrés suivant la création du volume, de 09:00 à 11:30. Le volume a donc été initialisé vers la fin juillet 2026. La requête historique du 11 au 14 septembre 2026 retourne 0 ligne parce que ces dates sont postérieures au dernier créneau. Ce n'est pas une erreur du filtre de disponibilité.

Le rendez-vous de démonstration `DEMO-2026-0001` est prévu par `init.sql`. Le décompte actuel (13 rendez-vous) montre que la base a vécu au-delà du seed initial. Les identités n'ont pas été listées.

## 7. Pipeline conversationnel vivant

Ordre confirmé par les connexions du workflow 10 en base :

```text
Lorsqu'un message de chat est reçu
  → Charger état conversation
  → Comprendre la demande (Ollama qwen2.5:1.5b)
  → Parser intention
  → Fusionner état conversation
  → Gérer collecte progressive
  → Sauvegarder état conversation
  → Router intention
       → Valider paramètres disponibilité
       → Disponibilité prête ?
       → Appeler GetAvailability
```

Le routeur a d'autres sorties : services, création, consultation, confirmation d'annulation, étape de replanification, réponse générale.

### 7.1 Correctifs de fusion et de collecte

Ils sont présents dans la base, absents du JSON versionné.

`Fusionner état conversation` :

- détecte un redémarrage explicite de création, consultation, annulation et replanification ;
- sur `CREATE_APPOINTMENT`, force `token = null` et `newSlotId = null` ;
- sur `RESCHEDULE_APPOINTMENT`, force `slotId = null` ;
- ne réutilise les champs précédents que dans la branche « continuation de la même action » ;
- vide `availableSlots` lors d'une nouvelle action.

`Gérer collecte progressive` :

- déclare que `previous` sert à l'étape, et que les données métier viennent de l'état déjà fusionné ;
- initialise `token`, `slotId` et `newSlotId` depuis `$json`, pas depuis `previous.token` ;
- quand `pendingAction = CREATE_APPOINTMENT` et `conversationStep = READY_CREATE_SEARCH`, avec service, site et dates, bascule l'intention technique vers `GET_AVAILABILITY`.

Ces deux nœuds correspondent au correctif décrit après la contamination de mémoire. Ils n'ont pas été rejoués par un message de chat dans cet audit.

### 7.2 BUG-001 et BUG-002 — cause confirmée dans le SQL

`Sauvegarder état conversation` fait un `INSERT ... ON CONFLICT (session_id) DO UPDATE` puis `RETURNING` de la ligne, y compris `token`.

Pour le token, et de la même façon pour le service, le site, les dates, `slot_id`, `new_slot_id`, la référence, l'identité et les étapes :

```sql
token = COALESCE(EXCLUDED.token, ai_conversation_state.token)
```

`COALESCE` conserve l'ancienne valeur lorsque la nouvelle est `NULL`. Une création qui a correctement effacé le token en amont le réécrit donc avec l'ancien UUID au moment de la sauvegarde.

Le nœud Postgres remplace l'élément courant par la ligne `RETURNING`. Le nœud suivant, `Valider paramètres disponibilité`, fait :

```javascript
return [{ json: { ...x, service, site, dateDebut, dateFin, ready, missing } }];
```

Le token revenu de PostgreSQL est ainsi recopié tel quel. Il est présent dans l'entrée de `Appeler GetAvailability`, même si les paramètres HTTP de recherche ne sont que `service`, `site`, `dateDebut` et `dateFin`.

C'est le premier point où le token réapparaît après la collecte. La cause n'est pas une seconde fusion JavaScript.

Le même `COALESCE` empêche d'effacer un site, une période, un créneau ou une identité lorsqu'une nouvelle action démarre. `last_user_message` est le seul champ métier écrasé sans `COALESCE`.

`available_slots` n'est pas touché par cet UPSERT. Une liste de créneaux ancienne peut donc survivre en base tant qu'un nœud spécialisé ne l'écrase pas.

### 7.3 Machine à états

États de création présents dans le JavaScript de collecte : `ASK_CREATE_SERVICE`, `ASK_CREATE_SITE`, `ASK_CREATE_DATE_RANGE`, `READY_CREATE_SEARCH`, `ASK_CREATE_SLOT`, puis collecte du nom, du prénom, de l'e-mail et du téléphone jusqu'à `READY_CREATE`.

États également référencés : `ASK_TOKEN`, `READY_GET_APPOINTMENT`, `ASK_CANCEL_CONFIRMATION`, `READY_CANCEL_LOOKUP`, `ASK_RESCHEDULE_TOKEN`, `READY_RESCHEDULE_TOKEN`, `ASK_RESCHEDULE_DATE_RANGE`, `READY_RESCHEDULE_SEARCH`, `ASK_RESCHEDULE_CONFIRMATION`.

La séparation `slotId` (création) / `newSlotId` (replanification) est écrite dans la fusion et dans `Préparer appel replanification`. L'appel HTTP envoie `{ token, newSlotId }`. Le validateur vivant du workflow 06 attend ces deux champs et les passe en `$1` et `$2`.

Les transitions, les réponses « oui » / « non » et le choix « Je prends le 2 » n'ont pas été exécutés ici. Des nœuds dédiés existent (`Analyser confirmation annulation`, `Analyser confirmation replanification`, `Confirmation déjà demandée ?`, `Mémoriser créneaux proposés`). Leur comportement reste à prouver par un scénario.

Le workflow 10 est inactif. Les essais manuels depuis l'éditeur restent possibles après démarrage de n8n ; le chat de production ne répondra pas tant que le workflow n'est pas publié.

## 8. Fonctionnalités

| ID | Fonction | Statut | Justification |
|---|---|---|---|
| F-01 | Comprendre l'intention | PARTIAL | Parser et prompt présents en base. Modèle `qwen2.5:1.5b`. Aucun jeu de phrases rejoué |
| F-02 | Mémoire multi-tours | PARTIAL | Fusion et collecte corrigées en base. L'UPSERT `COALESCE` réintroduit les `NULL` |
| F-03 | Collecte service, site, dates | PARTIAL | Étapes présentes dans le code et dans 48 sessions. Parcours non rejoué |
| F-04 | Recherche de créneaux | PARTIAL | Workflow 02 actif et paramétré en base. Dernier essai connu : 0 créneau, cohérent avec le SQL |
| F-05 | Choix « Je prends le 2 » | UNKNOWN | Colonnes et nœuds de mémorisation présents. Résolution d'UUID non exécutée |
| F-06 | Identité et contact | PARTIAL | Étapes `ASK_PRENOM`, `ASK_EMAIL`, `READY_CREATE` présentes. Validation non rejouée |
| F-07 | Création | PARTIAL | 10 rendez-vous `CONFIRME` existent. Parcours conversationnel complet non refait. Création SQL encore interpolée |
| F-08 | Consultation | PARTIAL | Workflow 04 actif en base, requête paramétrée. Non appelé dans cet audit. Réponse encore riche en données personnelles |
| F-09 | Annulation | PARTIAL | 3 rendez-vous `ANNULE`. Nœuds de confirmation présents. Idempotence non retestée |
| F-10 | Replanification | PARTIAL | Beaucoup de sessions en `READY_RESCHEDULE_SEARCH`. Workflow 06 inactif. Confirmation « oui » historiquement en échec, non retestée |
| F-11 | Absence de disponibilités | PARTIAL | Message d'absence présent dans le workflow. Le cas vide de septembre 2026 était un manque de données |
| F-12 | Confirmation et rappels | PARTIAL | 3 confirmations envoyées, 10 restent `A_ENVOYER`. Jobs 07, 08 et 09 inactifs. n8n et Mailpit arrêtés |
| F-13 | Administration des créneaux | TODO | Seul le générateur unique de `init.sql` existe. Pas d'écran ni de workflow d'administration |
| F-14 | Observabilité | TODO | Pas de `correlationId`. Le token est renvoyé au chat et placé dans l'URL des e-mails |
| F-15 | Multilingue | TODO | Aucun parcours FR/PT/créole branché sur les codes métier |
| F-16 | Portail citoyen ou admin | TODO | Lien d'e-mail sans application correspondante |

## 9. Bugs

| ID | Statut | Constat |
|---|---|---|
| BUG-001 Token ancien réintroduit | Confirmé dans le code vivant | `COALESCE` puis `RETURNING`, recopié par `Valider paramètres disponibilité` |
| BUG-002 Anciennes données conservées | Confirmé dans le code vivant | Le même `COALESCE` couvre service, site, dates, créneaux, identité, action et étape |
| BUG-003 Créneaux de septembre vides | Confirmé comme absence de données | Dernier créneau : 3 septembre 2026. Aucun créneau futur au 28 octobre 2026 |
| BUG-004 Sorties LLM non fiables | Non rejoué | Le parser restreint les intentions. Le petit modèle reste la source d'extraction. Pas de test d'hallucination dans le dépôt |
| BUG-005 Confirmation de replanification répétée | Non rejoué | Des nœuds de confirmation existent. Le scénario « Oui » n'a pas été exécuté |
| Dérive fichier / base | Confirmé | Les JSON du dépôt ne contiennent pas la machine à états du 21 septembre 2026 |
| Workflow 10 et 06 inactifs | Confirmé | Drapeaux `active = false` |
| Jobs d'e-mail inactifs | Confirmé | 10 confirmations en attente |
| DDL conversationnel non versionné | Confirmé | `ai_conversation_state` absent de `init.sql` |
| Requêtes interpolées | Confirmé sur la création vivante | `Créer rendez-vous` contient encore `{{ }}` |

## 10. Sécurité et risques

- Les webhooks de mutation n'ont pas d'authentification autre que l'UUID de gestion.
- La consultation renvoie nom, prénom, e-mail, téléphone et token.
- Les e-mails construisent une URL contenant le token en clair.
- La création vivante interpole encore des champs dans le SQL. L'échappement d'apostrophes du fichier exporté ne suffit pas comme requête paramétrée.
- n8n et le métier partagent une base et un rôle PostgreSQL.
- `n8n:latest` et `mailpit:latest` rendent l'environnement non reproductible.
- Ollama n'est pas dans le Compose. Depuis le conteneur, `localhost` n'est pas la machine Windows. L'URL du credential doit être vérifiée au démarrage, sans être affichée si elle contient un secret.
- Un `docker compose down -v` détruirait les rendez-vous, la mémoire conversationnelle et tous les workflows n8n, y compris la version non exportée.
- Le dépôt n'a pas d'historique Git : rien ne protège aujourd'hui contre un écrasement.
- Aucun test automatisé n'existe (0 fichier `.js`, `.py` ou `.sql` de test). `tests.docx` n'a pas été interprété.
- Les ports 5433, 8026 et 1026 sont aussi utilisés par d'autres projets arrêtés sur cette machine. Un démarrage simultané peut entrer en conflit.

## 11. Écarts avec le PRD

| Sujet | PRD ou hypothèse de reprise | Observé |
|---|---|---|
| Site `LYON` | Cité comme site connu | Les sites réels sont `PARIS` et `LISBONNE` |
| Port Mailpit 8025 | Cité dans le prompt de reprise et le README | `.env` expose l'UI sur 8026 et le SMTP sur 1026 |
| README opérationnel | Phase 1 du PRD | Le README décrit l'état initial, avant les workflows 04 à 10 et avant les ports réels |
| Fichiers d'audit | `docs/audit-existing.md` et `docs/architecture-as-is.md` | Ce document suit le chemin demandé dans la mission : `docs/architecture/AS_IS_ANALYSIS.md` |
| Correctifs de fusion | Supposés dans le workspace | Présents seulement dans la base n8n |
| `ai_conversation_state` | DDL à vérifier | Présent en base, absent du dépôt |
| Requêtes paramétrées | Exigées pour les opérations critiques | Vrai pour 02, 04, 05, 06 et la sauvegarde d'état. Faux pour le nœud de création vivant |
| Workflow 06 | Champ `newSlotId` à vérifier | La base l'utilise. Le JSON du dépôt attend encore `slotId` |
| Créneaux futurs | À préparer | Aucun créneau à partir d'octobre 2026 |
| Tests E2E-01 à E2E-14 | Définis | Aucun n'est automatisé ni rejoué dans cette passe |
| Git | Modifications non commitées à inspecter | Pas de dépôt |
| Portail, multilingue, observabilité | P2 / P1 | Non implémentés |

## 12. Ce qui reste explicitement à tester

Après accord, et seulement une fois le workflow 10 exporté :

1. Démarrer n8n et Mailpit sans supprimer de volume.
2. Vérifier que le credential Ollama joint un modèle réellement chargé.
3. Rejouer une création après une session qui possède déjà un token, et comparer la sortie de la collecte, de la sauvegarde et de `Appeler GetAvailability`.
4. Exécuter les transitions CREATE, GET, CANCEL et RESCHEDULE, y compris « Oui », « Non » et « Je prends le 2 ».
5. Contrôler en SQL la capacité du créneau après création, annulation et replanification.
