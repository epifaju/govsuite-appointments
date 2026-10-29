-- REC-006 — créneaux consulaires futurs, idempotents.
--
-- À exécuter uniquement après accord, sur la base visée :
--   psql -v ON_ERROR_STOP=1 -f database/seeds/seed_future_appointments.sql
--
-- Ce script :
--   * insère des créneaux dont le début est strictement postérieur à l'horloge ;
--   * relit les services, sites et liens réellement présents (aucun site ni service n'est créé) ;
--   * copie la durée et la capacité du service ;
--   * pose le statut DISPONIBLE et places_reservees = 0 ;
--   * ignore un triplet (service_id, site_id, debut) déjà présent, sans UPDATE ;
--   * n'écrit jamais dans rendez_vous.
--
-- Grille horaire : aucune table d'horaires n'existe. La grille est celle de
-- postgres/init.sql, appliquée dans le fuseau de chaque site :
--   jours ISO 1 à 5, de 09:00 à 11:30, pas de 30 minutes.
-- Un jour présent dans jours_fermeture pour le site est omis.
-- L'horizon va du jour civil local du site jusqu'à ce jour + 14 jours.
-- Les heures déjà passées le jour même sont écartées.
--
-- Marqueur : public.seed_rec006_marqueur reçoit seulement les identifiants
-- réellement insérés par ce script. Un créneau préexistant, même dans la
-- fenêtre, n'est ni modifié ni marqué. Le nettoyage ciblé est
-- database/seeds/cleanup_future_appointments.sql.

BEGIN;

DO $$
BEGIN
    IF to_regclass('public.creneaux') IS NULL
        OR to_regclass('public.services') IS NULL
        OR to_regclass('public.sites') IS NULL
        OR to_regclass('public.service_sites') IS NULL
        OR to_regclass('public.jours_fermeture') IS NULL
    THEN
        RAISE EXCEPTION
            'Tables métier absentes. Aucune ligne insérée.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.creneaux'::regclass
          AND contype = 'u'
          AND pg_get_constraintdef(oid) = 'UNIQUE (service_id, site_id, debut)'
    ) THEN
        RAISE EXCEPTION
            'Unicité (service_id, site_id, debut) absente sur creneaux. Aucune ligne insérée et schéma des créneaux inchangé.';
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.seed_rec006_marqueur (
    creneau_id uuid PRIMARY KEY REFERENCES public.creneaux(id) ON DELETE CASCADE,
    lot text NOT NULL,
    inserted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT seed_rec006_marqueur_lot_check CHECK (lot = 'REC-006')
);

CREATE INDEX IF NOT EXISTS idx_seed_rec006_marqueur_lot
    ON public.seed_rec006_marqueur (lot);

WITH params AS (
    SELECT
        14 AS horizon_jours,
        TIME '09:00' AS premiere_heure,
        TIME '11:30' AS derniere_heure,
        30 AS pas_minutes
),
liens AS (
    SELECT
        s.id AS service_id,
        si.id AS site_id,
        s.duree_minutes,
        s.capacite_par_creneau,
        si.timezone,
        (clock_timestamp() AT TIME ZONE si.timezone)::date AS jour_local
    FROM public.services s
    JOIN public.service_sites ss
        ON ss.service_id = s.id
       AND ss.actif
    JOIN public.sites si
        ON si.id = ss.site_id
       AND si.actif
    WHERE s.actif
),
jours AS (
    SELECT
        l.service_id,
        l.site_id,
        l.duree_minutes,
        l.capacite_par_creneau,
        l.timezone,
        gs::date AS jour
    FROM liens l
    CROSS JOIN params p
    CROSS JOIN LATERAL generate_series(
        l.jour_local::timestamp,
        (l.jour_local + p.horizon_jours)::timestamp,
        interval '1 day'
    ) AS gs
    WHERE EXTRACT(ISODOW FROM gs) BETWEEN 1 AND 5
      AND NOT EXISTS (
          SELECT 1
          FROM public.jours_fermeture jf
          WHERE jf.site_id = l.site_id
            AND gs::date BETWEEN jf.date_debut AND jf.date_fin
      )
),
heures AS (
    SELECT gs::time AS heure
    FROM params p
    CROSS JOIN LATERAL generate_series(
        (DATE '2000-01-01' + p.premiere_heure)::timestamp,
        (DATE '2000-01-01' + p.derniere_heure)::timestamp,
        make_interval(mins => p.pas_minutes)
    ) AS gs
),
candidats AS (
    SELECT
        j.service_id,
        j.site_id,
        ((j.jour + h.heure) AT TIME ZONE j.timezone) AS debut,
        (
            ((j.jour + h.heure) AT TIME ZONE j.timezone)
            + make_interval(mins => j.duree_minutes)
        ) AS fin,
        j.capacite_par_creneau AS capacite
    FROM jours j
    CROSS JOIN heures h
),
futurs AS (
    SELECT DISTINCT ON (service_id, site_id, debut)
        service_id,
        site_id,
        debut,
        fin,
        capacite
    FROM candidats
    WHERE debut > clock_timestamp()
      AND fin > debut
      AND capacite > 0
    ORDER BY service_id, site_id, debut
),
inseres AS (
    INSERT INTO public.creneaux (
        service_id,
        site_id,
        debut,
        fin,
        capacite,
        places_reservees,
        statut
    )
    SELECT
        service_id,
        site_id,
        debut,
        fin,
        capacite,
        0,
        'DISPONIBLE'
    FROM futurs
    ON CONFLICT (service_id, site_id, debut) DO NOTHING
    RETURNING id
),
marques AS (
    INSERT INTO public.seed_rec006_marqueur (creneau_id, lot)
    SELECT id, 'REC-006'
    FROM inseres
    RETURNING creneau_id
)
SELECT count(*)::integer AS creneaux_inseres
FROM marques;

COMMIT;
