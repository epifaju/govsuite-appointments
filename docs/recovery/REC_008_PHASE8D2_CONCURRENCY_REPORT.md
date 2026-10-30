# REC-008 — Phase 8D-2 — Concurrence réelle

Les quatre courses ont été exécutées sur deux connexions PostgreSQL indépendantes. Le nettoyage a retiré exactement les quatre lignes synthétiques. La table est vide et les données métier sont inchangées.

## 1. Préflight

Lecture seule, avant la première insertion de la course complète. Tous les contrôles sont passés.

| Contrôle | Résultat |
|---|---|
| Base | `govsuite` |
| PostgreSQL | 16.14 |
| `public.ai_appointment_attempt` | Présente, 0 ligne |
| Identifiants `008d01` à `008d04` et sessions `rec008-8d-session-*` | Absents |
| `rendez_vous.id` `00000000-0000-4000-8000-000000008d99` | Absent |
| Fonctions | Cinq signatures conformes, `SECURITY INVOKER`, `search_path=pg_catalog, public` |
| Rendez-vous, notifications, historiques, sessions | 13, 14, 12, 48 |
| Empreinte | `a2dea067599fd4f0a5f857551adc67cc` |
| Workflow 03 | Actif, 12 nœuds, `2d72700c-d731-47e1-b6d6-82c5c684f055` |
| Workflow 08 | Inactif, 5 nœuds |
| Workflow 10 | Inactif, 84 nœuds |
| Mailpit | 5 messages, 2 non lus |
| Autre session non inactive | Aucune |

Les empreintes `md5` du source des cinq fonctions ont été relevées avant les courses et comparées après le nettoyage. Elles sont identiques.

## 2. Protocole

Deux connexions `psql` distinctes, plus une troisième qui ne sert qu'à la synchronisation. Chaque course de verrou utilise un verrou consultatif de session :

1. La connexion de barrière prend le verrou et le garde 28 secondes.
2. Le gagnant exécute la fonction, puis prend un second verrou consultatif qui prouve que l'acquisition a réussi, puis attend le verrou de barrière. Sa transaction reste ouverte, donc le verrou de ligne aussi.
3. Le perdant appelle la même fonction. L'observateur lit `pg_stat_activity` et `pg_locks` et n'accepte la course que si le perdant est en attente `Lock`, bloqué par le gagnant.
4. La barrière lâche son verrou. Le gagnant identifie la ligne, puis valide. Le perdant se débloque.

`NOTIFY` n'est pas utilisé : une notification ne part qu'au `COMMIT`, donc après la libération du verrou de ligne. Les délais sont bornés par `statement_timeout` de 55 à 60 secondes et `lock_timeout` de 40 secondes sur le perdant.

Avant chaque `COMMIT` d'écriture, la transaction affiche l'identifiant, la session et le statut, sans clé ni corps. Les contrôles de corps et de clé ne renvoient que des booléens.

## 3. Scénario A — Réclamation simultanée

Identifiant `00000000-0000-4000-8000-000000008d01`, session `rec008-8d-session-claim`.

| Étape | Transaction | Résultat |
|---|---|---|
| Insertion en attente, puis identification | 1 `BEGIN`, 1 `COMMIT` | Ligne `AWAITING_CONFIRMATION` |
| Gagnant `owner-phase8d2-winA` appelle `reclamer_tentative_rendez_vous` et garde la transaction | 1 `BEGIN`, 1 `COMMIT` | Avant validation : `SUBMITTING`, détenteur gagnant |
| Perdant `owner-phase8d2-losA` appelle la même fonction | 1 `BEGIN`, 1 `COMMIT` | `acquired = false`, corps et clé renvoyés nuls |

Preuve du verrou, lue pendant que les deux transactions étaient ouvertes :

- Le gagnant attendait le verrou consultatif de la barrière, après avoir pris son verrou de signal.
- Le perdant était en `Lock` / `transactionid`, bloqué par le gagnant.
- Son `ShareLock` sur la transaction du gagnant était `granted = false`.

Après les deux validations : statut `SUBMITTING`, détenteur `owner-phase8d2-winA`, `resume_count` 0, corps identique, clé identique. Un seul détenteur.

Trois `COMMIT` explicites. La barrière n'écrit aucune ligne.

## 4. Scénario B — Reprise simultanée

Identifiant `00000000-0000-4000-8000-000000008d02`, session `rec008-8d-session-resume`.

La préparation, dans une seule transaction, réclame puis marque `UNCERTAIN`. Au `COMMIT`, la ligne visible est déjà `UNCERTAIN`, avec corps et clé, sans bail.

| Étape | Transaction | Résultat |
|---|---|---|
| Préparation | 1 `BEGIN`, 1 `COMMIT` | `UNCERTAIN` |
| Gagnant `owner-phase8d2-winB` appelle `reprendre_tentative_rendez_vous` | 1 `BEGIN`, 1 `COMMIT` | Avant validation : `SUBMITTING`, compteur de reprise 1 |
| Perdant `owner-phase8d2-losB` | 1 `BEGIN`, 1 `COMMIT` | `acquired = false`, corps et clé renvoyés nuls |

Même preuve de blocage : attente `Lock` / `transactionid` sur le gagnant, `ShareLock` non accordé.

Après validation : détenteur `owner-phase8d2-winB`, `resume_count` 1, corps et clé inchangés. Le perdant n'a pas reçu de corps à envoyer. Un seul détenteur du bail.

Trois `COMMIT` explicites.

## 5. Scénario C — Bail expiré

