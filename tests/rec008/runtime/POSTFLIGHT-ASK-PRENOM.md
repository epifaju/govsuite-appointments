# Postflight ASK_PRENOM — non exécuté en mission 007

1. Désactiver workflow (`active=false`, webhooks 0) — hardStop si échec
2. Comparer mock avant/après (POST/avail/services Δ = 0)
3. Tentatives ouvertes = 0
4. Assertions S0x selon contrat (S03 brief vs VC9-actual)
5. Empreinte LIVE / Mailpit (si lecture autorisée) inchangées
6. Verdict PASS/FAIL/UNCERTAIN — pas de phase suivante auto
7. Timeout transport → UNCERTAIN, **pas de retry**, désactiver quand même
