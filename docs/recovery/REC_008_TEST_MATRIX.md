# REC-008 — Matrice de tests

Aucun test de cette matrice n'est exécuté en phase 8A. Les essais conversationnels supposent une activation ultérieure du workflow 10, qui est aujourd'hui inactif. Le fichier historique à 33 nœuds ne sert dans aucun cas.

La référence à retrouver après chaque essai qui écrit est : 13 rendez-vous, 14 notifications, 12 historiques, 48 sessions, empreinte `a2dea067599fd4f0a5f857551adc67cc`, workflows 03 actif sur `2d72700c-d731-47e1-b6d6-82c5c684f055`, workflows 08 et 10 inactifs, Mailpit inchangé. Les essais SQL qui créent une tentative utilisent `BEGIN` puis `ROLLBACK`, ou suppriment uniquement la ligne d'essai identifiée par son UUID.

## 1. Tests statiques

Sans n8n exécuté et sans écriture SQL.

| Identifiant | Contrôle | Attendu |
|---|---|---|
| S1 | Le diff ne contient pas le fichier à 33 nœuds | Le workflow visé reste celui à 84 nœuds |
| S2 | Ordre des sorties de `Router intention` | Inchangé, `CREATE_APPOINTMENT` en troisième position |
| S3 | `Création prête ?` | Seule la branche vraie atteint `Appeler CreateAppointment` |
| S4 | Calcul de `ready` | Vrai seulement après confirmation explicite et transition gagnée |
| S5 | Listes de messages | Affirmatif, négatif et modification sont des messages entiers ; « annuler » de la création n'utilise pas la liste positive de l'annulation |
| S6 | `READY_CREATE_SEARCH` | Continue de produire `GET_AVAILABILITY` |
| S7 | URL | `http://localhost:5678/webhook/appointments`, méthode POST |
| S8 | Corps | Huit champs, corps lu depuis la tentative, pas d'en-tête `Idempotency-Key` |
| S9 | `Finaliser état création` | Atteint seulement depuis un statut `CONFIRMED` |
| S10 | Nœuds d'annulation et de replanification | Absents du diff |
| S11 | Clé et jeton | Aucun des deux n'est interpolé dans un texte de journal ; le jeton n'est pas une colonne de la tentative |
| S12 | `conversation_step` | `AWAIT_CREATE_CONFIRMATION` tient dans `varchar(50)` |

## 2. Tests SQL transactionnels

Une transaction par scénario, annulée, après la phase 8B. Aucun appel au webhook. La fonction de création de rendez-vous n'est pas appelée.

| Identifiant | Scénario | Attendu |
|---|---|---|
| Q1 | Insérer une tentative `AWAITING_CONFIRMATION` | Un UUID, une clé, un corps, une empreinte |
| Q2 | Seconde ligne ouverte pour la même session | Refus par l'index unique partiel |
| Q3 | `UPDATE` conditionnel vers `SUBMITTING` exécuté deux fois | La première met à jour une ligne, la seconde zéro |
| Q4 | Nouvelle ligne après `ABANDONED`, même corps | Nouvel UUID et nouvelle clé |
| Q5 | Passage à `EXPIRED` quand `expires_at` est dépassé et que le statut est l'attente | Aucune clé conservée, corps personnel vide |
| Q6 | `UNCERTAIN` au-delà de l'échéance | La ligne reste `UNCERTAIN`, la clé reste disponible pour un replay |
| Q7 | Clôture `CONFIRMED` | `rendez_vous_id` et `reference` conservés, clé et données personnelles effacées |
| Q8 | Sessions existantes | Les 48 lignes de `ai_conversation_state` restent identiques après `ROLLBACK` |
| Q9 | Empreinte des rendez-vous | `a2dea067599fd4f0a5f857551adc67cc` sur une nouvelle connexion |

## 3. Tests conversationnels

À n'autoriser qu'en phase 8F. Chaque création réelle est précédée du préflight, utilise un créneau futur dédié ou le créneau déjà qualifié s'il est encore libre, puis est nettoyée par UUID avant le scénario suivant. Un HTTP ambigu arrête la série. Le code de retour du nettoyage et une seconde lecture SQL décident du succès, conformément à la phase 7K.

| Identifiant | Scénario | Attendu |
|---|---|---|
| C1 | Collecte complète sans « oui » | Récapitulatif, tentative `AWAITING_CONFIRMATION`, 13 rendez-vous |
| C2 | « Oui » après le récapitulatif | Un seul `POST`, HTTP 201, statut `CONFIRMED`, rendez-vous `CONFIRME` |
| C3 | « Non » | `ABANDONED`, aucun `POST`, collecte effacée |
| C4 | « Annuler » | Même résultat que C3, sans entrer dans l'annulation par jeton |
| C5 | « Modifier le nom » puis nouveau récapitulatif | Première tentative abandonnée sans HTTP, seconde ligne au nouveau nom |
| C6 | « Peut-être », puis le même numéro de téléphone | Récapitulatif répété, toujours 13 rendez-vous |
| C7 | Deuxième « oui » après un 201 | Même référence, aucun second rendez-vous |
| C8 | Deux messages « oui » simultanés | Une seule ligne passe à `SUBMITTING`, un seul rendez-vous |
| C9 | Réponse HTTP perdue, simulée par un statut `UNCERTAIN` | Le message suivant rejoue la même clé et le même corps |
| C10 | Replay réel | HTTP 200, `replayed: true`, mêmes identifiant et référence |
| C11 | Même clé, corps modifié à la main en base d'essai | HTTP 409 `IDEMPOTENCY_KEY_CONFLICT`, pas de nouvelle clé automatique |
| C12 | Créneau complet ou passé entre le récapitulatif et le « oui » | HTTP 409 de créneau, `SLOT_UNAVAILABLE`, aucun rendez-vous de cette clé |
| C13 | Attente au-delà de deux heures | `EXPIRED`, aucun `POST` |
| C14 | `UNCERTAIN` après expiration de la session de conversation | Le message suivant rejoue, il ne crée pas une nouvelle clé |
| C15 | Parcours d'annulation d'un rendez-vous existant | `ASK_CANCEL_CONFIRMATION` inchangé, création non appelée |
| C16 | Parcours de replanification | `ASK_RESCHEDULE_CONFIRMATION` inchangé, création non appelée |
| C17 | Recherche de créneaux | `READY_CREATE_SEARCH` appelle la disponibilité, pas la création |
| C18 | Mailpit et workflow 08 | Compteur de messages inchangé, workflow 08 inactif |

## 4. Arrêt

Un écart de préflight, un second `POST` après une réponse ambiguë, une activation non prévue du workflow 08, ou une empreinte différente après nettoyage arrête la série. Le retour arrière du workflow 10 recharge l'export à 84 nœuds pris juste avant la publication d'essai. Il ne recharge pas le fichier à 33 nœuds.
