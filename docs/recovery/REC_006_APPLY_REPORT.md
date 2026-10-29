# Rapport REC-006 — application du seed

**Date :** 29 octobre 2026  
**Périmètre :** application contrôlée de `database/seeds/seed_future_appointments.sql` sur la base locale `govsuite`.  
**Suite :** le nettoyage n'a pas été exécuté. REC-007 n'est pas commencé.

## 1. Cible

La cible est le PostgreSQL du projet local, conteneur `govsuite-postgres`, image `postgres:16-alpine`, base `govsuite`, utilisateur `govsuite`, port hôte `5433`. Le fuseau du serveur est `Europe/Paris`. La connexion utilisée est le socket local du conteneur. Aucun hôte distant n'est configuré dans `docker-compose.yml`.

`govsuite-n8n` et `govsuite-mailpit` étaient déjà démarrés. Aucun volume n'a été supprimé.

## 2. Sauvegardes contrôlées avant écriture

| Fichier | Taille | Contrôle |
|---|---|---|
| `backups/govsuite-pre-rec003-20261028.dump` | 524 319 octets, 28 octobre 2026 23:18:54 CET | `pg_restore -l` lit 943 entrées, format custom, PostgreSQL 16.14. Les données de `creneaux`, `rendez_vous`, `services`, `sites` et `workflow_entity` y figurent |
| `n8n/live-exports/2026-10-28-rec004/R7TKt5mqZYpeKapl.json` | 209 609 octets | JSON lisible : `10_AI_ConsularAssistant_Complete`, 84 nœuds, inactif. SHA-256 `ea6588fe6682adf825daef4a76b35fe5bcf89b3868471eefb31849fa5ff5e3db` |
| `n8n/live-exports/2026-10-28/CLnuFnZnejHNUkg9.json` | 9 377 octets | JSON lisible : `02_API_GetAvailability`, 5 nœuds, actif. SHA-256 `970efa99d37b21a0f1fffad46d5436ab87c38dabf07d634a9cc167310b8c98b1` |

Le dump du 28 octobre est antérieur à REC-003. Le restaurer écraserait l'état actuel. Il n'a pas été restauré.

Une sauvegarde de l'état immédiatement antérieur au seed a été prise :

`backups/govsuite-pre-rec006-apply-20261029.dump`

Archive custom du 29 octobre 2026 à 00:42:19 CET, 560 901 octets, 943 entrées, SHA-256 `a7cd1e9d1246042ffbcaaaf899d2c8519b48bc1768802e0280f43bc8c7464de3`. `pg_restore -l` y trouve les données de `creneaux`, `rendez_vous`, `jours_fermeture`, `services`, `sites` et `workflow_entity`. Elle n'a pas été restaurée.

## 3. Contrôles avant exécution

Horloge du contrôle détaillé : 29 octobre 2026, 00:41:37 +01. Le recalcul de la fenêtre a été refait à 00:43:09 +01, juste avant l'insertion.

| Contrôle | Résultat |
|---|---|
| Rendez-vous | 13 : 10 `CONFIRME`, 3 `ANNULE` |
| Empreinte des rendez-vous | `a2dea067599fd4f0a5f857551adc67cc` |
| Créneaux | 490, dont 0 futur |
| Empreinte des 490 créneaux historiques | `df3d899b7cd8e8f2e099a776b7e2c5a6` |
| Unicité | `creneaux_service_id_site_id_debut_key` = `UNIQUE (service_id, site_id, debut)` |
| Sites actifs | `PARIS` (`Europe/Paris`), `LISBONNE` (`Europe/Lisbon`) |
| Services actifs | `PASSEPORT` 30 min / 2, `VISA` 30 / 2, `LEGALISATION` 20 / 3, `ETAT_CIVIL` 45 / 1 |
| Liens actifs | les huit combinaisons |
| `jours_fermeture` | 0 ligne, laissée telle quelle |
| Marqueur | absent |
| Workflow 10 | inactif, 84 nœuds |
| `02_API_GetAvailability` | actif, 5 nœuds, non modifié |
| Créneaux attendus à 00:43:09 | 504, dont 0 déjà présent et 0 déjà passé |

À cette heure, le jour civil de Lisbonne était encore le 28 octobre et celui de Paris le 29 octobre. D'où 60 créneaux par service à Lisbonne (29 octobre au 11 novembre) et 66 à Paris (29 octobre au 12 novembre).

## 4. Exécution

Le seed a inséré **504** créneaux, le nombre recalculé. Le second passage, enchaîné aussitôt, a inséré **0** ligne. L'horizon n'a pas bougé entre les deux passages : les deux se sont terminés avant 01:00 heure de Paris, donc avant le changement de jour civil à Lisbonne.

Le second passage a seulement signalé que `seed_rec006_marqueur` et son index existaient déjà. C'est le comportement de `CREATE TABLE IF NOT EXISTS`.

## 5. Vérification après les deux passages

Horloge de contrôle : 29 octobre 2026, 00:44:22 +01.

