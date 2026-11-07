# REC-008 phase 8F-2B43 — Confirmation positive et finalisation (`rec008-8f2b37-new-01`)

Objectif : un message `oui` sur la tentative `d566fc28-…` pour valider CLAIM → POST mock 201 → `CONFIRMED` → Finaliser (`__ABSENT__`).

**Échec transport immédiat** sur le POST chat (3 ms, `TypeError: fetch failed`). Aucune preuve de réception webhook. **Aucun CLAIM, aucun POST CreateAppointment, aucune mutation session/tentative.** Aucun retry (restriction absolue).

Verdict : **UNCERTAIN**  
GO/NO-GO scénarios ultérieurs : **NO-GO** (confirmation non réalisée ; état prêt pour une phase distincte sous nouvelle autorisation)

Artefacts : `n8n/proposed/2026-10-31-rec008-phase8f2b43-POSITIVE-CONFIRMATION-FINALIZATION/`  
(`PREFLIGHT.json`, `RESULT.json`, `response.txt`, `run.js`, `console.log`)

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow | inactif, `activeVersionId = null` |
| Version / compteur | `e1b32992-…` / **8** |
| Graphe / Finaliser | 134 / 137 ; SHA `3fc500bf…` ; `__ABSENT__` + `::uuid` présents |
| Credentials / URL / isolation | TEST / 10 mock / OK |
| PostgreSQL | **1 / 10 / 4 / 0** ; 1 ouverte |
| Tentatives | 1 ABANDONED + 1 AWAITING + 1 CONFIRMED + 1 EXPIRED |
| Mock | `created` ; POST **0** ; GET availability **2** |
| LIVE / Mailpit | `a2dea067…` ; 5 / 2 / 98 304 |

Préflight **OK**.

## 2. Marge temporelle et statut avant confirmation

Tentative `d566fc28-02de-4ae1-afbb-6f7d81362d4d` :

| Contrôle | Avant activation | Avant envoi | Immédiat pré-POST |
| --- | --- | --- | --- |
| Statut | `AWAITING_CONFIRMATION` | idem | idem |
| `expires_at` | `2026-11-01 15:07:51+01` | idem | idem |
| `secsLeft` | **5416** | **5396** | **5386** |
| Seuil (> 300 s) | OK | OK | OK |
| Clé / corps / empreinte | présents | — | — |
| Lease / submitted / référence | absents | absents | absents |
| Ouvertes session | 1 | — | — |

**GO temporel.** Aucune prolongation TTL.

Session : `AWAIT_CREATE_CONFIRMATION` ; Dupont / Camille / `camille.essai@example.test` / `+33000000000` ; PASSEPORT / PARIS / `2026-11-03` ; créneau `33333333-…` index 1.

## 3. Message unique

Exactement **`oui`** — `sessionId = rec008-8f2b37-new-01`.  
Activation 200 ; version attendue seule active ; webhooks chat OK.  
**Une seule tentative d’envoi.** Aucun retry.

## 4. Réponse HTTP et durée

| Mesure | Valeur |
| --- | --- |
| HTTP client | **status 0** |
| Durée | **3 ms** |
| Erreur | `TypeError: fetch failed` |
| Corps | vide (`response.txt` vide) |
| Désactivation | immédiate OK ; webhooks = 0 |

Aucune réponse conversationnelle. Aucun HTTP 500 workflow (requête non aboutie).

## 5. Nombre exact de CLAIM

**0** — tentative toujours `AWAITING_CONFIRMATION` ; pas de `submitted_at` / `confirmed_at` ; pas de lease.

## 6. Nombre exact de POST

| Mesure | Valeur |
| --- | --- |
| POST avant | 0 |
| POST après | **0** |
| Delta | **0** |
| `distinctKeys` | 0 |
| GET availability Δ | 0 |
| Cancel / reschedule | 0 |

## 7. Réponse mock

Aucune. Scénario `created` inchangé. Compteurs mock inchangés.

## 8. État de la tentative

| Champ | Après |
| --- | --- |
| Statut | **`AWAITING_CONFIRMATION`** (inchangé) |
| Clé / corps | toujours présents |
| Empreinte fp12 | `1aa346780669` (inchangée) |
| Référence / appointment_id | absents |
| Lease | absent |
| Marge restante (postflight) | ~5312 s |

## 9. Finalisation SQL

**Non exécutée** (pas d’exécution métier). Nœud Finaliser non atteint. Pas d’erreur `$3` ni conflit `text`/`uuid` observés (absence d’exécution).

## 10. État de la session

Inchangé : `AWAIT_CREATE_CONFIRMATION` / `CREATE_APPOINTMENT` / identité complète / `last_user_message = +33000000000` / référence vide.

## 11. Référence mock

Aucune référence nouvelle. Historique `REC008-MOCK-0001` (`ad71a155-…` / session `rec008-8f2b14-new-01`) inchangé.

## 12. Purge des données de tentative

**Non applicable** — tentative non clôturée ; secrets toujours présents (attendu pour `AWAITING_CONFIRMATION`).

## 13. Intégrité historique

Autres sessions inchangées. Tentatives ABANDONED / CONFIRMED / EXPIRED inchangées. Compteurs `1|10|4|0` ; 1 ouverte.

## 14. Intégrité LIVE / Mailpit

Inchangés. Workflow inactif ; VC **8** ; Finaliser SHA et graphe inchangés.

## 15. Verdict

**UNCERTAIN**

Cause : échec transport client vers le webhook chat avant tout traitement. Preuves d’absence d’effet secondaire : session/tentative/mock/LIVE/Mailpit inchangés.

Conformément aux restrictions : **aucun retry** dans cette phase.

## 16. GO/NO-GO

**NO-GO** pour les scénarios ultérieurs tant que la confirmation positive n’a pas été rejouée avec succès.

État conservé pour une **phase distincte** sous autorisation explicite :
- Tentative `d566fc28-…` encore valide (~5312 s au postflight ; expire `2026-11-01 15:07:51+01`).
- Re-vérifier `expires_at` et marge > 300 s avant tout nouvel `oui`.
- Si expirée → STOP ; ne jamais prolonger le TTL ni réutiliser la clé.

Arrêt ici.
