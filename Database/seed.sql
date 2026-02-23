USE womenprotectionservicesdb;

SET SQL_SAFE_UPDATES = 0;
SET FOREIGN_KEY_CHECKS = 0;

-- DELETE FROM Follow_up_support;
-- DELETE FROM Volunteer_assignment;
-- DELETE FROM Law_case;
-- DELETE FROM Assignment;
-- DELETE FROM Volunteer;
-- DELETE FROM Incident;
-- DELETE FROM Ambulance_service;
-- DELETE FROM Police_services;
-- DELETE FROM Request_log;
-- DELETE FROM Victim;
-- DELETE FROM Dispatcher;
-- DELETE FROM Admin;
-- DELETE FROM Centre;
-- DELETE FROM User;

-- =====================================================
-- 1. INSERT INTO User TABLE (35 records)
-- =====================================================
INSERT INTO User (User_id, Name, Phone_no, Address, Age) VALUES
-- Dispatchers (10)
('DISP001', 'Sarah Johnson', '555-1001', '123 Main St, New York, NY', 32),
('DISP002', 'Emily Davis', '555-1002', '456 Oak Ave, Los Angeles, CA', 28),
('DISP003', 'Maria Garcia', '555-1003', '789 Pine Rd, Chicago, IL', 45),
('DISP004', 'Jennifer Brown', '555-1004', '321 Elm St, Houston, TX', 35),
('DISP005', 'Lisa Wilson', '555-1005', '654 Maple Dr, Phoenix, AZ', 29),
('DISP006', 'Linda Martinez', '555-1006', '987 Cedar Ln, Philadelphia, PA', 41),
('DISP007', 'Patricia Anderson', '555-1007', '147 Birch Ave, San Antonio, TX', 33),
('DISP008', 'Elizabeth Thomas', '555-1008', '258 Spruce Ct, San Diego, CA', 27),
('DISP009', 'Susan Jackson', '555-1009', '369 Willow Way, Dallas, TX', 38),
('DISP010', 'Jessica White', '555-1010', '741 Poplar St, San Jose, CA', 31),

-- Victims (15)
('VIC001', 'Margaret Harris', '555-2001', '852 Sycamore Dr, Austin, TX', 44),
('VIC002', 'Dorothy Martin', '555-2002', '963 Magnolia Ln, Jacksonville, FL', 52),
('VIC003', 'Karen Thompson', '555-2003', '159 Acacia Rd, Fort Worth, TX', 26),
('VIC004', 'Nancy Garcia', '555-2004', '753 Cypress Ct, Columbus, OH', 39),
('VIC005', 'Betty Robinson', '555-2005', '951 Beech Way, Charlotte, NC', 47),
('VIC006', 'Helen Clark', '555-2006', '654 Holly Ave, Detroit, MI', 55),
('VIC007', 'Sandra Lewis', '555-2007', '321 Juniper St, El Paso, TX', 29),
('VIC008', 'Donna Lee', '555-2008', '789 Willow Ln, Seattle, WA', 34),
('VIC009', 'Carol Walker', '555-2009', '147 Cherry Dr, Denver, CO', 42),
('VIC010', 'Ruth Hall', '555-2010', '258 Plum Rd, Washington, DC', 37),
('VIC011', 'Sharon Allen', '555-2011', '369 Peach Ct, Boston, MA', 48),
('VIC012', 'Michelle Young', '555-2012', '741 Nectarine Way, Nashville, TN', 30),
('VIC013', 'Laura King', '555-2013', '852 Orange Ave, Portland, OR', 33),
('VIC014', 'Sarah Wright', '555-2014', '963 Lemon St, Las Vegas, NV', 41),
('VIC015', 'Kimberly Scott', '555-2015', '159 Lime Dr, Louisville, KY', 36),

