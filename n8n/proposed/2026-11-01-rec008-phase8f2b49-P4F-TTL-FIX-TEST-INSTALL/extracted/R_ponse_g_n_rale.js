// --- P4E/P4F START REPONSE ---
let managed = {};
try { managed = $('Gérer collecte progressive').item.json || {}; } catch (e) { managed = {}; }
if (managed.sessionExpired === true && managed.preserveDraft === true) {
  return [{ json: {
    type: 'session_expired',
    text: 'Votre session de conversation a expiré. Pour reprendre la demande en cours, répondez « reprendre ». Sinon, formulez une nouvelle demande.'
  }}];
}
return [{ json: {
  type: 'general',
  text: 'Je peux vous aider à consulter les services consulaires, rechercher des disponibilités, créer, consulter, annuler ou replanifier un rendez-vous. Indiquez simplement ce que vous souhaitez faire.'
}}];
// --- P4E/P4F END REPONSE ---