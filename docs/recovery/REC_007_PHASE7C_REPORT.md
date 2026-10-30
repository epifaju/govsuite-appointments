# Rapport REC-007 — phase 7C, créations avec et sans adresse

**Date :** 29 octobre 2026  
**Périmètre :** deux créations synthétiques sur le workflow 03 à 11 nœuds, chacune nettoyée avant la suivante.  
**Résultat :** les deux appels ont répondu HTTP 201. Les données initiales sont rétablies. Aucune anomalie.

## 1. Préflight

| Contrôle | Résultat |
|---|---|
| Workflow 03 | actif, 11 nœuds, version `c48ffad5-4f36-4c7e-9abf-11ce6fa2d9e6`, sans le nœud `Créer notification CONFIRMATION` |
| Workflow 08 | inactif |
| Workflow 10 | inactif |
| Rendez-vous | 13, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Notifications | 14 |
| Historique | 12 |
| Sessions | 48 |
| Créneau `3f3b3cba-30e2-43d2-b2e5-dcb1ee01d2c0` | futur, 10 novembre 2026 09:00+01, `DISPONIBLE`, 0 place, capacité 2 |
| Identités `REC007-P7C-A` et `REC007-P7C-B` | absentes |
| Exécution n8n en cours | aucune |

## 2. Test A, avec adresse

Un seul `POST` a été envoyé, sans second essai.

```json
{
  "slotId": "3f3b3cba-30e2-43d2-b2e5-dcb1ee01d2c0",
  "nom": "REC007-TEST-EMAIL",
  "prenom": "ÉLOÏSE",
  "email": "rec007-phase7c-email@example.test",
  "telephone": "0600000701",
  "numeroDocument": "REC007-P7C-A",
  "langue": "fr"
}
```

Réponse **HTTP 201**. Le corps indique un rendez-vous `CONFIRME`, référence `GB-2026-2EC9BE03`, identifiant `5f4aa7b8-faee-41c3-a405-fd9aa84a9b48`. Le jeton de gestion est présent et n'est pas reproduit. Le début renvoyé est le 10 novembre 2026 à 08:00 UTC, soit 09:00 à Paris. Service `PASSEPORT`, site `PARIS`.

L'exécution n8n `543` est `success`. Le dernier nœud est `Répondre`. Le parcours est `POST /appointments`, `Valider demande`, `Demande valide ?`, `Créer rendez-vous`, `Conserver le résultat`, `Vérifier création`, `If`, `Répondre`. Aucune erreur. Le nœud de notification retiré n'apparaît pas.

En base, avant suppression : nom et prénom conservés, une place réservée, une notification `CONFIRMATION` / `EMAIL` / `A_ENVOYER` vers l'adresse du test, une ligne `CREATION`. Compteurs : 14 rendez-vous, 15 notifications, 13 historiques, 48 sessions. L'empreinte des 13 rendez-vous initiaux est inchangée. Le workflow 08 étant inactif, cette notification n'a pas été envoyée.

## 3. Nettoyage A

La transaction a verrouillé ce rendez-vous et le créneau, vérifié l'identité complète et l'unicité, puis supprimé uniquement cette ligne. Les places du créneau ont été recalculées. Les compteurs et l'empreinte ont été contrôlés avant `COMMIT`.

Après validation : 13 rendez-vous, 14 notifications, 12 historiques, 48 sessions, empreinte `a2dea067599fd4f0a5f857551adc67cc`, créneau `DISPONIBLE` avec 0 place. L'exécution `543` a été conservée.

## 4. Test B, sans adresse

Le préflight a été refait après le nettoyage A. Un seul `POST` a suivi, sans second essai.

```json
{
  "slotId": "3f3b3cba-30e2-43d2-b2e5-dcb1ee01d2c0",
  "nom": "REC007-TEST-SANS-EMAIL",
  "prenom": "AMADOU",
  "email": "",
  "telephone": "0600000702",
  "numeroDocument": "REC007-P7C-B",
  "langue": "fr"
}
```

Réponse **HTTP 201**. Identifiant `db460e7c-a7cd-4c91-ab90-2fbec0e9c500`, référence `GB-2026-F1248642`, statut `CONFIRME`, adresse `null` dans le corps. Le jeton de gestion est présent et n'est pas reproduit.

L'exécution n8n `544` est `success`, avec le même parcours que le test A et sans erreur. Le dernier nœud est `Répondre`.

En base : l'adresse est `NULL`, aucune notification n'est attachée au rendez-vous, une seule ligne `CREATION` existe, le créneau passe à 1 place et reste `DISPONIBLE`. Compteurs avant suppression : 14 rendez-vous, 14 notifications, 13 historiques, 48 sessions. L'empreinte des 13 rendez-vous initiaux est inchangée.

## 5. Nettoyage B

Même procédure, limitée à cette identité, avec le contrôle explicite qu'aucune notification ne lui est associée. La suppression a retiré le rendez-vous et sa ligne d'historique. Les places du seul créneau ont été recalculées. `COMMIT` a suivi les contrôles de compteurs et d'empreinte. L'exécution `544` a été conservée.

## 6. État final

| Élément | Valeur |
|---|---|
| Rendez-vous | 13, empreinte `a2dea067599fd4f0a5f857551adc67cc` |
| Notifications | 14 |
| Historique | 12 |
| Sessions | 48 |
| Créneau de test | futur, `DISPONIBLE`, 0 place, capacité 2 |
| Lignes `REC007-P7C-A` et `REC007-P7C-B` | absentes |
| Workflow 03 | actif, 11 nœuds, version `c48ffad5-4f36-4c7e-9abf-11ce6fa2d9e6` |
| Workflow 08 | inactif |
| Workflow 10 | inactif |

Aucun courriel n'a été envoyé. Le workflow n'a pas été modifié. Aucun troisième `POST` n'a été envoyé.

## 7. Anomalies

Aucune. La création avec adresse produit une seule notification dans la transaction SQL. La création sans adresse répond HTTP 201, enregistre l'adresse comme `NULL` et n'ajoute pas de notification. Le raccourci vers `Répondre` résout le rendez-vous créé dans les deux cas.

## 8. Recommandation

**GO** pour concevoir l'idempotence, dans une phase séparée et sans la publier tant qu'elle n'est pas autorisée.

Le chemin de création est maintenant fiable avec et sans adresse. Deux `POST` identiques créeraient encore deux rendez-vous. La conception devra préciser la colonne `cle_idempotence`, l'index unique partiel, le champ facultatif du corps et le comportement lorsqu'une clé déjà vue est renvoyée. Elle ne doit pas être mêlée à une autre modification du workflow 03. REC-008 n'est pas commencé.
