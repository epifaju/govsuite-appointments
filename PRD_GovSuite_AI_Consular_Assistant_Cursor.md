# PRD — GovSuite AI Consular Assistant

**Version :** 1.0 — reprise et industrialisation  
**Date :** 28 octobre 2026  
**Statut :** document de travail à confronter au dépôt réel  
**Destinataires :** développeur, Cursor AI, QA, responsable métier  
**Principe directeur :** poursuivre l'existant, préserver les workflows opérationnels, vérifier chaque hypothèse dans le code et la base avant modification.

---

## 1. Résumé exécutif

GovSuite AI Consular Assistant est un assistant conversationnel francophone permettant de consulter les services consulaires, rechercher des disponibilités, créer, consulter, annuler et replanifier des rendez-vous. L'orchestration actuelle repose sur **n8n**, une base **PostgreSQL**, un modèle IA local via **Ollama**, des webhooks HTTP et une infrastructure **Docker Compose**. Des tâches de notification par courriel et une interface de test n8n existent.

Le développement est déjà engagé. L'objectif de cette reprise est de **fiabiliser la gestion de conversation multi-tours**, finaliser les parcours bout en bout, éliminer les régressions liées à la mémoire, automatiser les tests et préparer une exploitation sécurisée. La cible n'est pas de réécrire le produit en Spring Boot/React : ces composants ne pourront être proposés qu'après audit, avec justification et accord explicite.

### 1.1 Résultat attendu

Un utilisateur peut écrire « Je souhaite renouveler mon passeport », fournir progressivement le site, la période, le créneau et ses coordonnées, puis recevoir une confirmation de réservation. Il peut ensuite consulter, annuler ou replanifier ce rendez-vous avec les contrôles appropriés. Le tout doit fonctionner de façon reproductible en local, avec des données de test et des preuves de tests automatisés.

### 1.2 Non-objectifs immédiats

Paiement en ligne, gestion des visas au fond, biométrie, délivrance des documents, application mobile native, portail citoyen complet, migration obligatoire vers microservices, déploiement production avant revue de sécurité.

## 2. Contexte et état des lieux vérifié

### 2.1 Éléments observés dans les échanges de débogage

| Élément | État observé | Niveau de certitude |
|---|---|---|
| Workflow n8n `10_AI_ConsularAssistant_Complete` | Existant, exécuté via chat n8n | Confirmé par captures et sorties |
| Pipeline principal | Chat → charger état → comprendre demande/Ollama → parser → fusionner → collecte → sauvegarder → router | Confirmé |
| Intention `CREATE_APPOINTMENT` | Reconnue pour « prendre rendez-vous pour renouveler mon passeport » | Confirmé |
| Fusion de l'état | Correctif appliqué : nouveau démarrage explicite n'hérite plus automatiquement des anciens site/dates/token | Confirmé sur test ciblé |
| Collecte progressive | Correctif appliqué : service/site/dates fournis conduisent à `GET_AVAILABILITY` | Confirmé sur test ciblé |
| Webhook disponibilité | `GET /webhook/appointments/availability` répond `success=true, count=0, slots=[]` pour 11–14/09/2026 | Confirmé |
| Base `creneaux` | Colonnes `service_id`, `site_id`, `debut`, `fin`, `capacite`, `places_reservees`, `statut` | Confirmé par psql |
| Créneaux 11–14/09/2026 | Aucun enregistrement dans `creneaux` sur cette période, tous services/sites | Confirmé par SQL |
| Token résiduel | Un ancien token réapparaît dans l'entrée du nœud d'appel disponibilité malgré nettoyage en amont | Anomalie observée, origine à identifier |
| CREATE complet | Non démontré de bout en bout dans les derniers tests | À valider |
| GET/CANCEL/RESCHEDULE complets | Branches présentes ; régression possible | À revalider |
| Courriels automatiques | Workflows de tâches annoncés fonctionnels dans l'historique projet | À revalider sur le dépôt |

**Important :** les dates de septembre 2026 utilisées dans les tests historiques sont désormais passées. Les tests futurs doivent utiliser des dates relatives à l'horloge de test ou des jeux de données figés avec horloge contrôlée.

