# ASK-PRENOM-READINESS-007 — Templates SELECT (non exécutés)

Cible TEST uniquement : `govsuite-rec008-test-rec008-postgres-1` / DB `govsuite_rec008_test`.  
**Ne pas** exécuter pendant la mission 007. **Ne pas** toucher LIVE.

## Snapshot session (sans PII brute)

```sql
SELECT session_id,
       coalesce(intent,''),
       coalesce(pending_action,''),
       coalesce(conversation_step,''),
       expires_at::text,
       CASE WHEN expires_at <= NOW() THEN 'EXPIRED' ELSE 'ACTIVE' END,
       CASE WHEN nom IS NOT NULL THEN 't' ELSE 'f' END,
       CASE WHEN prenom IS NOT NULL THEN 't' ELSE 'f' END,
       left(coalesce(last_user_message,''), 40)
FROM ai_conversation_state
WHERE session_id = $1;
```

## Tentatives

```sql
SELECT count(*) AS total,
       count(*) FILTER (WHERE status IN ('AWAITING_CONFIRMATION','SUBMITTING','UNCERTAIN')) AS open
FROM ai_appointment_attempt
WHERE session_id = $1;
```

## STOP si

- Session absente / mauvais `session_id`
- S01 non ACTIVE ou prenom déjà présent
- S02/S03 non EXPIRÉES ou step ≠ ASK_PRENOM
- Réutilisation S02→S03 sans reset autorisé
- Tentatives ouvertes > 0
