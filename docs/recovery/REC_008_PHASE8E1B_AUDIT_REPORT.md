# REC-008 phase 8E-1B — Audit approfondi du workflow proposé

Audit statique de la copie hors ligne. Aucun workflow n'a été importé, publié ou activé. Aucun webhook n'a été appelé. Aucune écriture PostgreSQL, aucun e-mail, aucune restauration.

Le fichier historique à 33 nœuds n'a pas été lu.

## Verdict

**NO-GO pour installer la copie 8E-1 à 130 nœuds.** Son bac à sable ne peut pas exécuter `crypto`. La création échouerait avant de figer une clé.

**GO pour une installation contrôlée ultérieure de la seule copie 8E-1B**, à 134 nœuds, en laissant le workflow 10 inactif. Cette installation n'est pas faite ici. Elle exige une autorisation distincte et un nouveau préflight. Le premier message de chat reste hors de cette autorisation tant qu'il n'est pas prescrit à part.

**NO-GO pour réaliser l'installation dans la présente phase.**

## Sources et empreintes

Contrôle fait avant l'analyse. Les quatre empreintes annoncées par le rapport 8E-1 correspondent aux fichiers.

| Artefact | SHA-256 | Résultat |
| --- | --- | --- |
| Export live, 84 nœuds, 234 417 octets | `ec2a16e04b5d75b6acb40fb408a557f97e7203b740e1e1867c26105c37ef42f9` | PASS, relu après correction |
| Copie 8E-1, 130 nœuds, 277 809 octets | `15830fe472ff588de0ae50c1be2166082d5099285cb1dcb30da06bb523acc83b` | PASS, inchangée après correction |
| Diff 8E-1 | `68cfcf6a06830af364ff37bde120cfeb0ea5995600e6ae65d9be507d32ece033` | PASS |
| Marqueur 8E-1 | `831bd45fd8fae51d4afa363f08f333a38fb2089620194d01695faf4f03e7c8b4` | PASS |
| Rapport 8E-1 | `265bb8c48bd59103f8e0b92c595f83d9ae895c528aafa910c9fd9231ad176194` | PASS |

La matrice `docs/recovery/REC_008_TEST_MATRIX.md` a été lue. Les essais conversationnels C1 à C18 restent non exécutés.

## Cryptographie

n8n du conteneur est 2.32.6, Node 24.18.0. Le nœud Code JavaScript passe par `JsTaskRunnerSandbox`. Le runner construit le contexte avec `vm.createContext` et `getNativeVariables()`. Cette liste ne contient pas `crypto`. Une sonde équivalente retourne `crypto` absent, `subtle` absent, `randomUUID` absent. Le code utilisateur est enveloppé dans une fonction asynchrone, donc `await` serait valide si l'API existait. Elle n'existe pas.

| Contrôle | Copie 130 nœuds | Copie 8E-1B |
| --- | --- | --- |
| `crypto.getRandomValues` disponible | FAIL | n'est plus appelé |
| `crypto.randomUUID` disponible | FAIL | n'est plus appelé |
| `crypto.subtle.digest` disponible | FAIL | n'est plus appelé |
| `Math.random` pour une clé | PASS, absent | PASS, absent |
| Aléa CSPRNG de remplacement | non | PASS, `gen_random_bytes` et `gen_random_uuid` |
| Digest du vecteur `abc` | non utilisé | PASS, empreinte FIPS attendue |
| Même digest Node et PostgreSQL sur un texte canonique d'essai | non | PASS |

`public.digest`, `public.gen_random_bytes` et `gen_random_uuid()` ont été appelés en lecture seule. Aucune ligne n'a été écrite.

## Graphe

La copie 8E-1 a 130 nœuds et 133 liens. La copie corrigée a 134 nœuds et 137 liens. Tous les liens des deux copies pointent vers des nœuds existants.

`Appeler CreateAppointment` n'a qu'une source : la sortie 0 de `Corps figé présent ?`. Depuis le déclencheur de chat, deux chemins seulement l'atteignent.

