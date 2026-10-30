# REC-008 phase 8E-1 — Préparation hors ligne du workflow chatbot

Phase d'analyse, de copie hors ligne et d'audit statique. Aucune publication et aucune activation n'ont été faites.

## Verdict

**NO-GO pour exécuter 8E-2.**

La copie est un candidat statique. Elle ne doit pas être importée, publiée ni activée tant qu'une autorisation distincte n'a pas ouvert 8E-2 et prescrit des vérifications d'exécution sur un workflow inactif. Cette phase s'arrête ici.

## Préflight

Contrôle en lecture seule, répété en fin de phase. Aucun écart.

| Contrôle | Résultat |
| --- | --- |
| Base | `govsuite`, PostgreSQL 16.14 |
| Workflow 10 `R7TKt5mqZYpeKapl` | inactif, 84 nœuds, version `88a1f42a-ab9e-4eff-bfd9-996c31976b16`, compteur 654, `activeVersionId` nul |
| Workflow 03 `SXCesRUmGrV5FMzm` | actif, 12 nœuds, version active `2d72700c-d731-47e1-b6d6-82c5c684f055`, compteur 30 |
| Workflow 08 `ZbZoj4yF1s5a3B5E` | inactif, 5 nœuds, compteur 5 |
| `public.ai_appointment_attempt` | présente, 0 ligne |
| Cinq fonctions REC-008 | présentes, `SECURITY INVOKER`, `search_path` `pg_catalog, public`, empreintes inchangées |
| Comptes métier | 13 rendez-vous, 14 notifications, 12 historiques, 48 sessions |
| Empreinte métier | `a2dea067599fd4f0a5f857551adc67cc` |

Empreintes des fonctions : `cloturer` `d4779f4ffb052a68427e97370a5fa2dc`, `expirer` `0a3e544a0e6343f3c3a744d2e84c829b`, `marquer` `ddd8c168d3f8e73e70bb52608432dcb5`, `reclamer` `fe5c1fc27f9ff22ae37b04f820bc8cea`, `reprendre` `096e5236854a355629eab788ecc155ae`.

Aucune écriture PostgreSQL, aucune modification de schéma, aucun appel n8n, aucun appel au webhook, aucun e-mail.

## Sauvegarde de la version actuelle

Export lu depuis `workflow_entity` par `jsonb_pretty`, sans `COPY`.

| Champ | Valeur |
| --- | --- |
| Fichier | `n8n/live-exports/2026-10-30-rec008-phase8e1-before/R7TKt5mqZYpeKapl.json` |
| Taille | 234 417 octets |
| Nœuds | 84 |
| Liens | 82 |
| Identifiant | `R7TKt5mqZYpeKapl` |
| Version | `88a1f42a-ab9e-4eff-bfd9-996c31976b16` |
| Compteur | 654 |
| Actif | non |
| SHA-256 | `ec2a16e04b5d75b6acb40fb408a557f97e7203b740e1e1867c26105c37ef42f9` |

Le fichier historique à 33 nœuds n'a pas été utilisé et ne doit pas remplacer cet export. La version live relue en fin de phase porte encore le même identifiant de version et le compteur 654.

## Adresse du workflow 03

Depuis le conteneur `govsuite-n8n` :

- `http://localhost:5678/healthz` répond `{"status":"ok"}`.
- `http://127.0.0.1:5680/healthz` est refusé.

Le port 5680 est le port publié vers le navigateur de l'hôte. Il n'est pas joignable depuis le conteneur. Le nœud HTTP conserve donc `POST http://localhost:5678/webhook/appointments`. Ce webhook n'a pas été appelé.

## Architecture

La chaîne d'entrée devient :

`message de chat` → `Charger état conversation` → `Lire tentative de session` → `Joindre tentative de session` → `Comprendre la demande` → `Parser intention` → `Fusionner état conversation` → `Gérer collecte progressive` → `Sauvegarder état conversation` → `Router intention`.

