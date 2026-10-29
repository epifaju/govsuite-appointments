# Rapport REC-007 — phase 4

**Date :** 29 octobre 2026  
**Périmètre :** réponses HTTP 400 et 500 du workflow actif `03_API_CreateAppointment`.  
**Suite :** les tests sans écriture sont passés. Aucune création HTTP 201 n'a été lancée. Elle attend une autorisation séparée.

## 1. Sauvegarde et méthode de mise à jour

| Élément | Avant | Après |
|---|---|---|
| Workflow | `SXCesRUmGrV5FMzm`, actif | `SXCesRUmGrV5FMzm`, actif |
| Version publiée | `93ebd7e4-ee13-4fd8-8104-564e0c6ca3c8` | `269708a1-ad45-4c90-b223-033d9163a92e` |
| Nœuds | 8 | 12 |
| `versionCounter` | 25 | 27 |
| Réglages | `executionOrder` v1, `binaryMode` separate, `availableInMCP` false | identiques |

La copie d'avant modification est `n8n/live-exports/2026-10-29-rec007-phase4-before/SXCesRUmGrV5FMzm.json`.  
8 nœuds, version `93ebd7e4-ee13-4fd8-8104-564e0c6ca3c8`, 8 820 octets, SHA-256 `0ab58c7ea25ffc21aa189b4f323b8299c000f0d3963275c32ffdd145e0c84daf`. Elle est identique à l'export du 29 octobre déjà conservé. Le propriétaire n'y figure pas.

L'export après correction est `n8n/live-exports/2026-10-29-rec007-phase4-after/SXCesRUmGrV5FMzm.json`.  
12 241 octets, SHA-256 `06c77b75fff22268989f3d4c2eb8c00212cd96fc8b2940274496c227622dcd85`.

n8n 2.32.6 republie un workflow déjà publié quand l'API publique reçoit `PUT /api/v1/workflows/{id}`. `POST /api/v1/workflows/{id}/activate` avec un `versionId` republie une version de l'historique. Ces deux appels évitent l'import, qui désactive le workflow importé sur cette instance. Le conteneur n'a pas `N8N_API_KEY` dans son environnement, donc l'API publique n'a pas été appelée et aucune clé n'a été créée.

La mise à jour appliquée écrit la nouvelle définition dans `workflow_history`, pointe `workflow_entity.versionId` et `activeVersionId` vers elle, laisse `active` à vrai, puis redémarre le conteneur `govsuite-n8n` pour que le processus recharge la version publiée. L'ancien graphe de 8 nœuds reste dans l'historique. Les workflows 02, 08 et 10 n'ont pas été écrits.

Deux versions ont été publiées pendant cette phase :

| Version | Nœuds | Rôle |
|---|---:|---|
| `93ebd7e4-ee13-4fd8-8104-564e0c6ca3c8` | 8 | version d'origine, cible du retour arrière |
| `740ca2ae-87ea-4323-aa69-cfd57d869fc1` | 11 | version intermédiaire : un échec SQL répondait aussi HTTP 409 |
| `269708a1-ad45-4c90-b223-033d9163a92e` | 12 | version en service |

Le workflow est resté actif après chaque redémarrage. Les workflows 08 et 10 sont restés inactifs. Le workflow 02 est resté actif, version `37f59d20-4687-4c2c-aed6-ac14aed1a232`, 5 nœuds.

## 2. Nœuds

Nœuds ajoutés :

| Nœud | Rôle |
|---|---|
| `Demande valide ?` | IF sur `$json.ok`. Vrai vers `Créer rendez-vous`. Faux vers `Répondre validation`. |
| `Répondre validation` | HTTP 400, JSON `VALIDATION_ERROR`. |
| `Répondre erreur interne` | HTTP 500, JSON fixe `INTERNAL_ERROR`. |
| `Conserver le résultat` | Laisse passer le résultat SQL. Si la sortie d'erreur de `Créer rendez-vous` contient un élément, il ne transmet rien. |

Nœuds modifiés :

| Nœud | Modification |
|---|---|
| `Valider demande` | Les quatre contrôles prévus retournent `{ ok: false, error }` au lieu de lever une exception. Le succès retourne `ok: true` avec `slotId`, `nom`, `prenom`, `email`, `telephone`, `numeroDocument` et `langue`. |
| `Créer rendez-vous` | `onError` vaut `continueErrorOutput`. La sortie normale va vers `Conserver le résultat`. La sortie d'erreur va vers `Répondre erreur interne`. La requête SQL n'a pas changé. |

`POST /appointments`, `Vérifier création`, `If`, `Créer notification CONFIRMATION`, `Répondre` et `Répondre créneau indisponible` sont inchangés. Les identifiants de credentials PostgreSQL sont inchangés.

Ordre de validation : `slotId` manquant, `nom` manquant, `prenom` manquant, puis l'expression `/^[0-9a-fA-F-]{36}$/` après trim. Une valeur nulle, absente ou composée d'espaces est manquante. Le message ne répète pas la valeur reçue.

