# Rapport REC-006

**Date :** 29 octobre 2026  
**Périmètre :** génération idempotente de créneaux futurs.  
**Suite :** le seed n'a pas été exécuté sur `govsuite`. REC-007 n'est pas commencé.

## 1. Ce qui a été lu, et ce qui est resté en place

Les références relues sont le PRD, `docs/architecture/AS_IS_ANALYSIS.md`, `docs/planning/DEVELOPMENT_RECOVERY_PLAN.md` et `docs/recovery/REC_004_005_REPORT.md`.

L'audit de la base `govsuite` s'est limité à des lectures. Le script `database/seeds/seed_future_appointments.sql` a été exécuté sur un PostgreSQL 16 isolé, conteneur `govsuite-rec006-pg`, base `govsuite_rec006`, fuseau `Europe/Paris`. Ce conteneur a ensuite été supprimé. Aucun volume Docker n'a été supprimé : `govsuite-appointments_postgres_data`, `govsuite-appointments_n8n_data` et `govsuite-appointments_mailpit_data` sont toujours là. Le volume anonyme du conteneur de test, `a646ec62b7155e94dcb9db62cc565bf7bc92332f8b185cff8d6f0e84f11a26a2`, a été laissé en place pour la même raison.

Après ces opérations, la base métier est inchangée :

| Élément | Valeur |
|---|---|
| Créneaux | 490 |
| Créneaux dont le début est encore futur | 0 |
| Rendez-vous | 13 |
| `seed_rec006_marqueur` | absente |
| Workflow 10 | inactif, 84 nœuds |
| Version du workflow 10 | `88a1f42a-ab9e-4eff-bfd9-996c31976b16` |
| `updatedAt` du workflow 10 | 21 septembre 2026, 23:17:43 +02 |
| `02_API_GetAvailability` | actif, 5 nœuds, non modifié |

Le webhook de disponibilité et `CREATE_APPOINTMENT` n'ont pas été appelés. Le workflow 10 n'a pas été activé.

## 2. Audit du modèle

Il n'existe pas de table d'horaires. Les tables présentes et utilisées sont `sites`, `services`, `service_sites`, `creneaux`, `rendez_vous` et `jours_fermeture`. Aucun déclencheur n'est posé sur ces tables. Le fuseau du serveur est `Europe/Paris`.

### Colonnes et types

| Table | Colonnes utiles |
|---|---|
| `sites` | `id` uuid, `code` varchar unique, `nom`, `timezone` varchar défaut `Europe/Paris`, `actif` booléen |
| `services` | `id` uuid, `code` varchar unique, `duree_minutes` entier > 0, `capacite_par_creneau` entier > 0, `actif` booléen |
| `service_sites` | clé primaire `(service_id, site_id)`, `actif` booléen, clés étrangères en cascade |
| `creneaux` | `debut` et `fin` en `timestamptz`, `capacite` > 0, `places_reservees` >= 0, `statut` varchar |
| `rendez_vous` | `creneau_id` obligatoire, sans suppression en cascade, `statut` varchar, `reference` et `token_gestion` uniques |
| `jours_fermeture` | `date_debut` et `date_fin` de type `date`, intervalle inclusif |

### Contraintes qui pilotent le seed

| Contrainte | Règle |
|---|---|
| `creneaux_service_id_site_id_debut_key` | `UNIQUE (service_id, site_id, debut)` |
| `creneaux_statut_check` | `DISPONIBLE`, `COMPLET`, `BLOQUE`, `ANNULE` |
| `ck_creneau_dates` | `fin > debut` |
| `ck_creneau_places` | `places_reservees <= capacite` |
| `rendez_vous_statut_check` | `EN_ATTENTE`, `CONFIRME`, `ANNULE`, `REPLANIFIE`, `PRESENT`, `ABSENT`, `TERMINE` |

L'unicité `(service_id, site_id, debut)` est déjà en base. Le schéma de `creneaux` n'a donc pas été modifié. Le seed s'arrête avant toute insertion si cette contrainte disparaît.

### Données réellement présentes

