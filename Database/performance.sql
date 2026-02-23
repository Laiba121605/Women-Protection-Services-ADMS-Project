USE womenprotectionservicesdb;

-- ======================================
-- PART 1: Testing BEFORE MAKING Indexes
-- ======================================
-- Verify no indexes exist
-- DROP INDEX idx_assignment_incident ON Assignment;
-- DROP INDEX idx_incident_status ON Incident;
-- DROP INDEX idx_incident_request ON Incident;

SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = 'womenprotectionservicesdb'
AND INDEX_NAME != 'PRIMARY'
ORDER BY TABLE_NAME, INDEX_NAME;

-- QUERY 1: Find assignments for specific incidents
-- Rationale: Tests index on Assignment(Incident_id)
-- BEFORE INDEX (No index on Assignment.Incident_id)
EXPLAIN ANALYZE
SELECT 
    a.Assignment_id,
    a.Incident_id,
    a.Police_id,
    a.Ambulance_id,
    a.Assigned_time,
    a.Status AS Assignment_Status,
    i.Emergency_type,
    i.Severity,
    i.Location
FROM Assignment a
JOIN Incident i ON a.Incident_id = i.Incident_id
WHERE i.Severity = 'High'
ORDER BY a.Assigned_time DESC;

-- QUERY 2: Filter incidents by status
-- Rationale: Tests index on Incident(Status)
-- BEFORE INDEX (No index on Incident.Status)
EXPLAIN ANALYZE
SELECT 
    Incident_id,
    Emergency_type,
    Severity,
    Location,
    Time,
    Status,
    Verification_status
FROM Incident
WHERE Status IN ('Pending', 'Ongoing')
ORDER BY Time DESC;

-- QUERY 3: Join between Incident and Request_log
-- Rationale: Tests index on Incident(Request_id)
-- BEFORE INDEX (No index on Incident.Request_id)
EXPLAIN ANALYZE
SELECT 
    i.Incident_id,
    i.Emergency_type,
    i.Severity,
    i.Time AS Incident_Time,
    i.Status AS Incident_Status,
    r.Request_id,
    r.Request_time,
    r.Type AS Request_Type,
    r.Victim_id,
    r.Note AS Request_Note
FROM Incident i
JOIN Request_log r ON i.Request_id = r.Request_id
WHERE r.Request_time >= '2026-02-20'
    AND i.Verification_status = 'True'
ORDER BY i.Time DESC;

-- ========================================
-- PART 2: Testing AFTER CREATING Indexes
-- ========================================

-- Index 1: On Assignment(Incident_id)
CREATE INDEX idx_assignment_incident ON Assignment(Incident_id);

-- Index 2: On Incident(Status)
CREATE INDEX idx_incident_status ON Incident(Status);

-- Index 3: On Incident(Request_id)
CREATE INDEX idx_incident_request ON Incident(Request_id);

-- Verify all indexes were created
SELECT 
    TABLE_NAME,
    INDEX_NAME,
    COLUMN_NAME,
    SEQ_IN_INDEX,
    NON_UNIQUE
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = 'womenprotectionservicesdb'
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- QUERY 1 (WITH INDEXES) - Tests idx_assignment_incident
EXPLAIN ANALYZE
SELECT 
    a.Assignment_id,
    a.Incident_id,
    a.Police_id,
    a.Ambulance_id,
    a.Assigned_time,
    a.Status AS Assignment_Status,
    i.Emergency_type,
    i.Severity,
    i.Location
FROM Assignment a
JOIN Incident i ON a.Incident_id = i.Incident_id
WHERE i.Severity = 'High'
ORDER BY a.Assigned_time DESC;

-- QUERY 2 (WITH INDEXES) - Tests idx_incident_status
EXPLAIN ANALYZE
SELECT 
    Incident_id,
    Emergency_type,
    Severity,
    Location,
    Time,
    Status,
    Verification_status
FROM Incident
WHERE Status IN ('Pending', 'Ongoing')
ORDER BY Time DESC;

-- QUERY 3 (WITH INDEXES) - Tests idx_incident_request
EXPLAIN ANALYZE
SELECT 
    i.Incident_id,
    i.Emergency_type,
    i.Severity,
    i.Time AS Incident_Time,
    i.Status AS Incident_Status,
    r.Request_id,
    r.Request_time,
    r.Type AS Request_Type,
    r.Victim_id,
    r.Note AS Request_Note
FROM Incident i
JOIN Request_log r ON i.Request_id = r.Request_id
WHERE r.Request_time >= '2026-02-20'
    AND i.Verification_status = 'True'
ORDER BY i.Time DESC;

-- =======================================
-- PART 3: Performace Comparison Summary
-- =======================================

SELECT 
    'Index 1: idx_assignment_incident' AS Index_Name,
    'Assignment(Incident_id)' AS Index_Definition,
    'Improves JOIN performance between Assignment and Incident' AS Benefit,
    'Query 1 uses this index for faster table joins' AS How_Used; 

SELECT 
    'Index 2: idx_incident_status' AS Index_Name,
    'Incident(Status)' AS Index_Definition,
    'Filters incidents by status without full table scan' AS Benefit,
    'Query 2 uses this index for WHERE clause filtering' AS How_Used;  

SELECT 
    'Index 3: idx_incident_request' AS Index_Name,
    'Incident(Request_id)' AS Index_Definition,
    'Speeds up JOIN between Incident and Request_log' AS Benefit,
    'Query 3 uses this index for foreign key lookups' AS How_Used; 

SELECT 
    'Query 1' AS Query,
    'Index on Assignment(Incident_id)' AS Index_Used,
    '60-80% improvement' AS Expected_Improvement,
    'Faster JOIN operations' AS Explanation
UNION ALL
SELECT 
    'Query 2' AS Query,
    'Index on Incident(Status)' AS Index_Used,
    '70-90% improvement' AS Expected_Improvement,
    'Eliminates full table scan for status filtering'
UNION ALL
SELECT 
    'Query 3' AS Query,
    'Index on Incident(Request_id)' AS Index_Used,
    '50-75% improvement' AS Expected_Improvement,
    'Optimizes foreign key lookups';