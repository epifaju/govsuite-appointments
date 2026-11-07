# REC-008 phase 8F-2B49 — Préparation du scénario de modification après récapitulatif (CONV-07)

Préparation **strictement lecture seule** du test de non-régression CONV-07 (`modifier le nom` après récapitulatif). Aucun message de chat, aucune activation, aucun PUT n8n, aucune mutation SQL, aucun changement mock/Compose, aucun CLAIM, aucun POST CreateAppointment, aucun e-mail, aucun appel métier LIVE. Artefacts historiques 8F-2B45–48 non modifiés.

Verdict phase : **PASS** (préparation)  
GO/NO-GO première phase de collecte : **GO** (sous autorisation distincte)

Artefacts : `n8n/proposed/2026-11-01-rec008-phase8f2b49-EDIT-SCENARIO-PREPARATION/`  
(`PREFLIGHT.json`, `POSTFLIGHT.json`, `STATIC_ANALYSIS.json`, `PROPOSED_TEST_STRUCTURE.json`, scripts lecture seule)

## 1. Préflight

Lecture seule. Aucun écart. STOP non déclenché.

| Contrôle | Attendu | Observé | OK |
| --- | --- | --- | --- |
| Workflow `OCD9It1uKFhOoWNF` | inactif, `activeVersionId=null` | `active=false`, `activeVersionId=null` | oui |
| Version ID | `e1b32992-bc68-46af-86ce-c80af46f5305` | identique | oui |
| VersionCounter | 8 | 8 | oui |
| Graphe | 134 / 137 | 134 / 137 | oui |
| SHA Finaliser | `3fc500bfed99c202156005d252a864cdc25514c93e7e47c842ae896381e8ee7a` | identique ; `__ABSENT__` + `::uuid` | oui |
| Autres workflows actifs | 0 | 0 | oui |
| PostgreSQL TEST | 1 RDV / 10 sessions / 4 tentatives / 0 notif | **1\|10\|4\|0** | oui |
| Tentatives ouvertes | 0 | **0** | oui |
| Statuts | ABANDONED 1, CONFIRMED 2, EXPIRED 1 | identique | oui |
| Mock scénario | `created` | `created` | oui |
| Mock POST CreateAppointment | 1 | **1** (`POST /appointments 201`=1) | oui |
| Mock GET availability | 2 | **2** | oui |
| LIVE fingerprint | `a2dea067599fd4f0a5f857551adc67cc` | `13\|14\|12\|48\|0\|a2dea067…` | oui |
| Mailpit | 5 / 2 / 98 304 | identique | oui |
| `saveDataSuccessExecution` | `none` | `none` | oui |

Horodatage : `PREFLIGHT.json` (phase `8F-2B49`).

## 2. Analyse statique des nœuds

Chaîne CONV-07 (message exact `modifier le nom`) sur le workflow TEST, sans modification du graphe.

| Responsabilité | Nœud(s) | Constat |
| --- | --- | --- |
| Intention de modification | `Parser intention` | Uniquement si étape `AWAIT_CREATE_CONFIRMATION` **ou** `openAttempt.status === AWAITING_CONFIRMATION` |
| Message `modifier le nom` | `Parser intention` → `modifyFieldOf` | Entrée exacte (après trim / minuscules / sans accents) → `modifyField = 'nom'` ; `createDecision = 'MODIFY'` |
| Lecture tentative ouverte | `Joindre tentative de session` | Fournit `openAttempt` à `Décider action tentative` |
| Décision d’abandon | `Décider action tentative` | `AWAITING_CONFIRMATION` + `MODIFY` → `attemptAction = 'MODIFY'` (**pas** `CLAIM`) |
| Aiguillage | `Aiguiller tentative` | Sortie `MODIFY` (index 4) → `Préparer abandon ou modification` |
| Abandon tentative | `Abandonner tentative` | `cloturer_tentative_rendez_vous(..., 'ABANDONED')` depuis `AWAITING_CONFIRMATION` uniquement |
| Purge clé / corps | Fonction SQL `cloturer_tentative_rendez_vous` | `idempotency_key = NULL`, `request_payload = NULL`, lease effacé |
| Retour `ASK_NOM` | `Préparer abandon ou modification` + `Mettre à jour champ modifié` | `modifyField=nom` → `conversationStep=ASK_NOM` ; `clearDraft=false` → branche modification (pas effacement total) |
| Préservation non modifiés | `Mettre à jour champ modifié` | `nom` vidé ; `prenom` / `email` / `telephone` / `slot_id` / service / site / dates / `available_slots` conservés ; `pending_action='CREATE_APPOINTMENT'` |
| Réponse utilisateur | `Question après modification` | `type=create_appointment_question`, texte `Quel nom souhaitez-vous indiquer ?` |
| Prévention CLAIM / POST | Routing | `MODIFY` n’atteint ni `Réclamer tentative` ni `Appeler CreateAppointment` (POST seulement après CLAIM/RESUME + corps figé) |
| Blocage progression | `Gérer collecte progressive` | `createDecision ≠ INSERT` → `skipCreateProgression = true` |

