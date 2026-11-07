# STOP conditions — campagne R04–R07 (documentation)

Fail-fast. **Aucun retry** automatique après timeout, erreur réseau, ou réponse ambiguë.

Mission **SECURITY-POST-R0X-029** : documentation only — **n’exécute rien**.  
Complète `STOP-CONDITIONS-ASK-PRENOM.md` ; ne remplace pas install / P4G2.

Réf. critères : `docs/recovery/REC008_R04_R07_SECURITY_TEST_CRITERIA.md`.

---

## Préflight → STOP

| Code | Condition |
| --- | --- |
| `auth-missing` | Autorisation humaine absente, ambiguë, ou multi-R0x |
| `prep-confused-as-runtime` | PASS docs/offline 029 traité comme GO runtime |
| `test-live-confusion` | Ports / credentials / volumes / URLs LIVE ou mélange |
| `createappointment-unguarded` | CreateAppointment réel planifié (R04–R06) ou non-mock (R07) |
| `mock-not-anchored` | Mock / compteurs hors ancre |
| `open-attempts-unexpected` | Tentatives ouvertes ≠ contrat |
| `target-state-mismatch` | Step / slotId / identité hors profil |
| `pii-fixture-real` | Fixture non synthétique |
| `r07-without-security-go` | R07 sans GO security + mock |
| `ask-prenom-closure-as-create-go` | Clôture ASK_PRENOM 028 utilisée comme GO CREATE |
| `connectivity` | healthz / TCP KO avant message |

## Pendant l’action → STOP

| Code | Condition |
| --- | --- |
| `timeout-or-transport` | Ambigu → **UNCERTAIN**, ne pas renvoyer |
| `second-message` | 2ᵉ message |
| `retry-performed` | Retry automatique |
| `createappointment-post` | POST CreateAppointment sur R04–R06 |
| `createappointment-live` | POST hors `rec008-mock` |
| `claim-on-r04-r06` | CLAIM sur R04–R06 |
| `sql-mutation-extra` | SQL hors plan |
| `cross-scenario-send` | Mauvais `sessionId` |

## Postflight → STOP / non-PASS

| Code | Condition |
| --- | --- |
| `claim-or-post-delta` | R04–R06 : Δ≠0 ; R07 : Δ hors +1/+1 |
| `live-touched` | Isolation LIVE rompue |
| `pii-in-report` | Secret / PII dans artefact |
| `pii-cleartext-email` | Match HYG-E01 (e-mail clair) dans artefact R04+ — voir R030 |
| `pii-cleartext-phone` | Match HYG-T01/T02 (tél clair) dans artefact R04+ |
| `secret-or-token-cleartext` | Match HYG-S01…S05 (Bearer/JWT/clé/mdp) |
| `deactivate-failed` | Non idle après fenêtre |
| `phase-auto-advance` | Auto-next R0(n+1) / LIVE |

## Au STOP

1. Halt ; désactiver si besoin.  
2. Artefact sans PII/secrets.  
3. **FAIL** ou **UNCERTAIN**.  
4. Pas de retry / LIVE / phase suivante.
