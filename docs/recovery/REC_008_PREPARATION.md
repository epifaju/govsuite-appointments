# REC-008 — Préparation de la confirmation explicite

Étude seulement. Le workflow 10 n'a pas été modifié, activé, ni appelé. Aucune écriture PostgreSQL, aucun appel HTTP de création et aucun courriel n'ont été faits. REC-008 n'est pas commencé.

## 1. Source étudiée

L'instance n8n porte le workflow `10_AI_ConsularAssistant_Complete`, identifiant `R7TKt5mqZYpeKapl`. Il est inactif et contient 84 nœuds. Les noms lus dans `workflow_entity` sont ceux de l'export `n8n/live-exports/2026-10-29-rec007/R7TKt5mqZYpeKapl.json`, qui contient aussi 84 nœuds.

Le fichier historique `n8n/workflows/10_AI_ConsularAssistant_Complete.json` contient 33 nœuds. Il ne doit jamais être importé à la place de la version à 84 nœuds. Un import remplacerait la mémoire, les confirmations d'annulation et de replanification, et la collecte déjà présentes dans l'instance.

## 2. Parcours actuel de création

Le message entre par `Lorsqu'un message de chat est reçu`, puis `Charger état conversation`, `Comprendre la demande`, `Parser intention`, `Fusionner état conversation`, `Gérer collecte progressive`, `Sauvegarder état conversation` et `Router intention`. La sortie `CREATE_APPOINTMENT` va vers `Valider paramètres création`, puis `Création prête ?`.

La collecte, dans `Gérer collecte progressive`, enchaîne :

1. service, site et période : `ASK_CREATE_SERVICE`, `ASK_CREATE_SITE`, `ASK_CREATE_DATE_RANGE` ;
2. recherche : `READY_CREATE_SEARCH`, qui route l'intention vers la disponibilité tant qu'aucun créneau n'est choisi ;
3. choix d'un créneau mémorisé, par numéro ou UUID ;
4. `ASK_NOM`, `ASK_PRENOM`, `ASK_EMAIL`, `ASK_TELEPHONE` ;
5. dès que le téléphone est valide, `READY_CREATE`.

`Valider paramètres création` pose `ready` à vrai seulement pour `READY_CREATE` avec un UUID de créneau, un nom, un prénom, une adresse et un téléphone d'au moins 8 chiffres. La branche vraie de `Création prête ?` appelle `Appeler CreateAppointment` dans le même tour. La branche fausse appelle `Demander paramètres création`.

Le corps actuel est `slotId`, `nom`, `prenom`, `email`, `telephone`. Il ne contient ni `cleIdempotence`, ni `numeroDocument`, ni `langue`. L'URL interne est `http://localhost:5678/webhook/appointments`.

`Préparer réponse création` construit le texte de succès et y recopie la référence et le jeton. `Finaliser état création` efface la collecte, enregistre la référence et le jeton, et repousse `expires_at` de deux heures. `Restaurer réponse création` rend le texte préparé.

Il n'existe pas d'étape `AWAIT_CREATE_CONFIRMATION`. Le texte « Votre rendez-vous peut maintenant être créé », dans `Demander paramètres création`, n'est pas une question : cette branche n'est atteinte que lorsque `ready` est faux. Dès que les champs sont complets, le webhook est appelé avant toute réponse « oui ».

## 3. Objectif de REC-008

Le chatbot doit :

1. collecter le créneau et l'identité ;
2. présenter un récapitulatif issu du créneau réellement mémorisé ;
3. attendre une confirmation explicite ;
4. appeler le workflow 03 seulement après cette confirmation ;
5. utiliser une clé d'idempotence stable pour cette tentative confirmée ;
6. traiter le replay et les erreurs sans créer un second rendez-vous ;
7. laisser expirer ou annuler la demande tant qu'elle n'est pas confirmée.

Le workflow 03 publié en REC-007 reste le seul créateur. REC-008 ne change pas sa fonction SQL.

## 4. Machine à états proposée

Après un téléphone valide, `Gérer collecte progressive` et `Valider paramètres création` posent `AWAIT_CREATE_CONFIRMATION` au lieu de `READY_CREATE`. `ready` reste faux. `Création prête ?` ne peut donc pas appeler le webhook.

Le message de cette étape affiche le service, le site, la date et l'heure du créneau choisi dans `availableSlots`, ainsi que le nom, le prénom, l'adresse et le téléphone. Il demande une réponse oui ou non.

Seule une réponse affirmative, reçue pendant que `conversation_step` vaut déjà `AWAIT_CREATE_CONFIRMATION`, passe à `READY_CREATE` et autorise `ready`. Le tour du « oui » ne relit pas le message comme un nouveau nom, un nouveau créneau ou une nouvelle création.

Une réponse négative efface la demande en attente et n'appelle pas `Appeler CreateAppointment`. Toute autre réponse redemande oui ou non et conserve le récapitulatif.

`conversation_step` est un `varchar(50)`. `AWAIT_CREATE_CONFIRMATION` y tient.

## 5. Nœuds concernés

À modifier seulement dans une phase ultérieure autorisée :

