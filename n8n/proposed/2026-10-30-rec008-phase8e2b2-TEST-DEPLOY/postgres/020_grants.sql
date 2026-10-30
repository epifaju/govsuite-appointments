-- Privilèges minimaux du rôle rec008_test.
-- Le rôle est créé avant ce script. Aucun secret dans ce fichier.
-- Refus explicite si la session est connectée à govsuite.

DO $$
BEGIN
  IF current_database() = 'govsuite' THEN
    RAISE EXCEPTION 'refus: ce script ne peut pas écrire dans govsuite';
  END IF;
  IF current_database() <> 'govsuite_rec008_test' THEN
    RAISE EXCEPTION 'refus: base inattendue %', current_database();
  END IF;
END $$;

REVOKE CONNECT ON DATABASE govsuite_rec008_test FROM PUBLIC;
GRANT CONNECT ON DATABASE govsuite_rec008_test TO rec008_test;
GRANT USAGE ON SCHEMA public TO rec008_test;

GRANT SELECT, INSERT, UPDATE ON TABLE public.ai_conversation_state TO rec008_test;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ai_appointment_attempt TO rec008_test;
GRANT SELECT ON TABLE public.services TO rec008_test;
GRANT SELECT ON TABLE public.sites TO rec008_test;
GRANT SELECT ON TABLE public.creneaux TO rec008_test;
GRANT SELECT ON TABLE public.service_sites TO rec008_test;

GRANT EXECUTE ON FUNCTION public.reclamer_tentative_rendez_vous(uuid, text, text) TO rec008_test;
GRANT EXECUTE ON FUNCTION public.reprendre_tentative_rendez_vous(uuid, text, text) TO rec008_test;
GRANT EXECUTE ON FUNCTION public.marquer_tentative_incertaine(uuid, text, text) TO rec008_test;
GRANT EXECUTE ON FUNCTION public.cloturer_tentative_rendez_vous(uuid, text, text, text, uuid, text) TO rec008_test;
GRANT EXECUTE ON FUNCTION public.expirer_tentatives_en_attente() TO rec008_test;
GRANT EXECUTE ON FUNCTION public.digest(bytea, text) TO rec008_test;
GRANT EXECUTE ON FUNCTION public.gen_random_bytes(integer) TO rec008_test;
GRANT EXECUTE ON FUNCTION public.gen_random_uuid() TO rec008_test;

REVOKE ALL ON FUNCTION public.creer_rendez_vous_idempotent(uuid, text, text, text, text, text, text, text) FROM rec008_test;
REVOKE ALL ON FUNCTION public.creer_rendez_vous_idempotent(uuid, text, text, text, text, text, text, text) FROM PUBLIC;
