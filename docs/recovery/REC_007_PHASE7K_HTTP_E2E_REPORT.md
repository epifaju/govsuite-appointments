# REC-007 — Phase 7K — Essais HTTP de bout en bout

Le workflow publié `03_API_CreateAppointment` a été exercé par HTTP. Les réponses 201, 200 et 409 ont été obtenues. Les deux rendez-vous synthétiques ont été supprimés. Le workflow, la migration et la fonction SQL n'ont pas été modifiés.

## 1. Préflight

| Contrôle | Résultat |
|---|---|
| PostgreSQL | 16.14 |
| Fonction `public.creer_rendez_vous_idempotent` | Présente, huit paramètres |
| Index `uq_rendez_vous_cle_idempotence` | Présent |
| Workflow 03 `SXCesRUmGrV5FMzm` | Actif, 12 nœuds, `2d72700c-d731-47e1-b6d6-82c5c684f055` |
| Workflow 08 `ZbZoj4yF1s5a3B5E` | Inactif, 5 nœuds |
| Workflow 10 `R7TKt5mqZYpeKapl` | Inactif, 84 nœuds |
| Compteurs | 13 rendez-vous, 14 notifications, 12 historiques, 48 sessions |
| Clés d'idempotence | 0 |
| Empreinte | `a2dea067599fd4f0a5f857551adc67cc` |
| Exécutions de création en cours | 0 |
| Dernière exécution du workflow 03 | 551 |
| Créneau `3f3b3cba-30e2-43d2-b2e5-dcb1ee01d2c0` | Futur, `DISPONIBLE`, capacité 2, 0 place |
| Mailpit | 5 messages, dont 2 non lus |

Le créneau métier restait adapté. Aucun créneau synthétique n'a été ajouté.

## 2. Scénario A — création avec adresse

Une clé aléatoire de 59 caractères, au jeu `A-Za-z0-9._~-`, a été générée en mémoire et envoyée une seule fois. Elle n'est pas reproduite ici.

`POST http://127.0.0.1:5680/webhook/appointments`

Identité : `REC007-P7K-A` / `HTTPTEST` / `rec007-phase7k-a@example.test` / document `REC007-P7K-A`.

| Contrôle | Résultat |
|---|---|
| Exécution n8n | 552, `success`, dernier nœud `Répondre` |
| HTTP | 201 |
| Corps | `success: true`, objet `appointment` sans champ supplémentaire |
| Issue SQL | `CREATED` |
| Rendez-vous | `f661511c-6efd-447d-9aa9-fa7dcaf07e9a` |
| Référence | `GB-2026-E03F6657` |
| Statut | `CONFIRME` |
| Service / site | `PASSEPORT` / `PARIS` |
| Créneau | 10 novembre 2026, 09:00–09:30 Europe/Paris |
| Jeton | Présent dans la réponse, non affiché |
| Hash et empreinte | Les deux colonnes portent 64 caractères hexadécimaux |
| Places | 1, créneau encore `DISPONIBLE` |
| Historique | Une action `CREATION` vers `CONFIRME` |
| Notification | Une `CONFIRMATION` / `EMAIL` / `A_ENVOYER` |
| Compteurs | 14 rendez-vous, 15 notifications, 13 historiques, 48 sessions |

## 3. Scénario B — replay

Le même corps et la même clé ont été renvoyés une fois.

| Contrôle | Résultat |
|---|---|
| Exécution n8n | 553, `success`, dernier nœud `Répondre replay` |
| HTTP | 200 |
| Corps | `success: true`, `created: false`, `replayed: true` |
| Issue SQL | `REPLAYED` |
| Identifiant et référence | Identiques à l'exécution 552 |
| Jeton | Identique à celui de la création, comparaison en mémoire |
| Écritures | Rendez-vous, places, notifications et historiques inchangés |

## 4. Scénario C — conflit

La même clé a été réutilisée avec le nom `REC007-P7K-C`.

| Contrôle | Résultat |
|---|---|
| Exécution n8n | 554, `success`, dernier nœud `Répondre conflit idempotence` |
| HTTP | 409 |
| Corps | `error.code = IDEMPOTENCY_KEY_CONFLICT` |
| Rendez-vous dans la réponse | Aucun |
| Identifiant et jeton renvoyés | Aucun ; la fonction a retourné des valeurs nulles |
| Données | 14 rendez-vous, empreinte inchangée par rapport à l'état post-création, une seule place |

## 5. Nettoyage du scénario A

La suppression a visé uniquement `f661511c-6efd-447d-9aa9-fa7dcaf07e9a`. Avant le `DELETE`, la transaction a verrouillé la ligne et le créneau, puis a exigé le nom, l'adresse, le document, le statut `CONFIRME`, le créneau, un hash et une empreinte hexadécimaux, un total de 14 rendez-vous, et l'empreinte d'origine sur les 13 autres lignes.

La suppression a été suivie du recalcul des places. Contrôle avant `COMMIT` : 13 rendez-vous, 14 notifications, 12 historiques, 48 sessions, 0 clé, créneau `DISPONIBLE` avec 0 place, empreinte `a2dea067599fd4f0a5f857551adc67cc`.

