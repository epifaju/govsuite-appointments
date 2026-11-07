# REC-008 phase 8F-2B49-P4F — Installation TEST des correctifs TTL A+B+C

Installation **technique uniquement** des correctifs A+B+C (préparés en P4E) dans le workflow n8n TEST `OCD9It1uKFhOoWNF`.  
**Aucune activation, aucun chat, aucun Ollama, aucun CLAIM/POST, aucune mutation SQL métier, aucun LIVE.**

Artefacts : `n8n/proposed/2026-11-01-rec008-phase8f2b49-P4F-TTL-FIX-TEST-INSTALL/`  
(`PREFLIGHT.json`, `BACKUP.json`, `before-…json`, `candidate-…json`, `PATCH_VALIDATION.json`, `CANDIDATE_OFFLINE_TEST_RESULTS.json`, `update-body.json`, `put-response.json`, `after-…json`, `RESULT.json`, `FIX_C_INSTALL.sql`, scripts)

Verdict : **PASS**  
GO/NO-GO validation fonctionnelle (phase distincte) : **GO** sous autorisation séparée  
GO/NO-GO activation / chat immédiat : **NO-GO** sans autorisation distincte

---

## 1. Préflight

| Contrôle | Observé | OK |
| --- | --- | --- |
| ID / inactif | `OCD9It1uKFhOoWNF` ; `active=false` ; `activeVersionId=null` | oui |
| Version / VC | `e1b32992-…` / **8** | oui |
| Graphe / Finaliser | 134/137 ; SHA `3fc500bf…` | oui |
| PG / ouvertes | `1\|11\|4\|0` ; **0** | oui |
| Mock | `created` ; POST **0** ; avail **0** ; services **0** | oui |
| LIVE / Mailpit | `a2dea067…` ; 5/2/98304 | oui |
| 10 URL → `rec008-mock:8080` | oui | oui |
| Credentials PG TEST | `Fs0l0058q5CEadRw` only | oui |
| Réseau TEST ↛ LIVE | `networkOk=true` | oui |

Aucun STOP. Compteurs mock stables à 0 (baseline post-redémarrage Docker P4E).

---

## 2. Sauvegarde et SHA

| Élément | Valeur |
| --- | --- |
| Export | `before-OCD9It1uKFhOoWNF.json` |
| SHA-256 JSON avant | `b08556caec837f9b095ab4707d530e21ea549aa5a4549e4224fe9919ff3f35ea` |
| Version / VC sauvegardés | `e1b32992-…` / 8 |
| Activation | inactive |
| Settings rétention | conservés dans `BACKUP.json` |
| SHA nœuds cibles (avant) | dans `BACKUP.json` / `PATCH_VALIDATION.json` |

Artefacts historiques P4E/P4D **non écrasés**.

---

## 3. Analyse du patch (avant PUT)

Candidat local : `candidate-OCD9It1uKFhOoWNF.json`  
SHA candidat : `9a9786cac897e5c8d48c50f6929d4142f5d482b2ed9ed6230e99b45725148ac1`

Nœuds modifiés (exactement 6) :

1. `Charger état conversation` — Fix A  
2. `Joindre tentative de session` — drapeaux  
3. `Parser intention` — verrou / expiration  
4. `Gérer collecte progressive` — branche expirée / reprise / abandon  
5. `Réponse générale` — message public `session_expired`  
6. `Sauvegarder état conversation` — Fix C  

Contrôles : connexions identiques ; graphe 134/137 ; 10 URL mock ; credentials TEST ; SHA Finaliser inchangé ; settings rétention inchangés ; pas de webhook/LIVE ajouté.

### Points de validation §4

| # | Point | Démontré |
| --- | --- | --- |
| 1 | `sessionExpired` si session absente | oui (Joindre → `sessionFound=false`) |
| 2 | Expirée + tentative ouverte | oui (UNCERTAIN/SUBMITTING/AWAITING exemptés du GENERAL forcé) |
| 3 | Reprise explicite | oui (`reprendre` / `continuer…`) |
| 4 | `refreshSessionTtl=false` | oui (Gérer → Sauvegarder) |
| 5 | `_authorizedNulls` | oui — **corrigé P4F** : `text[]` + `= ANY` (le `?` jsonb de P4E était incorrect pour un tableau) |
| 6 | Params SQL n8n | oui (`$1` / `JSON.stringify($json)`) |
| 7 | Purges légitimes | oui (UPDATE dédiés inchangés + `_authorizedNulls`) |

