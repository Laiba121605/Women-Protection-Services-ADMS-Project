// routes/dispatcher.js
const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const { verifyJWT, allowRoles, hashPassword } = require('../auth');
const crypto  = require('crypto');
const logger  = require('../utils/logger');

// Import admin lock state so dispatcher routes respect admin priority
// and so admin can check/override dispatcher row locks
const { getAdminLockState } = require('./admin');

// ======================================================
// 🔐 Protect all dispatcher routes
// FIX 1: Removed non-existent 'EmergencySupervisor' role
// ======================================================
router.use(verifyJWT, allowRoles('Dispatcher', 'Admin'));

// ======================================================
// 🔹 CONSTANTS
// ======================================================

const VALID_EMERGENCY_TYPES = [
    'Domestic Violence', 'Sexual Assault', 'Harassment',
    'Kidnapping', 'Stalking', 'Medical Emergency'
];
const VALID_SEVERITY            = ['High', 'Medium', 'Low'];
const VALID_STATUS              = ['Completed', 'Ongoing', 'Pending'];
const VALID_CASE_TYPES          = ['Support', 'Penalty'];
const VALID_REQUEST_TYPES       = ['False', 'Emergency', 'Query'];
const VALID_VERIFICATION_STATUS = ['False', 'True'];
const LOCK_TIMEOUT              = 5; // seconds

// ======================================================
// 🔹 TABLE ID FIELDS
// ======================================================

const TABLE_ID_FIELDS = {
    Victim:               'User_id',
    User:                 'User_id',
    Request_log:          'Request_id',
    Incident:             'Incident_id',
    Assignment:           'Assignment_id',
    Volunteer_assignment: 'Vol_assignment_id',
    Law_case:             'Law_case_id',
    Follow_up_support:    'follow_up_id',
    Volunteer:            'User_id',
    Dispatcher:           'User_id',
    Police_services:      'Centre_id',
    Ambulance_service:    'Ambulance_id',
    Centre:               'Centre_id'
};

// ======================================================
// 🔹 ROW-LEVEL LOCKING HELPERS
// ======================================================
// 🔹 ROW-LEVEL LOCKING HELPERS (with admin priority)
// ======================================================

// Check if the current request is from an admin
const requestIsAdmin = (req) =>
    req.user && req.user.roles && req.user.roles.includes('Admin');

// Check if the admin priority lock is currently active
const adminPriorityActive = () => {
    const { adminActive, adminLockExpiry } = getAdminLockState();
    return adminActive && adminLockExpiry > Date.now();
};

/**
 * acquireRowLock
 * --------------
 * Acquires a MySQL named advisory lock for a specific row.
 *
 * Admin priority behaviour:
 *   - If the admin priority lock is active AND the caller is an Admin,
 *     force-release any existing row lock and take it over immediately.
 *   - If the admin priority lock is active AND the caller is a Dispatcher,
 *     block them — admin has the system reserved for maintenance.
 *   - Otherwise: if the row is locked by a different connection, block.
 */
async function acquireRowLock(connection, table, idValue, req = null) {
    const lockKey   = `${table}_${idValue}`;
    const callerIsAdmin = req ? requestIsAdmin(req) : false;

    // ── Admin priority check ─────────────────────────────────────
    if (adminPriorityActive()) {
        if (!callerIsAdmin) {
            // Dispatcher blocked — admin has the system reserved
            throw new Error(
                'System is currently reserved by an admin. ' +
                'Your write operation is blocked until the admin releases priority.'
            );
        }
        // Admin is active and caller is admin — force-release any existing
        // row lock so the admin can take over immediately
        await connection.query(`SELECT RELEASE_LOCK(?)`, [lockKey]);
        logger.info(`ADMIN_PRIORITY_OVERRIDE - Admin: ${req.user.id} force-took lock ${lockKey}`);
    } else {
        // Normal path — check if row is held by another connection
        const [[{ locked_by }]] = await connection.query(
            `SELECT IS_USED_LOCK(?) AS locked_by`, [lockKey]
        );

        if (locked_by && locked_by !== connection.threadId) {
            // Admin can still override even without priority lock being active
            if (callerIsAdmin) {
                await connection.query(`SELECT RELEASE_LOCK(?)`, [lockKey]);
                logger.info(`ADMIN_ROW_OVERRIDE - Admin: ${req.user.id} overrode lock ${lockKey} held by connection ${locked_by}`);
            } else {
                throw new Error(
                    `Record is currently being edited by another dispatcher. ` +
                    `Please try again shortly.`
                );
            }
        }
    }

    // Acquire the lock
    const [[{ acquired }]] = await connection.query(
        `SELECT GET_LOCK(?, ?) AS acquired`, [lockKey, LOCK_TIMEOUT]
    );

    if (!acquired) {
        throw new Error(`Could not acquire lock on this record. Please try again.`);
    }
}

async function releaseRowLock(connection, table, idValue) {
    await connection.query(`SELECT RELEASE_LOCK(?)`, [`${table}_${idValue}`]);
}

// Middleware: lock a row identified by req.params[idParam]
// Passes req into acquireRowLock so admin priority is respected
const lockRow = (table, idParam = 'id') => {
    return async (req, res, next) => {
        const idValue = req.params[idParam];
        const idField = TABLE_ID_FIELDS[table];

        if (!idField) {
            return res.status(500).json({ error: `No ID field configured for table '${table}'.` });
        }

        const connection = await pool.getConnection();

        try {
            const [rows] = await connection.query(
                `SELECT * FROM ${table} WHERE ${idField} = ?`, [idValue]
            );

            if (!rows.length) {
                connection.release();
                return res.status(404).json({ error: 'Record not found.' });
            }

            // Pass req so admin priority is checked inside acquireRowLock
            await acquireRowLock(connection, table, idValue, req);

            req.dbConnection = connection;
            req.lockedRow    = { table, idField, idValue, data: rows[0] };
            next();
        } catch (err) {
            connection.release();
            const status = err.message.includes('locked') ||
                           err.message.includes('reserved') ||
                           err.message.includes('blocked')
                ? 423 : 500;
            return res.status(status).json({ error: err.message });
        }
    };
};

// ======================================================
// 🔹 HELPER FUNCTIONS
// ======================================================

const generateUniqueId = async (table, column) => {
    let id;
    let exists = true;
    while (exists) {
        id = crypto.randomBytes(10).toString('hex');
        const [rows] = await pool.query(
            `SELECT 1 FROM ${table} WHERE ${column} = ?`, [id]
        );
        exists = rows.length > 0;
    }
    return id;
};

// FIX 12: Returns warning flag instead of blocking entirely.
// Dispatchers CAN handle multiple calls — the DB trigger sets Availability='No'
// but the schema does not prevent new Request_log inserts.
const checkDispatcherLoad = async (dispatcherId, connection) => {
    const [activeRequests] = await connection.query(`
        SELECT COUNT(*) AS count
        FROM Request_log r
        JOIN Incident i ON r.Request_id = i.Request_id
        WHERE r.Dispatcher_id = ?
          AND i.Status IN ('Ongoing', 'Pending')
    `, [dispatcherId]);

    return {
        hasActiveIncidents: activeRequests[0].count > 0,
        activeCount:        activeRequests[0].count
    };
};

// Get the Centre_id for the current dispatcher
const getDispatcherCentre = async (dispatcherId) => {
    const [[disp]] = await pool.query(
        'SELECT Centre_id FROM Dispatcher WHERE User_id = ?', [dispatcherId]
    );
    return disp?.Centre_id || null;
};

// FIX 5: getAvailableVolunteers now filters by dispatcher's own centre
// Dispatchers may only see and assign volunteers from their centre
const getAvailableVolunteers = async (dispatcherId, severity = null) => {
    const centreId = await getDispatcherCentre(dispatcherId);
    if (!centreId) throw new Error('Dispatcher centre not found.');

    let query = `
        SELECT
            v.User_id,
            u.Name,
            u.Phone_no,
            v.Status,
            v.Availability,
            v.Emergency_contact,
            v.Centre_id,
            c.Location AS Centre_Location
        FROM Volunteer v
        JOIN User u   ON v.User_id   = u.User_id
        JOIN Centre c ON v.Centre_id = c.Centre_id
        WHERE v.Availability = 'Yes'
          AND v.Centre_id = ?
    `;
    const params = [centreId];
    if (severity === 'High') query += ` ORDER BY v.Status DESC`;
    const [volunteers] = await pool.query(query, params);
    return volunteers;
};

