# REC-008 phase 8E-1 — Différence de nœuds

Comparaison entre la version live exportée et la copie hors ligne proposée. Aucun des deux fichiers n'a été importé.

| | Version live | Copie proposée |
| --- | --- | --- |
| Fichier | `n8n/live-exports/2026-10-30-rec008-phase8e1-before/R7TKt5mqZYpeKapl.json` | `n8n/proposed/2026-10-30-rec008-phase8e1-NON-PUBLIE/10_AI_ConsularAssistant_Complete.json` |
| Workflow | `R7TKt5mqZYpeKapl` | même identifiant, porté par la copie |
| Version | `88a1f42a-ab9e-4eff-bfd9-996c31976b16`, compteur 654 | identifiants de version conservés dans le JSON, `active` forcé à faux |
| Nœuds | 84 | 130 |
| Liens | 82 | 133 |
| SHA-256 | `ec2a16e04b5d75b6acb40fb408a557f97e7203b740e1e1867c26105c37ef42f9` | `15830fe472ff588de0ae50c1be2166082d5099285cb1dcb30da06bb523acc83b` |

Le fichier historique `n8n/workflows/10_AI_ConsularAssistant_Complete.json` (33 nœuds) n'est pas la source de ce diff et ne doit pas remplacer l'export à 84 nœuds.

## Nœuds d'origine conservés

Les 84 noms d'origine sont présents. Aucun nœud métier n'a été supprimé. Soixante-quatorze nœuds d'origine ont les mêmes paramètres et les mêmes liens.

## Nœuds d'origine modifiés

| Nœud | Changement |
| --- | --- |
| `Charger état conversation` | Le lien de sortie va vers `Lire tentative de session` au lieu de `Comprendre la demande`. La requête SQL est inchangée. |
| `Parser intention` | Ajout d'une décision de confirmation, lue seulement quand une tentative ouverte existe ou que l'étape est `AWAIT_CREATE_CONFIRMATION`. `annuler` dans cet état reste une création à abandonner et n'ouvre pas `CANCEL_APPOINTMENT`. Les branches `ASK_TOKEN` d'annulation, de replanification et de consultation restent devant cette règle. |
| `Fusionner état conversation` | La lecture de l'état passe par `Joindre tentative de session`. Un verrou empêche un redémarrage explicite pendant `AWAIT_CREATE_CONFIRMATION`, `CREATE_IN_PROGRESS`, `CREATE_UNCERTAIN` et pendant une tentative `AWAITING_CONFIRMATION`, `SUBMITTING` ou `UNCERTAIN`. Une tentative `CONFIRMED` ne bloque pas une nouvelle collecte volontaire. |
| `Gérer collecte progressive` | La fin de collecte ne pose plus `READY_CREATE`. Elle pose `AWAIT_CREATE_CONFIRMATION` et `createDecision = INSERT` une seule fois, quand l'étape précédente n'était pas déjà l'attente. Une décision de confirmation, de refus, de modification, de reprise ou de rappel bloque la progression du brouillon. `READY_CREATE_SEARCH` continue de mener à la disponibilité. |
| `Valider paramètres création` | `ready` n'est vrai que si `claimAcquired` est vrai. Un brouillon complet ne suffit plus. |
| `Demander paramètres création` | Les étapes `AWAIT_CREATE_CONFIRMATION`, `CREATE_RECALL` et `CREATE_UNCERTAIN` redemandent une confirmation ou une reprise. Elles n'annoncent pas un envoi. |
| `Router intention` | Seule la sortie `CREATE_APPOINTMENT` change de cible. L'ordre des sorties est inchangé. |
| `Création prête ?` | La sortie vraie va vers `Refus création sans réclamation`. La sortie fausse va toujours vers `Demander paramètres création`. |
| `Appeler CreateAppointment` | Corps brut figé, délai 20 secondes, réponse complète, erreur HTTP conservée sur la sortie principale, délai ou erreur réseau sur la seconde sortie. L'adresse reste `http://localhost:5678/webhook/appointments`. |
| `Finaliser état création` | La requête SQL est inchangée. Les trois paramètres lisent désormais la référence et le jeton depuis `Paramètres clôture confirmation`, parce que la réponse HTTP complète ne place plus `appointment` à la racine. Le jeton reste enregistré dans l'état de conversation, pas dans `ai_appointment_attempt`. |

