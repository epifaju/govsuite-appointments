# REC-008 — Risques de persistance post W-031-01 (033)

Analyse **statique**. Aucune mutation PG / workflow.

## Mitigé par W-031-01

Sur `sessionExpired && !reprendre` : `email` / `nom` / `prenom` / `telephone` ne retombent plus sur `x.*` → payload Gerer n’injecte plus l’identité Fusionner du message courant → `Sauvegarder` ne peut plus **écraser** ces colonnes avec la fuite W-031-01.

## Résiduels (hors scope patch 032)

| Élément | Risque | Sévérité |
| --- | --- | --- |
| `originalMessage` / `last_user_message` | Early-return pose encore `originalMessage: message` ; Save peut persister le texte brut (email-shaped) | Medium (PII texte, pas colonne email) |
| Fusionner `??` / `pick` | Peut toujours porter email en amont ; bloqué au Gerer sur chemin corrigé | Low/Info |
| service/site/dates/slots `?? x.*` sur expired non-resume | Pollution brouillon possible | Low (non PII identité) |
| Branche `reprendre` | Conserve `previous ?? x` — voulu FIX-008 | OK |

## Verdict persistance pour readiness install

**Pas de NO-GO** métier sur la base de W-031-01 (fuite colonne email corrigée dans le candidat).  
Risque `last_user_message` : **documenté** — correction séparée éventuelle (mission outillage), **non** bloquante pour install W-031-01 si artefacts campagne restent expurgés (contrat 030).
