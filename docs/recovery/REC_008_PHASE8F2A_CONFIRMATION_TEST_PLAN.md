# REC-008 phase 8F-2A — Préparation des tests de confirmation explicite

Plan hors exécution. Aucune activation, aucun message, aucun PUT, aucun POST métier. Le workflow TEST reste inactif.

Verdict pour le premier scénario de collecte **sans POST** (C1) : **GO**, sous autorisation distincte.

## Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow `OCD9It1uKFhOoWNF` | inactif, `activeVersionId = null` |
| Version / compteur | `2fea54b3-ed59-4b83-a404-7166bad06fb2` / 4 |
| Graphe | 134 nœuds, 137 connexions |
| Autres workflows TEST actifs | 0 |
| Credentials | PostgreSQL `Fs0l0058q5CEadRw`, Ollama `dxzHqBq8Q60R8BOz` |
| HTTP | 10 URL `http://rec008-mock:8080/...` ; POST create → `/appointments` |
| Isolation | aucun TCP GovSuite ouvert depuis n8n TEST |
| PostgreSQL TEST | 1 rendez-vous, 5 sessions, 0 tentative, 0 notification |
| Mock | `total` 4, GET availability 4, POST 0 |
| GovSuite | 13, 14, 12, 48, 0 tentative, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Mailpit | 5 messages, 2 non lus, 98 304 octets |

Export lecture seule : `n8n/proposed/2026-10-30-rec008-phase8f2a-CONFIRMATION-PLAN/`.

## Analyse de la machine à états

### Chaîne d’entrée commune

`Chat` → `Charger état conversation` → `Lire tentative de session` → `Joindre tentative de session` → `Comprendre la demande` → `Parser intention` → `Fusionner état conversation` → `Gérer collecte progressive` → `Sauvegarder état conversation` → `Router intention`.

La sortie **CREATE** du routeur entre dans `Décider action tentative` → `Aiguiller tentative`. Les autres intentions (disponibilité, annulation, replanification) ne rejoignent pas ce chemin.

### Étapes de collecte CREATE (`Gérer collecte progressive`)

Quand `pendingAction === 'CREATE_APPOINTMENT'` :

| Étape | Condition |
| --- | --- |
| `ASK_CREATE_SERVICE` | service manquant |
| `ASK_CREATE_SITE` | site manquant |
| `ASK_CREATE_DATE_RANGE` | dates manquantes |
| `READY_CREATE_SEARCH` | service+site+dates, pas encore de `slotId` → bascule intent `GET_AVAILABILITY` |
| `ASK_CREATE_SLOT` | créneau à (re)choisir |
| `ASK_NOM` / `ASK_PRENOM` / `ASK_EMAIL` / `ASK_TELEPHONE` | identité progressive après `slotId` |
| `AWAIT_CREATE_CONFIRMATION` | brouillon complet ; si l’étape précédente n’était pas déjà l’attente → `createDecision = 'INSERT'` une seule fois |
| `CREATE_UNCERTAIN` / `CREATE_RECALL` | décisions `RESUME` / `RECALL` sans progression du brouillon |

Une décision autre que `INSERT` (`AFFIRM`, `NEGATIVE`, `MODIFY`, `RESTART`, `RESUME`, `RECALL`) pose `skipCreateProgression = true` et bloque l’avancée du brouillon.

### Décisions utilisateur (`Parser intention`)

Comparaison sur message entier, trim, minuscules, sans accents ni ponctuation finale.

| Classe | Exemples | `createDecision` |
| --- | --- | --- |
| Affirmatif | `oui`, `oui je confirme`, `je confirme`, `confirmer`, `d'accord`, `ok`, `yes` | `AFFIRM` |
| Négatif | `non`, `non merci`, `je ne confirme pas`, `annuler`, `abandonner`, `stop` | `NEGATIVE` |
| Modification | `modifier le nom`, `changer le prenom`, `autre creneau`, etc. | `MODIFY` + `modifyField` |
| Ambigu | tout le reste pendant l’attente | `null` → `ASK` |

`annuler` pendant `AWAIT_CREATE_CONFIRMATION` reste un abandon de **demande**, pas `CANCEL_APPOINTMENT`.

Ces décisions ne sont évaluées que si l’étape est `AWAIT_CREATE_CONFIRMATION` ou qu’une tentative ouverte est `AWAITING_CONFIRMATION` (sinon `RESUME` forcé si tentative `UNCERTAIN`/`SUBMITTING`).

### Actions tentative (`Décider action tentative`)