### 2.2 Points à ne pas supposer

Le schéma complet SQL, les contraintes et clés étrangères, le contrat exact des webhooks, les noms des tables de services/sites, les champs de réponse du webhook de création, le mode d'authentification des utilisateurs et les versions d'images Docker doivent être lus dans les artefacts réels. Ne pas fabriquer de migration ou de requête SQL fondée sur des colonnes imaginées.

## 3. Personas et besoins

**Citoyen :** souhaite réserver un rendez-vous en langage naturel, sans comprendre les codes de services, et recevoir une confirmation exploitable.  
**Agent consulaire :** souhaite consulter les réservations, traiter les erreurs, contrôler les capacités et assister les usagers.  
**Administrateur :** souhaite configurer services/sites/plages horaires, superviser les automatisations et conserver un historique auditable.  
**Exploitant technique :** souhaite déployer, tester, sauvegarder et diagnostiquer la solution localement.

## 4. Périmètre fonctionnel et priorités

| ID | Fonction | Priorité | Critère de succès |
|---|---|---|---|
| F-01 | Comprendre l'intention en français | P0 | Classification stable et explicable, y compris réponses courtes |
| F-02 | Conserver l'état de conversation multi-tours | P0 | Aucune fuite de données d'une ancienne action vers une nouvelle |
| F-03 | Collecter service, site et dates | P0 | Une seule question utile à la fois, données normalisées |
| F-04 | Chercher les créneaux disponibles | P0 | Filtre exact service/site/période, dates inclusives côté métier |
| F-05 | Sélectionner un créneau par numéro | P0 | « Je prends le 2 » résout l'UUID du créneau affiché |
| F-06 | Collecter identité/contact | P0 | Validation nom, prénom, email, téléphone |
| F-07 | Créer un rendez-vous | P0 | Réservation atomique, référence et token de gestion retournés |
| F-08 | Consulter un rendez-vous | P0 | Accès contrôlé par token et règles de confidentialité |
| F-09 | Annuler un rendez-vous | P0 | Confirmation explicite, annulation idempotente |
| F-10 | Replanifier un rendez-vous | P0 | Ancien rendez-vous et nouveau créneau cohérents, opération atomique |
| F-11 | Gérer absence de disponibilités | P0 | Message clair, propositions de modifier dates/site |
| F-12 | Envoyer confirmation/rappels | P1 | Messages traçables, anti-doublons, échec récupérable |
| F-13 | Gestion administrative des créneaux | P1 | Création et modification sans sur-réservation |
| F-14 | Supervision et observabilité | P1 | Logs structurés, métriques et erreurs corrélées |
| F-15 | Multilingue (FR/PT/Créole) | P2 | Qualité linguistique évaluée, sans changer les codes métier |
| F-16 | Portail citoyen/admin | P2 | Étude séparée après stabilisation du backend |

## 5. Règles métier

### 5.1 Services et sites

Codes actuellement connus : `PASSEPORT`, `VISA`, `LEGALISATION`, `ETAT_CIVIL`; sites connus : `PARIS`, `LYON`. Vérifier l'orthographe réelle des codes dans la base et les workflows avant de figer des enums. Accepter les formulations naturelles et les synonymes ; persister les codes canoniques.

### 5.2 Dates et fuseaux

Stocker/échanger les dates de recherche sous forme `YYYY-MM-DD`. Accepter en entrée utilisateur `dd/MM/yyyy` et normaliser. Les instants de créneau sont horodatés avec fuseau explicite ; afficher dans le fuseau du site. Une période du 11 au 14 inclut toute la journée du 14 : utiliser des bornes `[début à 00:00, lendemain de dateFin à 00:00)` dans le fuseau approprié. Refuser dates invalides, inversées ou passées, sauf tests avec horloge simulée.

### 5.3 Disponibilité et concurrence

Un créneau n'est réservable que si son statut le permet et si `places_reservees < capacite`. L'opération de réservation doit être transactionnelle, revalider la capacité à l'écriture et empêcher deux demandes simultanées de prendre la dernière place. Une liste affichée ne constitue pas une garantie de réservation ultérieure.

