# Postflight REC-008 (checklist)

## Contrôles

- [ ] Compteurs PG après vs avant
- [ ] Empreinte rendez-vous (si création attendue / non attendue)
- [ ] Tentatives : statuts, clés, absence de nouvelle clé intempestive
- [ ] Session conversationnelle : step / pending / expires_at
- [ ] Mocks HTTP : deltas attendus uniquement
- [ ] Mailpit inchangé si e-mail hors périmètre
- [ ] Workflow remis inactif si activation temporaire
- [ ] Aucun retry effectué
- [ ] Rapport sans secret ni PII
- [ ] Verdict PASS / FAIL / UNCERTAIN renseigné
- [ ] Phase suivante **non** auto-autorisée