-- Volunteers (10) - INCREASED TO 10 VOLUNTEERS
('VOL001', 'Deborah Green', '555-3001', '753 Grape Ln, Baltimore, MD', 44),
('VOL002', 'Amanda Adams', '555-3002', '951 Berry Rd, Milwaukee, WI', 28),
('VOL003', 'Stephanie Baker', '555-3003', '654 Apple Ct, Albuquerque, NM', 39),
('VOL004', 'Rebecca Gonzalez', '555-3004', '321 Pear Ave, Tucson, AZ', 46),
('VOL005', 'Catherine Nelson', '555-3005', '789 Peach St, Fresno, CA', 35),
('VOL006', 'Patricia Moore', '555-3006', '123 Cedar Rd, Portland, OR', 41),
('VOL007', 'Jennifer Lee', '555-3007', '456 Birch Ave, Seattle, WA', 38),
('VOL008', 'Elizabeth Walker', '555-3008', '789 Spruce Ln, Denver, CO', 33),
('VOL009', 'Susan Hall', '555-3009', '321 Fir St, Boston, MA', 45),
('VOL010', 'Margaret Young', '555-3010', '654 Redwood Dr, Nashville, TN', 29);

-- =====================================================
-- 2. INSERT INTO Centre TABLE (8 records)
-- =====================================================
INSERT INTO Centre (Centre_id, Location, Centre_number) VALUES
('CENT001', 'Downtown Safety Hub - New York, NY', '212-555-9001'),
('CENT002', 'Westside Women Shelter - Los Angeles, CA', '213-555-9002'),
('CENT003', 'Harbor Protection Center - Chicago, IL', '312-555-9003'),
('CENT004', 'Central Women Aid - Houston, TX', '713-555-9004'),
('CENT005', 'Desert Rose Shelter - Phoenix, AZ', '602-555-9005'),
('CENT006', 'Liberty Women Center - Philadelphia, PA', '215-555-9006'),
('CENT007', 'Alamo Support Hub - San Antonio, TX', '210-555-9007'),
('CENT008', 'Pacific Safety House - San Diego, CA', '619-555-9008');

-- =====================================================
-- 3. INSERT INTO Dispatcher TABLE (10 records)
-- =====================================================
INSERT INTO Dispatcher (User_id, Centre_id, Availability) VALUES
('DISP001', 'CENT001', 'No'),   -- Currently busy
('DISP002', 'CENT002', 'Yes'),  -- Available
('DISP003', 'CENT003', 'No'),   -- Busy
('DISP004', 'CENT004', 'Yes'),  -- Available
('DISP005', 'CENT005', 'Yes'),  -- Available
('DISP006', 'CENT006', 'No'),   -- Busy
('DISP007', 'CENT007', 'Yes'),  -- Available
('DISP008', 'CENT008', 'No'),   -- Busy
('DISP009', 'CENT001', 'Yes'),  -- Available
('DISP010', 'CENT002', 'Yes');  -- Available

-- =====================================================
-- 4. INSERT INTO Victim TABLE (15 records)
-- =====================================================
INSERT INTO Victim (User_id, Emergency_contact, Emergency_contact2) VALUES
('VIC001', '555-9111', '555-9112'),
('VIC002', '555-9113', '555-9114'),
('VIC003', '555-9115', '555-9116'),
('VIC004', '555-9117', '555-9118'),
('VIC005', '555-9119', '555-9120'),
('VIC006', '555-9121', '555-9122'),
('VIC007', '555-9123', '555-9124'),
('VIC008', '555-9125', '555-9126'),
('VIC009', '555-9127', '555-9128'),
('VIC010', '555-9129', '555-9130'),
('VIC011', '555-9131', '555-9132'),
('VIC012', '555-9133', '555-9134'),
('VIC013', '555-9135', '555-9136'),
('VIC014', '555-9137', '555-9138'),
('VIC015', '555-9139', '555-9140');