Réclamation :

`message` → `Charger état conversation` → `Lire tentative de session` → `Joindre tentative de session` → `Comprendre la demande` → `Parser intention` → `Fusionner état conversation` → `Gérer collecte progressive` → `Sauvegarder état conversation` → `Router intention` sortie 2 → `Décider action tentative` → `Aiguiller tentative` sortie 1 → `Préparer réclamation ou reprise` → `Réclamer tentative` → `Normaliser acquisition` → `Réclamation gagnée ?` sortie vraie → `Appliquer corps gagnant` → `Corps figé présent ?` sortie vraie → `Appeler CreateAppointment`.

Reprise : le même préfixe, puis `Aiguiller tentative` sortie 2 → `Préparer reprise` → `Reprendre tentative`, puis la même acquisition.

| Propriété | Résultat |
| --- | --- |
| Création sans confirmation | PASS. `INSERT` s'arrête à `Composer récapitulatif`. |
| POST sans acquisition SQL | PASS. Les deux chemins passent par `reclamer` ou `reprendre`, puis par la sortie vraie de `Réclamation gagnée ?`. |
| Second POST pendant un bail valide | PASS. `WAIT` aboutit à `Réponse attente de bail`, sans lien vers l'appel. |
| Nouveau corps après un résultat incertain | PASS sur 8E-1B. `RESUME` appelle `reprendre`, qui ne réécrit ni le corps ni la clé. Un 409 inconnu reste `UNCERTAIN` et ne libère pas le créneau. |
| Appel depuis l'annulation ou la replanification | PASS. `Confirmation déjà demandée ?` et `Router étape replanification` n'atteignent pas l'appel. |
| Contournement par les anciens nœuds | PASS. La sortie vraie de `Création prête ?` aboutit à `Refus création sans réclamation`. |
| Oui tardif qui crée une tentative | PASS. L'attente échue prend `EXPIRE`, pas `INSERT`. |
| État incohérent qui déclenche un POST | PASS. Le repli de l'aiguillage va à `Valider paramètres création`, dont la sortie vraie est le refus. |

La matrice 8A, ligne S3, attendait que la branche vraie de `Création prête ?` soit le seul accès à l'appel. Cette phrase est en écart avec le graphe : FAIL documentaire. La propriété de sécurité demandée en 8E-1B est tenue par la réclamation, pas par cet ancien nœud. Le câblage n'a pas été ramené en arrière.

Sorties de `Aiguiller tentative` dans la copie 8E-1B :

| Sortie | Action | Suite | Appel HTTP |
| --- | --- | --- | --- |
| 0 | `INSERT` | aléa, corps, empreinte, insertion, récapitulatif | non |
| 1 | `CLAIM` | réclamation puis appel si acquisition | oui, une fois |
| 2 | `RESUME` | reprise du même corps puis appel si acquisition | oui, une fois |
| 3 | `ABANDON` | clôture `ABANDONED`, brouillon effacé | non |
| 4 | `MODIFY` | abandon de la ligne, un champ effacé | non |
| 5 | `RESTART` | abandon de la ligne, collecte reprise au service | non |
| 6 | `ASK` | confirmation redemandée | non |
| 7 | `WAIT` | message de bail | non |
| 8 | `RECALL` | référence déjà confirmée | non |
| 9 | `EXPIRE` | expiration SQL, brouillon effacé | non |
| 10 | `RESET_STALE` | brouillon orphelin effacé | non |
| 11 | repli | validation de collecte, sans envoi | non |

Après l'appel, la sortie 0 va à `Classer réponse HTTP` et la sortie 1 à `Classer délai HTTP`. Le délai est `UNCERTAIN`. Le classement confirmé passe par `Clôturer confirmation` avant `Préparer réponse création` et `Finaliser état création`.

## PostgreSQL

Les requêtes ajoutées passent les valeurs par `$1::jsonb` ou n'ont aucun paramètre. Le nœud Postgres 2.7, au-dessus de la version 2.5, garde un texte JSON entier comme un seul paramètre au lieu de le couper sur les virgules. Un UUID sans virgule reste aussi un seul paramètre.

