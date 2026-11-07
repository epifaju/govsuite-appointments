# REC-008 phase 8F-2B49-P4G2 — Reprise explicite d’une session expirée

Validation **TEST VC9** : un seul message `reprendre` sur `rec008-8f2b1-slot-01` (suite de P4G1).

Artefacts : `n8n/proposed/2026-11-01-rec008-phase8f2b49-P4G2-EXPLICIT-RESUME/`  
(`PREFLIGHT.json`, `STATE_BEFORE.json`, `STATE_AFTER.json`, `CONNECTIVITY.json`, `response.txt`, `RESULT.json`, `run.js`)

Verdict : **PASS**  
GO/NO-GO validation suivante : **GO** (sous autorisation distincte)

---

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow | `OCD9It1uKFhOoWNF` inactif ; VC **9** / `e7867799-…` |
| Graphe / Finaliser / 6 SHA P4F | 134/137 ; conformes |
| Actifs / webhooks | 0 / 0 |
| URL / credentials / réseau | mock×10 ; PG TEST ; TEST ↛ LIVE |
| PG | `1\|11\|4\|0` ; ouvertes 0 |
| Mock | `created` ; POST/avail/services **0** |
| LIVE / Mailpit | `a2dea067…` ; 5/2/98304 |

---

## 2. État initial de la session

Conforme à l’après-P4G1 :

| Champ | Valeur |
| --- | --- |
| `session_id` | `rec008-8f2b1-slot-01` |
| Expirée | **oui** (`expires_at=2026-10-31 00:59:54+01` ≤ NOW) |
| `intent` | `GENERAL` |
| `pending_action` | `CREATE_APPOINTMENT` |
| `conversation_step` | `ASK_CREATE_SERVICE` |
| `available_slots` | présent, longueur 0 |
| Service/site/slot/identité | absents |
| Tentatives | 0 |

STOP non déclenché.

---

## 3. Connectivité

TCP `127.0.0.1:5682` OK ; `/healthz` 200 ; `/healthz/readiness` 200.

---

## 4. Message unique

1. Activation temporaire VC9 — 200.  
2. Webhooks chat OK.  
3. Warmup GET 200.  
4. **Un** POST : `action=sendMessage`, `sessionId=rec008-8f2b1-slot-01`, `chatInput=reprendre`.  
5. Aucun retry.  
6. Désactivation immédiate.

---

## 5. Réponse HTTP

| Mesure | Valeur |
| --- | --- |
| HTTP | **200** (~65 s) |
| `type` | **`create_appointment_question`** |
| `conversationStep` | **`ASK_CREATE_SERVICE`** |
| Texte | demande le service (ex. Passeport) |
| `ready` | **false** |
| `claimAcquired` | **false** |
| `appointment_created` | non |

---

## 6. Vérification de la reprise

| Attendu | Observé |
| --- | --- |
| Commande `reprendre` reconnue | oui |
| `intent` restauré `CREATE_APPOINTMENT` | oui (`GENERAL` → `CREATE_APPOINTMENT`) |
| Étape `ASK_CREATE_SERVICE` | conservée |
| `pending_action` CREATE | conservé |
| Pas de réservation | oui |

---

## 7. TTL avant / après

| | Valeur |
| --- | --- |
| Avant | `2026-10-31 00:59:54.370387+01` (expiré) |
| Après | `2026-11-02 11:46:04.206239+01` |
| `updated_at` après | `2026-11-02 09:46:04.206239+01` |
| Politique 2 h | **oui** (`expires_at = updated_at + 2h`) |
| Session active après | **oui** (`expires_at > NOW()`) |

---

## 8. Brouillon avant / après

| Élément | Résultat |
| --- | --- |
| Pending / step | inchangés (`CREATE` / `ASK_CREATE_SERVICE`) |
| Flags métier | inchangés (pas d’invention service/site/slot/identité) |
| Slots fingerprint | inchangé |
| Tentatives | toujours 0 |

---

## 9. Compteurs PostgreSQL / mock

| Domaine | Avant | Après |
| --- | --- | --- |
| PG | `1\|11\|4\|0` | `1\|11\|4\|0` |
| Ouvertes | 0 | 0 |
| Mock POST / avail / services | 0/0/0 | 0/0/0 |

Aucun GET `/services` (question texte uniquement).

---

## 10. Contrôles anti-réservation

| Contrôle | Résultat |
| --- | --- |
| CLAIM | 0 |
| POST CreateAppointment Δ | **0** |
| GET availability Δ | **0** |
| GET services Δ | **0** |
| Cancel / reschedule / e-mail | absents |
| Clé d’idempotence | aucune |

---

## 11. Désactivation

`active=false`, `activeVersionId=null`, VC9, webhooks 0.

---

## 12. Intégrité LIVE / Mailpit

LIVE `13|14|12|48|0|a2dea067…` inchangé. Mailpit 5/2/98304 inchangé.

---

## 13. Verdict

**PASS**

Reprise explicite reconnue ; TTL renouvelé (+2 h) ; `CREATE_APPOINTMENT` / `ASK_CREATE_SERVICE` restaurés ; brouillon préservé ; aucun CLAIM/POST ; workflow désactivé ; LIVE intact.

---

## 14. GO / NO-GO

| Suite | Décision |
| --- | --- |
| Validation TTL / collecte suivante (phase distincte) | **GO** sous **autorisation distincte** |
| Renvoi automatique de `reprendre` | **NO-GO** |
| LIVE | **NO-GO** |

Restrictions respectées. Arrêt ici.
