// routes/passwordRecovery.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyJWT, allowRoles, hashPassword } = require('../auth');
const crypto = require('crypto');
const logger = require('../utils/logger');

async function generateUniqueId(table, column) {
    let unique = false;
    let id;
    while (!unique) {
        id = crypto.randomBytes(10).toString('hex').slice(0, 20);
        const [rows] = await pool.query(`SELECT 1 FROM ${table} WHERE ${column} = ?`, [id]);
        if (rows.length === 0) unique = true;
    }
    return id;
}

//////////////////////////////////////////////////////
// 1️⃣ USER CREATES PASSWORD RECOVERY REQUEST
//////////////////////////////////////////////////////
router.post('/', verifyJWT, allowRoles('Victim', 'Volunteer', 'Dispatcher'), async (req, res) => {

    const conn = await pool.getConnection();
    try {
        const email = req.user.email;
        logger.txStart('POST /password-recovery', email);
        await conn.query("START TRANSACTION");

        const [users] = await conn.query("SELECT User_id FROM User WHERE Email = ?", [email]);
        if (users.length === 0) {
            await conn.query("ROLLBACK");
            logger.txRollback('POST /password-recovery', `User not found: ${email}`);
            return res.status(404).json({ message: "User not found" });
        }

        const recoveryId = await generateUniqueId("Password_Recovery", "Recovery_id");

        const [admins] = await conn.query("SELECT User_id FROM Admin ORDER BY User_id");
        if (admins.length === 0) {
            await conn.query("ROLLBACK");
            logger.txRollback('POST /password-recovery', 'No admins available');
            return res.status(500).json({ message: "No admins available" });
        }

        const [lastAssigned] = await conn.query(
            `SELECT Admin_id FROM Password_Recovery ORDER BY Request_time DESC LIMIT 1 FOR UPDATE`
        );

        let nextAdminIndex = 0;
        if (lastAssigned.length > 0) {
            const lastId = lastAssigned[0].Admin_id;
            const lastIndex = admins.findIndex(a => a.User_id === lastId);
            nextAdminIndex = (lastIndex + 1) % admins.length;
        }

        const assignedAdmin = admins[nextAdminIndex].User_id;

        await conn.query(
            `INSERT INTO Password_Recovery (Recovery_id, User_email, Admin_id, Status) VALUES (?, ?, ?, 'Pending')`,
            [recoveryId, email, assignedAdmin]
        );
        logger.info(`Inserted Password_Recovery: ${recoveryId} | User: ${email} | Admin: ${assignedAdmin}`);

        await conn.query("COMMIT");
        logger.txCommit('POST /password-recovery', `Recovery request ${recoveryId} created`);

        res.status(201).json({ message: "Recovery request created", Recovery_id: recoveryId, assigned_admin: assignedAdmin });

    } catch (err) {
        await conn.query("ROLLBACK");
        logger.txRollback('POST /password-recovery', err.message);
        console.error(err);
        res.status(500).json({ message: err.message });
    } finally {
        conn.release();
    }
});

