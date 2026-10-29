# 10_AI_ConsularAssistant

Première version sécurisée de l'assistant consulaire GovSuite.

## Contenu

- Chat Trigger n8n
- AI Agent
- Ollama Chat Model
- Mémoire de conversation
- Prompt système consulaire en français

## Après l'import

1. Ouvrir le nœud `Ollama Chat Model`.
2. Sélectionner le credential Ollama déjà créé :
   `http://host.docker.internal:11434`
3. Vérifier le modèle :
   `deepseek-r1:latest`
4. Enregistrer le workflow.
5. Cliquer sur `Chat` ou `Test workflow`.
6. Tester :
   `Bonjour, je souhaite renouveler mon passeport à Paris.`

## Limitation volontaire de cette version

L'agent ne crée, n'annule et ne replanifie pas encore de rendez-vous.
Cette restriction évite toute modification métier non contrôlée pendant
la validation du modèle, de la mémoire et du prompt.

## Étape suivante

Connecter progressivement les outils GovSuite :

- getServices
- getAvailableSlots
- createAppointment
- getAppointment
- cancelAppointment
- rescheduleAppointment

Les outils devront appeler les URL de production internes n8n, par exemple :

- http://govsuite-n8n:5678/webhook/services
- http://govsuite-n8n:5678/webhook/appointments/availability
- http://govsuite-n8n:5678/webhook/appointments

Le nom DNS exact dépend du nom du service ou du conteneur Docker.
