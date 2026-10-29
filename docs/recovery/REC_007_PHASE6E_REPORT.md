# Rapport REC-007 — phase 6E, création HTTP 201 et nettoyage

**Date :** 29 octobre 2026  
**Périmètre :** un seul rendez-vous synthétique, puis sa suppression ciblée.  
**Résultat :** HTTP 201, identité conservée, nettoyage commis. L'état initial est rétabli.

## 1. Préconditions

| Contrôle | Résultat |
|---|---|
| Workflow 03 | actif, 12 nœuds, version `f5079298-6e66-400d-9c44-69522aa68a49` |
| Workflow 08 | inactif |
| Workflow 10 | inactif |
| Rendez-vous | 13, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Notifications | 14 |
| Historique | 12 |
| Sessions | 48 |
| Créneau `3f3b3cba-30e2-43d2-b2e5-dcb1ee01d2c0` | futur, 10 novembre 2026 09:00+01, `DISPONIBLE`, 0 place réservée, capacité 2 |
| Identité synthétique déjà présente | non |
| Sessions PostgreSQL actives | 0 |
| Verrous sur les tables de rendez-vous | aucun |
| Exécutions n8n non terminées du workflow 03 | 6 lignes en statut `error`, datées de 01:19+01, aucune en cours |

Les six exécutions en erreur sont antérieures à cet appel. Elles n'ont pas été supprimées et ne tenaient pas le créneau.

## 2. Requête synthétique

Un seul `POST http://127.0.0.1:5680/webhook/appointments` a été envoyé, sans second essai. Les champs sont ceux du validateur publié.

```json
{
  "slotId": "3f3b3cba-30e2-43d2-b2e5-dcb1ee01d2c0",
  "nom": "D'ARTAGNAN",
  "prenom": "ÉLOÏSE",
  "email": "rec007-phase6e-create@example.test",
  "telephone": "0600000601",
  "numeroDocument": "REC007-P6E-001",
  "langue": "fr"
}
```

## 3. Résultat HTTP

L'appel a répondu **HTTP 201**. Le corps JSON indique `success: true` et un rendez-vous `CONFIRME`.

| Champ | Valeur |
|---|---|
| Identifiant | `eb48570c-634d-41ee-b535-db981987114c` |
| Référence | `GB-2026-E5A095A4` |
| Statut | `CONFIRME` |
| E-mail | `rec007-phase6e-create@example.test` |
| Téléphone | `0600000601` |
| Début | 10 novembre 2026, 08:00 UTC, soit 09:00 à Paris |
| Fin | 10 novembre 2026, 08:30 UTC |
| Service | `PASSEPORT` |
| Site | `PARIS` |
| Jeton de gestion | présent, non reproduit |
| Exécution n8n | `533`, statut `success`, 23:02:41+01 |

Le corps HTTP ne renvoie pas le nom ni le prénom. Ces deux valeurs ont été lues en base avant la suppression.

## 4. Résultats PostgreSQL avant suppression

La transaction a verrouillé le rendez-vous et le créneau, puis a constaté une seule ligne pour cette identité.

| Contrôle | Résultat |
|---|---|
| Nom | `D'ARTAGNAN` |
| Prénom | `ÉLOÏSE` |
| Document | `REC007-P6E-001` |
| Langue | `fr` |
| Place du créneau | 1, statut `DISPONIBLE` |
| Notification | une seule, `CONFIRMATION` / `EMAIL` / `A_ENVOYER`, destinataire identique à l'adresse du test |
| Historique | une seule ligne `CREATION`, nouveau statut `CONFIRME` |
| Compteurs | 14 rendez-vous, 15 notifications, 13 historiques, 48 sessions |
| Empreinte des 13 rendez-vous initiaux | `a2dea067599fd4f0a5f857551adc67cc` |

La notification est restée `A_ENVOYER`. Le workflow 08 était inactif. Aucun courriel n'a été envoyé.

## 5. Nettoyage

La suppression a porté sur cette seule ligne, identifiée par l'identifiant, la référence, le nom, le prénom, l'adresse, le téléphone, le document, la langue, le statut et le créneau. Les dépendances `notifications` et `historique_rendez_vous` partent avec le rendez-vous par cascade. Les places du seul créneau `3f3b3cba-30e2-43d2-b2e5-dcb1ee01d2c0` ont été recalculées. Les contrôles d'empreinte et de compteurs ont été faits avant `COMMIT`.

La transaction a été commise. Aucune suppression plus large n'a été nécessaire. L'exécution n8n `533` a été conservée.

## 6. État final

| Élément | Valeur |
|---|---|
| Rendez-vous | 13, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Notifications | 14 |
| Historique | 12 |
| Sessions | 48 |
| Rendez-vous synthétique | absent |
| Créneau de test | futur, `DISPONIBLE`, 0 place réservée, capacité 2 |
| Workflow 02 | actif, `37f59d20-4687-4c2c-aed6-ac14aed1a232`, 5 nœuds |
| Workflow 03 | actif, `f5079298-6e66-400d-9c44-69522aa68a49`, 12 nœuds |
| Workflow 08 | inactif |
| Workflow 10 | inactif |

## 7. Anomalies

Aucune anomalie sur cet appel. Le nom, le prénom, l'apostrophe et l'accent ont été conservés. Une seule place, une seule notification et une seule ligne d'historique ont été créées, puis retirées.

Le second nœud `Créer notification CONFIRMATION` est toujours dans le workflow. Il n'a pas empêché cette création, parce qu'une adresse était présente et que le second `INSERT` rencontre le conflit unique. Une création sans adresse reste un risque séparé : elle n'a pas été testée.

## 8. Recommandation pour la phase 7

Préparer, sans le publier, le retrait du second nœud de notification. C'est le prochain écart qui peut laisser un rendez-vous enregistré alors que la réponse HTTP échoue, lorsque l'adresse est absente.

L'idempotence et la confirmation explicite du workflow 10 viennent ensuite. Le workflow 10 reste inactif. REC-008 n'est pas commencé.
