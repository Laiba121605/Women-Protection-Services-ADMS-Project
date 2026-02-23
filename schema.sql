CREATE DATABASE IF NOT EXISTS womenprotectionservicesdb;
USE womenprotectionservicesdb;

-- DROP TABLE IF EXISTS Follow_up_support;
-- DROP TABLE IF EXISTS Volunteer_assignment;
-- DROP TABLE IF EXISTS Law_case;
-- DROP TABLE IF EXISTS Assignment;
-- DROP TABLE IF EXISTS Volunteer;
-- DROP TABLE IF EXISTS Incident;
-- DROP TABLE IF EXISTS Ambulance_service;
-- DROP TABLE IF EXISTS Police_services;
-- DROP TABLE IF EXISTS Request_log;
-- DROP TABLE IF EXISTS Victim;
-- DROP TABLE IF EXISTS Dispatcher;
-- DROP TABLE IF EXISTS Admin;
-- DROP TABLE IF EXISTS Centre;
-- DROP TABLE IF EXISTS User;

-- =============================
-- PART 1: CREATE Tables
-- =============================


CREATE TABLE User (
    User_id VARCHAR(20) PRIMARY KEY,
    Name VARCHAR(100) NOT NULL,
    Phone_no VARCHAR(20) UNIQUE,
    Address VARCHAR(150),
    Age INT CHECK (Age >= 0)
);
CREATE TABLE Centre (
    Centre_id VARCHAR(20) PRIMARY KEY,
    Location VARCHAR(150) NOT NULL UNIQUE,
    Centre_number VARCHAR(20) NOT NULL
);
CREATE TABLE Dispatcher (
    User_id VARCHAR(20) PRIMARY KEY,
    Centre_id VARCHAR(100),
    Availability VARCHAR(20) CHECK (Availability IN ('Yes', 'No')),
    FOREIGN KEY (User_id) REFERENCES User(User_id),
    FOREIGN KEY (Centre_id) REFERENCES Centre(Centre_id)
);
CREATE TABLE Victim (
    User_id VARCHAR(20) PRIMARY KEY,
    Emergency_contact VARCHAR(20) NOT NULL,
    Emergency_contact2 VARCHAR(20),
    FOREIGN KEY (User_id) REFERENCES User(User_id)
);
CREATE TABLE Request_log (
    Request_id VARCHAR(20) PRIMARY KEY,
    Request_time TIMESTAMP NOT NULL,
    Victim_id VARCHAR(20),
    Dispatcher_id VARCHAR(20),
    Note VARCHAR(350) NOT NULL,
    Type VARCHAR(20) CHECK (Type IN ('False', 'Emergency', 'Query')),
    FOREIGN KEY (Victim_id) REFERENCES Victim(User_id),
    FOREIGN KEY (Dispatcher_id) REFERENCES Dispatcher(User_id)
);
CREATE TABLE Police_services (
    Centre_id VARCHAR(20) PRIMARY KEY,
    Location VARCHAR(150) NOT NULL,
    Centre_number VARCHAR(20) NOT NULL UNIQUE,
    Status VARCHAR(30) CHECK (Status IN ('Arrived', 'Ongoing', 'Pending')),
    FOREIGN KEY (Centre_id) REFERENCES Centre(Centre_id)
);
CREATE TABLE Ambulance_service (
    Ambulance_id VARCHAR(20) PRIMARY KEY,
    Relevant_hospital VARCHAR(150) NOT NULL,
    Contact_info VARCHAR(20) NOT NULL UNIQUE,
    Status VARCHAR(30) CHECK (Status IN ('Arrived', 'Ongoing', 'Pending'))
);
CREATE TABLE Incident (
    Incident_id VARCHAR(20) PRIMARY KEY,
    Request_id VARCHAR(20),
    Emergency_type VARCHAR(20) CHECK (Emergency_type IN ('Domestic Violence', 'Sexual Assault', 'Harassment', 'Kidnapping', 'Stalking', 'Medical Emergency')),
    Severity VARCHAR(30) CHECK (Severity IN ('High', 'Medium', 'Low')),
    Note VARCHAR(350),
    Location VARCHAR(150) NOT NULL,
    Verification_status VARCHAR(30) CHECK (Verification_status IN ('False', 'True')),
    Time TIMESTAMP NOT NULL,
    Status VARCHAR(30) CHECK (Status IN ('Arrived', 'Ongoing', 'Pending')),
    FOREIGN KEY (Request_id) REFERENCES Request_log(Request_id)
);
CREATE TABLE Volunteer (
    User_id VARCHAR(20) PRIMARY KEY,
    Status VARCHAR(30) CHECK (Status IN ('Arrived', 'Ongoing', 'Pending')),
    Availability VARCHAR(20) CHECK (Availability IN ('Yes', 'No')),
    FOREIGN KEY (User_id) REFERENCES User(User_id)
);
CREATE TABLE Assignment (
    Assignment_id VARCHAR(20) PRIMARY KEY,
    Incident_id VARCHAR(20),
    Police_id VARCHAR(20),
    Ambulance_id VARCHAR(20),
    Assigned_time TIMESTAMP NOT NULL,
    Completion_time TIMESTAMP,
    Status VARCHAR(30) CHECK (Status IN ('Arrived', 'Ongoing', 'Pending')),
    FOREIGN KEY (Incident_id) REFERENCES Incident(Incident_id),
    FOREIGN KEY (Police_id) REFERENCES Police_services(Centre_id),
    FOREIGN KEY (Ambulance_id) REFERENCES Ambulance_service(Ambulance_id)
);
CREATE TABLE Volunteer_assignment (
    Vol_assignment_id VARCHAR(20) PRIMARY KEY,
    Volunteer_id VARCHAR(20),
    Assignment_id VARCHAR(20),
    FOREIGN KEY (Volunteer_id) REFERENCES Volunteer(User_id),
    FOREIGN KEY (Assignment_id) REFERENCES Assignment(Assignment_id)
);
CREATE TABLE Law_case (
    Law_case_id VARCHAR(20) PRIMARY KEY,
    Incident_id VARCHAR(20),
    Lawfirm_name VARCHAR(100) NOT NULL,
    Status VARCHAR(30) CHECK (Status IN ('Arrived', 'Ongoing', 'Pending')),
    Case_type VARCHAR(30) CHECK (Case_type IN ('Support', 'Penalty')),
    FOREIGN KEY (Incident_id) REFERENCES Incident(Incident_id)
);
CREATE TABLE Follow_up_support (
    follow_up_id VARCHAR(20) PRIMARY KEY,
    Assignment_id VARCHAR(20),
    Referred_centre VARCHAR(100) NOT NULL,
    Status VARCHAR(30) CHECK (Status IN ('Arrived', 'Ongoing', 'Pending')),
    Case_type VARCHAR(30) CHECK (Case_type IN ('Support', 'Penalty')),
    FOREIGN KEY (Assignment_id) REFERENCES Assignment(Assignment_id)
);
CREATE TABLE Admin (
    Admin_id VARCHAR(20) PRIMARY KEY,
    User_id VARCHAR(20),
    Password VARCHAR(30) NOT NULL UNIQUE,
    Login VARCHAR(30) NOT NULL UNIQUE,
    FOREIGN KEY (User_id) REFERENCES User(User_id)
);
-- ================================
-- PART 2: CREATE Triggers
-- ================================
DELIMITER $$

