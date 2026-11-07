# Matrice commandes — ASK_PRENOM S01–S03 (documentation seule)

**Aucune de ces commandes n’est exécutée par ASK-PRENOM-READINESS-007.**  
Les stubs sous ce dossier **jettent** s’ils sont invoqués en entrée `main`.

Légende : **L** = lecture / inventaire ; **E** = écriture / mutation / activation (interdit sans ordre humain explicite).

Contrat campagne : **1 message par scénario**, **0 retry**, sessions **distinctes**.

| Scénario | sessionId (placeholder) | chatInput | Retry |
| --- | --- | --- | --- |
| S01 | `rec008-ask-prenom-s01` | `Camille` | **0** |
| S02 | `rec008-ask-prenom-s02` | `Camille` | **0** |
| S03 | `rec008-ask-prenom-s03` | `reprendre` | **0** |

Chaque ligne ci-dessus exige sa **propre** autorisation + préflight + postflight.

---

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
| Activate / deactivate | E | POST activate/deactivate | Uniquement si autorisé ; **deactivate obligatoire** en postflight |
| Publish / import / PUT nodes | E | — | Hors readiness ASK_PRENOM |
| POST chat S01 `Camille` | E | 1 message max | Ordre distinct S01 |
| POST chat S02 `Camille` | E | 1 message max | Ordre distinct S02 ; session ≠ S01 |
| POST chat S03 `reprendre` | E | 1 message max | Ordre distinct S03 |
| Retry chat | E | — | **Toujours interdit** |
| Enchaîner S01→S02 sans halt | E | — | **Interdit** |
| POST CreateAppointment | E | — | **Toujours interdit** dans ASK_PRENOM |

## PostgreSQL TEST

| Intent | Classe | Exemple (doc) | Notes |
| --- | --- | --- | --- |
| Counts / fingerprint | L | `SELECT count(*)…` | Ancres pré/post |
| Snap session (flags masqués) | L | lecture `ai_conversation_state` | Pas de PII réelle dans artefacts |
| UPDATE/DELETE/INSERT métier | E | — | **Interdit** (y compris seed session sans ordre) |
| Migration / seed | E | — | **Interdit** sans mission SQL distincte |
| Toute requête sur LIVE | E/L | — | **LIVE interdit** |

## Mock / Mailpit

| Intent | Classe | Notes |
| --- | --- | --- |
| Lire compteurs / scenario | L | Pré/post |
| Reset mock / purge Mailpit | E | Hors plan sauf ordre |
| Appels HTTP métier hors chat | E | Interdit (availability/services/create) |

## Scripts locaux de ce dossier (ASK_PRENOM)

| Fichier | Classe | Comportement |
| --- | --- | --- |
| `preflight-ask-prenom.stub.cjs` | — | `throw` si `require.main === module` |
| `postflight-ask-prenom.stub.cjs` | — | `throw` si `require.main === module` |
| `PREFLIGHT-ASK-PRENOM.md` | — | Documentation ; pas d’exécutable |
| `POSTFLIGHT-ASK-PRENOM.md` | — | Documentation |
| `STOP-CONDITIONS-ASK-PRENOM.md` | — | Documentation |
| `COMMAND-MATRIX-ASK-PRENOM.md` | — | Ce fichier |

Stubs génériques (`single-action-http.stub.cjs`, etc.) restent non exécutants (throw main).

## Backup / restore (hors exécution)

| Intent | Classe | Notes |
| --- | --- | --- |
| Export workflow JSON TEST | L/E léger | Documenter chemin ; ne pas écraser LIVE |
| Restore | E | Uniquement sur ordre ; préflight vert avant rejeu |

Références offline (ne pas confondre avec runtime) :  
`tests/rec008/scenarios/conversational/C03-ask-prenom.json`,  
`tests/rec008/scenarios/ttl/T02-ask-prenom-after-ttl-routing.json`,  
`tests/rec008/scenarios/ttl/T03-explicit-resume.json`.
