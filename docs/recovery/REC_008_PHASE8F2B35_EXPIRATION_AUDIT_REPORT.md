# REC-008 phase 8F-2B35 — Audit tentative expirée et stratégie de reprise

Audit **lecture seule** : pourquoi `57bf7de8-…` reste `AWAITING_CONFIRMATION` après expiration temporelle, et comment reprendre proprement les tests de confirmation positive.

**Aucune** activation, message, PUT, mutation SQL, CLAIM, POST, ni appel de `expirer_tentatives_en_attente`.

Verdict audit : **PASS**  
GO/NO-GO phase corrective distincte : **GO** (option **A** recommandée)

Artefacts : `n8n/proposed/2026-10-31-rec008-phase8f2b35-EXPIRATION-AUDIT/`  
(`PREFLIGHT.json`, `RESULT.json`, `audit.js`)

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow `OCD9It1uKFhOoWNF` | inactif, `activeVersionId = null` |
| Version / compteur | `e1b32992-…` / **8** |
| Graphe / Finaliser | 134 / 137 ; SHA `3fc500bf…` |
| Autres actifs / credentials / URL / réseau | 0 / TEST / 10 mock / OK |
| PostgreSQL TEST | **1 / 9 / 3 / 0** ; **1** ouverte (temporellement expirée) |
| Historique | CONFIRMED `ad71a155-…` + ABANDONED `8ae63b62-…` inchangés |
| Mock (nouvelle référence post-restart) | scénario `created` ; total **0** ; POST **0** ; GET availability **0** |
| LIVE / Mailpit | `a2dea067…` ; 5 / 2 / 98 304 |

Préflight **OK**.

## 2. Diagnostic de la tentative expirée

| Champ | Valeur (sans secrets) |
| --- | --- |
| Id | `57bf7de8-9a5e-469d-858a-a6bd389223e6` |
| Session | `rec008-8f2b28-new-01` |
| Statut | **`AWAITING_CONFIRMATION`** |
| Créée | `2026-10-31 22:30:40+01` (phase 8F-2B33) |
| TTL à la création | **7200 s** (2 h) |
| `expires_at` | `2026-11-01 00:30:40.55687+01` |
| `clock_timestamp()` TEST | `2026-11-01 11:52:59+01` |
| Écoulé depuis expiration | **≈ 40 939 s** (~11,4 h) |
| Clé / corps / empreinte | présents (long. clé 71 ; fp12 clé `3864497c21f6` ; fp12 corps `81bd3c88c8e5`) |
| Lease / référence / appointment_id / submitted / confirmed | absents |
| Session liée | `AWAIT_CREATE_CONFIRMATION` / `CREATE_APPOINTMENT` ; collecte encore peuplée |

**Cause racine :** l’échéance `expires_at` est purement temporelle. Le statut SQL **ne bascule pas tout seul**. Sans exécution de `expirer_tentatives_en_attente()` (branche n8n `EXPIRE`), la ligne reste `AWAITING_CONFIRMATION` avec secrets non purgés, tout en bloquant `uq_ai_appointment_attempt_session_ouverte` pour cette session.

Absence de POST associé à cette tentative : mock distinctKeys = 0 ; tentative sans `submitted_at` ; historique POST métier antérieur (8F-2B20) concerne `ad71a155-…` / `REC008-MOCK-0001`, pas cette clé.

## 3. Analyse du SQL d’expiration

Fonction installée TEST : `public.expirer_tentatives_en_attente()` (digest `d4d3f80a…`, conforme migration `20261030_rec008_attempts.sql`).

| # | Question | Réponse |
| --- | --- | --- |
| 1 | Condition de sélection | `status = 'AWAITING_CONFIRMATION' AND expires_at <= clock_timestamp()` |
| 2 | Statuts modifiables | **uniquement** `AWAITING_CONFIRMATION` (commentaire : n’efface ni SUBMITTING ni UNCERTAIN) |
| 3 | Statut final | **`EXPIRED`** |
| 4 | Purge clé / corps | **oui** (`idempotency_key` / `request_payload` → NULL) |
| 5 | Nettoyage leases | **oui** (`lease_owner` / `lease_until` → NULL) |
| 6 | Touche `ai_conversation_state` ? | **non** (fonction SQL seule) |
| 7 | Appel automatique ? | **non** en base (pas de trigger / cron PG observé) |
| 8 | Scheduler n8n ? | **non** — seul déclencheur = Chat Trigger ; nœud `Expirer tentatives en attente` uniquement via aiguillage `attemptAction = EXPIRE` |
| 9 | Double exécution | 2ᵉ appel : **0** ligne (déjà `EXPIRED`) ; idempotent |
| 10 | Effet hors cible | **oui potentiel** : aucun filtre `session_id` / `id` — expire **toutes** les `AWAITING_CONFIRMATION` échues. Ici : une seule candidate |

Compléments CLAIM / reprise (non exécutés) :

- `reclamer_tentative_rendez_vous` exige `expires_at > clock_timestamp()` → **CLAIM impossible** sur la tentative actuelle.
- `reprendre_tentative_rendez_vous` ne cible que `UNCERTAIN` ou `SUBMITTING` à bail échu → **hors scope**.

## 4. Analyse de l’appel automatique éventuel

Chemin n8n officiel (workflow VC8) :

