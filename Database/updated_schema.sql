-- =============================
-- CREATE DATABASE
-- =============================
CREATE DATABASE IF NOT EXISTS womenprotectionservicesdb;
USE womenprotectionservicesdb;

-- =============================
-- DROP VIEWS FIRST
-- =============================
DROP VIEW IF EXISTS volunteer_assigned_view;
DROP VIEW IF EXISTS victim_personal_view;

-- =============================
-- DROP TABLES IN CORRECT ORDER
-- =============================
DROP TABLE IF EXISTS Password_Recovery;
DROP TABLE IF EXISTS Follow_up_support;
DROP TABLE IF EXISTS Volunteer_assignment;
DROP TABLE IF EXISTS Law_case;
DROP TABLE IF EXISTS Assignment;
DROP TABLE IF EXISTS Volunteer;
DROP TABLE IF EXISTS Incident;
DROP TABLE IF EXISTS Ambulance_service;
DROP TABLE IF EXISTS Police_services;
DROP TABLE IF EXISTS Request_log;
DROP TABLE IF EXISTS Victim;
DROP TABLE IF EXISTS Dispatcher;
DROP TABLE IF EXISTS Admin;
DROP TABLE IF EXISTS Centre;
DROP TABLE IF EXISTS User;

-- =============================
-- CREATE TABLES
-- =============================
CREATE TABLE User (
    User_id VARCHAR(20) PRIMARY KEY,
    Name VARCHAR(100) NOT NULL,
    Email VARCHAR(100) UNIQUE NOT NULL,
    Phone_no VARCHAR(20) UNIQUE,
    Address VARCHAR(150),
    Password VARCHAR(255) NOT NULL,
    Date_of_Birth DATE NOT NULL,
    CNIC VARCHAR(15) UNIQUE NOT NULL
);

CREATE TABLE Centre (
    Centre_id VARCHAR(20) PRIMARY KEY,
    Location VARCHAR(150) NOT NULL UNIQUE,
    Centre_number VARCHAR(20) NOT NULL
);

CREATE TABLE Dispatcher (
    User_id VARCHAR(20) PRIMARY KEY,
    Centre_id VARCHAR(100) NOT NULL,
    Availability VARCHAR(20) CHECK (Availability IN ('Yes', 'No')),
    FOREIGN KEY (User_id) REFERENCES User(User_id),
    FOREIGN KEY (Centre_id) REFERENCES Centre(Centre_id)
);

CREATE TABLE Victim (
    User_id VARCHAR(20) PRIMARY KEY,
    Emergency_contact VARCHAR(20) NOT NULL,
    FOREIGN KEY (User_id) REFERENCES User(User_id)
);

CREATE TABLE Request_log (
    Request_id VARCHAR(20) PRIMARY KEY,
    Request_time TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),  -- ← changed
    Victim_id VARCHAR(20) NOT NULL,
    Dispatcher_id VARCHAR(20) NOT NULL,
    Note VARCHAR(350) NOT NULL,
    Location VARCHAR(150) NOT NULL,
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
    Location VARCHAR(150) NOT NULL,
    Contact_info VARCHAR(20) NOT NULL UNIQUE,
    Status VARCHAR(30) CHECK (Status IN ('Arrived', 'Ongoing', 'Pending'))
);

CREATE TABLE Incident (
    Incident_id VARCHAR(20) PRIMARY KEY,
    Request_id VARCHAR(20) NOT NULL,
    Emergency_type VARCHAR(20) CHECK (Emergency_type IN ('Domestic Violence', 'Sexual Assault', 'Harassment', 'Kidnapping', 'Stalking', 'Medical Emergency')),
    Severity VARCHAR(30) CHECK (Severity IN ('High', 'Medium', 'Low')),
    Note VARCHAR(350) NOT NULL,
    Location VARCHAR(150) NOT NULL,
    Verification_status VARCHAR(30) CHECK (Verification_status IN ('False', 'True')),
    Time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Status VARCHAR(30) CHECK (Status IN ('Completed', 'Ongoing', 'Pending')),
    FOREIGN KEY (Request_id) REFERENCES Request_log(Request_id)
);

