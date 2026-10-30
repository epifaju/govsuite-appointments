# REC-008 — Phase 8A — Conception de la confirmation explicite

Conception seulement. Aucun workflow n'a été modifié ni activé. Aucune écriture PostgreSQL, aucune migration et aucun `POST` de création n'ont été exécutés. Le fichier `n8n/workflows/10_AI_ConsularAssistant_Complete.json`, 33 nœuds, n'a pas été importé.

## 1. État lu

Lecture du 30 octobre 2026.

| Contrôle | Résultat |
|---|---|
| Workflow 10 `R7TKt5mqZYpeKapl` | `10_AI_ConsularAssistant_Complete`, inactif, 84 nœuds |
| Workflow 03 `SXCesRUmGrV5FMzm` | `03_API_CreateAppointment`, actif, 12 nœuds, `2d72700c-d731-47e1-b6d6-82c5c684f055` |
| Workflow 08 `ZbZoj4yF1s5a3B5E` | `08_JOB_SendConfirmationEmails`, inactif, 5 nœuds |
| Rendez-vous, notifications, historiques, sessions | 13, 14, 12, 48 |
| Clés d'idempotence | 0 |
| Empreinte | `a2dea067599fd4f0a5f857551adc67cc` |
| Table `ai_appointment_attempt` | Absente |

L'export `n8n/live-exports/2026-10-29-rec007/R7TKt5mqZYpeKapl.json` porte les mêmes 84 noms. L'URL du nœud `Appeler CreateAppointment` a été relue dans `workflow_entity` : `POST http://localhost:5678/webhook/appointments`.

Depuis le conteneur `govsuite-n8n`, `http://localhost:5678/healthz` répond 200. `http://127.0.0.1:5680/healthz` n'est pas joignable. Le port 5680 est celui de l'hôte Windows. `WEBHOOK_URL` vaut `http://localhost:5680` pour le navigateur. Le nœud HTTP doit conserver `http://localhost:5678`, qui est le processus n8n dans le conteneur. Aucun appel n'a été envoyé sur `/webhook/appointments`.

## 2. Constat

Dès que le créneau, le nom, le prénom, l'adresse et le téléphone sont remplis, `Gérer collecte progressive` pose `READY_CREATE`. `Valider paramètres création` met `ready` à vrai. `Création prête ?` appelle le webhook dans le même tour.

Un message qui n'est pas « oui » suit le même chemin si les champs sont déjà complets. « Non » créerait donc un rendez-vous. « Annuler » est intercepté plus tôt par `Parser intention` et `Fusionner état conversation`, qui ouvrent `CANCEL_APPOINTMENT` et effacent la collecte.

Le corps envoyé ne contient pas `cleIdempotence`. `Sauvegarder état conversation` ne conserve pas le JSON complet : il n'écrit que les colonnes existantes. Une clé ajoutée au seul objet n8n disparaîtrait au tour suivant.

## 3. Décision de persistance

Deux supports ont été comparés.

| Critère | A. Colonnes sur `ai_conversation_state` | B. Table `ai_appointment_attempt` |
|---|---|---|
| Identité de tentative | Une seule valeur par session | Une ligne par tentative, UUID aléatoire |
| Corps figé | Écrasé par la collecte ou par `Finaliser état création` | Conservé dans la ligne, indépendant du tour |
| Tentatives distinctes au contenu identique | La seconde remplace la première | Deux lignes, deux clés, deux rendez-vous possibles |
| Résultat HTTP incertain | Disparaît si la session est expirée ou finalisée | Reste lisible par `session_id` |
| Course entre deux messages | Le verrou de session mélange conversation et tentative | Verrou de la ligne de tentative, index unique partiel |
| Données personnelles | Restent dans la session déjà conservée deux heures | Effaçables sans effacer le fil de conversation |
| Migration | `ALTER TABLE` additif | `CREATE TABLE` neuf, aucune colonne actuelle touchée |

La solution B est retenue. La solution A suffirait pour une seule tentative écrasée à chaque récapitulatif, mais elle ne sépare pas un résultat incertain de l'expiration de session, et `Finaliser état création` remet déjà les champs de collecte à nul.

La table n'est pas créée dans cette phase. Le schéma proposé :