| Contrôle | Résultat |
| --- | --- |
| UUID casté explicitement | PASS |
| Injection par concaténation du message | PASS, aucune |
| Paramètres effectifs | PASS pour le JSON et pour l'identifiant de session |
| Résultat vide | PASS, `alwaysOutputData` puis refus d'envoi ou récapitulatif non affiché |
| Booléen `t`, `true` ou vrai | PASS, normaliseur inchangé |
| Corps figé relu tel que stocké | PASS sur 8E-1B : le texte reconstruit d'essai est identique au canonique |
| Propriétaire du bail | PASS sur 8E-1B : tiré dans l'instruction SQL et contrôlé avant l'envoi |
| Session, tentative et rendez-vous | PASS : `reclamer` et `reprendre` exigent le même `id` et la même `session_id` |
| Contraintes déjà installées | PASS, aucune modification de schéma |

La clé `rec008-` suivie de 64 hexadécimaux et le propriétaire `own-` suivi de 32 hexadécimaux respectent les contrôles de longueur et d'alphabet. L'empreinte est un hexadécimal de 64 caractères. Le corps porte les huit champs et `cleIdempotence` égale la clé.

## HTTP

Le nœud installé, version 4.2, lit `options.timeout` et `options.response.response.fullResponse` ainsi que `neverError`. La copie utilise ces chemins. Le délai est 20 000 ms. La méthode est POST. L'adresse interne est `http://localhost:5678/webhook/appointments`. Le corps est le texte figé. Il n'y a pas d'en-tête `Idempotency-Key`.

Avec `fullResponse` et un corps JSON, la sortie réelle est `{ body, headers, statusCode, statusMessage }`. Le classement lit `statusCode` et `body`. Si la détection choisit le texte, le corps arrive dans `data`. Le classement 8E-1B lit aussi `data`. Un corps qui n'est pas l'objet attendu devient `UNCERTAIN`, pas une confirmation.

`neverError` garde les statuts 4xx sur la sortie 0. Le délai et l'erreur réseau empruntent la sortie 1 à cause de `continueErrorOutput`.

| Statut | Copie 130 nœuds | Copie 8E-1B |
| --- | --- | --- |
| 201 | PASS, `CONFIRMED` | PASS |
| 200 rejoué | PASS, `CONFIRMED` | PASS |
| 400 | PASS, `REJECTED` | PASS |
| 409 de clé | PASS, `REJECTED` | PASS |
| 409 au message exact de créneau | PASS, `SLOT_UNAVAILABLE` | PASS |
| 409 inconnu | FAIL, classé créneau indisponible | PASS, `UNCERTAIN`, sans nouvelle tentative |
| 500, vide, délai | PASS, `UNCERTAIN` | PASS |

## États et anomalies

| Situation | Comportement retenu |
| --- | --- |
| `COLLECT` | Validation existante. `ready` n'est vrai qu'après acquisition. Pas d'appel. |
| `INSERT` | Nouvelle clé CSPRNG, récapitulatif, pas d'appel. |
| `ASK` | La confirmation est redemandée. |
| `CLAIM` | Une réclamation. Le perdant ne poste pas. |
| `WAIT` | Bail encore ouvert : aucun second envoi. |
| `RESUME` | Même corps, même clé, nouveau propriétaire de bail. |
| `ABANDON` | Clôture sans webhook. |
| `MODIFY` et `RESTART` | L'ancienne ligne est abandonnée. La suivante n'existe qu'après une nouvelle collecte. |
| `EXPIRE` | Le oui tardif expire la ligne. Il n'insère rien. |
| `RECALL` | Référence déjà confirmée, sans rejeu. |
| Insertion échouée après sauvegarde de l'attente | `RESET_STALE` efface le brouillon. Pas de nouvelle tentative dans ce tour. |
| Deux oui simultanés | Deux réclamations. La fonction n'en laisse qu'une gagnante. |
| Modification pendant `SUBMITTING` | Le bail vivant répond `WAIT`. Le bail échu reprend le corps déjà figé. La modification n'est pas appliquée à ce corps. |
| Expiration de session | La lecture de la tentative n'utilise pas `expires_at` de la conversation. `UNCERTAIN` et `SUBMITTING` restent. |
| Réponse HTTP après la fin du bail | Le délai d'appel est 20 s, le bail 90 s. Si la clôture échoue quand même, aucune nouvelle clé n'est tirée. Le message suivant reprend la même ligne après le bail. |
| Clôture échouée après HTTP 201 | `Finaliser état création` n'est pas atteint. La ligne n'est pas rejouée avec une nouvelle clé. |
| HTTP 200 rejoué | Classe `CONFIRMED`, même référence. |
| Reprise après incident n8n | `SUBMITTING` dont le bail est échu, ou `UNCERTAIN`, reprend le corps stocké. |

