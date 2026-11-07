# Préflight REC-008 (checklist)

À exécuter **uniquement** quand une phase runtime est explicitement autorisée.

## Contrôles lecture

- [ ] Cible = TEST (pas LIVE)
- [ ] Workflow sous test : inactif sauf si activation temporaire autorisée
- [ ] `activeVersionId` / version / SHA nœuds critiques documentés
- [ ] Aucun autre workflow inattendu actif
- [ ] Credentials Postgres = TEST
- [ ] Mock / URLs = `rec008` TEST
- [ ] Compteurs PG (rendez-vous, tentatives ouvertes, sessions) relevés
- [ ] Empreinte rendez-vous documentée (sans PII)
- [ ] Mailpit compteurs relevés
- [ ] Plan d'action = **une** action autorisée (pas de retry)

## STOP si

- Écart d'empreinte inattendu
- Confusion TEST/LIVE
- Webhook CreateAppointment joignable hors garde
- Autorisation absente ou ambiguë
