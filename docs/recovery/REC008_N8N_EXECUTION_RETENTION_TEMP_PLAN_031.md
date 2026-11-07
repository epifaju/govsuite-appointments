# REC-008 — Plan optionnel rétention temporaire (MISSION 031)

**Docs only.** Aucune exécution. Aucun PUT settings. Aucune purge. Aucun changement Docker. Aucun LIVE.

Ancre diagnostic : [`REC008_N8N_EXECUTION_RETENTION_DIAG.md`](./REC008_N8N_EXECUTION_RETENTION_DIAG.md) (EVIDENCE-OBSERVABILITY-030).

Cible future : campagne **R04** **AUTORISÉE** uniquement (autorisation humaine distincte). Ce document **n’autorise pas** R04-RUNTIME ni toute mutation de rétention.

---

## 0. Ancre 030 (état de référence)

| Élément | Valeur confirmée 030 |
| --- | --- |
| Workflow TEST | `OCD9It1uKFhOoWNF` |
| `workflow.settings.saveDataSuccessExecution` | `none` (**effectif**) |
| `workflow.settings.saveDataErrorExecution` | `none` (**effectif**) |
| `workflow.settings.saveManualExecutions` | `false` |
| Instance `/rest/settings` `saveData*` | `all` / `all` (non suffisant seul) |
| Env `EXECUTIONS_DATA_*` | **absentes** (compose + conteneur) |
| Cause `execution_entity=0` | H1 confirmée : rétention désactivée **au workflow** |

**Implication :** pour une fenêtre d’observabilité R04, le levier utile est un PUT **workflow** temporaire `saveData*=all` (pas un flip instance seul, pas un ajout compose implicite).

---

## 1. Nature du plan

| Attribut | Décision |
| --- | --- |
| Statut | **OPTIONNEL** — R04 peut s’appuyer sur preuves alternatives (PG fingerprint, mock Δ, poll `running`, Mailpit masqué) |
| Périmètre | TEST `govsuite-rec008-test` / n8n publish local uniquement |
| Durée | Fenêtre campagne bornée (1 message R04 + settle + postflight) |
| Rollback | Obligatoire avant clôture mission runtime |
| Exécution 031 | **Interdite** (docs only) |

---

## 2. Prérequis d’autorisation humaine (critères)

Tous les critères suivants doivent être **explicites** dans l’ordre d’exécution runtime futur. Absence d’un critère → **STOP / NO-GO**.

| # | Critère | Exigence |
| --- | --- | --- |
| A1 | Mission runtime dédiée | Identifiant mission distinct de 031 (ex. R04-RUNTIME-xxx) + texte « rétention temporaire **autorisée** » |
| A2 | Cible TEST exclusive | Conteneur / publish `:5682` (ou équivalent TEST documenté) ; `liveTouched=false` ; **zéro** action `govsuite-n8n` |
| A3 | Workflow ciblé | ID exact `OCD9It1uKFhOoWNF` ; VC / SHA Gérer figés en préflight |
| A4 | Backup préalable | Artefact backup settings **écrit et vérifié** avant tout PUT |
| A5 | Fenêtre bornée | Début/fin ; **1** message R04 ; `retried=false` ; pas de retry auto |
| A6 | Contrat redaction | [`REC008_ARTIFACT_REDACTION_CONTRACT.md`](./REC008_ARTIFACT_REDACTION_CONTRACT.md) appliqué ; aucun payload d’exécution committré en clair |
| A7 | Rollback + purge | Restauration `saveData*=none` + procédure purge TEST **dans le même ordre** (ou STOP documenté si purge reportée avec raison) |
| A8 | Non-confusion instance | L’ordre mentionne explicitement que instance=`all` **ne remplace pas** le PUT workflow |
| A9 | Pas de compose | Interdiction d’ajouter `EXECUTIONS_DATA_*` / recreate / prune volume dans la même autorisation sauf mission Docker séparée |
| A10 | R04 gates | Préflight R04 PASS + readiness P1–P11 ; pas d’auto-next R05+ |

**Auth minimale (phrase type) :**  
« J’autorise, sur TEST uniquement, une fenêtre rétention temporaire workflow `OCD9It1uKFhOoWNF` (`saveData*=all`), durée campagne R04-RUNTIME-&lt;id&gt;, avec backup préalable, restauration `none` et purge exécutions TEST en postflight. LIVE interdit. »

Sans cette phrase (ou équivalent non ambigu) → **ne pas appliquer**.

---

## 3. Procédure documentée (non exécutée)

Ordre strict. Chaque étape est **lecture** (L) ou **écriture** (E). Les E restent **interdites** jusqu’à auth A1–A10.

### 3.1 Préflight rétention (L)

