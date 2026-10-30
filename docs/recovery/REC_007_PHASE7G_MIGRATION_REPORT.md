# REC-007 — Phase 7G — Migration PostgreSQL

La migration d'idempotence a été appliquée une fois, puis validée. Le workflow n8n n'a pas été publié. La fonction n'a pas été appelée. Aucun rendez-vous n'a été créé.

## 1. Préflight

Toutes les conditions étaient réunies. Aucun arrêt avant l'écriture de la sauvegarde, puis de la migration.

| Contrôle | Résultat |
|---|---|
| PostgreSQL | 16.14, isolation `read committed` |
| Workflow 03 `SXCesRUmGrV5FMzm` | Actif, 11 nœuds, version `c48ffad5-4f36-4c7e-9abf-11ce6fa2d9e6`, `versionCounter` 29 |
| Workflow 08 `ZbZoj4yF1s5a3B5E` | Inactif, 5 nœuds, `versionCounter` 5 |
| Workflow 10 `R7TKt5mqZYpeKapl` | Inactif, 84 nœuds, `versionCounter` 654 |
| Compteurs | 13 rendez-vous, 14 notifications, 12 historiques, 48 sessions |
| Empreinte des rendez-vous | `a2dea067599fd4f0a5f857551adc67cc` |
| Colonnes `cle_idempotence` et `empreinte_requete` | Absentes |
| Fonction `creer_rendez_vous_idempotent` | Absente |
| Transactions non idle et exécutions n8n `running`, `new` ou `waiting` sur le workflow 03 | Aucune |
| Migration SHA-256 | `8df62d2319b75a9e8f2ad1cbe02a80b8de3a29b9cdd442c9e40950b70a033b4e`, 10 575 octets |

## 2. Sauvegardes

La sauvegarde précédente est intacte : `backups/govsuite-pre-rec007-20261029.dump`, 596 983 octets, SHA-256 `7859b0c80ef1f074d2e5d2e3ef3728933b02f10ac0f9f2a275f30013f0493112`. `pg_restore -l` s'est terminé avec le code 0 et liste les données de `rendez_vous`, `notifications`, `historique_rendez_vous`, `creneaux` et `ai_conversation_state`. Elle n'a pas été restaurée.

Nouvelle sauvegarde, prise avant la migration : `backups/govsuite-pre-rec007-phase7g-20261030-002948.dump`.

| Contrôle | Résultat |
|---|---|
| Code de `pg_dump` | 0 |
| Taille | 597 596 octets |
| SHA-256 | `c1628a545a37d1ee859f0a0a104104099a10df08ea3012b6b42be2e63c4a0c1a` |
| `pg_restore -l` | Code 0, mêmes cinq tables de données présentes |

## 3. Exécution

Le fichier `postgres/migrations/20261029_rec007_idempotence.sql` a été exécuté une seule fois, octets inchangés, avec arrêt à la première erreur. La transaction du fichier a été respectée. Il n'y a pas eu de seconde tentative.

Code de retour 0. Enchaînement reçu : `BEGIN`, deux `ALTER TABLE`, `CREATE INDEX`, deux `COMMENT` de colonnes, `CREATE FUNCTION`, `COMMENT` de fonction, `REVOKE`, `GRANT`, `COMMIT`.

## 4. Objets créés

| Objet | État lu |
|---|---|
| `rendez_vous.cle_idempotence` | `varchar(64)`, nullable, sans défaut |
| `rendez_vous.empreinte_requete` | `varchar(64)`, nullable, sans défaut |
| `ck_rendez_vous_idempotence` | Les deux colonnes sont nulles ensemble, ou toutes deux renseignées et conformes à `^[0-9a-f]{64}$` |
| `uq_rendez_vous_cle_idempotence` | Index unique partiel sur `cle_idempotence` où elle n'est pas nulle |
| `public.creer_rendez_vous_idempotent(uuid, text, text, text, text, text, text, text)` | Présente, `VOLATILE` |
| Sécurité | `SECURITY INVOKER` (`prosecdef` faux) |
| `search_path` | `pg_catalog, public` |
| Droit d'exécution | `EXECUTE` pour `govsuite` seul |

Les 13 rendez-vous ont les deux colonnes nulles.

## 5. Intégrité et workflows

| Contrôle | Après migration |
|---|---|
| Rendez-vous, notifications, historiques, sessions | 13, 14, 12, 48 |
| Empreinte | `a2dea067599fd4f0a5f857551adc67cc` |
| Workflow 03 | Actif, version `c48ffad5-4f36-4c7e-9abf-11ce6fa2d9e6`, 11 nœuds, `versionCounter` 29 |
| Workflows 08 et 10 | Inactifs |

Aucune anomalie. Le rollback n'a pas été lancé. Les colonnes et l'index n'ont pas été retirés.

## 6. Verdict

**GO** pour un test ultérieur de la fonction dans une transaction explicitement annulée. Cet appel ne doit pas passer par le webhook, ne doit pas laisser de rendez-vous, et doit retrouver l'empreinte `a2dea067599fd4f0a5f857551adc67cc` après `ROLLBACK`.

**NO-GO** pour publier le workflow, pour un POST de création, et pour REC-008. Le payload préparé reste en attente d'une autorisation distincte, après ce test annulé.

Cette phase s'arrête ici.
