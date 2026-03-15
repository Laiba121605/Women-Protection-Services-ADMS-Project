// routes/admin.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyJWT, allowRoles, hashPassword } = require('../auth');
const crypto = require('crypto'); // for generating random IDs

// ======================================================
// 🔐 Protect all admin routes with JWT & Role check
// ======================================================
router.use(verifyJWT, allowRoles('Admin'));

// ======================================================
// 🔹 USER CRUD (Full Access for Admin)
// ======================================================

const generateUniqueUserId = async () => {
    let id;
    let exists = true;

    while (exists) {
        id = crypto.randomBytes(8).toString('hex'); // 16 char random ID
        const [rows] = await pool.query('SELECT User_id FROM User WHERE User_id = ?', [id]);
        exists = rows.length > 0;
    }

    return id;
};

// ----------------- CREATE USER -----------------
router.post('/user', async (req, res) => {
    const { name, email, phone_no, address, roles, password, date_of_birth, centre_id, emergency_contact } = req.body;

    try {
        // 1️⃣ Validate required fields
        if (!name || !email || !phone_no || !address || !roles || !password || !date_of_birth) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // 2️⃣ Validate phone number
        if (!/^\d{10,11}$/.test(phone_no)) {
            return res.status(400).json({ error: "Phone number must be 10-11 digits" });
        }

        // 3️⃣ Validate email
        if (!/\S+@\S+\.\S+/.test(email)) {
            return res.status(400).json({ error: "Invalid email format" });
        }

        // 4️⃣ Validate date_of_birth
        if (isNaN(new Date(date_of_birth))) {
            return res.status(400).json({ error: "Invalid date_of_birth format" });
        }

        // 5️⃣ Generate user ID and hash password
        const user_id = await generateUniqueUserId();
        const hashed = await hashPassword(password);

        await pool.query(
            `INSERT INTO User (User_id, Name, Email, Phone_no, Address, Roles, Password, Date_of_Birth)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [user_id, name, email, phone_no, address, roles, hashed, date_of_birth]
        );

        // Role-specific insert
        if (roles === 'Victim') {
            await pool.query(
                `INSERT INTO Victim (User_id, Emergency_contact) VALUES (?, ?)`,
                [user_id, emergency_contact]
            );
        } else if (roles === 'Dispatcher') {
            const [centre] = await pool.query('SELECT * FROM Centre WHERE Centre_id=?', [centre_id]);
            if (centre.length === 0) return res.status(400).json({ error: "Centre does not exist" });

            await pool.query(
                `INSERT INTO Dispatcher (User_id, Centre_id, Availability) VALUES (?, ?, 'Yes')`,
                [user_id, centre_id]
            );
        } else if (roles === 'Volunteer') {
            await pool.query(
                `INSERT INTO Volunteer (User_id, Status, Availability) VALUES (?, 'Pending', 'Yes')`,
                [user_id]
            );
        }

        res.json({ message: "User created successfully", user_id });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// ----------------- VIEW ALL USERS -----------------
router.get('/users', async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM User");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ----------------- UPDATE USER -----------------
router.put('/user/:id', async (req, res) => {
    const { name, email, phone_no, address, roles, password, date_of_birth, centre_id, emergency_contact } = req.body;

    try {
        // Check if user exists
        const [[user]] = await pool.query(`SELECT Roles FROM User WHERE User_id=?`, [req.params.id]);
        if (!user) return res.status(404).json({ error: "User not found" });

        // Validate fields if provided
        if (phone_no && !/^\d{10,11}$/.test(phone_no)) {
            return res.status(400).json({ error: "Phone number must be 10-11 digits" });
        }
        if (email && !/\S+@\S+\.\S+/.test(email)) {
            return res.status(400).json({ error: "Invalid email format" });
        }
        if (date_of_birth && isNaN(new Date(date_of_birth))) {
            return res.status(400).json({ error: "Invalid date_of_birth format" });
        }

        // Dispatcher centre check
        if (roles === 'Dispatcher' && centre_id) {
            const [centre] = await pool.query('SELECT * FROM Centre WHERE Centre_id=?', [centre_id]);
            if (centre.length === 0) return res.status(400).json({ error: "Centre does not exist" });
        }

        // Build update query dynamically
        let query = `UPDATE User SET `;
        const fields = [];
        const params = [];

        if (name) { fields.push("Name=?"); params.push(name); }
        if (email) { fields.push("Email=?"); params.push(email); }
        if (phone_no) { fields.push("Phone_no=?"); params.push(phone_no); }
        if (address) { fields.push("Address=?"); params.push(address); }
        if (roles) { fields.push("Roles=?"); params.push(roles); }
        if (date_of_birth) { fields.push("Date_of_Birth=?"); params.push(date_of_birth); }

        if (password) {
            const hashed = await hashPassword(password);
            fields.push("Password=?");
            params.push(hashed);
        }

        if (fields.length === 0) {
            return res.status(400).json({ error: "No fields to update" });
        }

        query += fields.join(", ") + " WHERE User_id=?";
        params.push(req.params.id);

        await pool.query(query, params);

        // Handle role changes
        if (roles && user.Roles !== roles) {
            if (user.Roles === 'Victim') await pool.query(`DELETE FROM Victim WHERE User_id=?`, [req.params.id]);
            if (user.Roles === 'Dispatcher') await pool.query(`DELETE FROM Dispatcher WHERE User_id=?`, [req.params.id]);
            if (user.Roles === 'Volunteer') await pool.query(`DELETE FROM Volunteer WHERE User_id=?`, [req.params.id]);

            if (roles === 'Victim') {
                await pool.query(`INSERT INTO Victim (User_id, Emergency_contact) VALUES (?, ?)`, [req.params.id, emergency_contact]);
            } else if (roles === 'Dispatcher') {
                await pool.query(`INSERT INTO Dispatcher (User_id, Centre_id, Availability) VALUES (?, ?, 'Yes')`, [req.params.id, centre_id]);
            } else if (roles === 'Volunteer') {
                await pool.query(`INSERT INTO Volunteer (User_id, Status, Availability) VALUES (?, 'Pending', 'Yes')`, [req.params.id]);
            }
        } else {
            if (roles === 'Victim' && emergency_contact) {
                await pool.query(`UPDATE Victim SET Emergency_contact=? WHERE User_id=?`, [emergency_contact, req.params.id]);
            }
            if (roles === 'Dispatcher' && centre_id) {
                await pool.query(`UPDATE Dispatcher SET Centre_id=? WHERE User_id=?`, [centre_id, req.params.id]);
            }
        }

        res.json({ message: "User updated successfully" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// ----------------- DELETE USER -----------------
router.delete('/user/:id', async (req, res) => {
    try {
        const [[user]] = await pool.query(`SELECT Roles FROM User WHERE User_id=?`, [req.params.id]);
        if (!user) return res.status(404).json({ error: "User not found" });

        if (user.Roles === 'Victim') await pool.query(`DELETE FROM Victim WHERE User_id=?`, [req.params.id]);
        if (user.Roles === 'Dispatcher') await pool.query(`DELETE FROM Dispatcher WHERE User_id=?`, [req.params.id]);
        if (user.Roles === 'Volunteer') await pool.query(`DELETE FROM Volunteer WHERE User_id=?`, [req.params.id]);

        await pool.query(`DELETE FROM User WHERE User_id=?`, [req.params.id]);

        res.json({ message: "User and role record deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======================================================
// 🔹 VIEW ALL TABLES (Admin read-only access)
// ======================================================
const tables = [
    'Request_log', 'Incident', 'Assignment', 'Volunteer_assignment',
    'Law_case', 'Follow_up_support', 'Ambulance_service',
    'Police_services', 'Dispatcher', 'Victim', 'Admin', 'Centre'
];

tables.forEach(table => {
    router.get(`/${table.toLowerCase()}`, async (req, res) => {
        try {
            const [rows] = await pool.query(`SELECT * FROM ${table}`);
            res.json(rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
});

// ======================================================
// 🔹 UPDATE SELECTED TABLES (Admin can update selected tables)
// ======================================================
const updatableTables = [
    'Request_log', 'Law_case', 'Follow_up_support', 'Centre',
    'Incident', 'Assignment', 'Ambulance_service', 'Police_services'
];

updatableTables.forEach(table => {
    router.put(`/${table.toLowerCase()}/:id`, async (req, res) => {
        try {
            const updates = Object.keys(req.body).map(key => `${key}=?`).join(', ');
            const values = Object.values(req.body);
            values.push(req.params.id);

            await pool.query(`UPDATE ${table} SET ${updates} WHERE ${table}_id=?`, values);

            res.json({ message: `${table} updated successfully` });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
});

module.exports = router;