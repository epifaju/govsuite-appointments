# REC-007 — Phase 7I — Concurrence PostgreSQL

La fonction `public.creer_rendez_vous_idempotent` a été éprouvée par deux connexions indépendantes, sous un vrai verrou de transaction. Le webhook n'a pas été appelé. Le workflow n'a pas été publié. Aucune donnée synthétique ne reste.

## 1. Préflight

| Contrôle | Résultat |
|---|---|
| PostgreSQL | 16.14 |
| Fonction | Présente, huit paramètres |
| Index `uq_rendez_vous_cle_idempotence` | Présent |
| Workflow 03 | Actif, 11 nœuds, `c48ffad5-4f36-4c7e-9abf-11ce6fa2d9e6` |
| Workflows 08 et 10 | Inactifs, 5 et 84 nœuds |
| Compteurs | 13 rendez-vous, 14 notifications, 12 historiques, 48 sessions |
| Clés d'idempotence renseignées | 0 |
| Empreinte | `a2dea067599fd4f0a5f857551adc67cc` |
| Lignes des phases 7H et antérieures | Aucune. Une adresse `@example.test` appartient aux 13 rendez-vous d'origine ; son nom n'est pas un nom d'essai |
| Créations en cours | Aucune |

## 2. Créneau isolé

Aucun créneau métier n'a été modifié. Un service et un site ont été créés inactifs, puis trois créneaux du 1er juillet 2027, chacun de capacité 1.

| Objet | Identité |
|---|---|
| Service | `1a1ded1a-156c-4785-9008-d2bdaa3cf628`, code `REC007-P7I-SVC`, inactif |
| Site | `3ec13010-701d-4423-8edf-3c13344fe8e0`, code `REC007-P7I-SITE`, inactif |
| Créneau A | `92455508-c495-49a2-8548-77e07934eb82`, 09:00+02 |
| Créneau B | `f9c47706-f869-4beb-a3fe-fd2ba7549de7`, 10:00+02 |
| Créneau C | `bb5b4041-a27e-4df6-89c6-054877a847d8`, 11:00+02 |

Les rendez-vous préexistants n'ont pas été mis à jour. Les trois créneaux, le lien service-site, le service et le site ont été supprimés à la fin, après contrôle qu'aucune ligne ne les référençait encore.

## 3. Orchestration

Deux connexions PostgreSQL distinctes, plus une troisième de contrôle. Chaque appel est une requête paramétrée : la clé n'est pas interpolée dans le SQL et n'est pas affichée.

1. La connexion A ouvre une transaction, appelle la fonction et garde la transaction ouverte. Le verrou de ligne du créneau reste donc tenu.
2. La connexion B ouvre sa propre transaction et appelle la fonction. Elle se bloque.
3. Le contrôleur attend au plus 8 secondes une preuve de blocage : B en `wait_event_type = Lock`, avec un `ShareLock` de type `transactionid` non accordé, dont le détenteur est A.
4. Seulement après cette preuve, A valide ou annule. L'attente de requête de B est bornée à 20 secondes. Une transaction inactive est abandonnée par le serveur au bout de 30 secondes.
5. B est ensuite libérée par la fin de la transaction de A, pas par une coupure de connexion.

Les trois scénarios ont observé ce verrou, en 118 ms, 113 ms et 111 ms. Aucun scénario n'a été rejoué.

## 4. Scénario A — même clé, même corps

Créneau de 09:00, capacité 1. Même identité `REC007-P7I-A`, adresse `rec007-phase7i-a@example.test`, même clé.

| Connexion | Issue | Identifiant | Référence | Jeton |
|---|---|---|---|---|
| A, puis validation | `CREATED` | `a5781e93-fcd1-43c5-a1fa-27e3d365397c` | `GB-2026-16FA1477` | Présent, non affiché |
| B, après le verrou | `REPLAYED` | Le même | La même | Identique à celui de A, non affiché |

