# REC-008 phase 8F-2B49-P4E — Préparation hors ligne du correctif TTL / routage / brouillon

Préparation **offline only** d’une correction robuste de la perte de contexte (P4 : `Camille` → `GET_SERVICES` + purge).  
**Aucune installation** du correctif. Aucun chat, activation, PUT, mutation SQL, Ollama, CLAIM, POST CreateAppointment, e-mail, LIVE métier, ni modification d’artefacts historiques.

Artefacts : `n8n/proposed/2026-11-01-rec008-phase8f2b49-P4E-TTL-FIX-OFFLINE/`  
Références : diagnostic P4D, rapport P4, `REC_008_STATE_MACHINE.md`, `REC_008_TEST_MATRIX.md`, `PROPOSED_FIX.diff.txt` P4D, export TEST VC8 `after-OCD9It1uKFhOoWNF.json`.

Verdict préparation : **PASS**  
GO/NO-GO installation ultérieure TEST : **GO** (autorisation distincte obligatoire)  
GO/NO-GO LIVE / chat immédiat : **NO-GO**

---

## 1. Préflight

| Contrôle | Attendu | Observé | OK |
| --- | --- | --- | --- |
| Workflow `OCD9It1uKFhOoWNF` | inactif, `activeVersionId=null` | inactif, `null` | oui |
| Version / VC | `e1b32992-…` / 8 | identique | oui |
| Graphe / SHA Finaliser | 134/137 ; `3fc500bf…` | identique | oui |
| PG TEST | `1\|11\|4\|0` ; ouvertes 0 | identique ; ABD1/CONF2/EXP1 | oui |
| Mock scénario | `created` | `created` | oui |
| Mock POST / GET avail / GET services | 1 / 3 / 1 | **0 / 0 / 0** | écart **expliqué** |
| LIVE fingerprint | `a2dea067…` (`13\|14\|12\|48\|0\|…`) | identique | oui |
| Mailpit | 5 / 2 / 98304 | identique | oui |

**Écart mock :** conteneurs TEST `Exited (255)` après redémarrage Docker Desktop ; redémarrage des conteneurs existants (sans changement Compose) pour lecture seule. Compteurs `_meta/calls` en mémoire remis à zéro. **Pas une dérive métier inexpliquée** → travail hors ligne poursuivi (`PREFLIGHT_ANNOTATION.json`).

Export VC8 lu hors API : `id=OCD9It1uKFhOoWNF`, `versionCounter=8`, graphe 134/137, SHA Finaliser conforme.

---

## 2. Politique d’expiration retenue

### TTL conversationnel (`ai_conversation_state.expires_at`, 2 h)
Distinct du TTL de tentative (`ai_appointment_attempt.expires_at`).

### Session active (`expires_at` null ou `> NOW()`)
- Charger le contexte.
- Continuer la collecte.
- Priorité à `conversation_step` / `pending_action` persistés.
- Verrou CREATE sur `ASK_NOM|ASK_PRENOM|ASK_EMAIL|ASK_TELEPHONE|ASK_CREATE_SLOT` (sauf commandes explicites).

### Session expirée sans tentative ouverte
- Charger la ligne pour diagnostic (`sessionFound`, `sessionExpired`, …).
- **Ne pas** traiter un message libre (`Camille`, `oui`, …) comme continuation.
- Répondre que la session a expiré (texte public, **sans** flags techniques).
- Reprise seulement via message entier autorisé : `reprendre` / `reprendre ma demande` / `continuer` / `continuer ma demande` → alors refresh TTL + reprise de l’étape.
- **Ne pas** prolonger silencieusement `expires_at` sur un simple message libre.
- **Ne pas** effacer le brouillon via routage sans contexte.

### Session expirée / tentative ouverte
| Statut tentative | Comportement |
| --- | --- |
| `AWAITING_CONFIRMATION` + TTL dépassé | Pas de POST ; expiration tentative ; pas de confirmation implicite |
| `SUBMITTING` / `UNCERTAIN` | `RESUME` replay only ; pas de nouvelle clé ; pas de CREATE implicite |
| `EXPIRED` / `ABANDONED` / `REJECTED` / `CONFIRMED` | Pas de réutilisation de clé purgée ; pas de CLAIM depuis message libre |

`expires_at <= NOW()` (limite exacte) = **expiré** (aligné SQL proposé).

Écart volontaire vs Fix A minimal P4D : P4D proposait de continuer la collecte après TTL ; P4E **refuse la continuation silencieuse** et exige une reprise explicite.

---

## 3. Analyse des correctifs A / B / C

### Fix A — Chargement contrôlé (`PROPOSED_FIX_A.sql`)
- Supprime le filtre `expires_at > NOW()`.
- Produit : `sessionFound`, `sessionExpired`, `sessionExpiresAt`, `conversationStep`, `pendingAction`.
- N’active pas la session ; ne prolonge pas le TTL.

### Fix B — Routage déterministe (`PROPOSED_FIX_B.js` + patch)
- Collecte **active** : force `CREATE_APPOINTMENT` ; capture nom/prénom/e-mail/téléphone selon l’étape.
- Préserve oui / non / modifier… / abandon / restart explicite.
- Session **expirée** : `intent=GENERAL`, `preserveDraft`, `refreshSessionTtl=false` ; **pas** de forçage CREATE.
- `Réponse générale` : message `session_expired` public sans drapeaux techniques.

