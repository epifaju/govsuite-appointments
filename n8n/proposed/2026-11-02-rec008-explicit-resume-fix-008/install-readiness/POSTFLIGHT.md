# Postflight install TEST FIX-008 — non exécuté (mission 009)

S’applique **après** un PUT candidat autorisé. Ne couvre pas une campagne chat.

## Contrôles obligatoires

1. `active=false`, `activeVersionId=null`, webhooks 0 — **hardStop** si actif
2. Aucun autre workflow actif
3. Empreinte candidat :
   - fichier / export SHA → `849201ddd7cb17c158de292ed5479bfd024d83ac89b9a1f135b9422ae973618c`
   - **ou** jsCode Gérer seul → `f75d49849231f956bb9ae5383111ea84b362dc58de6711cc75d2e7e2a26917fe`
   - parameters Gérer ≠ VC9 `5bc5b967…` (doit avoir changé)
4. Autres nœuds ciblés P4F (Charger, Joindre, Parser, Réponse, Sauvegarder, Finaliser) = backup pré-PUT
5. `connections` / settings execution-save = inchangés vs backup
6. URLs toujours `rec008-mock` ; credential Postgres TEST
7. PG TEST / open / mock POST·avail·services / Mailpit / empreinte LIVE = ancres préflight
8. `versionCounter` : documenter nouvelle valeur si l’API en crée une (attendu : incrément) — **ne pas** appeler ça VC10 produit tant que non validé evidence
9. Artefact `RESULT.json` : putStatus, putCount≤1, shasMatch, checks — **sans** tokens / PII
10. Verdict **PASS** | **FAIL** | **UNCERTAIN**

## Comportement si écart

| Écart | Action |
| --- | --- |
| Workflow actif après PUT | Désactiver immédiatement (si autorisé) puis STOP |
| SHA Gérer ≠ candidat | **Ne pas** re-PUT automatiquement → rollback plan ou escalade |
| Δ mock / CLAIM / open attempts | FAIL ; pas de campagne runtime |
| Timeout GET postflight | UNCERTAIN ; pas de retry boucle ; escalade |
| PUT ambigu (status inconnu) | UNCERTAIN ; traiter comme possible mutation ; préparer rollback |

## Non-objectifs

- Pas de message `reprendre` / `Camille` ici
- Pas d’autorisation ASK-PRENOM / P4G2
- Pas de phase suivante auto
