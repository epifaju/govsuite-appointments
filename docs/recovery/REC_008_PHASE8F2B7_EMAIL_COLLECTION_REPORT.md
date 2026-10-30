# REC-008 phase 8F-2B7 — Test C4 : collecte de l’adresse e-mail

Un message `camille.essai@example.test` sur la session existante `rec008-8f2b4-slot-01`. L’e-mail est persisté, transition `ASK_EMAIL` → `ASK_TELEPHONE`, identité et mémoire métier conservées. Aucun POST, aucune tentative. Cause racine de l’anomalie `validation`/`missing` identifiée en lecture seule.

Verdict du scénario : **PASS**.

Artefacts : `n8n/proposed/2026-10-30-rec008-phase8f2b7-EMAIL-COLLECTION/RESULT.json`, `VALIDATION_AUDIT.json`.

Note opératoire : une première tentative de livraison HTTP a échoué côté client (`TypeError: fetch failed`) sans atteindre le workflow — session inchangée (`ASK_EMAIL`, e-mail vide), mock inchangé, 0 tentative. Désactivation immédiate. Un seul message métier a ensuite été traité avec succès (pas de retry métier).

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow | inactif, `activeVersionId = null` |
| Version / compteur | `12e6b201-6173-457e-97c4-a17cc1900eb6` / 5 |
| Graphe | 134 / 137 |
| Autres workflows actifs | 0 |
| Credentials | PostgreSQL `Fs0l0058q5CEadRw` (30), Ollama `dxzHqBq8Q60R8BOz` |
| HTTP | 10 URL mock |
| Isolation | OK |
| PostgreSQL TEST | 1 rendez-vous, 7 sessions, 0 tentative, 0 notification |
| Mock | total 6, GET availability 6, POST 0 |
| GovSuite | 13, 14, 12, 48, 0, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Mailpit | 5 / 2 / 98 304 |

Préflight OK.

## 2. État initial de session

| Champ | Valeur |
| --- | --- |
| `intent` / `pending_action` | `CREATE_APPOINTMENT` |
| `conversation_step` | `ASK_EMAIL` |
| `nom` / `prenom` | `Dupont` / `Camille` |
| `email` | vide |
| `service` / `site` | `PASSEPORT` / `PARIS` |
| Dates | `2026-11-03` |
| `slot_id` | `33333333-3333-4333-8333-333333333333` |

## 3. Activation

`POST .../activate` → 200. Version `12e6b201-…` active. Seul workflow actif. Webhooks chat enregistrés.

## 4. Message et réponse

Texte unique : `camille.essai@example.test`.

| Mesure | Valeur |
| --- | --- |
| HTTP | 200 |
| Durée | 117 230 ms |
| `type` | `create_appointment_question` |
| `conversationStep` | `ASK_TELEPHONE` |
| Texte | `📱 Quel est votre **numéro de téléphone** ?` |
| `attemptAction` | `COLLECT` |
| `ready` / `claimAcquired` | `false` / `false` |

## 5. E-mail persisté

| Champ | Avant | Après |
| --- | --- | --- |
| `email` | `` | `camille.essai@example.test` |
| `nom` / `prenom` | `Dupont` / `Camille` | inchangés |
| `telephone` | `` | `` |
| `last_user_message` | `Camille` | `camille.essai@example.test` |

## 6. Transition ASK_EMAIL → ASK_TELEPHONE

| Champ | Avant | Après |
| --- | --- | --- |
| `conversation_step` | `ASK_EMAIL` | `ASK_TELEPHONE` |
| Texte | (attente e-mail) | demande du **téléphone** |

## 7. Conservation des données métier

`intent`, `pending_action`, service, site, dates, `slot_id`, `available_slots`, nom et prénom inchangés. Aucun GET availability supplémentaire. Aucun POST.

## 8. Audit validation/missing (lecture seule)

### Observé

