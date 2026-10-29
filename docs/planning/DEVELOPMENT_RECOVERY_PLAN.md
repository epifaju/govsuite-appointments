# Plan de reprise — GovSuite AI Consular Assistant

**Date :** 28 octobre 2026  
**Référence :** `docs/architecture/AS_IS_ANALYSIS.md` et `PRD_GovSuite_AI_Consular_Assistant_Cursor.md`  
**Règle de séquence :** aucun workflow n'est modifié avant l'export de la version stockée dans n8n. Le JSON actuellement dans `n8n/workflows/10_AI_ConsularAssistant_Complete.json` ne doit pas être réimporté.

Les lots sont petits et testables. Une tâche n'est pas considérée terminée tant que son critère d'acceptation n'a pas été observé.

## Ordre retenu

1. Geler et exporter la version vivante.
2. Corriger la persistance qui réintroduit les valeurs `NULL`.
3. Ajouter des créneaux futurs, sans toucher aux rendez-vous existants.
4. Valider CREATE, puis GET, CANCEL et RESCHEDULE.
5. Automatiser les non-régressions.
6. Durcir la sécurité et l'observabilité.

Cet ordre est conservé : l'audit n'a pas trouvé de blocage plus urgent que la perte possible du workflow non exporté et la corruption de mémoire par `COALESCE`.

## Lot 0 — Protéger la version qui fonctionne déjà en partie

### REC-001 — Exporter les workflows vivants

| | |
|---|---|
| Priorité | P0 |
| Problème | La machine à états du 21 septembre 2026 n'existe que dans `workflow_entity`. Le JSON du dépôt la remplacerait si on l'importait |
| Périmètre | Export n8n des workflows 01 à 10, y compris `10_AI_ConsularAssistant_old` |
| Dépendances | Démarrage de n8n sans `down -v` |
| Complexité | S |
| Risques | Un export partiel, ou un écrasement du fichier avant comparaison |
| Acceptation | Le fichier 10 exporté contient `Fusionner état conversation`, `Gérer collecte progressive` et `Sauvegarder état conversation`. Un diff montre les écarts avec les JSON actuels avant tout remplacement |
| Tests | Comptage des nœuds : 84 pour le workflow 10. Recherche textuelle des trois nœuds. Aucune exécution métier |
| Livrable | JSON exportés dans `n8n/workflows/`, ancien fichier conservé le temps de la revue, note de diff |

### REC-002 — Versionner le DDL de `ai_conversation_state`

| | |
|---|---|
| Priorité | P0 |
| Problème | La table existe seulement dans le volume. Une recréation de volume la perd, ainsi que le comportement du workflow 10 |
| Périmètre | Nouveau script idempotent, séparé de `postgres/init.sql` pour ne pas réexécuter l'init déjà appliqué |
| Dépendances | REC-001 utile mais non bloquant pour écrire le DDL déjà observé |
| Complexité | S |
| Risques | Écart entre le DDL écrit et des colonnes ajoutées seulement en base |
| Acceptation | Le script relit `\d ai_conversation_state` et ne modifie pas les 48 sessions existantes. `CREATE TABLE IF NOT EXISTS` et index `IF NOT EXISTS` |
| Tests | Exécution sur la base actuelle : aucune erreur, nombre de sessions inchangé |
| Livrable | `database/migrations/` ou équivalent déjà absent : un script `001_ai_conversation_state.sql` créé seulement après accord |

## Lot 1 — Persistance conversationnelle

### REC-003 — Permettre l'effacement explicite dans l'UPSERT

| | |
|---|---|
| Priorité | P0 |
| Problème | BUG-001 et BUG-002. `COALESCE(EXCLUDED.colonne, ancienne)` conserve le token, le site, les dates et les autres champs quand la fusion envoie `NULL` |
| Périmètre | Nœud `Sauvegarder état conversation` uniquement |
| Dépendances | REC-001 |
| Complexité | M |
| Risques | Distinguer « champ absent » et « effacement volontaire ». Casser la continuation légitime d'une collecte si tout `NULL` écrase la mémoire |
| Acceptation | Après une nouvelle création explicite, la ligne `RETURNING` a `token`, `new_slot_id`, `slot_id`, dates et site anciens à `NULL` lorsque la fusion les a vidés. Une réponse courte « Paris » pendant `ASK_CREATE_SITE` conserve le service déjà collecté |
| Tests | Transaction SQL annulée (`BEGIN` / `ROLLBACK`) sur une session de test. Puis un message de chat : création après une session qui avait un token. Contrôle de l'entrée de `Appeler GetAvailability` |
| Livrable | Workflow 10 exporté, requête UPSERT à sémantique `NULL` explicite, compte rendu d'exécution |

