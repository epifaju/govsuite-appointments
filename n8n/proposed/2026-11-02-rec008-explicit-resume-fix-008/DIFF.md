# EXPLICIT-RESUME-FIX-008 — DIFF

## Périmètre

- Source VC9 (P4F after) : `n8n/proposed/2026-11-01-rec008-phase8f2b49-P4F-TTL-FIX-TEST-INSTALL/after-OCD9It1uKFhOoWNF.json`
- Copie locale `before-` = baseline inchangée
- Copie locale `after-` = seul le `jsCode` de **Gérer collecte progressive** modifié
- Export P4F original **non touché**

## Nœud modifié

| Champ | Valeur |
| --- | --- |
| Nom | Gérer collecte progressive |
| Id | `cc3403f1-6f07-4ab5-ab26-b0fee396a46d` |
| Changement | `parameters.jsCode` uniquement |

## Patch (jsCode)

Après reconnaissance `explicitResumeMsg` (branche `sessionExpired`), le code posait déjà les flags puis **continuait** vers la machine de collecte (ASK_NOM / ASK_PRENOM / ASK_EMAIL / ASK_TELEPHONE / étapes service).

Correctif : **early return** immédiat après les flags, avant toute capture de champ, en renvoyant l’état JSON (pattern identique au `return` free-text expiré non-reprise, donc **Sauvegarder** reçoit toujours la sortie de Gérer).

```diff
   // reprise explicite : poursuivre CREATE sans CLAIM/POST automatique
+  // EXPLICIT-RESUME-FIX-008: early return AFTER flags, BEFORE field capture
   x.refreshSessionTtl = true;
   x.sessionExpired = false;
   x.preserveDraft = true;
   if (previousPendingAction === 'CREATE_APPOINTMENT') {
     x.intent = 'CREATE_APPOINTMENT';
   }
+  return [{
+    json: {
+      ...x,
+      pendingAction: previousPendingAction,
+      conversationStep: previousConversationStep,
+      nom: previous.nom ?? x.nom ?? null,
+      prenom: previous.prenom ?? x.prenom ?? null,
+      email: previous.email ?? x.email ?? null,
+      telephone: previous.telephone ?? x.telephone ?? null,
+      service: previous.service ?? x.service ?? null,
+      site: previous.site ?? x.site ?? null,
+      dateDebut: previous.date_debut ?? x.dateDebut ?? null,
+      dateFin: previous.date_fin ?? x.dateFin ?? null,
+      slotId: previous.slot_id ?? x.slotId ?? null,
+      selectedSlotIndex: previous.selected_slot_index ?? x.selectedSlotIndex ?? null,
+      availableSlots: previous.available_slots ?? x.availableSlots ?? null,
+      sessionExpired: false,
+      refreshSessionTtl: true,
+      preserveDraft: true,
+      originalMessage: message
+    }
+  }];
 }
```

## Non-régressions visées

- Free-text expiré **sans** reprise : early return existant inchangé (`sessionExpired=true`, `refreshSessionTtl=false`, `preserveDraft=true`)
- Reprise explicite : pas de capture métier du message « reprendre » / « continuer… »
- `conversationStep` conservé (`previousConversationStep`)
- Intent CREATE si `pendingAction` CREATE
- Pas de CLAIM/POST implicite
- Persistence via Sauvegarder toujours atteinte (sortie JSON de Gérer)
