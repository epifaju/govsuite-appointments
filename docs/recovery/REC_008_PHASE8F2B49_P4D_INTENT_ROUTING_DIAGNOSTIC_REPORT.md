# REC-008 phase 8F-2B49-P4D — Diagnostic hors ligne : perte de contexte en ASK_PRENOM

Diagnostic **lecture seule** de l’échec P4 (`Camille` → `GET_SERVICES` + purge du brouillon). Aucun chat, activation, PUT, SQL, Ollama, mock ni LIVE métier.

Verdict diagnostic : **PASS** (cause démontrée)  
GO/NO-GO correction séparée : **GO** (sous autorisation distincte)

Artefacts : `n8n/proposed/2026-11-01-rec008-phase8f2b49-P4D-INTENT-ROUTING-DIAGNOSTIC/`  
(`PREFLIGHT.json`, `POSTFLIGHT.json`, `NODE_SHA_COMPARE.json`, `OFFLINE_TEST_RESULTS.json`, `PROPOSED_FIX.diff.txt`, exports de nœuds, `offline-tests.js`)

## 1. Préflight

| Contrôle | Observé | OK |
| --- | --- | --- |
| Workflow `OCD9It1uKFhOoWNF` | inactif, `activeVersionId=null` | oui |
| Version / VC | `e1b32992-…` / 8 | oui |
| Graphe / SHA Finaliser | 134/137 ; `3fc500bf…` | oui |
| PG TEST | `1\|11\|4\|0` ; ouvertes 0 | oui |
| Mock | POST=1 ; GET availability=3 ; GET services=1 ; `created` | oui |
| LIVE / Mailpit | `a2dea067…` ; 5/2/98304 | oui |

Nœuds critiques live ≡ export 8F-2B26 (`NODE_SHA_COMPARE.json`, `allCriticalIdentical=true`).

## 2. Reconstitution du problème

| Élément | Fait |
| --- | --- |
| P3 RESULT | écrit **01/11/2026 19:27:10** (`Dupont` → `ASK_PRENOM`, PASS) |
| P4 message | **01/11/2026 21:36:45+01** (`Camille`) |
| Écart | **≈ 2 h 09 min** |
| TTL session | `expires_at = updated_at + 2 hours` à chaque sauvegarde |
| Expiration théorique après P3 | ≈ **21:27** |
| P4 | **après** expiration |

`Charger état conversation` :

```sql
WHERE session_id = $1
  AND (expires_at IS NULL OR expires_at > NOW())
```

Après expiration : **aucune ligne** chargée → mémoire vide pour Parser / Fusionner / Gérer, alors que la ligne PostgreSQL existe encore.

Nuance P4 : le **préflight SQL direct** voyait encore `ASK_PRENOM` / `Dupont` (pas de filtre TTL), alors que le nœud Charger du workflow **ne chargeait plus** cette ligne. D’où l’écart préflight « session prête » vs exécution « session amnésique ».

`Comprendre la demande` ne reçoit que `chatInput` (pas l’état PG) : sans mémoire déterministe en aval, le LLM classifie un prénom isolé hors contexte.

Chaîne observée P4 :

1. LLM (`Comprendre la demande`) sans contexte de collecte → intent vraisemblable `GET_SERVICES` pour un prénom libre.
2. Parser : **aucun verrou** `ASK_PRENOM` (seulement `ASK_TOKEN*`) → conserve `GET_SERVICES`.
3. Fusionner : sans `pending_action` précédent → ne continue pas CREATE ; intent reste `GET_SERVICES`.
4. Gérer : `pendingAction=null`, `conversationStep=null`, champs vides.
5. Sauvegarder : UPSERT avec clés JSON présentes à `null` → **écrase** le brouillon encore stocké.
6. Router → `Appeler GetServices` → réponse `type=services` (GET /services Δ+1).

**Ollama n’est pas la cause unique** : sans mémoire chargée, le routage déterministe mène déjà à services + purge. Avec mémoire présente, les tests hors ligne montrent que Fusionner **aurait** conservé CREATE malgré un LLM `GET_SERVICES`.

## 3. Chemin exact des nœuds

```
Chat → Charger état conversation → Lire tentative → Joindre tentative
    → Comprendre la demande (LLM) → Parser intention → Fusionner état
    → Gérer collecte progressive → Sauvegarder état → Router intention
    → [si GET_SERVICES] Appeler GetServices → Préparer réponse services
```