| Colonne | Type | Rôle |
|---|---|---|
| `id` | `uuid` primaire, `gen_random_uuid()` | Identité de tentative, créée une fois |
| `session_id` | `varchar(255)` | Session du chat, sans clé étrangère obligatoire au départ |
| `cle_idempotence` | `varchar(128)` | Clé brute envoyée au workflow 03, nulle après clôture |
| `empreinte_corps` | `char(64)` | SHA-256 hexadécimal du corps canonique |
| `corps` | `jsonb` | Corps exact à renvoyer, clés dans l'ordre du contrat |
| `statut` | `varchar(32)` | Cycle de vie ci-dessous |
| `rendez_vous_id` | `uuid` nullable | Renseigné après 201 ou 200 |
| `reference` | `varchar(40)` nullable | Référence affichable |
| `created_at` | `timestamptz` | Création de la tentative |
| `expires_at` | `timestamptz` | Échéance de l'attente |
| `updated_at` | `timestamptz` | Dernière transition |

Statuts de tentative : `AWAITING_CONFIRMATION`, `SUBMITTING`, `UNCERTAIN`, `CONFIRMED`, `ABANDONED`, `REJECTED`, `SLOT_UNAVAILABLE`, `EXPIRED`.

Index unique partiel sur `session_id` pour les statuts `AWAITING_CONFIRMATION`, `SUBMITTING` et `UNCERTAIN`. Une session n'a donc qu'une tentative ouverte. Les tentatives terminées ne bloquent pas la suivante.

La clé est tirée une fois à la création de la ligne : préfixe `rec008-` puis 32 octets hexadécimaux. Elle respecte `^[A-Za-z0-9._~-]{16,128}$`. Elle n'est pas recalculée à partir du nom ou du créneau. Deux tentatives au même contenu reçoivent deux UUID et deux clés. Le workflow 03 peut alors créer deux rendez-vous. Ce n'est pas un replay. Le replay concerne uniquement la même ligne.

Le corps est figé au moment du récapitulatif, avec les chaînes exactes qui seront envoyées :

| Champ | Valeur figée |
|---|---|
| `slotId` | UUID canonique en minuscules, pris dans `availableSlots` |
| `nom`, `prenom` | `trim` puis NFC |
| `email` | `trim` ; le chatbot continue d'exiger une adresse avant le récapitulatif |
| `telephone` | Forme déjà normalisée par la collecte |
| `numeroDocument` | Chaîne vide |
| `langue` | `fr` |
| `cleIdempotence` | Clé de la ligne |

L'en-tête `Idempotency-Key` n'est pas envoyé. Le validateur du workflow 03 refuse une divergence entre l'en-tête et le corps. Le corps seul évite ce 400.

`SUBMITTING` est posé par `UPDATE ... WHERE statut = 'AWAITING_CONFIRMATION'` avant l'appel HTTP. Zéro ligne mise à jour signifie qu'une autre exécution possède déjà la tentative : aucun second `POST`. Après l'appel, le statut devient `CONFIRMED`, `REJECTED`, `SLOT_UNAVAILABLE` ou `UNCERTAIN`. Un 201 et un 200 `replayed` aboutissent tous deux à `CONFIRMED` avec le même `rendez_vous_id`.

Une tentative `AWAITING_CONFIRMATION` dont `expires_at` est dépassé passe à `EXPIRED` sans HTTP. Une tentative `SUBMITTING` ou `UNCERTAIN` n'est pas transformée en nouvelle création à l'expiration : le prochain message de la même session rejoue le corps figé et la même clé.

À la clôture `CONFIRMED`, `ABANDONED`, `REJECTED`, `SLOT_UNAVAILABLE` ou `EXPIRED`, `cle_idempotence` et les champs personnels du `corps` sont remis à nul. `id`, `session_id`, `statut`, `empreinte_corps`, `rendez_vous_id` et `reference` peuvent rester jusqu'à une purge ultérieure. Aucune purge n'est branchée sur le workflow 08. Le jeton de gestion n'est pas copié dans cette table : le replay du workflow 03 le rend à nouveau, et `Finaliser état création` le range déjà dans `ai_conversation_state.token`.

`expires_at` de l'attente est `created_at + 2 hours`, comme la session. La session et la tentative sont deux échéances. L'expiration de `ai_conversation_state` n'efface pas une ligne `UNCERTAIN`.