### Fix C — Protection de sauvegarde (`PROPOSED_FIX_C.sql` + `save-guard.js`)
| Cas | Effet |
| --- | --- |
| Champ absent | inchangé |
| Champ avec valeur | mis à jour |
| NULL non autorisé | conserve l’existant (corrige la purge P4) |
| NULL + `_authorizedNulls` | écrit NULL (abandon / purge légitime) |
| `refreshSessionTtl=false` | conserve `expires_at` |

Les nœuds UPDATE dédiés (Finaliser, abandon confirmation, etc.) restent la voie principale des purges légitimes.

---

## 4. Diffs proposés

| Fichier | Rôle |
| --- | --- |
| `PROPOSED_FIX_A.sql` | Charger état conversation |
| `PROPOSED_FIX_B.js` | Module de routage + helpers (réf. d’intégration) |
| `PROPOSED_FIX_C.sql` | Sauvegarder état conversation |
| `PROPOSED_WORKFLOW_PATCH.diff` | Patch unifié nœuds existants (134/137 inchangé) |
| `ROLLBACK_PLAN.md` / `RISK_ASSESSMENT.md` | Rollback & risques |

**Non appliqués.** LIVE non touché.

---

## 5. Résultats des tests unitaires hors ligne

`offline-tests.js` + `TEST_CASES.json` — **18/18 PASS** (`OFFLINE_TEST_RESULTS.json`).

| ID | Scénario | Résultat |
| --- | --- | --- |
| TC01 | Active `ASK_NOM` + nom libre | CREATE + capture → `ASK_PRENOM` |
| TC02 | Active `ASK_PRENOM` + `Camille` | CREATE + `ASK_EMAIL` ; nom conservé |
| TC03 | Active `ASK_EMAIL` + e-mail | CREATE + `ASK_TELEPHONE` |
| TC04 | Active `ASK_TELEPHONE` + tél. | → `AWAIT_CREATE_CONFIRMATION` ; 0 POST |
| TC05 | Active `ASK_PRENOM` + LLM `GET_SERVICES` | forcé CREATE |
| TC06 | Expirée + `Camille` | GENERAL + brouillon préservé ; TTL non prolongé |
| TC07 | Expirée + `oui` | pas de confirmation ; 0 CLAIM/POST |
| TC08 | Attente + `oui` | `AFFIRM` (chemin confirmation) |
| TC09 | Attente + `non` | `NEGATIVE` ≠ AFFIRM |
| TC10 | Attente + `modifier le nom` | `MODIFY` |
| TC11 | `abandonner` en collecte | clear autorisé ; 0 POST |
| TC12–14 | Sauvegarde absent / NULL autorisé / non autorisé | sémantique Fix C |
| TC15 | `UNCERTAIN` | `RESUME` only |
| TC16 | Tentative `EXPIRED` | pas de réutilisation de clé |
| TC17–18 | TTL exact / juste après | traités expirés |

Absence de chemin CLAIM/POST vérifiée sur tous les scénarios non-AFFIRM.

---

## 6. Risques de régression

Voir `RISK_ASSESSMENT.md`. Principaux : friction UX « reprendre » ; verrou CREATE pendant collecte (mitigé par allowlist) ; oubli d’installer Fix C avec A+B.

Sécurité : confirmation explicite respectée ; pas de POST depuis session expirée ; pas de clé terminale réutilisée ; `non` non transformé en confirmation ; `UNCERTAIN` en replay ; pas de double réservation introduite ; LIVE hors scope.

---

## 7. Stratégie de rollback

Voir `ROLLBACK_PLAN.md`. Restaurer l’export VC8 `after-OCD9It1uKFhOoWNF.json` sur TEST uniquement. Aucun DDL. **Sans installation, aucun rollback n’est requis.**

---

## 8. Postflight

Identique au préflight P4E : workflow inactif VC8, PG `1|11|4|0`, ouvertes 0, LIVE/Mailpit inchangés, mock compteurs 0/scénario `created`, `unchangedVsPreflight=true`.  
Aucune mutation SQL/chat/PUT/activation. Artefacts historiques P4/P4D non modifiés.

---

## 9. Verdict

**PASS** (préparation hors ligne)

Cause P4D adressée par A+B+C avec politique d’expiration explicite plus stricte que le Fix A P4D. Tests unitaires 18/18. Restrictions respectées.

---

## 10. GO / NO-GO installation ultérieure

| Cible | Décision |
| --- | --- |
| Installation **TEST** `OCD9It1uKFhOoWNF` (A+B+C) | **GO** sous **autorisation distincte** |
| Chat / reconstruction CONV-07 | **NO-GO** tant que non autorisé séparément |
| Workflows **LIVE** | **NO-GO** absolu |
| Installation immédiate sans autorisation | **NO-GO** |

Séquence recommandée après autorisation : installer A+B+C sur TEST inactif → préflight → activer brièvement pour validation contrôlée → reconstruire session → rejouer P4+ → désactiver.

---

Arrêt ici. Attente d’une autorisation distincte avant toute installation.