---

## 4. Tests statiques et hors ligne

`CANDIDATE_OFFLINE_TEST_RESULTS.json` — logique **extraite** des nœuds candidats : **21/21 PASS** (18 P4E + contrôles absente / reprendre / négatif).

Couverture clé : session expirée + libre / `oui` (0 CLAIM) ; `reprendre` sans réservation auto ; `ASK_PRENOM`+`Camille` ; LLM `GET_SERVICES` ; `non` / `modifier le nom` ; `UNCERTAIN` ; NULL autorisé / non autorisé.

---

## 5. Résultat de l’installation

| Élément | Valeur |
| --- | --- |
| Méthode | 1× PUT `/api/v1/workflows/OCD9It1uKFhOoWNF` (clé API scopes read/update) |
| HTTP | **200** |
| Retry | aucun |
| Activation | **non** |
| Chat / Ollama / CLAIM / POST | **non** |

---

## 6. Nouvelle version TEST (baseline)

| Champ | Avant (VC8) | Après |
| --- | --- | --- |
| `versionId` | `e1b32992-bc68-46af-86ce-c80af46f5305` | **`e7867799-2a18-4aec-9ee5-3ba9cbc40766`** |
| `versionCounter` | 8 | **9** |
| `active` | false | **false** |
| `activeVersionId` | null | **null** |

---

## 7. SHA des nœuds modifiés (après = candidat)

| Nœud | SHA paramètres |
| --- | --- |
| Charger état conversation | `fca043913c5a27f7cc1e82261f8a1908a43ee8ad9d356eabec9de68a5f97ff8b` |
| Joindre tentative de session | `c295cd4851cf045230a33346987536670f80b58db75b1334daafcc7da2a4b3d4` |
| Parser intention | `bd0bf9db4db88cb563d5b0766d528ec00894e3fb3843e260aa95031c52e35357` |
| Gérer collecte progressive | `5bc5b967c71e219c88f1bfc6f8c2a70b7ef2e79d2a56475733650c0d20855e6e` |
| Réponse générale | `d58106f6f7fdc27efba1c2211e0aefa7c3945f3944745ba9dae4f50ae8e03373` |
| Sauvegarder état conversation | `7c8597781429d7c282e69b908ae28bebcb97f6a84650423cfbd48b67fef00387` |
| Finaliser état création | `3fc500bf…` (**inchangé**) |

`shasMatch=true` (après ≡ candidat).

---

## 8. Vérifications post-installation

- Workflow **inactif** ; aucun workflow actif ; graphe **134/137**.  
- Correctifs A+B+C **présents**.  
- URL mock ×10 et credential PG TEST inchangés.  
- Paramètres de rétention inchangés ; connexions inchangées.

---

## 9. Intégrité PostgreSQL / mock

| Domaine | Valeur |
| --- | --- |
| PG | `1\|11\|4\|0` |
| Ouvertes | 0 |
| Mock | POST 0 ; avail 0 ; services 0 ; `created` |

Aucune mutation métier détectée.

---

## 10. Intégrité LIVE / Mailpit

| Domaine | Valeur |
| --- | --- |
| LIVE | `13\|14\|12\|48\|0\|a2dea067599fd4f0a5f857551adc67cc` |
| Mailpit | 5 / 2 / 98304 |

---

## 11. Rollback

**Non nécessaire** (installation validée).  
Sauvegarde pré-P4F disponible : `before-OCD9It1uKFhOoWNF.json` + `BACKUP.json` (VC8). Procédure : `ROLLBACK_PLAN.md` P4E / restauration TEST uniquement.

---

## 12. Verdict

**PASS**

Installation unique TEST réussie, workflow resté inactif, empreintes métier inchangées, A+B+C alignés sur le candidat validé.

---

## 13. GO / NO-GO phase suivante

| Cible | Décision |
| --- | --- |
| Phase distincte de **validation fonctionnelle** TEST (activation contrôlée + messages) | **GO** sous **autorisation distincte** |
| Activation / chat immédiat sans autorisation | **NO-GO** |
| LIVE | **NO-GO** absolu |
| Reconstruction CONV-07 / rejeu P4 | **NO-GO** tant que non autorisé séparément |

Baseline TEST à utiliser désormais : **VC9** / `e7867799-2a18-4aec-9ee5-3ba9cbc40766`.

Restrictions respectées. Arrêt ici.
