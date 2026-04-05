// routes/admin.js
const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const { verifyJWT, allowRoles, hashPassword } = require('../auth');
const crypto  = require('crypto');
const logger  = require('../utils/logger');

// ======================================================
// 🔐 Protect all admin routes with JWT & Role check
// ======================================================
router.use(verifyJWT, allowRoles('Admin'));

// ======================================================
// 🔹 ADMIN PRIORITY SYSTEM
// ======================================================

let adminActive     = false;
let adminLockExpiry = null;
let activeAdminId   = null;
const ADMIN_LOCK_DURATION = 5 * 60 * 1000;
const NAMED_LOCK_KEY      = 'admin_write_lock';
const NAMED_LOCK_TIMEOUT  = 0;

// ── Allowlists ────────────────────────────────────────
const VALID_TABLES = new Set([
    'Request_log', 'Incident', 'Assignment', 'Volunteer_assignment',
    'Law_case', 'Follow_up_support', 'Ambulance_service',
    'Police_services', 'Dispatcher', 'Victim', 'Admin',
    'Centre', 'User', 'Password_Recovery', 'Volunteer'
]);

const TABLE_ID_FIELDS = {
    Request_log:          'Request_id',
    Incident:             'Incident_id',
    Assignment:           'Assignment_id',
    Volunteer_assignment: 'Vol_assignment_id',
    Law_case:             'Law_case_id',
    Follow_up_support:    'follow_up_id',
    Ambulance_service:    'Ambulance_id',
    Police_services:      'Centre_id',
    Dispatcher:           'User_id',
    Victim:               'User_id',
    Admin:                'User_id',
    Centre:               'Centre_id',
    User:                 'User_id',
    Password_Recovery:    'Recovery_id',
    Volunteer:            'User_id',
};

const VALID_SORT_COLUMNS = new Set(['Name', 'Email', 'Date_of_Birth', 'User_id']);
const SAFE_IDENTIFIER    = /^[A-Za-z_][A-Za-z0-9_ ]*$/;
const LOCK_TIMEOUT       = 5;

function validateIdentifier(value, label) {
    if (!value || !SAFE_IDENTIFIER.test(value))
        throw new Error(`Invalid ${label}: '${value}'`);
}

function validateCNIC(cnic) {
    if (!/^\d{5}-\d{7}-\d$/.test(cnic))
        throw new Error('Invalid CNIC format. Use #####-#######-# (e.g. 12345-1234567-1).');
}

// ======================================================
// 🔹 NAMED-LOCK HELPERS
// ======================================================

async function acquireNamedLock(connection) {
    const [[row]] = await connection.query(
        `SELECT GET_LOCK(?, ?) AS acquired`, [NAMED_LOCK_KEY, NAMED_LOCK_TIMEOUT]
    );
    return row.acquired === 1;
}

async function releaseNamedLock(connection) {
    await connection.query(`SELECT RELEASE_LOCK(?) AS released`, [NAMED_LOCK_KEY]);
}

async function isNamedLockFree() {
    const [[row]] = await pool.query(`SELECT IS_FREE_LOCK(?) AS free`, [NAMED_LOCK_KEY]);
    return row.free === 1;
}

// ======================================================
// 🔹 WRITE-LOCK MIDDLEWARE (table management routes only)
// ======================================================

const lockWrite = (tables) => {
    return async (req, res, next) => {
        for (const t of tables) {
            if (!VALID_TABLES.has(t))
                return res.status(400).json({ error: `Unknown table: ${t}` });
        }
        const connection = await pool.getConnection();
        try {
            const acquired = await acquireNamedLock(connection);
            if (!acquired) {
                connection.release();
                return res.status(423).json({
                    error: 'System is currently locked by another write operation. Try again shortly.'
                });
            }
            req.dbConnection = connection;
            next();
        } catch (err) {
            connection.release();
            res.status(500).json({ error: `Failed to acquire write lock: ${err.message}` });
        }
    };
};

const unlockAll = async (req) => {
    if (req.dbConnection) {
        try {
            await releaseNamedLock(req.dbConnection);
        } catch (err) {
            console.error('Error releasing locks:', err);
        } finally {
            req.dbConnection.release();
            req.dbConnection = null;
        }
    }
};

// ======================================================
// 🔹 ROW-LEVEL LOCKING HELPERS
// ======================================================

async function acquireRowLock(connection, table, idValue) {
    const lockKey = `${table}_${idValue}`;

    const [[{ locked_by }]] = await connection.query(
        `SELECT IS_USED_LOCK(?) AS locked_by`, [lockKey]
    );

    if (locked_by && locked_by !== connection.threadId) {
        await connection.query(`SELECT RELEASE_LOCK(?)`, [lockKey]);
        logger.info(`ADMIN_LOCK_OVERRIDE - Admin forced lock release on ${lockKey} held by connection ${locked_by}`);
    }

    const [[{ acquired }]] = await connection.query(
        `SELECT GET_LOCK(?, ?) AS acquired`, [lockKey, LOCK_TIMEOUT]
    );

    if (!acquired) throw new Error(`Could not acquire lock on this record.`);
}

async function releaseRowLock(connection, table, idValue) {
    await connection.query(`SELECT RELEASE_LOCK(?)`, [`${table}_${idValue}`]);
}

const lockRow = (table, idParam = 'id') => {
    return async (req, res, next) => {
        const idValue = req.params[idParam];
        const idField = TABLE_ID_FIELDS[table];

        if (!idField)
            return res.status(500).json({ error: `No ID field configured for table '${table}'.` });

        const connection = await pool.getConnection();

        try {
            const [rows] = await connection.query(
                `SELECT * FROM ${table} WHERE ${idField} = ?`, [idValue]
            );

            if (!rows.length) {
                connection.release();
                return res.status(404).json({ error: 'Record not found.' });
            }

            await acquireRowLock(connection, table, idValue);

            req.dbConnection = connection;
            req.lockedRow    = { table, idField, idValue, data: rows[0] };
            next();
        } catch (err) {
            connection.release();
            return res.status(err.message.includes('locked') ? 423 : 500)
                      .json({ error: err.message });
        }
    };
};

// ======================================================
// 🔹 ADMIN PRIORITY CHECK MIDDLEWARE
// ======================================================

const checkAdminPriority = (req, res, next) => {
    if (req.method === 'GET') return next();
    if (adminActive && adminLockExpiry > Date.now()) {
        if (activeAdminId && activeAdminId !== req.user.id) {
            return res.status(423).json({
                error:     'System is locked by another admin for maintenance.',
                lockedBy:  activeAdminId,
                expiresIn: Math.floor((adminLockExpiry - Date.now()) / 1000) + ' seconds',
            });
        }
    }
    next();
};

const getAdminLockState = () => ({ adminActive, adminLockExpiry, adminLockHolder: activeAdminId });

router.use(checkAdminPriority);

// ======================================================
// 🔹 ADMIN PRIORITY ENDPOINTS
// ======================================================

router.post('/system/claim-priority', async (req, res) => {
    const { duration = ADMIN_LOCK_DURATION } = req.body;
    if (adminActive && adminLockExpiry > Date.now() && activeAdminId !== req.user.id) {
        logger.info(`CLAIM_PRIORITY_BLOCKED by ${activeAdminId} - User: ${req.user.id}`);
        return res.status(409).json({
            error:     'System already locked by another admin.',
            lockedBy:  activeAdminId,
            expiresIn: Math.floor((adminLockExpiry - Date.now()) / 1000) + ' seconds',
        });
    }
    adminActive     = true;
    adminLockExpiry = Date.now() + duration;
    activeAdminId   = req.user.id;
    logger.info(`CLAIM_PRIORITY - User: ${req.user.id}, Expires: ${new Date(adminLockExpiry)}`);
    res.json({ message: 'Admin priority claimed successfully.', lockedBy: activeAdminId, expiresAt: new Date(adminLockExpiry), duration });
});

