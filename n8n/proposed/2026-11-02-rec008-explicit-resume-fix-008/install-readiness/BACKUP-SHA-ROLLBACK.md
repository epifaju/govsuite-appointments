# Sauvegarde · SHA · Rollback · Escalade — FIX-008 install TEST

**Non exécuté** par TEST-INSTALL-READINESS-009. Pattern P4F `BACKUP.json` + plan P4E.

---

## 1. Sauvegarde (avant PUT)

### Artefacts à produire (sous autorisation)

| Artefact | Contenu (sans secrets) |
| --- | --- |
| `before-runtime-<ts>.json` | Export brut workflow TEST courant |
| `BACKUP.json` | Métadonnées : phase, at, workflowId, versionId, versionCounter, active, jsonSha256, nodes/edges, nodeShas, settings, urls, credentials **ids only** |
| Copie SHA | Entrée journal : `jsonSha256` = SHA-256 octets fichier export |

### Règles

- Ne jamais écraser `../before-OCD9It1uKFhOoWNF.json` ni `../after-OCD9It1uKFhOoWNF.json`.
- Ne pas committer cookies, passwords, `.env`, corps login.
- Si SHA export ≠ ancre VC9 `6284f867…f82b889` → **STOP** (ne pas installer).

### SHA de référence (offline)

| Objet | SHA-256 |
| --- | --- |
| VC9 / before (rollback) | `6284f867054879d00292b45b5a8560f25dc778a56979ea354b18af2f5f82b889` |
| Candidat after | `849201ddd7cb17c158de292ed5479bfd024d83ac89b9a1f135b9422ae973618c` |
| jsCode Gérer before | `16c3d063dee7f32df970e1d7c0d8ad81eee56f6dd603a6949c1a89622b36c961` |
| jsCode Gérer after | `f75d49849231f956bb9ae5383111ea84b362dc58de6711cc75d2e7e2a26917fe` |

Algo : SHA-256 fichier brut ; empreinte nœud = SHA-256(`JSON.stringify(parameters)`) ; jsCode = SHA-256 UTF-8 du champ seul (convention P4F / FIX-008).

---

## 2. Rollback (TEST uniquement, ordre explicite)

### Préconditions

- Workflow LIVE **hors scope** (ni apply ni rollback).
- Aucune migration DDL proposée → pas de downgrade SQL schéma.
- Source rollback préférée : export `BACKUP.json` / `before-runtime-*.json` de **cette** fenêtre ; à défaut `../before-OCD9It1uKFhOoWNF.json` (VC9).

### Procédure documentée

1. Désactiver immédiatement si actif (`active=false`, webhooks 0).
2. **Un seul** PUT = JSON de rollback (backup runtime ou before VC9).
3. Vérifier : inactif ; SHA = backup / VC9 `6284f867…` ; Gérer parameters SHA VC9 ; graphe 134/137 ; Finaliser inchangé.
4. Re-ancrer PG / mock / LIVE / Mailpit = préflight (Δ métier rollback = 0).
5. Aucun chat tant que préflight post-rollback non vert.
6. Artefact `ROLLBACK-RESULT.json` + verdict ; **halt**.

### Données

- Lignes `ai_conversation_state` éventuellement touchées **après** une campagne runtime restent en base ; rollback code **ne** les réécrit pas.
- Pas de purge PII réelle dans les rapports.
- Ne pas réutiliser de clés d’idempotence métier.

### Critères succès rollback

| Contrôle | Attendu |
| --- | --- |
| Workflow TEST | inactif, SHA VC9 / backup |
| Gérer | jsCode before `16c3d063…` |
| PG / mock / LIVE / Mailpit | ancres |
| CLAIM / POST create | 0 delta |

### Hors mission 009

Tant que le candidat n’est **pas** installé, **aucun rollback runtime n’est nécessaire**.

---

## 3. Escalade

| Situation | Escalade |
| --- | --- |
| Préflight KO (SHA drift, actif inattendu, LIVE confusion) | STOP ; notifier humain ; pas de PUT |
| PUT timeout / réponse ambiguë | UNCERTAIN ; **pas de retry PUT** ; préparer lecture GET unique si autorisée, sinon halt + rollback sous **nouvel** ordre |
| Postflight SHA ≠ candidat et ≠ backup | FAIL ; rollback sous ordre ; evidence-reviewer |
| Activation involontaire | Désactiver ; FAIL process ; audit webhooks |
| Empreinte LIVE dérive | **Ne pas toucher LIVE** ; FAIL / UNCERTAIN ; escalade sécurité |
| Tentation 2ᵉ PUT / retry chat | FAIL process ; halt |
| Doute TEST vs LIVE (ports, volumes, creds) | STOP immédiat ; security-auditor |
| Besoin campagne message après install PASS | **Nouvelle** autorisation (hors 009) |

Chaîne : opérateur → devops (pré/post) → evidence-reviewer → planner (GO/NO-GO phase courante seulement).
