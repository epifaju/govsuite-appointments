# Matrice commandes — install TEST FIX-008 (documentation seule)

**Aucune de ces commandes n’est exécutée par TEST-INSTALL-READINESS-009.**  
Les stubs de ce dossier **jettent** s’ils sont invoqués en entrée `main`.

Légende : **L** = lecture / inventaire ; **E** = écriture / mutation (interdit sans ordre humain explicite).

Contrat fenêtre install : **1 PUT max**, **0 retry**, **0 activation**, **0 chat**.

---

## Docker / Compose

| Intent | Classe | Exemple (doc) | Notes |
| --- | --- | --- | --- |
| Lister conteneurs | L | `docker ps` (filtre govsuite / rec008-test) | OK lecture si autorisé plus tard |
| Logs lecture | L | `docker logs --tail` | Pas de secret dans rapports |
| `compose up/down/recreate` | E | — | **Interdit** sans ordre |
| prune / volume rm | E | — | **Interdit** |
| Changer ports / bind mounts | E | — | **Interdit** |

## n8n (API / UI TEST `:5682`)

| Intent | Classe | Notes |
| --- | --- | --- |
| GET workflow / version / SHA | L | Préflight / postflight |
| Liste actifs / webhooks | L | Préflight |
| Export backup JSON | L/E léger | Avant PUT ; documenter chemin |
| PUT candidat `after-…json` | E | **1 fois** si autorisé ; `active=false` |
| PUT rollback `before-…` / backup | E | Ordre **distinct** rollback |
| Activate / deactivate | E | Activate **hors** install ; deactivate si incident |
| Publish / import UI non contrôlé | E | Hors procédure |
| Retry PUT | E | **Toujours interdit** |
| POST chat / webhook métier | E | **Interdit** dans fenêtre install |
| POST CreateAppointment | E | **Toujours interdit** |

## PostgreSQL

| Intent | Classe | Notes |
| --- | --- | --- |
| Counts / fingerprint TEST | L | Ancres pré/post |
| Toute écriture métier / migration | E | **Interdit** |
| Requête LIVE | L/E | **LIVE interdit** |

## Mock / Mailpit

| Intent | Classe | Notes |
| --- | --- | --- |
| Lire compteurs / scenario | L | Pré/post |
| Reset mock / purge Mailpit | E | Hors plan sauf ordre |
| Appels HTTP métier | E | Interdit |

## Scripts locaux (ce dossier)

| Fichier | Classe | Comportement |
| --- | --- | --- |
| `preflight-install.stub.cjs` | — | `throw` si `require.main === module` |
| `postflight-install.stub.cjs` | — | `throw` si main |
| `install.stub.cjs` | — | `throw` si main |
| `rollback.stub.cjs` | — | `throw` si main |
| `*.md` | — | Documentation ; pas d’exécutable |

**Ne pas** réutiliser les `install.js` / `preflight-and-backup.js` P4F historiques sans nouvelle autorisation et relecture STOP (ils appellent Docker + n8n).

## Offline (autorisé hors runtime)

| Intent | Classe | Notes |
| --- | --- | --- |
| `node tests/rec008/scripts/run-fix-008.cjs` | L offline | Valide candidat local ; ≠ install |
| SHA fichiers locaux | L | `SHA256.md` / VALIDATION-STATIC |

Références : `../after-OCD9It1uKFhOoWNF.json`, `../before-OCD9It1uKFhOoWNF.json`, `../SHA256.md`.