### 5.4 Token, référence et confidentialité

`reference` est un identifiant lisible, distinct du `token` de gestion. Ne jamais réutiliser le token d'un rendez-vous antérieur lors d'une nouvelle création. Les tokens doivent être imprévisibles, non exposés dans les logs et transmis seulement par canaux appropriés. Vérifier si un simple token suffit pour consultation/annulation/replanification ; documenter les risques et prévoir une vérification complémentaire avant mise en production.

### 5.5 Confirmations

L'annulation et la replanification requièrent une confirmation explicite (« oui » / « non »). Les réponses ambiguës doivent conduire à une nouvelle question sans effet de bord. Répéter « oui » ne doit pas déclencher deux fois une opération déjà exécutée.

## 6. Machine à états conversationnelle

### 6.1 Intents principaux

`GET_SERVICES`, `GET_AVAILABILITY`, `CREATE_APPOINTMENT`, `GET_APPOINTMENT`, `CANCEL_APPOINTMENT`, `RESCHEDULE_APPOINTMENT`, `GENERAL` (à vérifier contre les règles du routeur).

### 6.2 États CREATE

`ASK_CREATE_SERVICE` → `ASK_CREATE_SITE` → `ASK_CREATE_DATE_RANGE` → `READY_CREATE_SEARCH` → `ASK_CREATE_SLOT` → `ASK_NOM` → `ASK_PRENOM` → `ASK_EMAIL` → `ASK_TELEPHONE` → `READY_CREATE` → résultat final. Le nom exact des états utilisés dans les workflows doit être audité : ne pas renommer sans adapter toutes les branches.

### 6.3 États GET

`ASK_TOKEN` → `READY_GET_APPOINTMENT` → consultation → réponse ou erreur contrôlée.

### 6.4 États CANCEL

`ASK_TOKEN` → `READY_CANCEL_LOOKUP` → présentation du rendez-vous → `ASK_CANCEL_CONFIRMATION` → validation réponse → appel d'annulation ou abandon.

### 6.5 États RESCHEDULE

`ASK_RESCHEDULE_TOKEN` → `READY_RESCHEDULE_TOKEN` → chargement rendez-vous → `ASK_RESCHEDULE_DATE_RANGE` → `READY_RESCHEDULE_SEARCH` → `ASK_RESCHEDULE_SLOT` → `ASK_RESCHEDULE_CONFIRMATION` → appel replanification ou abandon. Préserver la séparation entre `slotId` (création) et `newSlotId` (replanification).

### 6.6 Invariants de la machine à états

1. `Fusionner état conversation` est l'unique responsable de la fusion mémoire/données du message.
2. `Gérer collecte progressive` travaille sur les champs déjà fusionnés ; il peut lire l'ancienne étape, mais ne doit pas réinjecter `previous.site`, `previous.token` ou les dates supprimées.
3. Un nouveau message explicitement formulé comme une nouvelle action peut redémarrer **la même** intention ; `CREATE → CREATE` ne signifie pas nécessairement « continuer ».
4. Une réponse courte (« Paris », « Oui », « 2 ») doit être interprétée en fonction de l'étape active.
5. `GET_AVAILABILITY` peut être l'intention technique de routage pendant une création, tout en conservant `pendingAction=CREATE_APPOINTMENT`.
6. Une transition vers la recherche n'est permise que si service, site et période sont valides.
7. Le numéro de créneau est résolu à partir de la **liste effectivement présentée** au citoyen dans la session active ; vérifier la validité et l'appartenance du créneau.
8. Chaque transition doit produire `intent`, `pendingAction`, `conversationStep`, données normalisées et diagnostics non sensibles.
9. Les opérations réussies doivent nettoyer/terminer l'état pour éviter leur répétition involontaire.
10. L'expiration de session doit avoir un comportement déterministe et compréhensible.

### 6.7 Cas particuliers à tester

