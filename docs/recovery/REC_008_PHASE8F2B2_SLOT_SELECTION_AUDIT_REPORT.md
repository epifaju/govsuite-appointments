# REC-008 phase 8F-2B2 — Audit et correction hors ligne de la sélection de créneau

Diagnostic hors ligne de l’échec C1 (8F-2B1). Une copie NON PUBLIÉE corrige uniquement `Fusionner état conversation`. Aucune installation, activation ni chat.

Verdict installation TEST ultérieure (après autorisation distincte) : **GO**.

## Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow | inactif, `activeVersionId = null` |
| Version / compteur | `2fea54b3-ed59-4b83-a404-7166bad06fb2` / 4 |
| Graphe | 134 / 137 |
| PostgreSQL TEST | 1 rendez-vous, 6 sessions, 0 tentative |
| Mock | total 5, GET availability 5, POST 0 |
| GovSuite | 13, 14, 12, 48, 0, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Mailpit | 5 / 2 / 98 304 |
| Isolation | aucun TCP GovSuite ouvert |

Export lecture seule : `n8n/proposed/2026-10-30-rec008-phase8f2b2-NON-PUBLIE/source-installed.json`  
SHA-256 : `36259a0f8400570c22a3a255611c3a2e18ccc3fa83945b29fd492a4d37812e78`

## Reconstitution des données

Chaîne : `Parser intention` → `Fusionner état conversation` → `Gérer collecte progressive` → `Sauvegarder état conversation`.

Après msg1 (8F-2B1) : `pending_action = GET_AVAILABILITY`, service/site/dates renseignés, `available_slots` contient l’UUID `33333333-…`.

`Mémoriser créneaux proposés` (Postgres) écrit `available_slots` et remet `selected_slot_index` à NULL.

Msg2 « Je prends le 1. » :

| Nœud | Effet observé / code |
| --- | --- |
| `Parser intention` | `selectedSlotIndex = 1` ; intent forcé `CREATE_APPOINTMENT` (choix de créneau hors RESCHEDULE) |
| `Fusionner` | `actionChanged = true` (pending `GET_AVAILABILITY` ≠ intent `CREATE`) → branche « nouvelle action » : service/site/dates null, **`availableSlots = []`**, index 1 conservé |
| Section 15 Fusionner | résolution index→UUID **impossible** car `availableSlots.length === 0` |
| `Gérer collecte` | `newBusinessAction` vrai → `pendingAction = CREATE`, `conversationStep = null` puis `ASK_CREATE_SERVICE` (pas de `slotId`) |
| `Sauvegarder` | persiste l’état déjà incorrect (`available_slots = []`, pas de `slot_id`) |

**Premier nœud où l’état devient incorrect :** `Fusionner état conversation` (vidage de `availableSlots` avant la conversion d’index).

## Cause racine prouvée

```javascript
const actionChanged =
  !createFlowLocked &&
  hasExplicitBusinessIntent &&
  hasValue(previousPendingAction) &&
  (currentIntent !== previousPendingAction || explicitRestart);
```

Avec `previousPendingAction = 'GET_AVAILABILITY'` et `currentIntent = 'CREATE_APPOINTMENT'`, `actionChanged` est vrai. La branche associée force :

```javascript
availableSlots = [];
```

alors que la section « CONVERSION DU NUMERO DE CRENEAU » exige `availableSlots.length > 0` pour poser `slotId`. L’index `1` est donc mémorisé sans UUID, et les critères du tour disponibilité sont perdus.

Ce n’est pas un défaut de `pick` sur la branche else (corrigée en 8F-1F-B) : le flux emprunte la branche **changement d’action métier**, qui efface volontairement les créneaux — approprié pour une nouvelle CREATE indépendante, incorrect pour une sélection post-disponibilité.

## Nœuds concernés

| Nœud | Rôle | Modifié ? |
| --- | --- | --- |
| `Parser intention` | extrait l’index ; mappe vers CREATE | Non (comportement correct pour C1) |
| `Fusionner état conversation` | efface puis devrait résoudre | **Oui** |
| `Gérer collecte progressive` | suit l’état fusionné | Non |
| `Mémoriser créneaux proposés` | persiste les slots après GET | Non |
| `Sauvegarder état conversation` | UPSERT | Non |

## Correction proposée

Dans `Fusionner`, avant la branche destructive :

`slotSelectionFromAvailability` = pending précédent `GET_AVAILABILITY` + intent courant `CREATE_APPOINTMENT` + `selectedSlotIndex` présent + pas de verrou tentative + pas de restart explicite.