## 4. Intégration HTTP

Le contrat d'appel, sans exécution :

`POST http://localhost:5678/webhook/appointments`

`Content-Type: application/json`

Le corps est celui de la colonne `corps`, pas une reconstruction depuis `$json`.

| Réponse du workflow 03 | Suite |
|---|---|
| 201, `success: true`, objet `appointment` | `CONFIRMED`, afficher la référence, effacer la collecte |
| 200, `created: false`, `replayed: true`, même identifiant | `CONFIRMED`, même affichage, aucun autre appel |
| 400, `VALIDATION_ERROR` | `REJECTED`, montrer le champ refusé, ne pas rappeler le même corps |
| 409, `error.code = IDEMPOTENCY_KEY_CONFLICT` | `REJECTED`, ne pas tirer une nouvelle clé pour ce corps |
| 409, message `Créneau introuvable ou complet` | `SLOT_UNAVAILABLE`, retour au choix d'un créneau, nouvelle tentative seulement après un nouveau choix |
| 500, corps vide, JSON illisible ou délai dépassé | `UNCERTAIN`, ne pas rappeler dans la même exécution |

Le nœud actuel n'a ni délai, ni conservation du code HTTP : un 4xx ou un 5xx interrompt l'exécution avant `Préparer réponse création`. La phase d'implémentation devra demander la réponse complète et un délai fini, puis classer le statut. Un délai ou une réponse illisible suit la règle déjà retenue en REC-007 : pas de second `POST` automatique.

Le workflow 03 et la fonction `public.creer_rendez_vous_idempotent` ne sont pas à modifier.

## 5. Machine à états et nœuds

Le détail des transitions est dans `docs/recovery/REC_008_STATE_MACHINE.md`. L'audit nœud par nœud est en section 8. La règle principale : `ready` n'est vrai que si, dans ce tour, le message est une confirmation affirmative explicite, l'étape persistée est `AWAIT_CREATE_CONFIRMATION`, et l'`UPDATE` de la tentative a fait passer exactement une ligne de `AWAITING_CONFIRMATION` à `SUBMITTING`.

Les étapes de conversation ajoutées tiennent dans `varchar(50)` : `AWAIT_CREATE_CONFIRMATION`, `CREATE_IN_PROGRESS`, `CREATE_UNCERTAIN`. `READY_CREATE` reste un drapeau de tour, pas une étape relue au message suivant.

## 6. Tests

La matrice est dans `docs/recovery/REC_008_TEST_MATRIX.md`. Trois familles :

- statiques, sans exécution n8n ni SQL d'écriture ;
- SQL dans une transaction annulée, sur la future table seulement ;
- conversationnels, après une autorisation distincte, le workflow 10 étant aujourd'hui inactif.

Aucun de ces tests n'est lancé dans cette phase.

## 7. Plan d'implémentation

Chaque phase s'arrête au premier écart. Le préflight commun relit les trois workflows, les compteurs 13, 14, 12 et 48, l'empreinte `a2dea067599fd4f0a5f857551adc67cc`, l'absence de clé, et le fait que le workflow 10 a toujours 84 nœuds.

| Phase | Contenu | Sauvegarde | Vérification | Rollback |
|---|---|---|---|---|
| 8A | Cette conception | Aucune | Lecture seule déjà faite | Aucun |
| 8B | Créer seulement `ai_appointment_attempt`, ses statuts et l'index partiel | Dump horodaté avant le SQL, empreinte SHA-256 | Table présente, 48 sessions inchangées, empreinte des rendez-vous inchangée | `DROP TABLE` seulement si la table ne contient aucune ligne à conserver |
| 8C | Préparer le diff du workflow 10, sans le publier | Copie du JSON actif à 84 nœuds | Contrôles statiques de la matrice | Supprimer le fichier préparé |
| 8D | Appliquer ce diff au workflow inactif | Nouvel export 84 nœuds, distinct du fichier à 33 nœuds | 84 nœuds ou plus, workflow toujours inactif, workflow 03 inchangé | Réinjecter l'export de sauvegarde, jamais le fichier à 33 nœuds |
| 8E | Essais SQL de la table, `BEGIN` puis `ROLLBACK` | Aucune si la transaction est annulée | Empreinte et compteurs identiques sur une nouvelle connexion | Le `ROLLBACK` est le résultat attendu |
| 8F | Essais conversationnels | Export immédiatement avant | Matrice conversationnelle, puis retour des compteurs | Désactivation et restauration de l'export 8D seulement sur anomalie |