| Code | Détail |
|---|---|
| `PARIS` | `Europe/Paris`, actif |
| `LISBONNE` | `Europe/Lisbon`, actif |
| `LYON` | absent |

| Service | Durée | Capacité par créneau | Actif |
|---|---|---|---|
| `PASSEPORT` | 30 min | 2 | oui |
| `VISA` | 30 min | 2 | oui |
| `LEGALISATION` | 20 min | 3 | oui |
| `ETAT_CIVIL` | 45 min | 1 | oui |

Les huit liens `service_sites` sont actifs. `jours_fermeture` contient 0 ligne.

Les 490 créneaux vont du 30 juillet 2026 09:00 au 3 septembre 2026 11:00. 488 sont `DISPONIBLE`, 2 sont `COMPLET`. Les capacités copiées sur les créneaux correspondent encore aux services. Il n'y a aucun doublon `(service_id, site_id, debut)`.

La grille historique dominante est celle de `postgres/init.sql` : lundi à vendredi, 09:00, 09:30, 10:00, 10:30, 11:00 et 11:30 dans le fuseau du site. Trois créneaux `PASSEPORT` / `PARIS` sortent de cette grille et ne définissent pas un horaire : le samedi 1er août 2026 à 01:15, déjà lié à un rendez-vous, puis le 13 août et le 2 septembre 2026 à 14:00. Le seed ne les reproduit pas et ne les modifie pas.

Les 13 rendez-vous se répartissent en 10 `CONFIRME` et 3 `ANNULE`. La somme de `places_reservees` vaut 10, portée par 9 créneaux. Aucun rendez-vous n'est orphelin.

## 3. Règle de génération

`database/seeds/seed_future_appointments.sql` ne crée ni service, ni site, ni rendez-vous. Il lit les liens actifs.

Pour chaque site, le jour de départ est la date civile locale au moment de l'exécution. L'horizon s'arrête 14 jours plus tard, bornes incluses. Sont conservés les jours ISO 1 à 5 qui ne tombent dans aucune fermeture du site. Les heures locales sont 09:00 à 11:30, pas de 30 minutes. L'instant est converti avec `AT TIME ZONE` du site. La fin vaut le début plus `duree_minutes`. La capacité est `capacite_par_creneau`. Le statut est `DISPONIBLE`, avec `places_reservees = 0`.

Un candidat dont le début n'est pas strictement postérieur à `clock_timestamp()` est écarté. Un triplet déjà présent est ignoré par `ON CONFLICT (service_id, site_id, debut) DO NOTHING`. Aucune ligne existante n'est mise à jour : un créneau déjà réservé, complet, bloqué ou annulé reste tel quel, et il n'est pas marqué.

Les identifiants réellement insérés sont enregistrés dans `public.seed_rec006_marqueur`, créée par le seed seulement. `database/seeds/cleanup_future_appointments.sql` supprime un créneau marqué `REC-006` seulement s'il est `DISPONIBLE`, si `places_reservees = 0` et si aucun rendez-vous ne le référence. Les autres créneaux marqués restent, ainsi que leur rendez-vous. Le nettoyage refuse de partir si la table marqueur est absente. Cette branche d'erreur est dans le script ; les essais exécutés ont couvert la table déjà présente.

## 4. Volume prévu sur `govsuite`, non inséré

Le décompte suivant est un `SELECT` exécuté le 29 octobre 2026 à 00:29:44 +01. Il n'a rien écrit. À cette heure, Lisbonne était encore le 28 octobre à 23:29. Le script recalcule cette fenêtre à chaque exécution : le total change dès qu'une heure locale est passée, ou dès que Lisbonne change de jour civil, ici à 01:00 heure de Paris.

