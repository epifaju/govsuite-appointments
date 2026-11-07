# TEST-STACK-RECOVERY-011 — Safety checks

## Verdict

| Champ | Valeur |
| --- | --- |
| Verdict | **PASS** |
| Décision | **GO** `docker start` (4 conteneurs TEST nommés) |
| Scope | Reprise conteneurs Exited(255) uniquement |
| LIVE | Non touché |

## Checklist préflight (lecture)

| # | Contrôle | Résultat | STOP si |
| --- | --- | --- | --- |
| 1 | Docker Server joignable (29.8.0) | OK | daemon down / version inconnue |
| 2 | Projet = `govsuite-rec008-test` | OK | autre projet / labels LIVE |
| 3 | Config attendue 8E-2B-4 OLLAMA-TEST | OK (référence parent + volumes/réseaux cohérents) | recreate involontaire |
| 4 | Exit 255 simultané, OOM=false, Error vide | OK | Exit ≠ 255 ou OOM ou Error applicative |
| 5 | Volumes TEST présents (pg/n8n/ollama) | OK | volume manquant |
| 6 | Réseaux `rec008_test` + `rec008_publish` | OK | réseau manquant |
| 7 | Bind mounts mock/publish fichiers présents | OK | path manquant → NO-GO start |
| 8 | Port hôte **5682** libre (netstat vide) | OK | autre process écoute 5682 |
| 9 | `govsuite-n8n` / `govsuite-postgres` Up, hors cible | OK | confusion ports / start LIVE |
| 10 | ollama Up — ne pas stopper | OK | start ollama non requis |

## GO autorisé

Ordre strict, noms exacts uniquement :

1. `docker start govsuite-rec008-test-rec008-postgres-1`
2. `docker start govsuite-rec008-test-rec008-mock-1`
3. Attendre `pg_isready -U postgres -d govsuite_rec008_test` **dans** le conteneur postgres (fail-fast, **pas de retry réseau HTTP**)
4. `docker start govsuite-rec008-test-rec008-n8n-1`
5. `docker start govsuite-rec008-test-rec008-publish-1`
6. Post-check : `docker ps` filtre projet + `curl` `http://127.0.0.1:5682/healthz` si exposé

## Interdits (NO-GO immédiat)

- `docker compose down` / `up --force-recreate` / `prune`
- Mutation / suppression volumes
- Tout conteneur hors des 4 noms ci-dessus (dont `govsuite-n8n`, `govsuite-postgres`, ollama)
- LIVE, PUT n8n, activation workflow, POST CreateAppointment
- Retry automatique après timeout/erreur réseau ambiguë → **UNCERTAIN** + STOP

## Matrice commandes

| Commande | Classe | Autorisée 011 |
| --- | --- | --- |
| `docker ps` / `inspect` / `volume ls` / `network ls` / `version` | Lecture | Oui |
| `netstat` / `curl` healthz local 5682 | Lecture | Oui |
| `docker start` (4 noms exacts) | Écriture minimale | Oui si GO |
| `docker exec … pg_isready` (postgres TEST) | Lecture runtime | Oui (attente health) |
| `docker stop` / `rm` / `compose down` | Destructif | Non |
| `docker compose up` / recreate | Mutate stack | Non |
| Touch LIVE | Hors périmètre | Non |

## Conditions STOP post-start

- Un des 4 conteneurs ne passe pas à `running`
- `pg_isready` échoue de façon claire (postgres down) → STOP, ne pas start n8n/publish
- Port 5682 toujours inaccessible après publish Up → **UNCERTAIN** (pas de retry compose)
- Tout conteneur LIVE change d’état → FAIL isolation

## Décision

**GO** — cause probable kill daemon ; artefacts intactes ; port libre ; isolation LIVE OK. Exécution `docker start` ordonnée autorisée.

## Post-exécution

| Contrôle | Résultat |
| --- | --- |
| 4× `docker start` | OK (exit 0) |
| `pg_isready` | accepting connections |
| Conteneurs TEST | postgres healthy ; mock/n8n/publish Up |
| LIVE `govsuite-n8n` / `govsuite-postgres` | inchangés |
| `curl http://127.0.0.1:5682/healthz` | HTTP **200** `{"status":"ok"}` |
| Verdict final | **PASS** |

Voir `COMMANDS.json` et `POSTCHECK.json`.
