# GOVSUITE-MULTIAGENT-CREATE-FLOW-CONTRACT-018 — Rapport

Audit de contrat : la collecte d’identité doit-elle précéder la sélection de créneau ?

**TEST uniquement. Analyse statique + offline. Aucune activation. Aucun chat. Aucune Ollama. Aucun PUT. Aucune mutation PG. Aucun Docker. Aucun LIVE. Aucune install. Aucune phase suivante auto.**

**Recommandation : A** — conserver le parcours VC10 (identité **après** créneau) et corriger les fixtures R01–R03.  
**Option B** (patch DIAG-017) : **non retenue** pour alignement produit (reste archivée hors ligne).  
**Verdict mission : PASS**  
**BUSINESS_DECISION_REQUIRED : non** — le PRD §6.2 tranche sans ambiguïté.  
**Install / R01 runtime : NO-GO**

Artefacts : `n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/runtime-013/diag-018/`

---

## 1. Parcours CREATE actuel (VC10)

Machine à états dans `Gérer collecte progressive` (§12) + PRD §6.2 / campagnes 8F2B :

```text
CREATE_APPOINTMENT
  → ASK_CREATE_SERVICE        (si !service)
  → ASK_CREATE_SITE           (si !site)
  → ASK_CREATE_DATE_RANGE     (si !dateDebut || !dateFin)
  → READY_CREATE_SEARCH       (→ intent GET_AVAILABILITY technique)
  → ASK_CREATE_SLOT           (liste présentée, !slotId)
  → [sélection « Je prends le N »] → slotId UUID
  → ASK_NOM → ASK_PRENOM → ASK_EMAIL → ASK_TELEPHONE
  → AWAIT_CREATE_CONFIRMATION (createDecision INSERT si identité complète + slotId)
  → confirmation explicite → tentative / CLAIM / POST CreateAppointment
```

Baseline workflow : `OCD9It1uKFhOoWNF` VC10, Gérer SHA `f75d4984…` (install-012 / FIX-008).

Capture identité (§12.3) et échelle identité (§12.4) : **gated sur `slotId`**.

Nuances runtime ([n8n-developer](8857a4ec-842f-4a01-a9d7-d0e4cbdb6a78)) : après résolution UUID, Gérer saute souvent directement à `ASK_NOM` (sans poser `ASK_CREATE_SLOT` en §12.4) ; la confirmation utilise `AWAIT_CREATE_CONFIRMATION` (PRD cite `READY_CREATE`). `INSERT` crée la tentative — le POST CreateAppointment exige AFFIRM + CLAIM. Résidu commun A/B : `skipCreateProgression` peut forcer `AWAIT_CREATE_CONFIRMATION` sans re-check `slotId` ([security-auditor](e2506351-fd07-4beb-8f3c-ab7c7cd9c463), Medium).

---

## 2. Contrat métier documenté

### PRD (`PRD_GovSuite_AI_Consular_Assistant_Cursor.md` §6.2)

Ordre officiel CREATE :

`ASK_CREATE_SERVICE` → `ASK_CREATE_SITE` → `ASK_CREATE_DATE_RANGE` → `READY_CREATE_SEARCH` → `ASK_CREATE_SLOT` → `ASK_NOM` → `ASK_PRENOM` → `ASK_EMAIL` → `ASK_TELEPHONE` → `READY_CREATE`

F-05 (sélection créneau) précède F-06 (collecte identité/contact).  
Un créneau affiché n’est pas une garantie ; la réservation revalide capacité à l’écriture.

### Contrats / campagnes REC-008

| Source | Ordre observé |
| --- | --- |
| `phase8f2b15` SLOT CONTRACT | slot → `ASK_NOM` ; INSERT seulement identité complète |
| 8F2B49 P2 | `Je prends le 1` → `slot_id` + `ASK_NOM` |
| 8F2B49 P3 | `Dupont` avec `slot_id` → `ASK_PRENOM` |
| 8F2B49 P4 | `Camille` attendu avec `slot_id` → `ASK_EMAIL` |

### Réponses aux questions métier

| # | Question | Réponse documentée |
| --- | --- | --- |
| 1 | Ordre officiel CREATE | PRD §6.2 ci-dessus (créneau **avant** identité) |
| 2 | Créneau obligatoire avant ASK_NOM / ASK_PRENOM ? | **Oui** (PRD + Gérer VC10) |
| 3 | `ASK_PRENOM` + `slotId` null légitime ? | **Non** comme état conversationnel cible ; possible seulement via seed/écriture manuelle |
| 4 | Workflow produit cet état naturellement ? | **Non** — §12.4 n’émet `ASK_PRENOM` que si `slotId` |
| 5 | Créneau indisponible après identité | Liste ≠ garantie ; revalidation à CLAIM/POST ; utilisateur doit rechoisir (parcours date/slot) |
| 6 | Expiration / reprise / modification | FIX-008 : pas de reprise implicite ; `reprendre` explicite ; NEGATIVE purge brouillon ; modifyField pour champs |
| 7 | Tentative de réservation | Après identité complète + `slotId` + confirmation explicite (pas pendant ASK_PRENOM) |
| 8 | Empêche confirmation sans créneau | Ladder VC10 : pas d’`AWAIT_CREATE_CONFIRMATION`/`INSERT` sans `slotId` ; `creationComplete` exige `slotId` |

