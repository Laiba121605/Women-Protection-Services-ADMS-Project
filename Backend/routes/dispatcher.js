// routes/dispatcher.js
const express = require('express');
const router = express.Router();
const pool = require('../db');  // MySQL connection pool
const { verifyJWT, allowRoles } = require('../auth');
const crypto = require('crypto');

// Dispatcher can only access dispatcher-level routes
router.use(verifyJWT, allowRoles('Dispatcher'));

// Helper: generate unique 20-character ID
async function generateUniqueId(table, column) {
    let unique = false;
    let id;
    while (!unique) {
        id = crypto.randomBytes(10).toString('hex'); // 20 chars
        const [rows] = await pool.query(`SELECT 1 FROM ${table} WHERE ${column}=?`, [id]);
        if (rows.length === 0) unique = true;
    }
    return id;
}

// --------------------- REQUEST LOG ---------------------
router.get('/requests', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM request_log WHERE Dispatcher_id = ?',
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put('/request/:id', async (req, res) => {
    const { Note, Type } = req.body;
    try {
        await pool.query(
            'UPDATE Request_log SET Note=?, Type=? WHERE Request_id=? AND Dispatcher_id=?',
            [Note, Type, req.params.id, req.user.id]
        );
        res.json({ message: 'Request updated' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// --------------------- INCIDENT ---------------------
router.post('/incident', async (req, res) => {
    const { Request_id, Emergency_type, Severity, Note, Location, Status, Verification_status } = req.body;
    try {
        const Incident_id = await generateUniqueId('Incident', 'Incident_id');

        // Time is handled by DB with CURRENT_TIMESTAMP
        await pool.query(
            `INSERT INTO Incident
            (Incident_id, Request_id, Emergency_type, Severity, Note, Location, Status, Verification_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [Incident_id, Request_id, Emergency_type, Severity, Note, Location, Status, Verification_status]
        );
        res.json({ message: 'Incident created', Incident_id });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put('/incident/:id', async (req, res) => {
    const { Status, Verification_status } = req.body;
    try {
        await pool.query(
            'UPDATE Incident i JOIN Request_log r ON i.Request_id = r.Request_id SET i.Status=?, i.Verification_status=? WHERE i.Incident_id=? AND r.Dispatcher_id=?',
            [Status, Verification_status, req.params.id, req.user.id]
        );
        res.json({ message: 'Incident updated' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// --------------------- ASSIGNMENT ---------------------
router.post('/assignment', async (req, res) => {
    const { Incident_id, Police_id, Ambulance_id, Status } = req.body;
    try {
        const Assignment_id = await generateUniqueId('Assignment', 'Assignment_id');

        // Assigned_time handled automatically by DB
        await pool.query(
            `INSERT INTO Assignment (Assignment_id, Incident_id, Police_id, Ambulance_id, Status)
            VALUES (?, ?, ?, ?, ?)`,
            [Assignment_id, Incident_id, Police_id, Ambulance_id, Status]
        );
        res.json({ message: 'Assignment created', Assignment_id });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put('/assignment/:id', async (req, res) => {
    const { Status } = req.body;
    try {
        await pool.query(
            'UPDATE Assignment a JOIN Incident i ON a.Incident_id = i.Incident_id JOIN Request_log r ON i.Request_id = r.Request_id SET a.Status=? WHERE a.Assignment_id=? AND r.Dispatcher_id=?',
            [Status, req.params.id, req.user.id]
        );
        res.json({ message: 'Assignment status updated' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// --------------------- LAW CASE ---------------------
router.post('/lawcase', async (req, res) => {
    const { Incident_id, Lawfirm_name, Status, Case_type } = req.body;
    try {
        const Law_case_id = await generateUniqueId('Law_case', 'Law_case_id');

        await pool.query(
            `INSERT INTO Law_case (Law_case_id, Incident_id, Lawfirm_name, Status, Case_type)
            SELECT ?, ?, ?, ?, ? FROM Request_log r JOIN Incident i ON r.Request_id = i.Request_id
            WHERE i.Incident_id=? AND r.Dispatcher_id=?`,
            [Law_case_id, Incident_id, Lawfirm_name, Status, Case_type, Incident_id, req.user.User_id]
        );
        res.json({ message: 'Law case created', Law_case_id });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put('/lawcase/:id', async (req, res) => {
    const { Status } = req.body;
    try {
        await pool.query(
            `UPDATE Law_case lc JOIN Incident i ON lc.Incident_id = i.Incident_id
             JOIN Request_log r ON i.Request_id = r.Request_id
             SET lc.Status=? WHERE lc.Law_case_id=? AND r.Dispatcher_id=?`,
            [Status, req.params.id, req.user.id]
        );
        res.json({ message: 'Law case status updated' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// --------------------- FOLLOW-UP SUPPORT ---------------------
router.post('/followup', async (req, res) => {
    const { Assignment_id, Referred_centre, Status, Case_type } = req.body;
    try {
        const follow_up_id = await generateUniqueId('Follow_up_support', 'follow_up_id');

        await pool.query(
            `INSERT INTO Follow_up_support (follow_up_id, Assignment_id, Referred_centre, Status, Case_type)
            SELECT ?, ?, ?, ?, ? FROM Assignment a JOIN Incident i ON a.Incident_id = i.Incident_id
            JOIN Request_log r ON i.Request_id = r.Request_id
            WHERE a.Assignment_id=? AND r.Dispatcher_id=?`,
            [follow_up_id, Assignment_id, Referred_centre, Status, Case_type, Assignment_id, req.user.id]
        );
        res.json({ message: 'Follow-up created', follow_up_id });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put('/followup/:id', async (req, res) => {
    const { Status } = req.body;
    try {
        await pool.query(
            `UPDATE Follow_up_support fs
             JOIN Assignment a ON fs.Assignment_id = a.Assignment_id
             JOIN Incident i ON a.Incident_id = i.Incident_id
             JOIN Request_log r ON i.Request_id = r.Request_id
             SET fs.Status=? WHERE fs.follow_up_id=? AND r.Dispatcher_id=?`,
            [Status, req.params.id, req.user.id]
        );
        res.json({ message: 'Follow-up status updated' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;