-- =====================================================
-- 5. INSERT INTO Request_log TABLE (25 records)
-- =====================================================
INSERT INTO Request_log (Request_id, Request_time, Victim_id, Dispatcher_id, Note, Type) VALUES
('REQ001', '2026-02-20 08:30:00', 'VIC001', 'DISP001', 'Domestic violence in progress at residence', 'Emergency'),
('REQ002', '2026-02-20 09:15:00', 'VIC002', 'DISP002', 'Need information about shelter availability', 'Query'),
('REQ003', '2026-02-20 10:00:00', 'VIC003', 'DISP003', 'Medical emergency - victim injured', 'Emergency'),
('REQ004', '2026-02-20 10:45:00', 'VIC004', 'DISP004', 'False alarm - mistaken identity', 'False'),
('REQ005', '2026-02-20 11:30:00', 'VIC005', 'DISP005', 'Harassment report from workplace', 'Emergency'),
('REQ006', '2026-02-20 12:15:00', 'VIC006', 'DISP006', 'Request for legal aid consultation', 'Query'),
('REQ007', '2026-02-20 13:00:00', 'VIC007', 'DISP007', 'Stalking incident reported', 'Emergency'),
('REQ008', '2026-02-20 13:45:00', 'VIC008', 'DISP008', 'Test call - no emergency', 'False'),
('REQ009', '2026-02-20 14:30:00', 'VIC009', 'DISP009', 'Domestic violence - child present', 'Emergency'),
('REQ010', '2026-02-20 15:15:00', 'VIC010', 'DISP010', 'Follow-up on previous case', 'Query'),
('REQ011', '2026-02-20 16:00:00', 'VIC011', 'DISP001', 'Sexual assault report', 'Emergency'),
('REQ012', '2026-02-20 16:45:00', 'VIC012', 'DISP002', 'Medical emergency - panic attack', 'Emergency'),
('REQ013', '2026-02-21 08:00:00', 'VIC013', 'DISP003', 'Kidnapping threat', 'Emergency'),
('REQ014', '2026-02-21 08:45:00', 'VIC014', 'DISP004', 'Shelter space inquiry', 'Query'),
('REQ015', '2026-02-21 09:30:00', 'VIC015', 'DISP005', 'Prank call - disconnected', 'False'),
('REQ016', '2026-02-21 10:15:00', 'VIC001', 'DISP006', 'Repeat domestic violence incident', 'Emergency'),
('REQ017', '2026-02-21 11:00:00', 'VIC002', 'DISP007', 'Legal advice for custody case', 'Query'),
('REQ018', '2026-02-21 11:45:00', 'VIC003', 'DISP008', 'Harassment from ex-partner', 'Emergency'),
('REQ019', '2026-02-21 12:30:00', 'VIC004', 'DISP009', 'Medical assistance for injuries', 'Emergency'),
('REQ020', '2026-02-21 13:15:00', 'VIC005', 'DISP010', 'Wrong number - false report', 'False'),
('REQ021', '2026-02-21 14:00:00', 'VIC006', 'DISP001', 'Stalking at workplace', 'Emergency'),
('REQ022', '2026-02-21 14:45:00', 'VIC007', 'DISP002', 'Counseling services request', 'Query'),
('REQ023', '2026-02-21 15:30:00', 'VIC008', 'DISP003', 'Domestic violence - urgent', 'Emergency'),
('REQ024', '2026-02-21 16:15:00', 'VIC009', 'DISP004', 'Ambulance needed for victim', 'Emergency'),
('REQ025', '2026-02-21 17:00:00', 'VIC010', 'DISP005', 'Follow-up on shelter assignment', 'Query');