La sortie création du routeur entre dans `Décider action tentative`, puis `Aiguiller tentative`. Les autres sorties du routeur ne changent pas.

La collecte se termine par un récapitulatif et l'étape `AWAIT_CREATE_CONFIRMATION`. L'appel HTTP n'est atteint que si `reclamer_tentative_rendez_vous` ou `reprendre_tentative_rendez_vous` retourne l'acquisition, puis si le corps figé est présent. L'ancienne condition `ready` ne peut plus ouvrir cet appel : la sortie vraie de `Création prête ?` aboutit à un refus.

## Machine à états

Les phrases sont comparées après trim, minuscules, suppression des accents et de la ponctuation finale. La correspondance est celle du message entier.

Affirmatif : `oui`, `oui je confirme`, `je confirme`, `confirmer`, `d'accord`, `daccord`, `ok`, `yes`.

Négatif : `non`, `non merci`, `je ne confirme pas`, `annuler`, `annuler la demande`, `abandonner`, `stop`.

Modification : `modifier`, `modifier le nom`, `modifier le prenom`, `modifier l'adresse`, `modifier le telephone`, `modifier le creneau`, `autre creneau`, ainsi qu'une phrase qui contient `change le nom`, `change le prenom`, l'adresse, le téléphone ou le créneau. `Oui mais change le nom` est une modification, pas une confirmation.

| Situation | Action | Effet |
| --- | --- | --- |
| Brouillon complet, aucune tentative ouverte, étape précédente différente de l'attente | `INSERT` | Nouvelle clé, corps figé, récapitulatif. Pas d'appel HTTP. |
| `AWAITING_CONFIRMATION` et phrase affirmative, délai de deux heures encore ouvert | `CLAIM` | Une seule réclamation gagnante appelle le workflow 03. |
| Deux affirmations simultanées | deux `CLAIM` | Une acquisition vraie. L'autre reçoit le refus de second envoi. |
| `SUBMITTING` avec bail non échu | `WAIT` | Aucun second appel avant 90 secondes. |
| `SUBMITTING` avec bail échu, ou `UNCERTAIN` | `RESUME` | Même corps, même clé, nouveau propriétaire de bail. |
| Phrase négative pendant l'attente | `ABANDON` | `ABANDONED`, brouillon effacé, pas de webhook. |
| Phrase ambiguë | `ASK` | La confirmation est redemandée. |
| Modification ou redémarrage | `MODIFY` ou `RESTART` | L'ancienne tentative est abandonnée. Un seul champ, ou toute la collecte, est effacé. Le prochain récapitulatif aura une nouvelle clé. |
| `AWAITING_CONFIRMATION` dont `expires_at` est passé | `EXPIRE` | `expirer_tentatives_en_attente`, puis effacement du brouillon. Le oui tardif ne crée pas une tentative. |
| `CONFIRMED` et phrase affirmative | `RECALL` | La référence est rappelée. Aucun rejeu. |
| Repli, collecte incomplète | `COLLECT` | Validation existante, sans appel HTTP. |

`annuler` pendant l'attente ne prend pas la branche `CANCEL_APPOINTMENT`. Les parcours de disponibilité, d'annulation et de replanification ne sont pas modifiés.

L'expiration de la session de conversation ne sert pas de filtre à la lecture de la tentative. `expirer_tentatives_en_attente` ne touche que les lignes `AWAITING_CONFIRMATION`. Une tentative `UNCERTAIN` ou `SUBMITTING` reste lisible.

## Corps figé et fonctions SQL

Chaque nouvelle tentative reçoit :

- une clé `rec008-` suivie de 64 caractères hexadécimaux tirés de 32 octets `crypto.getRandomValues` ;
- un identifiant `crypto.randomUUID` ;
- un propriétaire de bail `own-` suivi de 32 caractères hexadécimaux, régénéré à chaque réclamation ou reprise, jamais à la place de la clé.

