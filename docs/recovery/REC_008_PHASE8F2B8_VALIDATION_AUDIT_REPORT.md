# REC-008 phase 8F-2B8 — Audit et correction hors ligne validation/missing

Anomalie C1–C4 : `missing` / `slotIdValide` obsolètes sur la branche COLLECT. Cause confirmée : projection destructive de `Décider action tentative`. Correction **Option B** hors ligne — hydratation informative dans `Valider paramètres création` depuis `Gérer collecte progressive`. `ready` / `claimAcquired` inchangés. Aucune installation.

Verdict : **PASS**.

Artefacts : `n8n/proposed/2026-10-30-rec008-phase8f2b8-NON-PUBLIE/`.

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
| PostgreSQL TEST | 1 / 7 / 0 / 0 |
| Mock | total 6, GET 6, POST 0 |
| GovSuite | 13, 14, 12, 48, 0, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Mailpit | 5 / 2 / 98 304 |

Préflight OK (`PREFLIGHT.json`).

## 2. État initial de session

`rec008-8f2b4-slot-01` :

| Champ | Valeur |
| --- | --- |
| `conversation_step` | `ASK_TELEPHONE` |
| `nom` / `prenom` / `email` | `Dupont` / `Camille` / `camille.essai@example.test` |
| `telephone` | vide |
| `slot_id` | `33333333-3333-4333-8333-333333333333` |
| `intent` / `pending_action` | `CREATE_APPOINTMENT` |
| service / site / dates | PASSEPORT / PARIS / 2026-11-03 |

## 3. Chemin de données exact

| Étape | Champs présents | Absents / transformation |
| --- | --- | --- |
| Fusionner état conversation | `slotId`, identité, intent, step, slots | — |
| Gérer collecte progressive | idem + `createDecision` | — |
| Sauvegarder état conversation | persistance PG (`slot_id`, nom, …) | — |
| Router intention | JSON sauvegardé complet | — |
| **Décider action tentative** | `sessionId`, `conversationStep`, `attemptAction`, `ready:false`, `claimAcquired:false` | **Destructif** : pas de `slotId` / nom / prénom / email / téléphone / intent / pendingAction |
| Aiguiller tentative | routage | `COLLECT` ∉ règles → **fallback extra** |
| Valider paramètres création | (avant) valide le payload réduit | `missing` trompeur |
| Création prête ? | `ready === true` | uniquement si `claimAcquired` |
| Demander paramètres création | texte selon `conversationStep` | — |

`Appeler CreateAppointment` n’est atteignable que depuis `Corps figé présent ?` (après claim / corps gagnant).

## 4. Cause racine démontrée

1. `Décider` reconstruit un JSON de **routage** minimal.
2. `COLLECT` tombe en **fallback** → `Valider`.
3. `Valider` calcule `missing` / `slotIdValide` sur ce JSON vide.
4. Le rewrite de `conversationStep` dans Valider exige `intent` / `pendingAction` — absents — donc l’étape Gérer est conservée (d’où texte correct + validation fausse).

Reproduit hors ligne : **T15**.

## 5. Comparaison options A / B

| Critère | A — enrichir Décider | B — hydrater Valider depuis Gérer |
| --- | --- | --- |
| Nœuds | 1 (`Décider`) | 1 (`Valider`) |
| Blast radius | Toutes branches Aiguiller | COLLECT → Valider seulement |
| PII dans réponse chat | Élevé (`...x` propage les champs) | Faible (return sur payload routé) |
| REC-008 | Risque de surprendre Préparer/INSERT | `ready` inchangé |
| Régression | Plus large | Limitée |

**Option retenue : B.**

## 6. Correction retenue

Dans `Valider paramètres création` :

- Lire `$('Gérer collecte progressive')` pour hydrater **informatiquement** `slotId`, `nom`, `prenom`, `email`, `telephone`, `intent`, `pendingAction`.
- `claimAcquired` **uniquement** depuis le payload routé.
- `ready = claimAcquired === true` **inchangé**.
- Return basé sur le payload routé + `missing` / `validation` / `conversationStep` — **sans** réémettre le PII collecté.

`Décider`, graphe, credentials, URL mock, webhook, settings, empreinte / corps figé : **inchangés**.

## 7. Diff exact