| `attemptAction` | Condition principale |
| --- | --- |
| `RESUME` | statut `UNCERTAIN`, ou `SUBMITTING` avec bail échu |
| `WAIT` | `SUBMITTING` bail encore valide |
| `EXPIRE` | `AWAITING_CONFIRMATION` et `expires_at` dépassé |
| `CLAIM` | `AWAITING_CONFIRMATION` + `AFFIRM` |
| `ABANDON` | `AWAITING_CONFIRMATION` + `NEGATIVE` |
| `MODIFY` / `RESTART` | `AWAITING_CONFIRMATION` + décision correspondante |
| `ASK` | `AWAITING_CONFIRMATION` sans décision claire |
| `INSERT` | `createDecision === 'INSERT'` (brouillon nouvellement complet) |
| `RESET_STALE` | étape d’attente sans ligne de tentative ouverte |
| `RECALL` | rappel après `CONFIRMED` |
| `COLLECT` (repli) | collecte incomplète → validation paramètres, **pas** de POST |

`Aiguiller tentative` bascule sur ces clés. Le repli `COLLECT` tombe sur la sortie extra → `Valider paramètres création` → éventuellement `Création prête ?`.

### Chemin exact jusqu’au POST

Le nœud `Appeler CreateAppointment` (`POST http://rec008-mock:8080/appointments`) n’a **qu’un** parent : `Corps figé présent ?` (sortie vraie).

Chaîne obligatoire :

1. `attemptAction` ∈ {`CLAIM`, `RESUME`}
2. `Préparer réclamation ou reprise` **ou** `Préparer reprise`
3. `Réclamer tentative` (`reclamer_tentative_rendez_vous`) **ou** `Reprendre tentative` (`reprendre_tentative_rendez_vous`) avec propriétaire `own-` + `gen_random_bytes(16)`
4. `Normaliser acquisition` → `Réclamation gagnée ?` (acquis = vrai)
5. `Appliquer corps gagnant` (corps et clé **stockés**, non régénérés)
6. `Corps figé présent ?` = vrai
7. **`Appeler CreateAppointment`**

Protections qui **empêchent** le POST :

- `INSERT` → aléa + insert `AWAITING_CONFIRMATION` + `Composer récapitulatif` → **pas** d’HTTP.
- `ASK` / `WAIT` / `ABANDON` / `MODIFY` / `EXPIRE` / `RECALL` / `RESET_STALE` / `COLLECT` → hors chaîne POST.
- `Création prête ?` sortie vraie → `Refus création sans réclamation` (l’ancien `ready` ne peut plus ouvrir le webhook).
- Réclamation perdue → message d’attente de bail, pas de second POST.
- Corps absent → `Réponse corps absent`.

### Traitement HTTP

| Réponse | `httpOutcome` | Suite |
| --- | --- | --- |
| 201 | `CONFIRMED` | Clôture confirmation |
| 200 + `replayed` + `created=false` | `CONFIRMED` | Idem, sans nouvelle clé |
| 400 | `REJECTED` | Clôture rejet, brouillon effacé |
| 409 `IDEMPOTENCY_KEY_CONFLICT` | `REJECTED` | Idem |
| 409 message `Créneau introuvable ou complet` | `SLOT_UNAVAILABLE` | Clôture, libération créneau, retour `ASK_CREATE_SLOT` |
| Autre 409 / 500 / corps illisible | `UNCERTAIN` | `marquer_tentative_incertaine` |
| Timeout / erreur réseau (2ᵉ sortie) | `UNCERTAIN` via `Classer délai HTTP` | Même marquage |

## Matrice détaillée des scénarios

Identité synthétique recommandée (fictive) : nom `Dupont`, prénom `Camille`, e-mail `camille.essai@example.test`, téléphone `+33000000000`. Créneau : index **1** (09:00–09:30, id `33333333-3333-4333-8333-333333333333`).

Sessions : une session neuve par vague ou par scénario destructeur (`rec008-8f2b-…`). Ne pas réutiliser les sessions 8F-1F* sauf précondition explicite de reprise.

### Vague A — sans POST (prioritaire)

