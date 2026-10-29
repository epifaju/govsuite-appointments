# Workflows n8n — GovSuite Appointments

Ces workflows sont prêts à être importés dans n8n.

## Fichiers

- `01_API_GetServices.json` — GET `/webhook/services`
- `02_API_GetAvailability.json` — GET `/webhook/appointments/availability?service=PASSEPORT&site=PARIS&dateDebut=2026-08-03&dateFin=2026-08-07`
- `03_API_CreateAppointment.json` — POST `/webhook/appointments`
- `04_API_GetAppointment.json` — GET `/webhook/appointments/manage?token=...`
- `05_API_CancelAppointment.json` — POST `/webhook/appointments/cancel`
- `06_API_RescheduleAppointment.json` — POST `/webhook/appointments/reschedule`
- `07_JOB_AppointmentReminders.json` — crée chaque heure les rappels à envoyer dans `notifications`.

## Après import : credential PostgreSQL

Chaque nœud Postgres doit utiliser le même credential :

- Host : `postgres`
- Port : `5432`
- Database : valeur de `POSTGRES_DB` (par défaut `govsuite`)
- User : valeur de `POSTGRES_USER`
- Password : valeur de `POSTGRES_PASSWORD`
- SSL : désactivé en local Docker

Créez le credential une fois, puis sélectionnez-le dans tous les nœuds Postgres.

## Import

Dans n8n : Workflows → Import from File → sélectionner les JSON.

Vous pouvez aussi copier les fichiers dans le conteneur via le volume déjà monté `/files/workflows`.

## Exemples

### Créer un rendez-vous

POST `/webhook/appointments`

```json
{
  "slotId": "UUID_DU_CRENEAU",
  "nom": "SILVA",
  "prenom": "Joao",
  "email": "joao@example.test",
  "telephone": "+33600000000",
  "langue": "fr"
}
```

### Annuler

POST `/webhook/appointments/cancel`

```json
{
  "token": "TOKEN_GESTION",
  "motif": "Indisponibilité"
}
```

### Replanifier

POST `/webhook/appointments/reschedule`

```json
{
  "token": "TOKEN_GESTION",
  "slotId": "NOUVEAU_CRENEAU_UUID"
}
```

## Important

Les workflows `07_JOB_AppointmentReminders` alimentent la table `notifications`. L'envoi SMTP Mailpit sera ajouté comme workflow séparé afin de garder la génération des notifications et leur livraison découplées.
