# Rapport REC-004 et REC-005

**Date :** 28 octobre 2026  
**Périmètre :** chaîne conversationnelle du workflow vivant `10_AI_ConsularAssistant_Complete`.  
**Suite :** REC-006 et REC-007 ne sont pas engagés.

## 1. Préparation

Le PRD, le plan de reprise, `docs/recovery/REC_001_002_REPORT.md` et `docs/recovery/REC_003_REPORT.md` ont été relus. Le workflow vivant a toujours 84 nœuds. La requête corrigée par REC-003 est installée : elle teste la présence des clés JSON et ne contient plus `COALESCE` sur le token. PostgreSQL, n8n (`/healthz` = 200) et Ollama répondent. Le modèle du workflow, `qwen2.5:1.5b`, est présent, et le conteneur n8n l'atteint.

Les dossiers `n8n/live-exports/2026-10-28/` et `n8n/live-exports/2026-10-28-rec003/` n'ont pas été réécrits. L'empreinte SHA-256 de la copie du 28 octobre est toujours `6e8227584945b15bc506dd5448787062734aec9c489bddcfe3b2466995d53a5d`.

Le Chat Trigger est inactif. `POST` vers son webhook de production et vers son webhook de test répondent tous les deux `404` : n8n n'enregistre ces URLs que lorsque le workflow est actif, ou lorsque l'éditeur est en écoute manuelle. Le workflow n'a pas été activé.

La chaîne a donc été exécutée hors de l'URL de chat, avec les scripts réellement stockés, dans l'ordre du workflow : parser, fusion, collecte, UPSERT PostgreSQL, puis le nœud de réponse correspondant. Les appels qui créeraient, annuleraient ou replanifieraient un rendez-vous n'ont pas été lancés. Ollama a été appelé avec le prompt du nœud `Comprendre la demande`.

## 2. REC-004 — propagation vers la recherche

`Valider paramètres disponibilité` recopie encore tout l'élément avec `...x`, puis ajoute `service`, `site`, `dateDebut`, `dateFin`, `ready` et `missing`.

`Appeler GetAvailability` n'envoie que quatre paramètres : `service`, `site`, `dateDebut`, `dateFin`.

Après REC-003, une nouvelle création qui devient une recherche enregistre un token NULL. T05 le vérifie : l'intention technique est `GET_AVAILABILITY`, l'action en attente reste `CREATE_APPOINTMENT`, l'étape est `READY_CREATE_SEARCH`, le token est absent, et `ready` vaut vrai. Le nœud de validation n'a pas été modifié : la correction REC-003 suffit à empêcher la propagation de l'ancien token. Le test de non-régression est T05 dans `tests/rec004-rec005-conversation.test.cjs`.

## 3. Anomalies reproduites, puis corrigées

Deux anomalies étaient encore reproductibles. Les deux gros scripts de mémoire n'ont pas été réécrits.

### Sélection « Je prends le 2 » pendant une replanification

`Parser intention` classait tout numéro de créneau en `CREATE_APPOINTMENT`. `Fusionner état conversation` y voyait un changement d'action, effaçait la replanification et ne pouvait plus résoudre le créneau.

Le correctif est limité à cette branche du parser. Si l'étape en cours est `ASK_RESCHEDULE_SLOT` ou `ASK_RESCHEDULE_CONFIRMATION`, le numéro conserve `RESCHEDULE_APPOINTMENT`. Une création en cours reste une création.

| | Avant | Après |
|---|---|---|
| T12 | `CREATE_APPOINTMENT` / `ASK_CREATE_SERVICE`, créneau non résolu, texte générique | `RESCHEDULE_APPOINTMENT` / `ASK_RESCHEDULE_CONFIRMATION`, second créneau synthétique dans `newSlotId`, `slotId` vide, demande de confirmation |

### Question posée à l'utilisateur

La collecte écrivait bien `ASK_CREATE_SITE` ou `ASK_CREATE_DATE_RANGE`. `Valider paramètres création` remplaçait ensuite ces étapes par `ASK_SLOT`, inconnu de `Demander paramètres création`. La réponse retombait sur le texte générique.

`Valider paramètres création` conserve maintenant les étapes de collecte déjà connues. `Demander paramètres création` a un texte propre pour le service, le site, la période et la recherche prête.

| | Avant | Après |
|---|---|---|
| T01, T02, T03, T08, T13 | « indiquez le service, le site et la période souhaitée » | « Dans quel site souhaitez-vous effectuer cette démarche ? » |
| T04 | même texte générique | « Période souhaitée », avec le service et le site déjà connus |

## 4. Résultats des scénarios

Les sessions étaient préfixées `rec004-test-`. La transaction PostgreSQL a été annulée. Après les tests : 48 sessions, 0 session de test, 13 rendez-vous. Aucun jeton n'est recopié ici. La colonne indique seulement s'il est absent.

