# Matrice commandes — P4G2 (documentation seule)

**Aucune de ces commandes n’est exécutée par READINESS-005.**  
Les stubs sous ce dossier **jettent** s’ils sont invoqués en entrée `main`.

Légende : **L** = lecture / inventaire ; **E** = écriture / mutation / activation (interdit sans ordre humain explicite).

## Docker / Compose

| Intent | Classe | Exemple (doc) | Notes |
| --- | --- | --- | --- |
| Lister conteneurs | L | `docker ps` (filtre govsuite) | OK lecture si autorisé plus tard |
| Logs lecture | L | `docker logs --tail` | Pas de secret dans rapports |
| `compose up/down/recreate` | E | — | **Interdit** sans ordre |
| prune / volume rm | E | — | **Interdit** |
| Changer ports / bind mounts | E | — | **Interdit** |

## n8n (API / UI TEST)

| Intent | Classe | Exemple (doc) | Notes |
| --- | --- | --- | --- |
| GET workflow / version / SHA | L | REST GET workflow | Préflight |
| Liste actifs / webhooks | L | REST / SQL lecture webhook | Préflight |
| Activate / deactivate | E | POST activate/deactivate | Uniquement si autorisé ; deactivate obligatoire en postflight |
| Publish / import / PUT nodes | E | — | Hors P4G2 readiness |
| POST chat `reprendre` | E | 1 message max | Cœur P4G2 — **ordre distinct** |
| Retry chat | E | — | **Toujours interdit** |
| POST CreateAppointment | E | — | **Toujours interdit** dans P4G2 |

## PostgreSQL TEST

| Intent | Classe | Exemple (doc) | Notes |
| --- | --- | --- | --- |
| Counts / fingerprint | L | `SELECT count(*)…` | Ancres pré/post |
| Snap session (flags masqués) | L | lecture `ai_conversation_state` | Pas de PII dans artefacts |
| UPDATE/DELETE/INSERT métier | E | — | **Interdit** |
| Migration / seed | E | — | **Interdit** |
| Toute requête sur LIVE | E/L | — | **LIVE interdit** |

## Mock / Mailpit

| Intent | Classe | Notes |
| --- | --- | --- |
| Lire compteurs / scenario | L | Pré/post |
| Reset mock / purge Mailpit | E | Hors plan P4G2 sauf ordre |
| Appels HTTP métier hors chat | E | Interdit (availability/services/create) |

## Scripts locaux de ce dossier

| Fichier | Classe | Comportement |
| --- | --- | --- |
| `preflight-p4g2.stub.cjs` | — | `throw` si `require.main === module` |
| `postflight-p4g2.stub.cjs` | — | `throw` si `require.main === module` |
| Checklists `.md` | — | Documentation ; pas d’exécutable |

## Backup / restore (hors exécution)

| Intent | Classe | Notes |
| --- | --- | --- |
| Export workflow JSON TEST | L/E léger | Documenter chemin ; ne pas écraser LIVE |
| Restore | E | Uniquement sur ordre ; préflight vert avant rejeu |

Référence d’implémentation historique (ne pas relancer ici) :  
`n8n/proposed/2026-11-01-rec008-phase8f2b49-P4G2-EXPLICIT-RESUME/run.js`.