1. Confirmer stack TEST Up ; n8n healthz ok ; workflow `active=false` **avant** activation campagne (selon préflight R04).
2. `GET /rest/workflows/OCD9It1uKFhOoWNF` → noter `settings.saveDataSuccessExecution`, `saveDataErrorExecution`, `saveManualExecutions`, `versionId` / updatedAt.
3. Vérifier **baseline** : `saveData*=none` (attendu hors fenêtre). Si déjà `all` sans backup daté → **STOP / UNCERTAIN**.
4. `GET /rest/settings` (instance) → noter `saveData*` (attendu `all` ; ne pas confondre avec workflow).
5. Compter `GET /rest/executions` (filtre workflow) → baseline count (souvent 0).
6. Ne **pas** toucher LIVE ; ne **pas** logger cookies / encryption keys.

### 3.2 Backup settings workflow (E — auth requise)

| Champ | Contenu minimum du backup |
| --- | --- |
| Fichier | Ex. `…/runtime-*/retention-031-backup/workflow-OCD9-settings-pre.json` (hors git si PII ; préférer settings **seuls**) |
| Contenu | `id`, `name`, `versionId`/`updatedAt`, objet `settings` **complet** tel que lu |
| Intégrité | SHA-256 du JSON backup (hex) consigné dans le rapport mission **sans** secrets |
| Règle | Backup = **seule** source de vérité pour restauration ; pas de « mémoire » agent |

### 3.3 Activation fenêtre (E — auth requise)

1. PUT workflow **uniquement** les clés de rétention nécessaires, typiquement :
   - `saveDataSuccessExecution=all`
   - `saveDataErrorExecution=all`
   - (option) `saveManualExecutions=true` **seulement** si la campagne utilise des runs manuels ; sinon laisser `false`
2. **Ne pas** modifier nœuds, connexions, credentials, `active` via ce PUT (activation = étape campagne séparée déjà autorisée R04).
3. Re-GET immédiat → vérifier `saveData*=all` **au workflow**.
4. Consigne : ne pas committer le body de réponse s’il contient données métier ; conserver IDs / flags seulement.

### 3.4 Campagne R04 (hors scope détail 031)

Sous autorisation R04-RUNTIME distincte : 1 message synthétique, preuves métier + éventuellement IDs d’exécution retenus.  
Toute exécution listée peut contenir **PII** (email) → traitement §4 + contrat redaction.

### 3.5 Postflight rétention (E — auth requise, même mission)

Voir §5 et §6 (restauration puis purge). Ordre recommandé : **restaurer `none` d’abord**, puis purge IDs de la fenêtre (réduit nouvelles captures pendant la purge).

---

## 4. Risques PII si `saveData*=all`

| Risque | Détail | Mitigation documentée |
| --- | --- | --- |
| Archive nœud | Inputs/outputs / binary metadata peuvent contenir email synthétique ou réel | Email **synthétique** uniquement ; jamais citoyen |
| UI n8n | Historique visible à tout opérateur TEST | Accès restreint ; fenêtre courte |
| Export / screenshot | Fuite vers chat, ticket, commit | Contrat redaction ; IDs + hash seulement dans rapports |
| sqlite volume | `execution_entity` / `execution_data` persistent jusqu’à purge | Purge postflight obligatoire (§6) |
| Confusion LIVE | Copier procédure sur instance LIVE | STOP explicite ; ports / noms projet distincts |
| Sur-rétention | Oublier restauration `none` | Checklist postflight §5 ; gate clôture = settings == backup |
| Faux sentiment de sécurité | Instance déjà `all` | Rappeler H4 : sans PUT workflow, pas d’archive |

**Verdict risque (plan) :** fenêtre `all` = **High** pour confidentialité locale TEST tant que non purgé ; acceptable **uniquement** sous A1–A10 + redaction.

---

## 5. Restauration settings (postflight)

| Étape | Action | Critère PASS |
| --- | --- | --- |
| R1 | Recharger backup §3.2 | SHA backup inchangé |
| R2 | PUT workflow `settings` → valeurs backup (`saveData*=none`, `saveManualExecutions=false` sauf backup contraire) | Re-GET = backup |
| R3 | Comparer instance `/rest/settings` | Inchangé ou hors scope (ne pas « corriger » instance sans auth) |
| R4 | Consigne rapport | `retentionRestored=true` ; `workflowSaveDataSuccess=none` ; `workflowSaveDataError=none` |

Échec R2 → **FAIL** postflight ; **ne pas** enchaîner R05 ; documenter UNCERTAIN si timeout réseau (**pas** de retry auto).

---

## 6. Purge exécutions TEST (postflight)

**Uniquement** exécutions créées pendant la fenêtre (IDs listés pendant la campagne). Pas de prune volume Docker. Pas de `DELETE` massif non borné sans liste.