Identifiant `00000000-0000-4000-8000-000000008d03`, session `rec008-8d-session-lease`.

La préparation réclame au nom de `owner-phase8d2-oldC`, place `lease_until` une seconde dans le passé, puis valide. La ligne visible est `SUBMITTING`, bail échu, corps et clé présents.

Le nouveau détenteur `owner-phase8d2-newC` reprend la tentative et garde la transaction. L'ancien détenteur appelle d'abord `reprendre_tentative_rendez_vous`. Cette fonction voit encore le bail échu, donc elle doit verrouiller la ligne. Elle attend, puis reçoit `acquired = false` une fois le nouveau bail validé. Ensuite, `marquer_tentative_incertaine` et `cloturer_tentative_rendez_vous` renvoient faux. La clôture était appelée avec des arguments valides, pour que le refus vienne du bail et non d'un contrôle d'arguments.

`marquer_tentative_incertaine` et `cloturer_tentative_rendez_vous` ne se mettent pas eux-mêmes en attente sur cette ligne tant que le nouveau bail n'est pas validé : la version visible a déjà un bail échu, et leur filtre `lease_until >= maintenant` l'écarte sans la verrouiller. Le blocage réel est donc observé sur `reprendre_tentative_rendez_vous`, qui est l'opération dont le filtre correspond à cette version.

Preuve : l'ancienne connexion était en `Lock` / `transactionid`, bloquée par la nouvelle, avec un `ShareLock` non accordé.

Après validation : détenteur `owner-phase8d2-newC`, `resume_count` 1, corps et clé inchangés, aucun rendez-vous posé. L'ancien détenteur est révoqué.

Trois `COMMIT` explicites.

## 6. Scénario D — Tentative confirmée

Identifiant `00000000-0000-4000-8000-000000008d04`, session `rec008-8d-session-confirmed`.

Une première connexion insère, réclame, puis clôture en `CONFIRMED` avec l'identifiant `00000000-0000-4000-8000-000000008d99` et la référence `GB-2026-PHASE8D2`. Avant la clôture, cet identifiant est absent de `rendez_vous`. Aucune insertion n'y est faite. Avant le `COMMIT`, la ligne est `CONFIRMED`, la référence est conservée, le corps et la clé sont nuls.

Une seconde connexion appelle `reclamer_tentative_rendez_vous` et `reprendre_tentative_rendez_vous`. Les deux renvoient `acquired = false`. La ligne reste confirmée, sans corps ni clé.

Deux `COMMIT` explicites. Il n'y a pas d'attente de verrou : la ligne confirmée n'est plus une ligne ouverte à prendre.

## 7. Nettoyage

Transaction séparée, après les quatre courses. Avant le `DELETE` :

| Ligne | Session | Statut |
|---|---|---|
| `008d01` | `rec008-8d-session-claim` | `SUBMITTING`, détenteur gagnant, reprise 0, corps et clé présents |
| `008d02` | `rec008-8d-session-resume` | `SUBMITTING`, détenteur gagnant, reprise 1, corps et clé présents |
| `008d03` | `rec008-8d-session-lease` | `SUBMITTING`, nouveau détenteur, reprise 1, corps et clé présents |
| `008d04` | `rec008-8d-session-confirmed` | `CONFIRMED`, corps et clé absents |

Aucune autre ligne. Compteurs métier et empreinte inchangés. L'identifiant `008d99` toujours absent de `rendez_vous`.

Le `DELETE` filtre chaque identifiant avec sa session. Il a retiré 4 lignes, égal au décompte préalable. La transaction a été validée. Pas de `DELETE` sans filtre, pas de `TRUNCATE`, pas de `DROP`.

Un `COMMIT` explicite.

## 8. Transactions

Douze `COMMIT` explicites : trois pour A, trois pour B, trois pour C, deux pour D, un pour le nettoyage. Chaque session d'écriture a autant de `BEGIN` que de `COMMIT`. Les trois barrières n'ont ni `BEGIN` ni `COMMIT` et n'écrivent aucune ligne de tentative.

## 9. État final

| Contrôle | Résultat |
|---|---|
| Lignes de `ai_appointment_attempt` | 0 |
| UUID synthétiques | 0 |
| Rendez-vous, notifications, historiques, sessions | 13, 14, 12, 48 |
| Empreinte | `a2dea067599fd4f0a5f857551adc67cc` |
| Workflow 03 | Actif, 12 nœuds, `2d72700c-d731-47e1-b6d6-82c5c684f055` |
| Workflows 08 et 10 | Inactifs, 5 et 84 nœuds |
| Fonctions | Empreintes de source inchangées |
| Mailpit | 5 messages, 2 non lus |

Aucun workflow n'a été modifié ni appelé. Aucun e-mail n'a été envoyé. Le schéma n'a pas changé. Aucun rendez-vous n'a été inséré. Aucune clé ni aucun corps JSON n'a été affiché.

## 10. Anomalies

Deux exécutions interrompues du harnais, avant la course complète, ont validé des lignes synthétiques puis les ont retirées avec le même `DELETE` borné. La course rapportée ici est partie d'une table vide et s'est terminée sur une table vide. Les compteurs métier n'ont pas bougé pendant ces interruptions.

Le point de comportement relevé en scénario C n'est pas un défaut : une clôture ou un marquage ne verrouille pas une ligne dont le bail visible est déjà échu. La reprise, elle, la verrouille, et un seul nouveau détenteur l'obtient.

## 11. Verdict

**GO** pour préparer la phase 8E.

**NO-GO** pour modifier le workflow 10 dans cette phase. Cette modification attend une autorisation distincte.