- « Je souhaite prendre rendez-vous pour mon passeport » après une ancienne replanification.
- Même phrase après une ancienne création bloquée sur `READY_CREATE_SEARCH`.
- « Paris » après `ASK_CREATE_SITE` : conserver service, demander les dates.
- « Je prends le 2 » après une recherche CREATE : remplir `slotId`, pas `newSlotId`.
- « Je prends le 2 » après une recherche RESCHEDULE : remplir `newSlotId`, pas `slotId`.
- « Oui » après `ASK_RESCHEDULE_CONFIRMATION` : ne pas recommencer la question.
- « Non » après confirmation : aucune mutation de réservation.
- Token inexistant, expiré ou invalide : message contrôlé.
- Changement de service/site en cours de parcours : invalider la liste de créneaux précédemment affichée.

## 7. Architecture existante et architecture cible

```text
Citoyen / Chat n8n
        |
        v
Webhook / Chat Trigger
        |
        v
Charger état conversation (PostgreSQL)
        |
        v
Comprendre la demande (Ollama local)
        |
        v
Parser intention (normalisation stricte)
        |
        v
Fusionner état conversation (mémoire + message)
        |
        v
Gérer collecte progressive (machine à états)
        |
        v
Sauvegarder état conversation (PostgreSQL)
        |
        v
Router intention
        +--> Services / Disponibilités
        +--> Créer rendez-vous
        +--> Consulter rendez-vous
        +--> Annuler rendez-vous
        +--> Replanifier rendez-vous
        |
        v
Réponse citoyen + notifications
```

### 7.1 Environnement local connu

- Windows + Docker Desktop ; répertoire historique : `C:\Open Source PME\govsuite-appointments` (à confirmer sur la machine).
- PostgreSQL 16, port hôte `5433`, base `govsuite`.
- n8n self-hosted, port hôte `5680`, port conteneur `5678`.
- Mailpit, interface hôte `8025`.
- Ollama exécuté localement ; son adresse réseau depuis Docker doit être vérifiée.
- **Règle réseau :** dans un conteneur, `localhost` pointe vers ce conteneur. Les URL interservices doivent utiliser les noms DNS du réseau Docker ou une adresse de service vérifiée ; ne pas remplacer une URL qui fonctionne sans test.
- Pinner les versions Docker validées ; ne pas utiliser `latest` en environnement reproductible.

### 7.2 Principes de développement

Séparer les règles de décision testables des expressions n8n lorsque cela est utile. Garder une représentation versionnée des workflows JSON et du schéma SQL. Préférer des changements petits, réversibles et accompagnés de tests. Éviter de multiplier les sources de vérité pour l'état.

## 8. Données PostgreSQL

### 8.1 Structures observées

`creneaux` contient au moins : `id`, `service_id`, `site_id`, `debut`, `fin`, `capacite`, `places_reservees`, `statut`, `created_at`, `updated_at` (colonnes vues dans psql). Une table d'état conversationnel `ai_conversation_state` est mentionnée dans l'historique du projet, avec des champs de session, intention, action, étape, critères et identifiants ; **vérifier le DDL réel**.

### 8.2 Audit obligatoire avant migration

Exécuter et conserver dans un rapport : `\dt`, `\d+ creneaux`, description des tables services/sites/rendez-vous/état, contraintes, indexes, clés étrangères, triggers et fonctions. Identifier les colonnes de disponibilité calculées versus persistées. Examiner les procédures SQL des workflows `GetAvailability`, `CreateAppointment`, `CancelAppointment`, `RescheduleAppointment`.

### 8.3 Données de démonstration

Créer une migration ou un script **idempotent** de données de test pour services/sites réellement existants et des créneaux futurs. Prévoir une graine déterministe pour tests automatisés, un jeu de démonstration renouvelable et une procédure de nettoyage ciblée. Ne jamais injecter directement dans une base de production ni contourner les contraintes. Générer des créneaux selon jours ouvrés, fuseau du site, horaires, durée et capacité configurables.

### 8.4 Transactionnalité

Documenter les transactions de réservation, annulation et replanification. En particulier, replanification = vérifier droits + disponibilité du nouveau créneau + déplacer réservation + ajuster capacités **dans une seule transaction** ; rollback intégral en cas d'échec.