| Nœud | Rôle dans la confirmation |
|---|---|
| `Fusionner état conversation` | Aujourd'hui, un message qui contient « annuler » devient `CANCEL_APPOINTMENT` avant la collecte. Pendant l'attente, « non » et « annuler » doivent abandonner la création en cours, sans ouvrir l'annulation d'un rendez-vous déjà pris. |
| `Gérer collecte progressive` | Introduire l'attente et n'en sortir que par une réponse explicite. |
| `Sauvegarder état conversation` | Persister l'étape et, quand le support existera, la clé de la tentative. |
| `Router intention` | La sortie `CREATE_APPOINTMENT` reste l'entrée du parcours. |
| `Valider paramètres création` | `ready` vrai uniquement après confirmation. |
| `Création prête ?` | La branche vraie reste le seul accès au webhook. |
| `Demander paramètres création` | Afficher le récapitulatif pendant l'attente. |
| `Appeler CreateAppointment` | Ajouter `cleIdempotence` au corps. `numeroDocument` et `langue` peuvent rester vides : le workflow 03 les convertit en `NULL`. |
| `Préparer réponse création` | Distinguer création, replay et erreurs. |
| `Finaliser état création` | Effacer la demande après un 201 ou un 200 de replay. |
| `Restaurer réponse création` | Conserver le texte décidé avant l'écriture d'état. |

Modèles déjà présents pour l'annulation et la replanification, à ne pas recopier tels quels : `Préparer confirmation annulation`, `Mémoriser confirmation annulation`, `Analyser confirmation annulation`, `Confirmation annulation ?`, `Confirmation reconnue ?`, `Redemander confirmation annulation`, `Préparer réponse abandon annulation`, `Finaliser abandon annulation`, et la famille équivalente de replanification. Leurs motifs positifs contiennent « annule » et « annuler », ce qui serait une confirmation de création incorrecte.

L'adresse reste obligatoire dans le chatbot actuel. Le workflow 03 accepte une adresse vide depuis la phase 7C. Rendre l'adresse facultative dans le chatbot est une décision séparée.

## 6. Clé stable

La clé est créée au moment où le récapitulatif est figé, puis réutilisée pour chaque envoi de cette même tentative. Elle respecte `^[A-Za-z0-9._~-]{16,128}$` et n'est pas montrée à l'usager.

Elle doit être déterministe pour le couple session et contenu confirmé : créneau, nom, prénom, adresse, téléphone, document et langue. Un second « oui », ou un nouvel envoi après une réponse perdue, reprend donc la même clé et le même corps. Le workflow 03 répond alors `REPLAYED`, HTTP 200, sans second rendez-vous.

Un changement de créneau ou d'identité avant le « oui » produit un nouveau récapitulatif et une autre clé. Aucun webhook n'a encore été appelé. Après un 201 ou un 200, `Finaliser état création` efface la collecte : un nouveau « oui » ne réutilise pas l'ancienne demande.

`ai_conversation_state` n'a pas de colonne pour cette clé. `Sauvegarder état conversation` ne conserve que les colonnes déjà prévues. La persistance de la clé, ou de quoi la recalculer, demande une décision de schéma dans une phase ultérieure. La clé brute ne doit pas être écrite dans le texte rendu à l'usager. Le jeton renvoyé par le 201 ou le 200 reste celui que le chatbot affiche déjà après création ; REC-008 ne change pas ce contrat local.

## 7. Replay et erreurs

`Appeler CreateAppointment` devra classer la réponse avant `Finaliser état création`.

| Réponse du workflow 03 | Comportement du chatbot |
|---|---|
| HTTP 201 | Annoncer le rendez-vous, puis effacer la demande. |
| HTTP 200, `replayed: true` | Annoncer le même rendez-vous, sans nouvel appel avec une autre clé. |
| HTTP 409, `IDEMPOTENCY_KEY_CONFLICT` | Ne pas créer une autre ligne. Dire que cette tentative ne correspond plus au contenu confirmé. |
| HTTP 409, créneau indisponible | Ne pas réutiliser une autre clé sur le même corps. Ramener l'usager au choix d'un créneau. |
| HTTP 400 | Redemander le champ refusé. Ne pas appeler une seconde fois avec la même demande invalide. |
| HTTP 500, corps vide ou réponse illisible | Ne pas renvoyer un POST avec une nouvelle clé. Relire l'état, puis rejouer la même clé et le même corps seulement si un nouvel essai est explicitement autorisé. |

Le workflow 08 reste inactif. Une notification `A_ENVOYER` n'est pas un courriel envoyé.

## 8. Expiration et annulation

`Charger état conversation` ignore une session dont `expires_at` est passé. Chaque sauvegarde repousse cette échéance de deux heures. Une demande encore en `AWAIT_CREATE_CONFIRMATION` disparaît donc avec la session, sans appel au webhook et sans rendez-vous.

Une réponse négative doit vider `pending_action`, `conversation_step` et les champs de la collecte, sur le modèle de `Finaliser abandon annulation`, sans passer par `Appeler CreateAppointment`.

Si le webhook a déjà répondu 201 ou 200, l'expiration de la session ne supprime pas le rendez-vous. Elle retire seulement l'état conversationnel, comme aujourd'hui après `Finaliser état création`.

## 9. Hors de cette préparation

Cette étude ne prépare pas l'activation du workflow 10, l'import du fichier à 33 nœuds, une migration, un nouveau nœud dans l'instance, ni un essai conversationnel. Le workflow 03, le workflow 08 et les 48 sessions restent tels qu'à la clôture de REC-007.

REC-008 attend une autorisation distincte avant toute modification.