-- =====================================================
-- 6. INSERT INTO Police_services TABLE (8 records)
-- =====================================================
INSERT INTO Police_services (Centre_id, Location, Centre_number, Status) VALUES
('CENT001', 'NYPD Precinct 1 - New York, NY', '212-555-8001', 'Pending'),
('CENT002', 'LAPD West Division - Los Angeles, CA', '213-555-8002', 'Ongoing'),
('CENT003', 'CPD Central District - Chicago, IL', '312-555-8003', 'Arrived'),
('CENT004', 'HPD Southeast - Houston, TX', '713-555-8004', 'Pending'),
('CENT005', 'Phoenix PD North - Phoenix, AZ', '602-555-8005', 'Ongoing'),
('CENT006', 'Philadelphia PD East - Philadelphia, PA', '215-555-8006', 'Arrived'),
('CENT007', 'San Antonio PD South - San Antonio, TX', '210-555-8007', 'Pending'),
('CENT008', 'San Diego PD Central - San Diego, CA', '619-555-8008', 'Ongoing');

-- =====================================================
-- 7. INSERT INTO Ambulance_service TABLE (10 records)
-- =====================================================
INSERT INTO Ambulance_service (Ambulance_id, Relevant_hospital, Contact_info, Status) VALUES
('AMB001', 'NYC General Hospital', '212-555-7001', 'Pending'),
('AMB002', 'LA County Medical Center', '213-555-7002', 'Ongoing'),
('AMB003', 'Chicago Mercy Hospital', '312-555-7003', 'Arrived'),
('AMB004', 'Houston Memorial Hospital', '713-555-7004', 'Pending'),
('AMB005', 'Phoenix Regional Medical', '602-555-7005', 'Ongoing'),
('AMB006', 'Philadelphia University Hospital', '215-555-7006', 'Arrived'),
('AMB007', 'San Antonio General', '210-555-7007', 'Pending'),
('AMB008', 'San Diego Medical Center', '619-555-7008', 'Ongoing'),
('AMB009', 'Austin St. David\'s Hospital', '512-555-7009', 'Pending'),
('AMB010', 'Dallas Presbyterian', '214-555-7010', 'Ongoing');