## 9. Contrats API et webhooks

**Les contrats ci-dessous sont des contrats cibles à vérifier**, sauf les champs explicitement observés.

### 9.1 GET disponibilité — observé

`GET /webhook/appointments/availability?service=PASSEPORT&site=PARIS&dateDebut=YYYY-MM-DD&dateFin=YYYY-MM-DD`

Réponse observée en absence de résultats :

```json
{"success":true,"count":0,"slots":[]}
```

Exemple de structure de slot observée historiquement :

```json
{
  "id":"814491a9-739a-4650-a15f-e004613fc7c6",
  "service":"PASSEPORT",
  "site":"PARIS",
  "debut":"2026-09-03T09:00:00+02:00",
  "fin":"2026-09-03T09:30:00+02:00",
  "capacite":2,
  "places_reservees":0,
  "places_disponibles":2
}
```

**Attention :** cet exemple est historique, non une disponibilité actuelle.

### 9.2 Créer rendez-vous — contrat à inventorier

Entrées métier attendues : service, site, `slotId`, nom, prénom, email, téléphone, identifiant de requête idempotent. Sorties attendues : statut, identifiant du rendez-vous, référence, token de gestion et horaire. Vérifier les noms exacts et les codes d'erreur dans le workflow existant.

### 9.3 Consulter rendez-vous — contrat à inventorier

Entrée : token ou mécanisme de preuve d'accès défini par l'existant. Sortie : données nécessaires au citoyen, avec masquage des informations personnelles. Ne jamais retourner un rendez-vous d'une autre personne sur simple référence publique.

### 9.4 Annuler rendez-vous — contrat à inventorier

Entrées : token/autorisation, confirmation validée en amont, clé idempotente. Sorties : résultat, statut et référence. Rejouer la même demande ne doit pas décrémenter plusieurs fois les réservations.

### 9.5 Replanifier rendez-vous — champs observés

Le workflow utilise `token` et `newSlotId` ; la validation actuelle vérifie leur forme UUID. Les contrats exacts HTTP et les statuts doivent être lus dans `Appeler RescheduleAppointment`. Prévoir conflits de capacité, créneau déjà pris, token invalide, changement de site/service autorisé ou interdit selon règles métier.

### 9.6 Convention d'erreurs cible

Normaliser les erreurs dans la mesure compatible avec l'existant : `code`, `message` utilisateur, `details` non sensibles, `correlationId`, `retryable`. Distinguer validation (400), authentification/autorisation (401/403), absence (404), conflit (409), indisponibilité technique (503). Éviter de révéler l'existence de rendez-vous à des utilisateurs non autorisés.

## 10. Problèmes connus et corrections attendues

### BUG-01 — contamination de l'état entre actions

**Historique :** une ancienne replanification ou création transmettait site/dates/token à une nouvelle création. **État :** correctifs testés dans `Fusionner état conversation` et `Gérer collecte progressive`. **Travail Cursor :** conserver la correction, écrire des tests de non-régression, vérifier toutes les branches et cas de redémarrage.

### BUG-02 — token ancien réintroduit après sauvegarde

**Symptôme observé :** `token=null` à la sortie de collecte, mais ancien token présent dans l'entrée de `Appeler GetAvailability`. **Hypothèses à vérifier :** sortie du nœud PostgreSQL `Sauvegarder état conversation`, requête `UPSERT` avec `COALESCE`, mapping de colonnes ou nœud `Valider paramètres disponibilité`. **Travail Cursor :** comparer Input/Output de chaque nœud d'une même exécution, identifier le premier point de réintroduction, corriger la sémantique `null` versus « champ absent », ajouter test.

### BUG-03 — aucun créneau sur une période de test

**Diagnostic confirmé :** la requête directe SQL sur `creneaux` du 11 au 14 septembre 2026 retourne `0 rows`. **Nature :** absence de données, pas erreur prouvée de l'API. **Travail Cursor :** générer des créneaux futurs de démonstration, vérifier l'API et le parcours CREATE complet.

### BUG-04 — sorties du modèle non fiables