-- Trigger 1: Volunteer should be available when assigning
CREATE TRIGGER check_volunteer_availability_before_insert
BEFORE INSERT ON Volunteer_assignment
FOR EACH ROW
BEGIN
    DECLARE vol_availability VARCHAR(20);
    SELECT Availability INTO vol_availability
    FROM Volunteer
    WHERE User_id = NEW.Volunteer_id;
    IF (vol_availability != 'Yes') 
    THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Volunteer is not available for assignment';
    END IF;
END$$

-- Trigger 2: Auto set completion time when assignment finishes
CREATE TRIGGER set_completion_time_on_finish
BEFORE UPDATE ON Assignment
FOR EACH ROW
BEGIN
    IF (NEW.Status = 'Arrived' AND OLD.Status != 'Arrived') 
    THEN
        SET NEW.Completion_time = CURRENT_TIMESTAMP();
    END IF;
END$$

-- Trigger 3: If assigned status is arrived then change incident status to complete
CREATE TRIGGER update_incident_status_on_assignment
AFTER UPDATE ON Assignment
FOR EACH ROW
BEGIN
    IF (NEW.Status = 'Arrived' AND OLD.Status != 'Arrived')
    THEN
        UPDATE Incident
        SET Status = 'Arrived'
        WHERE Incident_id = NEW.Incident_id;
    END IF;
