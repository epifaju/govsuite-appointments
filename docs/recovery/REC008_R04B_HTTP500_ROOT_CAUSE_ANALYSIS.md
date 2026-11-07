# REC-008 — Analyse de cause racine HTTP 500 (R04-B)

**Mission :** GOVSUITE-MULTIAGENT-R04B-HTTP500-DIAG-038  
**Date :** 2026-11-07  
**Cible analysée :** TEST WF `OCD9It1uKFhOoWNF` VC11 · Gerer `44a7064d…`  
**Runtime source :** mission 037 (aucun rejeu)

---

## Verdicts RCA

| Dimension | Verdict |
| --- | --- |
| Cause HTTP 500 (nœud exact) | **UNKNOWN** |
| Classe de cause | **PROBABLE** |
| Correctif proposé | **NO** |
| Tests offline | **PASS** (16/0) |

---

## 1. Faits démontrés

1. **HTTP 500** chat en ~**40629 ms**, corps expurgé `{"message":"Error in workflow"}`, `retried=false`, `aborted=false`.
2. **État PG inchangé** avant/après : `conversationStep=ASK_EMAIL`, `emailPresent=false`, `emailLen=0`, `updatedAt` identique, `lastUserMessageLen=0`, empreinte `1|16|4|0`.
3. **Sauvegarder état conversation n'a pas produit de commit visible** (sinon `updatedAt` et/ou `lastUserMessageLen` auraient changé).
4. **Aucun CLAIM / POST** mock (`mockPostsΔ=0`, `mockClaimsΔ=0`, `openAttempts=0`).
5. **Chemin ASK_EMAIL ≠ Préparer réponse création** : ce nœud est alimenté par la clôture de confirmation ; la réponse collecte vient de **Demander paramètres création** (terminal, `outs=[]`, compatible `responseMode=lastNode`).
6. **Offline** (sans Ollama/réseau) : `Gérer` + `Décider` (`COLLECT`) + `Demander` pour `pas-un-email` **ne lèvent pas** ; email non capturé ; harnesses R04-A/B/C et R01–R03 **PASS**.
7. **Observabilité absente** : `saveDataSuccessExecution=none`, `saveDataErrorExecution=none` ; sondes sqlite post-037 : **0** exécutions retenues / pas de payload `execution_data` exploitable pour nommer le nœud.

---

## 2. Cause probable

**Échec dans le pipeline pré-Sauvegarder**, très probablement **`Comprendre la demande` / Ollama Chat Model** :

- Latence ~40 s compatible avec une inférence LLM (gate Ollama était `ready` en 037) plutôt qu'avec un cast SQL immédiat.
- R04-A (même chaîne Comprendre) a réussi précédemment → défaillance **non structurelle permanente** du jsCode de validation email, mais incident runtime LLM / chaîne LangChain possible.
- Symptôme HTTP aligné avec une erreur n8n générique « Error in workflow » sans lastNode utile.

**Alternative moins probable :** exception Postgres sur casts typés dans Sauvegarder (uuid/date/int) si pollution LLM — offline montre que Parser/Fusionner/Gerer neutralisent plusieurs pollutions, et la latence plaide contre un échec SQL rapide.

---

## 3. Hypothèses non vérifiées

| Hypothèse | Pourquoi non tranchée |
| --- | --- |
| Nœud exact = Comprendre | Pas de dump d'exécution d'erreur |
| Nœud exact = Parser / Fusionner / Gerer runtime | Contredit par offline, mais runtime réel non observé |
| Nœud exact = Sauvegarder (cast) | PG non muté compatible, mais latence et absence de data |
| Chat Trigger timeout / exec orpheline | Settling 037 : `running=0` avant deactivate ; sqlite actuel vide |
| Aiguiller mauvaise branche | Exigerait Sauvegarder atteint (contredit) |

---

## 4. Exclusions démontrées (non-causes)

- Validation email dans **Gérer collecte progressive** comme source unique du 500 (**offline PASS**, pas d'exception).
- **Préparer réponse création** / construction « appointment_created » (**hors chemin** ASK_EMAIL).
- Capture d'email invalide (**emailPresent** reste false).
- CLAIM / CreateAppointment (**compteurs mock inchangés**).
- Changement des règles de confirmation (**non exercées**).

---

## 5. Correctif

**Aucun correctif jsCode proposé.**  
Cause nœud **non CONFIRMED** → pas de patch spéculatif sous `n8n/proposed/` au-delà des artefacts de diagnostic.

Voir `diag-038/OBSERVABILITY-PLAN.md` pour une mission d'observabilité **séparée** et **autorisée**.

---

## 6. Preuves manquantes pour CONFIRMED

1. Payload d'exécution en erreur (nœud + message d'exception expurgé).
2. Corrélation temps réel Ollama (durée inférence vs horodatage chat) pendant l'échec.
3. Confirmation que Sauvegarder a été invoqué ou non (progress/log nœud).

---

## 7. Décisions

- Installation TEST : **NOT_AUTHORIZED**
- R04-B runtime : **NO-GO**
- R04-C runtime : **NO-GO**
- R05–R07 : **NO-GO**
- LIVE : **NO-GO**
- Mission suivante : **non automatique**