**Observation :** `llmRaw` a déjà contenu des valeurs manifestement incorrectes (site `PASSPORT`, date ancienne, token factice), tandis que `Parser intention` produisait des valeurs normalisées correctes. **Travail Cursor :** renforcer validation par schéma, listes autorisées, vérification UUID/date, refus des champs inventés, tests sur hallucinations et prompt injection. Le LLM ne doit pas être la source d'autorité des tokens, références ou créneaux.

### BUG-05 — confirmation répétée en replanification

**Historique :** « Oui » a déjà conduit à une répétition de la question de confirmation. **Travail Cursor :** tester `ASK_RESCHEDULE_CONFIRMATION`, analyser les réponses, vérifier les conditions du routeur, l'idempotence et l'absence de double appel.

## 11. Sécurité et protection des données

- Authentifier les endpoints sensibles ; ne pas exposer des webhooks de mutation publiquement sans contrôle.
- Protéger les données personnelles : nom, prénom, email, téléphone, rendez-vous et tokens ; appliquer minimisation, durées de conservation et politique de suppression.
- Conserver les secrets hors des workflows exportés et du dépôt : variables d'environnement, coffre à secrets ou credentials n8n.
- Journaliser les changements de statut et les opérations administratives avec identifiant de corrélation, sans token en clair.
- Définir permissions citoyen/agent/admin avant tout portail public.
- Protéger contre injections SQL, manipulations de prompt, requêtes forgées, attaques de rejeu, énumération et abus de fréquence.
- Réviser les obligations RGPD applicables et la localisation des données avant production ; formaliser une analyse de risques.
- Chiffrer les communications exposées ; sécuriser sauvegardes PostgreSQL et restauration.

## 12. Expérience conversationnelle

Le chatbot doit utiliser un français clair, demander seulement les informations manquantes, résumer les choix avant une action irréversible et proposer une suite concrète si aucun créneau n'est disponible. Exemple cible :

```text
Citoyen : Je souhaite prendre rendez-vous pour renouveler mon passeport.
Assistant : Pour quel site souhaitez-vous prendre rendez-vous : Paris ou Lyon ?
Citoyen : Paris.
Assistant : Quelle période souhaitez-vous ?
Citoyen : Du 12/11/2026 au 16/11/2026.
Assistant : Voici les créneaux disponibles : 1. ... 2. ...
Citoyen : Je prends le 2.
Assistant : Quel est votre nom ?
...
Assistant : Votre rendez-vous est confirmé. Référence : ...
```

Les créneaux et références de cet exemple sont à obtenir depuis le système, jamais à inventer. Prévoir un message spécifique pour « aucun créneau », les indisponibilités techniques et les sessions expirées.

## 13. Stratégie de tests

### 13.1 Tests unitaires

Fonctions de normalisation des dates, téléphones, UUID, emails, choix de créneau, détection d'intention explicite, redémarrage, progression des étapes, validation des transitions, réponses de confirmation.

### 13.2 Tests d'intégration

PostgreSQL + workflows de disponibilité/création/consultation/annulation/replanification ; cas zéro résultat, données invalides, absence de site, token périmé, capacité saturée, transaction concurrente et erreur d'envoi d'email.

### 13.3 Tests E2E prioritaires

| Test | Scénario | Attendu |
|---|---|---|
| E2E-01 | Nouvelle création avec ancienne mémoire RESCHEDULE | Aucun ancien token/site/date hérité |
| E2E-02 | Redémarrage explicite CREATE → CREATE | Nouvelle collecte depuis les champs réellement fournis |
| E2E-03 | Création complète | Réservation persistée, capacité mise à jour, confirmation |
| E2E-04 | Période sans créneau | `count=0`, message utile, aucune mutation |
| E2E-05 | Sélection « Je prends le 2 » CREATE | `slotId` = deuxième UUID affiché |
| E2E-06 | Consultation valide/invalide | Accès correct ou refus contrôlé |
| E2E-07 | Annulation oui/non | Mutation uniquement sur confirmation positive |
| E2E-08 | Replanification avec « Je prends le 2 » | `newSlotId` correct, ancien créneau libéré atomiquement |
| E2E-09 | Confirmation répétée | Aucun double traitement |
| E2E-10 | Deux réservations simultanées, dernière place | Une seule réussit |
| E2E-11 | Changement de site après liste de créneaux | Ancienne liste invalidée |
| E2E-12 | Token nettoyé avant recherche | Pas de réapparition après sauvegarde |
| E2E-13 | Entrée LLM hallucinée | Champs invalides ignorés, pas de réservation inventée |
| E2E-14 | Reprise après redémarrage n8n | État persisté cohérent |

