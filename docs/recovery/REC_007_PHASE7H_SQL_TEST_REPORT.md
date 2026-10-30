# REC-007 — Phase 7H — Validation transactionnelle

La fonction `public.creer_rendez_vous_idempotent` a été appelée trois fois dans une seule transaction, puis cette transaction a été annulée. Le webhook n'a pas été utilisé. Le workflow n'a pas été publié. Aucune donnée synthétique n'a été conservée.

## 1. Préflight

| Contrôle | Résultat |
|---|---|
| PostgreSQL | 16.14 |
| Fonction | Présente, huit paramètres, `SECURITY INVOKER` |
| Index `uq_rendez_vous_cle_idempotence` | Présent, unique et partiel |
| Workflow 03 | Actif, 11 nœuds, `c48ffad5-4f36-4c7e-9abf-11ce6fa2d9e6` |
| Workflows 08 et 10 | Inactifs |
| Compteurs | 13 rendez-vous, 14 notifications, 12 historiques, 48 sessions |
| Empreinte | `a2dea067599fd4f0a5f857551adc67cc` |
| Créneau `3f3b3cba-30e2-43d2-b2e5-dcb1ee01d2c0` | Futur, `DISPONIBLE`, capacité 2, 0 place réservée |
| Transactions occupées et exécutions de création en cours | Aucune |

## 2. Script

Un seul fichier, une seule connexion, une seule transaction. Il commence par `BEGIN` et se termine par `ROLLBACK`. Il ne contient pas d'ordre de validation. La clé a été tirée dans la session, au format `rec007-p7h-` suivi de 32 caractères hexadécimaux. Elle n'a pas été sélectionnée. Le jeton n'a pas été sélectionné : le script ne conserve que sa présence et, au replay, l'égalité avec le jeton du premier appel.

Les trois appels utilisent le créneau futur, le prénom `SQLTEST`, l'adresse `rec007-phase7h@example.test`, le téléphone `0600000711`, le document `REC007-P7H-DOC` et la langue `fr`. Le nom est `REC007-PHASE7H` pour les deux premiers appels, puis `REC007-PHASE7H-B` pour le conflit. `ON_ERROR_STOP` était actif. Aucune erreur SQL n'a interrompu la transaction.

## 3. Résultats dans la transaction

| Étape | Issue | Identifiant | Référence | Jeton | Places | Rendez-vous | Notifications | Historiques | Clés remplies |
|---|---|---|---|---|---|---:|---:|---:|---:|
| A | `CREATED` | `866e4e82-979a-4306-bfae-33da5330430f` | `GB-2026-1F83539F` | Présent, non affiché | 1 | 14 | 15 | 13 | 1 |
| B | `REPLAYED` | Même identifiant | Même référence | Identique au premier, non affiché | 1 | 14 | 15 | 13 | 1 |
| C | `KEY_CONFLICT` | Aucun | Aucune | Aucun | 1 | 14 | 15 | 13 | 1 |

Le rendez-vous créé était `CONFIRME`, avec l'adresse de test. Le créneau est resté `DISPONIBLE`, ce qui est attendu pour une place sur une capacité de 2. L'historique comptait une action `CREATION` vers `CONFIRME`. La notification comptait une ligne `CONFIRMATION` / `EMAIL` / `A_ENVOYER` vers l'adresse de test. Le hash de clé et l'empreinte de contenu étaient tous deux au format hexadécimal de 64 caractères. Leurs valeurs ne sont pas recopiées ici.

Le replay n'a ajouté ni rendez-vous, ni place, ni notification, ni historique. Le conflit n'a rien ajouté non plus, et n'a renvoyé ni statut ni adresse.

La commande finale a répondu `ROLLBACK`.

## 4. État après annulation

Nouvelle connexion, après la fin de la session de test.

| Contrôle | Résultat |
|---|---|
| Rendez-vous, notifications, historiques, sessions | 13, 14, 12, 48 |
| Empreinte | `a2dea067599fd4f0a5f857551adc67cc` |
| Créneau de test | `DISPONIBLE`, capacité 2, 0 place |
| Lignes `REC007-PHASE7H`, `REC007-PHASE7H-B` ou adresse de test | 0 |
| Ligne de l'identifiant d'essai | 0 |
| `cle_idempotence` ou `empreinte_requete` renseignée | 0 |
| Colonnes, fonction à huit paramètres, index partiel | Toujours présents |
| Workflow 03 | Actif, même version, 11 nœuds |
| Workflows 08 et 10 | Inactifs |

Aucune erreur. Aucun courriel n'a pu partir : la notification n'a existé que dans la transaction annulée, et le workflow 08 est resté inactif.

## 5. Limite

Ces trois appels se suivent dans la même transaction. Ils montrent la création, le replay et le conflit de clé. Ils ne montrent pas deux transactions simultanées : sous `read committed`, la seconde ne voit la ligne de la première qu'après la validation de celle-ci. Cette validation est justement exclue ici.

## 6. Protocole de concurrence, non exécuté

Il attend une autorisation propre. Il n'utilise ni `dblink`, ni transaction autonome.

1. Relire les compteurs, l'empreinte et un créneau futur dont il ne reste qu'une place, ou en préparer un qui sera remis dans son état initial.
2. Ouvrir deux connexions. Les deux appellent la fonction avec la même clé forte et le même corps synthétique, adresse `example.test`.
3. Attendu : une issue `CREATED`, une issue `REPLAYED`, un seul rendez-vous, une seule place, une seule notification, un seul historique.
4. Variante séparée, toujours sur autorisation : la première transaction est annulée avant sa validation, et la seconde doit alors obtenir `CREATED`.
5. Nettoyage ciblé de la seule ligne synthétique, recalcul de la place, puis contrôle du retour à 13 rendez-vous et à l'empreinte `a2dea067599fd4f0a5f857551adc67cc`. Arrêt si ce contrôle échoue.
6. Ne pas passer par le webhook et ne pas publier le workflow dans ce protocole.

## 7. Verdict

**GO** pour exécuter plus tard, sur autorisation séparée, le protocole de concurrence de la section 6. Sa préparation est faite. Il n'a pas été lancé.

**NO-GO** pour publier le workflow n8n. La publication attend le résultat de ce protocole. REC-008 n'est pas commencé.

Cette phase s'arrête ici.
