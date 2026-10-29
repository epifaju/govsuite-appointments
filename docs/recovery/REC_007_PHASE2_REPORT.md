# Rapport REC-007 — phase 2

**Date :** 29 octobre 2026  
**Périmètre :** tests API de `03_API_CreateAppointment` sur deux créneaux du 9 novembre 2026.  
**Suite :** le nettoyage n'a pas été exécuté. Le workflow 10 n'a pas été activé. Les tests conversationnels ne sont pas commencés.

## 1. Contrôles avant écriture

Horloge du contrôle : 29 octobre 2026, 01:13:52 +01.

| Contrôle | Résultat |
|---|---|
| Créneau `63428f11-0fed-4ab7-a457-472d846a4bbb` | `PASSEPORT` / `PARIS`, 9 novembre 2026 09:00, futur, `DISPONIBLE`, capacité 2, 0 place, 0 rendez-vous |
| Créneau `43a9bb39-b14a-439f-bcd0-76eb93f22114` | `ETAT_CIVIL` / `PARIS`, 9 novembre 2026 09:30, futur, `DISPONIBLE`, capacité 1, 0 place, 0 rendez-vous |
| Unicité des notifications | `notifications_rendez_vous_id_type_canal_key` : `UNIQUE (rendez_vous_id, type, canal)` |
| Identités `REC007-TEST` | 0 ligne |
| Workflow 02 | actif, 5 nœuds, version `37f59d20-4687-4c2c-aed6-ac14aed1a232` |
| Workflow 03 | actif, 8 nœuds, version `93ebd7e4-ee13-4fd8-8104-564e0c6ca3c8` |
| Workflow 08 | inactif |
| Workflow 10 | inactif, 84 nœuds |
| Écarts places / rendez-vous actifs | 0 |

Les appels ont utilisé uniquement le nom `REC007-TEST`, les prénoms `SYNTHE-A`, `SYNTHE-B`, `SYNTHE-C`, `SYNTHE-D1`, `SYNTHE-D2` et `SYNTHE-C1` à `SYNTHE-C5`, les adresses `rec007-…@example.test` et les téléphones `0600000001` à `0600000015`.

Le dump a été pris avant le premier `POST` :

`backups/govsuite-pre-rec007-20261029.dump`

| Contrôle | Résultat |
|---|---|
| Taille | 596 983 octets |
| SHA-256 | `7859b0c80ef1f074d2e5d2e3ef3728933b02f10ac0f9f2a275f30013f0493112` |
| Lecture | `pg_restore -l` lit les données de `creneaux`, `rendez_vous`, `notifications`, `historique_rendez_vous`, `ai_conversation_state` et `workflow_entity` |

Les dumps du 28 octobre et du 29 octobre 00:42 n'ont pas été réécrits. Aucun n'a été restauré.

## 2. Compteurs

| Mesure | Avant | Après |
|---|---:|---:|
| Créneaux | 994 | 994 |
| Rendez-vous | 13 | 16 |
| dont `CONFIRME` | 10 | 13 |
| dont `ANNULE` | 3 | 3 |
| Rendez-vous `REC007-TEST` | 0 | 3 |
| Notifications | 14 | 17 |
| dont `A_ENVOYER` | 10 | 13 |
| dont `ENVOYE` | 4 | 4 |
| Historique | 12 | 15 |
| Sessions | 48 | 48 |
| Somme des places réservées | 10 | 13 |
| Messages Mailpit | 5 | 5 |

L'empreinte des 13 rendez-vous préexistants est restée `a2dea067599fd4f0a5f857551adc67cc`. L'empreinte des créneaux autres que les deux cibles est restée `90054f5ae918b7f2bd6c082a6e9c30d5`. Aucun écart entre `places_reservees` et le nombre de rendez-vous actifs. Aucune référence en double.

## 3. Résultats

Les exécutions du workflow 03 se situent entre 01:18:16 et 01:18:23 +01. Une seconde lecture des deux réponses de validation au corps vide a été faite juste après : deux exécutions `error` de plus, toujours sans nouvelle ligne.

