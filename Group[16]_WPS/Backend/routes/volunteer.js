const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyJWT, allowRoles } = require('../auth');

// Middleware: only volunteers can access
router.use(verifyJWT, allowRoles('Volunteer'));

// ======================
// GET CURRENT ASSIGNMENTS
// ======================
router.get('/assignments/current', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT * FROM volunteer_assigned_view
             WHERE Volunteer_ID = ? AND Assignment_Status != 'Completed'`,
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ======================
// GET COMPLETED ASSIGNMENTS
// ======================
router.get('/assignments/history', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT * FROM volunteer_assigned_view
             WHERE Volunteer_ID = ? AND Assignment_Status = 'Completed'`,
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ======================
// UPDATE ASSIGNMENT STATUS
// ======================
router.put('/assignment/:id', async (req, res) => {
    const { Status } = req.body;

    if (!Status || !['Arrived', 'Ongoing', 'Pending'].includes(Status))
        return res.status(400).json({ message: "Status is required and must be valid" });

    try {
        const [result] = await pool.query(
            `UPDATE Volunteer v
             JOIN Volunteer_assignment va ON v.User_id = va.Volunteer_id
             JOIN Assignment a ON va.Assignment_id = a.Assignment_id
             SET v.Status = ?
             WHERE va.Assignment_id = ? AND v.User_id = ? AND a.Status != 'Completed'`,
            [Status, req.params.id, req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(400).json({
                message: "Cannot update status. Assignment is either completed or not assigned to you."
            });
        }

        res.json({ message: 'Your status has been updated successfully' });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ======================
// UPDATE VOLUNTEER AVAILABILITY
// ======================
router.put('/availability', async (req, res) => {
    const { Availability } = req.body;

    if (!['Yes', 'No'].includes(Availability))
        return res.status(400).json({ message: "Availability must be 'Yes' or 'No'" });

    try {
        const [activeAssignments] = await pool.query(
            `SELECT a.Assignment_id, a.Status
             FROM Assignment a
             JOIN Volunteer_assignment va ON a.Assignment_id = va.Assignment_id
             WHERE va.Volunteer_id = ? AND a.Status != 'Completed'`,
            [req.user.id]
        );

        if (activeAssignments.length > 0) {
            return res.status(400).json({
                message: `Cannot change availability. You have ${activeAssignments.length} active assignment(s) not yet completed.`
            });
        }

        if (Availability === 'Yes') {
            await pool.query(`UPDATE Volunteer SET Availability = 'Yes', Status = NULL WHERE User_id = ?`, [req.user.id]);
        } else {
            await pool.query(`UPDATE Volunteer SET Availability = 'No', Status = NULL WHERE User_id = ?`, [req.user.id]);
        }

        res.json({ message: `Availability updated to ${Availability}` });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ======================================================
// REQUEST BACKUP
// Appends "BACKUP REQUESTED by <name>: <reason>" to
// Incident.Note so the dispatcher sees it in their Backups tab.
// Blocked if the assignment is already Completed.
// ======================================================
router.post('/assignment/:id/request-backup', async (req, res) => {
    const { reason } = req.body;
    const conn = await pool.getConnection();
    try {
        await conn.query('START TRANSACTION');

        // Verify assignment belongs to this volunteer and is not completed
        const [[va]] = await conn.query(
            `SELECT va.Assignment_id, a.Incident_id, a.Status AS assignment_status
             FROM Volunteer_assignment va
             JOIN Assignment a ON va.Assignment_id = a.Assignment_id
             WHERE va.Assignment_id = ? AND va.Volunteer_id = ?
             FOR UPDATE`,
            [req.params.id, req.user.id]
        );

        if (!va)
            throw new Error('Assignment not found or not assigned to you.');
        if (va.assignment_status === 'Completed')
            throw new Error('Cannot request backup on a completed assignment.');

        // Get volunteer name for the note
        const [[vol]] = await conn.query(
            `SELECT u.Name FROM User u WHERE u.User_id = ?`,
            [req.user.id]
        );

        const backupNote = `BACKUP REQUESTED by ${vol?.Name || req.user.id}${reason ? `: ${reason}` : ''}`;

        // Append to incident note — separator if content already exists
        await conn.query(
            `UPDATE Incident
             SET Note = CONCAT(COALESCE(Note, ''), IF(Note IS NOT NULL AND Note != '', ' | ', ''), ?)
             WHERE Incident_id = ?`,
            [backupNote, va.Incident_id]
        );

        await conn.query('COMMIT');
        res.json({
            message: 'Backup request sent to dispatcher.',
            incident_id: va.Incident_id,
        });

    } catch (err) {
        await conn.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        conn.release();
    }
});

module.exports = router;