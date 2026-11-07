# REC-008 — Index des preuves runtime R01 / R02 / R03

Mission EVIDENCE-OBSERVABILITY-030. **Lecture seule.** Preuves originales **non modifiées**.

Base : `n8n/proposed/2026-11-02-rec008-explicit-resume-fix-008/runtime-013/`

Versions communes : WF `OCD9It1uKFhOoWNF` · VC **10** · Gérer `f75d4984…` · runner `ef79972a…` · FP final `1|14|4|0`

---

## R01 — RUNTIME-024

| Champ | Valeur |
| --- | --- |
| Scénario | Session active ASK_PRENOM + `Camille` → prenom capturé, `ASK_EMAIL` |
| Session | `rec008-runtime013-r01-active` (OPTION A) |
| Messages / retries | **1** / **0** (`retried=false`) |
| Métier | HTTP 200 · `create_appointment_question` · step ASK_EMAIL · prenom len 7 |
| CLAIM / POST Δ | **0** / **0** |
| Postflight | idle · webhooks 0 · running 0 · `safeDeclared=true` |
| Rapport | `docs/recovery/GOVSUITE_MULTIAGENT_R01_RUNTIME_024_REPORT.md` |

### Artefacts (`artifacts-r01-024/`) — SHA-256

| Fichier | SHA-256 |
| --- | --- |
| campaign-result.json | `6818d6da9577efaee04f94c31fb76ac461141d3acb9774b4b89d17fe5f1107d0` |
| preflight.json | `59477f648f484002a2a70d6beacd70e204dc9a91c951785962fbab653160f191` |
| R01-before.json | `12f45b3bd42169821121d933c658d4c73694d929dff7ff98540dc78272125128` |
| R01-after.json | `324b23be0ca64ccf85bc2db5fb1ef20048103ab361084ec8ba9b2a20e3b00636` |
| R01-http.json | `01be286e203f18aa58c73e038d9d4116cd4f7912446039eb7219bf49d3973504` |
| R01-result.json | `10bb3337cec2581aa5097f8d752610595c762913c438e5e38567bc2d9c539416` |
| R01-activate.json | `edc9fdbf7c8bf7b9233ac91cd506385e3a7cc76672a26d1411d1a7218ba20972` |
| R01-ollama-gate.json | `03a8e1030a63de6650f9d18ba89e481326cb451cea9a28b8e0af48a9a4d67974` |
| deactivate-R01-post.json | `b1136f582ade5e076fff617569c5e77eb88df5add7f2f58a0687a8a7b45112eb` |
| safety-postflight-success.json | `3de4acd63d6c174d3719a9eb7233910567a09a14384cb97df31f28a3991e0663` |

**Limites :** 1 pas identité seulement ; TTL pré-refresh SQL ; noms synthétiques en clair dans snaps ; pas de timings nœud n8n.

---

## R02 — RUNTIME-025

| Champ | Valeur |
| --- | --- |
| Scénario | Session expirée ASK_PRENOM + `Camille` → `session_expired`, prenom null |
| Session | `rec008-runtime013-r02-expired` |
| Messages / retries | **1** / **0** |
| Métier | HTTP 200 · type `session_expired` · step ASK_PRENOM · TTL non renew |
| CLAIM / POST Δ | **0** / **0** |
| Postflight | idle |
| Rapport | `…R02_RUNTIME_025_REPORT.md` |

### Artefacts (`artifacts-r02-025/`) — SHA-256

| Fichier | SHA-256 |
| --- | --- |
| campaign-result.json | `299312c41b1be3603cd68e5eb2a58af84facf4bd3d63c03b27c26a24c16d3bff` |
| preflight.json | `538fd7f01ef537bf23f9c0af2769bcee08d7832800a75d147825fdf8dd747209` |
| R02-before.json | `2e13c19184616d17ae1cd88be19becc1baa104e2114177e0dc5aab16700b7c67` |
| R02-after.json | `972fc1b3dc8d36b93dda56e2a79b20841d341808d8c1ccc91ba842821ebbb39d` |
| R02-http.json | `a85728cbf75730f53e1d75a00dfffe67031d312cd91490a28046becabb712936` |
| R02-result.json | `85872080a4d9e537b516c12ac4bcc23373bddf32d6d398bb8b718d5c9e6a6e01` |
| R02-activate.json | `edc9fdbf7c8bf7b9233ac91cd506385e3a7cc76672a26d1411d1a7218ba20972` |
| R02-ollama-gate.json | `b00ef9271b3083c8296a686ea76c307eb4b04ba59656f6e5039bd0a96b3b783d` |
| deactivate-R02-post.json | `656ff419bd09541c7e91ffa9cad364e238415324307cd2851454d9a88ed80abf` |
| safety-postflight-success.json | `3d557d65d636cda350f58129c27a08a1782c99e0cfff4ef733803183b8ad26a6` |

**Limites :** HTTP 200 = refus métier ; `last_user_message` technique ; Δ0 ≠ anti-collision.

---

## R03 — RUNTIME-026

| Champ | Valeur |
| --- | --- |
| Scénario | Expirée + `reprendre` → TTL+, ASK_PRENOM, invite prénom, prenom null |
| Session | `rec008-runtime013-r03-resume` |
| Messages / retries | **1** / **0** |
| Métier | HTTP 200 · `create_appointment_question` · TTL renew · pas `session_expired` |
| CLAIM / POST Δ | **0** / **0** |
| Postflight | idle |
| Rapport | `…R03_RUNTIME_026_REPORT.md` |

### Artefacts (`artifacts-r03-026/`) — SHA-256

| Fichier | SHA-256 |
| --- | --- |
| campaign-result.json | `cfa7cb6be5a48cba0c2d17212a773a6b7ea1ba3bdd8174eda1b8d034752c236f` |
| preflight.json | `07ed4b56de79782a6181217fdc897ce73c1af2bfa481b1862145b9c5a2d6e94c` |
| R03-before.json | `479fb8740e348e7dd7f64b6537c8229def66685dee039d013398cfbbcb8f7d40` |
| R03-after.json | `d1444d9948393ad69b187c455e5c77cd880cc329d57ceec51c2ffcc9769e13d6` |
| R03-http.json | `a5d0c265650f24a22d85a0c95c25fb7ca1bfcf39e1e04bd572701a24f8729eb0` |
| R03-result.json | `16afd7a2070ad527e376618a1af7a97f429e8cbac42c8752036b141c21731115` |
| R03-activate.json | `edc9fdbf7c8bf7b9233ac91cd506385e3a7cc76672a26d1411d1a7218ba20972` |
| R03-ollama-gate.json | `202651ae762147dc8ff1aac541e81092ce8b6b079f38695eaf1ee5fafae15f88` |
| deactivate-R03-post.json | `2bb475de60ca740dc0fe8d1194db5ee576a9ecff77e613c35f450077ae78cfb0` |
| safety-postflight-success.json | `b90a527727f3d003cd8ec830bc40ddedf13608dcb3a65e2895b3e81c70262088` |

**Limites :** allowlist runtime = `reprendre` seul ; intent GENERAL→CREATE documenté.

---

## Preuve vs interprétation

| Déclaration | Statut |
| --- | --- |
| R01–R03 PASS métier TEST | **Preuve** |
| Catalogue ASK_PRENOM clos (028) | **Preuve** docs + runtime |
| CreateAppointment / CLAIM sûrs | **Interprétation abusive** |
| Timings par nœud n8n | **Non disponible** (`execution_entity` vide) |
