-- =============================
-- SEED DATA
-- All users password: Test@1234
-- =============================

-- =============================
-- USERS (40 total)
-- U001-U003  : Admins
-- U004-U008  : Dispatchers
-- U009-U018  : Volunteers
-- U019-U040  : Victims
-- =============================
INSERT INTO User (User_id, Name, Email, Phone_no, Address, Password, Date_of_Birth, CNIC) VALUES
('U001', 'Admin Sara Malik',        'admin.sara@wps.com',          '03001110001', '12 Admin Block, Model Town, Lahore',      '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '1980-03-15', '3520111111101'),
('U002', 'Admin Ali Raza',          'admin.ali@wps.com',           '03001110002', '14 Admin Block, Gulberg, Lahore',         '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '1982-07-20', '3520111111102'),
('U003', 'Admin Fatima Noor',       'admin.fatima@wps.com',        '03001110003', '16 Admin Block, Johar Town, Lahore',      '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '1985-11-05', '4210111111103'),
('U004', 'Dispatcher Hina Shah',    'dispatcher.hina@wps.com',     '03001110004', '22 Centre Rd, Gulberg, Lahore',           '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '1990-01-10', '3520111111104'),
('U005', 'Dispatcher Omar Farooq',  'dispatcher.omar@wps.com',     '03001110005', '24 Centre Rd, Model Town, Lahore',        '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '1992-05-18', '4210111111105'),
('U006', 'Dispatcher Sana Javed',   'dispatcher.sana@wps.com',     '03001110006', '26 Centre Rd, Johar Town, Lahore',        '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '1991-08-22', '6110111111106'),
('U007', 'Dispatcher Tariq Mehmood','dispatcher.tariq@wps.com',    '03001110007', '28 Centre Rd, Bahria Town, Lahore',       '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '1989-12-01', '1710111111107'),
('U008', 'Dispatcher Amna Butt',    'dispatcher.amna@wps.com',     '03001110008', '30 Centre Rd, Wapda Town, Lahore',        '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '1993-04-14', '5110111111108'),
('U009', 'Volunteer Ayesha Khan',   'vol.ayesha@wps.com',          '03001110009', '5 Help Ave, Gulberg, Lahore',             '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '1995-09-22', '3520111111109'),
('U010', 'Volunteer Bilal Ahmed',   'vol.bilal@wps.com',           '03001110010', '7 Help Ave, Model Town, Lahore',          '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '1993-11-30', '4210111111110'),
('U011', 'Volunteer Zainab Ali',    'vol.zainab@wps.com',          '03001110011', '9 Help Ave, Johar Town, Lahore',          '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '1996-03-17', '6110111111111'),
('U012', 'Volunteer Hassan Mir',    'vol.hassan@wps.com',          '03001110012', '11 Help Ave, Bahria Town, Lahore',        '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '1994-07-08', '3520111111112'),
('U013', 'Volunteer Rabia Qureshi', 'vol.rabia@wps.com',           '03001110013', '13 Help Ave, Wapda Town, Lahore',         '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '1997-01-25', '4210111111113'),
('U014', 'Volunteer Usman Tariq',   'vol.usman@wps.com',           '03001110014', '15 Help Ave, Gulberg, Lahore',            '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '1992-10-12', '1710111111114'),
('U015', 'Volunteer Mehwish Iqbal', 'vol.mehwish@wps.com',         '03001110015', '17 Help Ave, Model Town, Lahore',         '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '1998-06-30', '5110111111115'),
('U016', 'Volunteer Asad Nawaz',    'vol.asad@wps.com',            '03001110016', '19 Help Ave, Johar Town, Lahore',         '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '1991-02-19', '3520111111116'),
('U017', 'Volunteer Nadia Hussain', 'vol.nadia@wps.com',           '03001110017', '21 Help Ave, Bahria Town, Lahore',        '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '1999-08-05', '4210111111117'),
('U018', 'Volunteer Kamran Baig',   'vol.kamran@wps.com',          '03001110018', '23 Help Ave, Wapda Town, Lahore',         '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '1990-04-11', '6110111111118'),
('U019', 'Victim Zara Hussain',     'victim.zara@wps.com',         '03001110019', '9 Safe St, Gulberg, Lahore',              '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '1998-04-05', '3520111111119'),
('U020', 'Victim Nadia Malik',      'victim.nadia@wps.com',        '03001110020', '11 Safe St, Model Town, Lahore',          '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '2000-08-14', '3520111111120'),
('U021', 'Victim Sadia Akhtar',     'victim.sadia@wps.com',        '03001110021', '15 Rose St, Johar Town, Lahore',          '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '1997-02-20', '4210111111121'),
('U022', 'Victim Mariam Cheema',    'victim.mariam@wps.com',       '03001110022', '17 Rose St, Bahria Town, Lahore',         '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '1995-06-10', '4210111111122'),
('U023', 'Victim Hira Shahid',      'victim.hira@wps.com',         '03001110023', '3 Peace Rd, Wapda Town, Lahore',          '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '2001-09-28', '6110111111123'),
('U024', 'Victim Iqra Farhan',      'victim.iqra@wps.com',         '03001110024', '5 Peace Rd, Gulberg, Lahore',             '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '1999-12-15', '6110111111124'),
('U025', 'Victim Amina Yousaf',     'victim.amina@wps.com',        '03001110025', '8 Hope Lane, Model Town, Lahore',         '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '1996-05-03', '1710111111125'),
('U026', 'Victim Kiran Bibi',       'victim.kiran@wps.com',        '03001110026', '10 Hope Lane, Johar Town, Lahore',        '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '2002-03-22', '1710111111126'),
('U027', 'Victim Samina Gul',       'victim.samina@wps.com',       '03001110027', '2 Calm St, Bahria Town, Lahore',          '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '1994-11-17', '5110111111127'),
('U028', 'Victim Rukhsana Bibi',    'victim.rukhsana@wps.com',     '03001110028', '4 Calm St, Wapda Town, Lahore',           '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '1993-07-09', '5110111111128'),
('U029', 'Victim Fozia Nawaz',      'victim.fozia@wps.com',        '03001110029', '20 Green Rd, Gulberg, Lahore',            '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '2000-01-30', '3520111111129'),
('U030', 'Victim Saima Riaz',       'victim.saima@wps.com',        '03001110030', '22 Green Rd, Model Town, Lahore',         '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '1998-10-11', '3520111111130'),
('U031', 'Victim Lubna Tariq',      'victim.lubna@wps.com',        '03001110031', '30 Blue Ave, Johar Town, Lahore',         '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '1997-04-18', '4210111111131'),
('U032', 'Victim Shazia Iqbal',     'victim.shazia@wps.com',       '03001110032', '32 Blue Ave, Bahria Town, Lahore',        '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '2001-08-25', '4210111111132'),
('U033', 'Victim Razia Sultan',     'victim.razia@wps.com',        '03001110033', '12 Bright St, Wapda Town, Lahore',        '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '1995-02-14', '6110111111133'),
('U034', 'Victim Tahira Batool',    'victim.tahira@wps.com',       '03001110034', '14 Bright St, Gulberg, Lahore',           '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '1999-06-07', '6110111111134'),
('U035', 'Victim Nasreen Akhtar',   'victim.nasreen@wps.com',      '03001110035', '6 Sun Lane, Model Town, Lahore',          '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '1996-12-20', '1710111111135'),
('U036', 'Victim Parveen Bibi',     'victim.parveen@wps.com',      '03001110036', '8 Sun Lane, Johar Town, Lahore',          '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '2003-03-03', '1710111111136'),
('U037', 'Victim Ghazala Noor',     'victim.ghazala@wps.com',      '03001110037', '16 Dawn St, Bahria Town, Lahore',         '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '1994-09-14', '5110111111137'),
('U038', 'Victim Bushra Anjum',     'victim.bushra@wps.com',       '03001110038', '18 Dawn St, Wapda Town, Lahore',          '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '2000-05-29', '5110111111138'),
('U039', 'Victim Asma Waheed',      'victim.asma@wps.com',         '03001110039', '40 River Rd, Gulberg, Lahore',            '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '1997-07-16', '3520111111139'),
('U040', 'Victim Uzma Saleem',      'victim.uzma@wps.com',         '03001110040', '42 River Rd, Model Town, Lahore',         '$2b$10$0xWuBNTVfVGky26TBEEtHOgab5TPaKjsH3r41jUsLxUtcA1OKylgq', '2002-11-08', '3520111111140');

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
INSERT INTO Admin (User_id) VALUES
('U001'),
('U002'),
('U003');

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
-- Availability = Yes so trigger allows assignment
-- Centre_id attached for location tracking
-- 2 volunteers per centre
-- =============================
INSERT INTO Volunteer (User_id, Status, Availability, Emergency_contact, Centre_id) VALUES
('U009', NULL, 'Yes', '03009991001', 'C001'),
('U010', NULL, 'Yes', '03009991002', 'C001'),
('U011', NULL, 'Yes', '03009991003', 'C002'),
('U012', NULL, 'Yes', '03009991004', 'C002'),
('U013', NULL, 'Yes', '03009991005', 'C003'),
('U014', NULL, 'Yes', '03009991006', 'C003'),
('U015', NULL, 'Yes', '03009991007', 'C004'),
('U016', NULL, 'Yes', '03009991008', 'C004'),
('U017', NULL, 'Yes', '03009991009', 'C005'),
('U018', NULL, 'Yes', '03009991010', 'C005');

-- =============================
-- POLICE SERVICES (one per centre)
-- =============================
INSERT INTO Police_services (Centre_id, Location, Centre_number, Status) VALUES
('C001', 'Gulberg Police Station, Lahore',      '042-99901', 'Pending'),
('C002', 'Model Town Police Station, Lahore',   '042-99902', 'Pending'),
('C003', 'Johar Town Police Station, Lahore',   '042-99903', 'Pending'),
('C004', 'Bahria Town Police Station, Lahore',  '042-99904', 'Pending'),
('C005', 'Wapda Town Police Station, Lahore',   '042-99905', 'Pending');

-- =============================
-- AMBULANCE SERVICES (10 ambulances)
-- =============================
INSERT INTO Ambulance_service (Ambulance_id, Relevant_hospital, Location, Contact_info, Status) VALUES
('AMB001', 'Services Hospital, Lahore',         'Jail Road, Lahore',              '1122',       'Pending'),
('AMB002', 'Lahore General Hospital',           'Jail Road, Lahore',              '03021122001','Pending'),
('AMB003', 'Mayo Hospital, Lahore',             'Nila Gumbad, Lahore',            '042-9921604','Pending'),
('AMB004', 'Jinnah Hospital, Lahore',           'Jail Road, Lahore',              '042-9920053','Pending'),
('AMB005', 'Ganga Ram Hospital, Lahore',        'Mall Road, Lahore',              '042-3576611','Pending'),
('AMB006', 'Ittefaq Hospital, Lahore',          'Model Town, Lahore',             '042-3571811','Pending'),
('AMB007', 'Sheikh Zayed Hospital, Lahore',     'University Avenue, Lahore',      '042-9923100','Pending'),
('AMB008', 'Doctors Hospital, Lahore',          'Johar Town, Lahore',             '042-3591055','Pending'),
('AMB009', 'Hameed Latif Hospital, Lahore',     'Gulberg III, Lahore',            '042-3576001','Pending'),
('AMB010', 'National Hospital, Lahore',         'DHA Phase 1, Lahore',            '042-3517477','Pending');

-- =============================
-- REQUEST LOGS (20 requests)
-- =============================
INSERT INTO Request_log (Request_id, Victim_id, Dispatcher_id, Note, Location, Type) VALUES
('R001', 'U019', 'U004', 'Victim reported domestic violence at home, needs immediate help.',       'Gulberg III, Lahore',            'Emergency'),
('R002', 'U020', 'U005', 'Victim is being followed and feels unsafe near her workplace.',          'Model Town, Lahore',             'Emergency'),
('R003', 'U021', 'U006', 'Victim assaulted by unknown person near her university.',                'Johar Town, Lahore',             'Emergency'),
('R004', 'U022', 'U007', 'Husband threatening with weapon, neighbours confirmed incident.',        'Bahria Town, Lahore',            'Emergency'),
('R005', 'U023', 'U008', 'Victim kidnapped and released, requesting immediate assistance.',        'Wapda Town, Lahore',             'Emergency'),
('R006', 'U024', 'U004', 'Victim harassed repeatedly by coworker, needs legal assistance.',       'Gulberg II, Lahore',             'Emergency'),
('R007', 'U025', 'U005', 'Victim stalked for weeks, attacker now outside her home.',              'Model Town Extension, Lahore',   'Emergency'),
('R008', 'U026', 'U006', 'Victim reported sexual assault, needs medical and legal support.',      'Johar Town Block A, Lahore',     'Emergency'),
('R009', 'U027', 'U007', 'Victim collapsed after beating, needs ambulance immediately.',          'Bahria Town Phase 4, Lahore',    'Emergency'),
('R010', 'U028', 'U008', 'Victim escaped kidnapping attempt, traumatized and needs help.',        'Wapda Town Phase 1, Lahore',     'Emergency'),
('R011', 'U029', 'U004', 'Victim reported ongoing domestic abuse, wants legal protection.',       'Gulberg I, Lahore',              'Emergency'),
('R012', 'U030', 'U005', 'Victim stalked on social media and physically in neighbourhood.',       'Model Town Park, Lahore',        'Emergency'),
('R013', 'U031', 'U006', 'Victim received death threats from ex-partner.',                        'Johar Town Block D, Lahore',     'Emergency'),
('R014', 'U032', 'U007', 'Victim beaten by family members, needs medical attention.',             'Bahria Town Phase 2, Lahore',    'Emergency'),
('R015', 'U033', 'U008', 'Victim reported harassment at workplace, wants formal complaint.',      'Wapda Town Block B, Lahore',     'Emergency'),
('R016', 'U034', 'U004', 'Victim reports neighbour breaking into her house repeatedly.',          'Gulberg Main Boulevard, Lahore', 'Emergency'),
('R017', 'U035', 'U005', 'Victim assaulted outside mall, attacker fled the scene.',               'Model Town Link Rd, Lahore',     'Emergency'),
('R018', 'U036', 'U006', 'Victim medical emergency after domestic violence incident.',             'Johar Town Phase 2, Lahore',     'Emergency'),
('R019', 'U037', 'U007', 'Victim trapped at home by abusive partner, cannot leave.',              'Bahria Town Phase 6, Lahore',    'Emergency'),
('R020', 'U038', 'U008', 'Victim requesting query about legal options for domestic abuse.',        'Wapda Town Phase 2, Lahore',     'Query');

-- =============================
-- INCIDENTS (20 incidents)
-- =============================
INSERT INTO Incident (Incident_id, Request_id, Emergency_type, Severity, Note, Location, Verification_status, Status) VALUES
('I001', 'R001', 'Domestic Violence', 'High',   'Husband threatening with weapon, neighbours confirmed.',           'Gulberg III, Lahore',            'True',  'Completed'),
('I002', 'R002', 'Stalking',          'Medium', 'Unknown male following victim for 3 days near office.',            'Model Town, Lahore',             'True',  'Completed'),
('I003', 'R003', 'Sexual Assault',    'High',   'Victim assaulted near university campus, medical help needed.',    'Johar Town, Lahore',             'True',  'Completed'),
('I004', 'R004', 'Domestic Violence', 'High',   'Husband armed and violent, children also present at scene.',       'Bahria Town, Lahore',            'True',  'Completed'),
('I005', 'R005', 'Kidnapping',        'High',   'Victim released but in shock, needs counselling and protection.',  'Wapda Town, Lahore',             'True',  'Completed'),
('I006', 'R006', 'Harassment',        'Medium', 'Coworker harassment confirmed by HR records and witnesses.',       'Gulberg II, Lahore',             'True',  'Ongoing'),
('I007', 'R007', 'Stalking',          'High',   'Attacker identified via CCTV footage outside victim home.',        'Model Town Extension, Lahore',   'True',  'Ongoing'),
('I008', 'R008', 'Sexual Assault',    'High',   'Medical examination confirmed assault, FIR registered.',           'Johar Town Block A, Lahore',     'True',  'Ongoing'),
('I009', 'R009', 'Domestic Violence', 'High',   'Victim has multiple injuries, attacker is spouse.',                'Bahria Town Phase 4, Lahore',    'True',  'Ongoing'),
('I010', 'R010', 'Kidnapping',        'Medium', 'Victim escaped vehicle, attacker unknown, investigation ongoing.', 'Wapda Town Phase 1, Lahore',     'True',  'Ongoing'),
('I011', 'R011', 'Domestic Violence', 'Medium', 'Repeated abuse reported over 6 months, documentation available.',  'Gulberg I, Lahore',              'True',  'Pending'),
('I012', 'R012', 'Stalking',          'Medium', 'Online and physical stalking confirmed, screenshots provided.',    'Model Town Park, Lahore',        'True',  'Pending'),
('I013', 'R013', 'Harassment',        'High',   'Death threats via messages, ex-partner identified.',               'Johar Town Block D, Lahore',     'True',  'Pending'),
('I014', 'R014', 'Domestic Violence', 'High',   'Multiple family members involved, victim has head injuries.',      'Bahria Town Phase 2, Lahore',    'True',  'Pending'),
('I015', 'R015', 'Harassment',        'Low',    'Workplace harassment documented, witness statements collected.',   'Wapda Town Block B, Lahore',     'True',  'Pending'),
('I016', 'R016', 'Harassment',        'Medium', 'Neighbour breaks in regularly, evidence collected by police.',     'Gulberg Main Boulevard, Lahore', 'True',  'Pending'),
('I017', 'R017', 'Sexual Assault',    'High',   'CCTV footage recovered, attacker identification in progress.',     'Model Town Link Rd, Lahore',     'True',  'Pending'),
('I018', 'R018', 'Medical Emergency', 'High',   'Victim has fractured ribs and internal bleeding after assault.',   'Johar Town Phase 2, Lahore',     'True',  'Pending'),
('I019', 'R019', 'Domestic Violence', 'High',   'Partner blocking all exits, neighbours called for help.',          'Bahria Town Phase 6, Lahore',    'True',  'Pending'),
('I020', 'R020', 'Harassment',        'Low',    'Query about legal options, no immediate physical threat reported.','Wapda Town Phase 2, Lahore',     'False', 'Pending');

-- =============================
-- ASSIGNMENTS (20 assignments)
-- =============================
INSERT INTO Assignment (Assignment_id, Incident_id, Police_id, Ambulance_id, Status) VALUES
('A001', 'I001', 'C001', 'AMB001', 'Completed'),
('A002', 'I002', 'C002', 'AMB003', 'Completed'),
('A003', 'I003', 'C003', 'AMB005', 'Completed'),
('A004', 'I004', 'C004', 'AMB007', 'Completed'),
('A005', 'I005', 'C005', 'AMB009', 'Completed'),
('A006', 'I006', 'C001', 'AMB002', 'Ongoing'),
('A007', 'I007', 'C002', 'AMB004', 'Ongoing'),
('A008', 'I008', 'C003', 'AMB006', 'Ongoing'),
('A009', 'I009', 'C004', 'AMB008', 'Ongoing'),
('A010', 'I010', 'C005', 'AMB010', 'Ongoing'),
('A011', 'I011', 'C001', 'AMB001', 'Pending'),
('A012', 'I012', 'C002', 'AMB003', 'Pending'),
('A013', 'I013', 'C003', 'AMB005', 'Pending'),
('A014', 'I014', 'C004', 'AMB007', 'Pending'),
('A015', 'I015', 'C005', 'AMB009', 'Pending'),
('A016', 'I016', 'C001', 'AMB002', 'Pending'),
('A017', 'I017', 'C002', 'AMB004', 'Pending'),
('A018', 'I018', 'C003', 'AMB006', 'Pending'),
('A019', 'I019', 'C004', 'AMB008', 'Pending'),
('A020', 'I020', 'C005', NULL,     'Pending');

-- =============================
-- VOLUNTEER ASSIGNMENTS (20)
-- Each volunteer assigned to 2 assignments
-- Trigger requires Availability = Yes (set above)
-- =============================
INSERT INTO Volunteer_assignment (Vol_assignment_id, Volunteer_id, Assignment_id) VALUES
('VA001', 'U009', 'A001'),
('VA002', 'U010', 'A002'),
('VA003', 'U011', 'A003'),
('VA004', 'U012', 'A004'),
('VA005', 'U013', 'A005'),
('VA006', 'U014', 'A006'),
('VA007', 'U015', 'A007'),
('VA008', 'U016', 'A008'),
('VA009', 'U017', 'A009'),
('VA010', 'U018', 'A010'),
('VA011', 'U009', 'A011'),
('VA012', 'U010', 'A012'),
('VA013', 'U011', 'A013'),
('VA014', 'U012', 'A014'),
('VA015', 'U013', 'A015'),
('VA016', 'U014', 'A016'),
('VA017', 'U015', 'A017'),
('VA018', 'U016', 'A018'),
('VA019', 'U017', 'A019'),
('VA020', 'U018', 'A020');

-- =============================
-- LAW CASES (20 cases)
-- =============================
INSERT INTO Law_case (Law_case_id, Incident_id, Lawfirm_name, Status, Case_type) VALUES
('LC001', 'I001', 'Hassan & Associates',        'Completed', 'Penalty'),
('LC002', 'I002', 'Rizvi Legal Services',       'Completed', 'Support'),
('LC003', 'I003', 'Sheikh Law Firm',            'Completed', 'Penalty'),
('LC004', 'I004', 'Barrister Nawaz & Co',       'Completed', 'Penalty'),
('LC005', 'I005', 'Malik Legal Aid',            'Completed', 'Support'),
('LC006', 'I006', 'Chaudhry Law Associates',    'Ongoing',   'Penalty'),
('LC007', 'I007', 'Ali & Partners',             'Ongoing',   'Support'),
('LC008', 'I008', 'Qureshi Legal Group',        'Ongoing',   'Penalty'),
('LC009', 'I009', 'Siddiqui Law Chamber',       'Ongoing',   'Support'),
('LC010', 'I010', 'Farooqi & Associates',       'Ongoing',   'Penalty'),
('LC011', 'I011', 'Hassan & Associates',        'Pending',   'Support'),
('LC012', 'I012', 'Rizvi Legal Services',       'Pending',   'Penalty'),
('LC013', 'I013', 'Sheikh Law Firm',            'Pending',   'Penalty'),
('LC014', 'I014', 'Barrister Nawaz & Co',       'Pending',   'Support'),
('LC015', 'I015', 'Malik Legal Aid',            'Pending',   'Support'),
('LC016', 'I016', 'Chaudhry Law Associates',    'Pending',   'Penalty'),
('LC017', 'I017', 'Ali & Partners',             'Pending',   'Penalty'),
('LC018', 'I018', 'Qureshi Legal Group',        'Pending',   'Support'),
('LC019', 'I019', 'Siddiqui Law Chamber',       'Pending',   'Support'),
('LC020', 'I020', 'Farooqi & Associates',       'Pending',   'Support');

-- =============================
-- FOLLOW UP SUPPORT (20 records)
-- =============================
INSERT INTO Follow_up_support (follow_up_id, Assignment_id, Referred_centre, Status, Case_type) VALUES
('FS001', 'A001', 'Gulberg Women Shelter Home',         'Completed', 'Support'),
('FS002', 'A002', 'Model Town Crisis Support Centre',   'Completed', 'Support'),
('FS003', 'A003', 'Johar Town Safe House',              'Completed', 'Support'),
('FS004', 'A004', 'Bahria Town Women Bureau',           'Completed', 'Support'),
('FS005', 'A005', 'Wapda Town Rehabilitation Centre',   'Completed', 'Support'),
('FS006', 'A006', 'Gulberg Counselling Centre',         'Ongoing',   'Support'),
('FS007', 'A007', 'Model Town Women Legal Aid',         'Ongoing',   'Support'),
('FS008', 'A008', 'Johar Town Trauma Centre',           'Ongoing',   'Support'),
('FS009', 'A009', 'Bahria Town Crisis Centre',          'Ongoing',   'Support'),
('FS010', 'A010', 'Wapda Town Safe House',              'Ongoing',   'Support'),
('FS011', 'A011', 'Gulberg Women Shelter Home',         'Pending',   'Support'),
('FS012', 'A012', 'Model Town Crisis Support Centre',   'Pending',   'Support'),
('FS013', 'A013', 'Johar Town Safe House',              'Pending',   'Support'),
('FS014', 'A014', 'Bahria Town Women Bureau',           'Pending',   'Support'),
('FS015', 'A015', 'Wapda Town Rehabilitation Centre',   'Pending',   'Support'),
('FS016', 'A016', 'Gulberg Counselling Centre',         'Pending',   'Penalty'),
('FS017', 'A017', 'Model Town Women Legal Aid',         'Pending',   'Penalty'),
('FS018', 'A018', 'Johar Town Trauma Centre',           'Pending',   'Support'),
('FS019', 'A019', 'Bahria Town Crisis Centre',          'Pending',   'Support'),
('FS020', 'A020', 'Wapda Town Safe House',              'Pending',   'Support');

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