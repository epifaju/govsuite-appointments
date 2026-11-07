# REC-008 — Plan optionnel rétention n8n (future campagne R04 autorisée)

Mission 031 — **docs only**. Aucun PUT settings. Aucune purge. Ancre : `REC008_N8N_EXECUTION_RETENTION_DIAG.md` (030).

---

## Contexte

| Élément | État TEST connu |
| --- | --- |
| Workflow `OCD9It1uKFhOoWNF` | `saveDataSuccessExecution=none`, `saveDataErrorExecution=none` |
| Instance `/rest/settings` | `saveData*=all` (n’override **pas** le workflow) |
| `EXECUTIONS_DATA_*` compose | absentes |
| `execution_entity` | 0 |

---

## Procédure future (auth humaine requise)

1. **Backup** JSON settings workflow + SHA versionId / versionCounter  
2. **Vérifier** `saveData*=none` effectif (GET workflow, pas seulement instance)  
3. **Risques PII** si flip temporaire `saveData*=all` : payloads chat (email) dans sqlite — scanner + purge obligatoires  
4. Fenêtre campagne bornée (R04 only)  
5. **Restauration** postflight : remettre `saveData*=none` + SHA check  
6. **Purge** IDs exécutions TEST créés dans la fenêtre (API delete) — jamais LIVE  
7. Contrôles postflight : `running=0`, webhooks 0, `active=false`  

## Critères d’autorisation

- Mission runtime R04 déjà GO humaine  
- Security OK sur fenêtre + purge  
- Pas de coexistence LIVE dans les commandes  

**Non fait en 031.**