La phase 8F est la seule qui demanderait d'activer le workflow 10. Elle ne fait pas partie de l'autorisation de conception. Le workflow 08 reste inactif dans toutes les phases. Aucune phase ne modifie le workflow 03.

## 8. Audit des nœuds

Les connexions actuelles du parcours sont : `Charger état conversation` → `Comprendre la demande` → `Parser intention` → `Fusionner état conversation` → `Gérer collecte progressive` → `Sauvegarder état conversation` → `Router intention`. La sortie `CREATE_APPOINTMENT` va à `Valider paramètres création` → `Création prête ?`. Vrai appelle `Appeler CreateAppointment` → `Préparer réponse création` → `Finaliser état création` → `Restaurer réponse création`. Faux appelle `Demander paramètres création`.

### `Charger état conversation`

Entrée : `sessionId` du déclencheur. Sortie : la ligne `ai_conversation_state` si `expires_at` est nul ou futur, sinon un item vide grâce à `alwaysOutputData`. Dépend de l'index de session et du délai de deux heures. Risque : une session expirée masque une tentative `UNCERTAIN` si le chargement ne consulte pas la future table.

### `Comprendre la demande`

Entrée : `chatInput`. Sortie : texte du modèle `qwen2.5:1.5b`, température 0, censé être un JSON d'intention. Dépend d'Ollama. Risque : un « oui » peut être classé `GENERAL` ou `CREATE_APPOINTMENT`. Le classement du modèle ne doit pas suffire à créer.

### `Parser intention`

Entrée : texte du modèle, message brut, étape précédente. Sortie : `intent`, champs extraits, `sessionId`, `originalMessage`. Il force `CANCEL_APPOINTMENT` dès que le message contient « annuler », sauf si un token de consultation, d'annulation ou de replanification est déjà attendu. Il ne connaît pas `AWAIT_CREATE_CONFIRMATION`. Risque : « annuler » pendant le récapitulatif quitte la création et demande un jeton d'annulation. Risque inverse : « non » n'est pas reconnu et retombe dans la collecte complète.

### `Fusionner état conversation`

Entrée : parser et ligne chargée. Sortie : champs fusionnés et `memoryDebug`. Une nouvelle intention métier efface l'ancienne collecte. « Oui » ne contient pas les motifs de redémarrage, donc la collecte continue. Risque : le même comportement laisse passer « non », « peut-être » et un message répété jusqu'à `READY_CREATE`. Risque de régression : traiter toute la création comme un redémarrage casserait la collecte multi-tours.

### `Gérer collecte progressive`

Entrée : fusion. Sortie : `conversationStep`, `pendingAction`, `stateReady.createAppointment`. Sans créneau, les étapes restent `ASK_CREATE_SERVICE`, `ASK_CREATE_SITE`, `ASK_CREATE_DATE_RANGE` puis `READY_CREATE_SEARCH`. Avec créneau, l'ordre est nom, prénom, adresse, téléphone, puis `READY_CREATE`. Le créneau vient d'un UUID ou de l'index dans `availableSlots`. Risque : le dernier `else` ne distingue pas le récapitulatif d'une confirmation. Risque de régression : bloquer `READY_CREATE_SEARCH` empêcherait la recherche de créneaux.

### `Sauvegarder état conversation`

Entrée : `JSON.stringify($json)`. Sortie : colonnes de session, `expires_at` repoussé de deux heures, verrou `FOR UPDATE` de la session. Les champs inconnus du JSON ne sont pas insérés. Risque : y placer la clé sans colonne ou sans table ne la persiste pas. Risque de régression : élargir l'`INSERT` sans défaut compatible peut échouer pour l'annulation et la replanification, qui passent par le même nœud.

### `Router intention`

