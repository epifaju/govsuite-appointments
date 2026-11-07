# R04-PREP-030 — Verdict QA (hygiene artefacts + critères prep)

**Verdict : PASS** (docs only — spécification tests FAIL + critères R04-PREP)  
**Scanner offline : non exécuté (R04P-10 OPEN)**  
**R04-RUNTIME / R05–R07 / LIVE / auto-next : NO-GO**

Mode : **docs only** — aucune exécution, aucune activation, aucune mutation.

---

## Livrables

| Artefact | Chemin |
| --- | --- |
| Spec | `docs/recovery/REC008_R04_PREP_ARTIFACT_HYGIENE_TESTS.md` |
| Catalogue patterns | `tests/rec008/readiness/R030-r04-prep-artifact-hygiene.json` |

---

## Tests automatisés (spécifiés)

FAIL si artefact **nouveau** (R04+ / reports post-baseline) matche :

| ID | Classe | STOP |
| --- | --- | --- |
| HYG-E01 | e-mail clair | `pii-cleartext-email` |
| HYG-T01/T02 | tél clair | `pii-cleartext-phone` |
| HYG-S01…S05 | Bearer / JWT / api_key / password / cookie | `secret-or-token-cleartext` |

Autorisé : `*Present` / `*Len` / `*IsNull` / `*Hash` / `sessionIdHash` / `runToken`.  
Fixtures synthétiques : allowlist `fixtures/**` uniquement — **pas** dans rapports.

Scénarios H-01…H-09 : catalogue JSON. Commande future (non lancée) :

```text
node tests/rec008/unit/artifact-hygiene-r030.test.cjs
```

---

## Critères R04-PREP

| ID | Statut |
| --- | --- |
| R04P-01…R04P-09 | **PASS** (docs) |
| R04P-10 scanner | **OPEN** |
| R04P-11 runtime | **NO-GO** |

R04-PREP global : **GO-CONDITIONAL** (bloqué sur outillage scanner, pas sur runtime).

---

## Critères d’arrêt

- Match clair → **FAIL** (pas UNCERTAIN sauf fichier illisible).
- Aucun retry.
- FAIL hygiene ≠ confusion TEST/LIVE.
- PASS docs 030 ≠ GO R04-RUNTIME.

---

## Décision

| Gate | Issue |
| --- | --- |
| Mission docs 030 (QA hygiene) | **PASS** |
| R04-PREP | **GO-CONDITIONAL** |
| R04-RUNTIME | **NO-GO** |
| LIVE / auto-next | **NO-GO** |
