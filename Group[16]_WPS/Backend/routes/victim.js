// routes/victim.js
// Handles victim registration, request submission, incident viewing,
// and four public emergency endpoints (no JWT) for victim/volunteer/admin/dispatcher
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
// PUBLIC — Verify Identity + Role (no JWT)
// Used by the frontend emergency flow Step 1 to confirm that a
// user_id + email combination exists AND that the user holds the
// expected role, before asking them to fill in note + location.
// Returns 200 on success, 404 for bad identity, 403 for wrong role.
// Does NOT create any records — read-only check.
// ---------------------------------------------------------------
router.post('/verify-identity', async (req, res) => {
    const { user_id, email, role } = req.body;

    if (!user_id || !email || !role)
        return res.status(400).json({ message: 'user_id, email, and role are required' });

    const validRoles = ['Victim', 'Volunteer', 'Admin', 'Dispatcher'];
    if (!validRoles.includes(role))
        return res.status(400).json({ message: 'role must be one of: Victim, Volunteer, Admin, Dispatcher' });

    try {
        // Step 1 — confirm user exists with this email
        const [users] = await pool.query(
            `SELECT User_id FROM User WHERE User_id = ? AND Email = ?`,
            [user_id, email]
        );
        if (!users.length)
            return res.status(404).json({ message: 'No account found with this User ID and email combination' });

        // Step 2 — confirm the user actually holds the claimed role
        const roleTable = {
            Victim:     'Victim',
            Volunteer:  'Volunteer',
            Admin:      'Admin',
            Dispatcher: 'Dispatcher',
        };
        const [roleRows] = await pool.query(
            `SELECT User_id FROM ${roleTable[role]} WHERE User_id = ?`,
            [user_id]
        );
        if (!roleRows.length)
            return res.status(403).json({ message: `This User ID is not registered as a ${role}. Please select the correct role.` });

        // Step 3 — for Admin and Dispatcher, check if already in Victim table
        // Frontend uses this to decide whether to show the emergency_contact field
        let alreadyVictim = false;
        if (role === 'Admin' || role === 'Dispatcher') {
            const [victimRows] = await pool.query(
                `SELECT User_id FROM Victim WHERE User_id = ?`, [user_id]
            );
            alreadyVictim = victimRows.length > 0;
        }

        return res.status(200).json({
            message:        'Identity and role verified',
            already_victim: alreadyVictim   // true = already in Victim table, no emergency_contact needed
        });

    } catch (err) {
        logger.error(`POST /victim/verify-identity: ${err.message}`);
        return res.status(500).json({ message: err.message });
    }
});

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
// PUBLIC — Victim Emergency Request (no JWT)
// For victims who forgot password but need to submit emergency now.
// Verifies identity via user_id + email only — no JWT needed.
// Auto-registers as Victim if not already (asks emergency_contact only then).
// note + location collected here and inserted into Request_log same transaction.
// ---------------------------------------------------------------
router.post('/emergency', async (req, res) => {
    const { user_id, email, note, location, emergency_contact } = req.body;
    const conn = await pool.getConnection();

    try {
        if (!user_id || !email || !note || !location)
            return res.status(400).json({ message: 'user_id, email, note, and location are required' });

        if (location.trim().length < 10)
            return res.status(400).json({ message: 'Please provide a more detailed location (at least 10 characters)' });

        if (note.trim().length < 5)
            return res.status(400).json({ message: 'Please describe your situation briefly' });

        await conn.query('START TRANSACTION');

        const [users] = await conn.query(
            `SELECT User_id FROM User WHERE User_id = ? AND Email = ?`,
            [user_id, email]
        );
        if (!users.length) {
            await conn.query('ROLLBACK');
            return res.status(404).json({ message: 'No account found with this ID and email combination' });
        }

        const [existingVictim] = await conn.query(
            `SELECT User_id FROM Victim WHERE User_id = ?`, [user_id]
        );
        if (!existingVictim.length) {
            if (!emergency_contact) {
                await conn.query('ROLLBACK');
                return res.status(400).json({
                    message: 'You are not yet registered as a victim. Please also provide emergency_contact to proceed.'
                });
            }
            const phoneRegex = /^\d{10,11}$/;
            if (!phoneRegex.test(emergency_contact)) {
                await conn.query('ROLLBACK');
                return res.status(400).json({ message: 'Emergency contact must be 10 or 11 digits' });
            }
            if (!emergency_contact.startsWith('03')) {
                await conn.query('ROLLBACK');
                return res.status(400).json({ message: 'Emergency contact must start with 03 (e.g. 03001234567)' });
            }
            await conn.query(
                `INSERT INTO Victim (User_id, Emergency_contact) VALUES (?, ?)`,
                [user_id, emergency_contact]
            );
            logger.info(`Auto-registered as Victim during emergency request: ${user_id}`);
        }

        // Round-robin available dispatchers
        const [dispatchers] = await conn.query(
            `SELECT User_id FROM Dispatcher WHERE Availability = 'Yes' AND User_id != ? ORDER BY User_id FOR UPDATE`,
            [user_id]
        );
        if (!dispatchers.length) {
            await conn.query('ROLLBACK');
            return res.status(503).json({ message: 'No dispatchers available. Please call emergency services directly.' });
        }

        const [lastDispatcher] = await conn.query(
            `SELECT Dispatcher_id FROM Request_log ORDER BY Request_time DESC LIMIT 1 FOR UPDATE`
        );
        let nextIndex = 0;
        if (lastDispatcher.length > 0) {
            const lastId = lastDispatcher[0].Dispatcher_id;
            const lastIdx = dispatchers.findIndex(d => d.User_id === lastId);
            nextIndex = (lastIdx + 1) % dispatchers.length;
        }
        const dispatcherId = dispatchers[nextIndex].User_id;

        const requestId = await generateUniqueId('Request_log', 'Request_id');
        await conn.query(
            `INSERT INTO Request_log (Request_id, Victim_id, Dispatcher_id, Request_time, Note, Location, Type)
             VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, 'Emergency')`,
            [requestId, user_id, dispatcherId, note, location]
        );

        await conn.query('COMMIT');
        logger.info(`Victim emergency request ${requestId} submitted for ${user_id} without login`);

        res.status(201).json({
            message: 'Emergency request submitted. A dispatcher has been notified.',
            request_id: requestId
        });

    } catch (err) {
        await conn.query('ROLLBACK');
        logger.txRollback('POST /victim/emergency', err.message);
        res.status(500).json({ message: err.message });
    } finally {
        conn.release();
    }
});

