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
// Admin always gets priority over dispatcher locks.
// When an admin tries to lock a row held by a dispatcher,
// the dispatcher's lock is force-released and the admin
// takes it over immediately.
// ======================================================

async function acquireRowLock(connection, table, idValue) {
    const lockKey = `${table}_${idValue}`;

    const [[{ locked_by }]] = await connection.query(
        `SELECT IS_USED_LOCK(?) AS locked_by`, [lockKey]
    );

    if (locked_by && locked_by !== connection.threadId) {
        // Admin always overrides — force-release the existing lock
        // (dispatcher or otherwise) and take it over
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

// FIX 2: lockRow now calls acquireRowLock(connection, table, idValue)
//         with the correct 3-argument signature matching dispatcher.js
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

const getAdminLockState = () => ({ adminActive, adminLockExpiry, activeAdminId });

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
        // Phone validation
        if (phone_no && phone_no !== user.Phone_no) {
            if (!/^\d{10,11}$/.test(phone_no)) throw new Error('Phone number must be 10-11 digits.');
            const [ep] = await req.dbConnection.query(
                'SELECT User_id FROM User WHERE Phone_no = ? AND User_id != ?', [phone_no, userId]
            );
            if (ep.length) throw new Error('This phone number is already registered to another user.');
        }

        // Email validation
        if (email && email !== user.Email) {
            if (!/\S+@\S+\.\S+/.test(email)) throw new Error('Invalid email format.');
            const [ee] = await req.dbConnection.query(
                'SELECT User_id FROM User WHERE Email = ? AND User_id != ?', [email, userId]
            );
            if (ee.length) throw new Error('This email is already registered to another user.');
        }

        // CNIC validation
        if (cnic && cnic !== user.CNIC) {
            validateCNIC(cnic);
            const [ec] = await req.dbConnection.query(
                'SELECT User_id FROM User WHERE CNIC = ? AND User_id != ?', [cnic, userId]
            );
            if (ec.length) throw new Error('This CNIC is already registered to another user.');
        }

        // DOB validation
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

        // Detect current roles
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

        // Role CHANGE validation
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

        // Same-role field validation
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

        // ── Transaction ───────────────────────────────────────────────
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

        // Role CHANGE writes — preserve Victim row if dual-role
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
            // FIX 3: Volunteer INSERT now includes Centre_id (NOT NULL in schema)
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

        // Same-role field updates
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
            // FIX 4: Volunteer centre_id update was missing — now handled
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
        // Victim: open requests/incidents
        const [victimOpen] = await req.dbConnection.query(`
            SELECT r.Request_id FROM Request_log r
            LEFT JOIN Incident i ON r.Request_id = i.Request_id
            WHERE r.Victim_id = ?
              AND (i.Status IS NULL OR i.Status IN ('Ongoing', 'Pending'))
            LIMIT 1
        `, [userId]);
        if (victimOpen.length) throw new Error('Cannot delete: Victim has open incidents. Resolve these cases first.');

        // Dispatcher: open incidents
        const [dispOpen] = await req.dbConnection.query(`
            SELECT r.Request_id FROM Request_log r
            LEFT JOIN Incident i ON r.Request_id = i.Request_id
            WHERE r.Dispatcher_id = ?
              AND (i.Status IS NULL OR i.Status IN ('Ongoing', 'Pending'))
            LIMIT 1
        `, [userId]);
        if (dispOpen.length) throw new Error('Cannot delete: Dispatcher has open incidents. Resolve or reassign first.');

        // Volunteer: active assignments
        const [volActive] = await req.dbConnection.query(`
            SELECT va.Vol_assignment_id FROM Volunteer_assignment va
            JOIN Assignment a ON va.Assignment_id = a.Assignment_id
            WHERE va.Volunteer_id = ? AND a.Status IN ('Ongoing', 'Pending')
            LIMIT 1
        `, [userId]);
        if (volActive.length) throw new Error('Cannot delete: Volunteer has active assignments. Resolve or reassign first.');

        // Open law cases
        const [openLaw] = await req.dbConnection.query(`
            SELECT lc.Law_case_id FROM Law_case lc
            JOIN Incident i    ON lc.Incident_id = i.Incident_id
            JOIN Request_log r ON i.Request_id   = r.Request_id
            WHERE (r.Victim_id = ? OR r.Dispatcher_id = ?)
              AND lc.Status IN ('Ongoing', 'Pending')
            LIMIT 1
        `, [userId, userId]);
        if (openLaw.length) throw new Error('Cannot delete: User has ongoing law cases. Resolve first.');

        // Open follow-ups
        const [openFollowup] = await req.dbConnection.query(`
            SELECT fs.follow_up_id FROM Follow_up_support fs
            JOIN Assignment a  ON fs.Assignment_id = a.Assignment_id
            JOIN Incident i    ON a.Incident_id    = i.Incident_id
            JOIN Request_log r ON i.Request_id     = r.Request_id
            WHERE (r.Victim_id = ? OR r.Dispatcher_id = ?)
              AND fs.Status IN ('Ongoing', 'Pending')
            LIMIT 1
        `, [userId, userId]);
        if (openFollowup.length) throw new Error('Cannot delete: User has ongoing follow-up support. Resolve first.');

        // Pending password recovery
        const [pendingRec] = await req.dbConnection.query(`
            SELECT Recovery_id FROM Password_Recovery
            WHERE User_email = ? AND Status = 'Pending' LIMIT 1
        `, [user.Email]);
        if (pendingRec.length) throw new Error('Cannot delete: User has pending password recovery requests.');

        // Last admin check
        const [adminCheck] = await req.dbConnection.query(
            'SELECT User_id FROM Admin WHERE User_id = ?', [userId]
        );
        if (adminCheck.length) {
            const [[{ count }]] = await req.dbConnection.query('SELECT COUNT(*) AS count FROM Admin');
            if (count <= 1) throw new Error('Cannot delete: This is the last admin. Create another admin first.');

            // Check if this admin is referenced in Password_Recovery as Admin_id
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

        // Clean up completed volunteer assignments
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
// FIX 5: Removed lockReadShared (caused LOCK TABLES + START TRANSACTION conflict)
//         and removed unlockRead from finally. Uses pool.query directly.
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
    'Incident', 'Assignment', 'Ambulance_service', 'Police_services'
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

// ── EXPORTS ──────────────────────────────────────────────
// Must attach getAdminLockState AFTER module.exports = router
// otherwise `module.exports = router` overwrites it
module.exports = router;
module.exports.getAdminLockState = getAdminLockState;