La branche 400 s'arrête à `Répondre validation`. Les exécutions 516 à 520 n'ont pas atteint `Créer rendez-vous`.

## 3. Tests sans écriture

Les appels finaux ont visé `POST http://127.0.0.1:5680/webhook/appointments` sur la version `269708a1-ad45-4c90-b223-033d9163a92e`.

| Contrôle | Résultat | HTTP observé |
|---|---|---|
| `slotId` absent | PASS | 400 `VALIDATION_ERROR`, « Le champ slotId est obligatoire. » |
| `slotId` mal formé (`zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz`) | PASS | 400 `VALIDATION_ERROR`, « Le champ slotId est invalide. » |
| `nom` absent | PASS | 400 `VALIDATION_ERROR`, « Le champ nom est obligatoire. » |
| `prenom` absent | PASS | 400 `VALIDATION_ERROR`, « Le champ prénom est obligatoire. » |
| `nom` composé d'espaces | PASS | 400 `VALIDATION_ERROR`, « Le champ nom est obligatoire. » |
| UUID inexistant `00000000-0000-4000-8000-000000000000` | PASS | 409, « Créneau introuvable ou complet » |
| Réponses sans donnée sensible | PASS | aucun `token_gestion`, requête SQL, `postgres`, `password`, adresse propriétaire ni référence `GB-` |
| Aucune création pour les demandes invalides | PASS | 13 rendez-vous, empreinte inchangée, 0 ligne `REC007%` |
| Échec SQL après validation | PASS | 500 `INTERNAL_ERROR`, « La création du rendez-vous n'a pas pu être traitée. » |
| Workflow 03 actif | PASS | actif, 12 nœuds, version `269708a1-ad45-4c90-b223-033d9163a92e` |
| Workflows 08 et 10 inactifs | PASS | versions inchangées, `active` faux |
| Création nominale HTTP 201 | BLOCKED | en attente d'autorisation |

Le corps 409 est `{"success":false,"created":false,"message":"Créneau introuvable ou complet"}`.  
Le corps 500 est `{"success":false,"error":{"code":"INTERNAL_ERROR","message":"La création du rendez-vous n'a pas pu être traitée."}}`.

L'exécution 521, UUID inexistant, traverse `Créer rendez-vous`, `Conserver le résultat`, `Vérifier création`, `If` et `Répondre créneau indisponible`. Elle ne passe pas par `Répondre erreur interne`.

L'exécution 522 envoie un `slotId` de 36 tirets. Cette chaîne passe l'expression actuelle, puis PostgreSQL refuse le cast. L'exécution traverse `Créer rendez-vous`, `Conserver le résultat` et `Répondre erreur interne`. Elle ne passe pas par `Vérifier création` ni par la réponse 409. Aucune ligne n'a été insérée.

La version intermédiaire `740ca2ae-87ea-4323-aa69-cfd57d869fc1` avait un défaut, corrigé avant ce tableau. Avec `continueErrorOutput`, n8n déplace l'erreur vers la seconde sortie, puis `alwaysOutputData` ajoute un élément vide sur la sortie normale. Les deux réponses partaient ensemble et le client recevait le HTTP 409. `Conserver le résultat` absorbe cet élément vide quand la sortie d'erreur est occupée. Cette version intermédiaire reste dans l'historique ; ce n'est pas la cible du retour arrière.

## 4. État des données

| Mesure | Valeur |
|---|---|
| Rendez-vous | 13, dont 0 `REC007%` |
| Empreinte des rendez-vous | `a2dea067599fd4f0a5f857551adc67cc` |
| Notifications | 14 |
| Historique des rendez-vous | 12 |
| Sessions `ai_conversation_state` | 48 |
| Créneau passeport `63428f11-0fed-4ab7-a457-472d846a4bbb` | 0 place, `DISPONIBLE` |
| Créneau état civil `43a9bb39-b14a-439f-bcd0-76eb93f22114` | 0 place, `DISPONIBLE` |
| Créneau préparé pour le 201 | 0 place, `DISPONIBLE` |
| Exécutions n8n | conservées, y compris 509 à 522 créées par cette phase |
| Courriel | aucun rendez-vous créé, workflow 08 inactif |

Les rendez-vous préexistants n'ont pas été modifiés. Aucune exécution historique n'a été supprimée. Les exécutions 509 à 515 correspondent à la version intermédiaire ; les exécutions 516 à 522 correspondent à la version en service. L'exécution 522 contient, dans les données internes de n8n, le message PostgreSQL du cast refusé. Ce texte n'est pas dans la réponse HTTP.

## 5. Création nominale préparée, non exécutée

Créneau dédié, futur, hors de la fenêtre passeport Paris du 2 au 6 novembre 2026 :