| ID | Objectif | Préconditions | Message(s) | Avant → Après (attendu) | PG | Mock | PASS si | STOP si |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **C1** | Sélection créneau | Session neuve ; d’abord GET availability (msg complet 8F-1F-E) | `Je prends le 1.` | slots mémorisés → `slotId` posé, `ASK_NOM` | tentatives 0 | +0 POST ; GET déjà fait | demande le nom ; slot UUID correct | POST ou pas de `slotId` |
| **C2** | Collecte nom | Après C1 | `Dupont` | `ASK_NOM` → `ASK_PRENOM` | 0 tentative | 0 POST | prénom demandé ; nom persisté | POST |
| **C3** | Collecte prénom | Après C2 | `Camille` | → `ASK_EMAIL` | 0 | 0 POST | e-mail demandé | POST |
| **C4** | Collecte e-mail | Après C3 | `camille.essai@example.test` | → `ASK_TELEPHONE` | 0 | 0 POST | téléphone demandé | POST |
| **C5** | Collecte téléphone | Après C4 | `+33000000000` | → `AWAIT_CREATE_CONFIRMATION` + `INSERT` | **1** tentative `AWAITING_CONFIRMATION` | **0 POST** | récap complet ; clé créée ; **aucun** POST | tout POST |
| **C6** | Récapitulatif | Suite de C5 | (réponse du tour C5) | texte avec service, site, créneau, identité | 1 tentative | 0 POST | tous les champs visibles ; pas de clé/token technique | secret dans le texte |
| **C7** | Aucune réservation avant confirmation | État après C5 | — | rendez-vous TEST toujours 1 | rdv=1, tentatives=1 | POST=0 | inchangé | rdv>1 ou POST>0 |
| **C9** | OUI avant récap | Session où étape = `ASK_NOM` (après C1) | `oui` | reste collecte ; pas `CLAIM` | 0 tentative | 0 POST | pas de récap forcé, pas de POST | POST ou tentative |
| **C11** | Modification après récap | Après C5 | `modifier le nom` | tentative abandonnée ; `ASK_NOM` | tentative `ABANDONED` | 0 POST | retour collecte ; nouvelle clé au prochain INSERT | POST |
| **C12** | Ambigu après récap | Après C5 (nouvelle session si C11 a tourné) | `peut-être` | `ASK` ; redemande confirmation | tentative toujours `AWAITING_CONFIRMATION` | 0 POST | pas de POST | POST ou abandon |
| **C19** | Index créneau invalide | Après availability | `Je prends le 9.` | pas de `slotId` valide | 0 | 0 POST | message d’erreur / redemande | POST |
| **C20** | E-mail invalide | Après C3 | `pas-un-email` | reste `ASK_EMAIL` | 0 | 0 POST | re-demande e-mail | progression ou POST |

### Vague B — premier POST simulé (autorisation séparée)

| ID | Objectif | Message | Attendu | Mock | PASS |
| --- | --- | --- | --- | --- | --- |
| **C8** | OUI explicite après récap | `oui` | `CLAIM` → lease → **1** POST → `CONFIRMED` ; rdv mock créé | POST `/appointments` +1 ; scénario `created` → 201 | référence renvoyée ; tentative `CONFIRMED` ; **une** clé |
| **C10** | NON après récap | `non` | `ABANDON` ; brouillon effacé | 0 POST | pas de rdv ; tentative abandonnée |
| **C13** | OUI répété | second `oui` immédiat / bail actif | `WAIT` ou `RECALL` selon statut ; **pas** de 2ᵉ POST concurrent | POST inchangé ou replay 200 sans nouvelle clé | `distinctKeys` / compteur POST documenté |

### Vague C — erreurs HTTP (changement temporaire du scénario mock **uniquement** sous autorisation)

| ID | Scénario mock | Message déclencheur | Attendu |
| --- | --- | --- | --- |
| **C14** | `timeout` | `oui` après récap | `UNCERTAIN` ; bail/clé conservés ; 0 clôture confirmée |
| **C15** | `error` (500) | `oui` | `UNCERTAIN` ; même clé/corps |
| **C16** | `slot` (409 créneau) | `oui` | `SLOT_UNAVAILABLE` ; retour choix créneau ; pas de nouvelle clé pour renvoyer l’ancien corps |
| **C17** | `conflict` (409 KEY) | `oui` | `REJECTED` ; brouillon effacé ; pas de retry silencieux |

### Vague D — reprise

| ID | Objectif | Préconditions | Attendu |
| --- | --- | --- | --- |
| **C18** | Reprise UNCERTAIN | Après C14/C15 ; bail échu si besoin | `RESUME` ; même `idempotencyKey` et `request_payload` ; nouveau `lease_owner` ; un POST rejoué |

### Désactivation (tous scénarios)

Après chaque session de test (ou immédiatement en échec) : désactiver le workflow ; vérifier `active=false`, `activeVersionId=null`, 0 webhook, version/compteur inchangés, 134/137.

## Contrôles d’idempotence et de concurrence

Vérifiés **statiquement** sur la version installée :

