# GOVSUITE-MULTIAGENT-CHAT-TIMEOUT-DIAG-016 — Rapport

Diagnostic **lecture seule** du timeout chat 45 s de RUNTIME-R01-RETRY-015 (`Camille`).

**TEST uniquement. Aucun nouveau message. Aucune activation. Aucun PUT. Aucune mutation PG. Aucun Docker mutate. Aucune inférence Ollama. Aucun LIVE. Aucun R0x.**

**Verdict Evidence Reviewer : INCONCLUSIVE** (cause timeout client étayée ; nœud exact + anomalie métier non fermés)  
**Cause primaire timeout client (parent/devops) : soutenue** — cold start Ollama + `/api/chat` ~3 min 10 s + `lastNode` + abort 45 s  
**GO/NO-GO relance R01 : NO-GO automatique**  
**Phase suivante auto : non autorisée**

Artefacts : `n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/runtime-013/diag-016/`

---

## 1. État initial

| Contrôle | Observé |
| --- | --- |
| Workflow `OCD9It1uKFhOoWNF` | `active=false` |
| `versionId` / counter | `fd75ba32…` / **10** |
| Gérer SHA FIX-008 | `f75d4984…a26917fe` |
| Nodes | 134 |
| `execution_entity` (sqlite) | **0** lignes (total) |
| API `/rest/executions` | liste vide |
| Fingerprint PG | `1\|14\|4\|0` |
| Fixtures R013 | conservées (pas de DELETE) |

**Important :** l’absence d’exécution dans l’API/sqlite **ne prouve pas** l’absence d’exécution runtime (rétention nulle observée).

---

## 2. Chronologie horodatée R01 (UTC fichiers artefacts)

| Instant (UTC) | Événement |
| --- | --- |
| 21:00:47 | `preflight.json` |
| 21:00:48 | `R01-before.json` — ASK_PRENOM, prenom null, `last_user_message` vide |
| 21:00:53 | Activate OK (`activeVersionId=fd75ba32…`) |
| 21:01:43 | Chat abort client — `elapsedMs=45018`, status 0, `retried=false` |
| 21:02:07 | Deactivate verified (`active=false`, webhooks 0) |
| 21:02:20 | `R01-after.json` — **encore** ASK_PRENOM / prenom null / message vide |
| 21:02:25 | `safety-postflight-stop-R01` `safeDeclared=true` |
| **21:04:30** | **Écriture PG** `updated_at` (22:04:30+01) — `last_user_message=Camille`, step **ASK_CREATE_DATE_RANGE**, prenom **toujours null**, TTL renouvelé |

Délai activate → écriture PG ≈ **3 min 37 s**.  
Délai abort client → écriture PG ≈ **2 min 47 s**.

---

## 3. Logs n8n

Fenêtre `20:55–21:15Z` : **aucune** ligne corrélée webhook/chat/exécution R01.  
Bruit résiduel : boot antérieur, `EAI_AGAIN api.n8n.io` (MCP registry) — hors chemin métier.

Rétention : `execution_entity` vide → **pas d’ID d’exécution** ni de durée par nœud.

---

## 4. Logs Ollama

| Observé | Valeur |
| --- | --- |
| Conteneur | Up ; MemLimit ≈ 1,5 GiB ; NanoCPUs 1,5 ; RestartCount 0 |
| Modèle disque | `qwen2.5:1.5b` (≈935–986 MB) présent |
| Mémoire idle (après coup) | ≈ **53 MiB** hors charge |
| Inférence DIAG-016 | **0** (interdit) |

### Timeline Ollama corrélée R01 ([devops-engineer](ec048e18-66af-49f3-92b7-5a3a15a69662))

| Instant (UTC) | Événement |
| --- | --- |
| ~21:01:17 | Début estimé `POST /api/chat` (depuis durée GIN) |
| 21:01:18 | Cold load Qwen2.5 1.5B (CPU) |
| 21:01:21→21:02:12 | `load_tensors` / runner « not responding » (chevauche abort client 21:01:43) |
| **21:02:23** | Runner prêt (~**63,5 s** cold start) — **après** fin fenêtre abort |
| **21:04:27** | `[GIN] 200 \| 3m10s \| n8n-IP \| POST "/api/chat"` |

→ Preuve **forte** : n8n a appelé Ollama ; l’inférence a duré ~3 min 10 s **après** l’abort client.

---

## 5. Logs publish

