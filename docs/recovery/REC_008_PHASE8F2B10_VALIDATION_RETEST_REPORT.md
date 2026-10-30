# REC-008 phase 8F-2B10 — Validation conversationnelle du correctif

Un message invalide `abc` sur `rec008-8f2b4-slot-01` (version `e84ee0d2-…` / 6). Téléphone refusé, `ASK_TELEPHONE` conservé, mémoire métier intacte. `validation` / `missing` désormais cohérents avec PostgreSQL. Aucun POST, aucune tentative.

Verdict : **PASS**.

Artefacts : `n8n/proposed/2026-10-30-rec008-phase8f2b10-VALIDATION-RETEST/RESULT.json`.

Note opératoire : une première livraison HTTP a échoué (`fetch failed` / `other side closed`, 6 ms) sans atteindre le workflow — session inchangée. Désactivation. Un seul message métier traité ensuite (pas de retry métier).

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow | inactif, `activeVersionId = null` |
| Version / compteur | `e84ee0d2-7af9-417e-8d47-0a28580dccac` / 6 |
| Graphe | 134 / 137 |
| Valider SHA | `7b237d3f…` (correctif 8F-2B9) |
| Autres actifs | 0 |
| Credentials / URL / isolation | TEST / 10 mock / OK |
| PostgreSQL TEST | 1 / 7 / 0 / 0 |
| Mock | total 6, GET 6, POST 0 |
| GovSuite | 13, 14, 12, 48, 0, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Mailpit | 5 / 2 / 98 304 |
| Tentatives ouvertes session | 0 |

## 2. État initial de session

| Champ | Valeur |
| --- | --- |
| `conversation_step` | `ASK_TELEPHONE` |
| `nom` / `prenom` / `email` | Dupont / Camille / `camille.essai@example.test` |
| `telephone` | vide |
| `slot_id` | `33333333-…` |
| service / site / dates | PASSEPORT / PARIS / 2026-11-03 |

## 3. Activation

`POST .../activate` → 200. Version `e84ee0d2-…` active. Seul workflow actif. Webhooks chat enregistrés.

## 4. Message envoyé

Texte unique : `abc`.

Aucun autre message. Aucun retry métier.

## 5. Réponse HTTP

| Mesure | Valeur |
| --- | --- |
| HTTP | 200 |
| Durée | 97 318 ms |
| `type` | `create_appointment_question` |
| `conversationStep` | `ASK_TELEPHONE` |
| Texte | `📱 Quel est votre **numéro de téléphone** ?` |
| `attemptAction` | `COLLECT` |

## 6. Analyse du téléphone invalide

| Contrôle | Résultat |
| --- | --- |
| `telephone` PG | toujours vide |
| Accepté comme téléphone | non |
| Dérive d’intention | non (`CREATE_APPOINTMENT` conservé) |
| Étape | `ASK_TELEPHONE` conservée |
| `last_user_message` | `abc` (reçu, non validé) |

## 7. Comparaison validation/missing avant / après correctif

| Champ | Avant correctif (C2–C4) | Après 8F-2B9 (ce test) |
| --- | --- | --- |
| `slotIdValide` | `false` | **`true`** |
| `emailValide` | `false` | **`true`** |
| `telephoneValide` | `false` | `false` |
| `missing` | créneau, nom, prénom, e-mail, téléphone | **uniquement** `le numéro de téléphone` |

## 8. Cohérence avec PostgreSQL

PG : slot, nom, prénom, e-mail présents ; téléphone vide → aligné avec `validation` / `missing`.

## 9. Vérification ready / claimAcquired

| Champ | Valeur |
| --- | --- |
| `ready` | `false` |
| `claimAcquired` | `false` |
| POST métier | 0 |
| Tentative | 0 |

Autorisation POST inchangée : validation informative corrigée sans claim.

## 10. Compteurs mock

Total 6, GET availability 6, POST 0 — inchangés.

## 11. Compteurs PostgreSQL TEST

1 rendez-vous, 7 sessions, 0 tentative, 0 notification.

## 12. Durée et mémoire Ollama

| Mesure | Valeur |
| --- | --- |
| Durée | 97 318 ms |
| Mémoire | 73,59 Mio → 1,117 Gio / 1,5 Gio |
| OOMKilled | false |

## 13. Désactivation

`active = false`, `activeVersionId = null`, 0 webhook, compteur 6, graphe 134/137.

## 14. Intégrité GovSuite

Inchangée : 13, 14, 12, 48, 0, empreinte `a2dea067599fd4f0a5f857551adc67cc`. Mailpit inchangé.

## 15. Verdict

**PASS**.

## 16. GO/NO-GO collecte téléphone valide

Collecte d’un téléphone valide (puis éventuel C5), après autorisation distincte : **GO**.

Activer ou chatter maintenant sans autorisation : **NO-GO**.

Arrêt 8F-2B10.