router.post('/system/release-priority', async (req, res) => {
    if (activeAdminId !== req.user.id) {
        logger.info(`RELEASE_PRIORITY_DENIED - User: ${req.user.id}, Locked by: ${activeAdminId}`);
        return res.status(403).json({ error: 'Only the locking admin can release priority.', lockedBy: activeAdminId });
    }
    adminActive     = false;
    adminLockExpiry = null;
    activeAdminId   = null;
    logger.info(`RELEASE_PRIORITY - User: ${req.user.id}`);
    res.json({ message: 'Admin priority released.' });
});

router.post('/system/force-release', async (req, res) => {
    const previous = activeAdminId;
    adminActive     = false;
    adminLockExpiry = null;
    activeAdminId   = null;
    logger.info(`FORCE_RELEASE_PRIORITY - User: ${req.user.id}, Previously locked by: ${previous}`);
    res.json({ message: 'Admin priority forcefully released.' });
});

router.get('/system/lock-status', async (req, res) => {
    const dbLockFree = await isNamedLockFree();
    logger.info(`CHECK_LOCK_STATUS - User: ${req.user.id}`);
    res.json({
        appLock: { active: adminActive && adminLockExpiry > Date.now(), lockedBy: activeAdminId, expiresAt: adminLockExpiry ? new Date(adminLockExpiry) : null },
        dbLock:  { free: dbLockFree },
        currentUser: req.user.id,
    });
});

// ======================================================
// 🔹 USER CRUD
// ======================================================

const generateUniqueUserId = async () => {
    let id, exists = true;
    while (exists) {
        id = crypto.randomBytes(8).toString('hex');
        const [rows] = await pool.query('SELECT User_id FROM User WHERE User_id = ?', [id]);
        exists = rows.length > 0;
    }
    return id;
};