`proxy.mjs` = pipe TCP silencieux. Logs publish : **vides** (by design).  
Aucune preuve directe d’arrivée octet ; preuve **indirecte** via effet PG ultérieur.

---

## 6. État PostgreSQL

### Immédiat post-015 (`R01-after.json`)

- step `ASK_PRENOM` ; prenom null ; `last_user_message` vide ; FP `1|14|4|0`

### État au diagnostic 016 (lecture seule)

| Champ | Valeur |
| --- | --- |
| `last_user_message` | **`Camille`** (len 7) |
| `prenom` | **null** |
| `conversation_step` | **`ASK_CREATE_DATE_RANGE`** |
| `updated_at` | 2026-11-05 22:04:30+01 |
| `expires_at` | renouvelé (TTL futur) |
| attempts session | 0 |
| fingerprint global | `1\|14\|4\|0` |

Logs PG fenêtre : FATAL startup antérieur hors sujet ; pas d’ERROR SQL lié à `ai_conversation` dans la fenêtre.

**Lecture :** une exécution **côté serveur a bien progressé jusqu’à une sauvegarde d’état** après l’abort client (et après le snapshot `R01-after`). Anomalie métier : step ≠ `ASK_EMAIL` attendu pour capture prénom ; hors scope correctif 016.

---

## 7. Analyse du chemin n8n (statique FIX-008)

`responseMode: lastNode` sur Chat Trigger → la réponse HTTP attend la **fin** du graphe.

Préfixe confirmé (connections export install-012) :

1. `Lorsqu'un message de chat est reçu`  
2. `Charger état conversation`  
3. `Lire tentative de session`  
4. `Joindre tentative de session`  
5. **`Comprendre la demande`** (`chainLlm`) + **`Ollama Chat Model`** (`qwen2.5:1.5b`)  
6. `Parser intention`  
7. Router → (CREATE) → `Gérer collecte progressive` → `Sauvegarder état conversation` → nœud(s) de réponse (`lastNode`)

Risque de blocage dominant : **étape 5 (Ollama)** — cold start + génération, sans timeout court observable dans l’export pour ce nœud.  
PG / mock : sur le chemin identité, pas de CreateAppointment avant Gérer/Sauvegarder.

---

## 8. Analyse du runner

| Élément | Valeur |
| --- | --- |
| URL | `http://127.0.0.1:5682/webhook/a91c4e70-6b18-4f0d-9c55-2e7d8a14b603/chat` |
| Body | `{ sessionId, action:'sendMessage', chatInput:'Camille' }` |
| Timeout | **`CHAT_TIMEOUT_MS=45000`** → AbortSignal |
| Retry | **false** |
| Après abort | deactivate immédiat ; **ne lit pas** une réponse tardive |

Conséquence : si le workflow > 45 s (cas Ollama froid plausible), le client **UNCERTAIN** alors que le serveur peut **continuer** (`lastNode`).

---

## 9. Matrice d’hypothèses

| Hypothèse | Confiance | Preuves | Contradictions |
| --- | --- | --- | --- |
| Message non arrivé au relais | **RÉFUTÉE** | PG `last_user_message=Camille` après coup | — |
| Arrivé au relais, non transmis à n8n | **RÉFUTÉE** | Idem (effet Sauvegarder) | — |
| Chat Trigger sans démarrage workflow | **RÉFUTÉE** | Idem | — |
| Workflow démarré puis bloqué longtemps sur un nœud | **CONFIRMÉE** (Ollama) | Cold load 21:01:18 ; runner ready 21:02:23 ; `/api/chat` 3m10s → 21:04:27 | Timing n8n node non persisté (`execution_entity=0`) |
| Traitement terminé mais HTTP non délivré au client | **CONFIRMÉE** | Abort 45 s ; `lastNode` ; PG write 21:04:30 ; Ollama GIN 21:04:27 | Pas de corps HTTP client |
| Preuves nœud n8n insuffisantes | **CONFIRMÉE** | `execution_entity=0` | Contredit par logs Ollama pour le sous-appel LLM |

**Synthèse causale (faits) :**  
timeout 015 = **abort client 45 s** pendant **cold start + inférence Ollama** (`Comprendre la demande`) ; n8n a continué (~3 min 10 s `/api/chat`) puis persisté l’état (~21:04:30Z). Docker/proxy crash : **non prouvé** (devops).

---

## 10. Corrections proposées (**non appliquées**)

