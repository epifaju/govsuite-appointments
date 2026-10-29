-- REC-006 — nettoyage des seuls créneaux insérés par seed_future_appointments.sql.
--
-- Supprime un créneau marqué REC-006 seulement si :
--   * places_reservees = 0 ;
--   * statut = DISPONIBLE ;
--   * aucune ligne de rendez_vous ne le référence.
--
-- Un créneau réservé, complet, bloqué, annulé ou déjà lié à un rendez-vous
-- est conservé, ainsi que son marqueur. La table rendez_vous n'est pas modifiée.
-- Les créneaux sans marqueur, y compris l'historique, ne sont pas visés.
--
--   psql -v ON_ERROR_STOP=1 -f database/seeds/cleanup_future_appointments.sql

BEGIN;

DO $$
BEGIN
    IF to_regclass('public.seed_rec006_marqueur') IS NULL THEN
        RAISE EXCEPTION
            'Table seed_rec006_marqueur absente. Aucun créneau supprimé.';
    END IF;
END $$;

WITH bilan AS (
    SELECT
        count(*) FILTER (
            WHERE c.places_reservees = 0
              AND c.statut = 'DISPONIBLE'
              AND NOT EXISTS (
                  SELECT 1
                  FROM public.rendez_vous r
                  WHERE r.creneau_id = c.id
              )
        )::integer AS supprimables,
        count(*) FILTER (
            WHERE c.places_reservees <> 0
               OR c.statut <> 'DISPONIBLE'
               OR EXISTS (
                  SELECT 1
                  FROM public.rendez_vous r
                  WHERE r.creneau_id = c.id
               )
        )::integer AS conserves
    FROM public.seed_rec006_marqueur m
    JOIN public.creneaux c ON c.id = m.creneau_id
    WHERE m.lot = 'REC-006'
),
cibles AS (
    SELECT c.id
    FROM public.creneaux c
    JOIN public.seed_rec006_marqueur m ON m.creneau_id = c.id
    WHERE m.lot = 'REC-006'
      AND c.places_reservees = 0
      AND c.statut = 'DISPONIBLE'
      AND NOT EXISTS (
          SELECT 1
          FROM public.rendez_vous r
          WHERE r.creneau_id = c.id
      )
),
suppr AS (
    DELETE FROM public.creneaux c
    USING cibles
    WHERE c.id = cibles.id
    RETURNING c.id
)
SELECT
    (SELECT count(*)::integer FROM suppr) AS creneaux_supprimes,
    (SELECT conserves FROM bilan) AS creneaux_conserves;

COMMIT;
