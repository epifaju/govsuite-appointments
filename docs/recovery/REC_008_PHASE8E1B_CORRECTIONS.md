# REC-008 phase 8E-1B — Corrections hors ligne

La copie 8E-1 à 130 nœuds n'est pas modifiée. Le workflow live n'est pas modifié. Les corrections sont uniquement dans `n8n/proposed/2026-10-30-rec008-phase8e1b-NON-PUBLIE/10_AI_ConsularAssistant_Complete.json`.

Ce fichier est inactif. Il ne doit pas être importé dans cette phase.

## Défauts corrigés

### 1. Générateur cryptographique incompatible avec le bac à sable

Le runner JavaScript de n8n 2.32.6 exécute le code dans `vm.createContext`. La liste native exposée contient `Buffer`, les minuteries, `TextEncoder` et `FormData`. Elle ne contient pas `crypto`. Une sonde sur Node 24.18.0, le runtime du conteneur, donne `typeof crypto === "undefined"` dans ce contexte. `NODE_FUNCTION_ALLOW_BUILTIN` n'est pas défini, donc `require('crypto')` est refusé. Le mode du runner est `secure` tant que `N8N_RUNNERS_INSECURE_MODE` n'est pas activé. Il ne l'est pas. Aucun paramètre global n'a été changé.

`Préparer corps figé`, `Préparer réclamation ou reprise` et `Préparer reprise` appelaient `crypto.getRandomValues` ou `crypto.randomUUID`. Ces appels lèvent `ReferenceError` avant toute insertion et avant toute réclamation. `crypto.subtle.digest` est dans le même cas. `node --check` ne voit pas cette absence.

Correction :

- `Tirer aléa de tentative` appelle `gen_random_uuid()` et `public.gen_random_bytes(32)`. Ce sont les générateurs d'OpenSSL exposés par PostgreSQL et `pgcrypto`, déjà installé. Aucun `Math.random`.
- `Préparer corps figé` assemble les huit champs et le texte canonique avec `JSON.stringify`. Il ne tire plus d'aléa et ne calcule plus d'empreinte.
- `Calculer empreinte du corps` appelle `public.digest` sur les octets UTF-8 de ce texte. Le digest de contrôle `abc` vaut `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`. Un vecteur canonique d'essai, non reproduit ici, donne le même digest dans Node et dans PostgreSQL.
- `Réclamer tentative` et `Reprendre tentative` tirent le propriétaire du bail dans la même instruction que l'appel de fonction, avec `public.gen_random_bytes(16)` et le préfixe `own-`. La fonction reçoit ce propriétaire. La requête le retourne dans `lease_owner`. La reprise ne réécrit ni le corps ni la clé.
- `Appliquer corps gagnant` n'accepte l'envoi que si ce propriétaire a la forme attendue et si la clé du corps relu est celle de la ligne.

### 2. HTTP 409 inconnu traité comme un créneau indisponible

La copie 8E-1 classait tout HTTP 409 autre que `IDEMPOTENCY_KEY_CONFLICT` en `SLOT_UNAVAILABLE`. Cette clôture efface la clé. Une collecte ultérieure pouvait alors créer une nouvelle tentative.

Le contrat du workflow 03 distingue deux 409 : `error.code = IDEMPOTENCY_KEY_CONFLICT`, et le message exact `Créneau introuvable ou complet`.

Correction dans `Classer réponse HTTP` :

| Réponse | Classe |
| --- | --- |
| 201 | `CONFIRMED` |
| 200 avec rejeu explicite et `created` faux | `CONFIRMED` |
| 400 | `REJECTED` |
| 409 `IDEMPOTENCY_KEY_CONFLICT` | `REJECTED` |
| 409 dont le message est exactement `Créneau introuvable ou complet` | `SLOT_UNAVAILABLE` |
| Tout autre 409, 500, corps vide ou illisible | `UNCERTAIN` |

`UNCERTAIN` appelle `marquer_tentative_incertaine`. La clé et le corps restent. Aucune nouvelle tentative n'est créée.

### 3. Attente sauvegardée sans ligne de tentative

Si l'insertion échoue après que `Sauvegarder état conversation` a posé `AWAIT_CREATE_CONFIRMATION`, le message suivant n'a plus de ligne ouverte. L'ancienne copie restait dans la collecte, sans appel HTTP, mais sans issue explicite.

`Décider action tentative` ajoute `RESET_STALE` lorsque l'étape est l'attente, qu'aucune tentative ouverte ou confirmée n'est lue, et que la décision n'est pas `INSERT`. `Effacer collecte orpheline` efface le brouillon. `Réponse collecte orpheline` dit que la demande n'est plus enregistrée. Aucun `POST` et aucune nouvelle clé ne partent de ce tour. Le premier tour qui a encore la décision `INSERT` continue d'insérer.

### 4. Récapitulatif après une insertion vide

`Composer récapitulatif` n'affiche le récapitulatif que si l'insertion retourne un identifiant. Sinon il dit que la demande n'a pas été enregistrée.

### 5. Données d'exécution

Les réglages globaux n8n ne sont pas modifiés. La copie corrigée porte, pour elle seule :

- `saveDataSuccessExecution: none`
- `saveDataErrorExecution: none`
- `saveManualExecutions: false`
- `saveExecutionProgress: false`

Ces valeurs ne s'appliquent qu'après un import autorisé. Elles évitent de conserver le corps figé et le jeton dans l'historique d'exécution. Le diagnostic reste possible par le statut, la référence et le compteur de reprise, sans lire le corps.

## Nœuds ajoutés

| Nœud | Rôle |
| --- | --- |
| `Tirer aléa de tentative` | UUID et clé CSPRNG, sans donnée personnelle |
| `Calculer empreinte du corps` | SHA-256 du texte canonique |
| `Effacer collecte orpheline` | Efface un brouillon dont la tentative n'existe pas |
| `Réponse collecte orpheline` | Message sans clé, sans corps et sans jeton |

La copie corrigée a 134 nœuds et 137 liens. `active` est faux.

## Vérifications après correction

- JSON parseable, aucun nom en double, aucun lien vers un nœud absent.
- Tous les scripts JavaScript passent `node --check` dans une fonction asynchrone.
- Les trois anciens appels `crypto` et tout `Math.random` ont disparu.
- Le code corrigé de préparation, de reconstruction du corps et de classement a été exécuté dans un `vm.createContext` sans `crypto`. La préparation aboutit. Le corps reconstruit est identique au texte canonique. Les sept classes HTTP d'essai retombent sur les statuts prévus, dont le 409 inconnu en `UNCERTAIN`.
- Le graphe ne joint `Appeler CreateAppointment` que depuis la sortie vraie de `Corps figé présent ?`, et seulement par les sorties `CLAIM` et `RESUME`.
- L'empreinte de la copie 8E-1 à 130 nœuds est inchangée : `15830fe472ff588de0ae50c1be2166082d5099285cb1dcb30da06bb523acc83b`.
- L'empreinte de l'export live à 84 nœuds est inchangée : `ec2a16e04b5d75b6acb40fb408a557f97e7203b740e1e1867c26105c37ef42f9`.