| Mesure | Avant | Après |
|---|---|---|
| Créneaux | 490 | 994 |
| Marqueur REC-006 | 0 | 504 |
| Rendez-vous | 13 | 13 |
| Empreinte des rendez-vous | `a2dea067599fd4f0a5f857551adc67cc` | identique |
| Empreinte des créneaux d'avant octobre 2026 | `df3d899b7cd8e8f2e099a776b7e2c5a6` (490) | identique, 490 |
| Fermetures | 0 | 0 |
| Doublons `(service_id, site_id, debut)` | 0 | 0 |
| Créneaux marqués déjà passés |  | 0 |
| Écarts de capacité, de durée ou de statut |  | 0 |
| Créneaux hors lundi-vendredi ou hors 09:00-11:30 local |  | 0 |
| Créneaux historiques marqués |  | 0 |

Les 504 lignes sont `DISPONIBLE`, avec `places_reservees = 0` et la capacité du service. Aucun des 13 rendez-vous n'a changé de référence, de statut, de créneau ou de date de mise à jour. Le workflow 10 est resté inactif, à 84 nœuds. Le Chat Trigger n'a pas été activé.

| Service | Site | Insérés | Premier jour | Dernier jour | Capacité |
|---|---|---|---|---|---|
| `ETAT_CIVIL` | `LISBONNE` | 60 | 2026-10-29 | 2026-11-11 | 1 |
| `ETAT_CIVIL` | `PARIS` | 66 | 2026-10-29 | 2026-11-12 | 1 |
| `LEGALISATION` | `LISBONNE` | 60 | 2026-10-29 | 2026-11-11 | 3 |
| `LEGALISATION` | `PARIS` | 66 | 2026-10-29 | 2026-11-12 | 3 |
| `PASSEPORT` | `LISBONNE` | 60 | 2026-10-29 | 2026-11-11 | 2 |
| `PASSEPORT` | `PARIS` | 66 | 2026-10-29 | 2026-11-12 | 2 |
| `VISA` | `LISBONNE` | 60 | 2026-10-29 | 2026-11-11 | 2 |
| `VISA` | `PARIS` | 66 | 2026-10-29 | 2026-11-12 | 2 |

`PASSEPORT` / `PARIS` du 2 au 6 novembre 2026 : 30 créneaux en base. Les deux premiers sont le 2 novembre à 09:00 et à 09:30, heure de Paris, capacité 2, deux places libres.

## 6. API vivante

`GET http://localhost:5680/webhook/appointments/availability?service=PASSEPORT&site=PARIS&dateDebut=2026-11-02&dateFin=2026-11-06`

Réponse `200`, `success = true`, `count = 30`. Les 30 éléments ont un UUID, le service `PASSEPORT`, le site `PARIS`, une capacité 2, 0 place réservée et 2 places disponibles. Le premier identifiant est `c67261c3-3166-4c0a-8c54-25b760a7d487` (2 novembre 2026, 09:00-09:30 +01). Le second est `9499fe3b-088f-4cb3-b56a-ed6eea266706` (09:30-10:00 +01). Ces deux identifiants et ces horaires sont ceux lus en base. Le dernier début de la réponse est le 6 novembre 2026 à 11:30 +01.

La requête vivante ne renvoie pas la colonne `statut`. Le filtre SQL exige déjà `DISPONIBLE`. Aucun rendez-vous n'a été créé : le décompte est resté à 13 après l'appel. `POST /appointments` n'a pas été utilisé.

## 7. Anomalies

Aucune anomalie d'insertion. Trois points de lecture, sans correction dans cette mission :

- Le 11 novembre 2026 est présent, car `jours_fermeture` est vide. Cette table n'a pas été modifiée.
- Lisbonne s'arrête au 11 novembre et Paris va jusqu'au 12, à cause des jours civils au moment de l'exécution.
- `ETAT_CIVIL` dure 45 minutes sur un pas de 30 minutes. Les créneaux consécutifs de ce service se chevauchent, comme dans `postgres/init.sql`. Les créneaux `PASSEPORT` du test API durent 30 minutes et se succèdent sans chevauchement.

## 8. Retour arrière ciblé, non exécuté

Le script `database/seeds/cleanup_future_appointments.sql` retire seulement les créneaux marqués `REC-006` qui sont encore `DISPONIBLE`, avec `places_reservees = 0` et sans rendez-vous. À l'état actuel, cela concerne les 504 lignes insérées. Les 490 créneaux historiques et les 13 rendez-vous restent dehors de ce critère.

```powershell
Get-Content -Raw -Encoding utf8 "database\seeds\cleanup_future_appointments.sql" | docker exec -i govsuite-postgres psql -U govsuite -d govsuite -v ON_ERROR_STOP=1
```

Cette commande n'a pas été lancée.

Le dump `backups/govsuite-pre-rec006-apply-20261029.dump` est une photographie d'avant le seed. Le restaurer remplacerait aussi les exécutions n8n postérieures à 00:42:19 CET, dont l'appel de disponibilité. Ce n'est pas le retour arrière des seuls créneaux, et il n'a pas été lancé. Le dump du 28 octobre ne doit pas être restauré.

## 9. Suite

Le seed est appliqué sur `govsuite`. Le workflow principal n'a pas été modifié. REC-007 n'est pas commencé. J'attends votre accord pour l'ouvrir.
