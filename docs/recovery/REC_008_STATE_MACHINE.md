# REC-008 — Machine à états de la confirmation

Ce document fixe les transitions. Il ne modifie aucun workflow. `ready` n'est calculé qu'en mémoire, pour le tour courant. L'étape persistée dans `ai_conversation_state.conversation_step` et le statut persisté dans `ai_appointment_attempt` sont deux valeurs distinctes.

## 1. États

| État demandé | Étape de conversation | Statut de tentative |
|---|---|---|
| Collecte | `ASK_CREATE_SERVICE`, `ASK_CREATE_SITE`, `ASK_CREATE_DATE_RANGE`, `READY_CREATE_SEARCH`, `ASK_CREATE_SLOT`, `ASK_NOM`, `ASK_PRENOM`, `ASK_EMAIL`, `ASK_TELEPHONE` | Aucune ligne |
| `AWAIT_CREATE_CONFIRMATION` | `AWAIT_CREATE_CONFIRMATION` | `AWAITING_CONFIRMATION` |
| `READY_CREATE` | Non persisté. Drapeau `ready` du tour qui a gagné la transition | `SUBMITTING` juste avant le HTTP |
| Création en cours ou résultat incertain | `CREATE_IN_PROGRESS`, puis `CREATE_UNCERTAIN` si la réponse manque | `SUBMITTING`, puis `UNCERTAIN` |
| Création confirmée | Collecte effacée, référence et jeton de session conservés | `CONFIRMED` |
| Création refusée ou abandonnée | Collecte effacée, ou retour à un champ précis | `REJECTED` ou `ABANDONED` |
| Créneau indisponible | Retour à `ASK_CREATE_SLOT` | `SLOT_UNAVAILABLE` |
| Demande expirée | Session absente au chargement, ou étape vidée | `EXPIRED` pour une attente ; `UNCERTAIN` conservé s'il y a eu appel |

`READY_CREATE_SEARCH` continue d'envoyer l'intention `GET_AVAILABILITY`. Ce n'est pas une création.

## 2. Messages reconnus

La comparaison se fait sur le message entier, après `trim`, passage en minuscules et suppression des accents. Une sous-chaîne ne suffit pas. La création n'est autorisée que si le message est dans la liste affirmative, et dans aucune des deux autres, et seulement depuis `AWAIT_CREATE_CONFIRMATION`.

| Famille | Messages entiers |
|---|---|
| Affirmatif | `oui`, `oui je confirme`, `je confirme`, `confirmer`, `d'accord`, `daccord`, `ok`, `yes` |
| Négatif | `non`, `non merci`, `je ne confirme pas`, `annuler`, `annuler la demande`, `abandonner`, `stop` |
| Modification | `modifier`, `modifier le nom`, `modifier le prenom`, `modifier l'adresse`, `modifier le telephone`, `modifier le creneau`, `autre creneau` |

« Oui, je confirme. » est accepté après suppression de la ponctuation finale. « Oui mais change le nom » contient une demande de modification : ce n'est pas une confirmation. « Annuler » pendant l'attente n'ouvre pas `CANCEL_APPOINTMENT`.

## 3. Transitions