END$$

-- Trigger 4: When dispatcher is assigned a request, mark dispatcher as unavailable
CREATE TRIGGER update_dispatcher_status_on_request
AFTER INSERT ON Request_log
FOR EACH ROW
BEGIN
    UPDATE Dispatcher
    SET Availability = 'No'
    WHERE User_id = NEW.Dispatcher_id;
END$$

-- Trigger 5: When an incident is resolved, check if dispatcher can be available
CREATE TRIGGER update_dispatcher_available_on_incident_resolution
AFTER UPDATE ON Incident
FOR EACH ROW
BEGIN
    DECLARE pending_incidents INT;
    DECLARE dispatcher_id_val VARCHAR(20);
    
    -- Only proceed if incident status changed to 'Arrived' (completed)
    IF NEW.Status = 'Arrived' AND OLD.Status != 'Arrived' THEN
        -- Get the dispatcher who handled this incident
        SELECT r.Dispatcher_id INTO dispatcher_id_val
        FROM Request_log r
        WHERE r.Request_id = NEW.Request_id;
        
        -- Count how many unresolved incidents this dispatcher still has
        SELECT COUNT(*) INTO pending_incidents
        FROM Incident i
        JOIN Request_log r ON i.Request_id = r.Request_id
        WHERE r.Dispatcher_id = dispatcher_id_val
        AND i.Status != 'Arrived';  -- Not completed
        
        -- If no pending incidents, dispatcher can be available
        IF pending_incidents = 0 THEN
            UPDATE Dispatcher
            SET Availability = 'Yes'
            WHERE User_id = dispatcher_id_val;
        END IF;
    END IF;
END$$

DELIMITER ;

-- ===============================
-- PART 3: CREATE Views
-- ===============================