Un seul nœud modifié : `Valider paramètres création`.

Voir `DIFF_NODES.txt`, `DIFF_META.json`, `node-Valider_param_tres_cr_ation.js` (avant) / `node-Valider-FIXED.js` (après).

SHA Valider : `6fa62389…` → `7b237d3f…`.

## 8. Résultats T1–T18 (+ extras)

Tous **PASS** (`OFFLINE_TESTS.json`).

| ID | Titre | Résultat |
| --- | --- | --- |
| T1 | Slot valide reconnu | PASS |
| T2 | Nom reconnu | PASS |
| T3 | Prénom reconnu | PASS |
| T4 | E-mail valide reconnu | PASS |
| T5 | Téléphone manquant signalé | PASS |
| T6 | `missing` fidèle | PASS (seul téléphone) |
| T7 | COLLECT ≠ POST | PASS |
| T8 | INSERT ≠ POST | PASS |
| T9 | CLAIM sans lease ≠ POST | PASS |
| T10 | RESUME sans lease ≠ POST | PASS |
| T11 | CLAIM + claimAcquired → ready | PASS |
| T12 | UNCERTAIN ≠ CONFIRMED | PASS |
| T13 | Nouvelle demande indépendante | PASS |
| T14 | ABANDONED non réutilisée | PASS |
| T15 | Anomalie reproduite (avant) | PASS |
| T16 | Anomalie corrigée (après) | PASS |
| T17 | Empreinte / corps figé inchangés | PASS |
| T18 | Aucun nouveau chemin CreateAppointment | PASS |
| T19 | ready false sans claim même si champs OK | PASS |
| T20 | Décider inchangé | PASS |
| T21 | Credentials / URL / webhook / settings | PASS |

## 9. Invariants REC-008

| Invariant | Statut |
| --- | --- |
| Validation informative ≠ autorisation POST | OK |
| `ready` ≠ complétude des champs | OK (`claimAcquired` only) |
| COLLECT / INSERT ≠ POST | OK |
| POST seulement via `Corps figé présent ?` après claim | OK |
| `AWAIT_CREATE_CONFIRMATION` / SUBMITTING / UNCERTAIN | inchangés (Décider) |
| Corps figé + empreinte | inchangés |
| Claim SQL non contourné | OK |

## 10. SHA-256 des artefacts

Voir `SHA256.json` :

| Fichier | SHA-256 |
| --- | --- |
| `source-installed.json` | `be5037e4664875c0a927d21181ea4bc81a6d11ffb70889956993c8ddb67ed8d4` |
| `10_AI_ConsularAssistant_VALIDATION_FIX_NON_PUBLIE.json` | `d90d5e77165579949b2f520c3fb85ad9f544f8dba3afe8b022ee0a8eb96c6a91` |
| Valider avant | `6fa62389cdecbc5024081ca51d306e26ffa98b1b27808ba30ee72c22a66772be` |
| Valider après | `7b237d3fd446d30cca1cc56ff406cc3a9fc3afccdee50cad62c3248b8607f162` |
| Décider (inchangé) | `eb7b8e3e3da17a1c5c514cf6ef149af6ba8b0c238fd27b3c8549d1f9390c9f95` |

Graphe candidat : 134 nœuds / 137 connexions.

## 11. Risques résiduels

- Dépendance n8n `$('Gérer collecte progressive')` : si le nœud n’a pas tourné, repli sur le payload routé (comportement actuel).
- `conversationStep` peut être réaligné par Valider une fois `intent`/`pendingAction` hydratés — cohérent avec les champs, à revalider en C5.
- Correction **non installée** : l’instance TEST conserve l’anomalie jusqu’à autorisation d’install.

## 12. Postflight TEST

PostgreSQL : `1|7|0|0`. Mock : total 6, GET 6, POST 0. Aucune activation, aucun chat, aucun PUT.

## 13. Intégrité GovSuite

Inchangée : 13, 14, 12, 48, 0, empreinte `a2dea067599fd4f0a5f857551adc67cc`.

## 14. Verdict

**PASS**.

## 15. GO/NO-GO installation TEST

Installation TEST du candidat (PUT + retest C4/C5), après autorisation distincte : **GO**.

Activer, chatter, ou publier maintenant : **NO-GO**.

Arrêt 8F-2B8.
