# GOVSUITE-MULTIAGENT-R04A-RUNTIME-036 — Rapport

**Date :** 2026-11-07  
**Cible :** TEST `127.0.0.1:5682` · WF `OCD9It1uKFhOoWNF` · W-031-01 (VC11 · Gerer `44a7064d…`)  
**Scénario :** **R04-A uniquement** · 1 message · 0 retry

---

## Verdicts

| Gate | Décision |
| --- | --- |
| **R04-A métier** | **PASS** |
| **Postflight** | **PASS** |
| **Confidentialité** | **PASS** |
| **R04-B** | **NOT_AUTHORIZED** |
| **R04-C** | **NOT_AUTHORIZED** |
| **R05–R07** | **NO-GO** |
| **LIVE** | **NO-GO** |

---

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Isolation `:5682` / `liveTouched=false` | **PASS** |
| VC11 / `f5a9181f…` / Gerer `44a7064d…` | **PASS** |
| 134/137 · inactive · webhooks 0 · running 0 · open 0 | **PASS** |
| `saveData*` | **none** (inchangé) |
| Offline runner gates | **PASS** (`r04a-runtime-036-runner-offline.test.cjs`) |

---

## 2. Seed R04-A

Appliqué : `diag-035/sql/seed-r04-a.sql` → session `rec008-r04a-035-active-ask-email`  
Verify : `ASK_EMAIL` · TTL actif · nom/prenom Present · email/tel absent · slot Present · openAttempts 0  
FP après seed : `1|15|4|0`  
Seeds B/C : **non appliqués**  
Artefact : `diag-036/SEED-R04A.json`

---

## 3. Exécution

| Étape | Résultat |
| --- | --- |
| Warm Ollama | **ok** (~30 s) |
| Activate | OK · versionId `f5a9181f…` |
| Chat | **1** message · classe `email_like_valid_synthetic` · timeout 180 s · `retried=false` |
| HTTP | 200 · type `create_appointment_question` |
| Deactivate | OK |
| Settle | 45 s |

---

## 4. Assertions métier (≠ HTTP seul)

| Assertion | Avant → Après |
| --- | --- |
| step | `ASK_EMAIL` → **`ASK_TELEPHONE`** |
| emailPresent / Len | false → **true / 29** |
| nom / prenom Present | true → true (Len 6 / 7) |
| slotIdPresent | true → true |
| ttlActive | true → true |
| mockPostsΔ / mockClaimsΔ | **0 / 0** |
| openAttempts | 0 |
| FP final | `1|15|4|0` (rv/attempts/notif stables) |

---

## 5. Postflight

`active=false` · webhooks 0 · running 0 · `safeDeclared=true`  
`liveTouched=false` · pas de CLAIM/POST · pas de cleanup auto

---

## 6. Confidentialité

Scanner artefacts `artifacts-r04a-036/` : **PASS** (pas d’email clair / secret).  
Snapshots = Present/Len + `sessionIdHash` uniquement.

Note : `RUNTIME_ART` d’environnement a initialement écrit sous un dossier legacy ; artefacts **copiés** vers `artifacts-r04a-036/` (pas de rejeu).

---

## 7. Avis multi-agents

| Agent | Verdict | Synthèse |
| --- | --- | --- |
| [govsuite-planner](6a7cdbf9-a710-4a51-9353-e22254cf15ab) | **GO** R04-A | B/C **NOT_AUTHORIZED** · R05/LIVE **NO-GO** |
| [evidence-reviewer](1411cc73-27f2-4851-859d-81120476ea9d) | **PASS** | Métier + postflight + confidentialité ; B/C **NOT_AUTHORIZED** |

### 7.1 Evidence

[evidence-reviewer](1411cc73-27f2-4851-859d-81120476ea9d) : R04-A métier **PASS** · postflight **PASS** · confidentialité **PASS** · LIVE non touché.  
HTTP 200 croisé avec `ASK_TELEPHONE` + `emailPresent` + Δ mock 0. Clôturer 036 ; ne pas enchaîner R04-B/C.

---

## 8. Arrêt

R04-A clos. **Pas** de R04-B/C · **pas** de R05 · **pas** de LIVE · **pas** de retry · **pas** de cleanup auto.
