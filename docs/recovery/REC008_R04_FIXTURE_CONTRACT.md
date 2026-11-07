# REC-008 — Contrat fixtures R04 (offline 031)

**Mission :** R04-OFFLINE-READINESS-031. Synthétiques uniquement. **Aucun apply PG.**

Emplacement : `tests/rec008/fixtures/r04-offline-readiness-031/`

---

## États initiaux communs (A/B ; C = TTL expiré)

| Champ | Valeur |
| --- | --- |
| `conversation_step` | `ASK_EMAIL` |
| `slot_id` | présent (OPTION A UUID `…1301`) |
| `date_debut` / `date_fin` | cohérents |
| `nom` / `prenom` | synthétiques (`Dupont` / `Camille`) |
| `email` / `telephone` | null |
| `openAttempts` | 0 |
| `pending_action` | `CREATE_APPOINTMENT` |

---

## Scénarios

| ID | Message (fixture only) | Attendu métier | CLAIM/POST |
| --- | --- | --- | --- |
| **R04-A** | email `@example.test` valide | `emailValide` ; step → `ASK_TELEPHONE` ; identité+créneau conservés | Δ0 |
| **R04-B** | `pas-un-email` | non accepté ; reste `ASK_EMAIL` ; correction | Δ0 |
| **R04-C** | email valide + TTL expiré | pas de capture implicite ; `session_expired` ; pas ASK_TELEPHONE | Δ0 |

**Anomalie connue W-031-01 :** VM actuelle peut exposer `email` en mémoire sur R04-C via `previous.email ?? x.email` — patch proposé non installé.

---

## Artefacts campagne (futurs)

Exporter **uniquement** `*Present` / `*Len` / `*Hash` / états (voir `REC008_ARTIFACT_REDACTION_CONTRACT.md`).  
Clair email **interdit** hors `fixtures/**`.