Détail machine : `STATIC_ANALYSIS.json`.

## 3. Conformité à la machine à états

| Source | Attendu CONV-07 / C11 / C5 | Alignement graphe |
| --- | --- | --- |
| `REC_008_STATE_MACHINE.md` | Modification → `ABANDONED`, retour au champ, autres champs conservés, **pas d’HTTP** | Oui |
| `REC_008_TEST_MATRIX.md` C5 | Première tentative abandonnée sans HTTP | Oui (clôture + hors chaîne POST) |
| Plan 8F-2A C11 | `modifier le nom` → `ABANDONED` ; `ASK_NOM` ; 0 POST ; nouvelle clé au **prochain** INSERT | Oui (pas d’INSERT sur ce tour) |
| Audit 8F-2B48 CONV-07 | NOT_TESTED → phase 8F-2B49 | Préparation uniquement ici |

Différence vs refus `non` (8F-2B12) : `clearDraft=true` → `Effacer brouillon abandonné` + `create_abandoned` ; pour MODIFY, `clearDraft=false` → reprise partielle à `ASK_NOM`.

## 4. Session synthétique proposée

| Champ | Valeur |
| --- | --- |
| `sessionId` | `rec008-8f2b49-edit-01` |
| Présence PG TEST | **absente** (count = 0) — non créée dans cette phase |
| Identité future | Dupont / Camille / `camille.modification@example.test` / `+33000000000` |
| Créneau cible | Index 1, PASSEPORT / PARIS, 03/11/2026 (jeu mock déjà qualifié) |

## 5. Parcours de collecte (non exécuté)

Un message par phase future, **aucun envoi maintenant** :

1. `Je souhaite connaître les disponibilités pour un passeport à Paris du 03/11/2026 au 03/11/2026.`
2. `Je prends le 1.`
3. `Dupont`
4. `Camille`
5. `camille.modification@example.test`
6. `+33000000000`
7. Contrôle : récapitulatif + tentative `AWAITING_CONFIRMATION` (issue du tour 6)
8. Message cible CONV-07 : `modifier le nom`

## 6. Critères PASS / FAIL / STOP

Critères tirés de la spécification (state machine, matrice C5, plan C11, SQL `cloturer_…`, nœuds ci-dessus) — **non inventés**.

### PASS (message `modifier le nom` sur session en attente)

| Contrôle | Attendu documenté |
| --- | --- |
| HTTP | 200 |
| Réponse | `type = create_appointment_question` ; `conversationStep = ASK_NOM` ; texte de reprise nom |
| CLAIM | 0 (`attemptAction=MODIFY`, pas `Réclamer tentative`) |
| POST CreateAppointment | Δ = 0 (mock POST inchangé vs préflight du test) |
| Tentative ciblée | `status = ABANDONED` (même `id`) |
| Clé d’idempotence | absente (`NULL`) |
| Corps figé | absent (`request_payload NULL`) |
| Référence / appointment_id | absents |
| Lease | absent |
| Session | `conversation_step = ASK_NOM` ; `pending_action = CREATE_APPOINTMENT` |
| Données non modifiées | prénom, e-mail, téléphone, créneau, service, site, dates, slots conservés ; **nom** vidé |
| Nouvelle tentative ouverte | **aucune** créée par ce message |
| LIVE / Mailpit | inchangés |
| Workflow après test | inactif |

### FAIL

Tout écart aux attendus PASS (ex. POST Δ≥1, CLAIM, statut ≠ `ABANDONED`, clé/corps encore présents, étape ≠ `ASK_NOM`, brouillon totalement effacé comme un `non`, type `appointment_created`).

### STOP immédiat

POST CreateAppointment ; CLAIM ; Δ LIVE ; activation hors cible ; mock scénario ≠ `created` non restauré ; préflight non conforme.