1. **Activer la rétention d’exécutions** TEST (success+error) le temps des campagnes R0x — sinon diagnostic nœud impossible.  
2. **Précharger / warm** `qwen2.5:1.5b` avant campagne (mission dédiée ; pas dans 016).  
3. Runner : **ne pas** bumper légèrement (60–120 s) — insuffisant vs cold start ; ≥240–300 s seulement si diagnostic wait explicite ([qa-automation](f3ee0b7d-f5ca-4ee0-8f7b-eba64227eebd)).  
4. Runner : ne pas traiter abort comme « message non traité » si postflight PG montre `last_user_message` — assertion différée (mission future).  
5. Hors 016 : comprendre pourquoi la fin d’exécution a laissé `prenom` null et step `ASK_CREATE_DATE_RANGE` (anomalie métier vs contrat R01).

---

## 11. Limites des preuves

- Aucune exécution n8n persistée.  
- Logs publish/ollama/n8n muets sur la fenêtre.  
- Pas d’inférence de confirmation Ollama (interdit).  
- Corrélation late-write ↔ run 015 = **forte** (contenu `Camille` + timing) mais pas d’ID d’exécution.

---

## 12. Evidence Reviewer et délégations

| Agent | Verdict / livrable |
| --- | --- |
| [govsuite-planner](1859076d-73b0-49d1-9928-212435a0698b) | **GO** diagnostic readonly ; R01 rerun **non autorisé** |
| [devops-engineer](ec048e18-66af-49f3-92b7-5a3a15a69662) | **PASS** ; Docker cause **N** ; Ollama cold-start + `/api/chat` 3m10s **prouvé** |
| [n8n-developer](42e0330b-65ad-4bed-80fa-26e9f15e6a27) | Path unique pré-Gérer passe **toujours** par Ollama ; hang **HIGH** sur `Comprendre la demande` ; note `diag-016/PATH-NOTE-016.md` (snap 015 immédiat = avant `Sauvegarder` ; complétion tardive séparée) |
| [postgres-engineer](9875818a-26c0-4acd-af67-71e816d54cdf) | État courant **PASS** ; late completion Camille conf. ~0,8 ; anomalie `ASK_CREATE_DATE_RANGE` + prenom null |
| [qa-automation](f3ee0b7d-f5ca-4ee0-8f7b-eba64227eebd) | Ne pas bumper timeout légèrement ; préférer warm Ollama ; ≥240–300 s seulement conditionnel ; conf. 0.85 |
| [security-auditor](ebab1658-155d-41f4-ac9e-b43b13700fc6) | Isolation **PASS** ; note PII synthétique `Camille` en PG |
| [evidence-reviewer](878be002-ad8d-40dd-b588-cdfba34e00bd) | **INCONCLUSIVE** ; H-A/H-B soutenus ; nœud exact + `ASK_CREATE_DATE_RANGE` **INCONCLUSIVE** ; R01 auto **NO-GO** |

**Alignement :** cause timeout client **soutenue** (devops/n8n/postgres) ; Evidence impose **INCONCLUSIVE** global faute de run n8n retenu et d’explication métier late-state ; R01 **NO-GO** auto.

---

## 13. Verdict

**INCONCLUSIVE** (verdict indépendant Evidence) — avec cause primaire du timeout client **soutenue** (Ollama cold + `lastNode` + abort 45 s) mais **sans** preuve nœud-exacte n8n ni explication de `ASK_CREATE_DATE_RANGE` / prenom null.

Parent : la classification H1–H3 réfutées / H4–H5 confirmées reste utile ; elle **n’équivaut pas** à un PASS de clôture monocausale.

---

## 14. GO/NO-GO future relance R01

| Décision | Statut |
| --- | --- |
| Relancer R01 dans cette mission | **NO-GO** |
| Future R01 | **GO conditionnel** (auth humaine + warm Ollama et/ou timeout mesuré + rétention exécutions + fixture R01 réalignée) |
| R02/R03 | **NO-GO** |
| Cleanup fixtures | **non** |

---

## Références

- `GOVSUITE_MULTIAGENT_RUNTIME_R01_RETRY_015_REPORT.md`
- `GOVSUITE_MULTIAGENT_N8N_REST_TRANSPORT_DIAG_014_REPORT.md`
- `GOVSUITE_MULTIAGENT_TEST_INSTALL_RETRY_012_REPORT.md`
- `runtime-013/artifacts-r01-015/*`
- `install-012/after-OCD9It1uKFhOoWNF.json`
- `publish/proxy.mjs`
