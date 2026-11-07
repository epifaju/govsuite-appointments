# REC-008 — Contrat de masquage des artefacts (R04–R07+)

Mission EVIDENCE-OBSERVABILITY-030. Aligné sur `.cursor/rules/govsuite-safety.mdc` et audit 029.

**Portée :** nouveaux artefacts / rapports **à partir de R04-PREP**.  
**Preuves historiques R01–R03 :** **intactes** (pas de réécriture).

---

## 1. Interdit (nouveaux livrables)

| Catégorie | Exemples interdits |
| --- | --- |
| Email | Adresse complète (`user@domain`) |
| Téléphone | Numéro complet E.164 / national |
| Token réservation | UUID/token de gestion en clair |
| Credentials | mots de passe, `N8N_ENCRYPTION_KEY`, cookies session |
| Message utilisateur PII | texte brut contenant email/tél/nom réel citoyen |
| HTTP brut non expurgé | body JSON avec email/tél/token/nom complet |

---

## 2. Autorisé

| Champ | Forme |
| --- | --- |
| Présence | `emailPresent=true/false`, `telephonePresent`, `tokenPresent` |
| Longueur | `emailLen`, `telephoneLen`, `lastUserMessageLen` |
| Validation | `emailValide`, `telephoneValide` (bool) |
| Hash corrélation | voir §3 |
| IDs synthétiques | `rec008-runtime013-*`, UUID créneau de fixture **non** token citoyen |
| États métier | `conversationStep`, `type`, codes erreur, `claimAcquired=false` |
| Compteurs | mock Δ, fingerprint `a\|b\|c\|d`, running count |
| Previews message | **uniquement** si classe synthétique sans PII (`reprendre`, `Camille` fixture historique exemptée) — pour R04+ préférer classe `email_like` **sans** valeur |

---

## 3. Hash de corrélation (méthode)

| Paramètre | Valeur |
| --- | --- |
| Algorithme | **SHA-256** |
| Entrée | UTF-8 du `sessionId` synthétique **ou** `runToken` (chaîne exacte) |
| Sortie | hex lowercase, optionnellement tronqué à **16** chars pour logs (`sessionIdHash`) |
| Interdit | hash d’email/téléphone réel comme clé primaire de rapport (évite rainbow si alphabet faible) — si besoin : `SHA-256(salt_mission \|\| valeur)` avec salt **non** commité |

Le runner R0x utilise déjà `sessionIdHash` court — à conserver.

---

## 4. Schéma snapshot session (R04+)

```json
{
  "sessionIdHash": "<16 hex>",
  "conversationStep": "ASK_EMAIL",
  "prenomPresent": true,
  "prenomLen": 7,
  "nomPresent": true,
  "nomLen": 6,
  "emailPresent": false,
  "emailLen": 0,
  "emailValide": false,
  "slotIdPresent": true,
  "ttlActive": true,
  "lastUserMessageLen": 0,
  "lastUserMessageClass": "none"
}
```

Pas de `nom` / `prenom` / `email` en clair.

---

## 5. Tests automatisés (contrat QA)

Un job offline (à ajouter sous `tests/rec008/` lors d’une mission outillage autorisée) **FAIL** si, dans un glob d’artefacts **nouveaux** (`artifacts-r04-*`, rapports post-030) :

| Pattern (indicatif) | Cible |
| --- | --- |
| `[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}` | email |
| `\+?[0-9][0-9\s.-]{7,}[0-9]` | téléphone |
| `"token"\s*:\s*"[0-9a-f-]{20,}"` | token UUID-like |
| `password\|ENCRYPTION_KEY\|Bearer ` | credentials |

Exceptions allowlist : fixtures synthétiques documentées `tests/rec008/fixtures/**` marquées `synthetic:true` **hors** dossier artefacts campagne.

---

## 6. Non-objectifs

- Ne pas réécrire `artifacts-r01-024` … `r03-026`.
- Ne pas appliquer de purge PG dans cette mission.
