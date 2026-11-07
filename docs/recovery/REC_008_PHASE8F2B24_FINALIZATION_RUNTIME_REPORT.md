# REC-008 phase 8F-2B24 — Validation runtime isolée du binding `$3`

Méthode A (session synthétique + exécution n8n isolée du nœud `Finaliser état création`). Aucun chatbot, CLAIM, POST CreateAppointment, ni PUT sur le workflow principal.

Verdict : **FAIL** (mécanisme isolé **prouvé** ; correctif installé **insuffisant** en runtime réel).

Artefacts : `n8n/proposed/2026-10-31-rec008-phase8f2b24-FINALIZATION-RUNTIME/`  
(`MECHANISM.json`, `A1.json`, `A2.json`, `PROPOSED_FIX_NON_PUBLIE.json`, `RESULT.json`, exécutions flattées).

## 1. Préflight

| Contrôle | Résultat |
| --- | --- |
| Workflow principal | inactif, `activeVersionId = null` |
| Version / compteur | `32f405ee-…` / **7** |
| Graphe | 134 / 137 |
| Finaliser SHA | `dfeaf3a4…` |
| PostgreSQL | 1 / 8 / 2 / 0 |
| Mock POST | 1 |
| LIVE / Mailpit | inchangés |

## 2. Mécanisme d’exécution isolée

| Élément | Détail |
| --- | --- |
| Approche | Workflow **éphémère inactif** (Manual Trigger + Code stubs aux noms exacts + Postgres Finaliser) |
| SQL / credential | **copie exacte** du nœud installé (`Fs0l0058q5CEadRw`) |
| Exécution | `POST /rest/workflows/{id}/run` avec `ManualRunDto` |
| Payload | `triggerToStartFrom: { name: 'Manual Trigger' }`, `destinationNode: { nodeName: 'Finaliser état création', mode: 'inclusive' }` |
| Principal OCD9… | **aucun PUT**, non activé |
| psql seul | **non** utilisé pour évaluer `queryReplacement` |

## 3. Preuve d’évaluation n8n réelle

Exécution dry `26` : nœuds Code → Finaliser exécutés ; requête installée journalisée ; erreur PostgreSQL **`there is no parameter $3`** malgré `\|\| ''` dans `queryReplacement`. Les expressions `$('…')` ont donc été résolues ; le 3ᵉ segment vide est **omis** par le binding `queryReplacement` du nœud Postgres n8n.

## 4. Session synthétique

`rec008-8f2b24-runtime-01` créée (9ᵉ session), sans tentative ni rendez-vous. Distincte des 8 historiques.

## 5. A1 — Token absent

| Attendu (mission) | Observé |
| --- | --- |
| Succès PG, `$3` lié, token NULL | **`there is no parameter $3`** |
| Session nettoyée + référence | **inchangée** (UPDATE non appliqué) |
| CLAIM / POST | absents |

Diagnostic : `\|\| ''` produit une chaîne vide → segment `queryReplacement` droppé → `$3` absent.

## 6. A2 — Token présent

Jeton mission `TEST-TOKEN-NON-SECRET-002` mappé en UUID synthétique `22222222-2222-4222-8222-222222222222` (colonne `token` = **uuid**).

| Attendu | Observé |
| --- | --- |
| `$3` lié | oui (plus d’erreur `$3`) |
| Succès + token conservé | **FAIL** : `column "token" is of type uuid but expression is of type text` |
| Cause | `token = NULLIF($3::text, '')` reste typé **text** ; pas de cast `::uuid` |

## 7. Paramètres SQL effectivement liés

| Scénario | `$1` | `$2` | `$3` |
| --- | --- | --- | --- |
| A1 | évalué | évalué | **non lié** (segment vide omis) |
| A2 | évalué | évalué | lié (UUID texte) puis échec de typage à l’affectation |

## 8–10. Intégrité

Après A1/A2 : tentatives CONFIRMED/ABANDONED inchangées ; session réelle `rec008-8f2b14-new-01` inchangée ; 0 nouveau POST ; LIVE/Mailpit inchangés ; aucun CLAIM.

## 11. Nettoyage

`DELETE … WHERE session_id = 'rec008-8f2b24-runtime-01'` uniquement. Compteurs revenus à `1|8|2|0`. Workflows éphémères archivés/supprimés.

## 12. Postflight

Principal : inactif, compteur **7**, Finaliser SHA inchangé, graphe 134/137. PG / mock / LIVE / Mailpit OK.

## 13. Verdict

**FAIL**

Le runtime isolé fonctionne et invalide le correctif 8F-2B21/22 pour le cas nominal sans token. Deux défauts :

1. Segment vide → `$3` omis.
2. `NULLIF(…)::text` incompatible avec colonne `uuid` sans cast.

Proposition **NON PUBLIÉE** (pas de PUT) : sentinelle non vide `__ABSENT__` +  
`token = NULLIF(NULLIF($3::text, ''), '__ABSENT__')::uuid`  
→ `PROPOSED_FIX_NON_PUBLIE.json`.

## 14. GO / NO-GO réconciliation

**NO-GO** pour réconcilier `rec008-8f2b14-new-01` tant qu’un correctif Finaliser runtime-valide n’est pas installé sous autorisation distincte.

S’arrêter ici.