CREATE TABLE Volunteer (
    User_id VARCHAR(20) PRIMARY KEY,
    Status VARCHAR(30) CHECK (Status IN ('Arrived', 'Ongoing', 'Pending')),
    Availability VARCHAR(20) CHECK (Availability IN ('Yes', 'No')),
    Emergency_contact VARCHAR(20) NOT NULL,
    Centre_id VARCHAR(20) NOT NULL,
    FOREIGN KEY (User_id) REFERENCES User(User_id),
    FOREIGN KEY (Centre_id) REFERENCES Centre(Centre_id)
);

CREATE TABLE Assignment (
    Assignment_id VARCHAR(20) PRIMARY KEY,
    Incident_id VARCHAR(20) NOT NULL,
    Police_id VARCHAR(20),
    Ambulance_id VARCHAR(20),
    Assigned_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Completion_time TIMESTAMP NULL DEFAULT NULL,
    Status VARCHAR(30) CHECK (Status IN ('Completed', 'Ongoing', 'Pending')),
    FOREIGN KEY (Incident_id) REFERENCES Incident(Incident_id),
    FOREIGN KEY (Police_id) REFERENCES Police_services(Centre_id),
    FOREIGN KEY (Ambulance_id) REFERENCES Ambulance_service(Ambulance_id)
);

CREATE TABLE Volunteer_assignment (
    Vol_assignment_id VARCHAR(20) PRIMARY KEY,
    Volunteer_id VARCHAR(20) NOT NULL,
    Assignment_id VARCHAR(20) NOT NULL,
    FOREIGN KEY (Volunteer_id) REFERENCES Volunteer(User_id),
    FOREIGN KEY (Assignment_id) REFERENCES Assignment(Assignment_id)
);

CREATE TABLE Law_case (
    Law_case_id VARCHAR(20) PRIMARY KEY,
    Incident_id VARCHAR(20) NOT NULL,
    Lawfirm_name VARCHAR(100) NOT NULL,
    Status VARCHAR(30) CHECK (Status IN ('Completed', 'Ongoing', 'Pending')),
    Case_type VARCHAR(30) CHECK (Case_type IN ('Support', 'Penalty')),
    FOREIGN KEY (Incident_id) REFERENCES Incident(Incident_id)
);

CREATE TABLE Follow_up_support (
    follow_up_id VARCHAR(20) PRIMARY KEY,
    Assignment_id VARCHAR(20) NOT NULL,
    Referred_centre VARCHAR(100) NOT NULL,
    Status VARCHAR(30) CHECK (Status IN ('Completed', 'Ongoing', 'Pending')),
    Case_type VARCHAR(30) CHECK (Case_type IN ('Support', 'Penalty')),
    FOREIGN KEY (Assignment_id) REFERENCES Assignment(Assignment_id)
);

CREATE TABLE Admin (
    User_id VARCHAR(20) PRIMARY KEY,
    FOREIGN KEY (User_id) REFERENCES User(User_id)
);

CREATE TABLE Password_Recovery (
    Recovery_id VARCHAR(20) PRIMARY KEY,
    User_email VARCHAR(100) NOT NULL,
    Admin_id VARCHAR(20) NOT NULL,
    Request_time TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),  -- ← changed
    Response_time TIMESTAMP,
    Status VARCHAR(20) CHECK(Status IN ('Pending', 'Processed')) DEFAULT 'Pending',
    Note VARCHAR(255),
    FOREIGN KEY (Admin_id) REFERENCES Admin(User_id),
    FOREIGN KEY (User_email) REFERENCES User(Email)
);

-- ================================
-- TRIGGERS
-- ================================
DELIMITER $$

-- Trigger 1: Volunteer must be available before being assigned
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

-- Trigger 2: Auto-set completion time when assignment status changes to Completed
CREATE TRIGGER set_completion_time_on_finish
BEFORE UPDATE ON Assignment
FOR EACH ROW
BEGIN
    IF (NEW.Status = 'Completed' AND OLD.Status != 'Completed') THEN
        SET NEW.Completion_time = CURRENT_TIMESTAMP();
    END IF;
END$$

-- Trigger 3: When assignment is completed, mark linked incident as Completed
CREATE TRIGGER update_incident_status_on_assignment
AFTER UPDATE ON Assignment
FOR EACH ROW
BEGIN
    IF (NEW.Status = 'Completed' AND OLD.Status != 'Completed') THEN
        UPDATE Incident
        SET Status = 'Completed'
        WHERE Incident_id = NEW.Incident_id;
    END IF;
END$$

DELIMITER ;

