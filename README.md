# GovSuite Appointments — MVP local

Socle Docker pour un système de rendez-vous consulaires : visas, passeports, légalisation et état civil.

## Services

- PostgreSQL 16 : base métier + persistance n8n
- n8n : orchestration et API par webhooks
- Mailpit : SMTP de test et boîte mail locale

## 1. Prérequis

- Docker Desktop / Docker Engine
- Docker Compose v2

## 2. Lancement

Depuis ce dossier :

```bash
docker compose up -d
```

Vérifier :

```bash
docker compose ps
```

## 3. Accès

- n8n : http://localhost:5678
- Mailpit : http://localhost:8025
- PostgreSQL : localhost:5432

Connexion PostgreSQL :

- Base : `govsuite`
- Utilisateur : `govsuite`
- Mot de passe : voir `.env`

## 4. Vérifier la base

```bash
docker compose exec postgres psql -U govsuite -d govsuite -c "SELECT code, nom, duree_minutes FROM services ORDER BY code;"
```

Créneaux :

```bash
docker compose exec postgres psql -U govsuite -d govsuite -c "SELECT s.code, si.code AS site, c.debut, c.capacite, c.places_reservees, c.statut FROM creneaux c JOIN services s ON s.id=c.service_id JOIN sites si ON si.id=c.site_id ORDER BY c.debut LIMIT 20;"
```

Rendez-vous de démonstration :

```bash
docker compose exec postgres psql -U govsuite -d govsuite -c "SELECT reference, nom, prenom, email, statut, token_gestion FROM rendez_vous;"
```

## 5. Configurer PostgreSQL dans n8n

Dans n8n, créer un credential **Postgres** :

- Host : `postgres`
- Database : `govsuite`
- User : `govsuite`
- Password : valeur de `POSTGRES_PASSWORD` dans `.env`
- Port : `5432`
- SSL : désactivé en local

Important : depuis n8n, l'hôte est `postgres`, pas `localhost`.

## 6. Configurer Mailpit dans n8n

Créer un credential SMTP :

- Host : `mailpit`
- Port : `1025`
- SSL/TLS : désactivé
- Authentification : aucune

Tous les emails apparaîtront dans http://localhost:8025.

## 7. Réinitialiser complètement la base

Le script `postgres/init.sql` n'est exécuté automatiquement que lors de la création initiale du volume PostgreSQL.

Pour repartir de zéro :

```bash
docker compose down -v
docker compose up -d
```

Attention : `down -v` supprime les données locales PostgreSQL, n8n et Mailpit de ce projet.

## 8. Données initiales

Services :

- PASSEPORT — 30 min — capacité 2
- VISA — 30 min — capacité 2
- LEGALISATION — 20 min — capacité 3
- ETAT_CIVIL — 45 min — capacité 1

Sites :

- PARIS
- LISBONNE

Le script génère automatiquement des créneaux sur les prochains jours ouvrés et crée un rendez-vous `DEMO-2026-0001`.

## 9. Sécurité

Les secrets de `.env` sont uniquement adaptés au développement local. Avant une mise en production :

- remplacer tous les secrets ;
- ne pas versionner `.env` ;
- exposer n8n derrière HTTPS/Nginx ;
- activer les cookies sécurisés ;
- utiliser des comptes PostgreSQL séparés avec privilèges minimaux ;
- protéger les webhooks publics ;
- ajouter authentification, rate limiting et journalisation.

## 10. Prochaine étape

Créer le premier workflow n8n :

`01_API_GetServices`

Flux :

```text
Webhook GET /services
  -> Postgres SELECT services actifs
  -> Respond to Webhook JSON
```

Puis :

`02_API_GetAvailability` et `03_API_CreateAppointment`.