// ---------------------------------------------------------------
// PUBLIC — Volunteer Emergency Request (no JWT)
// For volunteers who forgot password but need help now.
// Verifies via user_id + email, confirms Volunteer role.
// Auto-registers as Victim reusing Emergency_contact from Volunteer table — no extra ask.
// note + location collected here and inserted into Request_log same transaction.
// ---------------------------------------------------------------
router.post('/emergency/volunteer', async (req, res) => {
    const { user_id, email, note, location } = req.body;
    const conn = await pool.getConnection();

    try {
        if (!user_id || !email || !note || !location)
            return res.status(400).json({ message: 'user_id, email, note, and location are required' });

        if (location.trim().length < 10)
            return res.status(400).json({ message: 'Please provide a more detailed location (at least 10 characters)' });

        if (note.trim().length < 5)
            return res.status(400).json({ message: 'Please describe your situation briefly' });

        await conn.query('START TRANSACTION');

        const [users] = await conn.query(
            `SELECT User_id FROM User WHERE User_id = ? AND Email = ?`,
            [user_id, email]
        );
        if (!users.length) {
            await conn.query('ROLLBACK');
            return res.status(404).json({ message: 'No account found with this ID and email combination' });
        }

        // Confirm Volunteer role and grab their existing Emergency_contact
        const [volunteer] = await conn.query(
            `SELECT User_id, Emergency_contact FROM Volunteer WHERE User_id = ?`, [user_id]
        );
        if (!volunteer.length) {
            await conn.query('ROLLBACK');
            return res.status(403).json({ message: 'This endpoint is only for volunteers.' });
        }

        // Auto-register as Victim reusing Emergency_contact from Volunteer — no extra field needed
        const [existingVictim] = await conn.query(
            `SELECT User_id FROM Victim WHERE User_id = ?`, [user_id]
        );
        if (!existingVictim.length) {
            await conn.query(
                `INSERT INTO Victim (User_id, Emergency_contact) VALUES (?, ?)`,
                [user_id, volunteer[0].Emergency_contact]
            );
            logger.info(`Auto-registered Volunteer as Victim for emergency: ${user_id}`);
        }

        // Round-robin available dispatchers
        const [dispatchers] = await conn.query(
            `SELECT User_id FROM Dispatcher WHERE Availability = 'Yes' AND User_id != ? ORDER BY User_id FOR UPDATE`,
            [user_id]
        );
        if (!dispatchers.length) {
            await conn.query('ROLLBACK');
            return res.status(503).json({ message: 'No dispatchers available. Please call emergency services directly.' });
        }

        const [lastDispatcher] = await conn.query(
            `SELECT Dispatcher_id FROM Request_log ORDER BY Request_time DESC LIMIT 1 FOR UPDATE`
        );
        let nextIndex = 0;
        if (lastDispatcher.length > 0) {
            const lastId = lastDispatcher[0].Dispatcher_id;
            const lastIdx = dispatchers.findIndex(d => d.User_id === lastId);
            nextIndex = (lastIdx + 1) % dispatchers.length;
        }
        const dispatcherId = dispatchers[nextIndex].User_id;

        const requestId = await generateUniqueId('Request_log', 'Request_id');
        await conn.query(
            `INSERT INTO Request_log (Request_id, Victim_id, Dispatcher_id, Request_time, Note, Location, Type)
             VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, 'Emergency')`,
            [requestId, user_id, dispatcherId, note, location]
        );

        await conn.query('COMMIT');
        logger.info(`Volunteer emergency request ${requestId} submitted for ${user_id} without login`);

        res.status(201).json({
            message: 'Emergency request submitted. A dispatcher has been notified.',
            request_id: requestId
        });

    } catch (err) {
        await conn.query('ROLLBACK');
        logger.txRollback('POST /victim/emergency/volunteer', err.message);
        res.status(500).json({ message: err.message });
    } finally {
        conn.release();
    }
});