-- DROP VIEW IF EXISTS victim_personal_view;
-- VIEW 1: Victim's View - Shows ONLY what a victim can see
-- A victim should see:
--   - Their own requests
--   - Their own incidents
--   - Status of their cases
--   - Follow-up support assigned to them
--   - Law cases related to their incidents 
CREATE VIEW victim_personal_view AS
SELECT 
    -- Victim personal info
    v.User_id AS Victim_ID,
    u.Name AS Victim_Name,
    u.Phone_no AS Victim_Phone,
    u.Address AS Victim_Address,
    
    -- Their requests
    r.Request_id,
    r.Request_time,
    r.Type AS Request_Type,
    r.Note AS Request_Note,
    
    -- Their incidents
    i.Incident_id,
    i.Emergency_type,
    i.Severity,
    i.Location AS Incident_Location,
    i.Time AS Incident_Time,
    i.Status AS Incident_Status,
    i.Verification_status,
    i.Note AS Incident_Note,
    
    -- Assignment status (what's being done about their incident)
    a.Assignment_id,
    a.Assigned_time,
    a.Completion_time,
    a.Status AS Assignment_Status,
    
    -- Police response (if assigned)
    ps.Centre_id AS Police_Centre,
    ps.Location AS Police_Location,
    ps.Status AS Police_Response_Status,
    
    -- Ambulance response (if assigned)
    amb.Ambulance_id,
    amb.Relevant_hospital,
    amb.Status AS Ambulance_Status,
    
    -- Legal case (if applicable)
    lc.Law_case_id,
    lc.Lawfirm_name,
    lc.Status AS Legal_Case_Status,
    lc.Case_type AS Legal_Case_Type,
    
    -- Follow-up support (counseling, etc.)
    fs.follow_up_id,
    fs.Referred_centre,
    fs.Status AS Followup_Status,
    fs.Case_type AS Followup_Type
    
FROM Victim v
JOIN User u ON v.User_id = u.User_id
LEFT JOIN Request_log r ON v.User_id = r.Victim_id
LEFT JOIN Incident i ON r.Request_id = i.Request_id
LEFT JOIN Assignment a ON i.Incident_id = a.Incident_id
LEFT JOIN Police_services ps ON a.Police_id = ps.Centre_id
LEFT JOIN Ambulance_service amb ON a.Ambulance_id = amb.Ambulance_id
LEFT JOIN Law_case lc ON i.Incident_id = lc.Incident_id
LEFT JOIN Follow_up_support fs ON a.Assignment_id = fs.Assignment_id;

-- DROP VIEW IF EXISTS volunteer_assigned_view;
-- VIEW 2: Volunteer's View - Shows ONLY what a volunteer can see
-- A volunteer should see:
--   - Their own assignments
--   - Incident details for cases they're assigned to
--   - Location and emergency type (need-to-know basis)
--   - Status of incidents they're helping with
CREATE VIEW volunteer_assigned_view AS
SELECT 
    -- Volunteer info
    vol.User_id AS Volunteer_ID,
    u_vol.Name AS Volunteer_Name,
    u_vol.Phone_no AS Volunteer_Phone,
    vol.Status AS Volunteer_Status,
    vol.Availability,
    
    -- Their assignments
    va.Vol_assignment_id,
    a.Assignment_id,
    a.Assigned_time,
    a.Completion_time,
    a.Status AS Assignment_Status,
    
    -- Incident details (only what volunteer needs to know)
    i.Incident_id,
    i.Emergency_type,
    i.Severity,
    i.Location AS Incident_Location,
    i.Time AS Incident_Time,
    i.Status AS Incident_Status,
    i.Note AS Incident_Note,  -- Important details for volunteer
    
    -- Resources assigned (so volunteer knows who else is responding)
    ps.Centre_id AS Police_Centre,
    ps.Status AS Police_Status,
    amb.Ambulance_id,
    amb.Status AS Ambulance_Status,
    
    -- Victim contact (only for communication)
    vic.User_id AS Victim_ID,
    u_vic.Name AS Victim_Name,
    u_vic.Phone_no AS Victim_Phone,  -- Need to contact victim
    
    -- Follow-up tasks
    fs.follow_up_id,
    fs.Referred_centre,
    fs.Status AS Followup_Status
    
FROM Volunteer vol
JOIN User u_vol ON vol.User_id = u_vol.User_id
LEFT JOIN Volunteer_assignment va ON vol.User_id = va.Volunteer_id
LEFT JOIN Assignment a ON va.Assignment_id = a.Assignment_id
LEFT JOIN Incident i ON a.Incident_id = i.Incident_id
LEFT JOIN Police_services ps ON a.Police_id = ps.Centre_id
LEFT JOIN Ambulance_service amb ON a.Ambulance_id = amb.Ambulance_id
LEFT JOIN Request_log r ON i.Request_id = r.Request_id
LEFT JOIN Victim vic ON r.Victim_id = vic.User_id
LEFT JOIN User u_vic ON vic.User_id = u_vic.User_id
LEFT JOIN Follow_up_support fs ON a.Assignment_id = fs.Assignment_id
WHERE va.Volunteer_id IS NOT NULL;  -- Only show assigned volunteers




