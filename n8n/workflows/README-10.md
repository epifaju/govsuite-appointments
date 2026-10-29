# 10_AI_ConsularAssistant_Complete

Compatible n8n 2.32.x. Architecture déterministe :
Chat Trigger → Ollama/Basic LLM Chain → Parser → Switch → APIs métier.

Après import :
1. Ouvrir `Ollama Chat Model`.
2. Sélectionner votre credential `Ollama account`.
3. Vérifier `qwen2.5:1.5b`, Temperature 0, Context Length 1024.
4. Publier/activer les workflows API 01 à 06.
5. Tester d'abord : `Quels services consulaires sont disponibles ?`

Endpoints attendus :
- GET http://localhost:5678/webhook/services
- GET http://localhost:5678/webhook/appointments/availability
- POST http://localhost:5678/webhook/appointments
- GET http://localhost:5678/webhook/appointments/manage
- POST http://localhost:5678/webhook/appointments/cancel
- POST http://localhost:5678/webhook/appointments/reschedule

Important : cette version ne mémorise pas encore les paramètres entre plusieurs tours.
Si une information manque, elle est demandée dans la réponse. La prochaine évolution
recommandée est une table `ai_conversation_state` indexée par `sessionId`.