`Décider action tentative` → si `AWAITING_CONFIRMATION` **et** `waitExpired` → `attemptAction = EXPIRE`  
→ `Aiguiller tentative` (sortie EXPIRE) → **`Expirer tentatives en attente`** (`SELECT public.expirer_tentatives_en_attente()`)  
→ **`Effacer collecte expirée`** (nettoie pending / step / identité ; service/site/dates/slots selon `modifyField`)  
→ **`Réponse attente expirée`** (`type = create_expired`).

Sans message chat (workflow inactif depuis 8F-2B33), ce chemin **n’a jamais tourné** → statut figé.

## 5. Analyse du comportement d’un `oui` tardif

Simulation hors ligne (code réel `Décider action tentative`) :

1. `waitExpired = true` prioritaire sur `decision === 'AFFIRM'`.
2. Action résultante : **`EXPIRE`**, pas `CLAIM`.
3. Branche CLAIM / `Appeler CreateAppointment` **non atteinte**.
4. Même si CLAIM était forcé, SQL `reclamer_…` refuserait (`acquired = false`).
5. Réponse conversationnelle prévue : *« La demande en attente a expiré… Vous pouvez recommencer la collecte. »* (`create_expired`).
6. Effet collatéral d’un futur `oui` autorisé : expiration globale des attentes échues + nettoyage session courante — **pas** de création RDV.

Nouvelle demande / nouvelle tentative :

- Sur **même** session tant que le statut reste ouvert (`AWAITING_CONFIRMATION`) : index `uq_ai_appointment_attempt_session_ouverte` **bloque** un second INSERT ouvert.
- Après passage officiel à `EXPIRED` : index libéré → INSERT possible avec **nouvelle** clé.
- Réutilisation de la tentative périmée / clé historique : **exclue** (CLAIM refusé ; unicité clé ; purge à l’expiration).

## 6. Vérification des risques de doublon

| Risque | Évaluation |
| --- | --- |
| Double POST via `oui` tardif | **nul** (EXPIRE avant CLAIM ; CLAIM SQL bloqué) |
| Double tentative ouverte même session | bloqué par index unique session ouverte |
| Collision clé d’idempotence | bloquée tant que clé non NULL ; après EXPIRED la clé est purgée |
| Option B sans expiration | nouvelle **session** possible, mais **zombie** `AWAITING_CONFIRMATION` + secrets non purgés + compteur « ouvertes » = 1 |
| `expirer_tentatives_en_attente()` large | aujourd’hui 1 seule cible ; documenter le scan global pour toute phase future |

## 7. Comparaison des options de reprise

| Critère | **A** — mécanisme officiel d’expiration | **B** — nouvelle session / nouvelle tentative sans expirer |
| --- | --- | --- |
| Sécurité / privacy | Purge clé + corps ; statut `EXPIRED` | Secrets restent sur la ligne zombie |
| Isolation | Chemin n8n prévu + nettoyage collecte | Laisse un état ouvert incohérent |
| Doublon POST | Aucun | Aucun immédiat, mais historique sale |
| Unicité | Libère l’index session ouverte | Contournée via autre `session_id` seulement |
| Étapes | 1 phase expire (+ vérifs) puis nouvelle collecte | Collecte complète d’emblée, dette technique |
| Validation | Alignée REC-008 / 8F-2B34 | Moins représentative du cycle de vie |
| Historique | Conserve ABANDONED / CONFIRMED ; ajoute EXPIRED | Conserve aussi un faux « ouvert » |

## 8. Procédure recommandée

**Recommandation : Option A**, puis nouvelle collecte sous autorisations distinctes.

Préconditions futures (à ne **pas** exécuter ici) :

1. Workflow TEST toujours inactif hors fenêtre contrôlée ; VC8 / Finaliser SHA inchangés.
2. Confirmer qu’il n’existe toujours qu’**une** `AWAITING_CONFIRMATION` échue (sinon lister les IDs avant appel global).
3. Phase corrective autorisée pour déclencher **une fois** le chemin officiel `EXPIRE` (message contrôlé sur `rec008-8f2b28-new-01` **ou** équivalent documenté : appel unique `expirer_tentatives_en_attente()` + nettoyage session aligné nœud `Effacer collecte expirée`).
4. Vérifier : tentative `57bf7de8-…` → `EXPIRED` ; clé/corps NULL ; 0 ouverte ; session nettoyée ; LIVE/Mailpit inchangés ; mock inchangé.
5. Phase ultérieure : **nouvelle** session conversationnelle TEST + parcours jusqu’à `AWAITING_CONFIRMATION` valide (nouvelle clé), puis confirmation positive `oui` (reprise de l’objectif 8F-2B34).

Ne pas prolonger le TTL. Ne pas réutiliser la clé `3864497c21f6…`. Ne pas muter LIVE.

## 9. Contrôles d’intégrité

| Contrôle | Avant = Après |
| --- | --- |
| Workflow inactif / aucun PUT | oui |
| PG `1\|9\|3\|0` / ouverte = 1 | oui |
| Empreintes session cible / tentatives / RDV / autres sessions | identiques |
| GovSuite / Mailpit | identiques |
| Mock total/POST | 0 / 0 |
| CLAIM / POST / chat / e-mail / nouvelle tentative | **aucun** |

## 10. Verdict

**PASS** (audit lecture seule complet ; intégrité préservée).

## 11. GO/NO-GO

| Suite | Décision |
| --- | --- |
| Phase corrective Option A (expiration officielle) | **GO** sous autorisation distincte |
| Confirmation positive immédiate sur `57bf7de8-…` | **NO-GO** |
| Option B seule (nouvelle session sans expirer) | **NO-GO** recommandé (dette zombie / secrets) |

Arrêt ici. Attendre une autorisation distincte.