Les huit champs, dans cet ordre, sont `slotId`, `nom`, `prenom`, `email`, `telephone`, `numeroDocument`, `langue`, `cleIdempotence`. Le créneau est celui dont l'identifiant est déjà mémorisé dans `availableSlots`. L'empreinte est le SHA-256 hexadécimal du JSON canonique. L'insertion refuse une clé hors alphabet ou différente de `cleIdempotence`.

Les cinq fonctions sont appelées par une seule instruction SQL, avec leurs arguments dans le même énoncé. Il n'y a pas de `SELECT` puis `UPDATE` séparé. La reprise ne réécrit ni le corps ni la clé. Le bail de 90 secondes reste celui des fonctions.

Le délai HTTP est de 20 000 ms, inférieur au bail. `fullResponse` et `neverError` conservent les réponses 4xx sur la sortie principale. `onError: continueErrorOutput` envoie le délai et l'erreur réseau sur la seconde sortie.

| Réponse | Classe | Suite |
| --- | --- | --- |
| HTTP 201 | `CONFIRMED` | Clôture `CONFIRMED`, puis le message citoyen existant si la clôture est enregistrée. |
| HTTP 200 avec `replayed` vrai et `created` faux | `CONFIRMED` | Même clôture, sans nouvelle clé. |
| HTTP 400 | `REJECTED` | Clôture `REJECTED`, brouillon effacé, pas de nouvel envoi. |
| HTTP 409 `IDEMPOTENCY_KEY_CONFLICT` | `REJECTED` | Même traitement que le refus de validation. |
| Autre HTTP 409 | `SLOT_UNAVAILABLE` | Clôture, créneau libéré, retour au choix de créneau. |
| HTTP 500, corps illisible, délai ou erreur réseau | `UNCERTAIN` | `marquer_tentative_incertaine`. Le délai n'est pas la preuve qu'aucun rendez-vous n'existe. |

Si la clôture retourne faux après une réponse HTTP déjà classée confirmée, `Finaliser état création` n'est pas exécuté et aucune nouvelle clé n'est créée. Le message dit que le bail de 90 secondes bloque un second envoi, puis que la même demande peut être reprise. Le jeton déjà reçu peut être montré au citoyen dans ce message. Il n'est pas écrit dans `ai_appointment_attempt`.

## Protection des données

La copie n'affiche pas la clé d'idempotence, le corps JSON, les identifiants techniques de tentative ni le propriétaire du bail dans les textes rendus au citoyen. Le récapitulatif affiche le service, le site, la date, l'heure et les coordonnées saisies.

Le jeton de gestion continue d'être affiché par `Préparer réponse création` après une création confirmée, et il continue d'être enregistré dans `ai_conversation_state` par `Finaliser état création`. Il n'est pas une colonne de `ai_appointment_attempt`.

Les requêtes de lecture ne sélectionnent ni `idempotency_key` ni `request_payload`. Ces deux valeurs ne sortent des fonctions de réclamation et de reprise que pour reconstruire le corps de l'appel gagnant.

Limites avant toute exposition publique :

- les données d'exécution n8n contiendront le corps figé, donc la clé, et le jeton sur le parcours confirmé ;
- le rôle PostgreSQL applicatif peut lire la clé tant que la tentative n'est pas clôturée, puisque la clôture confirmée l'efface ;
- le jeton reste visible par le citoyen et dans l'état de conversation, comme aujourd'hui ;
- l'identifiant de credential PostgreSQL est dans le workflow, pas le mot de passe ;
- aucun journal ajouté n'écrit ces secrets, mais les journaux natifs d'exécution n8n ne sont pas un canal sûr pour ce contrat.

## Audit statique

| Contrôle | Résultat |
| --- | --- |
| JSON valide | oui, 130 nœuds, 133 liens |
| Liens vers des nœuds existants | oui, aucun doublon de nom |
| Nœud d'origine supprimé | non |
| Ordre des sorties du routeur | conservé, seule la cible création change |
| Disponibilité, annulation, replanification | liens d'entrée et nœuds internes inchangés |
| Contournement de la confirmation | aucun : une seule source vers l'appel HTTP |
| Nœud d'e-mail | aucun type e-mail dans la copie |
| Clé ou donnée personnelle codée en dur | aucune clé complète |
| `active` | faux |
| Syntaxe des codes ajoutés ou modifiés | `node --check` sans erreur |