| Nœud | Rôle / risque |
| --- | --- |
| Charger état conversation | Filtre TTL → peut **cacher** l’état CREATE encore en base |
| Joindre tentative de session | Fusionne `previous` + `openAttempt` |
| Comprendre la demande | Propose `intent` JSON ; pas de garde ASK_PRENOM |
| Parser intention | Verrouille token cancel/get/reschedule **seulement** ; laisse `GET_SERVICES` en collecte identité |
| Fusionner état conversation | Si `pending_action` connu : `continuingPreviousAction` → `intent=CREATE` + pick des champs ; si mémoire vide : intent LLM + champs vides |
| Gérer collecte progressive | CREATE+ASK_PRENOM capture le message comme prénom ; sinon branche GENERAL → pending/step null |
| Sauvegarder état conversation | `payload ? 'champ'` → écrit même les **null** → purge UPSERT |
| Router intention | Sortie 0 = GET_SERVICES → HTTP mock services |

## 4. Priorité des intentions

Règle métier attendue : en `CREATE_APPOINTMENT` / `ASK_PRENOM`, `Camille` = prénom.

| Couche | Appliquée avant routage général ? |
| --- | --- |
| Parser verrou ASK_PRENOM | **Non** (lacune) |
| Fusionner continuation CREATE | **Oui, si** `pending_action` chargé |
| Gérer capture prénom | **Oui, si** pending CREATE + step ASK_PRENOM |
| Router | Suit `intent` après sauvegarde |

Conclusion : la priorité collecte **dépend entièrement** du chargement mémoire. Le TTL brise cette chaîne.

## 5. Comparaison P3 / P4 / 8F-2B40

| | P3 `Dupont` | P4 `Camille` | Hist. 8F-2B40 |
| --- | --- | --- | --- |
| Step avant | ASK_NOM | ASK_PRENOM | ASK_PRENOM |
| Âge session vs TTL | frais | **> 2 h** | frais (vague continue) |
| Mémoire chargée | oui | **non (expirée)** | oui |
| Résultat | ASK_PRENOM | GET_SERVICES + purge | ASK_EMAIL |
| POST | 0 | 0 | 0 |

Différence vérifiable dominante : **échéance de session**, pas une divergence de code (SHA nœuds identiques).

## 6. Cause démontrée

**Cause racine :** expiration TTL (2 h) + filtre `Charger état conversation` + UPSERT nullifiant via `Sauvegarder`, couplés à une classification LLM `GET_SERVICES` en l’absence de contexte.

**Cause contributive (défense manquante) :** Parser ne force pas `CREATE_APPOINTMENT` pendant `ASK_NOM|ASK_PRENOM|ASK_EMAIL|ASK_TELEPHONE`.

Hypothèse écartée comme cause seule : « Ollama a cassé la fusion alors que la mémoire était chargée » — contredite par T1 hors ligne et par l’horodatage d’expiration.

## 7. Résultats des tests hors ligne

`offline-tests.js` — **6/6 PASS** :

| ID | Scénario | Résultat |
| --- | --- | --- |
| T1 | Mémoire ASK_PRENOM + LLM GET_SERVICES | conserve CREATE, capture Camille |
| T2 | Sans mémoire + LLM GET_SERVICES | pending null / services (chemin purge) |
| T3 | Parser actuel | laisse GET_SERVICES |
| T4 | Parser proposé | force CREATE pour Camille |
| T5 | Parser proposé | `non` non forcé ; Camille verrouillé |
| T6 | ASK_NOM + LLM CREATE | continuation |

## 8. Correctif minimal proposé

Document : `PROPOSED_FIX.diff.txt` — **non installé**.

1. **Fix A (prioritaire)** : charger la session par `session_id` même si `expires_at` dépassé (flag `session_expired` optionnel).
2. **Fix B** : verrou Parser CREATE sur étapes d’identité, sauf `oui` / `non` / `modifier…` / restart explicite.
3. Fix C optionnel : durcir Sauvegarder contre nullification accidentelle.

## 9. Risques de régression

| Risque | Mitigation |
| --- | --- |
| Reprise d’une session vraiment abandonnée | Flag expired + messages / politique métier |
| Bloquer un vrai `GET_SERVICES` pendant collecte | Allowlist commandes explicites (Fix B) |
| Casser `non` / `modifier le nom` | Tests dédiés + exclude list |
| TTL métier encore utile | Conserver `expires_at` pour UX, pas pour masquer la ligne |

## 10. Postflight

Identique au préflight : PG `1|11|4|0`, mock POST=1, LIVE/Mailpit inchangés, workflow inactif VC8. Aucune mutation.

## 11. Verdict

**PASS** (diagnostic)

Cause démontrée par horodatages + SQL Charger + comportement UPSERT + tests hors ligne. Code live aligné sur l’export analysé.

## 12. GO/NO-GO

**GO** pour une phase de **correction séparée** (ex. install Fix A±B sous autorisation), puis **reconstruction** d’une session CONV-07 (nouvelle id ou reprise contrôlée) avant P5+.

**NO-GO** immédiat pour : renvoyer `Camille` sur `rec008-8f2b49-edit-01` en l’état ; installer un correctif sans autorisation ; imputer le seul Ollama.

Restrictions respectées. Arrêt ici.