## Protection des données

Les textes ajoutés ne contiennent pas de clé, de corps JSON ni de jeton. Le jeton citoyen reste affiché seulement par le message de création confirmée, comme dans la version live, et il n'est pas une colonne de `ai_appointment_attempt`.

n8n, sans réglage contraire, conserve les données d'exécution. Le conteneur n'a pas de variable `EXECUTIONS_DATA_*` qui réduirait cette conservation. Les réglages globaux n'ont pas été changés.

Politique proposée, portée seulement par la copie 8E-1B : ne pas enregistrer les données de succès, d'erreur, d'exécution manuelle ni la progression. Le diagnostic s'appuie sur le statut de la tentative, sa référence et son compteur de reprise. Le corps n'a pas à être relu pour savoir si la ligne est `AWAITING_CONFIRMATION`, `SUBMITTING`, `UNCERTAIN` ou `CONFIRMED`.

Cette politique ne protège que les exécutions créées après un import de cette copie. Elle ne nettoie pas les exécutions déjà présentes.

## Tests statiques exécutés

- Comparaison des SHA-256 avant analyse, puis relecture après correction.
- Lecture du runner n8n 2.32.6 et sonde `vm.createContext`.
- Graphe complet des deux copies, chemins vers l'appel, accessibilité depuis l'annulation, la replanification et la disponibilité.
- Lecture du nœud HTTP 4.2 et du découpage des paramètres Postgres 2.7.
- `SELECT` de contrôle sur `digest`, `gen_random_bytes` et `gen_random_uuid`.
- Exécution, dans un contexte `vm` sans `crypto`, du code corrigé de préparation, de reconstruction et de classement.
- `node --check` de tous les scripts de la copie corrigée.
- Contrôle d'absence de `crypto.` et de `Math.random`.

## Limites

Le runner n8n n'a pas été lancé. La sonde reproduit son contexte, pas une exécution de workflow. Aucun message de chat, aucun webhook et aucune ligne de tentative n'ont été créés. Les cas C1 à C18 restent ouverts. Le comportement de `fullResponse` est celui du source installé, pas une réponse observée sur cette instance pendant cette phase.

## Empreintes après correction

| Artefact | SHA-256 |
| --- | --- |
| Copie 8E-1 conservée, 277 809 octets | `15830fe472ff588de0ae50c1be2166082d5099285cb1dcb30da06bb523acc83b` |
| Copie 8E-1B, 283 667 octets | `3aaee103f38ccb3a22481cf87da650894e38709bc381054b8a79e672db7879ff` |
| Marqueur 8E-1B | `25289aa2d01087a69390d25f8aedd751f51e03328ecfffc56451ab330881f356` |
| Corrections | `c3dabb1c2a65feda141dc7f559bc66f179c325d3649db3dda0fd2fa74933911f` |
| Export live à 84 nœuds | `ec2a16e04b5d75b6acb40fb408a557f97e7203b740e1e1867c26105c37ef42f9` |

Le détail des changements est dans `docs/recovery/REC_008_PHASE8E1B_CORRECTIONS.md`.