// ── CREATE USER ──────────────────────────────────────────
router.post('/user', async (req, res) => {
    const {
        name, email, phone_no, address, password,
        date_of_birth, role, centre_id, emergency_contact, cnic
    } = req.body;

    const validRoles       = ['Admin', 'Victim', 'Volunteer', 'Dispatcher'];
    const rolesRequiring18 = ['Admin', 'Volunteer', 'Dispatcher'];

    const connection = await pool.getConnection();
    let transactionStarted = false;

    try {
        logger.info(`CREATE_USER_START - Admin: ${req.user.id}, Role: ${role}`);

        const [[{ acquired }]] = await connection.query(
            `SELECT GET_LOCK(?, 10) AS acquired`, [NAMED_LOCK_KEY]
        );
        if (!acquired) {
            return res.status(423).json({ error: 'System locked by another write operation.' });
        }

        if (!name || !email || !phone_no || !address || !password || !date_of_birth || !role || !cnic)
            throw new Error('Missing required fields.');
        if (!validRoles.includes(role))
            throw new Error('Invalid role.');
        if (!/^\d{10,11}$/.test(phone_no))
            throw new Error('Phone number must be 10-11 digits.');
        if (!/\S+@\S+\.\S+/.test(email))
            throw new Error('Invalid email format.');

        validateCNIC(cnic);

        if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date_of_birth))
            throw new Error('Invalid date_of_birth format. Use YYYY-MM-DD.');

        const dob = new Date(date_of_birth + 'T00:00:00');
        if (isNaN(dob.getTime())) throw new Error('Invalid date value.');

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (dob >= today) throw new Error('Date of birth cannot be today or in the future.');

        let age = today.getFullYear() - dob.getFullYear();
        const md = today.getMonth() - dob.getMonth();
        if (md < 0 || (md === 0 && today.getDate() < dob.getDate())) age--;

        if (rolesRequiring18.includes(role) && age < 18)
            throw new Error(`${role} must be 18 years or older. Provided age: ${age}.`);

        if (role === 'Victim') {
            if (!emergency_contact) throw new Error('Emergency contact required for Victim.');
            if (!/^\d{10,11}$/.test(emergency_contact)) throw new Error('Emergency contact must be 10-11 digits.');
            if (emergency_contact === phone_no) throw new Error('Emergency contact cannot be the same as personal phone number.');
        }

        if (role === 'Volunteer') {
            if (!emergency_contact) throw new Error('Emergency contact required for Volunteer.');
            if (!/^\d{10,11}$/.test(emergency_contact)) throw new Error('Emergency contact must be 10-11 digits.');
            if (emergency_contact === phone_no) throw new Error('Emergency contact cannot be the same as personal phone number.');
            if (!centre_id) throw new Error('Centre ID required for Volunteer.');
            const [vc] = await connection.query('SELECT Centre_id FROM Centre WHERE Centre_id = ?', [centre_id]);
            if (!vc.length) throw new Error('Centre does not exist.');
        }

        if (role === 'Dispatcher') {
            if (!centre_id) throw new Error('Centre ID required for Dispatcher.');
            const [dc] = await connection.query('SELECT Centre_id FROM Centre WHERE Centre_id = ?', [centre_id]);
            if (!dc.length) throw new Error('Centre does not exist.');
        }

        const [existingEmail] = await connection.query('SELECT User_id FROM User WHERE Email = ?', [email]);
        if (existingEmail.length) throw new Error('A user with this email already exists.');

        const [existingPhone] = await connection.query('SELECT User_id FROM User WHERE Phone_no = ?', [phone_no]);
        if (existingPhone.length) throw new Error('A user with this phone number already exists.');

        const [existingCnic] = await connection.query('SELECT User_id FROM User WHERE CNIC = ?', [cnic]);
        if (existingCnic.length) throw new Error('A user with this CNIC already exists.');

        let existingEmergency = null;
        if (role === 'Victim') {
            [existingEmergency] = await connection.query(
                'SELECT User_id, Name FROM User WHERE Phone_no = ?', [emergency_contact]
            );
        }

        await connection.query('START TRANSACTION');
        transactionStarted = true;

        const user_id = await generateUniqueUserId();
        const hashed  = await hashPassword(password);

        await connection.query(
            `INSERT INTO User (User_id, Name, Email, Phone_no, Address, Password, Date_of_Birth, CNIC)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [user_id, name, email, phone_no, address, hashed, date_of_birth, cnic]
        );

        if (role === 'Victim')
            await connection.query(
                `INSERT INTO Victim (User_id, Emergency_contact) VALUES (?, ?)`,
                [user_id, emergency_contact]
            );

        if (role === 'Volunteer')
            await connection.query(
                `INSERT INTO Volunteer (User_id, Status, Availability, Emergency_contact, Centre_id)
                 VALUES (?, 'Pending', 'Yes', ?, ?)`,
                [user_id, emergency_contact, centre_id]
            );

        if (role === 'Dispatcher')
            await connection.query(
                `INSERT INTO Dispatcher (User_id, Centre_id, Availability) VALUES (?, ?, 'Yes')`,
                [user_id, centre_id]
            );

        if (role === 'Admin')
            await connection.query(`INSERT INTO Admin (User_id) VALUES (?)`, [user_id]);

        await connection.query('COMMIT');
        transactionStarted = false;

        logger.info(`CREATE_USER_SUCCESS - User: ${user_id}, Role: ${role}, Admin: ${req.user.id}`);

        const response = { message: 'User created successfully.', user_id, role, age };
        if (role === 'Victim' && existingEmergency?.length)
            response.warning = `Emergency contact belongs to registered user: ${existingEmergency[0].Name}`;

        res.json(response);

    } catch (err) {
        if (transactionStarted)
            await connection.query('ROLLBACK').catch(() => {});
        logger.error(`CREATE_USER_FAILED: ${err.message} - Admin: ${req.user.id}`);
        res.status(400).json({ error: err.message });
    } finally {
        await connection.query('SELECT RELEASE_LOCK(?)', [NAMED_LOCK_KEY]).catch(() => {});
        connection.release();
    }
});

// ── UPDATE USER ──────────────────────────────────────────
router.put('/user/:id', lockRow('User', 'id'), async (req, res) => {
    const {
        name, email, phone_no, address, role,
        password, date_of_birth, centre_id, emergency_contact, cnic
    } = req.body;

    const userId           = req.params.id;
    const user             = req.lockedRow.data;
    const rolesRequiring18 = ['Admin', 'Volunteer', 'Dispatcher'];
    let transactionStarted = false;

    try {
        if (phone_no && phone_no !== user.Phone_no) {
            if (!/^\d{10,11}$/.test(phone_no)) throw new Error('Phone number must be 10-11 digits.');
            const [ep] = await req.dbConnection.query(
                'SELECT User_id FROM User WHERE Phone_no = ? AND User_id != ?', [phone_no, userId]
            );
            if (ep.length) throw new Error('This phone number is already registered to another user.');
        }

        if (email && email !== user.Email) {
            if (!/\S+@\S+\.\S+/.test(email)) throw new Error('Invalid email format.');
            const [ee] = await req.dbConnection.query(
                'SELECT User_id FROM User WHERE Email = ? AND User_id != ?', [email, userId]
            );
            if (ee.length) throw new Error('This email is already registered to another user.');
        }

        if (cnic && cnic !== user.CNIC) {
            validateCNIC(cnic);
            const [ec] = await req.dbConnection.query(
                'SELECT User_id FROM User WHERE CNIC = ? AND User_id != ?', [cnic, userId]
            );
            if (ec.length) throw new Error('This CNIC is already registered to another user.');
        }

        let age = null;
        if (date_of_birth) {
            if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date_of_birth))
                throw new Error('Invalid date_of_birth format. Use YYYY-MM-DD.');
            const dob = new Date(date_of_birth + 'T00:00:00');
            if (isNaN(dob.getTime())) throw new Error('Invalid date value.');
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (dob >= today) throw new Error('Date of birth cannot be today or in the future.');

            age = today.getFullYear() - dob.getFullYear();
            const md = today.getMonth() - dob.getMonth();
            if (md < 0 || (md === 0 && today.getDate() < dob.getDate())) age--;

            const roleToCheck = role || null;
            if (roleToCheck && rolesRequiring18.includes(roleToCheck) && age < 18)
                throw new Error(`${roleToCheck} must be 18 years or older. Provided age: ${age}.`);

            if (!roleToCheck) {
                const [[cv]] = await req.dbConnection.query('SELECT User_id FROM Victim     WHERE User_id = ?', [userId]);
                const [[cl]] = await req.dbConnection.query('SELECT User_id FROM Volunteer  WHERE User_id = ?', [userId]);
                const [[cd]] = await req.dbConnection.query('SELECT User_id FROM Dispatcher WHERE User_id = ?', [userId]);
                const [[ca]] = await req.dbConnection.query('SELECT User_id FROM Admin      WHERE User_id = ?', [userId]);
                let currentRole = null;
                if (cv) currentRole = 'Victim';
                if (cl) currentRole = 'Volunteer';
                if (cd) currentRole = 'Dispatcher';
                if (ca) currentRole = 'Admin';
                if (currentRole && rolesRequiring18.includes(currentRole) && age < 18)
                    throw new Error(`${currentRole} must be 18 years or older. Provided age: ${age}.`);
            }
        }

        const [victimRows]     = await req.dbConnection.query('SELECT User_id FROM Victim     WHERE User_id = ?', [userId]);
        const [volunteerRows]  = await req.dbConnection.query('SELECT User_id FROM Volunteer  WHERE User_id = ?', [userId]);
        const [dispatcherRows] = await req.dbConnection.query('SELECT User_id FROM Dispatcher WHERE User_id = ?', [userId]);
        const [adminRows]      = await req.dbConnection.query('SELECT User_id FROM Admin      WHERE User_id = ?', [userId]);

        const isCurrentlyVictim     = victimRows.length > 0;
        const isCurrentlyVolunteer  = volunteerRows.length > 0;
        const isCurrentlyDispatcher = dispatcherRows.length > 0;
        const isCurrentlyAdmin      = adminRows.length > 0;

        let oldPrimaryRole = null;
        if (isCurrentlyVolunteer)  oldPrimaryRole = 'Volunteer';
        if (isCurrentlyDispatcher) oldPrimaryRole = 'Dispatcher';
        if (isCurrentlyAdmin)      oldPrimaryRole = 'Admin';
        if (!oldPrimaryRole && isCurrentlyVictim) oldPrimaryRole = 'Victim';

        if (role && role !== oldPrimaryRole) {
            if (role === 'Victim') {
                if (!emergency_contact) throw new Error('Emergency contact required for Victim.');
                if (!/^\d{10,11}$/.test(emergency_contact)) throw new Error('Emergency contact must be 10-11 digits.');
                const phoneToCheck = phone_no || user.Phone_no;
                if (emergency_contact === phoneToCheck) throw new Error('Emergency contact cannot be the same as personal phone number.');
            }
            if (role === 'Volunteer') {
                if (!emergency_contact) throw new Error('Emergency contact required for Volunteer.');
                if (!/^\d{10,11}$/.test(emergency_contact)) throw new Error('Emergency contact must be 10-11 digits.');
                const phoneToCheck = phone_no || user.Phone_no;
                if (emergency_contact === phoneToCheck) throw new Error('Emergency contact cannot be the same as personal phone number.');
                if (!centre_id) throw new Error('Centre ID required for Volunteer.');
                const [vc] = await req.dbConnection.query('SELECT Centre_id FROM Centre WHERE Centre_id = ?', [centre_id]);
                if (!vc.length) throw new Error('Centre does not exist.');
            }
            if (role === 'Dispatcher') {
                if (!centre_id) throw new Error('Centre ID required for Dispatcher.');
                const [dc] = await req.dbConnection.query('SELECT Centre_id FROM Centre WHERE Centre_id = ?', [centre_id]);
                if (!dc.length) throw new Error('Centre does not exist.');
            }
            if (rolesRequiring18.includes(role)) {
                const dobToCheck = date_of_birth
                    ? new Date(date_of_birth + 'T00:00:00')
                    : new Date(user.Date_of_Birth + 'T00:00:00');
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                let ageToCheck = today.getFullYear() - dobToCheck.getFullYear();
                const md = today.getMonth() - dobToCheck.getMonth();
                if (md < 0 || (md === 0 && today.getDate() < dobToCheck.getDate())) ageToCheck--;
                if (ageToCheck < 18) throw new Error(`${role} must be 18 years or older. Current age: ${ageToCheck}.`);
            }
        }

        if (!role || role === oldPrimaryRole) {
            if ((oldPrimaryRole === 'Victim' || oldPrimaryRole === 'Volunteer') && emergency_contact) {
                if (!/^\d{10,11}$/.test(emergency_contact)) throw new Error('Emergency contact must be 10-11 digits.');
                const phoneToCheck = phone_no || user.Phone_no;
                if (emergency_contact === phoneToCheck) throw new Error('Emergency contact cannot be the same as personal phone number.');
            }
            if ((oldPrimaryRole === 'Dispatcher' || oldPrimaryRole === 'Volunteer') && centre_id) {
                const [vc] = await req.dbConnection.query('SELECT Centre_id FROM Centre WHERE Centre_id = ?', [centre_id]);
                if (!vc.length) throw new Error('Centre does not exist.');
            }
        }

        await req.dbConnection.query('START TRANSACTION');
        transactionStarted = true;

        const fields = [], params = [];
        if (name)         { fields.push('Name=?');          params.push(name); }
        if (email)        { fields.push('Email=?');         params.push(email); }
        if (phone_no)     { fields.push('Phone_no=?');      params.push(phone_no); }
        if (address)      { fields.push('Address=?');       params.push(address); }
        if (date_of_birth){ fields.push('Date_of_Birth=?'); params.push(date_of_birth); }
        if (cnic)         { fields.push('CNIC=?');          params.push(cnic); }
        if (password) {
            const hashed = await hashPassword(password);
            fields.push('Password=?');
            params.push(hashed);
        }

        if (fields.length > 0) {
            params.push(userId);
            await req.dbConnection.query(
                `UPDATE User SET ${fields.join(', ')} WHERE User_id = ?`, params
            );
        }

        if (role && role !== oldPrimaryRole) {
            if (isCurrentlyVolunteer)
                await req.dbConnection.query('DELETE FROM Volunteer  WHERE User_id = ?', [userId]);
            if (isCurrentlyDispatcher)
                await req.dbConnection.query('DELETE FROM Dispatcher WHERE User_id = ?', [userId]);
            if (isCurrentlyAdmin)
                await req.dbConnection.query('DELETE FROM Admin      WHERE User_id = ?', [userId]);
            if (oldPrimaryRole === 'Victim' && role !== 'Victim')
                await req.dbConnection.query('DELETE FROM Victim     WHERE User_id = ?', [userId]);

            if (role === 'Victim')
                await req.dbConnection.query(
                    `INSERT INTO Victim (User_id, Emergency_contact) VALUES (?, ?)`,
                    [userId, emergency_contact]
                );
            if (role === 'Volunteer')
                await req.dbConnection.query(
                    `INSERT INTO Volunteer (User_id, Status, Availability, Emergency_contact, Centre_id)
                     VALUES (?, 'Pending', 'Yes', ?, ?)`,
                    [userId, emergency_contact, centre_id]
                );
            if (role === 'Dispatcher')
                await req.dbConnection.query(
                    `INSERT INTO Dispatcher (User_id, Centre_id, Availability) VALUES (?, ?, 'Yes')`,
                    [userId, centre_id]
                );
            if (role === 'Admin')
                await req.dbConnection.query(`INSERT INTO Admin (User_id) VALUES (?)`, [userId]);
        }

        if (!role || role === oldPrimaryRole) {
            if (oldPrimaryRole === 'Victim' && emergency_contact)
                await req.dbConnection.query(
                    'UPDATE Victim SET Emergency_contact = ? WHERE User_id = ?',
                    [emergency_contact, userId]
                );
            if (oldPrimaryRole === 'Volunteer' && emergency_contact)
                await req.dbConnection.query(
                    'UPDATE Volunteer SET Emergency_contact = ? WHERE User_id = ?',
                    [emergency_contact, userId]
                );
            if (oldPrimaryRole === 'Dispatcher' && centre_id)
                await req.dbConnection.query(
                    'UPDATE Dispatcher SET Centre_id = ? WHERE User_id = ?',
                    [centre_id, userId]
                );
            if (oldPrimaryRole === 'Volunteer' && centre_id)
                await req.dbConnection.query(
                    'UPDATE Volunteer SET Centre_id = ? WHERE User_id = ?',
                    [centre_id, userId]
                );
        }

        await req.dbConnection.query('COMMIT');
        transactionStarted = false;

        logger.info(`UPDATE_USER_SUCCESS - User: ${userId}, Admin: ${req.user.id}`);
        res.json({ message: 'User updated successfully.', ...(age !== null && { age }) });

    } catch (err) {
        if (transactionStarted)
            await req.dbConnection.query('ROLLBACK').catch(() => {});
        logger.error(`UPDATE_USER_FAILED: ${err.message} - Target: ${userId}`);
        res.status(400).json({ error: err.message });
    } finally {
        await releaseRowLock(req.dbConnection, 'User', userId);
        req.dbConnection.release();
    }
});

// ── DELETE USER ──────────────────────────────────────────
router.delete('/user/:id', lockRow('User', 'id'), async (req, res) => {
    const userId = req.params.id;
    const user   = req.lockedRow.data;
    let transactionStarted = false;

    try {
        const [victimOpen] = await req.dbConnection.query(`
            SELECT r.Request_id FROM Request_log r
            LEFT JOIN Incident i ON r.Request_id = i.Request_id
            WHERE r.Victim_id = ?
              AND (i.Status IS NULL OR i.Status IN ('Ongoing', 'Pending'))
            LIMIT 1
        `, [userId]);
        if (victimOpen.length) throw new Error('Cannot delete: Victim has open incidents. Resolve these cases first.');

        const [dispOpen] = await req.dbConnection.query(`
            SELECT r.Request_id FROM Request_log r
            LEFT JOIN Incident i ON r.Request_id = i.Request_id
            WHERE r.Dispatcher_id = ?
              AND (i.Status IS NULL OR i.Status IN ('Ongoing', 'Pending'))
            LIMIT 1
        `, [userId]);
        if (dispOpen.length) throw new Error('Cannot delete: Dispatcher has open incidents. Resolve or reassign first.');

        const [volActive] = await req.dbConnection.query(`
            SELECT va.Vol_assignment_id FROM Volunteer_assignment va
            JOIN Assignment a ON va.Assignment_id = a.Assignment_id
            WHERE va.Volunteer_id = ? AND a.Status IN ('Ongoing', 'Pending')
            LIMIT 1
        `, [userId]);
        if (volActive.length) throw new Error('Cannot delete: Volunteer has active assignments. Resolve or reassign first.');

        // CHANGED: Law_case has no Status — skip open law case check
        // (all law cases for this user are considered historical)

        // CHANGED: Follow_up_support has no Status — skip open follow-up check

        const [pendingRec] = await req.dbConnection.query(`
            SELECT Recovery_id FROM Password_Recovery
            WHERE User_email = ? AND Status = 'Pending' LIMIT 1
        `, [user.Email]);
        if (pendingRec.length) throw new Error('Cannot delete: User has pending password recovery requests.');

        const [adminCheck] = await req.dbConnection.query(
            'SELECT User_id FROM Admin WHERE User_id = ?', [userId]
        );
        if (adminCheck.length) {
            const [[{ count }]] = await req.dbConnection.query('SELECT COUNT(*) AS count FROM Admin');
            if (count <= 1) throw new Error('Cannot delete: This is the last admin. Create another admin first.');

            const [adminRecoveryRef] = await req.dbConnection.query(
                `SELECT Recovery_id FROM Password_Recovery WHERE Admin_id = ? LIMIT 1`,
                [userId]
            );
            if (adminRecoveryRef.length > 0)
                throw new Error(
                    'Cannot delete: This admin is referenced in password recovery records. ' +
                    'Reassign or resolve those records first.'
                );
        }

        await req.dbConnection.query('START TRANSACTION');
        transactionStarted = true;

        await req.dbConnection.query(`
            DELETE va FROM Volunteer_assignment va
            JOIN Assignment a ON va.Assignment_id = a.Assignment_id
            WHERE va.Volunteer_id = ? AND a.Status = 'Completed'
        `, [userId]);

        await req.dbConnection.query('DELETE FROM Victim     WHERE User_id = ?', [userId]);
        await req.dbConnection.query('DELETE FROM Volunteer  WHERE User_id = ?', [userId]);
        await req.dbConnection.query('DELETE FROM Dispatcher WHERE User_id = ?', [userId]);
        await req.dbConnection.query('DELETE FROM Admin      WHERE User_id = ?', [userId]);
        await req.dbConnection.query('DELETE FROM User       WHERE User_id = ?', [userId]);

        await req.dbConnection.query('COMMIT');
        transactionStarted = false;

        logger.info(`DELETE_USER_SUCCESS - User: ${userId}, Name: ${user.Name}, Admin: ${req.user.id}`);
        res.json({ message: 'User deleted successfully.' });

    } catch (err) {
        if (transactionStarted)
            await req.dbConnection.query('ROLLBACK').catch(() => {});
        logger.error(`DELETE_USER_FAILED: ${err.message} - Target: ${userId}`);
        res.status(400).json({ error: err.message });
    } finally {
        await releaseRowLock(req.dbConnection, 'User', userId);
        req.dbConnection.release();
    }
});

// ── GET ALL USERS ────────────────────────────────────────
router.get('/users', async (req, res) => {
    const free = await isNamedLockFree();
    if (!free) return res.status(423).json({ error: 'System is locked by an admin write operation.' });
    try {
        const [users] = await pool.query(`
            SELECT
                u.User_id, u.Name, u.Email, u.Phone_no AS Phone,
                u.Address, u.Date_of_Birth, u.CNIC,
                CASE
                    WHEN v.User_id   IS NOT NULL THEN 'Victim'
                    WHEN vol.User_id IS NOT NULL THEN 'Volunteer'
                    WHEN d.User_id   IS NOT NULL THEN 'Dispatcher'
                    WHEN a.User_id   IS NOT NULL THEN 'Admin'
                    ELSE 'Unknown'
                END AS Role,
                c.Location             AS Centre,
                vol.Centre_id          AS Volunteer_Centre_id,
                CASE
                    WHEN d.User_id   IS NOT NULL THEN d.Availability
                    WHEN vol.User_id IS NOT NULL THEN vol.Availability
                    ELSE NULL
                END AS Availability,
                CASE WHEN vol.User_id IS NOT NULL THEN vol.Status ELSE NULL END AS Status,
                v.Emergency_contact    AS Victim_Emergency_contact,
                vol.Emergency_contact  AS Volunteer_Emergency_contact
            FROM User u
            LEFT JOIN Victim     v   ON u.User_id = v.User_id
            LEFT JOIN Volunteer  vol ON u.User_id = vol.User_id
            LEFT JOIN Dispatcher d   ON u.User_id = d.User_id
            LEFT JOIN Admin      a   ON u.User_id = a.User_id
            LEFT JOIN Centre     c   ON COALESCE(d.Centre_id, vol.Centre_id) = c.Centre_id
            ORDER BY u.Name
        `);
        logger.info(`GET_ALL_USERS - Admin: ${req.user.id}, Count: ${users.length}`);
        res.json({ users });
    } catch (err) {
        logger.error(`GET_ALL_USERS_FAILED: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ── SEARCH USERS ─────────────────────────────────────────
router.get('/users/search', async (req, res) => {
    const free = await isNamedLockFree();
    if (!free) return res.status(423).json({ error: 'System is locked by an admin write operation.' });

    const { name, email, role, phone, from_date, to_date } = req.query;
    const validRoles = ['Admin', 'Victim', 'Dispatcher', 'Volunteer'];

    try {
        if (role && !validRoles.includes(role))
            return res.status(400).json({ error: 'Invalid role filter.' });

        let query = `
            SELECT
                u.User_id, u.Name, u.Email, u.Phone_no, u.Address, u.Date_of_Birth, u.CNIC,
                CASE
                    WHEN a.User_id   IS NOT NULL THEN 'Admin'
                    WHEN v.User_id   IS NOT NULL THEN 'Victim'
                    WHEN d.User_id   IS NOT NULL THEN 'Dispatcher'
                    WHEN vol.User_id IS NOT NULL THEN 'Volunteer'
                END AS Role,
                v.Emergency_contact    AS Victim_Emergency_contact,
                vol.Emergency_contact  AS Volunteer_Emergency_contact,
                d.Centre_id,
                vol.Centre_id          AS Volunteer_Centre_id,
                c.Location             AS Centre_Location,
                vol.Status             AS Volunteer_Status,
                vol.Availability       AS Volunteer_Availability,
                d.Availability         AS Dispatcher_Availability
            FROM User u
            LEFT JOIN Victim     v   ON u.User_id = v.User_id
            LEFT JOIN Dispatcher d   ON u.User_id = d.User_id
            LEFT JOIN Volunteer  vol ON u.User_id = vol.User_id
            LEFT JOIN Admin      a   ON u.User_id = a.User_id
            LEFT JOIN Centre     c   ON COALESCE(d.Centre_id, vol.Centre_id) = c.Centre_id
            WHERE 1=1
        `;
        const params = [];

        if (name)      { query += ' AND u.Name LIKE ?';      params.push(`%${name}%`); }
        if (email)     { query += ' AND u.Email LIKE ?';     params.push(`%${email}%`); }
        if (phone)     { query += ' AND u.Phone_no LIKE ?';  params.push(`%${phone}%`); }
        if (role === 'Admin')      query += ' AND a.User_id IS NOT NULL';
        if (role === 'Victim')     query += ' AND v.User_id IS NOT NULL';
        if (role === 'Dispatcher') query += ' AND d.User_id IS NOT NULL';
        if (role === 'Volunteer')  query += ' AND vol.User_id IS NOT NULL';
        if (from_date) { query += ' AND u.Date_of_Birth >= ?'; params.push(from_date); }
        if (to_date)   { query += ' AND u.Date_of_Birth <= ?'; params.push(to_date); }

        query += ' ORDER BY u.Name';
        const [rows] = await pool.query(query, params);
        logger.info(`SEARCH_USERS - Admin: ${req.user.id}, Results: ${rows.length}`);
        res.json(rows);
    } catch (err) {
        logger.error(`SEARCH_USERS_FAILED: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ======================================================
// 🔹 TABLE MANAGEMENT
// ======================================================

router.get('/tables', async (req, res) => {
    const free = await isNamedLockFree();
    if (!free) return res.status(423).json({ error: 'System is locked by an admin write operation.' });
    try {
        const [rows] = await pool.query(`
            SELECT TABLE_NAME, TABLE_ROWS,
                   DATA_LENGTH + INDEX_LENGTH AS SIZE_BYTES,
                   CREATE_TIME, UPDATE_TIME, TABLE_COMMENT
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
            ORDER BY TABLE_NAME
        `);
        for (const table of rows) {
            const [[{ count }]] = await pool.query(
                `SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
                [table.TABLE_NAME]
            );
            table.COLUMN_COUNT = count;
        }
        logger.info(`GET_TABLES - Admin: ${req.user.id}`);
        res.json(rows);
    } catch (err) {
        logger.error(`GET_TABLES_FAILED: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ======================================================
// 🔹 VIEW ALL TABLE DATA
// ======================================================

const allTables = [
    'Request_log', 'Incident', 'Assignment', 'Volunteer_assignment',
    'Law_case', 'Follow_up_support', 'Ambulance_service',
    'Police_services', 'Dispatcher', 'Victim', 'Admin', 'Centre', 'User',
    'Volunteer', 'Password_Recovery'
];

allTables.forEach(table => {
    router.get(`/${table.toLowerCase()}`, async (req, res) => {
        const free = await isNamedLockFree();
        if (!free) return res.status(423).json({ error: 'System is locked by an admin write operation.' });
        try {
            const [rows]    = await pool.query(`SELECT * FROM ${table}`);
            const [columns] = await pool.query(`SHOW COLUMNS FROM ${table}`);
            logger.info(`VIEW_TABLE - Admin: ${req.user.id}, Table: ${table}, Rows: ${rows.length}`);
            res.json({ table, columns: columns.map(c => c.Field), row_count: rows.length, data: rows });
        } catch (err) {
            logger.error(`VIEW_TABLE_FAILED: ${err.message} - Table: ${table}`);
            res.status(500).json({ error: err.message });
        }
    });

    router.get(`/${table.toLowerCase()}/:id`, async (req, res) => {
        const free = await isNamedLockFree();
        if (!free) return res.status(423).json({ error: 'System is locked by an admin write operation.' });

        const idField    = TABLE_ID_FIELDS[table];
        const connection = await pool.getConnection();

        try {
            await connection.query('START TRANSACTION');

            const [[{ locked_by }]] = await connection.query(
                `SELECT IS_USED_LOCK(?) AS locked_by`, [`${table}_${req.params.id}`]
            );

            const [rows] = await connection.query(
                `SELECT * FROM ${table} WHERE ${idField} = ? LOCK IN SHARE MODE`,
                [req.params.id]
            );

            if (!rows.length) {
                await connection.query('COMMIT');
                return res.status(404).json({ error: 'Record not found.' });
            }

            let lockerInfo = null;
            if (locked_by) {
                const [proc] = await connection.query(
                    `SELECT ID, USER, HOST FROM INFORMATION_SCHEMA.PROCESSLIST WHERE ID = ?`,
                    [locked_by]
                );
                lockerInfo = proc[0] || { id: locked_by };
            }

            await connection.query('COMMIT');
            logger.info(`VIEW_RECORD - Admin: ${req.user.id}, Table: ${table}, ID: ${req.params.id}`);

            res.json({
                ...rows[0],
                _lockInfo: locked_by
                    ? { locked: true, lockedBy: locked_by, lockerDetails: lockerInfo, message: 'This record is currently being edited.' }
                    : { locked: false }
            });
        } catch (err) {
            await connection.query('ROLLBACK').catch(() => {});
            logger.error(`VIEW_RECORD_FAILED: ${err.message}`);
            res.status(500).json({ error: err.message });
        } finally {
            connection.release();
        }
    });
});

// ======================================================
// 🔹 UPDATE / DELETE SELECTED TABLES
// ======================================================

const updatableTables = [
    'Request_log', 'Law_case', 'Follow_up_support', 'Centre',
    'Incident', 'Assignment', 'Ambulance_service', 'Police_services',
    'Dispatcher', 'Victim', 'User', 'Volunteer', 'Password_Recovery',
    'Volunteer_assignment'
];

updatableTables.forEach(table => {
    const idField = TABLE_ID_FIELDS[table];

    router.put(`/${table.toLowerCase()}/:id`, lockRow(table, 'id'), async (req, res) => {
        let transactionStarted = false;
        try {
            const [validColumns] = await req.dbConnection.query(`SHOW COLUMNS FROM ${table}`);
            const validColNames  = new Set(validColumns.map(c => c.Field));
            const safeKeys       = Object.keys(req.body).filter(k => validColNames.has(k));
            const safeValues     = safeKeys.map(k => req.body[k]);

            if (!safeKeys.length)
                return res.status(400).json({ error: 'No valid fields provided for update.' });

            const setClauses = safeKeys.map(k => `${k} = ?`).join(', ');
            safeValues.push(req.params.id);

            await req.dbConnection.query('START TRANSACTION');
            transactionStarted = true;

            const [result] = await req.dbConnection.query(
                `UPDATE ${table} SET ${setClauses} WHERE ${idField} = ?`, safeValues
            );

            if (!result.affectedRows) {
                await req.dbConnection.query('ROLLBACK');
                return res.status(404).json({ error: 'Record not found.' });
            }

            await req.dbConnection.query('COMMIT');
            logger.info(`UPDATE_RECORD - Admin: ${req.user.id}, Table: ${table}, ID: ${req.params.id}`);
            res.json({ message: `${table} updated successfully.`, affected_rows: result.affectedRows });

        } catch (err) {
            if (transactionStarted) await req.dbConnection.query('ROLLBACK').catch(() => {});
            logger.error(`UPDATE_RECORD_FAILED: ${err.message}`);
            res.status(500).json({ error: err.message });
        } finally {
            await releaseRowLock(req.dbConnection, table, req.params.id);
            req.dbConnection.release();
        }
    });

    router.delete(`/${table.toLowerCase()}/:id`, lockRow(table, 'id'), async (req, res) => {
        let transactionStarted = false;
        try {
            await req.dbConnection.query('START TRANSACTION');
            transactionStarted = true;

            const [result] = await req.dbConnection.query(
                `DELETE FROM ${table} WHERE ${idField} = ?`, [req.params.id]
            );

            if (!result.affectedRows) {
                await req.dbConnection.query('ROLLBACK');
                return res.status(404).json({ error: 'Record not found.' });
            }

            await req.dbConnection.query('COMMIT');
            logger.info(`DELETE_RECORD - Admin: ${req.user.id}, Table: ${table}, ID: ${req.params.id}`);
            res.json({ message: `Record deleted from '${table}' successfully.`, affected_rows: result.affectedRows });

        } catch (err) {
            if (transactionStarted) await req.dbConnection.query('ROLLBACK').catch(() => {});
            logger.error(`DELETE_RECORD_FAILED: ${err.message}`);
            res.status(500).json({ error: err.message });
        } finally {
            await releaseRowLock(req.dbConnection, table, req.params.id);
            req.dbConnection.release();
        }
    });
});

// ======================================================
// 🔹 DASHBOARD: PRIORITY LOCK (simple on/off for UI)
// ======================================================

router.post('/priority-lock', async (req, res) => {
    const { duration_minutes = 10 } = req.body;
    if (duration_minutes < 1 || duration_minutes > 60)
        return res.status(400).json({ error: 'duration_minutes must be between 1 and 60.' });

    if (adminActive && adminLockExpiry > Date.now() && activeAdminId !== req.user.id) {
        return res.status(409).json({
            error:    'System already locked by another admin.',
            lockedBy: activeAdminId,
            expiresIn: Math.floor((adminLockExpiry - Date.now()) / 1000) + ' seconds',
        });
    }

    adminActive     = true;
    adminLockExpiry = Date.now() + duration_minutes * 60 * 1000;
    activeAdminId   = req.user.id;
    logger.info(`ADMIN_PRIORITY_LOCK - Admin: ${req.user.id}, Duration: ${duration_minutes} min`);
    res.json({
        message:          `Priority lock activated for ${duration_minutes} minute(s).`,
        expires_at:       new Date(adminLockExpiry).toISOString(),
        duration_minutes,
    });
});

router.post('/priority-unlock', async (req, res) => {
    adminActive     = false;
    adminLockExpiry = null;
    activeAdminId   = null;
    logger.info(`ADMIN_PRIORITY_UNLOCK - Admin: ${req.user.id}`);
    res.json({ message: 'Priority lock released. Dispatchers can now write.' });
});

router.get('/priority-lock-status', async (req, res) => {
    const active = adminActive && adminLockExpiry > Date.now();
    res.json({
        active,
        expires_at:   active ? new Date(adminLockExpiry).toISOString() : null,
        remaining_ms: active ? adminLockExpiry - Date.now() : 0,
    });
});

// ======================================================
// 🔹 DASHBOARD: SYSTEM OVERVIEW
// ======================================================

router.get('/overview', async (req, res) => {
    try {
        const [[victims]]      = await pool.query(`SELECT COUNT(*) AS count FROM Victim`);
        const [[volunteers]]   = await pool.query(`SELECT COUNT(*) AS count FROM Volunteer`);
        const [[dispatchers]]  = await pool.query(`SELECT COUNT(*) AS count FROM Dispatcher`);
        const [[admins]]       = await pool.query(`SELECT COUNT(*) AS count FROM Admin`);
        const [[incidents]]    = await pool.query(`SELECT COUNT(*) AS count FROM Incident`);
        const [[activeInc]]    = await pool.query(`SELECT COUNT(*) AS count FROM Incident WHERE Status != 'Completed'`);
        const [[assignments]]  = await pool.query(`SELECT COUNT(*) AS count FROM Assignment`);
        const [[activeAssign]] = await pool.query(`SELECT COUNT(*) AS count FROM Assignment WHERE Status != 'Completed'`);
        const [[requests]]     = await pool.query(`SELECT COUNT(*) AS count FROM Request_log`);
        const [[pendingRec]]   = await pool.query(`SELECT COUNT(*) AS count FROM Password_Recovery WHERE Status = 'Pending'`);
        const [[lawCases]]     = await pool.query(`SELECT COUNT(*) AS count FROM Law_case`);
        const [[followups]]    = await pool.query(`SELECT COUNT(*) AS count FROM Follow_up_support`);

        const [dispAvail] = await pool.query(
            `SELECT Availability, COUNT(*) AS count FROM Dispatcher GROUP BY Availability`
        );
        const [volAvail] = await pool.query(
            `SELECT Availability, COUNT(*) AS count FROM Volunteer GROUP BY Availability`
        );
        const [incBySev] = await pool.query(
            `SELECT Severity, COUNT(*) AS count FROM Incident GROUP BY Severity`
        );

        logger.info(`ADMIN_OVERVIEW - Admin: ${req.user.id}`);
        res.json({
            counts: {
                victims:            victims.count,
                volunteers:         volunteers.count,
                dispatchers:        dispatchers.count,
                admins:             admins.count,
                requests:           requests.count,
                incidents:          incidents.count,
                active_incidents:   activeInc.count,
                assignments:        assignments.count,
                active_assignments: activeAssign.count,
                pending_recoveries: pendingRec.count,
                law_cases:          lawCases.count,
                follow_ups:         followups.count,
            },
            dispatcher_availability: dispAvail,
            volunteer_availability:  volAvail,
            incidents_by_severity:   incBySev,
            priority_lock_active:    adminActive && adminLockExpiry > Date.now(),
        });
    } catch (err) {
        logger.error(`ADMIN_OVERVIEW_FAILED: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ======================================================
// 🔹 DASHBOARD: PASSWORD RECOVERY MANAGEMENT
// ======================================================

router.get('/recoveries', async (req, res) => {
    try {
        const { status } = req.query;
        let query = `
            SELECT
                pr.Recovery_id,
                pr.User_email,
                pr.Admin_id,
                pr.Status,
                pr.Request_time,
                pr.Response_time,
                pr.Note,
                u.Name       AS user_name,
                u.Phone_no   AS user_phone,
                a.Name       AS admin_name
            FROM Password_Recovery pr
            LEFT JOIN User u ON pr.User_email = u.Email
            LEFT JOIN User a ON pr.Admin_id   = a.User_id
        `;
        const params = [];
        if (status) { query += ` WHERE pr.Status = ?`; params.push(status); }
        query += ` ORDER BY pr.Request_time DESC`;

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        logger.error(`ADMIN_GET_RECOVERIES_FAILED: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

router.get('/recoveries/mine', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                pr.Recovery_id,
                pr.User_email,
                pr.Status,
                pr.Request_time,
                pr.Response_time,
                pr.Note,
                u.Name     AS user_name,
                u.Phone_no AS user_phone
            FROM Password_Recovery pr
            LEFT JOIN User u ON pr.User_email = u.Email
            WHERE pr.Admin_id = ?
            ORDER BY pr.Request_time DESC
        `, [req.user.id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/recovery/:id/reset-password', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.query('START TRANSACTION');

        const [[rec]] = await conn.query(
            `SELECT * FROM Password_Recovery WHERE Recovery_id = ? FOR UPDATE`,
            [req.params.id]
        );
        if (!rec) {
            await conn.query('ROLLBACK');
            return res.status(404).json({ error: 'Recovery request not found.' });
        }
        if (rec.Status === 'Processed') {
            await conn.query('ROLLBACK');
            return res.status(400).json({ error: 'This request has already been processed.' });
        }
        if (rec.Admin_id !== req.user.id) {
            await conn.query('ROLLBACK');
            return res.status(403).json({ error: 'Only the assigned admin can reset this password.' });
        }

        const [[user]] = await conn.query(
            `SELECT User_id FROM User WHERE Email = ?`, [rec.User_email]
        );
        if (!user) {
            await conn.query('ROLLBACK');
            return res.status(404).json({ error: `No user found with email ${rec.User_email}.` });
        }

        const newPassword    = crypto.randomBytes(6).toString('hex');
        const hashedPassword = await hashPassword(newPassword);

        await conn.query(
            `UPDATE User SET Password = ? WHERE Email = ?`,
            [hashedPassword, rec.User_email]
        );
        await conn.query(
            `UPDATE Password_Recovery
             SET Status = 'Processed', Response_time = NOW()
             WHERE Recovery_id = ?`,
            [req.params.id]
        );

        await conn.query('COMMIT');
        logger.info(`ADMIN_PASSWORD_RESET - Recovery: ${req.params.id}, User: ${rec.User_email}, Admin: ${req.user.id}`);

        res.json({
            message:      'Password reset successfully. Share the new password with the user securely.',
            new_password: newPassword,
            user_email:   rec.User_email,
        });
    } catch (err) {
        await conn.query('ROLLBACK');
        logger.error(`ADMIN_PASSWORD_RESET_FAILED: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

router.delete('/recovery/:id', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.query('START TRANSACTION');

        const [[rec]] = await conn.query(
            `SELECT Recovery_id FROM Password_Recovery WHERE Recovery_id = ? FOR UPDATE`,
            [req.params.id]
        );
        if (!rec) {
            await conn.query('ROLLBACK');
            return res.status(404).json({ error: 'Recovery request not found.' });
        }

        await conn.query(
            `DELETE FROM Password_Recovery WHERE Recovery_id = ?`, [req.params.id]
        );
        await conn.query('COMMIT');

        logger.info(`ADMIN_RECOVERY_DELETED - Recovery: ${req.params.id}, Admin: ${req.user.id}`);
        res.json({ message: 'Recovery request deleted.' });
    } catch (err) {
        await conn.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ======================================================
// 🔹 DASHBOARD: DISPATCHER OVERSIGHT
// ======================================================

router.get('/dispatchers', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                d.User_id,
                u.Name,
                u.Email,
                u.Phone_no,
                d.Centre_id,
                d.Availability,
                c.Location  AS centre_location,
                COUNT(DISTINCT r.Request_id)  AS total_requests,
                COUNT(DISTINCT i.Incident_id) AS total_incidents,
                SUM(CASE WHEN i.Status != 'Completed' THEN 1 ELSE 0 END) AS active_incidents
            FROM Dispatcher d
            JOIN User u   ON d.User_id   = u.User_id
            JOIN Centre c ON d.Centre_id = c.Centre_id
            LEFT JOIN Request_log r ON d.User_id    = r.Dispatcher_id
            LEFT JOIN Incident i    ON r.Request_id = i.Request_id
            GROUP BY d.User_id, u.Name, u.Email, u.Phone_no,
                     d.Centre_id, d.Availability, c.Location
            ORDER BY d.Availability DESC, u.Name ASC
        `);
        res.json(rows);
    } catch (err) {
        logger.error(`ADMIN_GET_DISPATCHERS_FAILED: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

router.put('/dispatcher/:id/availability', async (req, res) => {
    const { availability } = req.body;
    if (!['Yes', 'No'].includes(availability))
        return res.status(400).json({ error: "availability must be 'Yes' or 'No'" });

    if (availability === 'No') {
        const [activeIncidents] = await pool.query(`
            SELECT i.Incident_id FROM Incident i
            JOIN Request_log r ON i.Request_id = r.Request_id
            WHERE r.Dispatcher_id = ? AND i.Status != 'Completed'
        `, [req.params.id]);

        const [activeAssignments] = await pool.query(`
            SELECT a.Assignment_id FROM Assignment a
            JOIN Incident i    ON a.Incident_id = i.Incident_id
            JOIN Request_log r ON i.Request_id  = r.Request_id
            WHERE r.Dispatcher_id = ? AND a.Status != 'Completed'
        `, [req.params.id]);

        const blocks = [];
        if (activeIncidents.length > 0)
            blocks.push(`${activeIncidents.length} active incident(s)`);
        if (activeAssignments.length > 0)
            blocks.push(`${activeAssignments.length} active assignment(s)`);

        if (blocks.length > 0) {
            return res.status(400).json({
                error: `Cannot set offline: dispatcher has ${blocks.join(' and ')}. Reassign all active cases first.`,
                active_incidents:   activeIncidents.map(i => i.Incident_id),
                active_assignments: activeAssignments.map(a => a.Assignment_id),
            });
        }
    }

    try {
        const [result] = await pool.query(
            `UPDATE Dispatcher SET Availability = ? WHERE User_id = ?`,
            [availability, req.params.id]
        );
        if (!result.affectedRows)
            return res.status(404).json({ error: 'Dispatcher not found.' });
        logger.info(`ADMIN_SET_DISPATCHER_AVAIL - ${req.params.id} → ${availability}, Admin: ${req.user.id}`);
        res.json({ message: `Dispatcher availability set to ${availability}.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======================================================
// 🔹 DASHBOARD: VOLUNTEER OVERSIGHT (all centres)
// ======================================================

router.get('/volunteers', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                v.User_id,
                u.Name,
                u.Email,
                u.Phone_no,
                v.Centre_id,
                v.Availability,
                v.Status,
                c.Location  AS centre_location,
                COUNT(DISTINCT va.Assignment_id) AS total_assignments
            FROM Volunteer v
            JOIN User u   ON v.User_id   = u.User_id
            JOIN Centre c ON v.Centre_id = c.Centre_id
            LEFT JOIN Volunteer_assignment va ON v.User_id = va.Volunteer_id
            GROUP BY v.User_id, u.Name, u.Email, u.Phone_no,
                     v.Centre_id, v.Availability, v.Status, c.Location
            ORDER BY v.Centre_id ASC, v.Availability DESC, u.Name ASC
        `);
        res.json(rows);
    } catch (err) {
        logger.error(`ADMIN_GET_VOLUNTEERS_FAILED: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ======================================================
// 🔹 DASHBOARD: VICTIM OVERSIGHT
// ======================================================

router.get('/victims', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                v.User_id,
                u.Name,
                u.Email,
                u.Phone_no,
                u.Address,
                u.CNIC,
                v.Emergency_contact,
                COUNT(DISTINCT r.Request_id)  AS total_requests,
                COUNT(DISTINCT i.Incident_id) AS total_incidents,
                SUM(CASE WHEN i.Status != 'Completed' THEN 1 ELSE 0 END) AS active_incidents
            FROM Victim v
            JOIN User u ON v.User_id = u.User_id
            LEFT JOIN Request_log r ON v.User_id    = r.Victim_id
            LEFT JOIN Incident i    ON r.Request_id = i.Request_id
            GROUP BY v.User_id, u.Name, u.Email, u.Phone_no,
                     u.Address, u.CNIC, v.Emergency_contact
            ORDER BY active_incidents DESC, u.Name ASC
        `);
        res.json(rows);
    } catch (err) {
        logger.error(`ADMIN_GET_VICTIMS_FAILED: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ======================================================
// 🔹 DASHBOARD: INCIDENT OVERSIGHT (all dispatchers)
// ======================================================

router.get('/incidents', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                i.Incident_id,
                i.Emergency_type,
                i.Severity,
                i.Status           AS incident_status,
                i.Verification_status,
                i.Location         AS incident_location,
                i.Time             AS incident_time,
                r.Dispatcher_id,
                d_u.Name           AS dispatcher_name,
                r.Victim_id,
                v_u.Name           AS victim_name,
                v_u.Phone_no       AS victim_phone,
                a.Assignment_id,
                a.Status           AS assignment_status,
                c.Location         AS centre_location
            FROM Incident i
            JOIN Request_log r ON i.Request_id    = r.Request_id
            JOIN User v_u      ON r.Victim_id     = v_u.User_id
            JOIN User d_u      ON r.Dispatcher_id = d_u.User_id
            JOIN Dispatcher d  ON r.Dispatcher_id = d.User_id
            JOIN Centre c      ON d.Centre_id     = c.Centre_id
            LEFT JOIN Assignment a ON i.Incident_id = a.Incident_id
            ORDER BY
                CASE i.Status WHEN 'Ongoing' THEN 0 WHEN 'Pending' THEN 1 ELSE 2 END,
                i.Time DESC
        `);
        res.json(rows);
    } catch (err) {
        logger.error(`ADMIN_GET_INCIDENTS_FAILED: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

router.put('/incident/:id/reassign', async (req, res) => {
    const { dispatcher_id } = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.query('START TRANSACTION');

        if (!dispatcher_id) throw new Error('dispatcher_id is required.');

        const [[disp]] = await connection.query(
            `SELECT User_id FROM Dispatcher WHERE User_id = ?`, [dispatcher_id]
        );
        if (!disp) throw new Error('Dispatcher not found.');

        const [[inc]] = await connection.query(`
            SELECT i.Incident_id, r.Request_id
            FROM Incident i
            JOIN Request_log r ON i.Request_id = r.Request_id
            WHERE i.Incident_id = ?
        `, [req.params.id]);
        if (!inc) throw new Error('Incident not found.');

        await connection.query(
            `UPDATE Request_log SET Dispatcher_id = ? WHERE Request_id = ?`,
            [dispatcher_id, inc.Request_id]
        );
        await connection.query('COMMIT');

        logger.info(`ADMIN_REASSIGN - Incident: ${req.params.id} → Dispatcher: ${dispatcher_id}, Admin: ${req.user.id}`);
        res.json({ message: `Incident reassigned to dispatcher ${dispatcher_id}.` });
    } catch (err) {
        await connection.query('ROLLBACK');
        res.status(400).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// ======================================================
// 🔹 DASHBOARD: LAW FIRMS
// ======================================================

const HARDCODED_LAW_FIRMS = [
    'Chaudhry Law Associates', 'Hassan & Associates', 'Rizvi Legal Services',
    'Sheikh Law Firm', 'Barrister Nawaz & Co', 'Malik Legal Aid',
    'Ali & Partners', 'Qureshi Legal Group', 'Siddiqui Law Chamber',
    'Farooqi & Associates', 'Legal Aid Department',
];

router.get('/lawfirms', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT DISTINCT Lawfirm_name FROM Law_case ORDER BY Lawfirm_name ASC`
        );
        const dbFirms = rows.map(r => r.Lawfirm_name).filter(Boolean);
        const merged  = [...new Set([...HARDCODED_LAW_FIRMS, ...dbFirms])].sort();
        res.json(merged);
    } catch (err) {
        logger.error(`ADMIN_GET_LAWFIRMS_FAILED: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ======================================================
// 🔹 DASHBOARD: REFERRED CENTRES
// ======================================================

const HARDCODED_REFERRED_CENTRES = [
    'Gulberg Women Shelter Home', 'Gulberg Counselling Centre',
    'Model Town Crisis Support Centre', 'Model Town Women Legal Aid',
    'Johar Town Safe House', 'Johar Town Trauma Centre',
    'Bahria Town Women Bureau', 'Bahria Town Crisis Centre',
    'Wapda Town Safe House', 'Wapda Town Rehabilitation Centre',
    'Welfare Crisis Support Centre',
];

router.get('/referred-centres', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT DISTINCT Referred_centre FROM Follow_up_support ORDER BY Referred_centre ASC`
        );
        const dbCentres = rows.map(r => r.Referred_centre).filter(Boolean);
        const merged    = [...new Set([...HARDCODED_REFERRED_CENTRES, ...dbCentres])].sort();
        res.json(merged);
    } catch (err) {
        logger.error(`ADMIN_GET_REFERRED_CENTRES_FAILED: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ── EXPORTS ──────────────────────────────────────────────
module.exports = router;
module.exports.getAdminLockState = getAdminLockState;