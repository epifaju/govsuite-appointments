# R01 — Contrat métier (PRD §6.2) — préparation 021

**Aucune campagne exécutée dans 021. Aucun refresh TTL ici.**

## Fixture attendue (avant message)

| Champ | Attendu |
| --- | --- |
| `session_id` | `rec008-runtime013-r01-active` |
| `conversation_step` | `ASK_PRENOM` |
| `pending_action` | `CREATE_APPOINTMENT` |
| `slot_id` | UUID synthétique présent |
| `available_slots` | longueur ≥ 1 |
| `nom` | présent (synthétique) |
| `prenom` | `NULL` |
| `last_user_message` | vide / null |
| TTL | actif (`expires_at > NOW()`) — **réalignement TTL uniquement en campagne autorisée** |

Ancrage fixtures : realign-019 / `SEED.sql` OPTION A.

## Message unique

- Texte : `Camille`
- Exactement **1** POST chat
- **`retried: false`** toujours
- Aucun CLAIM / CreateAppointment

## Attendu après traitement réussi

| Champ | Attendu |
| --- | --- |
| `prenom` | `Camille` |
| `conversation_step` | `ASK_EMAIL` |
| `nom` | inchangé |
| `pending_action` | `CREATE_APPOINTMENT` |
| Pas de `session_expired` | |

## Hors 021

- Refresh TTL R01
- Activation workflow / chat
- Warm Ollama réel
