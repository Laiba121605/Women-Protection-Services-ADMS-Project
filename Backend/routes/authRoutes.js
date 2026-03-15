const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');
const { hashPassword, comparePassword, JWT_SECRET } = require('../auth');
const crypto = require('crypto');
const logger = require('../utils/logger');

// Function to generate unique User ID
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

        // ── Field presence check ──
        if (!Name || !Email || !Phone_no || !Address || !Password || !Date_of_Birth || !Emergency_contact || !CNIC)
            return res.status(400).json({ message: "All fields are required" });

        // ── Format validations ──
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

        // ── Transaction starts here ──
        logger.txStart('POST /auth/register', Email);
        await conn.query("START TRANSACTION");

        // ── Duplicate checks ──
        const [existingEmail] = await conn.query(`SELECT User_id FROM User WHERE Email = ?`, [Email]);
        if (existingEmail.length) {
            await conn.query("ROLLBACK");
            return res.status(400).json({ message: "Email already registered" });
        }

        const [existingCNIC] = await conn.query(`SELECT User_id FROM User WHERE CNIC = ?`, [CNIC]);
        if (existingCNIC.length) {
            await conn.query("ROLLBACK");
            return res.status(400).json({ message: "CNIC already registered" });
        }

        // ── Insert user and victim ──
        const user_id = await generateUniqueUserId();
        const hashedPassword = await hashPassword(Password);

        await conn.query(
            `INSERT INTO User (User_id, Name, Email, Phone_no, Address, Password, Date_of_Birth, CNIC)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [user_id, Name, Email, Phone_no, Address, hashedPassword, Date_of_Birth, CNIC]
        );
        logger.info(`Inserted User: ${user_id} (${Email})`);

        await conn.query(
            `INSERT INTO Victim (User_id, Emergency_contact) VALUES (?, ?)`,
            [user_id, Emergency_contact]
        );
        logger.info(`Inserted Victim: ${user_id}`);

        await conn.query("COMMIT");
        logger.txCommit('POST /auth/register', `Victim registered: ${user_id}`);

        const token = jwt.sign({ id: user_id, roles: ['Victim'] }, JWT_SECRET, { expiresIn: "4h" });

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
        if (!rows.length)
            return res.status(404).json({ message: 'User not found' });

        const user = rows[0];
        const valid = await comparePassword(password, user.Password);
        if (!valid)
            return res.status(401).json({ message: 'Incorrect password' });

        const roles = [];
        const [victim]     = await pool.query('SELECT User_id FROM Victim     WHERE User_id=?', [user_id]);
        const [volunteer]  = await pool.query('SELECT User_id FROM Volunteer  WHERE User_id=?', [user_id]);
        const [dispatcher] = await pool.query('SELECT User_id FROM Dispatcher WHERE User_id=?', [user_id]);
        const [admin]      = await pool.query('SELECT User_id FROM Admin      WHERE User_id=?', [user_id]);

        if (victim.length)     roles.push('Victim');
        if (volunteer.length)  roles.push('Volunteer');
        if (dispatcher.length) roles.push('Dispatcher');
        if (admin.length)      roles.push('Admin');

        if (!roles.length)
            return res.status(403).json({ message: 'Role not found for user' });

        logger.success(`Login: ${user_id} | Roles: ${roles.join(', ')}`);

        const token = jwt.sign({ id: user.User_id, email: user.Email, roles }, JWT_SECRET, { expiresIn: '4h' });
        res.json({ token, roles });

    } catch (err) {
        logger.error(`Login failed for ${user_id}: ${err.message}`);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;