-- =====================================================
-- 8. INSERT INTO Incident TABLE (20 records)
-- =====================================================
INSERT INTO Incident (Incident_id, Request_id, Emergency_type, Severity, Note, Location, Verification_status, Time, Status) VALUES
('INC001', 'REQ001', 'Domestic Violence', 'High', 'Physical altercation, husband aggressive', '123 Main St, New York, NY', 'True', '2026-02-20 08:35:00', 'Arrived'),
('INC002', 'REQ003', 'Medical Emergency', 'High', 'Victim has broken arm', '456 Oak Ave, Los Angeles, CA', 'True', '2026-02-20 10:05:00', 'Arrived'),
('INC003', 'REQ005', 'Harassment', 'Medium', 'Repeated threatening calls at work', '789 Pine Rd, Chicago, IL', 'True', '2026-02-20 11:35:00', 'Ongoing'),
('INC004', 'REQ007', 'Stalking', 'High', 'Suspect seen near victim\'s home', '321 Elm St, Houston, TX', 'True', '2026-02-20 13:05:00', 'Ongoing'),
('INC005', 'REQ009', 'Domestic Violence', 'High', 'Child present during altercation', '654 Maple Dr, Phoenix, AZ', 'True', '2026-02-20 14:35:00', 'Arrived'),
('INC006', 'REQ011', 'Sexual Assault', 'High', 'Recent assault, victim traumatized', '987 Cedar Ln, Philadelphia, PA', 'True', '2026-02-20 16:05:00', 'Ongoing'),
('INC007', 'REQ012', 'Medical Emergency', 'Medium', 'Severe anxiety attack', '147 Birch Ave, San Antonio, TX', 'True', '2026-02-20 16:50:00', 'Pending'),
('INC008', 'REQ013', 'Kidnapping', 'High', 'Child abduction reported', '258 Spruce Ct, San Diego, CA', 'True', '2026-02-21 08:05:00', 'Ongoing'),
('INC009', 'REQ016', 'Domestic Violence', 'High', 'Repeat incident, police needed', '369 Willow Way, Dallas, TX', 'True', '2026-02-21 10:20:00', 'Arrived'),
('INC010', 'REQ018', 'Harassment', 'Medium', 'Ex-partner sending threats', '741 Poplar St, San Jose, CA', 'True', '2026-02-21 11:50:00', 'Ongoing'),
('INC011', 'REQ019', 'Medical Emergency', 'High', 'Victim with visible injuries', '852 Sycamore Dr, Austin, TX', 'True', '2026-02-21 12:35:00', 'Pending'),
('INC012', 'REQ021', 'Stalking', 'Medium', 'Suspicious person at workplace', '963 Magnolia Ln, Jacksonville, FL', 'True', '2026-02-21 14:05:00', 'Ongoing'),
('INC013', 'REQ023', 'Domestic Violence', 'High', 'Urgent - violence in progress', '159 Acacia Rd, Fort Worth, TX', 'True', '2026-02-21 15:35:00', 'Arrived'),
('INC014', 'REQ024', 'Medical Emergency', 'High', 'Victim unconscious', '753 Cypress Ct, Columbus, OH', 'True', '2026-02-21 16:20:00', 'Pending'),
('INC015', 'REQ004', 'Harassment', 'Low', 'False report - no action needed', '951 Beech Way, Charlotte, NC', 'False', '2026-02-20 10:50:00', 'Arrived'),
('INC016', 'REQ008', 'Harassment', 'Low', 'Test call - verified false', '654 Holly Ave, Detroit, MI', 'False', '2026-02-20 13:50:00', 'Arrived'),
('INC017', 'REQ015', 'Harassment', 'Low', 'Prank call - disconnected', '321 Juniper St, El Paso, TX', 'False', '2026-02-21 09:35:00', 'Arrived'),
('INC018', 'REQ020', 'Harassment', 'Low', 'Wrong number - false report', '789 Willow Ln, Seattle, WA', 'False', '2026-02-21 13:20:00', 'Arrived'),
('INC019', 'REQ002', 'Harassment', 'Low', 'Information only - no incident', '147 Cherry Dr, Denver, CO', 'False', '2026-02-20 09:20:00', 'Pending'),
('INC020', 'REQ010', 'Harassment', 'Low', 'Follow-up only - no new incident', '258 Plum Rd, Washington, DC', 'False', '2026-02-20 15:20:00', 'Pending');

-- =====================================================
-- 9. INSERT INTO Volunteer TABLE (10 records) - ALL AVAILABLE
-- =====================================================
INSERT INTO Volunteer (User_id, Status, Availability) VALUES
('VOL001', 'Pending', 'Yes'),
('VOL002', 'Ongoing', 'Yes'),
('VOL003', 'Arrived', 'Yes'),
('VOL004', 'Pending', 'Yes'),
('VOL005', 'Ongoing', 'Yes'),
('VOL006', 'Pending', 'Yes'),
('VOL007', 'Ongoing', 'Yes'),
('VOL008', 'Arrived', 'Yes'),
('VOL009', 'Pending', 'Yes'),
('VOL010', 'Ongoing', 'Yes');