Dans ce cas :

- conserver service/site/dates via `pick` ;
- `availableSlots = previousAvailableSlots` ;
- garder `selectedSlotIndex` ;
- laisser la section 15 résoudre `slotId` ;
- intent `CREATE_APPOINTMENT`.

Les CREATE indépendantes (sans index, ou restart explicite) continuent d’effacer les créneaux. `createFlowLocked` (AWAITING / SUBMITTING / UNCERTAIN) reste prioritaire.

## Diff exact

Un seul nœud Code : `Fusionner état conversation`.

| Empreinte jsCode | SHA-256 |
| --- | --- |
| Avant | `f5c98a993d7ed0cebc0768ac6be71b26721063caa4adfe0574d6bd10d1f90656` |
| Après | `d1c7f99122e1bdb4ae18e0636bbee9d36af816084300c3336eaa6acb57ac79b1` |

134 nœuds, 137 connexions inchangés.

## Résultats des tests hors ligne T1–T16

| Test | Résultat |
| --- | --- |
| T1 conservation PASSEPORT | PASS |
| T2 conservation PARIS | PASS |
| T3 dateDebut | PASS |
| T4 dateFin | PASS |
| T5 availableSlots | PASS |
| T6 index 1 → UUID | PASS |
| T7 CREATE_APPOINTMENT | PASS |
| T8 ASK_NOM | PASS |
| T9 index 9 rejeté | PASS |
| T10 slots vides | PASS |
| T11 demande indépendante sans réutiliser créneau | PASS |
| T12 tentative ABANDONED n’empêche pas (pas de verrou) | PASS |
| T13 UNCERTAIN verrouillé (`createFlowLocked`) | PASS |
| T14 pas de chemin POST ajouté | PASS |
| T15 reproduction bug code actuel | PASS |
| T16 correction code proposé | PASS |

**16/16 PASS.** Limites : simulateur déterministe de Fusionner + étape Gérer simplifiée ; pas d’exécution n8n/Ollama/UPSERT réel.

## Invariants REC-008

- Credentials TEST uniquement ; URL mock uniquement.
- Un seul `Appeler CreateAppointment` ; aucun POST dans le nœud Fusionner.
- Claim / lease / UNCERTAIN / idempotence inchangés.
- Pas d’UUID inventé (résolution uniquement dans la liste mémorisée).
- Tentatives ouvertes verrouillent toujours le flux CREATE (`createFlowLocked`).

## SHA-256 des artefacts

Répertoire : `n8n/proposed/2026-10-30-rec008-phase8f2b2-NON-PUBLIE/`

| Fichier | SHA-256 |
| --- | --- |
| `10_AI_ConsularAssistant_SLOT_SELECT_FIX_NON_PUBLIE.json` | `0fa348271753909b4faf3248e2374e83dbba7387eb8acbdf33c13f1f1dda6cb2` |
| `source-installed.json` | `36259a0f8400570c22a3a255611c3a2e18ccc3fa83945b29fd492a4d37812e78` |
| `NE_PAS_PUBLIER.txt` | `6ec3f20cea5ec34a6930c78654b70437a566e95f938912400c39dc0b32d006e3` |
| `DIFF_NODES.txt` | `e8969b8732bfbf2f44a39e464ed596fa489424c36880319dff31af7240a7dc3e` |
| `OFFLINE_TESTS.json` | `98cbca1e031df42f9b0584435e6a410dfd0866062814cf1d1da52de3e8660f4d` |

## État final TEST

Inchangé : workflow inactif version `2fea54b3-…` / 4 ; PG `1|6|0|0` ; mock total 5.

## État final GovSuite

Inchangé : 13, 14, 12, 48, 0, empreinte stable ; Mailpit inchangé.

## Risques résiduels

1. La sélection depuis un parcours CREATE déjà en `READY_CREATE_SEARCH` (pending CREATE) n’emprunte pas ce correctif ; ce chemin existant conserve déjà les slots via `continuingPreviousAction`.
2. Les tests hors ligne ne couvrent pas Ollama ni l’UPSERT jsonb `?`.
3. L’exemple texte « Je prends le 2 » alors qu’un seul créneau est listé reste un détail UX non traité ici.

## Verdict

Installer la correction dans n8n TEST après autorisation distincte : **GO**.

Activer, chatter ou republier maintenant : **NO-GO**.

Arrêt 8F-2B2.
