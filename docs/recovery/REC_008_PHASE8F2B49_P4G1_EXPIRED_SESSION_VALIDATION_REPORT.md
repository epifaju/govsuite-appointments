# REC-008 phase 8F-2B49-P4G1 — Validation TTL : session expirée sans reprise implicite

Validation fonctionnelle **TEST VC9** : un seul message libre `Camille` sur une session conversationnelle déjà expirée.

Artefacts : `n8n/proposed/2026-11-01-rec008-phase8f2b49-P4G1-EXPIRED-SESSION-VALIDATION/`  
(`PREFLIGHT.json`, `SESSION_SELECTION.json`, `STATE_BEFORE.json`, `STATE_AFTER.json`, `CONNECTIVITY.json`, `response.txt`, `RESULT.json`, `run.js`)

Verdict : **PASS**  
GO/NO-GO validation suivante : **GO** (sous autorisation distincte)

---

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow | `OCD9It1uKFhOoWNF` inactif ; `activeVersionId=null` |
| Version | VC **9** / `e7867799-2a18-4aec-9ee5-3ba9cbc40766` |
| Graphe / Finaliser | 134/137 ; SHA `3fc500bf…` |
| 6 nœuds P4F | SHA identiques au RESULT P4F |
| Actifs / webhooks | 0 autre actif ; 0 webhook avant activation |
| URL / credentials / réseau | 10× `rec008-mock` ; PG `Fs0l0058q5CEadRw` ; TEST ↛ LIVE |
| PG | `1\|11\|4\|0` ; ouvertes **0** |
| Mock | `created` ; POST/avail/services **0** |
| LIVE / Mailpit | `a2dea067…` ; 5/2/98304 |

STOP non déclenché.

---

## 2. Justification de la session choisie

Recherche lecture seule des sessions `expires_at <= NOW()`.

| Critère | Application |
| --- | --- |
| Exclure `rec008-8f2b49-edit-01` | oui (brouillon purgé en P4) |
| Aucune tentative ouverte / UNCERTAIN / SUBMITTING | oui |
| Brouillon encore présent | oui |
| Priorité collecte interrompue | **retenue** |

**Session :** `rec008-8f2b1-slot-01`

- `pending_action=CREATE_APPOINTMENT`
- `conversation_step=ASK_CREATE_SERVICE`
- `available_slots` présent (longueur 0)
- Tentatives associées : **0**
- Expirée depuis ~2026-10-31 00:59+01

Aucune création de session, aucune mutation TTL manuelle.

---

## 3. État avant message

| Champ | Valeur (sans PII) |
| --- | --- |
| `expires_at` | `2026-10-31 00:59:54.370387+01` |
| `updated_at` | `2026-10-30 22:59:54.370387+01` |
| `intent` | `CREATE_APPOINTMENT` |
| `pending_action` | `CREATE_APPOINTMENT` |
| `conversation_step` | `ASK_CREATE_SERVICE` |
| Flags métier | service/site/slot/identité absents ; slots[] présent |
| Tentatives | 0 |

---

## 4. Connectivité

TCP `127.0.0.1:5682` OK ; `/healthz` 200 ; `/healthz/readiness` 200.

---

## 5. Message unique

1. Activation temporaire VC9 (`versionId` requis) — 200.  
2. Webhooks chat GET+POST OK.  
3. Warmup GET 200.  
4. **Un** POST : `action=sendMessage`, `sessionId=rec008-8f2b1-slot-01`, `chatInput=Camille`.  
5. **Aucun retry.**  
6. Désactivation immédiate — inactive, 0 webhook.

---

## 6. Réponse HTTP

| Mesure | Valeur |
| --- | --- |
| HTTP | **200** |
| Durée | ~67 s |
| `type` | **`session_expired`** |
| Texte | indique l’expiration et propose « reprendre » |
| `appointment_created` | non |
| `create_appointment_question` | non |
| Flags techniques publics | absents |

---

## 7. TTL avant / après

| | Valeur |
| --- | --- |
| Avant | `2026-10-31 00:59:54.370387+01` |
| Après | **identique** |
| Prolongation | **non** (`refreshSessionTtl=false` effectif) |

---

## 8. Brouillon avant / après

| Élément | Avant → Après |
| --- | --- |
| `pending_action` | `CREATE_APPOINTMENT` → **inchangé** |
| `conversation_step` | `ASK_CREATE_SERVICE` → **inchangé** |
| Flags métier / slots | **inchangés** |
| `intent` | `CREATE_APPOINTMENT` → **`GENERAL`** |
| `updated_at` | rafraîchi |
| `last_user_message` | mis à `Camille` |

**Brouillon métier préservé** (pas de purge pending/step/champs).  
`intent=GENERAL` = métadonnée de routage de la réponse d’expiration (attendu VC9), **pas** une reprise de collecte.

---

## 9. Compteurs PostgreSQL / mock

| Domaine | Avant | Après |
| --- | --- | --- |
| PG | `1\|11\|4\|0` | `1\|11\|4\|0` |
| Ouvertes | 0 | 0 |
| Tentatives session | 0 | 0 |
| Mock POST / avail / services | 0/0/0 | 0/0/0 |
| Scénario | `created` | `created` |

---

## 10. Contrôles anti-réservation

| Contrôle | Résultat |
| --- | --- |
| CLAIM | 0 |
| POST CreateAppointment Δ | **0** |
| GET availability Δ | **0** |
| GET services Δ | **0** |
| Cancel / reschedule | absents |
| E-mail / Mailpit | inchangé |
| Clé d’idempotence | aucune |

---

## 11. Désactivation

`active=false`, `activeVersionId=null`, VC9 inchangé, webhooks 0, aucun autre workflow actif.

---

## 12. Intégrité LIVE / Mailpit

LIVE `13|14|12|48|0|a2dea067…` inchangé. Mailpit 5/2/98304 inchangé.

---

## 13. Verdict

**PASS**

Session réellement expirée ; réponse `session_expired` ; TTL non prolongé ; brouillon métier conservé ; aucune tentative/CLAIM/POST ; workflow désactivé ; LIVE intact.

---

## 14. GO / NO-GO

| Suite | Décision |
| --- | --- |
| Validation suivante (ex. P4G2 : reprise explicite `reprendre`, ou session active) | **GO** sous **autorisation distincte** |
| Renvoi automatique de `Camille` | **NO-GO** |
| LIVE | **NO-GO** |

Restrictions respectées. Arrêt ici.
