# REC-008 phase 8F-2B19 — Téléphone et récapitulatif avant confirmation

Un message `+33000000000` sur `rec008-8f2b14-new-01` (version `e84ee0d2-…` / 6). Téléphone persisté, transition `ASK_TELEPHONE` → `AWAIT_CREATE_CONFIRMATION`, récapitulatif + demande de confirmation. Une tentative `AWAITING_CONFIRMATION` créée (distincte de l’ancienne `ABANDONED`). **Aucun POST métier.**

Verdict : **PASS**.

Artefacts : `n8n/proposed/2026-10-30-rec008-phase8f2b19-PHONE-CONFIRMATION/` (`CONTRACT.json`, `RESULT.json`, `response.txt`).

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow | inactif, `activeVersionId = null` |
| Version / compteur | `e84ee0d2-7af9-417e-8d47-0a28580dccac` / 6 |
| Graphe | 134 / 137 |
| Autres actifs | 0 |
| Credentials / URL / isolation | TEST / 10 mock / OK |
| PostgreSQL TEST | 1 / 8 / 1 / 0 |
| Mock | total 2, GET services 1, GET availability 1, POST 0 |
| GovSuite | 13, 14, 12, 48, 0, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Mailpit | 5 / 2 / 98 304 |
| Session | `ASK_TELEPHONE`, Dupont / Camille / e-mail, téléphone vide, slot UUID |
| Ancienne tentative | `ABANDONED` (`8ae63b62-…`), clé/corps NULL, 0 ouverte |

## 2. Audit du routage

| Point | Constat |
| --- | --- |
| Téléphone | validation / normalisation ; `+33000000000` valide |
| Après dernier champ | `createDecision` INSERT → `attemptAction` INSERT → récap |
| Étape | `AWAIT_CREATE_CONFIRMATION` |
| INSERT | `Tirer aléa` → corps figé → empreinte → `Insérer tentative` → `Composer récapitulatif` |
| CreateAppointment | **non atteignable** depuis la branche INSERT |
| Claim | uniquement via CLAIM après `oui` explicite |

**GO activation.**

## 3. Contrôle de l’isolation

Credentials TEST, 10 URL mock, réseau isolé OK. GovSuite LIVE non touché.

## 4. Activation

`POST .../activate` → 200. Version `e84ee0d2-…`. Seul workflow actif.

## 5. Message unique

`+33000000000` — un seul message. Pas de `oui` / `non`.

## 6. Réponse HTTP

| Mesure | Valeur |
| --- | --- |
| HTTP | 200 |
| Durée | 12 743 ms |
| `type` | `create_appointment_question` |
| `conversationStep` | `AWAIT_CREATE_CONFIRMATION` |

Texte : récapitulatif + « Répondez exactement **oui** … **non** pour abandonner … ». Aucune affirmation de réservation déjà créée. Pas de token, référence ni clé exposée.

## 7. Récapitulatif retourné

PASSEPORT / PARIS / mardi 03 novembre 2026 / 09:00–09:30 / Dupont / Camille / `camille.essai@example.test` / `+33000000000`.

## 8. État PostgreSQL de la session

| Champ | Après |
| --- | --- |
| `telephone` | `+33000000000` |
| identité / créneau / service / site / dates | conservés |
| `conversation_step` | `AWAIT_CREATE_CONFIRMATION` |
| `intent` / `pending_action` | `CREATE_APPOINTMENT` |

## 9. Nouvelle tentative REC-008

Exactement **2** tentatives globales :

| Tentative | Session | Statut |
| --- | --- | --- |
| `8ae63b62-…` | ancienne | **`ABANDONED`** (inchangée) |
| `ad71a155-…` | `rec008-8f2b14-new-01` | **`AWAITING_CONFIRMATION`** |

Ouvertes : **1**. Pas de SUBMITTING / UNCERTAIN / CONFIRMED.

## 10. Corps figé et clé (sans secrets)

Sur la nouvelle tentative (valeurs non exposées) :

- Clé d’idempotence : présente (longueur 71)
- Corps figé : présent (`slotId`, nom, prénom, e-mail, téléphone, champ d’idempotence)
- Empreinte : présente (64 hex)
- Lease / référence / appointment_id : absents

## 11. Absence de claim, POST et création

| Contrôle | Résultat |
| --- | --- |
| POST mock | 0 |
| Cancel | 0 |
| `ready` / `claimAcquired` | absents / false |
| Rendez-vous | toujours 1, empreinte inchangée |
| Notifications / Mailpit | 0 / inchangé |

## 12. Compteurs mock

Total 2, GET services 1, GET availability 1, POST 0.

## 13. Compteurs PostgreSQL TEST

1 rendez-vous, 8 sessions, **2** tentatives (1 ABANDONED + 1 AWAITING_CONFIRMATION), 1 ouverte, 0 notification.

## 14. Durée et mémoire Ollama

12 743 ms ; 1,002 Gio → 1,029 Gio ; OOM false.

## 15. Désactivation

`active = false`, `activeVersionId = null`, 0 webhook, compteur 6, graphe 134/137.

## 16. Intégrité GovSuite LIVE et Mailpit

GovSuite inchangé. Mailpit 5 / 2 / 98 304.

## 17. Verdict

**PASS**.

## 18. GO/NO-GO

Test de confirmation positive (`oui`) sur `rec008-8f2b14-new-01`, après autorisation distincte : **GO**.

Activer ou envoyer `oui` / `non` maintenant sans autorisation : **NO-GO**.

Arrêt 8F-2B19.
