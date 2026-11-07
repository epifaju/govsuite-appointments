# Checklist installation TEST future — FIX-008 (non exécutée)

Mission **TEST-INSTALL-READINESS-009** : documentation seule.  
Pattern : P4F TEST-INSTALL (PUT inactif unique) + garde-fous ASK-PRENOM (0 retry, pré/postflight).

**N’exécutez aucune étape ci-dessous sans autorisation humaine écrite distincte.**

---

## 0. Préconditions d’autorisation

- [ ] Autorisation **install TEST FIX-008** seule (ne couvre pas activation, chat, seed SQL, LIVE)
- [ ] Cible confirmée : `http://127.0.0.1:5682` — port ≠ LIVE
- [ ] Offline PASS connu : `node tests/rec008/scripts/run-fix-008.cjs` (candidat SHA `849201dd…`) — **PASS offline ≠ GO install**
- [ ] Evidence-reviewer / planner : NO-GO levé explicitement pour **cette** install uniquement

## 1. Préflight (STOP si échec)

Suivre `PREFLIGHT.md`. Résumé :

- [ ] Workflow `OCD9It1uKFhOoWNF` **inactif** ; `activeVersionId=null` ; webhooks actifs = 0
- [ ] Aucun autre workflow actif
- [ ] Ancre VC9 : SHA fichier distant / export = `6284f867…f82b889` ; `versionId=e7867799…` ; counter `9` ; graphe 134/137
- [ ] SHA nœud Gérer (parameters) = baseline VC9 `5bc5b967…855e6e` (P4F after)
- [ ] URLs → `rec008-mock` ; credential Postgres TEST
- [ ] Compteurs PG TEST / open attempts / mock / Mailpit / empreinte LIVE (lecture) ancrés
- [ ] Isolation réseau TEST ↛ LIVE OK
- [ ] **0 retry** sur échec transport préflight → STOP / UNCERTAIN

## 2. Sauvegarde (obligatoire avant PUT)

Suivre `BACKUP-SHA-ROLLBACK.md` § sauvegarde.

- [ ] Export JSON courant → chemin documenté sous ce dossier ou `BACKUP.json` + `before-runtime-*.json`
- [ ] Enregistrer : `jsonSha256`, `versionId`, `versionCounter`, `nodeShas` (surtout Gérer), settings, urls (sans secrets)
- [ ] Vérifier SHA export = ancre préflight VC9
- [ ] Conserver `../before-OCD9It1uKFhOoWNF.json` intact (rollback canonique)

## 3. Action unique — PUT candidat (sans activation)

- [ ] Payload = `../after-OCD9It1uKFhOoWNF.json` uniquement
- [ ] Vérifier SHA fichier local candidat = `849201ddd7cb17c158de292ed5479bfd024d83ac89b9a1f135b9422ae973618c` **avant** PUT
- [ ] **Un seul** PUT workflow TEST
- [ ] `active` reste `false` ; **ne pas** publish / activate / enable webhook
- [ ] Aucun chat, aucun POST CreateAppointment, aucune mutation SQL
- [ ] Timeout / status ambigu → **UNCERTAIN**, **pas de second PUT**, escalade

## 4. Postflight install (sans message métier)

Suivre `POSTFLIGHT.md`.

- [ ] Toujours inactif ; webhooks 0
- [ ] SHA fichier / export after ≈ candidat `849201dd…` (ou empreinte nœud Gérer jsCode `f75d4984…`)
- [ ] Seul nœud Gérer diffère vs backup ; connections / settings / Finaliser inchangés
- [ ] PG / mock / LIVE / Mailpit = ancres préflight (Δ métier = 0)
- [ ] Artefact `RESULT.json` (sans secrets / PII)
- [ ] Verdict PASS / FAIL / UNCERTAIN — **stop** (n’autorise pas runtime S0x)

## 5. Hors périmètre de cette checklist

| Action | Statut |
| --- | --- |
| Activation workflow | Mission runtime distincte |
| Message `Camille` / `reprendre` | ASK-PRENOM / campagne séparée |
| Seed sessions SQL | Interdit sans mission SQL |
| Install LIVE | **Toujours interdit** |
| Docker compose mutate | **Interdit** |

## Ordre strict (rappel orchestration)

1. Autorisation humaine install  
2. Préflight PASS  
3. Backup + SHA  
4. PUT unique  
5. Postflight  
6. Evidence-reviewer  
7. **Halt** — pas d’activation auto
