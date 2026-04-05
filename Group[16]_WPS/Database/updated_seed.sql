-- =============================
-- SEED DATA
-- All users password: Test@1234
-- =============================
USE womenprotectionservicesdb;

-- =============================
-- USERS (40 total)
-- U001-U003  : Admins
-- U004-U008  : Dispatchers
-- U009-U018  : Volunteers
-- U019-U040  : Victims
-- =============================
INSERT INTO User (User_id, Name, Email, Phone_no, Address, Password, Date_of_Birth, CNIC) VALUES
('U001', 'Admin Sara Malik',        'admin.sara@wps.com',          '03001110001', '12 Admin Block, Model Town, Lahore',      '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '1980-03-15', '3520111111101'),
('U002', 'Admin Ali Raza',          'admin.ali@wps.com',           '03001110002', '14 Admin Block, Gulberg, Lahore',         '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '1982-07-20', '3520111111102'),
('U003', 'Admin Fatima Noor',       'admin.fatima@wps.com',        '03001110003', '16 Admin Block, Johar Town, Lahore',      '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '1985-11-05', '4210111111103'),
('U004', 'Dispatcher Hina Shah',    'dispatcher.hina@wps.com',     '03001110004', '22 Centre Rd, Gulberg, Lahore',           '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '1990-01-10', '3520111111104'),
('U005', 'Dispatcher Omar Farooq',  'dispatcher.omar@wps.com',     '03001110005', '24 Centre Rd, Model Town, Lahore',        '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '1992-05-18', '4210111111105'),
('U006', 'Dispatcher Sana Javed',   'dispatcher.sana@wps.com',     '03001110006', '26 Centre Rd, Johar Town, Lahore',        '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '1991-08-22', '6110111111106'),
('U007', 'Dispatcher Tariq Mehmood','dispatcher.tariq@wps.com',    '03001110007', '28 Centre Rd, Bahria Town, Lahore',       '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '1989-12-01', '1710111111107'),
('U008', 'Dispatcher Amna Butt',    'dispatcher.amna@wps.com',     '03001110008', '30 Centre Rd, Wapda Town, Lahore',        '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '1993-04-14', '5110111111108'),
('U009', 'Volunteer Ayesha Khan',   'vol.ayesha@wps.com',          '03001110009', '5 Help Ave, Gulberg, Lahore',             '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '1995-09-22', '3520111111109'),
('U010', 'Volunteer Bilal Ahmed',   'vol.bilal@wps.com',           '03001110010', '7 Help Ave, Model Town, Lahore',          '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '1993-11-30', '4210111111110'),
('U011', 'Volunteer Zainab Ali',    'vol.zainab@wps.com',          '03001110011', '9 Help Ave, Johar Town, Lahore',          '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '1996-03-17', '6110111111111'),
('U012', 'Volunteer Hassan Mir',    'vol.hassan@wps.com',          '03001110012', '11 Help Ave, Bahria Town, Lahore',        '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '1994-07-08', '3520111111112'),
('U013', 'Volunteer Rabia Qureshi', 'vol.rabia@wps.com',           '03001110013', '13 Help Ave, Wapda Town, Lahore',         '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '1997-01-25', '4210111111113'),
('U014', 'Volunteer Usman Tariq',   'vol.usman@wps.com',           '03001110014', '15 Help Ave, Gulberg, Lahore',            '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '1992-10-12', '1710111111114'),
('U015', 'Volunteer Mehwish Iqbal', 'vol.mehwish@wps.com',         '03001110015', '17 Help Ave, Model Town, Lahore',         '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '1998-06-30', '5110111111115'),
('U016', 'Volunteer Asad Nawaz',    'vol.asad@wps.com',            '03001110016', '19 Help Ave, Johar Town, Lahore',         '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '1991-02-19', '3520111111116'),
('U017', 'Volunteer Nadia Hussain', 'vol.nadia@wps.com',           '03001110017', '21 Help Ave, Bahria Town, Lahore',        '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '1999-08-05', '4210111111117'),
('U018', 'Volunteer Kamran Baig',   'vol.kamran@wps.com',          '03001110018', '23 Help Ave, Wapda Town, Lahore',         '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '1990-04-11', '6110111111118'),
('U019', 'Victim Zara Hussain',     'victim.zara@wps.com',         '03001110019', '9 Safe St, Gulberg, Lahore',              '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '1998-04-05', '3520111111119'),
('U020', 'Victim Nadia Malik',      'victim.nadia@wps.com',        '03001110020', '11 Safe St, Model Town, Lahore',          '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '2000-08-14', '3520111111120'),
('U021', 'Victim Sadia Akhtar',     'victim.sadia@wps.com',        '03001110021', '15 Rose St, Johar Town, Lahore',          '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '1997-02-20', '4210111111121'),
('U022', 'Victim Mariam Cheema',    'victim.mariam@wps.com',       '03001110022', '17 Rose St, Bahria Town, Lahore',         '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '1995-06-10', '4210111111122'),
('U023', 'Victim Hira Shahid',      'victim.hira@wps.com',         '03001110023', '3 Peace Rd, Wapda Town, Lahore',          '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '2001-09-28', '6110111111123'),
('U024', 'Victim Iqra Farhan',      'victim.iqra@wps.com',         '03001110024', '5 Peace Rd, Gulberg, Lahore',             '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '1999-12-15', '6110111111124'),
('U025', 'Victim Amina Yousaf',     'victim.amina@wps.com',        '03001110025', '8 Hope Lane, Model Town, Lahore',         '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '1996-05-03', '1710111111125'),
('U026', 'Victim Kiran Bibi',       'victim.kiran@wps.com',        '03001110026', '10 Hope Lane, Johar Town, Lahore',        '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '2002-03-22', '1710111111126'),
('U027', 'Victim Samina Gul',       'victim.samina@wps.com',       '03001110027', '2 Calm St, Bahria Town, Lahore',          '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '1994-11-17', '5110111111127'),
('U028', 'Victim Rukhsana Bibi',    'victim.rukhsana@wps.com',     '03001110028', '4 Calm St, Wapda Town, Lahore',           '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '1993-07-09', '5110111111128'),
('U029', 'Victim Fozia Nawaz',      'victim.fozia@wps.com',        '03001110029', '20 Green Rd, Gulberg, Lahore',            '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '2000-01-30', '3520111111129'),
('U030', 'Victim Saima Riaz',       'victim.saima@wps.com',        '03001110030', '22 Green Rd, Model Town, Lahore',         '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '1998-10-11', '3520111111130'),
('U031', 'Victim Lubna Tariq',      'victim.lubna@wps.com',        '03001110031', '30 Blue Ave, Johar Town, Lahore',         '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '1997-04-18', '4210111111131'),
('U032', 'Victim Shazia Iqbal',     'victim.shazia@wps.com',       '03001110032', '32 Blue Ave, Bahria Town, Lahore',        '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '2001-08-25', '4210111111132'),
('U033', 'Victim Razia Sultan',     'victim.razia@wps.com',        '03001110033', '12 Bright St, Wapda Town, Lahore',        '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '1995-02-14', '6110111111133'),
('U034', 'Victim Tahira Batool',    'victim.tahira@wps.com',       '03001110034', '14 Bright St, Gulberg, Lahore',           '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '1999-06-07', '6110111111134'),
('U035', 'Victim Nasreen Akhtar',   'victim.nasreen@wps.com',      '03001110035', '6 Sun Lane, Model Town, Lahore',          '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '1996-12-20', '1710111111135'),
('U036', 'Victim Parveen Bibi',     'victim.parveen@wps.com',      '03001110036', '8 Sun Lane, Johar Town, Lahore',          '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '2003-03-03', '1710111111136'),
('U037', 'Victim Ghazala Noor',     'victim.ghazala@wps.com',      '03001110037', '16 Dawn St, Bahria Town, Lahore',         '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '1994-09-14', '5110111111137'),
('U038', 'Victim Bushra Anjum',     'victim.bushra@wps.com',       '03001110038', '18 Dawn St, Wapda Town, Lahore',          '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '2000-05-29', '5110111111138'),
('U039', 'Victim Asma Waheed',      'victim.asma@wps.com',         '03001110039', '40 River Rd, Gulberg, Lahore',            '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '1997-07-16', '3520111111139'),
('U040', 'Victim Uzma Saleem',      'victim.uzma@wps.com',         '03001110040', '42 River Rd, Model Town, Lahore',         '$2b$10$5DZmu70Sy0PzDHOBz8BcduUQ1ufav1ooJLDvRvJBnsbml1Ez2g5hG', '2002-11-08', '3520111111140');

-- =============================
-- CENTRES (5 Lahore areas)
-- =============================
INSERT INTO Centre (Centre_id, Location, Centre_number) VALUES
('C001', 'Gulberg Centre, Lahore',      '042-11110001'),
('C002', 'Model Town Centre, Lahore',   '042-11110002'),
('C003', 'Johar Town Centre, Lahore',   '042-11110003'),
('C004', 'Bahria Town Centre, Lahore',  '042-11110004'),
('C005', 'Wapda Town Centre, Lahore',   '042-11110005');

-- =============================
-- ADMINS
-- =============================
INSERT INTO Admin (User_id, Availability) VALUES
('U001', 'Yes'),
('U002', 'No'),
('U003', 'Yes');

-- =============================
-- DISPATCHERS (one per centre)
-- =============================
INSERT INTO Dispatcher (User_id, Centre_id, Availability) VALUES
('U004', 'C001', 'Yes'),
('U005', 'C002', 'Yes'),
('U006', 'C003', 'Yes'),
('U007', 'C004', 'Yes'),
('U008', 'C005', 'Yes');

-- =============================
-- VICTIMS (22 victims)
-- =============================
INSERT INTO Victim (User_id, Emergency_contact) VALUES
('U019', '03009990001'),
('U020', '03009990002'),
('U021', '03009990003'),
('U022', '03009990004'),
('U023', '03009990005'),
('U024', '03009990006'),
('U025', '03009990007'),
('U026', '03009990008'),
('U027', '03009990009'),
('U028', '03009990010'),
('U029', '03009990011'),
('U030', '03009990012'),
('U031', '03009990013'),
('U032', '03009990014'),
('U033', '03009990015'),
('U034', '03009990016'),
('U035', '03009990017'),
('U036', '03009990018'),
('U037', '03009990019'),
('U038', '03009990020'),
('U039', '03009990021'),
('U040', '03009990022');

-- =============================
-- VOLUNTEERS (10 volunteers)
-- CHANGED: U009, U010 → Status=NULL, Availability=Yes (free for testing)
-- CHANGED: U011–U018 → Status=Pending, Availability=No (each has one active Pending assignment)
-- =============================
INSERT INTO Volunteer (User_id, Status, Availability, Emergency_contact, Centre_id) VALUES
('U009', NULL,      'Yes', '03009991001', 'C001'),
('U010', NULL,      'Yes', '03009991002', 'C001'),
('U011', 'Pending', 'No',  '03009991003', 'C002'),
('U012', 'Pending', 'No',  '03009991004', 'C002'),
('U013', 'Pending', 'No',  '03009991005', 'C003'),
('U014', 'Pending', 'No',  '03009991006', 'C003'),
('U015', 'Pending', 'No',  '03009991007', 'C004'),
('U016', 'Pending', 'No',  '03009991008', 'C004'),
('U017', 'Pending', 'No',  '03009991009', 'C005'),
('U018', 'Pending', 'No',  '03009991010', 'C005');

-- =============================
-- POLICE SERVICES (one per centre)
-- =============================
INSERT INTO Police_services (Centre_id, Location, Centre_number) VALUES
('C001', 'Gulberg Police Station, Lahore',      '042-99901'),
('C002', 'Model Town Police Station, Lahore',   '042-99902'),
('C003', 'Johar Town Police Station, Lahore',   '042-99903'),
('C004', 'Bahria Town Police Station, Lahore',  '042-99904'),
('C005', 'Wapda Town Police Station, Lahore',   '042-99905');

-- =============================
-- AMBULANCE SERVICES (10 ambulances)
-- =============================
INSERT INTO Ambulance_service (Ambulance_id, Relevant_hospital, Location, Contact_info) VALUES
('AMB001', 'Services Hospital, Lahore',      'Jail Road, Lahore',         '1122'),
('AMB002', 'Lahore General Hospital',        'Jail Road, Lahore',         '03021122001'),
('AMB003', 'Mayo Hospital, Lahore',          'Nila Gumbad, Lahore',       '042-9921604'),
('AMB004', 'Jinnah Hospital, Lahore',        'Jail Road, Lahore',         '042-9920053'),
('AMB005', 'Ganga Ram Hospital, Lahore',     'Mall Road, Lahore',         '042-3576611'),
('AMB006', 'Ittefaq Hospital, Lahore',       'Model Town, Lahore',        '042-3571811'),
('AMB007', 'Sheikh Zayed Hospital, Lahore',  'University Avenue, Lahore', '042-9923100'),
('AMB008', 'Doctors Hospital, Lahore',       'Johar Town, Lahore',        '042-3591055'),
('AMB009', 'Hameed Latif Hospital, Lahore',  'Gulberg III, Lahore',       '042-3576001'),
('AMB010', 'National Hospital, Lahore',      'DHA Phase 1, Lahore',       '042-3517477');

-- =============================
-- REQUEST LOGS (20 requests)
-- =============================
INSERT INTO Request_log (Request_id, Request_time, Victim_id, Dispatcher_id, Note, Location, Type) VALUES
('R001', '2026-01-01 07:30:00', 'U019', 'U004', 'Victim reported domestic violence at home, needs immediate help.',       'Gulberg III, Lahore',            'Emergency'),
('R002', '2026-01-03 06:45:00', 'U020', 'U005', 'Victim is being followed and feels unsafe near her workplace.',          'Model Town, Lahore',             'Emergency'),
('R003', '2026-01-05 11:30:00', 'U021', 'U006', 'Victim assaulted by unknown person near her university.',                'Johar Town, Lahore',             'Emergency'),
('R004', '2026-01-08 06:00:00', 'U022', 'U007', 'Husband threatening with weapon, neighbours confirmed incident.',        'Bahria Town, Lahore',            'Emergency'),
('R005', '2026-01-10 08:30:00', 'U023', 'U008', 'Victim kidnapped and released, requesting immediate assistance.',        'Wapda Town, Lahore',             'Emergency'),
('R006', '2026-02-01 07:45:00', 'U024', 'U004', 'Victim harassed repeatedly by coworker, needs legal assistance.',       'Gulberg II, Lahore',             'Emergency'),
('R007', '2026-02-03 06:30:00', 'U025', 'U005', 'Victim stalked for weeks, attacker now outside her home.',              'Model Town Extension, Lahore',   'Emergency'),
('R008', '2026-02-05 11:00:00', 'U026', 'U006', 'Victim reported sexual assault, needs medical and legal support.',      'Johar Town Block A, Lahore',     'Emergency'),
('R009', '2026-02-08 06:15:00', 'U027', 'U007', 'Victim collapsed after beating, needs ambulance immediately.',          'Bahria Town Phase 4, Lahore',    'Emergency'),
('R010', '2026-02-10 08:45:00', 'U028', 'U008', 'Victim escaped kidnapping attempt, traumatized and needs help.',        'Wapda Town Phase 1, Lahore',     'Emergency'),
('R011', '2026-03-01 07:30:00', 'U029', 'U004', 'Victim reported ongoing domestic abuse, wants legal protection.',       'Gulberg I, Lahore',              'Emergency'),
('R012', '2026-03-03 06:45:00', 'U030', 'U005', 'Victim stalked on social media and physically in neighbourhood.',       'Model Town Park, Lahore',        'Emergency'),
('R013', '2026-03-05 11:30:00', 'U031', 'U006', 'Victim received death threats from ex-partner.',                        'Johar Town Block D, Lahore',     'Emergency'),
('R014', '2026-03-08 06:00:00', 'U032', 'U007', 'Victim beaten by family members, needs medical attention.',             'Bahria Town Phase 2, Lahore',    'Emergency'),
('R015', '2026-03-10 08:30:00', 'U033', 'U008', 'Victim reported harassment at workplace, wants formal complaint.',      'Wapda Town Block B, Lahore',     'Emergency'),
('R016', '2026-03-11 07:45:00', 'U034', 'U004', 'Victim reports neighbour breaking into her house repeatedly.',          'Gulberg Main Boulevard, Lahore', 'Emergency'),
('R017', '2026-03-12 06:30:00', 'U035', 'U005', 'Victim assaulted outside mall, attacker fled the scene.',               'Model Town Link Rd, Lahore',     'Emergency'),
('R018', '2026-03-13 11:00:00', 'U036', 'U006', 'Victim medical emergency after domestic violence incident.',             'Johar Town Phase 2, Lahore',     'Emergency'),
('R019', '2026-03-14 06:15:00', 'U037', 'U007', 'Victim trapped at home by abusive partner, cannot leave.',              'Bahria Town Phase 6, Lahore',    'Emergency'),
('R020', '2026-03-14 08:45:00', 'U038', 'U008', 'Victim requesting query about legal options for domestic abuse.',        'Wapda Town Phase 2, Lahore',     'Query');

-- =============================
-- INCIDENTS (20 incidents)
-- =============================
INSERT INTO Incident (Incident_id, Request_id, Emergency_type, Severity, Note, Location, Verification_status, Time, Status) VALUES
('I001', 'R001', 'Domestic Violence', 'High',   'Husband threatening with weapon, neighbours confirmed.',           'Gulberg III, Lahore',            'True',  '2026-01-01 08:30:00', 'Completed'),
('I002', 'R002', 'Stalking',          'Medium', 'Unknown male following victim for 3 days near office.',            'Model Town, Lahore',             'True',  '2026-01-03 07:45:00', 'Completed'),
('I003', 'R003', 'Sexual Assault',    'High',   'Victim assaulted near university campus, medical help needed.',    'Johar Town, Lahore',             'True',  '2026-01-05 12:30:00', 'Completed'),
('I004', 'R004', 'Domestic Violence', 'High',   'Husband armed and violent, children also present at scene.',       'Bahria Town, Lahore',            'True',  '2026-01-08 07:00:00', 'Completed'),
('I005', 'R005', 'Kidnapping',        'High',   'Victim released but in shock, needs counselling and protection.',  'Wapda Town, Lahore',             'True',  '2026-01-10 09:30:00', 'Completed'),
('I006', 'R006', 'Harassment',        'Medium', 'Coworker harassment confirmed by HR records and witnesses.',       'Gulberg II, Lahore',             'True',  '2026-02-01 08:45:00', 'Ongoing'),
('I007', 'R007', 'Stalking',          'High',   'Attacker identified via CCTV footage outside victim home.',        'Model Town Extension, Lahore',   'True',  '2026-02-03 07:30:00', 'Ongoing'),
('I008', 'R008', 'Sexual Assault',    'High',   'Medical examination confirmed assault, FIR registered.',           'Johar Town Block A, Lahore',     'True',  '2026-02-05 12:00:00', 'Ongoing'),
('I009', 'R009', 'Domestic Violence', 'High',   'Victim has multiple injuries, attacker is spouse.',                'Bahria Town Phase 4, Lahore',    'True',  '2026-02-08 07:15:00', 'Ongoing'),
('I010', 'R010', 'Kidnapping',        'Medium', 'Victim escaped vehicle, attacker unknown, investigation ongoing.', 'Wapda Town Phase 1, Lahore',     'True',  '2026-02-10 09:45:00', 'Ongoing'),
('I011', 'R011', 'Domestic Violence', 'Medium', 'Repeated abuse reported over 6 months, documentation available.',  'Gulberg I, Lahore',              'True',  '2026-03-01 08:30:00', 'Pending'),
('I012', 'R012', 'Stalking',          'Medium', 'Online and physical stalking confirmed, screenshots provided.',    'Model Town Park, Lahore',        'True',  '2026-03-03 07:45:00', 'Pending'),
('I013', 'R013', 'Harassment',        'High',   'Death threats via messages, ex-partner identified.',               'Johar Town Block D, Lahore',     'True',  '2026-03-05 12:30:00', 'Pending'),
('I014', 'R014', 'Domestic Violence', 'High',   'Multiple family members involved, victim has head injuries.',      'Bahria Town Phase 2, Lahore',    'True',  '2026-03-08 07:00:00', 'Pending'),
('I015', 'R015', 'Harassment',        'Low',    'Workplace harassment documented, witness statements collected.',   'Wapda Town Block B, Lahore',     'True',  '2026-03-10 09:30:00', 'Pending'),
('I016', 'R016', 'Harassment',        'Medium', 'Neighbour breaks in regularly, evidence collected by police.',     'Gulberg Main Boulevard, Lahore', 'True',  '2026-03-11 08:45:00', 'Pending'),
('I017', 'R017', 'Sexual Assault',    'High',   'CCTV footage recovered, attacker identification in progress.',     'Model Town Link Rd, Lahore',     'True',  '2026-03-12 07:30:00', 'Pending'),
('I018', 'R018', 'Medical Emergency', 'High',   'Victim has fractured ribs and internal bleeding after assault.',   'Johar Town Phase 2, Lahore',     'True',  '2026-03-13 12:00:00', 'Pending'),
('I019', 'R019', 'Domestic Violence', 'High',   'Partner blocking all exits, neighbours called for help.',          'Bahria Town Phase 6, Lahore',    'True',  '2026-03-14 07:15:00', 'Pending'),
('I020', 'R020', 'Harassment',        'Low',    'Query about legal options, no immediate physical threat reported.','Wapda Town Phase 2, Lahore',     'False', '2026-03-14 09:45:00', 'Pending');

-- =============================
-- ASSIGNMENTS (20 assignments)
-- =============================
SET sql_mode = '';
INSERT INTO Assignment (Assignment_id, Incident_id, Police_id, Ambulance_id, Assigned_time, Completion_time, Status) VALUES
('A001', 'I001', 'C001', 'AMB001', '2026-01-01 10:00:00', '2026-01-01 12:30:00', 'Completed'),
('A002', 'I002', 'C002', 'AMB003', '2026-01-03 09:00:00', '2026-01-03 11:00:00', 'Completed'),
('A003', 'I003', 'C003', 'AMB005', '2026-01-05 14:00:00', '2026-01-05 16:45:00', 'Completed'),
('A004', 'I004', 'C004', 'AMB007', '2026-01-08 08:30:00', '2026-01-08 10:15:00', 'Completed'),
('A005', 'I005', 'C005', 'AMB009', '2026-01-10 11:00:00', '2026-01-10 13:00:00', 'Completed'),
('A006', 'I006', 'C001', 'AMB002', '2026-02-01 10:00:00', NULL,                  'Ongoing'),
('A007', 'I007', 'C002', 'AMB004', '2026-02-03 09:00:00', NULL,                  'Ongoing'),
('A008', 'I008', 'C003', 'AMB006', '2026-02-05 14:00:00', NULL,                  'Ongoing'),
('A009', 'I009', 'C004', 'AMB008', '2026-02-08 08:30:00', NULL,                  'Ongoing'),
('A010', 'I010', 'C005', 'AMB010', '2026-02-10 11:00:00', NULL,                  'Ongoing'),
('A011', 'I011', 'C001', 'AMB001', '2026-03-01 10:00:00', NULL,                  'Pending'),
('A012', 'I012', 'C002', 'AMB003', '2026-03-03 09:00:00', NULL,                  'Pending'),
('A013', 'I013', 'C003', 'AMB005', '2026-03-05 14:00:00', NULL,                  'Pending'),
('A014', 'I014', 'C004', 'AMB007', '2026-03-08 08:30:00', NULL,                  'Pending'),
('A015', 'I015', 'C005', 'AMB009', '2026-03-10 11:00:00', NULL,                  'Pending'),
('A016', 'I016', 'C001', 'AMB002', '2026-03-11 10:00:00', NULL,                  'Pending'),
('A017', 'I017', 'C002', 'AMB004', '2026-03-12 09:00:00', NULL,                  'Pending'),
('A018', 'I018', 'C003', 'AMB006', '2026-03-13 14:00:00', NULL,                  'Pending'),
('A019', 'I019', 'C004', 'AMB008', '2026-03-14 08:30:00', NULL,                  'Pending'),
('A020', 'I020', 'C005', NULL,     '2026-03-14 11:00:00', NULL,                  'Pending');

-- =============================
-- VOLUNTEER ASSIGNMENTS (13 total)
-- CHANGED: Reduced from 20 to 13 rows
-- VA001–VA005 : completed historical assignments
-- VA006–VA013 : one active Pending assignment per U011–U018, all centre-matched
-- A006–A010   : Ongoing, police+ambulance only, no volunteer
-- A011, A016  : Pending, no volunteer — open for U009/U010 testing via U004
-- =============================
-- Step 1: Drop the trigger temporarily
DROP TRIGGER IF EXISTS check_volunteer_availability_before_insert;

-- Step 2: Run the volunteer assignment inserts
INSERT INTO Volunteer_assignment (Vol_assignment_id, Volunteer_id, Assignment_id) VALUES
('VA001', 'U009', 'A001'),
('VA002', 'U010', 'A002'),
('VA003', 'U011', 'A003'),
('VA004', 'U012', 'A004'),
('VA005', 'U013', 'A005'),
('VA006', 'U011', 'A012'),
('VA007', 'U012', 'A017'),
('VA008', 'U013', 'A013'),
('VA009', 'U014', 'A018'),
('VA010', 'U015', 'A014'),
('VA011', 'U016', 'A019'),
('VA012', 'U017', 'A015'),
('VA013', 'U018', 'A020');

-- Step 3: Recreate the trigger
DELIMITER $$
CREATE TRIGGER check_volunteer_availability_before_insert
BEFORE INSERT ON Volunteer_assignment
FOR EACH ROW
BEGIN
    DECLARE vol_availability VARCHAR(20);
    SELECT Availability INTO vol_availability
    FROM Volunteer
    WHERE User_id = NEW.Volunteer_id;

    IF (vol_availability != 'Yes') THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Volunteer is not available for assignment';
    END IF;
END$$
DELIMITER ;
-- =============================
-- LAW CASES (20 cases)
-- =============================
INSERT INTO Law_case (Law_case_id, Incident_id, Lawfirm_name, Case_type) VALUES
('LC001', 'I001', 'Hassan & Associates',        'Penalty'),
('LC002', 'I002', 'Rizvi Legal Services',       'Support'),
('LC003', 'I003', 'Sheikh Law Firm',             'Penalty'),
('LC004', 'I004', 'Barrister Nawaz & Co',        'Penalty'),
('LC005', 'I005', 'Malik Legal Aid',             'Support'),
('LC006', 'I006', 'Chaudhry Law Associates',     'Penalty'),
('LC007', 'I007', 'Ali & Partners',              'Support'),
('LC008', 'I008', 'Qureshi Legal Group',         'Penalty'),
('LC009', 'I009', 'Siddiqui Law Chamber',        'Support'),
('LC010', 'I010', 'Farooqi & Associates',        'Penalty'),
('LC011', 'I011', 'Hassan & Associates',         'Support'),
('LC012', 'I012', 'Rizvi Legal Services',        'Penalty'),
('LC013', 'I013', 'Sheikh Law Firm',             'Penalty'),
('LC014', 'I014', 'Barrister Nawaz & Co',        'Support'),
('LC015', 'I015', 'Malik Legal Aid',             'Support'),
('LC016', 'I016', 'Chaudhry Law Associates',     'Penalty'),
('LC017', 'I017', 'Ali & Partners',              'Penalty'),
('LC018', 'I018', 'Qureshi Legal Group',         'Support'),
('LC019', 'I019', 'Siddiqui Law Chamber',        'Support'),
('LC020', 'I020', 'Farooqi & Associates',        'Support');

-- =============================
-- FOLLOW UP SUPPORT (20 records)
-- =============================
INSERT INTO Follow_up_support (follow_up_id, Assignment_id, Referred_centre,Case_type) VALUES
('FS001', 'A001', 'Gulberg Women Shelter Home',          'Support'),
('FS002', 'A002', 'Model Town Crisis Support Centre',    'Support'),
('FS003', 'A003', 'Johar Town Safe House',               'Support'),
('FS004', 'A004', 'Bahria Town Women Bureau',            'Support'),
('FS005', 'A005', 'Wapda Town Rehabilitation Centre',    'Support'),
('FS006', 'A006', 'Gulberg Counselling Centre',          'Support'),
('FS007', 'A007', 'Model Town Women Legal Aid',          'Support'),
('FS008', 'A008', 'Johar Town Trauma Centre',            'Support'),
('FS009', 'A009', 'Bahria Town Crisis Centre',           'Support'),
('FS010', 'A010', 'Wapda Town Safe House',              'Support'),
('FS011', 'A011', 'Gulberg Women Shelter Home',         'Support'),
('FS012', 'A012', 'Model Town Crisis Support Centre',   'Support'),
('FS013', 'A013', 'Johar Town Safe House',              'Support'),
('FS014', 'A014', 'Bahria Town Women Bureau',            'Support'),
('FS015', 'A015', 'Wapda Town Rehabilitation Centre',    'Support'),
('FS016', 'A016', 'Gulberg Counselling Centre',          'Penalty'),
('FS017', 'A017', 'Model Town Women Legal Aid',          'Penalty'),
('FS018', 'A018', 'Johar Town Trauma Centre',            'Support'),
('FS019', 'A019', 'Bahria Town Crisis Centre',           'Support'),
('FS020', 'A020', 'Wapda Town Safe House',               'Support');

-- =============================
-- PASSWORD RECOVERY (10 records)
-- =============================
INSERT INTO Password_Recovery (Recovery_id, User_email, Admin_id, Status, Note) VALUES
('PR001', 'victim.zara@wps.com',       'U001', 'Processed', 'Identity verified via phone call. Password reset done.'),
('PR002', 'vol.bilal@wps.com',         'U002', 'Processed', 'Password reset completed successfully.'),
('PR003', 'victim.sadia@wps.com',      'U001', 'Processed', 'Verified via emergency contact. Password reset.'),
('PR004', 'dispatcher.hina@wps.com',   'U003', 'Processed', 'Staff identity confirmed. Password reset.'),
('PR005', 'victim.hira@wps.com',       'U002', 'Processed', 'CNIC verification done. Password reset.'),
('PR006', 'vol.zainab@wps.com',        'U001', 'Pending',   'Awaiting identity verification from volunteer.'),
('PR007', 'victim.amina@wps.com',      'U002', 'Pending',   'Victim contacted, waiting for CNIC confirmation.'),
('PR008', 'victim.fozia@wps.com',      'U003', 'Pending',   'Request received, admin review in progress.'),
('PR009', 'victim.lubna@wps.com',      'U001', 'Pending',   'Awaiting callback from victim for verification.'),
('PR010', 'dispatcher.sana@wps.com',   'U002', 'Pending',   'Staff request under review by admin.');