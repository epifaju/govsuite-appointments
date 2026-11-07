# Préflight install TEST FIX-008 — non exécuté (mission 009)

Aligné sur P4F `PREFLIGHT.json` + ASK-PRENOM préflight commun.  
**STOP** dès le premier écart. **0 retry** réseau.

## Ancres attendues (documentation — à re-mesurer sous autorisation)

| Contrôle | Attendu (réf. post-P4F / VC9) |
| --- | --- |
| Base URL | `http://127.0.0.1:5682` |
| Workflow id | `OCD9It1uKFhOoWNF` |
| `active` | `false` |
| `activeVersionId` | `null` |
| Autres actifs | aucun |
| Webhooks actifs | 0 |
| `versionId` | `e7867799-2a18-4aec-9ee5-3ba9cbc40766` |
| `versionCounter` | `9` |
| Nodes / edges | 134 / 137 |
| Export fichier SHA | `6284f867054879d00292b45b5a8560f25dc778a56979ea354b18af2f5f82b889` |
| Gérer parameters SHA (VC9) | `5bc5b967c71e219c88f1bfc6f8c2a70b7ef2e79d2a56475733650c0d20855e6e` |
| Finaliser SHA | `3fc500bfed99c202156005d252a864cdc25514c93e7e47c842ae896381e8ee7a` |
| URLs HTTP nœuds | uniquement `http://rec008-mock:8080/…` |
| Credential Postgres | id TEST documenté (ex. historique `Fs0l0058…`) — pas LIVE |
| Open attempts | `0` |
| Mock POST create / avail / services | ancrés (idéalement 0 delta planifié) |
| Empreinte LIVE | lecture seule = ancre historique ; **ne pas « corriger » LIVE** |
| Mailpit | ancre messages/unread/dbSize |
| Network isolation | ports LIVE non joignables depuis n8n TEST |

## Checklist opératoire (future)

1. Confirmer autorisation install **uniquement**.
2. GET workflow + version + actifs + webhooks (lecture).
3. Comparer SHA export / nœuds critiques vs tableau.
4. Lecture PG TEST counts + open attempts (SELECT only).
5. Lecture mock `_meta` + Mailpit (si autorisé).
6. Lecture empreinte LIVE (ancre) — **jamais** de mutation.
7. Probe isolation (doc P4F `net-probe` pattern) — fail-fast, pas de boucle.
8. Écrire artefact `PREFLIGHT.json` local (sans secrets).
9. Si tout OK → `preflightOk=true` ; sinon `STOP.json` + halt.

## Hors préflight install

- Seed / UPDATE sessions
- Activation
- Chat webhook POST
- Relance après timeout