Après les deux validations : 1 rendez-vous, 1 place, statut de créneau `COMPLET`, 1 notification, 1 historique. Capacité non dépassée. Totaux globaux pendant l'essai : 14, 15, 13, 48, une clé. Après nettoyage de cette ligne exacte : empreinte `a2dea067599fd4f0a5f857551adc67cc`.

## 5. Scénario B — la première transaction est annulée

Créneau de 10:00. A utilise `REC007-P7I-BA` et une clé. B utilise `REC007-P7I-BB` et une autre clé. B attend le verrou. A exécute `ROLLBACK`. B obtient alors `CREATED` : identifiant `f8712339-7947-4cf3-b3a4-2edbaca3d072`, référence `GB-2026-6CC62CBB`.

La réponse provisoire de A était `CREATED`, mais sa ligne `3156405f-1476-4775-ad4e-d865c32eb73b` n'a pas été conservée. Il reste un seul rendez-vous, une place, une notification et un historique, ceux de B. Le nettoyage a retiré uniquement cette ligne. L'empreinte initiale est revenue.

## 6. Scénario C — deux clés, une place

Créneau de 11:00. A utilise `REC007-P7I-CA` et sa clé. B utilise `REC007-P7I-CB` et une autre clé. B attend le verrou, puis A valide.

| Connexion | Issue | Identifiant | Jeton |
|---|---|---|---|
| A | `CREATED` | `4a84e1b1-4880-45db-8900-641e43f80671`, référence `GB-2026-8899769D` | Présent, non affiché |
| B | `SLOT_UNAVAILABLE` | Aucun | Aucun |

Un rendez-vous, une place, une notification, un historique. Aucune ligne pour l'adresse de B. Capacité 1 respectée, créneau `COMPLET`. Le nettoyage a retiré uniquement le rendez-vous de A.

## 7. Nettoyage et état final

Chaque suppression a verrouillé le créneau et la ligne, contrôlé l'identifiant, le nom et l'adresse, supprimé cette seule ligne, recalculé les places, puis supprimé le créneau parce qu'aucun rendez-vous ne le référençait. Le service et le site n'ont été retirés qu'une fois les trois créneaux partis. Aucune suppression globale par préfixe de nom.

Contrôle indépendant après coup :

| Contrôle | Résultat |
|---|---|
| Rendez-vous, notifications, historiques, sessions | 13, 14, 12, 48 |
| Clés restantes | 0 |
| Service, site, trois créneaux, cinq identités d'essai | 0 |
| Empreinte | `a2dea067599fd4f0a5f857551adc67cc` |
| Transactions `rec007-p7i` encore ouvertes | 0 |
| Workflow 03 | Actif, même version, 11 nœuds |
| Workflows 08 et 10 | Inactifs |

Aucun courriel n'a été émis : le workflow 08 est resté inactif, et les notifications d'essai ont été supprimées avec leur rendez-vous. La fonction n'a pas été modifiée. Aucune migration n'a été relancée.

## 8. Risques restants

La course sur le verrou est démontrée. Le graphe n8n préparé, lui, n'a pas encore reçu de requête HTTP : le routage `CREATED`, `REPLAYED`, `KEY_CONFLICT` et `SLOT_UNAVAILABLE` reste à observer sur le webhook après publication. Le replay continue de pouvoir rendre le jeton au détenteur de la clé et du même corps. C'est le contrat retenu pour le rattrapage local, pas une exposition publique.

## 9. Verdict

**GO** pour publier, dans une autorisation séparée, le payload préparé `n8n/live-exports/2026-10-29-rec007-phase7e-proposed/put-body.json`, empreinte `f6fd66f2885c8297da58bf021ce1dab49da9e11feb37d36d09f43c1f15ecffac`. La fonction a distingué le replay, l'annulation du premier appel et le créneau saturé par une autre clé, avec une seule place à chaque fois.

**NO-GO** pour commencer cette publication maintenant.

Cette phase s'arrête ici.
