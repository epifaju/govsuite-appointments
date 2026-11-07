# Architecture — futur runner runtime REC-008 (séparé de l’offline)

**READINESS-005** (P4G2) + **ASK-PRENOM-READINESS-007** + **TEST-INSTALL-READINESS-009** (FIX-008 install) : documentation + stubs uniquement.  
**Aucune requête HTTP réelle** dans ces missions.

## Séparation

| Couche | Chemin | Rôle |
| --- | --- | --- |
| Offline | `tests/rec008/lib/`, `scripts/run-offline.cjs` | VM jsCode / sims |
| Runtime | `tests/rec008/runtime/` | Campagne TEST autorisée (futur) |

Le runner runtime **ne doit pas** importer de helpers qui appellent automatiquement n8n. Il exige :

1. `AUTHORIZATION` explicite (fichier ou env signé par humain) — **un S0x / une phase à la fois**
2. `TARGET=TEST` vérifié (base URL allowlist `127.0.0.1:5682` ou équivalent documenté)
3. Préflight PASS
4. **Une seule** action `sendMessage`
5. **Aucun retry** automatique
6. Postflight + désactivation obligatoire (même en erreur)
7. Verdict PASS / FAIL / UNCERTAIN

## Modules prévus (non implémentés comme exécuteurs actifs)

```text
tests/rec008/runtime/
  README.md
  ARCHITECTURE.md          ← ce fichier
  PREFLIGHT-P4G2.md
  POSTFLIGHT-P4G2.md
  STOP-CONDITIONS.md
  COMMAND-MATRIX.md
  preflight-p4g2.stub.cjs  ← throw si main
  postflight-p4g2.stub.cjs ← throw si main
  PREFLIGHT-ASK-PRENOM.md
  POSTFLIGHT-ASK-PRENOM.md
  STOP-CONDITIONS-ASK-PRENOM.md
  COMMAND-MATRIX-ASK-PRENOM.md
  preflight-ask-prenom.stub.cjs   ← throw si main
  postflight-ask-prenom.stub.cjs  ← throw si main
  PREFLIGHT-FIX008-INSTALL.md     ← pointeur install-readiness/
  POSTFLIGHT-FIX008-INSTALL.md
  STOP-CONDITIONS-FIX008-INSTALL.md
  COMMAND-MATRIX-FIX008-INSTALL.md
  BACKUP-ROLLBACK-FIX008-INSTALL.md
  preflight-fix008-install.stub.cjs  ← throw si main
  postflight-fix008-install.stub.cjs ← throw si main
  install-fix008.stub.cjs            ← throw si main
  single-action-http.stub.cjs
  compare-before-after.stub.cjs
  report-runtime.stub.cjs
```

Pack install canonique (hors runtime tree) :

```text
n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/install-readiness/
  INSTALL-CHECKLIST.md
  PREFLIGHT.md / POSTFLIGHT.md
  BACKUP-SHA-ROLLBACK.md
  STOP-CONDITIONS.md / COMMAND-MATRIX.md
  *.stub.cjs  ← throw si main
```

### Exécuteur HTTP à action unique

- Entrée : `sessionId`, `chatInput`, `baseUrl` TEST
- Sortie : status, durée, corps (sans secrets)
- Erreurs transport → **UNCERTAIN**, **STOP**, pas de second essai

### PostgreSQL lecture seule

- SELECT templates (voir rapport 005 / agent postgres)
- Jamais UPDATE/INSERT depuis le runner sans mission SQL distincte

### Comparaison avant/après

- Session flags (sans PII)
- Compteurs mock POST/avail/services
- Tentatives ouvertes
- Empreinte LIVE (lecture) + Mailpit

### Journalisation

- Pas de passwords, cookies, tokens, emails/téléphones en clair
- Flags booléens, longueurs, hashes non réversibles

### Rapports

- JSON + Markdown sous `tests/rec008/reports/` (allowlist) ou `n8n/proposed/<date>-rec008-…P4G2…/`
- Champs : assertions A01–A09, SHA VC9, verdict

## Campagne P4G2 (contrat)

Voir `../readiness/R005-p4g2-explicit-resume-assertions.json`.

## Campagne ASK_PRENOM S01–S03 (contrat readiness 007)

Voir `PREFLIGHT-ASK-PRENOM.md` / `POSTFLIGHT-ASK-PRENOM.md`.  
Offline refs : C03 (S01), T02 (S02), T03 renforcé (S03).  
**3 sessions distinctes**, **1 message chacune**, **0 retry**. PASS offline ≠ autorisation runtime.
