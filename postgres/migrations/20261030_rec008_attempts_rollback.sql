-- REC-008 phase 8B. Rollback préparé, non exécuté.
-- Il ne touche pas aux rendez-vous, notifications, historiques ni sessions.
-- Si une tentative existe, la transaction s'arrête et la table reste.

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.ai_appointment_attempt') IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.ai_appointment_attempt) THEN
    RAISE EXCEPTION 'Des tentatives existent. Aucune suppression n''est effectuée.';
  END IF;
END
$guard$;

DROP FUNCTION IF EXISTS public.reclamer_tentative_rendez_vous(uuid, text, text);
DROP FUNCTION IF EXISTS public.reprendre_tentative_rendez_vous(uuid, text, text);
DROP FUNCTION IF EXISTS public.marquer_tentative_incertaine(uuid, text, text);
DROP FUNCTION IF EXISTS public.cloturer_tentative_rendez_vous(uuid, text, text, text, uuid, text);
DROP FUNCTION IF EXISTS public.expirer_tentatives_en_attente();

DROP TABLE IF EXISTS public.ai_appointment_attempt;

COMMIT;