---

## 3. États possibles et impossibles

| État | Naturel VC10 | Seed R01–R03 actuel |
| --- | --- | --- |
| `ASK_CREATE_*` sans slot | Possible | Non utilisé |
| `ASK_NOM` / `ASK_PRENOM` **avec** `slotId` | Possible (cible) | Non |
| `ASK_PRENOM` **sans** `slotId` | **Impossible** via Gérer | **Imposé** (`slot_id` NULL) |
| `AWAIT_CREATE_CONFIRMATION` sans `slotId` via ladder | Impossible | N/A |
| `ASK_CREATE_DATE_RANGE` après message à `ASK_PRENOM` sans slot | Déterministe (017) | Observé late PG |

Transitions pouvant « produire » `ASK_PRENOM` sans `slotId` : **uniquement** UPSERT seed / mutation manuelle — **pas** le graphe Gérer.

---

## 4. Analyse de la fixture R01

`runtime-013/SEED.sql` : `ASK_PRENOM`, `nom=Dupont`, `prenom` NULL, `service`/`site` set, **`slot_id` NULL**, dates NULL, `available_slots='[]'`.

Incohérence triple :

1. Contredit PRD §6.2 et l’échelle VC10.  
2. Scénario R01 attend `Camille` → `ASK_EMAIL` (contrat readiness 007 / 013) **comme si** l’identité était active.  
3. Exécution VC10 (017) : pas de capture → `ASK_CREATE_DATE_RANGE`.

R02/R03 : même forme d’état (expiré) — même défaut structurel pour tout test d’identité.

---

## 5. Comparaison A / B

| Critère | A — Corriger fixtures | B — Patch identité avant créneau |
| --- | --- | --- |
| Conformité PRD | **Aligné** §6.2 | **Écart** volontaire |
| Cohérence conversationnelle | Alignée campagnes 8F2B | Deux chemins (avec/sans slot) |
| UX | Collecte après choix de créneau (PRD) | Identité plus tôt ; risque de ressaisie si créneau perdu |
| Complexité | Seed + assertions ; **0** change Gérer | Install jsCode + non-régression large |
| Régression | Faible (tests d’identité inchangés si `slot_id` présent) | Moyenne (échelle identité sans slot ; champs résiduels) |
| Sécurité réservation | Confirmation/`INSERT` restent `slotId`-gated | Idem dans AFTER, mais PII plus tôt |
| Idempotence / attempts | Inchangée | Inchangée si confirmation gardée |
| Créneaux expirés | Revalider au POST ; identité déjà après slot | Identité peut précéder une recherche ultérieure |
| FIX-008 | Compatible | Compatible (early-return préservé) |
| Maintenance | Fixtures fidèles au produit | Double contrat (PRD vs code) à documenter |

---

## 6. Tests offline

Fichier : `diag-018/offline-create-flow-contract.test.cjs`  
Résultats : `diag-018/OFFLINE-TEST-RESULTS.json` — **`pass=true`** (14/14)

| Groupe | Résultat clé |
| --- | --- |
| N1–N3 | Parcours naturel VC10 : date-range / ASK_NOM / ASK_PRENOM **avec** slot |
| F1 | Seed cassé VC10 → `ASK_CREATE_DATE_RANGE` |
| F2 | Option A (seed + `slotId`) → `Camille` + `ASK_EMAIL` |
| F3 | Option B (AFTER) sur seed cassé → aussi `ASK_EMAIL` |
| I1–I3 | Pas d’`INSERT`/confirm via ladder sans slot ; confirm avec slot + identité |
| C1–C3 | `reprendre` / session expirée |
| S1 | SHA VC10 / AFTER inchangés |

Simulation ≠ preuve runtime.

---

## 7. Recommandation

### **Option A**

**Justification :** le PRD et l’historique REC-008 définissent créneau → identité. L’anomalie 017 est un **écart de fixture**, pas une exigence produit manquante. Corriger R01–R03 restaure le contrat S01 sans changer le workflow.

### Impact exact R01–R03

| Session | Changement seed minimal |
| --- | --- |
| R01 active | `slot_id` UUID synthétique ; `date_debut`/`date_fin` ; `available_slots` JSON contenant ce UUID ; garder `ASK_PRENOM` + nom + prenom null |
| R02 expired | Même brouillon cohérent (slot + dates) ; TTL passé |
| R03 resume | Idem R02, session distincte |

Attendu inchangé côté messages : R01 `Camille`→`ASK_EMAIL` ; R02 Camille→expired sans capture ; R03 `reprendre`→TTL+ sans prenom.

