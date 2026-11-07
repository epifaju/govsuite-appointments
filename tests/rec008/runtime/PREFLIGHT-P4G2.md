# Préflight P4G2 — checklist locale (non exécutée)

À cocher **manuellement** uniquement après autorisation runtime TEST explicite.  
Ce fichier ne lance aucune commande. Les commandes dangereuses sont listées dans `COMMAND-MATRIX.md` (écriture = hors périmètre sans ordre).

Phase : **8F-2B49-P4G2** — reprise explicite `reprendre` (suite P4G1).

## A. Autorisation & isolation

- [ ] Autorisation humaine **écrite** pour cette phase uniquement
- [ ] Cible = **TEST** (ports / credentials / volumes / WEBHOOK_URL ≠ LIVE)
- [ ] Plan d’action = **une** action : 1× `sendMessage` `chatInput=reprendre` sur `sessionId=rec008-8f2b1-slot-01`
- [ ] Pas de retry planifié ; timeout → STOP / UNCERTAIN
- [ ] Pas d’autre workflow / autre session / autre message dans le plan

## B. Workflow n8n TEST (ancrages lecture)

- [ ] Workflow `OCD9It1uKFhOoWNF` **inactif** (`active=false`, `activeVersionId=null`)
- [ ] `versionId` = `e7867799-2a18-4aec-9ee5-3ba9cbc40766`
- [ ] `versionCounter` = **9** (VC9)
- [ ] Graphe : **134** nœuds / **137** edges
- [ ] SHA Finaliser documenté et conforme à l’attendu P4F/VC9
- [ ] SHA des 6 nœuds critiques P4F conformes (Charger / Joindre / Parser / Collecte / Réponse générale / Sauvegarder)
- [ ] Aucun autre workflow actif (`activeIds` vide)
- [ ] Aucune ligne webhook active avant activation contrôlée

## C. Réseau / credentials / mock

- [ ] URLs mock : 10× préfixe `http://rec008-mock:8080/`
- [ ] Credential Postgres TEST unique attendu (`Fs0l0058q5CEadRw` — id seul, pas de secret)
- [ ] Isolation réseau TEST ↛ LIVE OK
- [ ] Connectivité documentée (TCP UI TEST, `/healthz`, `/healthz/readiness`) — **sans** envoyer le message métier

## D. PostgreSQL TEST (compteurs / session cible)

Ancres historiques de référence (revalider au jour J) :

- [ ] Empreinte compteurs PG `rendez_vous|ai_conversation_state|ai_appointment_attempt|notifications` = `1|11|4|0` (ou ancre explicitement rebaseliné)
- [ ] Tentatives ouvertes (`AWAITING_CONFIRMATION|SUBMITTING|UNCERTAIN`) = **0**
- [ ] Session `rec008-8f2b1-slot-01` **existe**
- [ ] Session **expirée** (`expires_at ≤ NOW()`)
- [ ] `intent` = `GENERAL`
- [ ] `pending_action` = `CREATE_APPOINTMENT`
- [ ] `conversation_step` = `ASK_CREATE_SERVICE`
- [ ] `available_slots` présent (longueur 0 OK)
- [ ] Absents : service / site / slot / identité (nom, prénom, email, téléphone)
- [ ] Tentatives pour cette session = **0**
- [ ] Empreinte LIVE documentée et distincte (ex. historique `13|14|12|48|0|a2dea067…`) — **ne pas toucher LIVE**

## E. Mock & Mailpit

- [ ] Scénario mock = `created`
- [ ] Compteurs mock POST CreateAppointment / GET availability / GET services = **0**
- [ ] Mailpit ancré (ex. historique 5 messages / 2 unread / dbSize 98304) — lecture seule

## F. Garde CreateAppointment

- [ ] Aucun POST CreateAppointment dans le plan
- [ ] Webhook CreateAppointment non sollicité
- [ ] Activation temporaire (si autorisée plus tard) limitée à la fenêtre d’un seul message chat

## Préflight OK ?

- [ ] Tous les points A–F cochés sans écart
- [ ] Sinon → **STOP** (`STOP-CONDITIONS.md`) ; ne pas activer ; ne pas envoyer de message

Artefacts attendus (quand runtime autorisé, hors ce stub) : `PREFLIGHT.json`, `STATE_BEFORE.json`, `CONNECTIVITY.json`.
