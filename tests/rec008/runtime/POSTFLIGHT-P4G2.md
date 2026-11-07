# Postflight P4G2 — checklist locale (non exécutée)

À cocher **manuellement** après l’action unique autorisée (si runtime un jour autorisé).  
Ce fichier ne lance aucune commande.

Phase : **8F-2B49-P4G2** — reprise explicite `reprendre`.

## A. Transport vs métier (distinction obligatoire)

- [ ] HTTP documenté séparément du succès métier
- [ ] Attendu transport (réf. historique) : HTTP **200** pour le POST chat
- [ ] Attendu métier (réf.) : `type=create_appointment_question`, `conversationStep=ASK_CREATE_SERVICE`, `ready=false`, `claimAcquired=false`, pas de `appointment_created`
- [ ] Timeout / corps ambigu / status inattendu → **UNCERTAIN** (pas de retry)

## B. Reprise explicite & TTL

- [ ] Commande `reprendre` reconnue
- [ ] `intent` : `GENERAL` → `CREATE_APPOINTMENT`
- [ ] `conversation_step` conservé `ASK_CREATE_SERVICE`
- [ ] `pending_action` conservé `CREATE_APPOINTMENT`
- [ ] TTL renouvelé (~ +2 h depuis `updated_at`) ; session active après (`expires_at > NOW()`)
- [ ] Brouillon non inventé : pas de service / site / slot / identité ajoutés
- [ ] Fingerprint `available_slots` inchangé

## C. Anti-réservation / anti-mutation métier

- [ ] Δ POST CreateAppointment mock = **0**
- [ ] Δ GET availability = **0**
- [ ] Δ GET services = **0** (question texte seule)
- [ ] CLAIM = **0**
- [ ] Tentatives session toujours **0** ; aucune clé d’idempotence créée
- [ ] Compteurs PG `1|11|4|0` (ou ancre rebaseliné) **inchangés** vs préflight
- [ ] Ouvertes = **0**
- [ ] Pas de cancel / reschedule / e-mail

## D. Workflow remis sûr

- [ ] Workflow désactivé : `active=false`, `activeVersionId=null`
- [ ] VC9 / `versionId` inchangés
- [ ] Webhooks actifs = **0**
- [ ] Aucun autre workflow actif

## E. LIVE / Mailpit / secrets

- [ ] Empreinte LIVE **identique** au préflight
- [ ] Mailpit **identique** au préflight (si e-mail hors périmètre)
- [ ] Rapport sans secret, token, PII (email citoyen masqué si présent)

## F. Process

- [ ] Exactement **un** message envoyé ; **zéro** retry
- [ ] Artefacts : `STATE_AFTER.json`, `RESULT.json`, `response.txt` (aperçu non-PII)
- [ ] Verdict explicite : **PASS** | **FAIL** | **UNCERTAIN**
- [ ] Phase suivante **non** auto-autorisée (NO-GO renvoi auto de `reprendre` ; LIVE NO-GO)

## Postflight OK ?

- [ ] A–F cohérents avec l’attendu P4G2
- [ ] Écart d’empreinte / webhook actif résiduel / CLAIM ou POST → **FAIL** ou **UNCERTAIN** + STOP