const getAvailableResources = async () => {
    const [police] = await pool.query(`
        SELECT Centre_id, Location, Centre_number
        FROM Police_services
        WHERE Status = 'Pending'
    `);
    const [ambulance] = await pool.query(`
        SELECT Ambulance_id, Relevant_hospital, Location, Contact_info
        FROM Ambulance_service
        WHERE Status = 'Pending'
    `);
    return { police, ambulance };
};

const createAssignment = async (connection, incidentId, policeId = null, ambulanceId = null) => {
    const assignmentId = await generateUniqueId('Assignment', 'Assignment_id');

    await connection.query(`
        INSERT INTO Assignment (Assignment_id, Incident_id, Police_id, Ambulance_id, Status)
        VALUES (?, ?, ?, ?, 'Ongoing')
    `, [assignmentId, incidentId, policeId, ambulanceId]);

    if (policeId) {
        await connection.query(
            `UPDATE Police_services SET Status = 'Ongoing' WHERE Centre_id = ?`, [policeId]
        );
    }
    if (ambulanceId) {
        await connection.query(
            `UPDATE Ambulance_service SET Status = 'Ongoing' WHERE Ambulance_id = ?`, [ambulanceId]
        );
    }
    return assignmentId;
};

/**
 * assignVolunteers
 * ----------------
 * Assigns volunteers to an assignment atomically.
 *
 * For each volunteer:
 *   1. Verifies volunteer belongs to this dispatcher's centre.
 *   2. Acquires a row-level named lock on the Volunteer row so no other
 *      dispatcher can simultaneously assign the same volunteer.
 *   3. Re-checks availability inside the lock (double-check pattern).
 *   4. Inserts Volunteer_assignment (DB trigger also checks availability).
 *   5. Sets Availability = 'No' and Status = 'Ongoing'.
 *   6. Releases the row lock.
 */
const assignVolunteers = async (connection, assignmentId, volunteerIds, dispatcherId) => {
    const assigned = [];

    // Get this dispatcher's centre once for all volunteers
    const [[disp]] = await connection.query(
        'SELECT Centre_id FROM Dispatcher WHERE User_id = ?', [dispatcherId]
    );
    const dispatcherCentreId = disp?.Centre_id;
    if (!dispatcherCentreId) throw new Error('Dispatcher centre not found.');

    for (const volunteerId of volunteerIds) {
        // FIX 6: Centre ownership check — dispatcher can only assign volunteers
        // from their own centre
        const [centreCheck] = await connection.query(
            'SELECT User_id FROM Volunteer WHERE User_id = ? AND Centre_id = ?',
            [volunteerId, dispatcherCentreId]
        );
        if (!centreCheck.length) {
            throw new Error(
                `Volunteer ${volunteerId} does not belong to your centre (${dispatcherCentreId}). ` +
                `You can only assign volunteers from your own centre.`
            );
        }

        const lockKey = `Volunteer_${volunteerId}`;

        // Acquire row lock on this specific volunteer
        const [[{ locked_by }]] = await connection.query(
            `SELECT IS_USED_LOCK(?) AS locked_by`, [lockKey]
        );

        if (locked_by && locked_by !== connection.threadId) {
            throw new Error(
                `Volunteer ${volunteerId} is currently being assigned by another dispatcher. ` +
                `Please try again shortly.`
            );
        }

        const [[{ acquired }]] = await connection.query(
            `SELECT GET_LOCK(?, ?) AS acquired`, [lockKey, LOCK_TIMEOUT]
        );

        if (!acquired) {
            throw new Error(
                `Could not lock Volunteer ${volunteerId} for assignment. Please try again.`
            );
        }

        try {
            // Double-check availability now that we hold the lock
            const [vol] = await connection.query(
                `SELECT User_id, Availability FROM Volunteer WHERE User_id = ? FOR UPDATE`,
                [volunteerId]
            );

            if (!vol.length) {
                throw new Error(`Volunteer ${volunteerId} not found.`);
            }

            if (vol[0].Availability !== 'Yes') {
                throw new Error(
                    `Volunteer ${volunteerId} is no longer available ` +
                    `(availability changed before lock was acquired).`
                );
            }

            const volAssignmentId = await generateUniqueId('Volunteer_assignment', 'Vol_assignment_id');

            // DB trigger check_volunteer_availability_before_insert also fires here
            await connection.query(
                `INSERT INTO Volunteer_assignment (Vol_assignment_id, Volunteer_id, Assignment_id)
                 VALUES (?, ?, ?)`,
                [volAssignmentId, volunteerId, assignmentId]
            );

            // Mark volunteer unavailable immediately
            await connection.query(
                `UPDATE Volunteer SET Status = 'Ongoing', Availability = 'No' WHERE User_id = ?`,
                [volunteerId]
            );

            assigned.push(volunteerId);
            logger.info(`VOLUNTEER_LOCKED_AND_ASSIGNED - Volunteer: ${volunteerId}, Assignment: ${assignmentId}`);
        } finally {
            // Always release the volunteer row lock
            await connection.query(`SELECT RELEASE_LOCK(?)`, [lockKey]);
        }
    }

    return assigned;
};

// ======================================================
// 🔹 DISPATCHER WORKLOAD & STATUS
// ======================================================