### 13.4 Critères de qualité

Aucun test P0 rouge, aucune réservation en surcapacité, aucune fuite de token entre sessions, toutes les transitions critiques couvertes par tests, exports n8n importables, scripts de migrations reproductibles, preuve E2E sauvegardée dans un rapport.

## 14. Observabilité et exploitation

Ajouter `correlationId`, `sessionId` pseudonymisé, `workflowId`, `intent`, `conversationStep`, durée, résultat et code d'erreur aux logs techniques. Ne pas loguer de token ni de PII en clair. Prévoir health checks Docker, surveillance PostgreSQL, échecs n8n, saturation des créneaux, délais Ollama et tâches email. Documenter sauvegarde/restauration et redémarrage sans suppression de volumes. **Ne jamais utiliser `docker compose down -v` pour un dépannage ordinaire.**

## 15. Plan de réalisation Cursor — phases et livrables

### Phase 0 — Audit sans modification (P0)

**Actions :** inspecter arborescence, Docker Compose, workflows JSON, scripts SQL, versions, secrets, API, configuration n8n/Ollama, état des tests. Reconstituer la topologie réelle et le DDL. Identifier les divergences avec ce PRD. **Livrables :** `docs/audit-existing.md`, `docs/architecture-as-is.md`, inventaire des workflows, matrice risques/écarts. **Gate :** validation humaine avant refactor important.

### Phase 1 — Baseline reproductible (P0)

**Actions :** lancer l'environnement sans effacer les volumes ; documenter `.env.example`, commande de démarrage, import/export n8n, migrations et jeux de données. **Livrables :** `README.md` opérationnel, `docs/local-setup.md`, scripts de vérification. **Gate :** environnement local reproductible et sauvegarde testée.

### Phase 2 — Mémoire et machine à états (P0)

**Actions :** tester et stabiliser `Fusionner état conversation` / `Gérer collecte progressive`, contrôler persistance `null`, corriger BUG-02, sécuriser transitions CREATE/GET/CANCEL/RESCHEDULE. **Livrables :** exports workflows corrigés, tests et rapport de non-régression. **Gate :** E2E-01, 02, 05, 09, 11, 12, 13 verts.

### Phase 3 — Disponibilités et données de test (P0)

**Actions :** auditer jointures service/site, date de fin inclusive, capacités et statuts ; générer créneaux futurs idempotents ; tester réponse API. **Livrables :** script SQL seed, tests API, documentation. **Gate :** disponibilité positive et négative vérifiées directement en base.

### Phase 4 — Création complète (P0)

**Actions :** valider sélection créneau, collecte identité, transaction réservation, génération référence/token, notifications. **Livrables :** scénario CREATE E2E avec preuve DB. **Gate :** E2E-03, 04, 10 verts.

### Phase 5 — Consultation, annulation, replanification (P0)

**Actions :** stabiliser contrôles token, confirmations, idempotence, transaction de déplacement, erreurs métier. **Livrables :** workflows et E2E complets. **Gate :** E2E-06, 07, 08, 09 verts.

### Phase 6 — Durcissement et exploitation (P1)

**Actions :** sécuriser webhooks, secrets, logs, sauvegardes, observabilité, gestion des erreurs et documentation. **Livrables :** checklist sécurité, guide d'exploitation, rapport de tests et release candidate. **Gate :** revue sécurité et restauration réussie.

### Phase 7 — Extensions produit (P2)