| État courant | Événement | État suivant | Appel HTTP |
|---|---|---|---|
| Collecte | Champ manquant | Même collecte, question du champ | Non |
| Collecte | Téléphone valide et créneau mémorisé | `AWAIT_CREATE_CONFIRMATION`, ligne créée une fois | Non |
| `AWAIT_CREATE_CONFIRMATION` | Affirmatif explicite, une ligne passée à `SUBMITTING` | `READY_CREATE` pour ce tour, puis résultat HTTP | Oui, corps figé |
| `AWAIT_CREATE_CONFIRMATION` | Affirmatif, mais l'`UPDATE` met à jour zéro ligne | Rester sur le résultat de l'autre exécution | Non |
| `AWAIT_CREATE_CONFIRMATION` | Négatif ou annuler | `ABANDONED`, collecte effacée | Non |
| `AWAIT_CREATE_CONFIRMATION` | Modification | `ABANDONED`, retour au champ demandé, les autres champs conservés | Non |
| `AWAIT_CREATE_CONFIRMATION` | Message ambigu ou répété | Même état, récapitulatif redemandé | Non |
| `AWAIT_CREATE_CONFIRMATION` | Session expirée | `EXPIRED` | Non |
| `SUBMITTING` | HTTP 201 | `CONFIRMED` | Déjà fait |
| `SUBMITTING` | HTTP 200 `replayed` | `CONFIRMED` | Déjà fait |
| `SUBMITTING` | HTTP 400 | `REJECTED` | Déjà fait |
| `SUBMITTING` | HTTP 409 conflit de clé | `REJECTED` | Déjà fait |
| `SUBMITTING` | HTTP 409 créneau indisponible | `SLOT_UNAVAILABLE`, puis choix d'un autre créneau | Déjà fait |
| `SUBMITTING` | HTTP 500, corps vide ou délai | `UNCERTAIN` | Pas de second appel dans ce tour |
| `CREATE_UNCERTAIN` | Nouveau message de la même session | Rejouer le corps figé et la même clé | Un replay, pas une nouvelle clé |
| `CREATE_UNCERTAIN` | Session de conversation expirée | La ligne `UNCERTAIN` reste | Le prochain message de cette session rejoue |
| `CONFIRMED` | Nouveau « oui » | Rappeler la référence déjà connue | Non, tant que la ligne est `CONFIRMED` |
| `ABANDONED`, `EXPIRED`, `REJECTED`, `SLOT_UNAVAILABLE` | Nouvelle collecte complète puis nouveau récapitulatif | Nouvelle ligne, nouvel UUID, nouvelle clé | Non avant le prochain oui |
| Annulation ou replanification en cours | Leurs propres confirmations | Inchangé | Leurs webhooks actuels, pas celui de création |

Aucun autre message, dans aucun autre état, ne met `ready` à vrai.

## 4. Ordre d'un tour affirmatif

1. `Charger état conversation` voit `AWAIT_CREATE_CONFIRMATION` et une ligne `AWAITING_CONFIRMATION` non expirée.
2. `Parser intention` et `Fusionner état conversation` gardent `CREATE_APPOINTMENT`. Ils n'appliquent pas la règle « annuler » ni le redémarrage de création.
3. `Gérer collecte progressive` ne reconstruit pas le corps. Il marque le tour comme confirmation candidate.
4. `Sauvegarder état conversation` écrit encore l'étape d'attente.
5. `Valider paramètres création` ne pose `ready` qu'après l'`UPDATE` gagnant.
6. Cet `UPDATE` verrouille la ligne et ne succède que pour `statut = 'AWAITING_CONFIRMATION'`.
7. `Appeler CreateAppointment` envoie `corps`, tel qu'il a été figé.
8. Le classement met à jour le statut.
9. `Finaliser état création` ne s'exécute que pour `CONFIRMED`.
10. `Restaurer réponse création` renvoie le texte déjà préparé.

Si l'exécution s'arrête entre les étapes 6 et 8, la ligne reste `SUBMITTING` ou passe à `UNCERTAIN` par la règle d'échec. Le message suivant ne crée pas une seconde tentative.

## 5. Figement et reprise

Le récapitulatif affiche le service, le site, la date et l'heure du créneau choisi dans `availableSlots`, puis le nom, le prénom, l'adresse et le téléphone. Le corps JSON correspondant est écrit dans la ligne avant l'affichage. Un message ultérieur ne modifie pas ce JSON.

Une modification abandonne la ligne sans HTTP, puis la collecte reprend au champ demandé. Le récapitulatif suivant insère une nouvelle ligne. Deux contenus identiques successifs ont deux clés. Deux « oui » sur la même ligne ont une seule clé : le second constate `CONFIRMED` ou `UNCERTAIN`.

Deux messages simultanés prennent le verrou de la ligne. Une seule exécution passe à `SUBMITTING`. L'autre n'appelle pas le webhook.

## 6. Expiration

`Charger état conversation` ignore une session dont `expires_at` est passé. Pour une tentative encore en attente, le même constat la passe à `EXPIRED` et efface la clé ainsi que les données personnelles du corps. Aucun rendez-vous n'a été demandé.

Pour `SUBMITTING` ou `UNCERTAIN`, l'échéance de conversation n'autorise pas une nouvelle création. Elle autorise uniquement le replay de la ligne existante. La clé brute reste disponible jusqu'à ce replay, puis elle est effacée avec les données personnelles quand le statut devient `CONFIRMED`.
