# R032 — Exécution tests offline

## Commandes

```text
node tests/rec008/unit/r04-expired-email-fix-032.test.cjs
node tests/rec008/unit/artifact-hygiene-r032.test.cjs
```

## Résultats (régénérés post-alignement SHA)

| Suite | Passed | Failed | Verdict | Patch |
| --- | --- | --- | --- | --- |
| `r04-expired-email-fix-032` | 12 | 0 | **PASS** | **4** remplacements (= candidate `44a7064d…`) |
| `artifact-hygiene-r032` | 8 | 0 | **PASS** | S06/S07/S08/T03 |

Logs : `R032-offline-fix-run.txt`, `R032-offline-hygiene-run.txt`.

Pin vérifié : helper SHA = AFTER.js = candidate Gerer = `44a7064d12755a84dd256acae90abbf67a778178f9947eec3a36dc0c9abcad3f`.

Correctif : **non installé**.