Le détail des nœuds est dans `docs/recovery/REC_008_PHASE8E1_NODE_DIFF.md`.

## Risques résiduels

Ces points n'ont pas été exécutés : la phase interdit le test conversationnel, l'appel webhook et l'écriture SQL.

- `await crypto.subtle.digest` dans un nœud Code n8n 2.32.6 n'a pas été exécuté. Le code est syntaxiquement valide dans une fonction asynchrone.
- La forme exacte `{ statusCode, body }` de la réponse HTTP complète est celle attendue par le classement. Elle n'a pas été observée sur cette instance pendant cette phase.
- Un HTTP 200 qui n'a pas exactement `replayed: true` et `created: false` est classé incertain, sans second appel dans le même tour.
- Si l'insertion de la tentative échoue après que l'étape d'attente a été sauvegardée, le tour suivant ne crée pas une nouvelle tentative tout seul. Il n'appelle pas non plus le webhook.
- Le corps et la clé restent dans les données d'exécution n8n.
- Le créneau est repris depuis `availableSlots`. Si ce tableau ne contient plus l'identifiant mémorisé, le corps utilise l'identifiant déjà porté par l'état.

## Procédure de publication contrôlée

Non exécutée. Elle ne devient possible qu'avec une autorisation distincte.

1. Refaire le préflight en lecture seule. S'arrêter au premier écart.
2. Recalculer le SHA-256 de l'export à 84 nœuds et vérifier qu'il est encore `ec2a16e04b5d75b6acb40fb408a557f97e7203b740e1e1867c26105c37ef42f9`.
3. Importer uniquement la copie proposée, en la laissant inactive. Ne pas activer le workflow 10. Ne pas appeler le webhook. Ne pas envoyer d'e-mail.
4. Vérifier que le workflow 03 et le workflow 08 n'ont pas changé, que la table des tentatives est toujours vide avant le premier essai autorisé, et que l'empreinte métier est inchangée.
5. Exécuter ensuite seulement les essais prévus par l'autorisation, sur le workflow encore inactif.
6. N'activer le workflow 10 que par une autorisation ultérieure, après ces essais.

## Procédure de retour arrière

La version live n'a pas été modifiée. Le retour arrière de cette phase est de ne pas importer la copie.

Si une phase ultérieure importe la copie :

1. Ne pas utiliser `n8n/workflows/10_AI_ConsularAssistant_Complete.json`.
2. Réimporter `n8n/live-exports/2026-10-30-rec008-phase8e1-before/R7TKt5mqZYpeKapl.json`.
3. Vérifier 84 nœuds, l'identifiant `R7TKt5mqZYpeKapl`, l'état inactif, et le SHA-256 `ec2a16e04b5d75b6acb40fb408a557f97e7203b740e1e1867c26105c37ef42f9` avant import.
4. Ne pas restaurer un dump et ne pas annuler la migration REC-008.

## Empreintes des artefacts

| Artefact | SHA-256 |
| --- | --- |
| Export live à 84 nœuds | `ec2a16e04b5d75b6acb40fb408a557f97e7203b740e1e1867c26105c37ef42f9` |
| JSON proposé, 277 809 octets | `15830fe472ff588de0ae50c1be2166082d5099285cb1dcb30da06bb523acc83b` |
| Marqueur `NE_PAS_PUBLIER.txt` | `831bd45fd8fae51d4afa363f08f333a38fb2089620194d01695faf4f03e7c8b4` |
| Diff de nœuds | `68cfcf6a06830af364ff37bde120cfeb0ea5995600e6ae65d9be507d32ece033` |

Le JSON proposé est dans `n8n/proposed/2026-10-30-rec008-phase8e1-NON-PUBLIE/`. Son dossier et sa description portent la mention non publié.
