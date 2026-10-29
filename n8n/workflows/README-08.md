# 08_JOB_SendConfirmationEmails

Workflow n8n pour envoyer les notifications transactionnelles :

- `CONFIRMATION`
- `ANNULATION`
- `REPLANIFICATION`

## Import

Dans n8n : **Workflows → Import from File**, puis sélectionner `08_JOB_SendConfirmationEmails.json`.

## Credentials à associer après import

### Nœuds PostgreSQL
Associer votre credential PostgreSQL aux nœuds :

- `Chercher notifications transactionnelles`
- `Marquer notification transactionnelle ENVOYEE`

Configuration Docker habituelle :

- Host : `postgres`
- Port : `5432`
- Database : `govsuite`
- User : `govsuite`
- Password : valeur de `POSTGRES_PASSWORD`
- SSL : désactivé

### Nœud SMTP
Associer votre credential Mailpit au nœud `Envoyer email transactionnel` :

- Host : `mailpit`
- Port : `1025`
- User : vide
- Password : vide
- SSL/TLS : désactivé

## Test SQL

```sql
INSERT INTO notifications (
    rendez_vous_id,
    type,
    canal,
    destinataire,
    statut
)
SELECT
    id,
    'CONFIRMATION',
    'EMAIL',
    email,
    'A_ENVOYER'
FROM rendez_vous
WHERE reference = 'DEMO-2026-0001'
ON CONFLICT (rendez_vous_id, type, canal)
DO UPDATE SET
    statut = 'A_ENVOYER',
    sent_at = NULL,
    erreur = NULL;
```

Exécuter ensuite manuellement le workflow et vérifier Mailpit sur l'URL exposée par Docker, par exemple `http://localhost:8026`.

## Remarque

Le lien de gestion dans l'email utilise actuellement :

`http://localhost:5680/manage-appointment?token=...`

Il faudra le remplacer dans le nœud `Préparer email transactionnel` lorsque le portail citoyen sera disponible.