-- =====================================================
-- 10. INSERT INTO Assignment TABLE (20 records)
-- =====================================================
INSERT INTO Assignment (Assignment_id, Incident_id, Police_id, Ambulance_id, Assigned_time, Completion_time, Status) VALUES
('ASN001', 'INC001', 'CENT001', NULL, '2026-02-20 08:40:00', '2026-02-20 09:45:00', 'Arrived'),
('ASN002', 'INC002', 'CENT002', 'AMB001', '2026-02-20 10:10:00', '2026-02-20 11:30:00', 'Arrived'),
('ASN003', 'INC003', 'CENT003', NULL, '2026-02-20 11:40:00', NULL, 'Ongoing'),
('ASN004', 'INC004', 'CENT004', NULL, '2026-02-20 13:10:00', NULL, 'Ongoing'),
('ASN005', 'INC005', 'CENT005', NULL, '2026-02-20 14:40:00', '2026-02-20 16:00:00', 'Arrived'),
('ASN006', 'INC006', 'CENT006', 'AMB002', '2026-02-20 16:10:00', NULL, 'Ongoing'),
('ASN007', 'INC007', 'CENT007', NULL, '2026-02-20 16:55:00', NULL, 'Pending'),
('ASN008', 'INC008', 'CENT008', NULL, '2026-02-21 08:10:00', NULL, 'Ongoing'),
('ASN009', 'INC009', 'CENT001', NULL, '2026-02-21 10:25:00', '2026-02-21 11:45:00', 'Arrived'),
('ASN010', 'INC010', 'CENT002', NULL, '2026-02-21 11:55:00', NULL, 'Ongoing'),
('ASN011', 'INC011', 'CENT003', 'AMB003', '2026-02-21 12:40:00', NULL, 'Pending'),
('ASN012', 'INC012', 'CENT004', NULL, '2026-02-21 14:10:00', NULL, 'Ongoing'),
('ASN013', 'INC013', 'CENT005', 'AMB004', '2026-02-21 15:40:00', '2026-02-21 16:50:00', 'Arrived'),
('ASN014', 'INC014', 'CENT006', 'AMB005', '2026-02-21 16:25:00', NULL, 'Pending'),
('ASN015', 'INC015', 'CENT007', NULL, '2026-02-20 10:55:00', '2026-02-20 11:15:00', 'Arrived'),
('ASN016', 'INC016', 'CENT008', NULL, '2026-02-20 13:55:00', '2026-02-20 14:30:00', 'Arrived'),
('ASN017', 'INC017', 'CENT001', NULL, '2026-02-21 09:40:00', '2026-02-21 10:15:00', 'Arrived'),
('ASN018', 'INC018', 'CENT002', NULL, '2026-02-21 13:25:00', '2026-02-21 14:00:00', 'Arrived'),
('ASN019', 'INC019', 'CENT003', NULL, '2026-02-20 09:25:00', NULL, 'Pending'),
('ASN020', 'INC020', 'CENT004', NULL, '2026-02-20 15:25:00', NULL, 'Pending');

-- =====================================================
-- 11. INSERT INTO Volunteer_assignment TABLE (15 records)
-- Each volunteer gets assigned to different assignments
-- =====================================================
INSERT INTO Volunteer_assignment (Vol_assignment_id, Volunteer_id, Assignment_id) VALUES
('VOLASN001', 'VOL001', 'ASN001'),
('VOLASN002', 'VOL002', 'ASN002'),
('VOLASN003', 'VOL003', 'ASN003'),
('VOLASN004', 'VOL004', 'ASN004'),
('VOLASN005', 'VOL005', 'ASN005'),
('VOLASN006', 'VOL006', 'ASN006'),
('VOLASN007', 'VOL007', 'ASN007'),
('VOLASN008', 'VOL008', 'ASN008'),
('VOLASN009', 'VOL009', 'ASN009'),
('VOLASN010', 'VOL010', 'ASN010'),
('VOLASN011', 'VOL001', 'ASN011'),  -- VOL001 second assignment 
('VOLASN012', 'VOL002', 'ASN012'),  -- VOL002 second assignment
('VOLASN013', 'VOL003', 'ASN013'),  -- VOL003 second assignment
('VOLASN014', 'VOL004', 'ASN014'),  -- VOL004 second assignment
('VOLASN015', 'VOL005', 'ASN015');  -- VOL005 second assignment