| Test | HTTP | Effet en base | Verdict |
|---|---:|---|---|
| A1, première création, capacité 2 | 201 | places 0 → 1, statut `DISPONIBLE` | PASS |
| A2, deuxième création | 201 | places 1 → 2, statut `COMPLET` | PASS |
| A3, troisième création | 409 | aucun changement | PASS |
| B, deux créations simultanées, capacité 1 | 201 et 409 | une ligne, places = 1, statut `COMPLET` | PASS |
| C, UUID inexistant | 409 | aucune ligne | PASS |
| C, UUID mal formé | 200, corps vide | aucune ligne, exécution `error` | PASS métier |
| C, `slotId` absent | 200, corps vide | aucune ligne, exécution `error` | PASS métier |
| C, nom absent | 200, corps vide | aucune ligne, exécution `error` | PASS métier |
| C, prénom absent | 200, corps vide | aucune ligne, exécution `error` | PASS métier |

Le message des réponses 409 est celui du workflow : créneau indisponible. Il est le même pour un créneau complet et pour un UUID absent.

### Créations retenues

Les références et les tokens ne sont pas reproduits. Chaque référence observée suit `GB-2026-` puis 8 caractères hexadécimaux. Chaque token est un UUID. Les empreintes sont les 12 premiers caractères hexadécimaux du MD5, calculés en base.

| Prénom | Créneau | Référence, empreinte | Token, empreinte | Historique `CREATION` | Notification `CONFIRMATION` / `EMAIL` / `A_ENVOYER` |
|---|---|---|---|---:|---:|
| `SYNTHE-A` | passeport, 9 novembre 09:00 | `76769b6d392d` | `dcbc74e603bb` | 1 | 1 |
| `SYNTHE-B` | passeport, 9 novembre 09:00 | `c60728c5d1d4` | `f63932ab2ce4` | 1 | 1 |
| `SYNTHE-D2` | état civil, 9 novembre 09:30 | `4538b9c3301a` | `76817f8cef85` | 1 | 1 |

Les trois empreintes de référence sont distinctes, de même que les trois empreintes de token. L'adresse et le téléphone enregistrés sont ceux envoyés. Le statut est `CONFIRME`, la langue `fr`. Aucune de ces lignes n'a plus d'une notification.

`SYNTHE-C`, `SYNTHE-D1` et les identités des tests C ne sont pas en base.

## 4. Concurrence

Les deux `POST` du test B ont été émis à 1 ms d'intervalle, puis attendus ensemble.

| Exécution n8n | Début | Fin |
|---|---|---|
| Première | 01:18:21.278 +01 | 01:18:21.839 +01 |
| Seconde | 01:18:21.288 +01 | 01:18:21.484 +01 |

Les deux transactions se chevauchent pendant environ 196 ms. Le client parti en second a reçu le `201` (`SYNTHE-D2`). L'autre a reçu le `409`. Le créneau de capacité 1 porte une place, le statut `COMPLET`, et un seul rendez-vous. La contrainte `places_reservees <= capacite` n'a pas été violée.

## 5. Anomalies

Les quatre requêtes rejetées par `Valider demande` terminent l'exécution au statut `error`. Le webhook répond néanmoins `200` avec un corps JSON vide (`Content-Type: application/json`, longueur 0). Le même comportement a été relu sur l'UUID mal formé et sur le nom absent. Aucune de ces exécutions n'a inséré de rendez-vous. Un appelant ne peut donc pas distinguer ce refus d'une réponse vide réussie en lisant seulement le code HTTP.

Le chemin nominal, lui, distingue bien `201` et `409`.

## 6. Risques à corriger avant production

1. **Date future.** Le verrou exige `DISPONIBLE` et `places_reservees < capacite`. Il ne compare pas `debut` à `now()`. Au contrôle de 01:13, 488 créneaux passés restaient réservables. Ce cas n'a pas été appelé.

2. **Notification.** L'insertion du rendez-vous et celle de la notification de secours sont deux instructions successives. Sur les trois créations, la contrainte d'unicité a laissé une seule ligne `CONFIRMATION`, au statut `A_ENVOYER`. Le rendez-vous est déjà validé lorsque le second nœud s'exécute. Une création sans adresse, non tentée ici, peut donc conserver le rendez-vous puis échouer sur le destinataire vide. Le workflow 08 est resté inactif : les 13 notifications `A_ENVOYER` n'ont pas été envoyées. Mailpit est resté à 5 messages.

