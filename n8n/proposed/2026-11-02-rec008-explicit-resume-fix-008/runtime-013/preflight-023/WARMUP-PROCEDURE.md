# Procédure warm-up Ollama — future campagne R01 (pas exécutée en 023)

## Prérequis

- Stack TEST Up ; n8n joignable ; DNS `rec008-ollama:11434` depuis n8n.
- Modèle listé : `GET /api/tags` → `qwen2.5:1.5b`.
- **Aucune** campagne chat tant que le gate échoue.

## Étapes (auth campagne)

1. Snapshot mémoire : `docker stats …-ollama-1 --no-stream`.
2. `GET http://rec008-ollama:11434/api/ps` via n8n — si `qwen2.5:1.5b` présent avec `expires_at` ≥ +2 min → warm déjà OK.
3. Sinon **une** requête synthétique (hors Chat Trigger n8n) :
   - `POST /api/chat` model=`qwen2.5:1.5b`, `keep_alive="10m"`, `num_predict=8`, prompt « Réponds uniquement par le mot OK. »
   - **Zéro retry** si timeout/échec réseau → STOP / UNCERTAIN.
4. Re-vérifier `GET /api/ps` (HTTP 200 seul **insuffisant**).
5. Runner : timeout chat **180000** ms uniquement si gate ready.
6. Postflight campagne : noter keep_alive / mem ; ne pas bump Docker mem sans auth.

## Échec

Modèle absent tags · ps vide après warm · OOM · expires trop proche → **NO-GO** chat R01.
