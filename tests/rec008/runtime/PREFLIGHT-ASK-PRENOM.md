# Préflight ASK_PRENOM (S01–S03) — non exécuté en mission 007

## Commun (STOP si échec)

1. Cible TEST `127.0.0.1:5682` uniquement — pas LIVE
2. Workflow `OCD9It1uKFhOoWNF` VC9 inactif ; webhooks 0
3. SHA source `6284f867…f82b889` ; versionId `e7867799…`
4. Credentials PG TEST ; URLs → `rec008-mock`
5. Mock posts/avail/services = 0 ; open attempts = 0
6. Empreinte LIVE = ancre historique lecture seule (pas de claim « actuel » sans mesure autorisée)
7. Autorisation humaine écrite pour la campagne
8. **0 retry** métier ; un message par scénario
9. Sessions **distinctes** S01 / S02 / S03 — pas de chaînage S02→S03 sans reset autorisé

## S01

- Session `rec008-syn-s01-ask-prenom-active` ACTIVE
- `pending=CREATE`, `step=ASK_PRENOM`, nom présent, prenom null

## S02

- Session `rec008-syn-s02-ask-prenom-expired` EXPIRÉE
- Même shape brouillon ; prenom null

## S03

- Session **indépendante** `rec008-syn-s03-ask-prenom-resume` EXPIRÉE
- **NO-GO brief** tant que VC9 capture `reprendre` comme prenom
- Si campagne « VC9-actual » autorisée explicitement : documenter divergence