`Préparer réponse création`, `Restaurer réponse création` et `Sauvegarder état conversation` sont inchangés. Le message citoyen confirmé continue d'afficher le jeton de gestion.

## Sorties du routeur

| Index | Sortie | Live | Proposé |
| --- | --- | --- | --- |
| 0 | `GET_SERVICES` | `Appeler GetServices` | inchangé |
| 1 | `GET_AVAILABILITY` | `Valider paramètres disponibilité` | inchangé |
| 2 | `CREATE_APPOINTMENT` | `Valider paramètres création` | `Décider action tentative` |
| 3 | `GET_APPOINTMENT` | `Valider token consultation` | inchangé |
| 4 | `CANCEL_APPOINTMENT` | `Confirmation déjà demandée ?` | inchangé |
| 5 | `RESCHEDULE_APPOINTMENT` | `Router étape replanification` | inchangé |
| 6 | `GENERAL` | `Réponse générale` | inchangé |
| 7 | repli | `Réponse générale` | inchangé |

Les liens internes de `Valider paramètres disponibilité`, `Confirmation déjà demandée ?`, `Router étape replanification`, `Appeler GetServices`, `Valider token consultation` et `Réponse générale` sont identiques.

## Nœuds ajoutés

Quarante-six nœuds. Aucun n'est un nœud d'envoi d'e-mail. Le workflow proposé ne contient aucun type de nœud e-mail.