//////////////////////////////////////////////////////
// 2️⃣ ADMIN VIEWS ALL REQUESTS
//////////////////////////////////////////////////////
router.get('/', verifyJWT, allowRoles('Admin'), async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT * FROM Password_Recovery ORDER BY Request_time DESC`);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

//////////////////////////////////////////////////////
// 3️⃣ ADMIN RESETS USER PASSWORD
//////////////////////////////////////////////////////
router.put('/:id/reset-password', verifyJWT, allowRoles('Admin'), async (req, res) => {

    const { note, status } = req.body;
    const recoveryId = req.params.id;
    const conn = await pool.getConnection();

    try {
        // Status validation if provided
        if (status !== undefined && !['Pending', 'Processed'].includes(status))
            return res.status(400).json({ message: "Status must be Pending or Processed" });

        logger.txStart('PUT /password-recovery/:id/reset-password', req.user.id);
        await conn.query("START TRANSACTION");

        const [rows] = await conn.query(
            `SELECT * FROM Password_Recovery WHERE Recovery_id = ? FOR UPDATE`, [recoveryId]
        );

        if (rows.length === 0) {
            await conn.query("ROLLBACK");
            logger.txRollback('PUT /password-recovery/:id/reset-password', `Not found: ${recoveryId}`);
            return res.status(404).json({ message: "Recovery request not found" });
        }

        if (rows[0].Status === 'Processed') {
            await conn.query("ROLLBACK");
            logger.txRollback('PUT /password-recovery/:id/reset-password', `Already processed: ${recoveryId}`);
            return res.status(400).json({ message: "Request has already been processed" });
        }

        if (rows[0].Admin_id !== req.user.id) {
            await conn.query("ROLLBACK");
            logger.txRollback('PUT /password-recovery/:id/reset-password', `Unauthorized: ${req.user.id}`);
            return res.status(403).json({ message: "Only the assigned admin can reset this password" });
        }

        const userEmail = rows[0].User_email;

        const [users] = await conn.query(`SELECT User_id FROM User WHERE Email = ?`, [userEmail]);
        if (users.length === 0) {
            await conn.query("ROLLBACK");
            logger.txRollback('PUT /password-recovery/:id/reset-password', `User not found: ${userEmail}`);
            return res.status(404).json({ message: "User not found" });
        }

        const newPlainPassword = crypto.randomBytes(6).toString('hex');
        const hashedPassword = await hashPassword(newPlainPassword);

        await conn.query(`UPDATE User SET Password = ? WHERE Email = ?`, [hashedPassword, userEmail]);
        logger.info(`Password updated for: ${userEmail}`);

        // Build update fields dynamically
        const updates = [];
        const params = [];

        updates.push('Status = ?');
        params.push(status !== undefined ? status : 'Processed');

        if (note !== undefined) {
            updates.push('Note = ?');
            params.push(note || null);
        }

        updates.push('Response_time = CURRENT_TIMESTAMP');
        params.push(recoveryId);

        await conn.query(
            `UPDATE Password_Recovery SET ${updates.join(', ')} WHERE Recovery_id = ?`, params
        );

        await conn.query("COMMIT");
        logger.txCommit('PUT /password-recovery/:id/reset-password', `Password reset for ${userEmail}`);

        res.json({ message: "Password reset successfully.", new_password: newPlainPassword });

    } catch (err) {
        await conn.query("ROLLBACK");
        logger.txRollback('PUT /password-recovery/:id/reset-password', err.message);
        console.error(err);
        res.status(500).json({ message: err.message });
    } finally {
        conn.release();
    }
});

//////////////////////////////////////////////////////
// 4️⃣ ADMIN UPDATES REQUEST
//////////////////////////////////////////////////////
router.put('/:id', verifyJWT, allowRoles('Admin'), async (req, res) => {

    const { status, note } = req.body;
    const recoveryId = req.params.id;
    const conn = await pool.getConnection();

    try {
        // At least one field must be provided
        if (status === undefined && note === undefined)
            return res.status(400).json({ message: "Provide at least status or note" });

        // Status validation if provided
        if (status !== undefined && !['Pending', 'Processed'].includes(status))
            return res.status(400).json({ message: "Status must be Pending or Processed" });

        logger.txStart('PUT /password-recovery/:id', req.user.id);
        await conn.query("START TRANSACTION");

        const [rows] = await conn.query(
            `SELECT * FROM Password_Recovery WHERE Recovery_id = ? FOR UPDATE`, [recoveryId]
        );

        if (rows.length === 0) {
            await conn.query("ROLLBACK");
            logger.txRollback('PUT /password-recovery/:id', `Not found: ${recoveryId}`);
            return res.status(404).json({ message: "Request not found" });
        }

        if (rows[0].Status === "Processed") {
            await conn.query("ROLLBACK");
            logger.txRollback('PUT /password-recovery/:id', `Already processed: ${recoveryId}`);
            return res.status(400).json({ message: "Already processed" });
        }

        // Build update fields dynamically
        const updates = [];
        const params = [];

        if (status !== undefined) {
            updates.push('Status = ?');
            params.push(status);
        }

        if (note !== undefined) {
            updates.push('Note = ?');
            params.push(note || null);
        }

        updates.push('Response_time = CURRENT_TIMESTAMP');
        params.push(recoveryId);

        await conn.query(
            `UPDATE Password_Recovery SET ${updates.join(', ')} WHERE Recovery_id = ?`, params
        );

        await conn.query("COMMIT");
        logger.txCommit('PUT /password-recovery/:id', `Recovery ${recoveryId} updated`);
        res.json({ message: "Request updated" });

    } catch (err) {
        await conn.query("ROLLBACK");
        logger.txRollback('PUT /password-recovery/:id', err.message);
        res.status(500).json({ message: err.message });
    } finally {
        conn.release();
    }
});

//////////////////////////////////////////////////////
// 5️⃣ ADMIN DELETE REQUEST
//////////////////////////////////////////////////////
router.delete('/:id', verifyJWT, allowRoles('Admin'), async (req, res) => {

    const id = req.params.id;
    const conn = await pool.getConnection();

    try {
        logger.txStart('DELETE /password-recovery/:id', req.user.id);
        await conn.query("START TRANSACTION");

        const [rows] = await conn.query(
            `SELECT * FROM Password_Recovery WHERE Recovery_id=? FOR UPDATE`, [id]
        );

        if (rows.length === 0) {
            await conn.query("ROLLBACK");
            logger.txRollback('DELETE /password-recovery/:id', `Not found: ${id}`);
            return res.status(404).json({ message: "Request not found" });
        }

        await conn.query(`DELETE FROM Password_Recovery WHERE Recovery_id=?`, [id]);

        await conn.query("COMMIT");
        logger.txCommit('DELETE /password-recovery/:id', `Recovery ${id} deleted`);
        res.json({ message: "Deleted successfully" });

    } catch (err) {
        await conn.query("ROLLBACK");
        logger.txRollback('DELETE /password-recovery/:id', err.message);
        res.status(500).json({ message: err.message });
    } finally {
        conn.release();
    }
});

//////////////////////////////////////////////////////
// 6️⃣ USER SEES THEIR OWN REQUESTS
//////////////////////////////////////////////////////
router.get('/my-requests', verifyJWT, allowRoles('Victim', 'Volunteer', 'Dispatcher'), async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT * FROM Password_Recovery WHERE User_email = ? ORDER BY Request_time DESC`,
            [req.user.email]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;