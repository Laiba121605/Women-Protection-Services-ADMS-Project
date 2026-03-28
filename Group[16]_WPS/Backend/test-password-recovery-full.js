// test-password-recovery-full.js
const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function login(user_id) {
    const res = await axios.post(`${BASE_URL}/auth/login`, {
        user_id,
        password: 'Test@1234'
    });
    return res.data.token;
}

const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

async function test(name, fn) {
    try {
        await fn();
        console.log(`✅ PASS: ${name}`);
    } catch (err) {
        const msg = err.response?.data?.message || err.message;
        console.log(`❌ FAIL: ${name} — ${msg}`);
    }
}

async function assert(condition, msg) {
    if (!condition) throw new Error(msg);
}

async function runTests() {

    console.log('\n🔐 Logging in...');
    const victimToken  = await login('U021');
    const admin1Token  = await login('U001');
    const admin2Token  = await login('U002');
    const admin3Token  = await login('U003');
    console.log('✅ All tokens fetched\n');

    let recoveryId;
    let assignedAdmin;

    console.log('--- PASSWORD RECOVERY TESTS ---\n');

    // ---------------------------------------------------------------
    // 1. VICTIM CREATES RECOVERY REQUEST
    // ---------------------------------------------------------------
    await test('Victim creates password recovery request', async () => {
        const res = await axios.post(`${BASE_URL}/password-recovery`, {}, auth(victimToken));
        assert(res.status === 201, `Expected 201, got ${res.status}`);
        assert(res.data.Recovery_id, 'No Recovery_id in response');
        recoveryId = res.data.Recovery_id;
        assignedAdmin = res.data.assigned_admin;
        console.log(`   → Recovery ID: ${recoveryId} | Assigned Admin: ${assignedAdmin}`);
    });

    // ---------------------------------------------------------------
    // 2. ADMIN VIEWS ALL REQUESTS
    // ---------------------------------------------------------------
    await test('Admin views all recovery requests', async () => {
        const res = await axios.get(`${BASE_URL}/password-recovery`, auth(admin1Token));
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(Array.isArray(res.data), 'Expected array');
        console.log(`   → Total requests in DB: ${res.data.length}`);
    });

    // ---------------------------------------------------------------
    // 3. VICTIM VIEWS OWN REQUESTS
    // ---------------------------------------------------------------
    await test('Victim views their own requests', async () => {
        const res = await axios.get(`${BASE_URL}/password-recovery/my-requests`, auth(victimToken));
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(Array.isArray(res.data), 'Expected array');
        console.log(`   → Victim own requests: ${res.data.length}`);
    });

    // ---------------------------------------------------------------
    // 4. VICTIM CANNOT ACCESS ADMIN ROUTES
    // ---------------------------------------------------------------
    await test('Victim cannot access admin GET route', async () => {
        try {
            await axios.get(`${BASE_URL}/password-recovery`, auth(victimToken));
            throw new Error('Should have been rejected');
        } catch (err) {
            assert(err.response?.status === 403, `Expected 403, got ${err.response?.status}`);
        }
    });

    // ---------------------------------------------------------------
    // 5. UPDATE WITH NO FIELDS REJECTED
    // ---------------------------------------------------------------
    await test('Update with no fields is rejected', async () => {
        try {
            await axios.put(
                `${BASE_URL}/password-recovery/${recoveryId}`,
                {},
                auth(admin1Token)
            );
            throw new Error('Should have been rejected');
        } catch (err) {
            assert(err.response?.status === 400, `Expected 400, got ${err.response?.status}`);
        }
    });

    // ---------------------------------------------------------------
    // 6. UPDATE WITH INVALID STATUS REJECTED
    // ---------------------------------------------------------------
    await test('Update with invalid status is rejected', async () => {
        try {
            await axios.put(
                `${BASE_URL}/password-recovery/${recoveryId}`,
                { status: 'InProgress' },
                auth(admin1Token)
            );
            throw new Error('Should have been rejected');
        } catch (err) {
            assert(err.response?.status === 400, `Expected 400, got ${err.response?.status}`);
        }
    });

    // ---------------------------------------------------------------
    // 7. ADMIN UPDATES NOTE ONLY
    // ---------------------------------------------------------------
    await test('Admin updates note only', async () => {
        const res = await axios.put(
            `${BASE_URL}/password-recovery/${recoveryId}`,
            { note: 'Reviewed by admin, processing soon' },
            auth(admin1Token)
        );
        assert(res.status === 200, `Expected 200, got ${res.status}`);
    });

    // ---------------------------------------------------------------
    // 8. ADMIN UPDATES STATUS ONLY
    // ---------------------------------------------------------------
    await test('Admin updates status only', async () => {
        const res = await axios.put(
            `${BASE_URL}/password-recovery/${recoveryId}`,
            { status: 'Pending' },
            auth(admin1Token)
        );
        assert(res.status === 200, `Expected 200, got ${res.status}`);
    });

    // ---------------------------------------------------------------
    // 9. ADMIN UPDATES BOTH STATUS AND NOTE
    // ---------------------------------------------------------------
    await test('Admin updates both status and note', async () => {
        const res = await axios.put(
            `${BASE_URL}/password-recovery/${recoveryId}`,
            { status: 'Pending', note: 'Verified identity, will reset soon' },
            auth(admin1Token)
        );
        assert(res.status === 200, `Expected 200, got ${res.status}`);
    });

    // ---------------------------------------------------------------
    // 10. NON ASSIGNED ADMIN CANNOT RESET PASSWORD
    // ---------------------------------------------------------------
    await test('Non-assigned admin cannot reset password', async () => {
        const adminTokenMap = { 'U001': admin1Token, 'U002': admin2Token, 'U003': admin3Token };
        const nonAssignedToken = Object.entries(adminTokenMap).find(([id]) => id !== assignedAdmin)?.[1];

        try {
            await axios.put(
                `${BASE_URL}/password-recovery/${recoveryId}/reset-password`,
                {},
                auth(nonAssignedToken)
            );
            throw new Error('Should have been rejected');
        } catch (err) {
            assert(err.response?.status === 403, `Expected 403, got ${err.response?.status}`);
        }
    });

    // ---------------------------------------------------------------
    // 11. RESET WITH INVALID STATUS REJECTED
    // ---------------------------------------------------------------
    await test('Reset with invalid status is rejected', async () => {
        const adminTokenMap = { 'U001': admin1Token, 'U002': admin2Token, 'U003': admin3Token };
        const assignedToken = adminTokenMap[assignedAdmin];

        try {
            await axios.put(
                `${BASE_URL}/password-recovery/${recoveryId}/reset-password`,
                { status: 'InProgress' },
                auth(assignedToken)
            );
            throw new Error('Should have been rejected');
        } catch (err) {
            assert(err.response?.status === 400, `Expected 400, got ${err.response?.status}`);
        }
    });

    // ---------------------------------------------------------------
    // 12. ASSIGNED ADMIN RESETS PASSWORD WITH NOTE
    // ---------------------------------------------------------------
    await test('Assigned admin resets password with note', async () => {
        const adminTokenMap = { 'U001': admin1Token, 'U002': admin2Token, 'U003': admin3Token };
        const assignedToken = adminTokenMap[assignedAdmin];

        const res = await axios.put(
            `${BASE_URL}/password-recovery/${recoveryId}/reset-password`,
            { note: 'Identity verified via phone call' },
            auth(assignedToken)
        );
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.data.new_password, 'No new_password in response');
        console.log(`   → New password issued: ${res.data.new_password}`);
    });

    // ---------------------------------------------------------------
    // 13. CANNOT RESET ALREADY PROCESSED REQUEST
    // ---------------------------------------------------------------
    await test('Cannot reset already processed request', async () => {
        const adminTokenMap = { 'U001': admin1Token, 'U002': admin2Token, 'U003': admin3Token };
        const assignedToken = adminTokenMap[assignedAdmin];

        try {
            await axios.put(
                `${BASE_URL}/password-recovery/${recoveryId}/reset-password`,
                {},
                auth(assignedToken)
            );
            throw new Error('Should have been rejected');
        } catch (err) {
            assert(err.response?.status === 400, `Expected 400, got ${err.response?.status}`);
        }
    });

    // ---------------------------------------------------------------
    // 14. CANNOT UPDATE ALREADY PROCESSED REQUEST
    // ---------------------------------------------------------------
    await test('Cannot update already processed request', async () => {
        try {
            await axios.put(
                `${BASE_URL}/password-recovery/${recoveryId}`,
                { status: 'Pending', note: 'trying to reopen' },
                auth(admin1Token)
            );
            throw new Error('Should have been rejected');
        } catch (err) {
            assert(err.response?.status === 400, `Expected 400, got ${err.response?.status}`);
        }
    });

    // ---------------------------------------------------------------
    // 15. TWO ADMINS HIT SAME REQUEST SIMULTANEOUSLY
    // ---------------------------------------------------------------
    await test('Two admins cannot both process same request simultaneously', async () => {
        const newReq = await axios.post(`${BASE_URL}/password-recovery`, {}, auth(victimToken));
        const freshId = newReq.data.Recovery_id;
        const freshAssigned = newReq.data.assigned_admin;
        console.log(`   → Fresh recovery ID: ${freshId} | Assigned: ${freshAssigned}`);

        const adminTokenMap = { 'U001': admin1Token, 'U002': admin2Token, 'U003': admin3Token };
        const assignedToken = adminTokenMap[freshAssigned];

        const [res1, res2] = await Promise.allSettled([
            axios.put(`${BASE_URL}/password-recovery/${freshId}/reset-password`, {}, auth(assignedToken)),
            axios.put(`${BASE_URL}/password-recovery/${freshId}/reset-password`, {}, auth(assignedToken))
        ]);

        const statuses = [res1, res2].map(r =>
            r.status === 'fulfilled' ? r.value.status : r.reason.response?.status
        );
        console.log(`   → Response statuses: ${statuses}`);

        const successes = statuses.filter(s => s === 200).length;
        const failures  = statuses.filter(s => s === 400).length;
        assert(successes === 1, `Expected exactly 1 success, got ${successes}`);
        assert(failures  === 1, `Expected exactly 1 failure, got ${failures}`);
    });

    // ---------------------------------------------------------------
    // 16. ROUND ROBIN ASSIGNS DIFFERENT ADMINS
    // ---------------------------------------------------------------
    await test('Round robin assigns different admins to consecutive requests', async () => {
        const r1 = await axios.post(`${BASE_URL}/password-recovery`, {}, auth(victimToken));
        const r2 = await axios.post(`${BASE_URL}/password-recovery`, {}, auth(victimToken));
        const r3 = await axios.post(`${BASE_URL}/password-recovery`, {}, auth(victimToken));
        const assigned = [r1.data.assigned_admin, r2.data.assigned_admin, r3.data.assigned_admin];
        console.log(`   → Assigned admins: ${assigned.join(', ')}`);
        const unique = new Set(assigned).size;
        assert(unique > 1, `Round robin not working — all 3 went to same admin`);
    });

    // ---------------------------------------------------------------
    // 17. ADMIN DELETES A REQUEST
    // ---------------------------------------------------------------
    await test('Admin deletes a recovery request', async () => {
        const newReq = await axios.post(`${BASE_URL}/password-recovery`, {}, auth(victimToken));
        const res = await axios.delete(
            `${BASE_URL}/password-recovery/${newReq.data.Recovery_id}`,
            auth(admin1Token)
        );
        assert(res.status === 200, `Expected 200, got ${res.status}`);
    });

    // ---------------------------------------------------------------
    // 18. RESET WITH CUSTOM STATUS PENDING
    // ---------------------------------------------------------------
    await test('Assigned admin can reset with custom status Pending', async () => {
        const newReq = await axios.post(`${BASE_URL}/password-recovery`, {}, auth(victimToken));
        const freshAssigned = newReq.data.assigned_admin;
        const adminTokenMap = { 'U001': admin1Token, 'U002': admin2Token, 'U003': admin3Token };
        const assignedToken = adminTokenMap[freshAssigned];

        const res = await axios.put(
            `${BASE_URL}/password-recovery/${newReq.data.Recovery_id}/reset-password`,
            { status: 'Pending', note: 'Reset but keeping pending for review' },
            auth(assignedToken)
        );
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.data.new_password, 'No new_password in response');
        console.log(`   → New password issued with custom status: ${res.data.new_password}`);
    });

    console.log('\n--- All password recovery tests complete ---\n');
}

runTests();