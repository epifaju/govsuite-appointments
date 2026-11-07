# REC-008 phase 8F-2B14 — Nouvelle session et demande de disponibilités

Un message de disponibilités sur la nouvelle session `rec008-8f2b14-new-01` (version `e84ee0d2-…` / 6). Intention `GET_AVAILABILITY`, créneau fictif présenté avec index. Isolation complète vis-à-vis de `rec008-8f2b4-slot-01`. **Aucune tentative**, **aucun POST métier**.

Verdict : **PASS**.

Artefacts : `n8n/proposed/2026-10-30-rec008-phase8f2b14-NEW-SESSION-AVAILABILITY/` (`CONTRACT.json`, `RESULT.json`, `response.txt`).

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow | inactif, `activeVersionId = null` |
| Version / compteur | `e84ee0d2-7af9-417e-8d47-0a28580dccac` / 6 |
| Graphe | 134 / 137 |
| Autres actifs | 0 |
| Credentials / URL / isolation | TEST / 10 mock / OK |
| PostgreSQL TEST | 1 / 7 / 1 / 0 |
| Mock | total 1, GET services 1, GET availability 0, POST 0 |
| GovSuite | 13, 14, 12, 48, 0, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Mailpit | 5 / 2 / 98 304 |
| Nouvelle session | absente |
| Ancienne tentative | `ABANDONED`, clé/corps NULL, 0 ouverte |

## 2. État initial

| Élément | Valeur |
| --- | --- |
| Ancienne session | `rec008-8f2b4-slot-01`, `intent = GET_SERVICES`, brouillon vide, `last_user_message = oui` |
| Nouvelle session | inexistante |
| Tentatives | 1 historique `8ae63b62-…` / `ABANDONED` |
| Rendez-vous TEST | 1, empreinte `986b715d…` |

## 3. Audit du routage

| Point | Constat |
| --- | --- |
| Parser | reconnaît `GET_AVAILABILITY` ; extraction service / site / dates |
| Router intention | branche `GET_AVAILABILITY` → `Valider paramètres disponibilité` |
| HTTP | `Appeler GetAvailability` = GET mock `/appointments/availability` |
| CreateAppointment | **non atteignable** depuis GetAvailability |
| Tentative abandonnée | exclue de `Lire tentative de session` |
| Nouvelle session | état chargé / persisté par `sessionId` indépendant |

**GO activation.**

## 4. Activation

`POST .../activate` → 200. Version `e84ee0d2-…`. Seul workflow actif. Webhooks chat OK.

## 5. Message unique

Session : `rec008-8f2b14-new-01`.

`Je souhaite connaître les disponibilités pour un passeport à Paris du 03/11/2026 au 03/11/2026.`

Un seul message. Pas de sélection, pas d’identité, pas de `oui`.

## 6. Réponse HTTP

| Mesure | Valeur |
| --- | --- |
| HTTP | 200 |
| Durée | 77 886 ms |
| `type` | `availability` |

## 7. Disponibilités retournées

Exactement **1** créneau :

| Champ | Valeur |
| --- | --- |
| Index | **1** |
| Id | `33333333-3333-4333-8333-333333333333` |
| Service / site | PASSEPORT / PARIS |
| Horaires | 2026-11-03 09:00–09:30 (+01) |
| Places | 2 |

Texte invitant à sélectionner un numéro (ex. « Je prends le 2 ») — sélection **non** effectuée ici.

## 8. État de la nouvelle session

| Champ | Après |
| --- | --- |
| `session_id` | `rec008-8f2b14-new-01` |
| `intent` / `pending_action` | `GET_AVAILABILITY` |
| `service` / `site` | `PASSEPORT` / `PARIS` |
| `date_debut` / `date_fin` | `2026-11-03` |
| `available_slots` | 1 créneau mémorisé (index 1) |
| `slot_id` / identité | vides |
| `conversation_step` | vide |

## 9. Isolation vis-à-vis de l’ancienne session

| Contrôle | Résultat |
| --- | --- |
| Identifiants | distincts |
| Identité héritée | aucune |
| Corps figé / clé hérités | aucun |
| Ancienne session | inchangée (`GET_SERVICES`, `last_user_message = oui`) |
| Ancienne tentative | toujours `ABANDONED`, non réactivée |

## 10. Tentatives REC-008

Toujours **1** tentative globale (`ABANDONED`). **0** tentative pour la nouvelle session. **0** ouverte. Pas de claim.

## 11. Compteurs mock

Total **2** : GET services 1, GET availability **1**, POST **0**.

## 12. Compteurs PostgreSQL TEST

1 rendez-vous, **8** sessions, 1 tentative, 0 notification. Empreinte rendez-vous inchangée.

## 13. Durée et mémoire Ollama

77 886 ms ; 57,12 Mio → 1,081 Gio ; OOM false.

## 14. Désactivation

`active = false`, `activeVersionId = null`, 0 webhook, compteur 6, graphe 134/137.

## 15. Intégrité GovSuite et Mailpit

GovSuite inchangé. Mailpit 5 / 2 / 98 304.

## 16. Verdict

**PASS**.

## 17. GO/NO-GO

Sélection du créneau sur `rec008-8f2b14-new-01`, après autorisation distincte : **GO**.

Sélectionner, collecter une identité ou confirmer maintenant sans autorisation : **NO-GO**.

Arrêt 8F-2B14.