| Test | Résultat | Transition observée | Réponse |
|---|---|---|---|
| T01 | PASS | Replanification vers `CREATE` / `ASK_CREATE_SITE`. Service `PASSEPORT`. Site, dates, créneaux et jeton effacés. | Demande du site |
| T02 | PASS | Annulation vers la même nouvelle création. Jeton effacé. | Demande du site |
| T03 | PASS | Ancienne création `READY_CREATE_SEARCH` redémarrée. Site et dates effacés. | Demande du site |
| T04 | PASS | « Paris » conserve `PASSEPORT` et passe à `ASK_CREATE_DATE_RANGE`. Jeton absent. | Demande de la période |
| T05 | PASS | « Du 02/11/2026 au 06/11/2026 » donne `GET_AVAILABILITY`, action `CREATE`, étape `READY_CREATE_SEARCH`, dates conservées, jeton absent. | Recherche prête. L'appel de disponibilité n'a pas été fait. |
| T06 | PASS | Création vers `CANCEL` / `ASK_TOKEN`. Site et jeton effacés. | Demande du jeton d'annulation |
| T07 | PASS | Annulation vers `GET` / `ASK_TOKEN`. Ancien jeton effacé. | Demande du jeton de consultation |
| T08 | PASS | Replanification vers `CREATE` / `ASK_CREATE_SITE`. Jeton effacé. | Demande du site |
| T09 | PASS | « Oui » reste sur `ASK_CANCEL_CONFIRMATION` et est reconnu comme une confirmation. | Appel d'annulation non exécuté |
| T10 | PASS | « Non » est reconnu comme un refus. | « Votre rendez-vous n'a pas été annulé » |
| T11 | PASS | « Je prends le 2 » en création remplit `slotId`, laisse `newSlotId` vide, passe à `ASK_NOM`. | Demande du nom |
| T12 | PASS | « Je prends le 2 » en replanification remplit `newSlotId`, laisse `slotId` vide. | Demande de confirmation, sans identifiant dans le texte |
| T13 | PASS | Session vide vers `CREATE` / `ASK_CREATE_SITE`. Jeton absent. | Demande du site |
| T14 | PASS | « bonjour » donne `GENERAL`. | Texte d'aide général |
| T14b | PASS | « peut-être » pendant une confirmation n'est pas reconnu. | Demande de répondre par Oui ou Non. Aucun appel. |

Les créneaux de T11 et T12 sont synthétiques, portés par `available_slots`. Aucune ligne de `creneaux` ou de `rendez_vous` n'a été créée.

Ollama, avec le prompt complet du workflow, a inventé un site, des dates de 2023, une identité et un jeton qui n'est pas un UUID. Sur les trois messages rejoués, le parser n'a conservé que ce que le message contenait vraiment : création passeport sans site ni date, continuation « Paris » sans reprendre les dates inventées, et choix de créneau de replanification vers `newSlotId`.

## 5. Corrections et fichiers

| Fichier | Rôle |
|---|---|
| `tests/rec004-rec005-conversation.test.cjs` | non-régression T01 à T14, y compris T05 |
| `docs/recovery/REC_004_005_REPORT.md` | ce rapport |
| `n8n/live-exports/2026-10-28-rec004/R7TKt5mqZYpeKapl.json` | export après correction, bloc `shared` retiré |
| `n8n/live-exports/2026-10-28-rec004-MANIFEST.json` | inventaire, hors du dossier importable |

Nœuds modifiés par rapport à l'export REC-003 :

- `Parser intention`
- `Valider paramètres création`
- `Demander paramètres création`

`Valider paramètres disponibilité`, `Fusionner état conversation`, `Gérer collecte progressive` et la requête de sauvegarde sont inchangés. Les dix autres workflows ont la même activation, la même date et le même nombre de nœuds.

Pour rejouer le test :

```text
node tests/rec004-rec005-conversation.test.cjs n8n/live-exports/2026-10-28-rec004/R7TKt5mqZYpeKapl.json
```

Retour arrière, non exécuté : réimporter `n8n/live-exports/2026-10-28-rec003/R7TKt5mqZYpeKapl.json`. Ne pas restaurer le dump de base.

## 6. État d'activation

| Élément | Valeur |
|---|---|
| Workflow 10 | inactif |
| Nœuds | 84 |
| Version | `88a1f42a-ab9e-4eff-bfd9-996c31976b16` |
| `updatedAt` affiché | 21 septembre 2026, 23:17:43 +02 |
| Autres workflows actifs | 5, inchangés |
| Sessions | 48 |
| Rendez-vous | 13 |

L'import a de nouveau conservé la date portée par le document. La version, elle, a changé.

## 7. Risques restants

- Le chat n8n reste inaccessible tant que le workflow 10 n'est pas activé. Cette activation n'a pas été faite.
- Le calendrier réel s'arrête au 3 septembre 2026. Une recherche de disponibilités future renverrait une liste vide. C'est l'objet de REC-006.
- Le modèle local peut encore proposer un UUID valide qui n'est pas dans le message. Ce cas n'a pas été produit par `qwen2.5:1.5b` pendant ces essais : les jetons inventés n'étaient pas des UUID et ont été écartés.
- Le message de consultation contient un exemple d'UUID écrit en dur. Ce n'est pas le jeton d'une session. Il n'a pas été retiré dans ce lot.
- Après un « Non » à l'annulation, le nœud `Finaliser abandon annulation` efface l'étape, puis le texte d'abandon est restauré. La colonne du jeton de cette session n'est pas vidée par cette requête. Elle n'est pas affichée.
- `Valider paramètres disponibilité` recopie toujours l'élément complet. La valeur du jeton est nulle sur le chemin de création testé.

## 8. Recommandation pour REC-006

La machine à états distingue maintenant une nouvelle action, une réponse courte, une confirmation et le choix d'un créneau, sans créer de rendez-vous. Le prochain lot utile est REC-006 : des créneaux futurs, idempotents, sans modifier les 13 rendez-vous existants. REC-007, le CREATE de bout en bout, devrait attendre ces créneaux et un accord explicite pour une activation temporaire du workflow 10.

REC-006 et REC-007 ne sont pas commencés. J'attends votre validation.