| Service | Site | Créneaux | Premier jour local | Dernier jour local | Capacité |
|---|---|---|---|---|---|
| `ETAT_CIVIL` | `LISBONNE` | 60 | 2026-10-29 | 2026-11-11 | 1 |
| `ETAT_CIVIL` | `PARIS` | 66 | 2026-10-29 | 2026-11-12 | 1 |
| `LEGALISATION` | `LISBONNE` | 60 | 2026-10-29 | 2026-11-11 | 3 |
| `LEGALISATION` | `PARIS` | 66 | 2026-10-29 | 2026-11-12 | 3 |
| `PASSEPORT` | `LISBONNE` | 60 | 2026-10-29 | 2026-11-11 | 2 |
| `PASSEPORT` | `PARIS` | 66 | 2026-10-29 | 2026-11-12 | 2 |
| `VISA` | `LISBONNE` | 60 | 2026-10-29 | 2026-11-11 | 2 |
| `VISA` | `PARIS` | 66 | 2026-10-29 | 2026-11-12 | 2 |
| **Total** | | **504** | | | |

Aucun de ces 504 triplets n'existe déjà. `jours_fermeture` étant vide, le 11 novembre 2026, mercredi, est inclus. Paris couvre aussi le 12 novembre ; Lisbonne s'arrête au 11 novembre à cause de son jour civil. Les heures locales sont les six heures de la grille, sur les lundi-vendredi de chaque intervalle.

Pour `PASSEPORT` / `PARIS`, la requête de disponibilité du 2 au 6 novembre 2026 représenterait 30 créneaux, tous de capacité 2.

## 5. Essais sur la base isolée

Le conteneur a reçu `postgres/init.sql`, donc les mêmes contraintes que le dépôt, déjà comparées à la base réelle. Les créneaux futurs produits par cet init, et son rendez-vous de démonstration, ont été retirés de cette base de test afin que le premier passage du seed soit la source des créneaux futurs, comme sur `govsuite` aujourd'hui. Les 13 rendez-vous réels n'ont pas été copiés.

Le jeu isolé contenait trois créneaux préexistants et quatre rendez-vous de fixture : un créneau passé `COMPLET` à deux places, un rendez-vous passé `ANNULE` sur un créneau à zéro place, et un `PASSEPORT` / `PARIS` du 29 octobre 2026 à 09:00 déjà réservé d'une place. Un service inactif et une fermeture de Lisbonne le 2 novembre 2026 ont été ajoutés dans cette base seulement, pour vérifier les filtres. `govsuite` n'a ni ce service, ni cette fermeture.

| Contrôle | Résultat |
|---|---|
| Premier passage | 479 insertions. L'écart avec 504 est la fermeture de test (4 services × 6 heures) et le créneau déjà réservé |
| Deuxième passage | 0 insertion, 0 doublon |
| Débuts marqués | tous strictement futurs |
| Capacité, durée, statut | 0 écart avec le service ; statut `DISPONIBLE` ; `places_reservees = 0` |
| Jours et heures | 0 créneau hors lundi-vendredi ou hors 09:00-11:30 local |
| Service inactif | 0 créneau |
| `LYON` | toujours absent |
| Lisbonne le 2 novembre | 0 créneau, fermeture de test respectée |
| Créneau pré-réservé | places, statut et rendez-vous inchangés ; hors marqueur |
| Quatre rendez-vous de fixture | 0 écart sur la référence, le statut, le créneau, le jeton et `updated_at` |
| `PASSEPORT` / `PARIS`, 2 au 6 novembre 2026 | 30 disponibilités |
| Second créneau de cette liste | 2 novembre 2026, 09:30, fuseau `Europe/Paris`, capacité 2, 0 place réservée, 2 places libres |

La requête rejouée est celle du nœud vivant `Chercher créneaux` de `02_API_GetAvailability` : paramètres `PASSEPORT`, `PARIS`, `2026-11-02`, `2026-11-06`, filtre `DISPONIBLE`, `places_reservees < capacite`, `debut > NOW()`, et bornes `[dateDebut, lendemain de dateFin)`. La session était en `Europe/Paris`.

Un créneau marqué `VISA` / `PARIS` a ensuite été réservé dans la base isolée. Le nettoyage a supprimé 478 créneaux et en a conservé 1. Les fixtures préexistantes sont restées intactes. Un second nettoyage a supprimé 0 ligne et conservé la ligne réservée. Un nouveau passage du seed a réinséré 478 créneaux, sans dupliquer le créneau réservé ni le créneau de collision.

