// routes/victim.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyJWT, allowRoles, JWT_SECRET } = require('../auth');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

async function generateUniqueId(table, column) {
    let unique = false;
    let id;
    while (!unique) {
        id = crypto.randomBytes(10).toString('hex');
        const [rows] = await pool.query(`SELECT 1 FROM ${table} WHERE ${column}=?`, [id]);
        if (rows.length === 0) unique = true;
    }
    return id;
}

// ---------------------------------------------------------------
// REGISTER AS VICTIM
// ---------------------------------------------------------------
router.post('/register', verifyJWT, async (req, res) => {

    const conn = await pool.getConnection();
    try {
        logger.txStart('POST /victim/register', req.user.id);
        await conn.query("START TRANSACTION");

        const [user] = await conn.query(`SELECT User_id FROM User WHERE User_id = ?`, [req.user.id]);
        if (!user.length) {
            await conn.query("ROLLBACK");
            logger.txRollback('POST /victim/register', `User not found: ${req.user.id}`);
            return res.status(404).json({ message: 'User not found' });
        }

        const [existing] = await conn.query(`SELECT User_id FROM Victim WHERE User_id = ?`, [req.user.id]);
        if (existing.length) {
            await conn.query("ROLLBACK");
            logger.txRollback('POST /victim/register', `Already a victim: ${req.user.id}`);
            return res.status(400).json({ message: 'You are already registered as a victim' });
        }

        const [volunteerRows] = await conn.query(
            `SELECT Emergency_contact FROM Volunteer WHERE User_id = ?`,
            [req.user.id]
        );

        let Emergency_contact;

        if (volunteerRows.length) {
            Emergency_contact = volunteerRows[0].Emergency_contact;
            logger.info(`Reusing Emergency_contact from Volunteer: ${req.user.id}`);
        } else {
            Emergency_contact = req.body.Emergency_contact;
            if (!Emergency_contact) {
                await conn.query("ROLLBACK");
                logger.txRollback('POST /victim/register', 'Emergency_contact missing');
                return res.status(400).json({ message: 'Emergency_contact is required' });
            }
            const phoneRegex = /^\d{10,11}$/;
            if (!phoneRegex.test(Emergency_contact)) {
                await conn.query("ROLLBACK");
                logger.txRollback('POST /victim/register', 'Invalid Emergency_contact format');
                return res.status(400).json({ message: 'Emergency contact must be 10 or 11 digits' });
            }
        }

        await conn.query(`INSERT INTO Victim (User_id, Emergency_contact) VALUES (?, ?)`, [req.user.id, Emergency_contact]);
        logger.info(`Inserted Victim: ${req.user.id}`);

        await conn.query("COMMIT");
        logger.txCommit('POST /victim/register', `User ${req.user.id} registered as Victim`);

        const roles = [];
        const [victim]     = await pool.query('SELECT User_id FROM Victim     WHERE User_id=?', [req.user.id]);
        const [volunteer]  = await pool.query('SELECT User_id FROM Volunteer  WHERE User_id=?', [req.user.id]);
        const [dispatcher] = await pool.query('SELECT User_id FROM Dispatcher WHERE User_id=?', [req.user.id]);
        const [admin]      = await pool.query('SELECT User_id FROM Admin      WHERE User_id=?', [req.user.id]);

        if (victim.length)     roles.push('Victim');
        if (volunteer.length)  roles.push('Volunteer');
        if (dispatcher.length) roles.push('Dispatcher');
        if (admin.length)      roles.push('Admin');

        const token = jwt.sign({ id: req.user.id, email: req.user.email, roles }, JWT_SECRET, { expiresIn: '4h' });

        res.json({ message: 'You are now registered as a victim and can access victim features', roles, token });

    } catch (err) {
        await conn.query("ROLLBACK");
        logger.txRollback('POST /victim/register', err.message);
        res.status(500).json({ message: err.message });
    } finally {
        conn.release();
    }
});

// ---------------------------------------------------------------
// All routes below are only accessible to victims
// ---------------------------------------------------------------
router.use(verifyJWT, allowRoles('Victim'));

// --------------------- SUBMIT NEW REQUEST ---------------------
router.post('/request', async (req, res) => {
    const { Note, Location } = req.body;

    if (!Note || !Location)
        return res.status(400).json({ message: 'Note and Location are required' });

    const conn = await pool.getConnection();
    try {
        logger.txStart('POST /victim/request', req.user.id);
        await conn.query("START TRANSACTION");

        const [dispatchers] = await conn.query(
            `SELECT User_id FROM Dispatcher 
             WHERE Availability = 'Yes' AND User_id != ?
             ORDER BY User_id FOR UPDATE`,
            [req.user.id]
        );

        if (!dispatchers.length) {
            await conn.query("ROLLBACK");
            logger.txRollback('POST /victim/request', 'No dispatchers available');
            return res.status(400).json({ message: 'No dispatchers available' });
        }

        const [lastAssigned] = await conn.query(
            `SELECT Dispatcher_id FROM Request_log ORDER BY Request_time DESC LIMIT 1 FOR UPDATE`
        );
        let nextIndex = 0;
        if (lastAssigned.length > 0) {
            const lastId = lastAssigned[0].Dispatcher_id;
            const lastIndex = dispatchers.findIndex(d => d.User_id === lastId);
            nextIndex = (lastIndex + 1) % dispatchers.length;
        }

        const Dispatcher_id = dispatchers[nextIndex].User_id;
        const Request_id = await generateUniqueId('Request_log', 'Request_id');

        await conn.query(
            `INSERT INTO Request_log (Request_id, Victim_id, Dispatcher_id, Request_time, Note, Location, Type) 
             VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, 'Emergency')`,
            [Request_id, req.user.id, Dispatcher_id, Note, Location]
        );
        logger.info(`Inserted Request_log: ${Request_id} | Victim: ${req.user.id} | Dispatcher: ${Dispatcher_id}`);

        await conn.query("COMMIT");
        logger.txCommit('POST /victim/request', `Request ${Request_id} submitted`);

        res.json({ message: 'Request submitted successfully', Request_id, Dispatcher_id });

    } catch (err) {
        await conn.query("ROLLBACK");
        logger.txRollback('POST /victim/request', err.message);
        res.status(500).json({ message: err.message });
    } finally {
        conn.release();
    }
});

// --------------------- VIEW OWN INCIDENTS ---------------------
router.get('/incidents', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT * FROM victim_personal_view WHERE Victim_ID = ? AND Request_id IS NOT NULL`,
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;