-- =====================================================
-- 12. INSERT INTO Law_case TABLE (12 records)
-- =====================================================
INSERT INTO Law_case (Law_case_id, Incident_id, Lawfirm_name, Status, Case_type) VALUES
('LAW001', 'INC001', 'Johnson & Associates', 'Ongoing', 'Penalty'),
('LAW002', 'INC002', 'Smith Legal Services', 'Pending', 'Support'),
('LAW003', 'INC005', 'Davis Law Firm', 'Ongoing', 'Penalty'),
('LAW004', 'INC006', 'Martinez & Partners', 'Pending', 'Support'),
('LAW005', 'INC008', 'Wilson Legal Group', 'Ongoing', 'Penalty'),
('LAW006', 'INC009', 'Brown & Brown', 'Arrived', 'Support'),
('LAW007', 'INC011', 'Taylor Law Office', 'Pending', 'Support'),
('LAW008', 'INC013', 'Anderson Legal', 'Ongoing', 'Penalty'),
('LAW009', 'INC003', 'Thomas & Associates', 'Pending', 'Support'),
('LAW010', 'INC004', 'Jackson Law Firm', 'Ongoing', 'Penalty'),
('LAW011', 'INC007', 'White Legal Services', 'Pending', 'Support'),
('LAW012', 'INC010', 'Harris & Harris', 'Ongoing', 'Penalty');

-- =====================================================
-- 13. INSERT INTO Follow_up_support TABLE (12 records)
-- =====================================================
INSERT INTO Follow_up_support (follow_up_id, Assignment_id, Referred_centre, Status, Case_type) VALUES
('FOL001', 'ASN001', 'Downtown Counseling Center - NY', 'Arrived', 'Support'),
('FOL002', 'ASN002', 'Harbor Medical Services - LA', 'Ongoing', 'Support'),
('FOL003', 'ASN005', 'Desert Rose Shelter - AZ', 'Pending', 'Support'),
('FOL004', 'ASN009', 'Liberty Legal Aid - Dallas', 'Ongoing', 'Support'),
('FOL005', 'ASN013', 'Alamo Support Group - TX', 'Arrived', 'Support'),
('FOL006', 'ASN003', 'Pacific Crisis Center - CA', 'Pending', 'Support'),
('FOL007', 'ASN006', 'Central Women\'s Health - PA', 'Ongoing', 'Support'),
('FOL008', 'ASN008', 'Westside Family Services - CA', 'Pending', 'Support'),
('FOL009', 'ASN011', 'Harbor Children\'s Support - IL', 'Ongoing', 'Support'),
('FOL010', 'ASN014', 'Desert Rose Medical - AZ', 'Pending', 'Support'),
('FOL011', 'ASN016', 'Liberty Employment Services - PA', 'Arrived', 'Support'),
('FOL012', 'ASN018', 'Alamo Legal Clinic - TX', 'Ongoing', 'Support');

-- =====================================================
-- 14. INSERT INTO Admin TABLE (2 records)
-- =====================================================
INSERT INTO Admin (Admin_id, User_id, Password, Login) VALUES
('ADMIN001', 'DISP001', 'admin123hash', 'sarah.johnson'),
('ADMIN002', 'DISP003', 'admin456hash', 'maria.garcia');

SET FOREIGN_KEY_CHECKS = 1;
SET SQL_SAFE_UPDATES = 1;

-- ======================
-- Total Record Count
-- ======================
SELECT SUM(record_count) AS Total_Records_In_Database
FROM (
    SELECT COUNT(*) AS record_count FROM User UNION ALL
    SELECT COUNT(*) FROM Centre UNION ALL
    SELECT COUNT(*) FROM Dispatcher UNION ALL
    SELECT COUNT(*) FROM Victim UNION ALL
    SELECT COUNT(*) FROM Request_log UNION ALL
    SELECT COUNT(*) FROM Police_services UNION ALL
    SELECT COUNT(*) FROM Ambulance_service UNION ALL
    SELECT COUNT(*) FROM Incident UNION ALL
    SELECT COUNT(*) FROM Volunteer UNION ALL
    SELECT COUNT(*) FROM Assignment UNION ALL
    SELECT COUNT(*) FROM Volunteer_assignment UNION ALL
    SELECT COUNT(*) FROM Law_case UNION ALL
    SELECT COUNT(*) FROM Follow_up_support UNION ALL
    SELECT COUNT(*) FROM Admin
) AS totals;
