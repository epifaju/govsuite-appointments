# Matrice couverture R01–R04 — Missions 032 / 033 (offline)

Correctif candidat W-031-01 : **non installé**. Aucun runtime.

| ID | Scénario | Base FIX-008 | Patched / candidat exact | Notes |
| --- | --- | --- | --- | --- |
| R04-A | Email valide actif → ASK_TELEPHONE | — | **PASS** (032 + 033) | Δ0 |
| R04-B | Email invalide → ASK_EMAIL | — | **PASS** (032 + 033) | Δ0 |
| R04-C | Email valide + expired → pas capture | **FAIL** (leak) | **PASS** strict (032 + 033) | save sim email null |
| R04-D | Expired + reprendre | — | **PASS** (032 + 033) | TTL+ ; email null |
| R04-E | Email préexistant + msg non-email | — | **PASS** (032 + 033) | préservé |
| R04-F | Expired ASK_TELEPHONE + tél | — | **PASS** (032 + 033) | tel non capturé |
| R01 | ASK_PRENOM actif Camille | VC9 **PASS** (032) | **PASS** candidat exact (033) | lacune 032 fermée |
| R02 | ASK_PRENOM expired Camille | VC9 **PASS** (032) | **PASS** candidat exact (033) | lacune 032 fermée |
| R03 | FIX-008 S03 reprendre | FIX-008 **PASS** | **PASS** + allowlist (032 + 033) | |

Scanner : H-01…H-09 (030) + S06/S07/S08/T03 (032 + 033) **PASS**.

| Mission | Artefact WF | R01/R02 | Suite |
| --- | --- | --- | --- |
| 032 | `applyW03101ToWorkflow(install-012)` | VC9 harness seulement | `r04-expired-email-fix-032` |
| 033 | `diag-032/…W03101-candidate.json` pin `44a7064d…` | **candidat exact** | `w03101-install-readiness-033` |

Correctif candidat : **4** remplacements identité non-resume (`44a7064d…`) — non installé.

Gates : offline **PASS** ≠ install TEST / R04-RUNTIME / LIVE (**NO-GO**).
