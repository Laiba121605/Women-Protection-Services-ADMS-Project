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
             WHERE Volunteer_ID = ? AND Assignment_Status != 'Completed'`, // ✏️ Arrived -> Completed
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
             WHERE Volunteer_ID = ? AND Assignment_Status = 'Completed'`, // ✏️ Arrived -> Completed
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
             WHERE va.Assignment_id = ? AND v.User_id = ? AND a.Status != 'Completed'`, // ✏️ Arrived -> Completed
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
        // ✏️ CHANGE: check actual Assignment.Status instead of Volunteer.Status
        // If volunteer has any active (non-Completed) assignments, block availability change
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

module.exports = router;