// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');
const { hashPassword, comparePassword, JWT_SECRET, verifyJWT } = require('../auth');
const crypto = require('crypto');
const logger = require('../utils/logger');

const generateUniqueUserId = async () => {
    let id;
    let exists = true;
    while (exists) {
        id = crypto.randomBytes(8).toString('hex');
        const [rows] = await pool.query('SELECT User_id FROM User WHERE User_id=?', [id]);
        exists = rows.length > 0;
    }
    return id;
};

// ---------------- REGISTER ----------------
router.post('/register', async (req, res) => {
    const { Name, Email, Phone_no, Address, Password, Date_of_Birth, Emergency_contact, CNIC } = req.body;
    const conn = await pool.getConnection();
    try {
        if (!Name || !Email || !Phone_no || !Address || !Password || !Date_of_Birth || !Emergency_contact || !CNIC)
            return res.status(400).json({ message: "All fields are required" });

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(Email))
            return res.status(400).json({ message: "Invalid email format" });

        const phoneRegex = /^\d{10,11}$/;
        if (!phoneRegex.test(Phone_no))
            return res.status(400).json({ message: "Phone number must be 10 or 11 digits" });
        if (!phoneRegex.test(Emergency_contact))
            return res.status(400).json({ message: "Emergency contact must be 10 or 11 digits" });

        const cnicRegex = /^\d{13}$/;
        if (!cnicRegex.test(CNIC))
            return res.status(400).json({ message: "CNIC must be exactly 13 digits" });

        const dob = new Date(Date_of_Birth);
        if (isNaN(dob.getTime()))
            return res.status(400).json({ message: "Invalid Date_of_Birth format. Use YYYY-MM-DD" });

        const passwordRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$/;
        if (!passwordRegex.test(Password))
            return res.status(400).json({ message: "Password must be at least 8 characters and include an uppercase letter, a number, and a special character" });

        logger.txStart('POST /auth/register', Email);
        await conn.query("START TRANSACTION");

        const [existingEmail] = await conn.query(`SELECT User_id FROM User WHERE Email = ?`, [Email]);
        if (existingEmail.length) { await conn.query("ROLLBACK"); return res.status(400).json({ message: "Email already registered" }); }

        const [existingCNIC] = await conn.query(`SELECT User_id FROM User WHERE CNIC = ?`, [CNIC]);
        if (existingCNIC.length) { await conn.query("ROLLBACK"); return res.status(400).json({ message: "CNIC already registered" }); }

        const user_id = await generateUniqueUserId();
        const hashedPassword = await hashPassword(Password);

        await conn.query(
            `INSERT INTO User (User_id, Name, Email, Phone_no, Address, Password, Date_of_Birth, CNIC) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [user_id, Name, Email, Phone_no, Address, hashedPassword, Date_of_Birth, CNIC]
        );
        logger.info(`Inserted User: ${user_id} (${Email})`);

        await conn.query(`INSERT INTO Victim (User_id, Emergency_contact) VALUES (?, ?)`, [user_id, Emergency_contact]);
        logger.info(`Inserted Victim: ${user_id}`);

        await conn.query("COMMIT");
        logger.txCommit('POST /auth/register', `Victim registered: ${user_id}`);

        const token = jwt.sign({ id: user_id, email: Email, roles: ['Victim'] }, JWT_SECRET, { expiresIn: "4h" });
        res.status(201).json({ message: "Victim registered successfully", user_id, roles: ['Victim'], token });

    } catch (err) {
        await conn.query("ROLLBACK");
        logger.txRollback('POST /auth/register', err.message);
        console.error(err);
        res.status(500).json({ message: err.message });
    } finally {
        conn.release();
    }
});

// ---------------- LOGIN ----------------
router.post('/login', async (req, res) => {
    const { user_id, password } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM User WHERE User_id=?', [user_id]);
        if (!rows.length) return res.status(404).json({ message: 'User not found' });

        const user = rows[0];
        const valid = await comparePassword(password, user.Password);
        if (!valid) return res.status(401).json({ message: 'Incorrect password' });

        const roles = [];
        const [victim]     = await pool.query('SELECT User_id FROM Victim     WHERE User_id=?', [user_id]);
        const [volunteer]  = await pool.query('SELECT User_id FROM Volunteer  WHERE User_id=?', [user_id]);
        const [dispatcher] = await pool.query('SELECT User_id FROM Dispatcher WHERE User_id=?', [user_id]);
        const [admin]      = await pool.query('SELECT User_id FROM Admin      WHERE User_id=?', [user_id]);

        if (victim.length)     roles.push('Victim');
        if (volunteer.length)  roles.push('Volunteer');
        if (dispatcher.length) roles.push('Dispatcher');
        if (admin.length)      roles.push('Admin');

        if (!roles.length) return res.status(403).json({ message: 'Role not found for user' });

        logger.success(`Login: ${user_id} | Roles: ${roles.join(', ')}`);

        const token = jwt.sign({ id: user.User_id, email: user.Email, roles }, JWT_SECRET, { expiresIn: '4h' });
        res.json({ token, roles });

    } catch (err) {
        logger.error(`Login failed for ${user_id}: ${err.message}`);
        res.status(500).json({ message: err.message });
    }
});

// ---------------- LOGOUT ----------------
// Role-specific logout behaviour:
//
// Admin:
//   - Blocks if any Password_Recovery requests are Pending and assigned to them
//   - Sets Admin.Availability = 'No' on success
//
// Volunteer:
//   - Blocks if they have any active (non-Completed) Volunteer_assignment rows
//   - Sets Volunteer.Availability = 'No' and Status = NULL on success
//
// Dispatcher:
//   - Checks three things and blocks if ANY are active:
//       1. Request_log   — unprocessed requests (no incident created yet)
//       2. Incident      — incidents still Ongoing or Pending
//       3. Assignment    — assignments still Ongoing or Pending
//          (linked through Incident → Request_log → Dispatcher_id)
//   - Sets Dispatcher.Availability = 'No' on success
//
// Victim:
//   - Never blocked — always allowed to log out
router.post('/logout', verifyJWT, async (req, res) => {
    const conn = await pool.getConnection();
    try {

        // ── Admin ─────────────────────────────────────────────────────────────
        const [adminRows] = await conn.query(
            `SELECT User_id FROM Admin WHERE User_id = ?`, [req.user.id]
        );
        if (adminRows.length) {
            await conn.query('START TRANSACTION');
            await conn.query(`SELECT User_id FROM Admin WHERE User_id = ? FOR UPDATE`, [req.user.id]);

            const [pending] = await conn.query(
                `SELECT Recovery_id FROM Password_Recovery WHERE Admin_id = ? AND Status = 'Pending'`,
                [req.user.id]
            );
            if (pending.length > 0) {
                await conn.query('ROLLBACK');
                return res.status(400).json({
                    message: `Cannot log out. You have ${pending.length} pending recovery request(s). Please process them first.`
                });
            }

            await conn.query(`UPDATE Admin SET Availability = 'No' WHERE User_id = ?`, [req.user.id]);
            await conn.query('COMMIT');
            logger.info(`Admin ${req.user.id} logged out — Availability set to No`);
            return res.json({ message: 'Logged out successfully' });
        }

        // ── Volunteer ─────────────────────────────────────────────────────────
        const [volunteerRows] = await conn.query(
            `SELECT User_id FROM Volunteer WHERE User_id = ?`, [req.user.id]
        );
        if (volunteerRows.length) {
            await conn.query('START TRANSACTION');
            await conn.query(`SELECT User_id FROM Volunteer WHERE User_id = ? FOR UPDATE`, [req.user.id]);

            // Check Volunteer_assignment → Assignment for any non-Completed rows
            const [activeAssignments] = await conn.query(
                `SELECT a.Assignment_id, a.Status
                 FROM Assignment a
                 JOIN Volunteer_assignment va ON a.Assignment_id = va.Assignment_id
                 WHERE va.Volunteer_id = ? AND a.Status != 'Completed'`,
                [req.user.id]
            );
            if (activeAssignments.length > 0) {
                await conn.query('ROLLBACK');
                return res.status(400).json({
                    message: `Cannot log out. You have ${activeAssignments.length} active assignment(s) not yet completed.`
                });
            }

            await conn.query(
                `UPDATE Volunteer SET Availability = 'No', Status = NULL WHERE User_id = ?`,
                [req.user.id]
            );
            await conn.query('COMMIT');
            logger.info(`Volunteer ${req.user.id} logged out — Availability set to No`);
            return res.json({ message: 'Logged out successfully' });
        }

        // ── Dispatcher ────────────────────────────────────────────────────────
        const [dispRows] = await conn.query(
            `SELECT User_id FROM Dispatcher WHERE User_id = ?`, [req.user.id]
        );
        if (dispRows.length) {
            await conn.query('START TRANSACTION');
            await conn.query(`SELECT User_id FROM Dispatcher WHERE User_id = ? FOR UPDATE`, [req.user.id]);

            // Check 1: Emergency requests with no incident created yet
            // Query and False type requests never need an incident — only Emergency does
            const [unprocessedRequests] = await conn.query(
                `SELECT r.Request_id
                 FROM Request_log r
                 LEFT JOIN Incident i ON r.Request_id = i.Request_id
                 WHERE r.Dispatcher_id = ?
                   AND r.Type = 'Emergency'
                   AND i.Incident_id IS NULL`,
                [req.user.id]
            );

            // Check 2: Incident — any still Ongoing or Pending
            const [activeIncidents] = await conn.query(
                `SELECT i.Incident_id, i.Status
                 FROM Incident i
                 JOIN Request_log r ON i.Request_id = r.Request_id
                 WHERE r.Dispatcher_id = ? AND i.Status != 'Completed'`,
                [req.user.id]
            );

            // Check 3: Assignment — any still Ongoing or Pending
            // linked through Incident → Request_log → Dispatcher_id
            const [activeAssignments] = await conn.query(
                `SELECT a.Assignment_id, a.Status
                 FROM Assignment a
                 JOIN Incident i    ON a.Incident_id = i.Incident_id
                 JOIN Request_log r ON i.Request_id  = r.Request_id
                 WHERE r.Dispatcher_id = ? AND a.Status != 'Completed'`,
                [req.user.id]
            );

            const totalBlocking =
                unprocessedRequests.length +
                activeIncidents.length +
                activeAssignments.length;

            if (totalBlocking > 0) {
                await conn.query('ROLLBACK');

                const parts = [];
                if (unprocessedRequests.length > 0)
                    parts.push(`${unprocessedRequests.length} unprocessed request(s)`);
                if (activeIncidents.length > 0)
                    parts.push(`${activeIncidents.length} active incident(s)`);
                if (activeAssignments.length > 0)
                    parts.push(`${activeAssignments.length} active assignment(s)`);

                return res.status(400).json({
                    message: `Cannot log out. You have ${parts.join(', ')} not yet completed. Please resolve or hand them off first.`
                });
            }

            await conn.query(
                `UPDATE Dispatcher SET Availability = 'No' WHERE User_id = ?`, [req.user.id]
            );
            await conn.query('COMMIT');
            logger.info(`Dispatcher ${req.user.id} logged out — Availability set to No`);
            return res.json({ message: 'Logged out successfully' });
        }

        // ── Victim — never blocked ────────────────────────────────────────────
        res.json({ message: 'Logged out successfully' });

    } catch (err) {
        await conn.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: err.message });
    } finally {
        conn.release();
    }
});

module.exports = router;