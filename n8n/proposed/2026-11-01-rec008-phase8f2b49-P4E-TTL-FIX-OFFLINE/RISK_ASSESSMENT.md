# Risk assessment — 8F-2B49-P4E (correctifs proposés, non installés)

## 1. Synthèse

| Domaine | Niveau | Commentaire |
| --- | --- | --- |
| Double réservation | Faible | Aucun chemin CLAIM/POST ajouté hors AFFIRM actif |
| Confirmation contournée | Faible | `oui` sur session expirée → GENERAL, pas AFFIRM |
| Purge brouillon | Réduit vs VC8 | Fix C refuse les NULL non autorisés |
| UX session expirée | Moyen | L’utilisateur doit écrire « reprendre » ; possible friction |
| Régression GET_SERVICES | Moyen | Verrou CREATE en collecte active ; allowlist commandes |
| LIVE | Nul (si discipline) | Patch TEST only |
| UNCERTAIN | Faible | RESUME replay only, pas de nouvelle clé |

## 2. Analyse de sécurité (exigences §7)

| Exigence | Statut proposition |
| --- | --- |
| Ne contourne pas la confirmation explicite | OK — AFFIRM seulement si session+tentative actives |
| Aucun POST depuis session expirée | OK — `claimOrPost=false` ; AWAITING expiré → expireAttempt |
| Aucune réutilisation de clé terminale | OK — EXPIRED/ABANDONED/REJECTED → `reuseIdempotencyKey=false` |
| `non` ≠ confirmation | OK — NEGATIVE / abandon |
| UNCERTAIN inchangé (replay) | OK — createDecision=RESUME, pas INSERT |
| Pas de double réservation | OK — pas de nouveau CLAIM implicite |
| Workflows LIVE non modifiés | OK — hors périmètre |

## 3. Risques de régression

| Risque | Mitigation |
| --- | --- |
| Bloquer un vrai GET_SERVICES pendant ASK_PRENOM | Allowlist explicite ; hors collecte le LLM reste libre |
| Reprise « reprendre » trop large | Liste fermée de messages entiers (strip accents) |
| Fix C empêche une purge légitime via Sauvegarder | `_authorizedNulls` + nœuds UPDATE dédiés existants |
| TTL exact `expires_at = NOW()` | Traité comme expiré (`<=`), aligné SQL proposé |
| Compteurs mock remis à zéro après restart Docker | Documenté ; ancrer les deltas après install future |
| Message d’expiration trop générique | Texte public sans flags techniques ; type `session_expired` |

## 4. Risques d’installation (phase future)

- PUT n8n mal ciblé (mauvais workflow) → checklist ID `OCD9It1uKFhOoWNF` + inactive avant/après.
- Activation accidentelle → interdite sans autorisation chat.
- Oublier Fix C en n’installant que A+B → brouillon encore effaçable si GENERAL émet des nulls.

## 5. Décision risque pour GO/NO-GO install TEST

Risque résiduel **acceptable pour une installation TEST ultérieure sous autorisation distincte**, après reconstruction contrôlée d’une session CONV-07.  
**NO-GO** pour LIVE et pour tout chat tant que non autorisé.