| Étape | Action (doc) | Notes |
| --- | --- | --- |
| P1 | Lister IDs fenêtre (filtre workflow + bornes temps / IDs notés) | Lecture API ; pas de dump body |
| P2 | Soft-delete / delete API n8n **par ID** (selon API version 2.32.x documentée en mission runtime) | E — auth |
| P3 | Re-compter executions workflow | Objectif : retour ≈ baseline préflight (souvent 0) |
| P4 | Ne **pas** `docker volume rm` / recreate | Hors procédure 031 |
| P5 | Ne **pas** toucher DB Postgres métier | Empreinte RDV ≠ tables n8n sqlite |

Si purge impossible (API, droits) → **UNCERTAIN** + conserver liste d’IDs + escalade humaine ; settings doivent quand même être restaurés (`none`).

---

## 7. Checklist postflight globale (rétention)

À joindre au postflight R04 si la fenêtre a été ouverte :

- [ ] `saveDataSuccessExecution=none` (workflow)
- [ ] `saveDataErrorExecution=none` (workflow)
- [ ] `saveManualExecutions` = valeur backup
- [ ] SHA settings post == SHA settings backup (ou diff settings = ∅ hors champs horodatés documentés)
- [ ] IDs fenêtre purgés **ou** UNCERTAIN + liste IDs
- [ ] Aucun artefact committré avec email/tél/body exécution
- [ ] `liveTouched=false`
- [ ] Workflow idle / webhooks selon contrat R04 postflight
- [ ] Verdict rétention : **PASS** | **FAIL** | **UNCERTAIN**

---

## 8. Matrice commandes (lecture vs écriture)

### Lecture (L) — autorisable en diag / préflight sans mutation

| Action | Danger |
| --- | --- |
| `docker ps` / `inspect` filtre projet TEST | L (pas de secrets dans logs) |
| `printenv` filtre `EXECUTIONS` dans conteneur TEST | L |
| sqlite readOnly counts | L |
| `GET /healthz`, `/rest/settings`, `/rest/workflows/{id}`, `/rest/executions` | L |
| Calcul SHA backup fichier local | L |

### Écriture (E) — **interdite** sans auth A1–A10

| Action | Danger |
| --- | --- |
| PUT workflow `saveData*` | E |
| PUT / patch settings instance | E |
| Delete / purge executions par ID | E |
| Ajout `EXECUTIONS_DATA_*` + recreate compose | E+STOP (mission Docker séparée) |
| activate / chat / CreateAppointment | E (campagne R04, pas 031) |
| Toute action LIVE `govsuite-n8n` | E+STOP |

---

## 9. Conditions STOP

- Auth humaine incomplète (A1–A10).
- Baseline workflow ≠ `saveData*=none` sans backup daté.
- Divergence TEST/LIVE (mauvais port, mauvais projet Compose, credentials LIVE).
- Tentative de « corriger » via `EXECUTIONS_DATA_*` dans la même foulée non autorisée.
- Timeout / erreur réseau sur PUT → **STOP**, pas de retry automatique ; conserver clé/idempotence opération.
- Détection PII réelle (non synthétique) dans fixtures ou messages → STOP campagne + ne pas ouvrir/élargir rétention.
- Postflight restauration échouée → FAIL ; ne pas clore en PASS.

---

## 10. Lien avec preuves alternatives

Même si ce plan n’est **pas** appliqué, R04 peut rester observable via :

- PG `updated_at` + fingerprint session  
- mock POST/CLAIM Δ = 0  
- poll `running` pendant le message  
- Mailpit (présence / longueur / hash — pas corps PII en clair dans git)  
- `classifyPostflight` / deactivate webhooks  

Le plan 031 est un **amplificateur d’archive nœud**, pas un prérequis métier R04.

---

## 11. Ce que 031 ne fait pas

| Interdit | Statut 031 |
| --- | --- |
| PUT `saveData*` | **Non exécuté** |
| Purge executions | **Non exécuté** |
| Changement Docker / env | **Non exécuté** |
| Activation workflow / chat R04 | **Non exécuté** |
| LIVE | **Non touché** |
| Autorisation implicite R04-RUNTIME | **Non accordée** |

---

## 12. Verdict MISSION 031

| Périmètre | Verdict |
| --- | --- |
| Documentation plan rétention temporaire | **PASS** |
| Exécution / mutation | **Non applicable** (docs only) — volontairement **non faite** |
| Application à R04 | **NO-GO** jusqu’à auth humaine A1–A10 + mission runtime distincte |
| LIVE / Docker / purge immédiate | **NO-GO** |

**Synthèse :** plan optionnel prêt pour une future campagne R04 **autorisée** ; levier = PUT workflow `saveData*=all` temporaire + backup/restauration/`none` + purge IDs TEST ; instance `all` et absence `EXECUTIONS_DATA_*` confirment qu’il ne faut **pas** se fier au seul `/rest/settings` instance.