| Nœud | Rôle |
| --- | --- |
| `Lire tentative de session` | Lit l'identifiant, le statut, la référence, le bail, l'expiration et le compteur de reprise. Ne lit ni la clé ni le corps. |
| `Joindre tentative de session` | Ajoute cette tentative à l'état de conversation. |
| `Décider action tentative` | Choisit `INSERT`, `CLAIM`, `RESUME`, `ABANDON`, `MODIFY`, `RESTART`, `ASK`, `WAIT`, `RECALL`, `EXPIRE` ou `COLLECT`. |
| `Aiguiller tentative` | Une sortie par action, dans cet ordre. Le repli va vers la validation de collecte. |
| `Préparer corps figé` | Crée une clé `rec008-` et un identifiant de tentative par tirage aléatoire, fige les huit champs et calcule l'empreinte. |
| `Insérer tentative` | Insère le statut `AWAITING_CONFIRMATION` pour deux heures. Ne retourne que l'identifiant et le statut. |
| `Composer récapitulatif` | Affiche le créneau mémorisé et les coordonnées. N'affiche pas la clé. |
| `Préparer réclamation ou reprise` | Prépare le propriétaire du bail pour une réclamation. |
| `Préparer reprise` | Prépare un autre propriétaire pour une reprise. La clé n'est pas régénérée. |
| `Réclamer tentative` | Appelle seulement `reclamer_tentative_rendez_vous`. |
| `Reprendre tentative` | Appelle seulement `reprendre_tentative_rendez_vous`. |
| `Normaliser acquisition` | Accepte un booléen PostgreSQL vrai, `t` ou `true`. |
| `Réclamation gagnée ?` | Seule la sortie vraie peut atteindre l'appel HTTP. |
| `Appliquer corps gagnant` | Reconstruit le corps canonique avec la clé déjà stockée. Refuse l'envoi si la clé et le corps divergent. |
| `Corps figé présent ?` | Seule la sortie vraie appelle `Appeler CreateAppointment`. |
| `Classer réponse HTTP` | Classe 201, 200 de rejeu, 400, 409 de clé, 409 de créneau, et tout le reste en incertain. |
| `Classer délai HTTP` | Classe un délai ou une erreur réseau comme incertain, sans conclure qu'aucun rendez-vous n'existe. |
| `Aiguiller résultat HTTP` | Sépare confirmation, refus, créneau indisponible et incertain. |
| `Paramètres clôture confirmation` | Conserve l'identifiant, la référence et l'objet rendez-vous pour la clôture et l'affichage. |
| `Clôturer confirmation` | Appelle `cloturer_tentative_rendez_vous` avec `CONFIRMED`. |
| `Normaliser clôture confirmation` | Rétablit le rendez-vous confirmé après le retour SQL. |
| `Clôture confirmation enregistrée ?` | La sortie vraie rejoint `Préparer réponse création`. La sortie fausse n'appelle pas `Finaliser état création`. |
| `Réponse clôture non enregistrée` | Dit que le bail bloque un second envoi et qu'aucune nouvelle clé n'est créée. |
| `Clôturer refus` | Clôture `REJECTED`. |
| `Effacer collecte refusée` | Efface le brouillon de création sans effacer une référence déjà confirmée. |
| `Réponse refus validation` | Annonce le refus sans nouvel envoi. |
| `Clôturer créneau indisponible` | Clôture `SLOT_UNAVAILABLE`. |
| `Libérer créneau indisponible` | Retire le créneau choisi et revient à `ASK_CREATE_SLOT`. |
| `Réponse créneau indisponible` | Demande un autre créneau. |
| `Marquer tentative incertaine` | Appelle `marquer_tentative_incertaine`. Conserve le corps et la clé. |
| `Réponse résultat incertain` | Annonce que le résultat n'est pas connu. |
| `Réponse attente de bail` | Refuse un second envoi pendant les 90 secondes. |
| `Réponse référence déjà connue` | Rappelle la référence d'une tentative `CONFIRMED` sans nouvel appel. |
| `Réponse réclamation perdue` | Annonce qu'une autre exécution a gagné la réclamation. |
| `Refus création sans réclamation` | Bloque l'ancienne sortie vraie de `Création prête ?`. |
| `Préparer abandon ou modification` | Distingue l'abandon, la modification d'un champ et le redémarrage. |
| `Abandonner tentative` | Appelle `cloturer_tentative_rendez_vous` avec `ABANDONED` et un propriétaire nul. |
| `Abandon sans reprise de collecte ?` | Sépare l'effacement complet de la mise à jour d'un champ. |
| `Effacer brouillon abandonné` | Efface la collecte. Conserve la référence et le jeton d'un rendez-vous antérieur. |
| `Réponse demande abandonnée` | Confirme l'abandon sans appel HTTP. |
| `Mettre à jour champ modifié` | Efface seulement le champ demandé et pose la prochaine question. |
| `Question après modification` | Pose la question du champ à ressaisir. |
| `Expirer tentatives en attente` | Appelle `expirer_tentatives_en_attente`. |
| `Effacer collecte expirée` | Efface le brouillon du tour expiré. |
| `Réponse attente expirée` | Dit qu'aucun rendez-vous n'a été créé. |
| `Réponse corps absent` | Refuse l'envoi quand le corps gagnant est absent. |

## Liens qui empêchent de contourner la confirmation

`Appeler CreateAppointment` n'a qu'une source : la sortie vraie de `Corps figé présent ?`. Cette sortie n'est atteinte qu'après `Réclamation gagnée ?`. La sortie vraie de `Création prête ?` ne l'atteint pas.

`Réclamer tentative` et `Reprendre tentative` ne sont pas reliés ensemble. `ABANDON` n'emprunte pas la mise à jour de champ. `MODIFY` et `RESTART` n'empruntent pas l'effacement complet.

## Contrôles statiques

- Le JSON proposé se parse.
- Chaque lien pointe vers un nœud existant. Aucun nom n'est en double.
- Les quarante-six codes JavaScript passent `node --check` une fois placés dans une fonction asynchrone.
- Aucune clé complète `rec008-` suivie de 32 octets hexadécimaux n'est écrite dans le fichier.
- Aucun SQL ajouté n'écrit `token_gestion`.
- `active` est faux et `activeVersionId` est nul.
- La description du workflow indique `NON PUBLIE`.
