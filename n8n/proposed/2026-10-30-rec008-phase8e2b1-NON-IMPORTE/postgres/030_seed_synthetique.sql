-- Données fictives pour govsuite_rec008_test.
-- Ne pas exécuter sur la base govsuite.
-- Ne pas exécuter pendant la phase 8E-2B-1.

DO $$
BEGIN
  IF current_database() = 'govsuite' THEN
    RAISE EXCEPTION 'refus: ce script ne peut pas écrire dans govsuite';
  END IF;
  IF current_database() <> 'govsuite_rec008_test' THEN
    RAISE EXCEPTION 'refus: base inattendue %', current_database();
  END IF;
END $$;

INSERT INTO sites (id, code, nom, adresse, ville, pays, timezone)
VALUES (
  '11111111-1111-4111-8111-111111111111',
  'REC008TEST',
  'Site fictif REC008',
  '1 rue du test',
  'Ville-Test',
  'Test',
  'Europe/Paris'
);

INSERT INTO services (id, code, nom, description, duree_minutes, capacite_par_creneau)
VALUES (
  '22222222-2222-4222-8222-222222222222',
  'REC008SVC',
  'Service fictif',
  'Service synthétique de la phase REC-008',
  30,
  2
);

INSERT INTO service_sites (service_id, site_id)
VALUES (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111'
);

INSERT INTO creneaux (id, service_id, site_id, debut, fin, capacite, places_reservees, statut)
VALUES
  (
    '33333333-3333-4333-8333-333333333333',
    '22222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    '2026-11-03 09:00:00+01',
    '2026-11-03 09:30:00+01',
    2, 0, 'DISPONIBLE'
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    '22222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    '2026-11-03 10:00:00+01',
    '2026-11-03 10:30:00+01',
    1, 1, 'COMPLET'
  );

INSERT INTO rendez_vous (
  id, reference, service_id, site_id, creneau_id,
  nom, prenom, email, telephone, numero_document, langue, statut, token_gestion
)
VALUES (
  '55555555-5555-4555-8555-555555555555',
  'REC008-MOCK-0001',
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  '44444444-4444-4444-8444-444444444444',
  'ESSAI',
  'Camille',
  'camille.essai@example.test',
  '+33000000000',
  'DOC-TEST-0001',
  'fr',
  'CONFIRME',
  '66666666-6666-4666-8666-666666666666'
);

INSERT INTO ai_conversation_state (id, session_id, intent, service, site, nom, prenom, email, telephone)
VALUES (
  '77777777-7777-4777-8777-777777777777',
  'rec008-session-synthetique',
  NULL,
  'REC008SVC',
  'REC008TEST',
  'ESSAI',
  'Camille',
  'camille.essai@example.test',
  '+33000000000'
);
