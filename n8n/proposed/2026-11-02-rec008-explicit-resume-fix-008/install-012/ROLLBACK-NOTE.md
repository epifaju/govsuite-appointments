# Rollback FIX-008 — préparé, non exécuté (012)

## Source

- Fichier : `backup-pre-fix008-2026-11-05T20-20-12-227Z.json`
- SHA256 : `6284f867054879d00292b45b5a8560f25dc778a56979ea354b18af2f5f82b889` (= VC9)
- `versionId` pré-PUT : `e7867799-2a18-4aec-9ee5-3ba9cbc40766` / counter **9**

## Déclencheurs (futurs)

Postflight FAIL / activation inattendue / dérive multi-nœuds → **STOP** ; rollback seulement sur **ordre humain distinct**.

## Procédure (non lancée)

1. Confirmer TEST `5682` + workflow `OCD9It1uKFhOoWNF` inactif  
2. Un seul PUT = JSON backup  
3. Relire : Gérer jsCode `16c3d063…` ; `active=false`  
4. Evidence + halt  

**Aucune restauration automatique en 012.**