3. **Interpolation SQL.** Le nœud `Créer rendez-vous` place le nom, le prénom, l'adresse, le téléphone et la langue dans le texte de la requête, après dédoublement des apostrophes. Le contrôle UUID du `slotId` est fait avant. Les valeurs de cette phase étaient en ASCII simple. Ce mode de composition reste à remplacer par des paramètres liés avant une mise en production.

## 7. État final des workflows et des sauvegardes

| Élément | État |
|---|---|
| Workflow 02 | actif, version inchangée |
| Workflow 03 | actif, version inchangée |
| Workflow 08 | inactif |
| Workflow 10 | inactif |
| Dump pré-REC-007 | présent, empreinte inchangée après les tests |
| Nettoyage | préparé, non exécuté |
| Courriel | aucun envoi |

## 8. Nettoyage proposé, non exécuté

La transaction suivante retire les trois rendez-vous de cette phase, leurs notifications et leur historique, puis recalcule les deux créneaux. Elle s'arrête si elle ne trouve pas exactement ces trois lignes. Elle ne supprime aucun créneau et ne touche pas aux 48 sessions.

```sql
BEGIN;

DO $$
DECLARE
  victimes uuid[];
BEGIN
  SELECT array_agg(id) INTO victimes
  FROM rendez_vous
  WHERE nom = 'REC007-TEST'
    AND email LIKE 'rec007-%@example.test'
    AND prenom IN ('SYNTHE-A', 'SYNTHE-B', 'SYNTHE-D2')
    AND creneau_id IN (
      '63428f11-0fed-4ab7-a457-472d846a4bbb',
      '43a9bb39-b14a-439f-bcd0-76eb93f22114'
    )
    AND created_at >= TIMESTAMPTZ '2026-10-29 01:18:00+01';

  IF coalesce(array_length(victimes, 1), 0) <> 3 THEN
    RAISE EXCEPTION 'nettoyage refuse : % ligne(s) au lieu de 3',
      coalesce(array_length(victimes, 1), 0);
  END IF;

  DELETE FROM notifications WHERE rendez_vous_id = ANY(victimes);
  DELETE FROM historique_rendez_vous WHERE rendez_vous_id = ANY(victimes);
  DELETE FROM rendez_vous WHERE id = ANY(victimes);

  UPDATE creneaux c
  SET places_reservees = sub.n,
      statut = CASE
        WHEN sub.n >= c.capacite THEN 'COMPLET'
        ELSE 'DISPONIBLE'
      END,
      updated_at = now()
  FROM (
    SELECT c2.id,
           (
             SELECT count(*)
             FROM rendez_vous r
             WHERE r.creneau_id = c2.id
               AND r.statut IN ('EN_ATTENTE','CONFIRME','PRESENT','ABSENT','TERMINE')
           ) AS n
    FROM creneaux c2
    WHERE c2.id IN (
      '63428f11-0fed-4ab7-a457-472d846a4bbb',
      '43a9bb39-b14a-439f-bcd0-76eb93f22114'
    )
  ) sub
  WHERE c.id = sub.id;

  IF EXISTS (SELECT 1 FROM rendez_vous WHERE nom = 'REC007-TEST')
     OR EXISTS (
       SELECT 1 FROM creneaux
       WHERE id IN (
         '63428f11-0fed-4ab7-a457-472d846a4bbb',
         '43a9bb39-b14a-439f-bcd0-76eb93f22114'
       )
         AND (places_reservees <> 0 OR statut <> 'DISPONIBLE')
     )
  THEN
    RAISE EXCEPTION 'etat final inattendu, annulation du nettoyage';
  END IF;
END $$;

COMMIT;
```

À l'état actuel, les deux créneaux reviendraient à 0 place et au statut `DISPONIBLE`. Les 13 rendez-vous antérieurs restent hors du filtre. Le dump `backups/govsuite-pre-rec007-20261029.dump` ne doit pas être restauré pour cet effacement : il remplacerait aussi les exécutions n8n postérieures à sa création.

## 9. Arrêt

La phase 2 est terminée. J'attends une autorisation explicite avant le nettoyage des données REC007, l'activation temporaire du workflow 10, les tests conversationnels, ou un envoi Mailpit.