Piste de correction, à valider avant édition : remplacer `COALESCE(EXCLUDED.token, ai_conversation_state.token)` par `EXCLUDED.token` pour les champs que la fusion a déjà fusionnés. La continuation doit rester dans le JavaScript de fusion, pas dans le SQL. Le même principe s'applique aux autres colonnes métier. `available_slots` devra être inclus dans cette écriture, ou explicitement vidé lors d'un redémarrage, sinon l'ancienne liste survit.

### REC-004 — Empêcher la recopie du token vers la recherche

| | |
|---|---|
| Priorité | P0 |
| Problème | `Valider paramètres disponibilité` propage `...x`, donc le token revenu du `RETURNING` |
| Périmètre | Ce nœud, après REC-003 |
| Dépendances | REC-003 |
| Complexité | S |
| Risques | Oublier un champ réellement requis par l'affichage des créneaux |
| Acceptation | L'entrée de `Appeler GetAvailability` ne contient pas de token de gestion lors d'une création. Les paramètres HTTP restent `service`, `site`, `dateDebut`, `dateFin` |
| Tests | Une exécution n8n avec une session préchargée d'un ancien token. Inspection des items, sans journaliser le token |
| Livrable | Nœud de validation qui ne reconstruit que les champs de recherche et l'état conversationnel nécessaire |

### REC-005 — Non-régression de la machine à états

| | |
|---|---|
| Priorité | P0 |
| Problème | BUG de robustesse : une nouvelle intention ne doit pas être confondue avec l'action en cours ; une réponse courte doit suivre l'étape |
| Périmètre | `Fusionner état conversation` et `Gérer collecte progressive`, seulement si un cas échoue |
| Dépendances | REC-003 |
| Complexité | L |
| Risques | Modifier les deux gros scripts sans caractérisation préalable |
| Acceptation | Les cas suivants produisent l'étape attendue, sans héritage interdit |

Cas minimum :

- CREATE après une session RESCHEDULE : pas d'ancien token, site ni dates.
- CREATE après CREATE déjà en `READY_CREATE_SEARCH` : nouvelle collecte selon les champs réellement écrits.
- « Paris » après `ASK_CREATE_SITE` : le service reste, l'étape passe aux dates.
- CREATE vers CANCEL, CANCEL vers GET, RESCHEDULE vers CREATE.
- « Oui » et « Non » sur annulation et replanification : une seule mutation, et aucune si la réponse est négative ou ambiguë.
- « Je prends le 2 » en création remplit `slotId`. Le même choix en replanification remplit `newSlotId`.

| Tests | Exécutions de chat, puis `SELECT` de l'étape et des identifiants techniques sans afficher le token |
| Livrable | Rapport de scénarios et, si besoin, correctif ciblé du JavaScript |

## Lot 2 — Données de test

### REC-006 — Créneaux futurs idempotents

| | |
|---|---|
| Priorité | P0 |
| Problème | BUG-003. Aucun créneau ne commence après le 3 septembre 2026. Un CREATE de bout en bout ne peut pas aboutir |
| Périmètre | Script de seed, services et sites réels (`PASSEPORT`, `VISA`, `LEGALISATION`, `ETAT_CIVIL`, `PARIS`, `LISBONNE`) |
| Dépendances | Aucune modification de workflow. Accord avant exécution |
| Complexité | M |
| Risques | Doublons, créneaux dans le passé, modification des 13 rendez-vous, non-respect de `places_reservees <= capacite` |
| Acceptation | Le script peut être rejoué. Il n'insère que des débuts futurs, jours ouvrés, dans le fuseau du site, statut `DISPONIBLE`, capacité copiée depuis le service. L'unicité `(service_id, site_id, debut)` empêche les doublons. Les rendez-vous existants ne changent pas |
| Tests | Comptages avant / après. Second passage : 0 nouvelle ligne. `SELECT` d'un intervalle passeport / Paris non vide |
| Livrable | `database/seeds/seed_future_appointments.sql` et une procédure de nettoyage limitée à un marqueur de test, non exécutée sans accord |

Le site `LYON` cité dans le PRD n'est pas créé par ce seed.

## Lot 3 — Parcours métier