## 6. Scénario préparé pour REC-007

REC-007 n'a pas été lancé. Le scénario compatible avec les créneaux projetés, et avec la collecte déjà validée par REC-004 et REC-005, est :

1. demande de renouvellement de passeport ;
2. site Paris ;
3. période du 02/11/2026 au 06/11/2026 ;
4. recherche `GET_AVAILABILITY` ;
5. choix « Je prends le 2 » ;
6. nom, prénom, e-mail et téléphone.

`Appeler GetAvailability` envoie seulement `service`, `site`, `dateDebut` et `dateFin`. Pour ce scénario, les valeurs sont `PASSEPORT`, `PARIS`, `2026-11-02` et `2026-11-06`. Le second créneau ordonné par `debut` est le 2 novembre 2026 à 09:30, heure de Paris. Il est `DISPONIBLE`, de capacité 2, avec `places_reservees = 0`.

Le nœud vivant `Créer rendez-vous` verrouille le créneau, exige `DISPONIBLE` et `places_reservees < capacite`, puis insère le rendez-vous. Ce créneau satisfait ce prédicat. L'appel n'a pas été fait, ni par le workflow 03, ni par le workflow 10.

Cette période est entièrement dans l'horizon de Paris pour une exécution du seed le 29 octobre 2026. Elle le reste tant que les débuts visés sont futurs et que le jour civil local du site, plus 14 jours, couvre encore le 6 novembre. Une exécution après le 2 novembre 2026 à 09:00 heure de Paris omet les créneaux de cette période déjà passés.

## 7. Risques

- Le total 504 est celui de 00:29 le 29 octobre 2026. Plus tard le même matin, les heures de 09:00 à 11:30 déjà écoulées sortent de la génération. À partir de 01:00 heure de Paris, Lisbonne passe au 29 octobre et son horizon avance d'un jour.
- Aucun calendrier de jours fériés n'existe. Le 11 novembre 2026 sera généré. Pour l'exclure, il faut une ligne dans `jours_fermeture` avant le seed.
- `ETAT_CIVIL` dure 45 minutes avec un pas de 30 minutes. Deux créneaux consécutifs se chevauchent de 15 minutes, comme dans `postgres/init.sql`. `PASSEPORT` dure 30 minutes : les créneaux du scénario REC-007 se succèdent sans chevauchement.
- Le fichier `n8n/workflows/02_API_GetAvailability.json` interpole encore la requête et ne filtre pas `debut > NOW()`. Le workflow vivant, lui, est paramétré et applique ce filtre. La compatibilité a été vérifiée sur le SQL vivant.
- Les bornes de date de cette requête utilisent le fuseau de la session, `Europe/Paris`. Avec des débuts entre 09:00 et 11:30, un créneau de Lisbonne reste dans la même date civile à Paris, en heure d'hiver comme en heure d'été.
- Un créneau déjà présent dans la fenêtre n'est ni modifié ni marqué. Le nettoyage ne le retire donc pas.
- Un créneau marqué puis réservé est conservé par le nettoyage, avec son rendez-vous.
- Le premier passage autorisé créera `seed_rec006_marqueur` dans `govsuite`. Cette table ne contient que des identifiants de créneaux.

## 8. Exécution proposée, en attente d'accord

Depuis la racine du projet, après accord explicite :

```powershell
Get-Content -Raw -Encoding utf8 "database/seeds/seed_future_appointments.sql" | docker exec -i govsuite-postgres psql -U govsuite -d govsuite -v ON_ERROR_STOP=1
```

Le premier résultat attendu, si l'horloge est encore celle de la projection, est `creneaux_inseres = 504`. Un second passage doit afficher `0`. Le nettoyage ciblé, lui aussi après accord, est :

```powershell
Get-Content -Raw -Encoding utf8 "database/seeds/cleanup_future_appointments.sql" | docker exec -i govsuite-postgres psql -U govsuite -d govsuite -v ON_ERROR_STOP=1
```

J'attends votre accord avant toute exécution sur `govsuite`. REC-007 n'est pas commencé.