## 7. Stratégie de vérification

Pour le futur test P7 (et chaque phase unitaire) :

1. Préflight lecture seule (mêmes gardes que §1, avec baselines mises à jour après chaque phase autorisée).
2. Activation temporaire du seul workflow TEST.
3. Un seul message chat / phase.
4. Vérification HTTP (status + JSON type/step, sans logger PII complète si possible).
5. PostgreSQL : session cible + tentative(s) (statuts, présence clé/corps en booléen, pas de clé en clair dans artefacts).
6. Mock : scénario, compteurs POST / GET / cancel.
7. LIVE fingerprint + Mailpit.
8. Désactivation + postflight.
9. Rapport + arrêt jusqu’à nouvelle autorisation.

## 8. Réutilisation du verdict corrigé (8F-2B47)

`verdict.js` cible la **finalisation positive** (`appointment_created`, `CONFIRMED`, `postDelta===1`, `claimCount===1`, session nettoyée avec référence).

| Réutilisable | Non applicable tel quel à CONV-07 |
| --- | --- |
| `httpOk` / `notHttp500` | `functionalOk` (`appointment_created`) |
| `integrityOk` / `deactivateOk` | `attemptOk` (`CONFIRMED` + référence) |
| Schéma `finish` / raisons / politique observabilité si encapsulé | `sessionOk` (brouillon vide + référence) |
| Import `require` sans réécriture historique | `postOk` / `isBusinessOk` (`postDelta===1`, `claimCount===1`) |

Proposition : module futur `verdict-modify.js` (nouveau répertoire de phase) avec checks §6 ; **ne pas** déclarer PASS via `evaluateVerdict` de confirmation. Structure : `PROPOSED_TEST_STRUCTURE.json`.

## 9. Plan des phases unitaires

Chaque phase : préflight → 1 message → HTTP → PG → mock → LIVE → désactivation → rapport → **STOP** (autorisation suivante).

| Phase | Message | Objectif |
| --- | --- | --- |
| **8F-2B49-P1** | disponibilités PASSEPORT/PARIS 03/11/2026 | Créer session `rec008-8f2b49-edit-01`, slots |
| **8F-2B49-P2** | `Je prends le 1.` | `ASK_NOM` |
| **8F-2B49-P3** | `Dupont` | `ASK_PRENOM` |
| **8F-2B49-P4** | `Camille` | `ASK_EMAIL` |
| **8F-2B49-P5** | `camille.modification@example.test` | `ASK_TELEPHONE` |
| **8F-2B49-P6** | `+33000000000` | `AWAIT_CREATE_CONFIRMATION` + INSERT `AWAITING_CONFIRMATION` (0 POST) |
| **8F-2B49-P7** | `modifier le nom` | **CONV-07** — critères §6 |

Aucune de ces phases n’est exécutée dans 8F-2B49.

## 10. Intégrité postflight

Relecture système après rédaction des seuls artefacts 8F-2B49.

| Contrôle | OK |
| --- | --- |
| PG `1\|10\|4\|0` ; ouvertes 0 ; ABD1 / CONF2 / EXP1 | oui |
| Mock POST = 1 ; GET availability = 2 ; scénario `created` | oui |
| LIVE `a2dea067…` ; Mailpit 5 / 2 / 98 304 | oui |
| Workflow inactif / VC 8 / 134–137 / SHA Finaliser | oui |
| Inchangé vs préflight | oui |
| Aucun chat / activation / PUT / SQL / mock / LIVE | oui |
| Historique 8F-2B45–48 non touché | oui |

## 11. Verdict

**PASS**

Préflight conforme, analyse statique CONV-07 alignée sur la machine à états et le plan C11, session et parcours préparés sans création, critères PASS/FAIL/STOP et stratégie de verdict d’abandon documentés, plan unitaire défini, postflight identique au préflight.

## 12. GO/NO-GO

**GO** pour **8F-2B49-P1** (première phase de collecte / disponibilités sur `rec008-8f2b49-edit-01`), sous **autorisation distincte**.

**NO-GO** immédiat pour : envoi de `modifier le nom` sans session en `AWAIT_CREATE_CONFIRMATION` ; enchaînement multi-messages sans arrêt ; activation hors autorisation ; bascule mock ; écriture LIVE ; modification des artefacts historiques.

Restrictions respectées. Arrêt ici. Attente d’une nouvelle autorisation.
