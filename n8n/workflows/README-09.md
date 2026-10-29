# 09_JOB_SendReminderEmails

Workflow n8n chargé d'envoyer les notifications de rappel :

- RAPPEL_J7
- RAPPEL_J1
- RAPPEL_H2

## Après import

1. Associer votre credential PostgreSQL aux nœuds :
   - Chercher rappels A_ENVOYER
   - Marquer rappel ENVOYE

2. Associer votre credential SMTP Mailpit au nœud :
   - Envoyer email de rappel

   Configuration Docker interne :
   - Host : mailpit
   - Port : 1025
   - SSL/TLS : désactivé
   - Utilisateur / mot de passe : vides

3. Le workflow est importé désactivé.
   Testez-le manuellement avant de le publier.

## Dépendance

Le workflow 07_JOB_AppointmentReminders doit créer les notifications
au statut A_ENVOYER. Le workflow 09 se charge uniquement de leur envoi.

## Test rapide

Remettre une notification RAPPEL_H2 en attente :

UPDATE notifications
SET statut = 'A_ENVOYER',
    sent_at = NULL
WHERE type = 'RAPPEL_H2'
  AND rendez_vous_id = (
      SELECT id
      FROM rendez_vous
      WHERE reference = 'DEMO-2026-0001'
  );

Puis exécuter manuellement le workflow 09.
