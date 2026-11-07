# Prompts de travail multi-agents — GovSuite REC-008

Utiliser les subagents via `/nom-agent` ou délégation Task. Respecter `AGENTS.md` et `.cursor/rules/govsuite-safety.mdc`.

## 1. Analyser une anomalie

```text
/govsuite-planner puis /n8n-developer /postgres-engineer /security-auditor

Mission lecture seule : diagnostiquer <symptôme> sur TEST uniquement.
Aucun chat, aucune activation, aucun SQL d'écriture, aucun LIVE.
Produire cause racine, chemin de nœuds, écarts TTL éventuels, verdict PASS/FAIL/UNCERTAIN.
Ne pas autoriser la correction ni la phase suivante.
```

**Parallélisable** : n8n + postgres + security après le cadrage planner.

## 2. Préparer un correctif hors ligne

```text
/n8n-developer (et /postgres-engineer si SQL)

Préparer un correctif hors ligne sous n8n/proposed/<date>-rec008-<phase>/.
Fichiers attendus : exports de nœuds, PROPOSED_FIX.diff.txt, offline-tests, notes d'install.
Interdit : import distant, activation, POST CreateAppointment, mutation PG.
Verdict de préparation uniquement.
```

**Ordre strict** : diagnostic PASS → proposition → evidence-reviewer → GO humain pour install.

## 3. Générer des tests

```text
/qa-automation

Enrichir tests/rec008/ pour le scénario <id> (fixtures synthétiques + assertions Node hors ligne).
Pas de dépendance npm. Pas d'appel métier. Pas de PII réelle.
Documenter la commande node sans l'exécuter si non demandé.
```

**Parallélisable** avec rédaction devops de checklists.

## 4. Vérifier indépendamment un patch

```text
/evidence-reviewer

Revoir les artefacts de <chemin proposed ou rapport>.
Distinguer HTTP vs succès métier. Chercher preuves manquantes → UNCERTAIN.
Ne pas modifier de fichiers. Ne pas rejouer d'appels. Ne pas GO la suite.
```

**Séquentiel** après artefacts figés.

## 5. Auditer la sécurité

```text
/security-auditor

Audit isolation TEST/LIVE, secrets, PII, webhooks, activations collatérales.
Lecture seule. Redacter tout secret/PII. Verdict PASS/FAIL/UNCERTAIN.
```

**Parallélisable** avec diagnostic technique hors ligne.

## 6. Consolider un rapport

```text
/govsuite-planner avec synthèses des agents

Consolider un rapport docs/recovery/<PHASE>_REPORT.md :
préflight, faits, preuves, écarts, verdict, GO/NO-GO phase courante seulement.
Aucun secret/PII. Phase suivante non autorisée.
```

**Séquentiel** : attendre evidence-reviewer.

## 7. Proposer une décision GO/NO-GO

```text
/govsuite-planner

Sur la base des verdicts agents (surtout evidence-reviewer + security-auditor),
proposer GO / NO-GO / HOLD pour la phase courante uniquement.
Lister STOP conditions et autorisations humaines encore requises.
Ne pas lancer la phase suivante.
```

## Matrice parallélisme

| Tâche | Parallel OK | Ordre strict |
| --- | --- | --- |
| Diagnostics lecture | oui | après cadrage léger |
| Correctif offline + fixtures | oui entre eux | après diagnostic |
| Préflight runtime | non | avant toute action |
| Activation / message chat / POST | non | une action à la fois |
| Postflight + evidence | evidence après postflight | oui |
| GO phase N+1 | non | demande humaine distincte |