### REC-007 — CREATE de bout en bout

| | |
|---|---|
| Priorité | P0 |
| Problème | La création conversationnelle s'est arrêtée sur une recherche vide. La collecte d'identité, l'UUID de créneau, la référence et la capacité ne sont pas redémontrés |
| Périmètre | Workflow 10 et workflow 03. Pas de réécriture si le scénario passe |
| Dépendances | REC-003, REC-004, REC-006, n8n démarré, Ollama joignable |
| Complexité | L |
| Risques | Sur-réservation si la requête interpolée de création n'est pas atomique ; le nœud de notification est désormais séparé |
| Acceptation | Scénario passeport, site Paris, période future, choix du créneau 2, nom, prénom, e-mail, téléphone. Réponse avec référence et token. `places_reservees` augmenté de 1. Une notification `CONFIRMATION` / `A_ENVOYER` créée |
| Tests | Chat complet, puis SQL sur `rendez_vous`, `creneaux`, `historique_rendez_vous`, `notifications` |
| Livrable | Compte rendu E2E-03, sans coller le token dans le rapport |

### REC-008 — GET_APPOINTMENT

| | |
|---|---|
| Priorité | P0 |
| Problème | Consultation non revalidée. La réponse actuelle expose l'identité complète et le token |
| Périmètre | Workflow 04 et branche consultation du workflow 10 |
| Dépendances | Un token issu de REC-007, ou un rendez-vous déjà `CONFIRME` |
| Complexité | M |
| Risques | Message trop précis lorsqu'un token est inconnu |
| Acceptation | Token valide : référence, statut, service, site, horaire. Token invalide : message contrôlé, aucune ligne d'un autre rendez-vous. Le token n'est pas répété dans la réponse |
| Tests | Deux appels webhook et le parcours chat |
| Livrable | E2E-06 |

### REC-009 — CANCEL_APPOINTMENT

| | |
|---|---|
| Priorité | P0 |
| Problème | Confirmation et idempotence non rejouées |
| Périmètre | Branche annulation du workflow 10 et workflow 05, déjà paramétré |
| Dépendances | REC-007 |
| Complexité | M |
| Risques | Décrémenter deux fois `places_reservees` |
| Acceptation | « Non » et une réponse ambiguë ne changent pas le rendez-vous. « Oui » passe le statut à `ANNULE`, libère une place une seule fois, et un second « Oui » ne relibère rien |
| Tests | SQL avant / après, deux confirmations successives |
| Livrable | E2E-07 |

### REC-010 — RESCHEDULE_APPOINTMENT

| | |
|---|---|
| Priorité | P0 |
| Problème | Workflow 06 inactif. La sélection de créneau et la confirmation positive n'ont pas été refermées. Le JSON du dépôt n'a pas le même contrat que la base |
| Périmètre | Workflow 06 vivant (`token`, `newSlotId`, `$1`, `$2`) et la branche du workflow 10 |
| Dépendances | REC-001, REC-006, REC-007. Activation de 06 seulement après contrôle du contrat |
| Complexité | L |
| Risques | Activer une mauvaise révision ; déplacer le rendez-vous vers un autre service parce que le SQL vivant recopie `service_id` et `site_id` du nouveau créneau |
| Acceptation | Période nouvelle, « Je prends le 2 » résout `newSlotId`, « Non » ne déplace rien, « Oui » déplace le rendez-vous et ajuste les deux capacités dans la même requête. Un second « Oui » ne rejoue pas le déplacement |
| Tests | E2E-08 et E2E-09, SQL des deux créneaux |
| Livrable | Workflow 06 activé, scénario documenté, règle écrite sur le changement de service ou de site |

## Lot 4 — Tests automatisés

### REC-011 — Harnais de non-régression

| | |
|---|---|
| Priorité | P1 |
| Problème | Aucun test exécutable. `tests.docx` n'est pas une suite |
| Périmètre | Scripts Node déjà compatibles avec le JavaScript n8n, plus SQL transactionnel annulé |
| Dépendances | REC-001, pour tester le JavaScript réellement exporté |
| Complexité | L |
| Risques | Recopier la logique au lieu de tester la fonction du workflow |
| Acceptation | Au moins un test échoue sur l'UPSERT `COALESCE` d'origine et passe après REC-003. Couverture ciblée : redémarrage, changement d'intention, réponse courte, UUID, « Je prends le 2 », « Oui », « Non », disponibilité vide et non vide |
| Tests | Commande unique documentée, sans secret |
| Livrable | Dossier `tests/` et une section dans le README |

