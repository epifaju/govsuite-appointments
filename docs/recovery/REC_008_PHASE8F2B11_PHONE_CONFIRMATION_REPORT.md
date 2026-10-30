# REC-008 phase 8F-2B11 — Test C5 : téléphone valide et récapitulatif

Un message `+33000000000` sur `rec008-8f2b4-slot-01` (version `e84ee0d2-…` / 6). Téléphone persisté, transition `ASK_TELEPHONE` → `AWAIT_CREATE_CONFIRMATION`, récapitulatif + demande de confirmation explicite. Une tentative `AWAITING_CONFIRMATION` créée. **Aucun POST métier.**

Verdict : **PASS**.

Artefacts : `n8n/proposed/2026-10-30-rec008-phase8f2b11-PHONE-CONFIRMATION/` (`CONTRACT.json`, `RESULT.json`, `response.txt`).

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow | inactif, `activeVersionId = null` |
| Version / compteur | `e84ee0d2-7af9-417e-8d47-0a28580dccac` / 6 |
| Graphe | 134 / 137 |
| Autres actifs | 0 |
| Credentials / URL / isolation | TEST / 10 mock / OK |
| PostgreSQL TEST | 1 / 7 / 0 / 0 |
| Mock | total 6, GET 6, POST 0 |
| GovSuite | 13, 14, 12, 48, 0, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Mailpit | 5 / 2 / 98 304 |
| Tentatives ouvertes | 0 |

## 2. Contrat attendu après collecte du téléphone

Lecture seule avant activation (`CONTRACT.json`) :

| Point | Constat |
| --- | --- |
| Format téléphone | normalisation ; ≥ 8 chiffres → `+33000000000` valide |
| Après dernier champ | `createDecision` INSERT → `attemptAction` INSERT → récap |
| Étape | `AWAIT_CREATE_CONFIRMATION` |
| Tentative | `AWAITING_CONFIRMATION` + corps figé + clé d’idempotence |
| POST | **impossible** depuis INSERT / Valider / Demander |
| `Appeler CreateAppointment` | uniquement via `Corps figé présent ?` après claim |
| `ready` | `claimAcquired === true` seulement |

**GO activation** (le téléphone seul ne peut pas POST).

## 3. État initial de session

`ASK_TELEPHONE`, Dupont / Camille / `camille.essai@example.test`, téléphone vide, slot UUID, CREATE_APPOINTMENT, dernière entrée `abc`.

## 4. Activation

`POST .../activate` → 200. Version `e84ee0d2-…`. Seul workflow actif. Webhooks chat OK.

## 5. Message unique

`+33000000000` — un seul message. Pas de `oui` / confirmation.

## 6. Réponse HTTP

| Mesure | Valeur |
| --- | --- |
| HTTP | 200 |
| Durée | 94 470 ms |
| `type` | `create_appointment_question` |
| `conversationStep` | `AWAIT_CREATE_CONFIRMATION` |

Texte : récapitulatif + « Répondez exactement **oui** … **non** pour abandonner … ».

## 7. Téléphone persisté

| Champ | Après |
| --- | --- |
| `telephone` | `+33000000000` |
| nom / prénom / email / slot | inchangés |
| `intent` / `pending_action` | `CREATE_APPOINTMENT` |

## 8. Récapitulatif affiché

Service PASSEPORT, site PARIS, date mardi 03 novembre 2026, 09:00–09:30, Dupont / Camille, e-mail et téléphone affichés. Aucune affirmation de réservation déjà effectuée. Pas de token de gestion ni référence définitive.

## 9. Transition conversationnelle

`ASK_TELEPHONE` → **`AWAIT_CREATE_CONFIRMATION`** (PG + JSON).

## 10. État de la tentative REC-008

Exactement **1** tentative :

| Attribut | Valeur |
| --- | --- |
| Statut | `AWAITING_CONFIRMATION` |
| Clé d’idempotence | présente (non exposée) |
| Empreinte | présente (64 hex) |
| Corps figé | présent (`slotId`, nom, prénom, e-mail, téléphone, `cleIdempotence`, …) |
| Lease / SUBMITTING / CONFIRMED | absents |
| Référence rendez-vous | absente |

## 11. Validation/missing

Branche **INSERT → Composer** : le JSON de réponse ne contient pas `validation` / `missing` / `ready` (contrat Composer). Complétude vérifiée via PG + corps figé + récap. Pas de claim.

## 12. Invariants de sécurité

| Invariant | Statut |
| --- | --- |
| POST mock | 0 |
| Rendez-vous | toujours 1 |
| Notifications / e-mails | 0 / Mailpit inchangé |
| Auto-CONFIRMED | non |
| Confirmation positive envoyée | non |
| GovSuite LIVE | inchangé |

## 13. Compteurs mock

Total 6, GET availability 6, POST 0.

## 14. Compteurs PostgreSQL TEST

1 rendez-vous, 7 sessions, **1** tentative (`AWAITING_CONFIRMATION`), 0 notification.

## 15. Durée et mémoire Ollama

94 470 ms ; 79,27 Mio → 1,165 Gio ; OOM false.

## 16. Désactivation

`active = false`, `activeVersionId = null`, 0 webhook, compteur 6, graphe 134/137.

## 17. Intégrité GovSuite

Inchangée : 13, 14, 12, 48, 0, empreinte `a2dea067599fd4f0a5f857551adc67cc`.

## 18. Verdict

**PASS**.

Note harness : un critère initial trop strict sur le corps figé (absence de service/site, normale) a été recalculé hors ligne sur les artefacts — aucun second message.

## 19. GO/NO-GO

Test distinct de réponse **négative** (`non`) ou de **confirmation** (`oui`), après autorisation distincte : **GO**.

Activer ou envoyer une confirmation maintenant sans autorisation : **NO-GO**.

Arrêt 8F-2B11.