Étudier, dans des PRD distincts, portail citoyen/admin, multilingue, reporting, déploiement public et éventuellement extraction de règles métier vers un service dédié. Ne pas commencer avant validation du socle.

## 16. Definition of Done

Une tâche est terminée uniquement si : le code/workflow est versionné, les tests ciblés passent, le comportement a été vérifié dans n8n et PostgreSQL, aucune régression des autres intentions n'est détectée, la documentation est mise à jour, les données personnelles sont protégées, et un compte rendu précise les fichiers modifiés, commandes exécutées, résultats et limites.

## 17. Consignes de travail impératives pour Cursor AI

1. **Lire avant d'écrire.** Ne pas supposer les noms de tables, colonnes, chemins ou endpoints.
2. **Ne pas réécrire tout le système.** Conserver les workflows et contrats qui fonctionnent.
3. **Auditer les effets de bord.** Chaque changement de machine à états doit être testé sur les quatre parcours.
4. **Ne jamais réintroduire des données nettoyées.** `null` explicite doit rester `null` lorsqu'il représente une réinitialisation.
5. **Ne jamais inventer des créneaux/tokens/références.** Le LLM extrait une intention ; PostgreSQL et les services métier décident de la vérité.
6. **Préserver les données.** Pas de `down -v`, pas de suppression globale des sessions sans accord.
7. **Séparer faits et hypothèses.** Indiquer ce qui a été vérifié dans les fichiers et ce qui reste à confirmer.
8. **Livrer par phases.** Proposer un plan, faire les modifications minimales, exécuter les tests, fournir un rapport.
9. **Ne pas afficher de secrets.** Masquer tokens, emails et mots de passe dans les rapports.
10. **Demander validation** avant changement d'architecture, migration destructive ou modification de contrat API.

## 18. Premier prompt à coller dans Cursor AI

> Tu es architecte logiciel senior, expert n8n, PostgreSQL, Docker, JavaScript et agents IA locaux. Tu reprends un projet existant appelé **GovSuite AI Consular Assistant**. Lis intégralement `PRD_GovSuite_AI_Consular_Assistant_Cursor.md`, puis inspecte le dépôt et les workflows JSON réels. **Commence uniquement par la Phase 0 (audit sans modification)**. Inventorie l'architecture, les nœuds n8n, les scripts SQL, les contrats API, les tests, les risques et les écarts avec le PRD. Porte une attention particulière au passage `Fusionner état conversation` → `Gérer collecte progressive` → `Sauvegarder état conversation` → `Valider paramètres disponibilité`, à la réapparition d'un ancien token et à la sélection de créneaux CREATE/RESCHEDULE. N'invente aucun schéma SQL ni endpoint. Produis `docs/audit-existing.md`, `docs/architecture-as-is.md` et un plan d'implémentation priorisé avec critères de validation. **N'effectue aucune migration, suppression, réécriture de workflow ou modification de code avant ma validation de l'audit.**

## 19. Questions ouvertes à résoudre durant l'audit

- Quel est le DDL exact des tables `services`, `sites`, `creneaux`, rendez-vous et `ai_conversation_state` ?
- Quels sont les noms et contrats réels des workflows `01` à `10` et leur état d'activation ?
- Le nœud `Sauvegarder état conversation` retourne-t-il l'ancienne ligne ou une ligne après `UPSERT` ?
- Quelles expressions utilisent les nœuds en aval : `$json`, référence à un autre nœud, ou ancienne mémoire ?
- Quels champs SQL sont conservés avec `COALESCE` lorsque le nouveau champ est `null` ?
- Quelles règles d'autorisation existent pour les webhooks de gestion des rendez-vous ?
- Comment sont générés, stockés, transmis et invalidés les tokens ?
- Quelle politique d'expiration et de purge s'applique aux conversations et rendez-vous ?
- Comment les tâches email gèrent-elles les doublons et les échecs ?
- Quels jeux de données et scripts d'initialisation existent déjà ?

---

**Fin du PRD.** Ce document est un cahier des charges de reprise fondé sur les comportements observés et sur des exigences cibles. Toute divergence avec les artefacts réels doit être documentée et arbitrée avant implémentation.
