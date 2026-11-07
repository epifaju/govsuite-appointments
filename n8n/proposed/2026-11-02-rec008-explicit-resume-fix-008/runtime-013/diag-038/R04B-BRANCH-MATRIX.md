# Matrice des branches R04-B (VC11 · W-031-01)

**Source :** export installé `diag-034/after-OCD9It1uKFhOoWNF.json` · `versionId` `f5a9181f…` · Gerer `44a7064d…`  
**Scénario :** session active `ASK_EMAIL` · message `pas-un-email`  
**Chat Trigger :** `responseMode=lastNode`

## Chaîne nominale CREATE (collecte)

| # | Nœud | Type | Entrées attendues | Null / absents | Branche `pas-un-email` | Risque HTTP 500 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Lorsqu'un message de chat est reçu | chatTrigger | `chatInput`, `sessionId` | message vide → continue | message non-email | faible (transport) |
| 2 | Charger état conversation | postgres | `sessionId` | session absente → autre parcours | seed ASK_EMAIL présent | SQL / credential (hors preuve 037) |
| 3 | Lire / Joindre tentative de session | postgres + code | open attempts | open=0 OK | inchangé | faible |
| 4 | Comprendre la demande | chainLlm + Ollama | `chatInput` | LLM timeout / JSON invalide | inférence réelle (non simulée offline) | **élevé** (latence ~40 s compatible) |
| 5 | Parser intention | code | texte LLM | parse fail → `{}` | intent quelconque + email null | faible (catch JSON) |
| 6 | Fusionner état conversation | code | previous + parser | champs null conservés depuis previous | step reste ASK_EMAIL | faible |
| 7 | Gérer collecte progressive | code | fusion + message | email invalide non capturé | **reste ASK_EMAIL**, `email` null | **exclu offline** (pas d'exception) |
| 8 | Sauvegarder état conversation | postgres | payload Gerer | casts date/uuid/int | **non atteint en 037** (`updatedAt` / `lastUserMessageLen` inchangés) | possible si pollution typée (non démontré ; latence plaide contre) |
| 9 | Router intention | switch | `intent` / pending | fallback → Réponse générale | CREATE → bi=2 Décider | faible |
| 10 | Décider action tentative | code | step + attempt | open=0 → `attemptAction=COLLECT` | COLLECT (défaut) | **exclu offline** |
| 11 | Aiguiller tentative | switch | `attemptAction` | **COLLECT ∉ rules** → `fallbackOutput=extra` | → **Valider paramètres création** (pas la règle ASK) | faible |
| 11b | Création prête ? | if | email/tel/… | false si email manquant | → Demander | faible |
| 12 | Demander paramètres création | code | `conversationStep` | default texte générique | ASK_EMAIL → re-demande email | **exclu offline** ; **terminal** (`outs=[]`) = réponse HTTP |

## Hors chemin ASK_EMAIL

| Nœud | Rôle | Pertinence R04-B |
| --- | --- | --- |
| Préparer réponse création | post-confirmation / clôture | **hors chemin** (inbound depuis « Clôture confirmation ») |
| Appeler CreateAppointment | POST métier | **interdit / non atteint** · mockPostsΔ=0 |
| Réponse générale | Router bi 6/7 | possible si intent GENERAL après sauvegarde ; offline OK |

## Synthèse branches pour `pas-un-email`

```text
Chat → … → Comprendre(?) → Parser → Fusionner → Gerer(ASK_EMAIL, no email)
  → Sauvegarder ──(037: NON ATTEINT)──→ Router CREATE → Décider COLLECT
  → Aiguiller fallback → Valider paramètres → Création prête? (false)
  → Demander (lastNode text email)
```

**037 observé :** échec **avant** commit Sauvegarder · HTTP 500 générique · pas de capture email · pas de CLAIM/POST.