-- ================================
-- VIEWS
-- ================================

-- VIEW 1: Victim's personal view
CREATE VIEW victim_personal_view AS
SELECT 
    v.User_id           AS Victim_ID,
    u.Name              AS Victim_Name,
    u.Phone_no          AS Victim_Phone,
    u.Address           AS Victim_Address,

    r.Request_id,
    r.Request_time,
    r.Type              AS Request_Type,
    r.Note              AS Request_Note,

    i.Incident_id,
    i.Emergency_type,
    i.Severity,
    i.Location          AS Incident_Location,
    i.Time              AS Incident_Time,
    i.Status            AS Incident_Status,
    i.Verification_status,
    i.Note              AS Incident_Note,

    a.Assignment_id,
    a.Assigned_time,
    a.Completion_time,
    a.Status            AS Assignment_Status,

    ps.Centre_id        AS Police_Centre,
    ps.Location         AS Police_Location,
    ps.Status           AS Police_Response_Status,

    amb.Ambulance_id,
    amb.Relevant_hospital,
    amb.Status          AS Ambulance_Status,

    lc.Law_case_id,
    lc.Lawfirm_name,
    lc.Status           AS Legal_Case_Status,
    lc.Case_type        AS Legal_Case_Type,

    fs.follow_up_id,
    fs.Referred_centre,
    fs.Status           AS Followup_Status,
    fs.Case_type        AS Followup_Type

FROM Victim v
JOIN User u                     ON v.User_id        = u.User_id
LEFT JOIN Request_log r         ON v.User_id        = r.Victim_id
LEFT JOIN Incident i            ON r.Request_id     = i.Request_id
LEFT JOIN Assignment a          ON i.Incident_id    = a.Incident_id
LEFT JOIN Police_services ps    ON a.Police_id      = ps.Centre_id
LEFT JOIN Ambulance_service amb ON a.Ambulance_id   = amb.Ambulance_id
LEFT JOIN Law_case lc           ON i.Incident_id    = lc.Incident_id
LEFT JOIN Follow_up_support fs  ON a.Assignment_id  = fs.Assignment_id;


-- VIEW 2: Volunteer's assigned cases view
CREATE VIEW volunteer_assigned_view AS
SELECT 
    vol.User_id         AS Volunteer_ID,
    u_vol.Name          AS Volunteer_Name,
    u_vol.Phone_no      AS Volunteer_Phone,
    vol.Centre_id       AS Volunteer_Centre_ID,
    c.Location          AS Volunteer_Centre_Location,

    va.Vol_assignment_id,
    a.Assignment_id,
    a.Assigned_time,
    a.Completion_time,
    a.Status            AS Assignment_Status,

    i.Incident_id,
    i.Emergency_type,
    i.Severity,
    i.Location          AS Incident_Location,
    i.Time              AS Incident_Time,
    i.Status            AS Incident_Status,
    i.Note              AS Incident_Note,

    ps.Centre_id        AS Police_Centre,
    ps.Status           AS Police_Status,
    amb.Ambulance_id,
    amb.Status          AS Ambulance_Status,

    vic.User_id         AS Victim_ID,
    u_vic.Name          AS Victim_Name,
    u_vic.Phone_no      AS Victim_Phone,

    fs.follow_up_id,
    fs.Referred_centre,
    fs.Status           AS Followup_Status

FROM Volunteer vol
JOIN User u_vol                     ON vol.User_id      = u_vol.User_id
JOIN Centre c                       ON vol.Centre_id    = c.Centre_id
LEFT JOIN Volunteer_assignment va   ON vol.User_id      = va.Volunteer_id
LEFT JOIN Assignment a              ON va.Assignment_id = a.Assignment_id
LEFT JOIN Incident i                ON a.Incident_id    = i.Incident_id
LEFT JOIN Police_services ps        ON a.Police_id      = ps.Centre_id
LEFT JOIN Ambulance_service amb     ON a.Ambulance_id   = amb.Ambulance_id
LEFT JOIN Request_log r             ON i.Request_id     = r.Request_id
LEFT JOIN Victim vic                ON r.Victim_id      = vic.User_id
LEFT JOIN User u_vic                ON vic.User_id      = u_vic.User_id
LEFT JOIN Follow_up_support fs      ON a.Assignment_id  = fs.Assignment_id
WHERE va.Volunteer_id IS NOT NULL;