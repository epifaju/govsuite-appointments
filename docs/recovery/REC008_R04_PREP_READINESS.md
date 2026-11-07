# REC-008 — Readiness R04-PREP (collecte email)

Mission EVIDENCE-OBSERVABILITY-030. **Docs only.** Aucune campagne R04. Aucun chat.

---

## 1. Objectif R04 (rappel)

Session post-R01 (ou seed équivalent) à **`ASK_EMAIL`** + **1 message email synthétique** → email validé / step → `ASK_TELEPHONE` (contrat attendu), **sans** CLAIM/POST.

---

## 2. Conditions de passage R04-PREP (docs / fixtures / asserts)

| # | Condition | Statut prep |
| --- | --- | --- |
| P1 | Fixture OPTION A : `slot_id` présent, dates/slots cohérents | **Requis** (019) |
| P2 | État initial : `conversation_step=ASK_EMAIL`, prenom présent (len), nom présent | **Requis** |
| P3 | Email **synthétique** uniquement (domaine test documenté) | **Requis** |
| P4 | Contrat redaction 030 appliqué aux futurs artefacts | **Requis** (`REC008_ARTIFACT_REDACTION_CONTRACT.md`) |
| P5 | Assertions : format email valide → step `ASK_TELEPHONE` ; invalide → reste ASK_EMAIL ; TTL expiré → pas capture | **Rédigé** (`tests/rec008/readiness/R031-r04-abc-sql-contract.json`, mission 031) |
| P6 | `retried=false` ; 1 msg ; timeout 180 s post-warm | **Reprendre runner 021** |
| P7 | `mockPostsDelta=0` ; `mockClaimsDelta=0` ; `claimAcquired=false` | **Requis** |
| P8 | Settle late-write + postflight deactivate / webhooks 0 / running 0 | **Requis** |
| P9 | Préflight : VC10, SHA Gérer, `:5682`, `liveTouched=false` | **Requis** |
| P10 | STOP-CONDITIONS R04–R07 (029 QA) référencés | **Requis** |
| P11 | Revue security 029 : pas d’élargissement à R06/R07 | **Requis** |

**R04-PREP GO** lorsque P1–P11 documentés + offline-tests/asserts prêts (mission prep dédiée).  
**R04-RUNTIME** reste **NO-GO** jusqu’à autorisation humaine distincte.

---

## 3. Hors scope R04

- Confirmation AFFIRM  
- CLAIM / POST  
- Email réel / PII citoyen  
- LIVE  

---

## 4. Blocages 029 **non levés** par 030

| ID | Sujet | Statut après 030 |
| --- | --- | --- |
| H1 | Confirmation explicite non validée runtime | **Ouvert** |
| H2 | Idempotence / concurrence Create | **Ouvert** |
| M1 | `skipCreateProgression` | **Ouvert** |
| — | Erreurs POST CreateAppointment | **Ouvert** |
| — | Protection tokens | **Ouvert** |

030 **ne corrige pas** ces points.

---

## 5. Gates

| Gate | Décision |
| --- | --- |
| R04-PREP (docs/fixtures/asserts) | **GO-CONDITIONAL** (cette mission ouvre le cadre) |
| R04-RUNTIME | **NO-GO** |
| R06 prep / runtime | GO-CONDITIONAL après R05+`skipCreate` / **NO-GO** |
| R07 prep / runtime | **HOLD** / **NO-GO** |
| LIVE | **NO-GO** |
| Auto-next | **NO-GO** |