// ---------------------------------------------------------------
// PUBLIC — Admin Emergency Request (no JWT)
// For admins who forgot password but need help now.
// Verifies via user_id + email, confirms Admin role.
// Admin has no Emergency_contact in schema — asked only if not already a Victim.
// note + location collected here and inserted into Request_log same transaction.
// ---------------------------------------------------------------
router.post('/emergency/admin', async (req, res) => {
    const { user_id, email, note, location, emergency_contact } = req.body;
    const conn = await pool.getConnection();

    try {
        if (!user_id || !email || !note || !location)
            return res.status(400).json({ message: 'user_id, email, note, and location are required' });

        if (location.trim().length < 10)
            return res.status(400).json({ message: 'Please provide a more detailed location (at least 10 characters)' });

        if (note.trim().length < 5)
            return res.status(400).json({ message: 'Please describe your situation briefly' });

        await conn.query('START TRANSACTION');

        const [users] = await conn.query(
            `SELECT User_id FROM User WHERE User_id = ? AND Email = ?`,
            [user_id, email]
        );
        if (!users.length) {
            await conn.query('ROLLBACK');
            return res.status(404).json({ message: 'No account found with this ID and email combination' });
        }

        // Confirm Admin role
        const [admin] = await conn.query(
            `SELECT User_id FROM Admin WHERE User_id = ?`, [user_id]
        );
        if (!admin.length) {
            await conn.query('ROLLBACK');
            return res.status(403).json({ message: 'This endpoint is only for admins.' });
        }

        // Auto-register as Victim if not already
        // emergency_contact only asked here since Admin table has no such field
        const [existingVictim] = await conn.query(
            `SELECT User_id FROM Victim WHERE User_id = ?`, [user_id]
        );
        if (!existingVictim.length) {
            if (!emergency_contact) {
                await conn.query('ROLLBACK');
                return res.status(400).json({
                    message: 'You are not yet registered as a victim. Please also provide emergency_contact to proceed.'
                });
            }
            const phoneRegex = /^\d{10,11}$/;
            if (!phoneRegex.test(emergency_contact)) {
                await conn.query('ROLLBACK');
                return res.status(400).json({ message: 'Emergency contact must be 10 or 11 digits' });
            }
            if (!emergency_contact.startsWith('03')) {
                await conn.query('ROLLBACK');
                return res.status(400).json({ message: 'Emergency contact must start with 03 (e.g. 03001234567)' });
            }
            await conn.query(
                `INSERT INTO Victim (User_id, Emergency_contact) VALUES (?, ?)`,
                [user_id, emergency_contact]
            );
            logger.info(`Auto-registered Admin as Victim for emergency: ${user_id}`);
        }

        // Round-robin available dispatchers
        const [dispatchers] = await conn.query(
            `SELECT User_id FROM Dispatcher WHERE Availability = 'Yes' AND User_id != ? ORDER BY User_id FOR UPDATE`,
            [user_id]
        );
        if (!dispatchers.length) {
            await conn.query('ROLLBACK');
            return res.status(503).json({ message: 'No dispatchers available. Please call emergency services directly.' });
        }

        const [lastDispatcher] = await conn.query(
            `SELECT Dispatcher_id FROM Request_log ORDER BY Request_time DESC LIMIT 1 FOR UPDATE`
        );
        let nextIndex = 0;
        if (lastDispatcher.length > 0) {
            const lastId = lastDispatcher[0].Dispatcher_id;
            const lastIdx = dispatchers.findIndex(d => d.User_id === lastId);
            nextIndex = (lastIdx + 1) % dispatchers.length;
        }
        const dispatcherId = dispatchers[nextIndex].User_id;

        const requestId = await generateUniqueId('Request_log', 'Request_id');
        await conn.query(
            `INSERT INTO Request_log (Request_id, Victim_id, Dispatcher_id, Request_time, Note, Location, Type)
             VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, 'Emergency')`,
            [requestId, user_id, dispatcherId, note, location]
        );

        await conn.query('COMMIT');
        logger.info(`Admin emergency request ${requestId} submitted for ${user_id} without login`);

        res.status(201).json({
            message: 'Emergency request submitted. A dispatcher has been notified.',
            request_id: requestId
        });

    } catch (err) {
        await conn.query('ROLLBACK');
        logger.txRollback('POST /victim/emergency/admin', err.message);
        res.status(500).json({ message: err.message });
    } finally {
        conn.release();
    }
});