| Champ | Valeur |
|---|---|
| Créneau | `3f3b3cba-30e2-43d2-b2e5-dcb1ee01d2c0` |
| Service / site | PASSEPORT / PARIS |
| Début, heure de Paris | 2026-11-10 09:00 |
| Capacité | 2 |
| Places et statut | 0, `DISPONIBLE` |
| Rendez-vous déjà liés | 0 |

Identité synthétique, distincte des essais de la phase 2 :

| Champ | Valeur |
|---|---|
| nom | `REC007-PHASE4` |
| prenom | `SYNTHE-CREATE` |
| email | `rec007-phase4-create@example.test` |
| telephone | `0600000401` |
| numeroDocument | `P4-SYNTH-01` |
| langue | `fr` |

Contrôles à refaire immédiatement avant l'appel : 13 rendez-vous, empreinte `a2dea067599fd4f0a5f857551adc67cc`, 14 notifications, 12 historiques, 48 sessions, créneau encore à 0 et `DISPONIBLE`, workflow 03 actif sur `269708a1-ad45-4c90-b223-033d9163a92e`, workflows 08 et 10 inactifs.

Résultat attendu si l'appel est autorisé : HTTP 201, un rendez-vous `CONFIRME` sur ce créneau, une place réservée, le créneau reste `DISPONIBLE`, une notification `CONFIRMATION` / `EMAIL` / `A_ENVOYER`, une ligne d'historique `CREATION`. Les 13 rendez-vous précédents et les 48 sessions restent en place. Le workflow 08 étant inactif, l'envoi du courriel n'est pas déclenché par cet appel.

Nettoyage prévu, non exécuté. Une seule transaction, annulée si l'une des conditions manque : exactement une ligne portant ce nom, ce prénom, cette adresse et ce créneau ; le nombre de rendez-vous passe de 14 à 13 ; l'empreinte des 13 autres est `a2dea067599fd4f0a5f857551adc67cc`. La suppression de cette seule ligne emporte sa notification et son historique par `ON DELETE CASCADE`. Les places du créneau sont ensuite recalculées à partir des rendez-vous non annulés qui y restent. Aucun autre rendez-vous n'est visé.

## 6. Retour arrière

La cible est la version `93ebd7e4-ee13-4fd8-8104-564e0c6ca3c8`, 8 nœuds, toujours présente dans `workflow_history`. Ne pas republier `740ca2ae-87ea-4323-aa69-cfd57d869fc1`. Ne pas importer le workflow. Ne pas appeler `unpublish:workflow --all`. Ne pas désactiver le workflow 02.

Sans clé d'API, la séquence est :

1. Dans une transaction, recopier `nodes`, `connections` et `nodeGroups` de cette version d'historique vers `workflow_entity` pour `SXCesRUmGrV5FMzm` seulement si `json_array_length(nodes)` vaut 8.
2. Y remettre `versionId` et `activeVersionId` à `93ebd7e4-ee13-4fd8-8104-564e0c6ca3c8`, et `active` à vrai.
3. Valider seulement si une ligne a été mise à jour.
4. Redémarrer `govsuite-n8n`.
5. Vérifier que le workflow 03 est actif, qu'il a 8 nœuds, et que 08 et 10 sont inactifs.

Avec une clé d'API présente dans le conteneur, l'équivalent sans redémarrage est `POST /api/v1/workflows/SXCesRUmGrV5FMzm/activate` avec le corps `{"versionId":"93ebd7e4-ee13-4fd8-8104-564e0c6ca3c8"}`.

Ce retour arrière n'a pas été exécuté.

## 7. Limites qui restent

`Créer notification CONFIRMATION` s'exécute après la transaction de création. Si ce second nœud échoue, le rendez-vous et la notification déjà insérés par la requête de création peuvent exister alors que le client ne reçoit pas le HTTP 201. Un courriel absent peut suivre ce chemin : la requête de création n'insère pas de notification, puis le second nœud reçoit un destinataire vide. Ce cas n'a pas été provoqué. Le nœud n'a pas été modifié.

La requête de création n'exige pas un créneau futur. Les créneaux passés encore `DISPONIBLE` restent réservables. Elle continue d'interpoler `nom`, `prenom`, `email`, `telephone`, `numeroDocument` et `langue` après dédoublement des apostrophes. `slotId` est contrôlé par l'expression de 36 caractères, puis interpolé. Une chaîne de 36 tirets passe ce contrôle et devient le HTTP 500 observé. Ces trois points n'ont pas été corrigés dans cette phase.

Le HTTP 201 n'a pas été rejoué sur le nouveau graphe. La branche vraie transmet les sept champs lus par les nœuds suivants, plus `ok: true`. Les expressions de création, de vérification et de notification lisent ces mêmes champs. La compatibilité est structurelle ; elle n'a pas été confirmée par une création.

Les exécutions n8n de cette phase, et celles des phases précédentes, restent en base. Certaines contiennent les identités synthétiques et, pour l'échec de cast, le texte d'erreur PostgreSQL.

REC-008 n'est pas commencé.