Les tests d'intégration HTTP attendent n8n démarré. Ils ne remplacent pas le test SQL du `NULL`.

## Lot 5 — Sécurité et exploitation

### REC-012 — Paramétrer la création et réduire l'exposition du token

| | |
|---|---|
| Priorité | P1 |
| Problème | Le nœud vivant `Créer rendez-vous` interpole encore le SQL. Consultation et e-mails exposent le token |
| Périmètre | Workflow 03, textes de réponse du workflow 10, modèles d'e-mail 08 et 09 |
| Dépendances | REC-007, pour ne pas casser un parcours déjà prouvé |
| Complexité | M |
| Risques | Changer le contrat de réponse pendant les E2E |
| Acceptation | La création utilise des paramètres liés, dans une seule requête qui réserve la place, écrit l'historique et la notification. Le chat ne répète le token qu'une fois, au moment de la remise au citoyen. Les logs n8n examinés ne le recopient pas |
| Tests | Création nominale, apostrophe dans le nom, créneau déjà complet, rejeu concurrent de la dernière place |
| Livrable | Workflow 03 exporté et note de menace sur l'UUID comme seul secret |

### REC-013 — Remettre les e-mails sous contrôle

| | |
|---|---|
| Priorité | P1 |
| Problème | 10 confirmations sont en `A_ENVOYER`. Les workflows 07, 08 et 09 sont inactifs |
| Périmètre | Jobs existants, Mailpit |
| Dépendances | SMTP credential déjà présent. Pas d'envoi réel hors Mailpit |
| Complexité | M |
| Risques | Activer le rythme « toutes les minutes » et marquer envoyés des messages non relus |
| Acceptation | Une confirmation de test arrive dans Mailpit, passe à `ENVOYE`, et un second passage ne la renvoie pas. Les 10 notifications historiques ne sont pas expédiées en masse sans accord |
| Tests | Une notification de test identifiable, puis contrôle Mailpit et SQL |
| Livrable | Jobs vérifiés, décision explicite sur l'activation permanente |

### REC-014 — Baseline locale et observabilité minimale

| | |
|---|---|
| Priorité | P2 |
| Problème | README faux, images `latest`, pas de santé fonctionnelle, pas de corrélation |
| Périmètre | README, `.env.example` sans secrets, Compose |
| Dépendances | Ports réels déjà lus |
| Complexité | M |
| Risques | Changer une URL interne qui fonctionne (`localhost:5678` depuis le conteneur n8n) |
| Acceptation | Le README indique 5680, 5433, 8026 et 1026, les sites `PARIS` et `LISBONNE`, et interdit `docker compose down -v` comme dépannage. Les images validées sont épinglées seulement après un démarrage réussi |
| Tests | `docker compose ps` et les trois URL locales |
| Livrable | README à jour, `.env.example`, checklist de démarrage |

Le portail citoyen, le multilingue et un service métier hors n8n restent en P3. Ils ne commencent pas avant la fermeture des lots 1 à 3.

## Commandes de vérification proposées

À lancer depuis `C:\Open Source PME\govsuite-appointments`. Aucune ne supprime de volume.

```powershell
docker compose ps
docker compose up -d
docker compose exec postgres psql -U govsuite -d govsuite -c "\dt ai_conversation_state"
docker compose exec postgres psql -U govsuite -d govsuite -c "SELECT code FROM sites ORDER BY code;"
docker compose exec postgres psql -U govsuite -d govsuite -c "SELECT MIN(debut), MAX(debut), COUNT(*) FROM creneaux;"
docker compose exec postgres psql -U govsuite -d govsuite -c "SELECT name, active FROM workflow_entity ORDER BY name;"
```

Après démarrage de n8n :

- éditeur : `http://localhost:5680`
- Mailpit : `http://localhost:8026`
- services : `http://localhost:5680/webhook/services`

Ollama doit répondre à l'URL configurée dans le credential n8n. Cette URL n'a pas été lue, car le credential est chiffré.

## Hors de ce plan tant qu'il n'y a pas d'accord séparé

- `docker compose down -v`
- réimport du JSON actuel du workflow 10
- suppression des 48 sessions ou des 13 rendez-vous
- création d'un site `LYON`
- extraction du métier hors n8n
- activation permanente des e-mails sur les 10 notifications déjà en attente
