CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(30) UNIQUE NOT NULL,
    nom VARCHAR(150) NOT NULL,
    adresse TEXT,
    ville VARCHAR(100),
    pays VARCHAR(100),
    timezone VARCHAR(50) NOT NULL DEFAULT 'Europe/Paris',
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(30) UNIQUE NOT NULL,
    nom VARCHAR(150) NOT NULL,
    description TEXT,
    duree_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duree_minutes > 0),
    capacite_par_creneau INTEGER NOT NULL DEFAULT 1 CHECK (capacite_par_creneau > 0),
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_sites (
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (service_id, site_id)
);

CREATE TABLE IF NOT EXISTS creneaux (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    debut TIMESTAMPTZ NOT NULL,
    fin TIMESTAMPTZ NOT NULL,
    capacite INTEGER NOT NULL DEFAULT 1 CHECK (capacite > 0),
    places_reservees INTEGER NOT NULL DEFAULT 0 CHECK (places_reservees >= 0),
    statut VARCHAR(20) NOT NULL DEFAULT 'DISPONIBLE'
        CHECK (statut IN ('DISPONIBLE','COMPLET','BLOQUE','ANNULE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_creneau_dates CHECK (fin > debut),
    CONSTRAINT ck_creneau_places CHECK (places_reservees <= capacite),
    UNIQUE(service_id, site_id, debut)
);

CREATE TABLE IF NOT EXISTS rendez_vous (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference VARCHAR(40) UNIQUE NOT NULL,
    service_id UUID NOT NULL REFERENCES services(id),
    site_id UUID NOT NULL REFERENCES sites(id),
    creneau_id UUID NOT NULL REFERENCES creneaux(id),
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    telephone VARCHAR(50),
    numero_document VARCHAR(100),
    langue VARCHAR(10) NOT NULL DEFAULT 'fr',
    statut VARCHAR(30) NOT NULL DEFAULT 'CONFIRME'
        CHECK (statut IN ('EN_ATTENTE','CONFIRME','ANNULE','REPLANIFIE','PRESENT','ABSENT','TERMINE')),
    token_gestion UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    motif_annulation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cancelled_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rendez_vous_id UUID NOT NULL REFERENCES rendez_vous(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL CHECK (type IN ('CONFIRMATION','RAPPEL_J7','RAPPEL_J1','RAPPEL_H2','ANNULATION','REPLANIFICATION')),
    canal VARCHAR(20) NOT NULL CHECK (canal IN ('EMAIL','SMS','WHATSAPP')),
    destinataire VARCHAR(255) NOT NULL,
    statut VARCHAR(20) NOT NULL DEFAULT 'A_ENVOYER' CHECK (statut IN ('A_ENVOYER','ENVOYE','ECHEC')),
    erreur TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(rendez_vous_id, type, canal)
);

CREATE TABLE IF NOT EXISTS jours_fermeture (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    motif VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_fermeture_dates CHECK (date_fin >= date_debut)
);

CREATE TABLE IF NOT EXISTS historique_rendez_vous (
    id BIGSERIAL PRIMARY KEY,
    rendez_vous_id UUID NOT NULL REFERENCES rendez_vous(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    ancien_statut VARCHAR(30),
    nouveau_statut VARCHAR(30),
    details JSONB,
    acteur VARCHAR(100) NOT NULL DEFAULT 'SYSTEM',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creneaux_disponibilite
    ON creneaux(service_id, site_id, debut, statut);
CREATE INDEX IF NOT EXISTS idx_rdv_creneau ON rendez_vous(creneau_id);
CREATE INDEX IF NOT EXISTS idx_rdv_statut ON rendez_vous(statut);
CREATE INDEX IF NOT EXISTS idx_rdv_email ON rendez_vous(email);
CREATE INDEX IF NOT EXISTS idx_notifications_statut ON notifications(statut, created_at);

-- Données de démonstration
INSERT INTO sites (code, nom, adresse, ville, pays, timezone)
VALUES
('PARIS', 'Consulat - Paris', 'Adresse de démonstration', 'Paris', 'France', 'Europe/Paris'),
('LISBONNE', 'Consulat - Lisbonne', 'Adresse de démonstration', 'Lisbonne', 'Portugal', 'Europe/Lisbon')
ON CONFLICT (code) DO NOTHING;

INSERT INTO services (code, nom, description, duree_minutes, capacite_par_creneau)
VALUES
('PASSEPORT', 'Passeport', 'Demande ou renouvellement de passeport', 30, 2),
('VISA', 'Visa', 'Dépôt de demande de visa', 30, 2),
('LEGALISATION', 'Légalisation', 'Légalisation et certification de documents', 20, 3),
('ETAT_CIVIL', 'État civil', 'Actes de naissance, mariage, décès et autres démarches', 45, 1)
ON CONFLICT (code) DO NOTHING;

INSERT INTO service_sites (service_id, site_id)
SELECT s.id, si.id
FROM services s
CROSS JOIN sites si
ON CONFLICT DO NOTHING;

-- Génère des créneaux de démo pour les 10 prochains jours ouvrés, entre 09:00 et 12:00.
WITH jours AS (
    SELECT d::date AS jour
    FROM generate_series(current_date + 1, current_date + 14, interval '1 day') d
    WHERE EXTRACT(ISODOW FROM d) BETWEEN 1 AND 5
), heures AS (
    SELECT h::time AS heure
    FROM generate_series(timestamp '2026-01-01 09:00', timestamp '2026-01-01 11:30', interval '30 minutes') h
), combinaisons AS (
    SELECT s.id AS service_id, si.id AS site_id, j.jour, h.heure,
           s.duree_minutes, s.capacite_par_creneau, si.timezone
    FROM services s
    CROSS JOIN sites si
    CROSS JOIN jours j
    CROSS JOIN heures h
    WHERE s.actif = TRUE AND si.actif = TRUE
)
INSERT INTO creneaux(service_id, site_id, debut, fin, capacite)
SELECT service_id,
       site_id,
       ((jour + heure) AT TIME ZONE timezone) AS debut,
       (((jour + heure) + make_interval(mins => duree_minutes)) AT TIME ZONE timezone) AS fin,
       capacite_par_creneau
FROM combinaisons
ON CONFLICT (service_id, site_id, debut) DO NOTHING;

-- Un rendez-vous exemple pour tester l'affichage et les futurs rappels.
WITH target_slot AS (
    SELECT c.id, c.service_id, c.site_id
    FROM creneaux c
    JOIN services s ON s.id = c.service_id
    JOIN sites si ON si.id = c.site_id
    WHERE s.code = 'PASSEPORT'
      AND si.code = 'PARIS'
      AND c.statut = 'DISPONIBLE'
    ORDER BY c.debut
    LIMIT 1
), inserted AS (
    INSERT INTO rendez_vous(
        reference, service_id, site_id, creneau_id,
        nom, prenom, email, telephone, langue, statut
    )
    SELECT 'DEMO-2026-0001', service_id, site_id, id,
           'SILVA', 'Joao', 'joao.silva@example.test', '+33600000000', 'fr', 'CONFIRME'
    FROM target_slot
    ON CONFLICT (reference) DO NOTHING
    RETURNING creneau_id
)
UPDATE creneaux c
SET places_reservees = places_reservees + 1,
    statut = CASE WHEN places_reservees + 1 >= capacite THEN 'COMPLET' ELSE statut END,
    updated_at = NOW()
WHERE c.id IN (SELECT creneau_id FROM inserted);