### Modifications nécessaires (mission future — **pas** 018)

1. Mettre à jour `SEED.sql` + contrats SELECT / readiness.  
2. Ajuster assertions seed (présence `slot_id`).  
3. Archiver / marquer patch 017 comme **non retenu** pour produit (ou « réserve si PRD change »).  
4. Pas de PUT Gérer pour A.

### Risques résiduels

- Seed avec UUID non présent en table `creneaux` : OK pour collecte d’identité offline ; CLAIM/POST restent hors R01.  
- Confusion future si quelqu’un réintroduit un seed sans slot.  
- Timeout Ollama (016) reste un bloqueur runtime distinct.

### Conditions validation runtime (future)

- Mission seed/fix autorisée + préflight/postflight.  
- Warm Ollama / timeout mesuré (016).  
- R01 uniquement après seed corrigé ; Evidence PASS.  
- **Pas** d’install patch 017 sous option A.

### Option B

Recevable seulement si le responsable produit **modifie le PRD** pour autoriser l’identité avant créneau. Ce n’est **pas** l’état documenté actuel → ne pas transformer le patch 017 en exigence.

---

## 8. Avis Security Auditor

Agent : [security-auditor](e2506351-fd07-4beb-8f3c-ab7c7cd9c463)

| Item | Avis |
| --- | --- |
| Verdict | **PASS** (option A) |
| Préférence | **A** — PII après créneau, aligné PRD |
| Option B | **High** : PII avant engagement créneau + course « créneau plein » ; confirm/POST restent gated mais UX/rétention dégradées |
| FIX-008 / idempotence | Préservés sous A et B (AFTER) |
| Install B | **NO-GO** sécurité tant que PRD non amendé |

---

## 9. Avis Evidence Reviewer

Agent : [evidence-reviewer](919d4871-778c-4c42-b2b3-84d0f65b2576)

| Item | Avis |
| --- | --- |
| Diagnostic 018 | **PASS** |
| Recommandation A | **Validée** |
| BUSINESS_DECISION_REQUIRED | **Non** |
| Install 017 / seed mutate / R01 | **NO-GO** dans 018 |
| Nuance | Légitimité SQL (`slot_id` nullable) ≠ légitimité machine à états |

---

## 10. Délégations

| Agent | Verdict |
| --- | --- |
| [govsuite-planner](f046b297-cad1-4588-90ba-b578a3a658c7) | GO diagnostic only ; install/R01 **NO-GO** ; stop |
| [n8n-developer](8857a4ec-842f-4a01-a9d7-d0e4cbdb6a78) | **PASS** — `ASK_PRENOM` naturel exige `slotId` ; reco **A** |
| [qa-automation](273e8a36-2ad4-4262-8235-f560c0b5fe76) | Offline **PASS** 14/14 ; reco **A** |
| [security-auditor](e2506351-fd07-4beb-8f3c-ab7c7cd9c463) | **PASS** ; préfère **A** |
| [postgres-engineer](d460ee0e-3883-484f-85c0-437fa730054d) | Schéma OK nullable ; seed diverge Gérer ; tentative = INSERT puis CLAIM ; 409 au POST |
| [evidence-reviewer](919d4871-778c-4c42-b2b3-84d0f65b2576) | **PASS** ; A validée ; stop |

Parent : PRD, transitions, tests, rapport. **Aucune install.**

Complément postgres : brouillon = `ai_conversation_state` seul ; ligne `ai_appointment_attempt` à `createDecision=INSERT` (identité+slot) ; CLAIM = affirmation sur tentative ouverte ; indispo créneau revalidée au **POST** CreateAppointment (`SLOT_UNAVAILABLE` / 409), pas pendant ASK_PRENOM.

---

## 11. Verdict et GO/NO-GO

| Décision | Statut |
| --- | --- |
| Audit contrat 018 | **PASS** |
| Recommandation | **A** |
| BUSINESS_DECISION_REQUIRED | **Non** (PRD clair) |
| Install patch 017 | **NO-GO** |
| Mutation seed R01–R03 | **NO-GO** dans 018 (mission seed distincte) |
| Campagne R01 | **NO-GO** jusqu’à seed corrigé + auth + préconditions 016 |
| Phase suivante | **stop** |

---

## Références

- `GOVSUITE_MULTIAGENT_R01_STATE_ROUTING_DIAG_017_REPORT.md`
- `GOVSUITE_MULTIAGENT_CHAT_TIMEOUT_DIAG_016_REPORT.md`
- `GOVSUITE_MULTIAGENT_TEST_INSTALL_RETRY_012_REPORT.md`
- `PRD_GovSuite_AI_Consular_Assistant_Cursor.md` §6.2
- `REC_008_PHASE8F2B49_P2_SLOT_SELECTION_REPORT.md` / P3 / P4
- `AGENTS.md`, `.cursor/rules/govsuite-safety.mdc`
