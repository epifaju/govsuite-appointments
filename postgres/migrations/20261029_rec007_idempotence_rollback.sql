-- REC-007 phase 7E, conditions précisées en phase 7F.
-- Rollback SQL non destructif. La transaction ci-dessous retire seulement
-- la fonction. Elle ne supprime aucune ligne, aucune colonne, aucun index
-- et aucune clé d'idempotence.
--
-- Conditions d'arrêt, toutes obligatoires :
-- 1. Le workflow 03 actif est revenu à c48ffad5-4f36-4c7e-9abf-11ce6fa2d9e6.
--    S'il appelle encore creer_rendez_vous_idempotent, s'arrêter :
--    le webhook répondrait HTTP 500.
-- 2. Aucune création n'est en cours.
-- 3. Ne pas enchaîner avec le bloc commenté si une clé doit survivre.
-- 4. Si DROP FUNCTION échoue, la transaction est annulée et la fonction reste.
--
-- Dépendance : seul le workflow préparé en 7E appelle cette fonction.
-- Le workflow c48ffad5 ne la référence pas. Les colonnes nullables restent
-- compatibles avec lui. Ne pas republier 740ca2ae-87ea-4323-aa69-cfd57d869fc1.

BEGIN;

DROP FUNCTION IF EXISTS public.creer_rendez_vous_idempotent(
  uuid, text, text, text, text, text, text, text
);

COMMIT;

-- Retrait ultérieur des colonnes, volontairement inactif.
-- Ne pas l'exécuter tant qu'une clé de production doit survivre.
-- Le contrôle ci-dessous refuse le retrait si une clé existe.
--
-- BEGIN;
-- DO $$
-- BEGIN
--   IF EXISTS (SELECT 1 FROM public.rendez_vous WHERE cle_idempotence IS NOT NULL) THEN
--     RAISE EXCEPTION 'Des clés d''idempotence existent. Les colonnes sont conservées.';
--   END IF;
-- END $$;
-- DROP INDEX IF EXISTS public.uq_rendez_vous_cle_idempotence;
-- ALTER TABLE public.rendez_vous DROP CONSTRAINT IF EXISTS ck_rendez_vous_idempotence;
-- ALTER TABLE public.rendez_vous DROP COLUMN IF EXISTS empreinte_requete;
-- ALTER TABLE public.rendez_vous DROP COLUMN IF EXISTS cle_idempotence;
-- COMMIT;