| Champ | Réponse JSON | PostgreSQL |
| --- | --- | --- |
| `slot_id` | — | UUID présent |
| `email` | — | `camille.essai@example.test` |
| `validation.slotIdValide` | `false` | devrait être `true` |
| `validation.emailValide` | `false` | devrait être `true` |
| `missing` | créneau, nom, prénom, e-mail, téléphone | seul téléphone manque réellement |
| `conversationStep` | `ASK_TELEPHONE` | correct |
| `ready` / `claimAcquired` | `false` / `false` | attendu sur branche COLLECT |

### Cause racine

1. **`Décider action tentative`** reconstruit un JSON **réduit** :

   `sessionId`, `conversationStep`, `attemptAction`, `modifyField`, `openAttempt`, `reference`, `ready: false`, `claimAcquired: false`

   **Sans** `slotId`, `nom`, `prenom`, `email`, `telephone`, `intent`, `pendingAction`.

2. `attemptAction = COLLECT` (défaut hors tentative ouverte) **n’est pas** une règle de **`Aiguiller tentative`** (INSERT/CLAIM/RESUME/…/RESET_STALE). Sortie **fallback `extra`** → **`Valider paramètres création`**.

3. **`Valider paramètres création`** calcule `missing` / `slotIdValide` / `emailValide` sur ce payload vide → tous les champs apparaissent manquants.

4. Le bloc qui réécrit `conversationStep` dans Valider ne s’exécute que si `intent === 'CREATE_APPOINTMENT'` ou `pendingAction === 'CREATE_APPOINTMENT'` — absents du payload. Donc **`conversationStep` de Gérer est conservé** → Demander pose la bonne question.

### Timing

Validation **après** Fusionner + Gérer (état session complet), mais sur une **projection destructive** de Décider — pas avant la fusion.

### Chemin d’exécution

`Fusionner état conversation` → `Gérer collecte progressive` → `Sauvegarder état conversation` → `Router intention` → **`Décider action tentative`** → **`Aiguiller tentative` (fallback COLLECT)** → **`Valider paramètres création`** → `Création prête ?` (`ready=false`) → `Demander paramètres création`.

### Impact C5 (documenté, non corrigé)

- Sur COLLECT, `Valider.ready` exige `claimAcquired === true` → reste `false`.
- Le passage confirmation dépend de `createDecision` / INSERT / CLAIM dans Gérer/Décider, pas de ce `ready`.
- Risque : JSON `missing` trompeur jusqu’à C5 ; à auditer avant C5 sans modifier le workflow ici.

Aucune modification de workflow dans cette phase.

## 9. Compteurs mock

| Moment | total | GET availability | POST |
| --- | --- | --- | --- |
| Préflight | 6 | 6 | 0 |
| Après e-mail | 6 | 6 | 0 |

## 10. Compteurs PostgreSQL TEST

1 rendez-vous, 7 sessions, 0 tentative, 0 notification — avant et après.

## 11. Durée et mémoire Ollama

| Mesure | Valeur |
| --- | --- |
| Durée chat | 117 230 ms |
| Mémoire | 94,55 Mio → 1,141 Gio / 1,5 Gio |
| OOMKilled | false |

## 12. Désactivation

`active = false`, `activeVersionId = null`, 0 webhook, 0 autre actif, compteur 5, graphe 134/137.

## 13. Intégrité GovSuite

Inchangée : 13, 14, 12, 48, 0, empreinte `a2dea067599fd4f0a5f857551adc67cc`. Mailpit inchangé.

## 14. Verdict

**PASS**.

| Critère | Statut |
| --- | --- |
| HTTP 200, e-mail persisté | OK |
| Nom/prénom conservés | OK |
| `ASK_EMAIL` → `ASK_TELEPHONE` | OK |
| Mémoire / `slot_id` conservés | OK |
| 0 GET / 0 POST / 0 tentative | OK |
| Cause racine validation documentée | OK |
| Désactivation / postflight | OK |

## 15. GO/NO-GO pour l’audit de validation avant C5

Audit dédié de la projection **Décider → Valider** (avant C5), après autorisation distincte : **GO**.

Activer, chatter, corriger le workflow, ou lancer C5 maintenant : **NO-GO**.

Arrêt 8F-2B7.