// ---------------------------------------------------------------
// PUBLIC — Dispatcher Emergency Request (no JWT)
// For dispatchers who forgot password but need help now.
// Verifies via user_id + email, confirms Dispatcher role.
// Dispatcher has no Emergency_contact in schema (same as Admin) —
// asked only if not already registered as a Victim.
// note + location collected here and inserted into Request_log same transaction.
// Round-robin selects a DIFFERENT available dispatcher to handle the request
// (excludes the requesting dispatcher's own user_id from the pool).
// ---------------------------------------------------------------
router.post('/emergency/dispatcher', async (req, res) => {
    const { user_id, email, note, location, emergency_contact } = req.body;
    const conn = await pool.getConnection();

    try {
        if (!user_id || !email || !note || !location)
            return res.status(400).json({ message: 'user_id, email, note, and location are required' });

        if (location.trim().length < 10)
            return res.status(400).json({ message: 'Please provide a more detailed location (at least 10 characters)' });

        if (note.trim().length < 5)
            return res.status(400).json({ message: 'Please describe your situation briefly' });

        await conn.query('START TRANSACTION');

        // Identity check — email + user_id, no JWT needed
        const [users] = await conn.query(
            `SELECT User_id FROM User WHERE User_id = ? AND Email = ?`,
            [user_id, email]
        );
        if (!users.length) {
            await conn.query('ROLLBACK');
            return res.status(404).json({ message: 'No account found with this ID and email combination' });
        }

        // Confirm Dispatcher role
        const [dispatcher] = await conn.query(
            `SELECT User_id FROM Dispatcher WHERE User_id = ?`, [user_id]
        );
        if (!dispatcher.length) {
            await conn.query('ROLLBACK');
            return res.status(403).json({ message: 'This endpoint is only for dispatchers.' });
        }

        // Auto-register as Victim if not already.
        // Dispatcher table has no Emergency_contact column, so we must ask for it
        // the first time (exactly like the Admin endpoint).
        const [existingVictim] = await conn.query(
            `SELECT User_id FROM Victim WHERE User_id = ?`, [user_id]
        );
        if (!existingVictim.length) {
            if (!emergency_contact) {
                await conn.query('ROLLBACK');
                return res.status(400).json({
                    message: 'You are not yet registered as a victim. Please also provide emergency_contact to proceed.'
                });
            }
            const phoneRegex = /^\d{10,11}$/;
            if (!phoneRegex.test(emergency_contact)) {
                await conn.query('ROLLBACK');
                return res.status(400).json({ message: 'Emergency contact must be 10 or 11 digits' });
            }
            if (!emergency_contact.startsWith('03')) {
                await conn.query('ROLLBACK');
                return res.status(400).json({ message: 'Emergency contact must start with 03 (e.g. 03001234567)' });
            }
            await conn.query(
                `INSERT INTO Victim (User_id, Emergency_contact) VALUES (?, ?)`,
                [user_id, emergency_contact]
            );
            logger.info(`Auto-registered Dispatcher as Victim for emergency: ${user_id}`);
        }

        // Round-robin available dispatchers — exclude the requesting dispatcher
        // so they don't get assigned their own emergency request
        const [dispatchers] = await conn.query(
            `SELECT User_id FROM Dispatcher WHERE Availability = 'Yes' AND User_id != ? ORDER BY User_id FOR UPDATE`,
            [user_id]
        );
        if (!dispatchers.length) {
            await conn.query('ROLLBACK');
            return res.status(503).json({ message: 'No other dispatchers are available right now. Please call emergency services directly.' });
        }

        const [lastDispatcher] = await conn.query(
            `SELECT Dispatcher_id FROM Request_log ORDER BY Request_time DESC LIMIT 1 FOR UPDATE`
        );
        let nextIndex = 0;
        if (lastDispatcher.length > 0) {
            const lastId = lastDispatcher[0].Dispatcher_id;
            const lastIdx = dispatchers.findIndex(d => d.User_id === lastId);
            nextIndex = (lastIdx + 1) % dispatchers.length;
        }
        const dispatcherId = dispatchers[nextIndex].User_id;

        const requestId = await generateUniqueId('Request_log', 'Request_id');
        await conn.query(
            `INSERT INTO Request_log (Request_id, Victim_id, Dispatcher_id, Request_time, Note, Location, Type)
             VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, 'Emergency')`,
            [requestId, user_id, dispatcherId, note, location]
        );

        await conn.query('COMMIT');
        logger.info(`Dispatcher emergency request ${requestId} submitted for ${user_id} without login`);

        res.status(201).json({
            message: 'Emergency request submitted. Another dispatcher has been notified.',
            request_id: requestId
        });

    } catch (err) {
        await conn.query('ROLLBACK');
        logger.txRollback('POST /victim/emergency/dispatcher', err.message);
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