router.get('/workload', async (req, res) => {
    try {
        const [workload] = await pool.query(`
            SELECT
                COUNT(DISTINCT r.Request_id)  AS active_requests,
                COUNT(DISTINCT i.Incident_id) AS active_incidents,
                GROUP_CONCAT(DISTINCT i.Incident_id) AS incident_ids,
                MIN(r.Request_time)           AS oldest_request,
                d.Availability                AS current_availability
            FROM Dispatcher d
            LEFT JOIN Request_log r ON d.User_id = r.Dispatcher_id
            LEFT JOIN Incident i
                   ON r.Request_id = i.Request_id
                  AND i.Status IN ('Ongoing', 'Pending')
            WHERE d.User_id = ?
            GROUP BY d.Availability
        `, [req.user.id]);

        const [history] = await pool.query(`
            SELECT
                COUNT(*)                                                  AS total_handled,
                AVG(TIMESTAMPDIFF(MINUTE, r.Request_time, i.Time))        AS avg_response_time,
                COUNT(DISTINCT i.Incident_id)                             AS total_incidents,
                COUNT(DISTINCT a.Assignment_id)                           AS total_assignments
            FROM Request_log r
            LEFT JOIN Incident   i ON r.Request_id  = i.Request_id
            LEFT JOIN Assignment a ON i.Incident_id = a.Incident_id
            WHERE r.Dispatcher_id = ?
        `, [req.user.id]);

        logger.info(`DISPATCHER_WORKLOAD - User: ${req.user.id}`);
        res.json({
            current_workload: {
                active_requests:  workload[0]?.active_requests  || 0,
                active_incidents: workload[0]?.active_incidents || 0,
                incident_ids:     workload[0]?.incident_ids     || null,
                oldest_request:   workload[0]?.oldest_request   || null
            },
            history:       history[0] || { total_handled: 0, avg_response_time: null },
            availability:  workload[0]?.current_availability || 'Yes',
            dispatcher_id: req.user.id
        });
    } catch (err) {
        logger.error(`WORKLOAD_CHECK_FAILED: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

router.put('/availability', async (req, res) => {
    const { availability } = req.body;
    if (!['Yes', 'No'].includes(availability)) {
        return res.status(400).json({ error: "Availability must be 'Yes' or 'No'" });
    }
    const connection = await pool.getConnection();
    try {
        await connection.query(
            'UPDATE Dispatcher SET Availability = ? WHERE User_id = ?',
            [availability, req.user.id]
        );
        logger.info(`DISPATCHER_AVAILABILITY - User: ${req.user.id} set to ${availability}`);
        res.json({ message: `Availability set to ${availability} successfully`, availability });
    } catch (err) {
        logger.error(`AVAILABILITY_UPDATE_FAILED: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// ======================================================
// 🔹 VICTIM MANAGEMENT
// ======================================================

// FIX 13: Search for existing victim by phone before creating a new one
router.get('/victim/search', async (req, res) => {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ error: 'Phone number is required.' });

    try {
        const [rows] = await pool.query(`
            SELECT
                u.User_id, u.Name, u.Phone_no, u.Email, u.Address, u.CNIC,
                v.Emergency_contact,
                CASE WHEN v.User_id IS NOT NULL THEN 1 ELSE 0 END AS is_victim
            FROM User u
            LEFT JOIN Victim v ON u.User_id = v.User_id
            WHERE u.Phone_no = ?
        `, [phone]);

        if (!rows.length) {
            return res.json({
                found:   false,
                message: 'No user found. Use POST /victim to create a new victim.'
            });
        }
        res.json({ found: true, user: rows[0] });
    } catch (err) {
        logger.error(`VICTIM_SEARCH_FAILED: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// Get single victim by ID
// Any dispatcher can view any victim — victim records are shared resources.
// Dispatcher-scoped ownership applies to Request_log, Incident, Assignment etc., not to victims.
router.get('/victim/:id', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                u.User_id, u.Name, u.Phone_no, u.Email,
                u.Address, u.Date_of_Birth, u.CNIC,
                v.Emergency_contact,
                COUNT(DISTINCT r.Request_id) AS total_requests,
                SUM(CASE WHEN i.Status IN ('Ongoing','Pending') THEN 1 ELSE 0 END) AS open_incidents
            FROM Victim v
            JOIN User u ON v.User_id = u.User_id
            LEFT JOIN Request_log r ON v.User_id = r.Victim_id
            LEFT JOIN Incident i    ON r.Request_id = i.Request_id
            WHERE v.User_id = ?
            GROUP BY u.User_id
        `, [req.params.id]);

        if (!rows.length) return res.status(404).json({ error: 'Victim not found.' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create victim — emergency (minimal) or full record
// FIX 2/3/4: Unique placeholder DOB, Email, and CNIC for emergency creation
router.post('/victim', async (req, res) => {
    const {
        name, phone_no,
        // Optional full-record fields
        email, address, date_of_birth, cnic, password,
        emergency_contact
    } = req.body;

    const connection = await pool.getConnection();
    try {
        await connection.query('START TRANSACTION');

        if (!name || !phone_no) throw new Error('Name and phone number are required.');
        if (!/^\d{10,11}$/.test(phone_no)) throw new Error('Phone number must be 10-11 digits.');

        // Check if phone already exists
        const [existingPhone] = await connection.query(
            'SELECT User_id FROM User WHERE Phone_no = ?', [phone_no]
        );

        let userId;
        let isNewUser  = false;
        let isEmergency = false;

        if (existingPhone.length) {
            userId = existingPhone[0].User_id;

            // Register as victim if not already
            const [existingVictim] = await connection.query(
                'SELECT User_id FROM Victim WHERE User_id = ?', [userId]
            );
            if (!existingVictim.length) {
                const ec = emergency_contact || phone_no;
                await connection.query(
                    `INSERT INTO Victim (User_id, Emergency_contact) VALUES (?, ?)`,
                    [userId, ec]
                );
                logger.info(`EXISTING_USER_REGISTERED_AS_VICTIM - User: ${userId}`);
            }
        } else {
            isNewUser   = true;
            isEmergency = !cnic || !date_of_birth;
            userId      = await generateUniqueId('User', 'User_id');

            // FIX 3: Unique placeholder email
            const finalEmail = email || `emergency_${userId}@placeholder.local`;

            // FIX 4: Unique placeholder CNIC using part of userId (13 digit format)
            // userId is 20-char hex — take first 13 hex chars and convert to digits
            const rawDigits  = parseInt(userId.substring(0, 13), 16)
                                 .toString()
                                 .padStart(13, '0')
                                 .substring(0, 13);
            const finalCNIC  = cnic || `${rawDigits.substring(0,5)}-${rawDigits.substring(5,12)}-${rawDigits.substring(12)}`;

            // FIX 2: Placeholder DOB instead of null (NOT NULL constraint)
            const finalDOB   = date_of_birth || '1900-01-01';

            const finalPass  = password
                ? await hashPassword(password)
                : crypto.randomBytes(8).toString('hex');

            await connection.query(
                `INSERT INTO User (User_id, Name, Email, Phone_no, Address, Password, Date_of_Birth, CNIC)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [userId, name, finalEmail, phone_no, address || null,
                 finalPass, finalDOB, finalCNIC]
            );

            const ec = emergency_contact || phone_no;
            await connection.query(
                `INSERT INTO Victim (User_id, Emergency_contact) VALUES (?, ?)`,
                [userId, ec]
            );

            if (isEmergency) logger.info(`EMERGENCY_VICTIM_CREATED - Victim: ${userId}`);
        }

        await connection.query('COMMIT');
        logger.info(`VICTIM_PROCESSED - Victim: ${userId}, Dispatcher: ${req.user.id}`);

        res.json({
            message:   isNewUser ? 'New victim created successfully.' : 'Existing victim found.',
            victim_id: userId,
            is_new:    isNewUser,
            is_emergency_record: isEmergency,
            next_step: 'Log the call using POST /call-log with this victim_id'
        });
    } catch (err) {
        await connection.query('ROLLBACK');
        logger.error(`CREATE_VICTIM_FAILED: ${err.message}`);
        res.status(400).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// Update victim (row-locked)
// Any dispatcher can update a victim's basic details — victim records are shared resources.
// Row lock prevents two dispatchers from simultaneously overwriting each other's edits.
router.put('/victim/:id', lockRow('Victim', 'id'), async (req, res) => {
    const { name, email, address, emergency_contact, phone_no } = req.body;
    const victimId = req.params.id;

    try {
        const [userRows] = await req.dbConnection.query(
            'SELECT * FROM User WHERE User_id = ?', [victimId]
        );
        const user = userRows[0];

        const userUpdates = [], userParams = [];

        if (name)    { userUpdates.push('Name = ?');     userParams.push(name); }
        if (address) { userUpdates.push('Address = ?');  userParams.push(address); }
        if (email) {
            const [dup] = await req.dbConnection.query(
                'SELECT User_id FROM User WHERE Email = ? AND User_id != ?', [email, victimId]
            );
            if (dup.length) throw new Error('Email already registered to another user.');
            userUpdates.push('Email = ?'); userParams.push(email);
        }
        if (phone_no) {
            if (!/^\d{10,11}$/.test(phone_no)) throw new Error('Phone number must be 10-11 digits.');
            const [dup] = await req.dbConnection.query(
                'SELECT User_id FROM User WHERE Phone_no = ? AND User_id != ?', [phone_no, victimId]
            );
            if (dup.length) throw new Error('Phone number already registered to another user.');
            userUpdates.push('Phone_no = ?'); userParams.push(phone_no);
        }

        if (userUpdates.length) {
            userParams.push(victimId);
            await req.dbConnection.query(
                `UPDATE User SET ${userUpdates.join(', ')} WHERE User_id = ?`, userParams
            );
        }

        if (emergency_contact) {
            if (!/^\d{10,11}$/.test(emergency_contact))
                throw new Error('Emergency contact must be 10-11 digits.');
            if (emergency_contact === (phone_no || user.Phone_no))
                throw new Error('Emergency contact cannot be the same as personal phone.');
            await req.dbConnection.query(
                'UPDATE Victim SET Emergency_contact = ? WHERE User_id = ?',
                [emergency_contact, victimId]
            );
        }

        logger.info(`VICTIM_UPDATED - Victim: ${victimId}, Dispatcher: ${req.user.id}`);
        res.json({ message: 'Victim updated successfully.' });
    } catch (err) {
        logger.error(`VICTIM_UPDATE_FAILED: ${err.message}`);
        res.status(400).json({ error: err.message });
    } finally {
        await releaseRowLock(req.dbConnection, 'Victim', victimId);
        req.dbConnection.release();
    }
});

// ======================================================
// 🔹 CALL LOGGING
// ======================================================

// FIX 15: Added note validation (Request_log.Note NOT NULL)
// FIX 12: Dispatcher availability is now a warning, not a hard block
router.post('/call-log', async (req, res) => {
    const { victim_id, note, location, type = 'Emergency' } = req.body;
    const connection = await pool.getConnection();

    try {
        await connection.query('START TRANSACTION');

        if (!victim_id || !note || !location)
            throw new Error('victim_id, note, and location are all required.');

        if (!VALID_REQUEST_TYPES.includes(type))
            throw new Error(`Invalid type. Use: ${VALID_REQUEST_TYPES.join(', ')}`);

        const [victim] = await connection.query(
            'SELECT User_id, Emergency_contact FROM Victim WHERE User_id = ?', [victim_id]
        );
        if (!victim.length)
            throw new Error('Victim not found. Create victim first using POST /victim.');

        // Check dispatcher's manual availability flag
        const [[disp]] = await connection.query(
            'SELECT Availability FROM Dispatcher WHERE User_id = ?', [req.user.id]
        );
        if (disp?.Availability === 'No')
            throw new Error('Your availability is set to No. Update it first using PUT /availability.');

        // FIX 12: Get workload info as warning instead of hard block
        const load = await checkDispatcherLoad(req.user.id, connection);

        const requestId = await generateUniqueId('Request_log', 'Request_id');

        await connection.query(
            `INSERT INTO Request_log (Request_id, Victim_id, Dispatcher_id, Note, Location, Type)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [requestId, victim_id, req.user.id, note, location, type]
        );
        // Trigger update_dispatcher_status_on_request fires here → sets Availability = 'No'

        await connection.query('COMMIT');
        logger.info(`CALL_LOGGED - Request: ${requestId}, Victim: ${victim_id}, Dispatcher: ${req.user.id}`);

        res.json({
            message:   'Call logged successfully.',
            request_id: requestId,
            victim_id,
            victim_emergency_contact: victim[0].Emergency_contact,
            location,
            timestamp: new Date().toISOString(),
            workload_warning: load.hasActiveIncidents
                ? `You currently have ${load.activeCount} active incident(s).`
                : null,
            next_step: 'Create an incident using POST /incident'
        });
    } catch (err) {
        await connection.query('ROLLBACK');
        logger.error(`CALL_LOG_FAILED: ${err.message}`);
        res.status(400).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// Get all calls for this dispatcher
router.get('/calls', async (req, res) => {
    try {
        const [calls] = await pool.query(`
            SELECT
                r.*,
                u.Name             AS victim_name,
                u.Phone_no         AS victim_phone,
                u.CNIC             AS victim_cnic,
                v.Emergency_contact,
                i.Incident_id,
                i.Status           AS incident_status,
                i.Severity,
                i.Emergency_type,
                CASE WHEN i.Incident_id IS NOT NULL THEN 'Processed' ELSE 'Pending' END AS call_status
            FROM Request_log r
            JOIN Victim v ON r.Victim_id  = v.User_id
            JOIN User u   ON v.User_id    = u.User_id
            LEFT JOIN Incident i ON r.Request_id = i.Request_id
            WHERE r.Dispatcher_id = ?
            ORDER BY r.Request_time DESC
        `, [req.user.id]);

        logger.info(`GET_CALLS - User: ${req.user.id}, Count: ${calls.length}`);
        res.json(calls);
    } catch (err) {
        logger.error(`GET_CALLS_FAILED: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// Get single call details
router.get('/calls/:id', async (req, res) => {
    try {
        const [call] = await pool.query(`
            SELECT
                r.Request_id,
                r.Request_time,
                r.Note         AS call_note,
                r.Location     AS call_location,
                r.Type         AS call_type,
                r.Victim_id,
                r.Dispatcher_id,
                u.Name         AS victim_name,
                u.Phone_no     AS victim_phone,
                u.Email        AS victim_email,
                u.Address      AS victim_address,
                u.Date_of_Birth,
                u.CNIC         AS victim_cnic,
                v.Emergency_contact,
                i.Incident_id,
                i.Emergency_type,
                i.Severity,
                i.Note         AS incident_note,
                i.Location     AS incident_location,
                i.Status       AS incident_status,
                i.Verification_status,
                i.Time         AS incident_time
            FROM Request_log r
            JOIN Victim v ON r.Victim_id  = v.User_id
            JOIN User u   ON v.User_id    = u.User_id
            LEFT JOIN Incident i ON r.Request_id = i.Request_id
            WHERE r.Request_id = ? AND r.Dispatcher_id = ?
        `, [req.params.id, req.user.id]);

        if (!call.length) return res.status(404).json({ error: 'Call not found.' });
        res.json(call[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update call notes / type (row-locked)
// OWNERSHIP: lockRow ensures the record exists; the UPDATE WHERE clause
// enforces dispatcher ownership — only rows belonging to this dispatcher are updated
router.put('/calls/:id', lockRow('Request_log', 'id'), async (req, res) => {
    const { note, type } = req.body;

    try {
        const updates = [], params = [];
        if (note) { updates.push('Note = ?'); params.push(note); }
        if (type) {
            if (!VALID_REQUEST_TYPES.includes(type))
                throw new Error(`Invalid type. Use: ${VALID_REQUEST_TYPES.join(', ')}`);
            updates.push('Type = ?'); params.push(type);
        }
        if (!updates.length) throw new Error('No fields to update.');

        // WHERE includes Dispatcher_id — if this call belongs to another
        // dispatcher, affectedRows will be 0 and we return 403
        params.push(req.params.id, req.user.id);
        const [result] = await req.dbConnection.query(
            `UPDATE Request_log SET ${updates.join(', ')} WHERE Request_id = ? AND Dispatcher_id = ?`,
            params
        );

        if (!result.affectedRows) {
            return res.status(403).json({ error: 'Access denied. This call does not belong to you.' });
        }

        logger.info(`CALL_UPDATED - Request: ${req.params.id}, Dispatcher: ${req.user.id}`);
        res.json({ message: 'Call updated successfully.' });
    } catch (err) {
        logger.error(`CALL_UPDATE_FAILED: ${err.message}`);
        res.status(400).json({ error: err.message });
    } finally {
        await releaseRowLock(req.dbConnection, 'Request_log', req.params.id);
        req.dbConnection.release();
    }
});

// ======================================================
// 🔹 INCIDENT MANAGEMENT
// FIX 5: Removed lockRow middleware (request_id is in body, not params)
//         Lock is now acquired manually inside the handler
// ======================================================

router.post('/incident', async (req, res) => {
    const {
        request_id, emergency_type, severity, note,
        verification_status = 'True', location
    } = req.body;

    const connection = await pool.getConnection();
    let locked = false;

    try {
        await connection.query('START TRANSACTION');

        if (!request_id)                              throw new Error('request_id is required.');
        if (!VALID_EMERGENCY_TYPES.includes(emergency_type))
            throw new Error(`Invalid emergency type. Options: ${VALID_EMERGENCY_TYPES.join(', ')}`);
        if (!VALID_SEVERITY.includes(severity))       throw new Error(`Invalid severity. Use: ${VALID_SEVERITY.join(', ')}`);
        if (!VALID_VERIFICATION_STATUS.includes(verification_status))
            throw new Error(`Invalid verification_status. Use: ${VALID_VERIFICATION_STATUS.join(', ')}`);

        // Acquire row lock on the Request_log row
        await acquireRowLock(connection, 'Request_log', request_id, req);
        locked = true;

        // Verify request belongs to this dispatcher
        const [[request]] = await connection.query(`
            SELECT r.*, u.Name AS victim_name, u.Phone_no AS victim_phone
            FROM Request_log r
            JOIN Victim v ON r.Victim_id = v.User_id
            JOIN User u   ON v.User_id   = u.User_id
            WHERE r.Request_id = ? AND r.Dispatcher_id = ?
        `, [request_id, req.user.id]);

        if (!request) throw new Error('Request not found or not assigned to you.');

        const [existing] = await connection.query(
            'SELECT Incident_id FROM Incident WHERE Request_id = ?', [request_id]
        );
        if (existing.length) throw new Error('An incident already exists for this request.');

        const incidentId       = await generateUniqueId('Incident', 'Incident_id');
        const incidentLocation = location || request.Location;

        await connection.query(`
            INSERT INTO Incident
            (Incident_id, Request_id, Emergency_type, Severity, Note, Location, Verification_status, Status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Ongoing')
        `, [incidentId, request_id, emergency_type, severity,
            note || request.Note, incidentLocation, verification_status]);

        await connection.query('COMMIT');
        logger.info(`INCIDENT_CREATED - Incident: ${incidentId}, Request: ${request_id}, Dispatcher: ${req.user.id}`);

        res.json({
            message:     'Incident created successfully.',
            incident_id: incidentId,
            victim: { id: request.Victim_id, name: request.victim_name, phone: request.victim_phone },
            location:    incidentLocation,
            severity,
            next_step:   'Assign resources using POST /assignment or volunteers using POST /incident/:id/assign-volunteers'
        });
    } catch (err) {
        await connection.query('ROLLBACK');
        logger.error(`INCIDENT_CREATE_FAILED: ${err.message}`);
        res.status(400).json({ error: err.message });
    } finally {
        if (locked) await releaseRowLock(connection, 'Request_log', request_id);
        connection.release();
    }
});

// FIX 14: Added single incident GET
router.get('/incidents/:id', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                i.Incident_id,
                i.Request_id,
                i.Emergency_type,
                i.Severity,
                i.Note             AS incident_note,
                i.Location         AS incident_location,
                i.Verification_status,
                i.Time             AS incident_time,
                i.Status           AS incident_status,
                r.Victim_id,
                r.Request_time,
                r.Type             AS request_type,
                r.Location         AS request_location,
                u.Name             AS victim_name,
                u.Phone_no         AS victim_phone,
                a.Assignment_id,
                a.Status           AS assignment_status,
                a.Assigned_time,
                a.Completion_time,
                ps.Centre_id       AS police_centre,
                ps.Location        AS police_location,
                ps.Status          AS police_status,
                amb.Ambulance_id,
                amb.Relevant_hospital,
                amb.Location       AS ambulance_location,
                amb.Status         AS ambulance_status,
                lc.Law_case_id,
                lc.Case_type       AS law_case_type,
                lc.Status          AS law_case_status,
                fs.follow_up_id,
                fs.Referred_centre,
                fs.Status          AS followup_status,
                GROUP_CONCAT(DISTINCT CONCAT(vol_u.Name, ' (', vol.Centre_id, ')')) AS volunteers_assigned
            FROM Incident i
            JOIN Request_log r             ON i.Request_id    = r.Request_id
            JOIN Victim vic                ON r.Victim_id     = vic.User_id
            JOIN User u                    ON vic.User_id     = u.User_id
            LEFT JOIN Assignment a         ON i.Incident_id   = a.Incident_id
            LEFT JOIN Police_services ps   ON a.Police_id     = ps.Centre_id
            LEFT JOIN Ambulance_service amb ON a.Ambulance_id = amb.Ambulance_id
            LEFT JOIN Law_case lc          ON i.Incident_id   = lc.Incident_id
            LEFT JOIN Follow_up_support fs ON a.Assignment_id = fs.Assignment_id
            LEFT JOIN Volunteer_assignment va ON a.Assignment_id = va.Assignment_id
            LEFT JOIN Volunteer vol           ON va.Volunteer_id = vol.User_id
            LEFT JOIN User vol_u              ON vol.User_id    = vol_u.User_id
            WHERE i.Incident_id = ? AND r.Dispatcher_id = ?
            GROUP BY
                i.Incident_id, i.Request_id, i.Emergency_type, i.Severity,
                i.Note, i.Location, i.Verification_status, i.Time, i.Status,
                r.Victim_id, r.Request_time, r.Type, r.Location,
                u.Name, u.Phone_no,
                a.Assignment_id, a.Status, a.Assigned_time, a.Completion_time,
                ps.Centre_id, ps.Location, ps.Status,
                amb.Ambulance_id, amb.Relevant_hospital, amb.Location, amb.Status,
                lc.Law_case_id, lc.Case_type, lc.Status,
                fs.follow_up_id, fs.Referred_centre, fs.Status
        `, [req.params.id, req.user.id]);

        if (!rows.length) return res.status(404).json({ error: 'Incident not found or not assigned to you.' });
        res.json(rows[0]);
    } catch (err) {
        logger.error(`GET_INCIDENT_FAILED: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// Get all incidents for this dispatcher
router.get('/incidents', async (req, res) => {
    try {
        const [incidents] = await pool.query(`
            SELECT
                i.Incident_id,
                i.Request_id,
                i.Emergency_type,
                i.Severity,
                i.Note             AS incident_note,
                i.Location         AS incident_location,
                i.Verification_status,
                i.Time             AS incident_time,
                i.Status           AS incident_status,
                r.Victim_id,
                u.Name             AS victim_name,
                u.Phone_no         AS victim_phone,
                a.Assignment_id,
                a.Status           AS assignment_status,
                a.Assigned_time,
                a.Completion_time,
                ps.Centre_id       AS police_centre,
                ps.Location        AS police_location,
                amb.Ambulance_id,
                amb.Relevant_hospital,
                amb.Location       AS ambulance_location,
                GROUP_CONCAT(DISTINCT CONCAT(vol_u.Name, ' (', vol.Centre_id, ')')) AS volunteers_assigned
            FROM Incident i
            JOIN Request_log r             ON i.Request_id     = r.Request_id
            JOIN Victim vic                ON r.Victim_id      = vic.User_id
            JOIN User u                    ON vic.User_id      = u.User_id
            LEFT JOIN Assignment a          ON i.Incident_id   = a.Incident_id
            LEFT JOIN Police_services ps    ON a.Police_id     = ps.Centre_id
            LEFT JOIN Ambulance_service amb ON a.Ambulance_id  = amb.Ambulance_id
            LEFT JOIN Volunteer_assignment va ON a.Assignment_id = va.Assignment_id
            LEFT JOIN Volunteer vol            ON va.Volunteer_id = vol.User_id
            LEFT JOIN User vol_u               ON vol.User_id     = vol_u.User_id
            WHERE r.Dispatcher_id = ?
            GROUP BY
                i.Incident_id, i.Request_id, i.Emergency_type, i.Severity,
                i.Note, i.Location, i.Verification_status, i.Time, i.Status,
                r.Victim_id, u.Name, u.Phone_no,
                a.Assignment_id, a.Status, a.Assigned_time, a.Completion_time,
                ps.Centre_id, ps.Location,
                amb.Ambulance_id, amb.Relevant_hospital, amb.Location
            ORDER BY i.Time DESC
        `, [req.user.id]);

        res.json(incidents);
    } catch (err) {
        logger.error(`GET_INCIDENTS_FAILED: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// Update incident (row-locked)
router.put('/incident/:id', lockRow('Incident', 'id'), async (req, res) => {
    const { status, verification_status, note, severity } = req.body;
    const incidentId = req.params.id;

    try {
        // Ownership check
        const [[ownership]] = await req.dbConnection.query(`
            SELECT i.Incident_id FROM Incident i
            JOIN Request_log r ON i.Request_id = r.Request_id
            WHERE i.Incident_id = ? AND r.Dispatcher_id = ?
        `, [incidentId, req.user.id]);
        if (!ownership) throw new Error('Incident not found or not assigned to you.');

        const updates = [], params = [];
        if (status) {
            if (!VALID_STATUS.includes(status))
                throw new Error(`Invalid status. Use: ${VALID_STATUS.join(', ')}`);
            updates.push('Status = ?'); params.push(status);
        }
        if (verification_status) {
            if (!VALID_VERIFICATION_STATUS.includes(verification_status))
                throw new Error(`Invalid verification_status.`);
            updates.push('Verification_status = ?'); params.push(verification_status);
        }
        if (note)     { updates.push('Note = ?');     params.push(note); }
        if (severity) {
            if (!VALID_SEVERITY.includes(severity)) throw new Error(`Invalid severity.`);
            updates.push('Severity = ?'); params.push(severity);
        }

        if (updates.length) {
            params.push(incidentId);
            await req.dbConnection.query(
                `UPDATE Incident SET ${updates.join(', ')} WHERE Incident_id = ?`, params
            );
        }

        const response = { message: 'Incident updated successfully.' };
        if (verification_status === 'False') {
            response.suggestion = 'Incident marked as false. Consider creating a law case (Penalty) using POST /lawcase.';
        }

        logger.info(`INCIDENT_UPDATED - Incident: ${incidentId}, Dispatcher: ${req.user.id}`);
        res.json(response);
    } catch (err) {
        logger.error(`INCIDENT_UPDATE_FAILED: ${err.message}`);
        res.status(400).json({ error: err.message });
    } finally {
        await releaseRowLock(req.dbConnection, 'Incident', incidentId);
        req.dbConnection.release();
    }
});

// ======================================================
// 🔹 VOLUNTEER MANAGEMENT
// ======================================================

// FIX 5: Only shows volunteers from this dispatcher's own centre
router.get('/volunteers/available', async (req, res) => {
    try {
        const { severity } = req.query;
        const volunteers = await getAvailableVolunteers(req.user.id, severity || null);
        res.json(volunteers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Assign volunteers directly to an incident (creates assignment if needed)
router.post('/incident/:id/assign-volunteers', lockRow('Incident', 'id'), async (req, res) => {
    const { volunteer_ids } = req.body;
    const incidentId = req.params.id;

    try {
        if (!volunteer_ids || !Array.isArray(volunteer_ids) || !volunteer_ids.length)
            throw new Error('volunteer_ids array is required.');

        // Ownership check
        const [[ownership]] = await req.dbConnection.query(`
            SELECT i.Incident_id FROM Incident i
            JOIN Request_log r ON i.Request_id = r.Request_id
            WHERE i.Incident_id = ? AND r.Dispatcher_id = ?
        `, [incidentId, req.user.id]);
        if (!ownership) throw new Error('Incident not found or not assigned to you.');

        let [assignment] = await req.dbConnection.query(
            'SELECT Assignment_id FROM Assignment WHERE Incident_id = ?', [incidentId]
        );

        let assignmentId;
        if (!assignment.length) {
            assignmentId = await generateUniqueId('Assignment', 'Assignment_id');
            await req.dbConnection.query(
                `INSERT INTO Assignment (Assignment_id, Incident_id, Status) VALUES (?, ?, 'Ongoing')`,
                [assignmentId, incidentId]
            );
        } else {
            assignmentId = assignment[0].Assignment_id;
        }

        const assigned = await assignVolunteers(req.dbConnection, assignmentId, volunteer_ids, req.user.id);

        logger.info(`VOLUNTEERS_ASSIGNED - Incident: ${incidentId}, Volunteers: ${assigned.join(', ')}, Dispatcher: ${req.user.id}`);
        res.json({ message: 'Volunteers assigned successfully.', assignment_id: assignmentId, assigned_volunteers: assigned });
    } catch (err) {
        logger.error(`VOLUNTEER_ASSIGN_FAILED: ${err.message}`);
        res.status(400).json({ error: err.message });
    } finally {
        await releaseRowLock(req.dbConnection, 'Incident', incidentId);
        req.dbConnection.release();
    }
});

// ======================================================
// 🔹 RESOURCE ASSIGNMENT (Police + Ambulance)
// FIX 6: Removed lockRow middleware (incident_id is in body, not params)
// ======================================================

router.get('/resources/available', async (req, res) => {
    try {
        const resources = await getAvailableResources();
        res.json(resources);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/assignment', async (req, res) => {
    const { incident_id, police_id, ambulance_id, volunteer_ids } = req.body;

    const connection = await pool.getConnection();
    let locked = false;

    try {
        await connection.query('START TRANSACTION');

        if (!incident_id) throw new Error('incident_id is required.');

        // Acquire row lock on incident
        await acquireRowLock(connection, 'Incident', incident_id, req);
        locked = true;

        const [[incident]] = await connection.query(`
            SELECT i.* FROM Incident i
            JOIN Request_log r ON i.Request_id = r.Request_id
            WHERE i.Incident_id = ? AND r.Dispatcher_id = ?
        `, [incident_id, req.user.id]);
        if (!incident) throw new Error('Incident not found or not assigned to you.');

        const [existing] = await connection.query(
            'SELECT Assignment_id FROM Assignment WHERE Incident_id = ?', [incident_id]
        );
        if (existing.length) throw new Error('An assignment already exists for this incident. Use PUT /assignment/:id to update.');

        const assignmentId = await createAssignment(connection, incident_id, police_id, ambulance_id);

        let assignedVolunteers = [];
        if (volunteer_ids?.length) {
            assignedVolunteers = await assignVolunteers(connection, assignmentId, volunteer_ids, req.user.id);
        }

        await connection.query('COMMIT');
        logger.info(`ASSIGNMENT_CREATED - Assignment: ${assignmentId}, Incident: ${incident_id}, Dispatcher: ${req.user.id}`);

        res.json({
            message:            'Assignment created successfully.',
            assignment_id:      assignmentId,
            assigned_volunteers: assignedVolunteers
        });
    } catch (err) {
        await connection.query('ROLLBACK');
        logger.error(`ASSIGNMENT_CREATE_FAILED: ${err.message}`);
        res.status(400).json({ error: err.message });
    } finally {
        if (locked) await releaseRowLock(connection, 'Incident', incident_id);
        connection.release();
    }
});

// Update assignment status (row-locked)
router.put('/assignment/:id', lockRow('Assignment', 'id'), async (req, res) => {
    const { status } = req.body;
    const assignmentId = req.params.id;

    try {
        if (!status || !VALID_STATUS.includes(status))
            throw new Error(`Invalid status. Use: ${VALID_STATUS.join(', ')}`);

        const [[ownership]] = await req.dbConnection.query(`
            SELECT a.Assignment_id FROM Assignment a
            JOIN Incident i    ON a.Incident_id  = i.Incident_id
            JOIN Request_log r ON i.Request_id   = r.Request_id
            WHERE a.Assignment_id = ? AND r.Dispatcher_id = ?
        `, [assignmentId, req.user.id]);
        if (!ownership) throw new Error('Assignment not found or not assigned to you.');

        await req.dbConnection.query(
            'UPDATE Assignment SET Status = ? WHERE Assignment_id = ?',
            [status, assignmentId]
        );
        // Triggers: set_completion_time_on_finish + update_incident_status_on_assignment fire here

        logger.info(`ASSIGNMENT_UPDATED - Assignment: ${assignmentId}, Status: ${status}, Dispatcher: ${req.user.id}`);
        res.json({ message: 'Assignment updated successfully.' });
    } catch (err) {
        logger.error(`ASSIGNMENT_UPDATE_FAILED: ${err.message}`);
        res.status(400).json({ error: err.message });
    } finally {
        await releaseRowLock(req.dbConnection, 'Assignment', assignmentId);
        req.dbConnection.release();
    }
});

// ======================================================
// 🔹 BACKUP REQUEST HANDLING
// ======================================================

router.post('/volunteer/:id/backup-request', async (req, res) => {
    const { reason, backup_type = 'General', severity = 'Medium' } = req.body;
    const volunteerId = req.params.id;
    const connection  = await pool.getConnection();

    try {
        await connection.query('START TRANSACTION');

        if (!reason) throw new Error('reason is required for a backup request.');

        const [volunteer] = await connection.query(`
            SELECT
                v.*,
                va.Assignment_id,
                a.Incident_id,
                a.Status           AS assignment_status,
                i.Emergency_type,
                i.Severity         AS incident_severity,
                i.Location,
                i.Note             AS incident_note,
                u.Name             AS volunteer_name,
                u.Phone_no         AS volunteer_phone,
                vic.User_id        AS victim_id,
                vic_u.Name         AS victim_name,
                vic_u.Phone_no     AS victim_phone,
                c.Location         AS centre_location
            FROM Volunteer v
            JOIN User u                   ON v.User_id        = u.User_id
            JOIN Centre c                 ON v.Centre_id      = c.Centre_id
            JOIN Volunteer_assignment va  ON v.User_id        = va.Volunteer_id
            JOIN Assignment a             ON va.Assignment_id = a.Assignment_id
            JOIN Incident i               ON a.Incident_id    = i.Incident_id
            JOIN Request_log r            ON i.Request_id     = r.Request_id
            JOIN Victim vic               ON r.Victim_id      = vic.User_id
            JOIN User vic_u               ON vic.User_id      = vic_u.User_id
            WHERE v.User_id = ? AND a.Status = 'Ongoing'
              AND r.Dispatcher_id = ?
        `, [volunteerId, req.user.id]);

        if (!volunteer.length) {
            return res.status(404).json({
                error:      'Volunteer not found or not on active duty.',
                suggestion: 'Only volunteers on an Ongoing assignment can request backup.'
            });
        }

        const incidentId   = volunteer[0].Incident_id;
        const assignmentId = volunteer[0].Assignment_id;
        const policeReq    = backup_type === 'Police' || backup_type === 'Both';
        const ambulanceReq = backup_type === 'Medical' || backup_type === 'Both';

        const [availPolice]    = await connection.query(`SELECT Centre_id, Location, Centre_number FROM Police_services    WHERE Status = 'Pending'`);
        const [availAmbulance] = await connection.query(`SELECT Ambulance_id, Relevant_hospital, Location, Contact_info FROM Ambulance_service WHERE Status = 'Pending'`);

        let assignedPolice = null, assignedAmbulance = null;
        const resourceMessages = [];

        if (policeReq) {
            if (availPolice.length) {
                assignedPolice = availPolice[0].Centre_id;
                await connection.query(`UPDATE Police_services SET Status = 'Ongoing' WHERE Centre_id = ?`,    [assignedPolice]);
                await connection.query(`UPDATE Assignment SET Police_id = ?    WHERE Assignment_id = ?`, [assignedPolice,    assignmentId]);
                resourceMessages.push(`Police unit ${assignedPolice} dispatched.`);
            } else {
                resourceMessages.push('No police units currently available.');
            }
        }

        if (ambulanceReq) {
            if (availAmbulance.length) {
                assignedAmbulance = availAmbulance[0].Ambulance_id;
                await connection.query(`UPDATE Ambulance_service SET Status = 'Ongoing' WHERE Ambulance_id = ?`, [assignedAmbulance]);
                await connection.query(`UPDATE Assignment SET Ambulance_id = ? WHERE Assignment_id = ?`, [assignedAmbulance, assignmentId]);
                resourceMessages.push(`Ambulance ${assignedAmbulance} dispatched.`);
            } else {
                resourceMessages.push('No ambulances currently available.');
            }
        }

        const backupNote = `[${new Date().toISOString()}] BACKUP REQUESTED by Volunteer ${volunteer[0].volunteer_name}: ${reason} (${backup_type}). ${resourceMessages.join(' ')}`;
        await connection.query(
            `UPDATE Incident SET Note = CONCAT(IFNULL(Note, ''), '\n', ?) WHERE Incident_id = ?`,
            [backupNote, incidentId]
        );

        await connection.query('COMMIT');
        logger.info(`BACKUP_REQUEST_PROCESSED - Volunteer: ${volunteerId}, Incident: ${incidentId}, Type: ${backup_type}, Dispatcher: ${req.user.id}`);

        res.json({
            message:    'Backup request processed.',
            incident_id: incidentId,
            volunteer:  { id: volunteerId, name: volunteer[0].volunteer_name, centre: volunteer[0].centre_location },
            victim:     { id: volunteer[0].victim_id, name: volunteer[0].victim_name },
            location:   volunteer[0].Location,
            backup_type,
            resources_dispatched: {
                police:    assignedPolice    || 'Not requested / unavailable',
                ambulance: assignedAmbulance || 'Not requested / unavailable'
            },
            details:   resourceMessages,
            status:    (assignedPolice || assignedAmbulance) ? 'Backup en route' : 'No resources available',
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        await connection.query('ROLLBACK');
        logger.error(`BACKUP_REQUEST_FAILED: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// Backup / resource status for an incident
router.get('/incident/:id/backup-status', async (req, res) => {
    try {
        const [incident] = await pool.query(`
            SELECT
                i.Incident_id,
                i.Note,
                i.Location         AS incident_location,
                i.Emergency_type,
                i.Severity,
                a.Assignment_id,
                a.Police_id,
                a.Ambulance_id,
                ps.Location        AS police_location,
                ps.Status          AS police_status,
                amb.Relevant_hospital,
                amb.Location       AS ambulance_location,
                amb.Status         AS ambulance_status,
                GROUP_CONCAT(DISTINCT CONCAT(u.Name, ' (', vol.Centre_id, ')')) AS volunteers_assigned
            FROM Incident i
            JOIN Request_log r              ON i.Request_id     = r.Request_id
            LEFT JOIN Assignment a          ON i.Incident_id    = a.Incident_id
            LEFT JOIN Police_services ps    ON a.Police_id      = ps.Centre_id
            LEFT JOIN Ambulance_service amb ON a.Ambulance_id   = amb.Ambulance_id
            LEFT JOIN Volunteer_assignment va ON a.Assignment_id = va.Assignment_id
            LEFT JOIN Volunteer vol            ON va.Volunteer_id = vol.User_id
            LEFT JOIN User u                   ON vol.User_id    = u.User_id
            WHERE i.Incident_id = ? AND r.Dispatcher_id = ?
            GROUP BY
                i.Incident_id, i.Note, i.Location, i.Emergency_type, i.Severity,
                a.Assignment_id, a.Police_id, a.Ambulance_id,
                ps.Location, ps.Status,
                amb.Relevant_hospital, amb.Location, amb.Status
        `, [req.params.id, req.user.id]);

        if (!incident.length) return res.status(404).json({ error: 'Incident not found or not assigned to you.' });

        const notes = incident[0].Note || '';
        const backupHistory = notes.split('\n')
            .filter(l => l.includes('BACKUP REQUESTED'))
            .map(l => {
                const m = l.match(/\[(.*?)\] BACKUP REQUESTED by Volunteer (.*?): (.*)/);
                return m ? { timestamp: m[1], volunteer: m[2], details: m[3] } : null;
            })
            .filter(Boolean);

        res.json({
            incident: {
                id: incident[0].Incident_id, type: incident[0].Emergency_type,
                severity: incident[0].Severity, location: incident[0].Location
            },
            assignment: {
                id: incident[0].Assignment_id,
                police: incident[0].Police_id ? {
                    id: incident[0].Police_id, location: incident[0].police_location, status: incident[0].police_status
                } : null,
                ambulance: incident[0].Ambulance_id ? {
                    id: incident[0].Ambulance_id, hospital: incident[0].Relevant_hospital,
                    location: incident[0].ambulance_location, status: incident[0].ambulance_status
                } : null,
                volunteers: incident[0].volunteers_assigned
                    ? incident[0].volunteers_assigned.split(',') : []
            },
            backup_history:   backupHistory,
            has_active_backup: backupHistory.length > 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======================================================
// 🔹 LAW CASE MANAGEMENT
// FIX 7: Removed lockRow (incident_id is in body) — lock acquired manually
// ======================================================

router.post('/lawcase', async (req, res) => {
    const { incident_id, lawfirm_name, case_type } = req.body;
    const connection = await pool.getConnection();
    let locked = false;

    try {
        await connection.query('START TRANSACTION');

        if (!incident_id) throw new Error('incident_id is required.');
        if (!VALID_CASE_TYPES.includes(case_type))
            throw new Error(`Invalid case_type. Use: ${VALID_CASE_TYPES.join(', ')}`);

        await acquireRowLock(connection, 'Incident', incident_id, req);
        locked = true;

        const [[incident]] = await connection.query(`
            SELECT i.Incident_id FROM Incident i
            JOIN Request_log r ON i.Request_id = r.Request_id
            WHERE i.Incident_id = ? AND r.Dispatcher_id = ?
        `, [incident_id, req.user.id]);
        if (!incident) throw new Error('Incident not found or not assigned to you.');

        const [existing] = await connection.query(
            'SELECT Law_case_id FROM Law_case WHERE Incident_id = ?', [incident_id]
        );
        if (existing.length) throw new Error('A law case already exists for this incident.');

        const lawCaseId = await generateUniqueId('Law_case', 'Law_case_id');
        await connection.query(
            `INSERT INTO Law_case (Law_case_id, Incident_id, Lawfirm_name, Status, Case_type) VALUES (?, ?, ?, 'Pending', ?)`,
            [lawCaseId, incident_id, lawfirm_name || 'Legal Aid Department', case_type]
        );

        await connection.query('COMMIT');
        logger.info(`LAW_CASE_CREATED - Case: ${lawCaseId}, Incident: ${incident_id}, Type: ${case_type}, Dispatcher: ${req.user.id}`);

        res.json({ message: 'Law case created successfully.', law_case_id: lawCaseId, case_type });
    } catch (err) {
        await connection.query('ROLLBACK');
        logger.error(`LAW_CASE_CREATE_FAILED: ${err.message}`);
        res.status(400).json({ error: err.message });
    } finally {
        if (locked) await releaseRowLock(connection, 'Incident', incident_id);
        connection.release();
    }
});

// Update law case (row-locked)
router.put('/lawcase/:id', lockRow('Law_case', 'id'), async (req, res) => {
    const { status } = req.body;
    const lawCaseId  = req.params.id;

    try {
        if (!status || !VALID_STATUS.includes(status))
            throw new Error(`Invalid status. Use: ${VALID_STATUS.join(', ')}`);

        const [[ownership]] = await req.dbConnection.query(`
            SELECT lc.Law_case_id FROM Law_case lc
            JOIN Incident i    ON lc.Incident_id = i.Incident_id
            JOIN Request_log r ON i.Request_id   = r.Request_id
            WHERE lc.Law_case_id = ? AND r.Dispatcher_id = ?
        `, [lawCaseId, req.user.id]);
        if (!ownership) throw new Error('Law case not found or not assigned to you.');

        await req.dbConnection.query(
            'UPDATE Law_case SET Status = ? WHERE Law_case_id = ?', [status, lawCaseId]
        );

        logger.info(`LAW_CASE_UPDATED - Case: ${lawCaseId}, Dispatcher: ${req.user.id}`);
        res.json({ message: 'Law case updated successfully.' });
    } catch (err) {
        logger.error(`LAW_CASE_UPDATE_FAILED: ${err.message}`);
        res.status(400).json({ error: err.message });
    } finally {
        await releaseRowLock(req.dbConnection, 'Law_case', lawCaseId);
        req.dbConnection.release();
    }
});

// Get all law cases for this dispatcher
router.get('/lawcases', async (req, res) => {
    try {
        const [cases] = await pool.query(`
            SELECT lc.*, i.Emergency_type, i.Severity, r.Victim_id, u.Name AS victim_name
            FROM Law_case lc
            JOIN Incident i    ON lc.Incident_id = i.Incident_id
            JOIN Request_log r ON i.Request_id   = r.Request_id
            JOIN Victim v      ON r.Victim_id    = v.User_id
            JOIN User u        ON v.User_id      = u.User_id
            WHERE r.Dispatcher_id = ?
            ORDER BY lc.Law_case_id DESC
        `, [req.user.id]);
        res.json(cases);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======================================================
// 🔹 FOLLOW-UP SUPPORT (Rehab / Safety Centre Referral)
// FIX 8: Removed lockRow (assignment_id is in body) — lock acquired manually
// ======================================================

router.post('/followup', async (req, res) => {
    const { assignment_id, referred_centre, case_type } = req.body;
    const connection = await pool.getConnection();
    let locked = false;

    try {
        await connection.query('START TRANSACTION');

        if (!assignment_id || !referred_centre)
            throw new Error('assignment_id and referred_centre are required.');
        if (!VALID_CASE_TYPES.includes(case_type))
            throw new Error(`Invalid case_type. Use: ${VALID_CASE_TYPES.join(', ')}`);

        await acquireRowLock(connection, 'Assignment', assignment_id, req);
        locked = true;

        const [[assignment]] = await connection.query(`
            SELECT a.Assignment_id FROM Assignment a
            JOIN Incident i    ON a.Incident_id = i.Incident_id
            JOIN Request_log r ON i.Request_id  = r.Request_id
            WHERE a.Assignment_id = ? AND r.Dispatcher_id = ?
        `, [assignment_id, req.user.id]);
        if (!assignment) throw new Error('Assignment not found or not assigned to you.');

        const [existing] = await connection.query(
            'SELECT follow_up_id FROM Follow_up_support WHERE Assignment_id = ?', [assignment_id]
        );
        if (existing.length) throw new Error('Follow-up support already exists for this assignment.');

        const followUpId = await generateUniqueId('Follow_up_support', 'follow_up_id');
        await connection.query(
            `INSERT INTO Follow_up_support (follow_up_id, Assignment_id, Referred_centre, Status, Case_type) VALUES (?, ?, ?, 'Pending', ?)`,
            [followUpId, assignment_id, referred_centre, case_type]
        );

        await connection.query('COMMIT');
        logger.info(`FOLLOWUP_CREATED - Follow-up: ${followUpId}, Assignment: ${assignment_id}, Dispatcher: ${req.user.id}`);

        res.json({ message: 'Follow-up support created successfully.', follow_up_id: followUpId });
    } catch (err) {
        await connection.query('ROLLBACK');
        logger.error(`FOLLOWUP_CREATE_FAILED: ${err.message}`);
        res.status(400).json({ error: err.message });
    } finally {
        if (locked) await releaseRowLock(connection, 'Assignment', assignment_id);
        connection.release();
    }
});

// Update follow-up support (row-locked)
router.put('/followup/:id', lockRow('Follow_up_support', 'id'), async (req, res) => {
    const { status } = req.body;
    const followUpId = req.params.id;

    try {
        if (!status || !VALID_STATUS.includes(status))
            throw new Error(`Invalid status. Use: ${VALID_STATUS.join(', ')}`);

        const [[ownership]] = await req.dbConnection.query(`
            SELECT fs.follow_up_id FROM Follow_up_support fs
            JOIN Assignment a  ON fs.Assignment_id = a.Assignment_id
            JOIN Incident i    ON a.Incident_id    = i.Incident_id
            JOIN Request_log r ON i.Request_id     = r.Request_id
            WHERE fs.follow_up_id = ? AND r.Dispatcher_id = ?
        `, [followUpId, req.user.id]);
        if (!ownership) throw new Error('Follow-up not found or not assigned to you.');

        await req.dbConnection.query(
            'UPDATE Follow_up_support SET Status = ? WHERE follow_up_id = ?', [status, followUpId]
        );

        logger.info(`FOLLOWUP_UPDATED - Follow-up: ${followUpId}, Dispatcher: ${req.user.id}`);
        res.json({ message: 'Follow-up support updated successfully.' });
    } catch (err) {
        logger.error(`FOLLOWUP_UPDATE_FAILED: ${err.message}`);
        res.status(400).json({ error: err.message });
    } finally {
        await releaseRowLock(req.dbConnection, 'Follow_up_support', followUpId);
        req.dbConnection.release();
    }
});

// Get all follow-ups for this dispatcher
router.get('/followups', async (req, res) => {
    try {
        const [followups] = await pool.query(`
            SELECT fs.*, i.Emergency_type, r.Victim_id, u.Name AS victim_name
            FROM Follow_up_support fs
            JOIN Assignment a  ON fs.Assignment_id = a.Assignment_id
            JOIN Incident i    ON a.Incident_id    = i.Incident_id
            JOIN Request_log r ON i.Request_id     = r.Request_id
            JOIN Victim v      ON r.Victim_id      = v.User_id
            JOIN User u        ON v.User_id        = u.User_id
            WHERE r.Dispatcher_id = ?
            ORDER BY fs.follow_up_id DESC
        `, [req.user.id]);
        res.json(followups);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======================================================
// 🔹 ADMIN TAKEOVER
// FIX 10: Removed duplicate verifyJWT (already on router.use)
//         Kept allowRoles('Admin') as route-level guard — correct pattern
// ======================================================

router.post('/incident/:id/admin-takeover', allowRoles('Admin'), async (req, res) => {
    const incidentId = req.params.id;
    const connection = await pool.getConnection();

    try {
        const [[incident]] = await connection.query(`
            SELECT i.*, r.Dispatcher_id, u.Name AS dispatcher_name
            FROM Incident i
            JOIN Request_log r ON i.Request_id  = r.Request_id
            JOIN Dispatcher d  ON r.Dispatcher_id = d.User_id
            JOIN User u        ON d.User_id      = u.User_id
            WHERE i.Incident_id = ?
        `, [incidentId]);

        if (!incident) return res.status(404).json({ error: 'Incident not found.' });

        // Force-release the row lock using the same key format as acquireRowLock
        // lockKey format is: `${table}_${idValue}` → "Incident_<id>"
        await connection.query(`SELECT RELEASE_LOCK(?)`, [`Incident_${incidentId}`]);

        // Now acquire the lock for the admin so they can write to this incident
        const [[{ acquired }]] = await connection.query(
            `SELECT GET_LOCK(?, ?) AS acquired`, [`Incident_${incidentId}`, LOCK_TIMEOUT]
        );

        if (!acquired) {
            return res.status(423).json({ error: 'Could not acquire lock after force-release. Try again.' });
        }

        logger.info(
            `ADMIN_TAKEOVER - Admin: ${req.user.id} took over Incident: ${incidentId} ` +
            `from Dispatcher: ${incident.dispatcher_name} (${incident.Dispatcher_id})`
        );

        res.json({
            message:         'Admin takeover successful. You now hold the lock on this incident.',
            incident_id:     incidentId,
            taken_over_from: { id: incident.Dispatcher_id, name: incident.dispatcher_name },
            taken_over_by:   req.user.id,
            lock_note:       'Call POST /incident/:id/admin-release-lock when done to free the lock.',
            timestamp:       new Date().toISOString()
        });
    } catch (err) {
        logger.error(`ADMIN_TAKEOVER_FAILED: ${err.message}`);
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// Admin explicitly releases a taken-over incident lock when done
router.post('/incident/:id/admin-release-lock', allowRoles('Admin'), async (req, res) => {
    const incidentId = req.params.id;
    const connection = await pool.getConnection();
    try {
        await connection.query(`SELECT RELEASE_LOCK(?)`, [`Incident_${incidentId}`]);
        logger.info(`ADMIN_LOCK_RELEASED - Admin: ${req.user.id} released lock on Incident: ${incidentId}`);
        res.json({ message: 'Lock released. Dispatcher can now access this incident.', incident_id: incidentId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

module.exports = router;