| Contrôle | Preuve |
| --- | --- |
| Pas de création avant confirmation | POST seulement après `CLAIM`/`RESUME` + lease + corps figé ; `INSERT` n’appelle pas HTTP |
| OUI seulement en attente | `AFFIRM` → `CLAIM` uniquement si statut `AWAITING_CONFIRMATION` |
| Récap avant confirmation | `INSERT` + `Composer récapitulatif` avant toute réclamation |
| Corps figé | insert stocke `request_payload` ; reprise ne le réécrit pas |
| Clé CSPRNG | `Tirer aléa` : `rec008-` + `encode(gen_random_bytes(32),'hex')` |
| Une tentative ouverte / session | fonctions SQL + lecture `openAttempt` |
| Lease avant POST | `reclamer_tentative_rendez_vous` / `reprendre_…` avec `own-`+aléa |
| Pas de second POST sans lease | `WAIT` si `SUBMITTING` ; réclamation concurrente → non acquis |
| Pas de nouvelle clé après UNCERTAIN | `RESUME` réutilise payload/clé |
| Abandon ≠ annulation RDV | `NEGATIVE` → abandon tentative ; pas de branche CANCEL |
| Pas de secret dans textes citoyens | récap sans clé/lease/attempt id (contrat 8E-1) |
| Pas d’endpoint GovSuite | URLs mock uniquement ; isolation réseau préflight OK |

## Stratégie d’isolation

1. Uniquement n8n TEST `:5682`, mock `rec008-mock:8080`, PostgreSQL TEST.
2. Sessions synthétiques dédiées ; pas de données personnelles réelles.
3. Ne jamais activer un autre workflow.
4. Scénarios mock altérés (timeout/500/409) : une autorisation par vague ; restauration du scénario `created` avant de quitter.
5. GovSuite : lecture seule des compteurs/empreinte en pré/postflight ; aucun appel métier.
6. Conservation des exécutions déjà à `none` : s’appuyer sur PG + mock `_meta/calls`, pas sur l’historique n8n.

## Plan de tests séquentiels

| Ordre | Phase proposée | Scénarios | POST autorisé |
| --- | --- | --- | --- |
| 1 | **8F-2B** (à autoriser) | C1 → C7 enchaînés sur une session | Non |
| 2 | 8F-2C | C9, C12, C19, C20 (branches sans POST) | Non |
| 3 | 8F-2D | C5+C6+C10 (abandon) | Non |
| 4 | 8F-2E | C5+C6+C11 (modification) | Non |
| 5 | 8F-2F | C8 (premier OUI / POST) | Oui, mock `created` |
| 6 | 8F-2G | C13 (double OUI) | Oui, contrôle anti-double |
| 7 | 8F-2H | C14–C17 | Oui, scénarios mock dédiés |
| 8 | 8F-2I | C18 | Oui, reprise |

Chaque phase : préflight → activation version `2fea54b3-…` → messages séquentiels sans retry → désactivation → postflight → rapport PASS/FAIL.

Risque STOP transversal : tout POST inattendu en vague A–E ; toute hausse des compteurs GovSuite ; toute activation hors `OCD9It1uKFhOoWNF`.

## Risques résiduels

1. La sélection « Je prends le N » dépend du parseur d’index / UUID ; C1 est le premier point de friction réel.
2. Ollama peut retarder ou biaiser l’intent ; les décisions OUI/NON sont déterministes dans `Parser intention`, mais le tour availability/create initial reste sensible au LLM.
3. `_meta/calls` du mock ne journalise pas la query/body : pour C8+, s’appuyer sur compteurs + état tentative + réponse utilisateur ; ne pas inventer une query observée.
4. Autre 409 que le message exact « Créneau introuvable ou complet » tombe en `UNCERTAIN` (pas `SLOT_UNAVAILABLE`) — C16 doit utiliser le scénario mock `slot`.
5. Sessions 8F-1F déjà présentes : ne pas les écraser ; nouvelles sessions `rec008-8f2b-*`.
6. Changement de scénario mock est hors scope de 8F-2A et nécessite une autorisation + restauration.

## État final TEST

Inchangé par cette phase : workflow inactif version `2fea54b3-…` / 4 ; PG `1|5|0|0` ; mock total 4 ; 0 tentative.

## État final GovSuite

Inchangé : 13, 14, 12, 48, 0, empreinte `a2dea067599fd4f0a5f857551adc67cc` ; Mailpit inchangé.

## Verdict

Premier scénario de collecte **sans POST** (vague **8F-2B / C1**, après autorisation distincte) : **GO**.

Exécuter C1–C18, activer le workflow, ou modifier le mock maintenant : **NO-GO**.

Arrêt 8F-2A.