Entrée : `intent`. Sorties, dans l'ordre : `GET_SERVICES`, `GET_AVAILABILITY`, `CREATE_APPOINTMENT`, `GET_APPOINTMENT`, `CANCEL_APPOINTMENT`, `RESCHEDULE_APPOINTMENT`, `GENERAL`, puis le repli vers `Réponse générale`. Risque : déplacer la sortie création change tous les branchements. La conception ne change pas cet ordre. `READY_CREATE_SEARCH` doit continuer de router vers la disponibilité.

### `Valider paramètres création`

Entrée : item routé. Sortie : `ready`, `missing`, téléphone normalisé. `ready` exige l'UUID, le nom, le prénom, l'adresse, le téléphone et `conversationStep === 'READY_CREATE'`. L'adresse vide est refusée ici, alors que le workflow 03 l'accepte. Risque : laisser `READY_CREATE` après un simple remplissage du téléphone. Risque de régression : rendre l'adresse facultative changerait le parcours actuel et n'est pas demandé.

### `Création prête ?`

Entrée : booléen `ready`, comparaison stricte. Vrai vers l'appel HTTP, faux vers la question. Risque : une chaîne `"true"` ne passe pas, mais un booléen posé trop tôt passe. C'est la seule porte vers le webhook. Elle doit le rester.

### `Demander paramètres création`

Entrée : étape de conversation. Sortie : `type: create_appointment_question` et un texte. Le cas `READY_CREATE` dit que le rendez-vous peut être créé, mais ce cas n'est affiché que si `ready` est faux. Risque : ce texte peut être lu comme une confirmation alors qu'il n'en est pas une. Le récapitulatif futur doit occuper le cas `AWAIT_CREATE_CONFIRMATION` et citer le créneau mémorisé.

### `Appeler CreateAppointment`

Entrée : champs courants. Sortie : corps HTTP brut en cas de succès. URL interne confirmée. Aucune option de délai ni de réponse complète. Le corps omet la clé, le document et la langue. Risque : reconstruire le corps après le « oui » à partir du message courant peut changer le nom et provoquer `IDEMPOTENCY_KEY_CONFLICT`. Risque de régression : pointer l'URL vers le port 5680 rend l'appel injoignable depuis le conteneur.

### `Préparer réponse création`

Entrée : réponse supposée réussie, plus le nom et le prénom lus dans `Sauvegarder état conversation`. Sortie : texte de succès, référence et jeton. Risque : un 200 de replay n'est pas distingué, et un 409 n'atteint pas ce nœud aujourd'hui. Risque de régression : lire le jeton depuis la tentative alors que la conception interdit de l'y stocker.

### `Finaliser état création`

Entrée : `sessionId`, référence et jeton de l'appel. Sortie : session vidée de la collecte, référence et jeton conservés, expiration repoussée. Risque : exécuter cet `UPDATE` après un 409 ou un 500 efface le moyen de rejouer. Il ne doit suivre que `CONFIRMED`. Risque de régression : le même style d'`UPDATE` existe pour l'annulation ; le nouveau statut de création ne doit pas être écrit par ces autres nœuds.

### `Restaurer réponse création`

Entrée : ligne SQL finale. Sortie : copie de `Préparer réponse création`. Risque : si la préparation est déplacée après la finalisation, le texte de succès est perdu, comme pour les autres nœuds « restaurer ». L'ordre préparation, écriture, restauration doit rester.

## 9. Régressions à préserver

Les confirmations d'annulation et de replanification ont leurs propres étapes : `ASK_CANCEL_CONFIRMATION` et `ASK_RESCHEDULE_CONFIRMATION`. Leurs analyseurs acceptent « annuler » comme réponse positive. Ces listes ne doivent pas servir à la création. Leurs nœuds ne sont pas dans le diff prévu.

La recherche de créneaux, la consultation par jeton et la sauvegarde partagée de session doivent continuer de fonctionner pour les 48 sessions existantes. Les nouvelles colonnes ne sont pas ajoutées à `ai_conversation_state`. Les sessions actuelles n'ont donc aucune valeur à migrer.

## 10. Verdict

**GO** pour une phase 8B limitée à la création de `ai_appointment_attempt`, sur autorisation séparée, avec dump préalable et sans publication n8n.

**NO-GO** pour modifier le workflow 10, l'activer, exécuter la migration maintenant, ou lancer un essai conversationnel.

Cette phase s'arrête ici.