Relecture après commit : mêmes compteurs, même empreinte, créneau encore futur.

Le script s'est ensuite arrêté sur une comparaison de texte : `psql` a renvoyé les accusés `BEGIN`, `DO` et `COMMIT` en plus du marqueur de succès. La transaction était déjà validée. Aucune seconde suppression n'a été lancée. L'essai sans adresse n'a démarré qu'après cette relecture.

## 6. Scénario D — création sans adresse

Le créneau a été revérifié : futur, `DISPONIBLE`, capacité 2, 0 place. Nouvelle clé de 59 caractères, nouvelle identité `REC007-P7K-D` / `SANSMAIL` / document `REC007-P7K-D`, adresse envoyée vide.

| Contrôle | Création | Replay |
|---|---|---|
| Exécution | 555, dernier nœud `Répondre` | 556, dernier nœud `Répondre replay` |
| HTTP | 201, `success: true` | 200, `created: false`, `replayed: true` |
| Issue SQL | `CREATED` | `REPLAYED` |
| Rendez-vous | `d279024f-a15e-4f38-9124-1dfeb3e39eae` | Même identifiant |
| Référence | `GB-2026-671AEEFF` | Même référence |
| Statut | `CONFIRME` | `CONFIRME` |
| Adresse stockée | `NULL` | `NULL` |
| Jeton | Présent, non affiché | Identique, comparaison en mémoire |
| Hash et empreinte | Renseignés | Inchangés |
| Places | 1 | 1 |
| Notifications de cette ligne | 0 | 0 |
| Historiques | 13, dont une `CREATION` | 13 |
| Compteurs | 14, 14, 13, 48 | 14, 14, 13, 48 |
| Empreinte pendant la réservation | `4f7f87c9d883310d539dc4f5b221e59c` | Identique |

## 7. Nettoyage du scénario D

Même protocole, limité à `d279024f-a15e-4f38-9124-1dfeb3e39eae`, avec l'exigence supplémentaire que l'adresse stockée soit `NULL`. Le `COMMIT` a eu lieu après les contrôles de compteurs, de places et d'empreinte.

## 8. État final

| Contrôle | Résultat |
|---|---|
| Rendez-vous, notifications, historiques, sessions | 13, 14, 12, 48 |
| Empreinte | `a2dea067599fd4f0a5f857551adc67cc` |
| Créneau de test | Futur, `DISPONIBLE`, capacité 2, 0 place |
| Clés d'idempotence | 0 |
| Identités `REC007-P7K-A`, `REC007-P7K-C`, `REC007-P7K-D` | 0 |
| Mailpit | 5 messages, dont 2 non lus |
| Workflow 03 | Actif, 12 nœuds, `2d72700c-d731-47e1-b6d6-82c5c684f055` |
| Workflows 08 et 10 | Inactifs |

Les cinq exécutions 552 à 556 sont en succès. Aucune n'a été supprimée. Le workflow 08 étant resté inactif, la notification `A_ENVOYER` du scénario A n'a pas produit de message : le total Mailpit est le même avant le scénario A, après son nettoyage, et après le scénario D.

## 9. Anomalie

Le premier programme de test a pris les accusés transactionnels de `psql` pour un échec de nettoyage, alors que le `COMMIT` du scénario A était déjà fait et que la relecture confirmait l'état initial. Le produit n'est pas en cause. Aucun appel HTTP n'a été rejoué pour lever cette ambiguïté.

La sortie réelle était `BEGIN`, l'identifiant du créneau verrouillé, `DO`, `COMMIT`, puis `nettoye`. Le programme exigeait que tout ce texte soit exactement `nettoye`. Le code de retour du processus était 0.

## 10. Contrôle fiable, non réexécuté

Les essais de la phase 7K ne sont pas relancés. Le prochain contrôle de nettoyage doit s'appuyer sur le code de retour et sur une lecture SQL séparée.

1. Lancer `psql` avec `ON_ERROR_STOP=1` et lire `status`. Un code différent de 0 arrête le scénario. La transaction non validée disparaît à la fermeture de la session.
2. Ignorer les accusés `BEGIN`, `DO` et `COMMIT`. Ils ne sont pas le résultat métier.
3. Ouvrir ensuite une nouvelle session, en lecture seule, et ne lire qu'un objet : compteurs, empreinte, absence de l'UUID exact, places du créneau.
4. Accepter le nettoyage seulement si cette seconde commande retourne aussi 0 et si l'objet est celui de la référence.
5. Ne pas comparer la sortie complète à un mot unique, et ne pas renvoyer de POST pour corriger un doute de parsing.

## 11. Verdict

**GO** pour clôturer REC-007 sur le périmètre d'idempotence publié.

Les réponses 201, 200 et 409, les écritures PostgreSQL et les deux nettoyages sont conformes. Les risques déjà connus restent hors de cette clôture : le replay renvoie le jeton de gestion, n8n conserve la clé brute dans ses exécutions, l'appelant public n'est pas lié au hash, et la clé n'a pas de durée de vie.

**NO-GO** pour ouvrir REC-008 dans cette phase.

Cette phase s'arrête ici.
