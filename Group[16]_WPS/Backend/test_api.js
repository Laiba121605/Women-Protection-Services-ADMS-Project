// test_api.js
// HOW TO RUN:  npm install axios && node test_api.js
// REQUIREMENTS: Backend on http://localhost:5000, DB freshly seeded
// No mysql2 needed — seed already sets U001=Yes, U002=No, U003=Yes
//
// SEED FACTS:
//   U001 Admin Sara    Availability=Yes  PR006(Pending) PR009(Pending)
//   U002 Admin Ali     Availability=No   PR007(Pending) PR010(Pending)
//   U003 Admin Fatima  Availability=Yes  PR008(Pending)
//   U004-U008 Dispatchers  Availability=Yes  NOT in Victim table
//   U009-U018 Volunteers   Availability=Yes  NOT in Victim table
//   U019-U040 ALL in Victim table
//   U020 and U039 have no Password_Recovery records in seed

const axios = require('axios');
const BASE = 'http://localhost:5000/api';

const SEED = {
    victim:      { id: 'U019', email: 'victim.zara@wps.com',       pw: 'Test@1234' },
    victim2:     { id: 'U020', email: 'victim.nadia@wps.com',      pw: 'Test@1234' },
    victim39:    { id: 'U039', email: 'victim.asma@wps.com',       pw: 'Test@1234' },
    volunteer:   { id: 'U009', email: 'vol.ayesha@wps.com',        pw: 'Test@1234' },
    admin1:      { id: 'U001', email: 'admin.sara@wps.com',         pw: 'Test@1234' },
    admin2:      { id: 'U002', email: 'admin.ali@wps.com',          pw: 'Test@1234' },
    admin3:      { id: 'U003', email: 'admin.fatima@wps.com',       pw: 'Test@1234' },
    dispatcher:  { id: 'U004', email: 'dispatcher.hina@wps.com',   pw: 'Test@1234' },
    dispatcher2: { id: 'U005', email: 'dispatcher.omar@wps.com',   pw: 'Test@1234' },
};

let passed = 0, failed = 0;

async function run(label, fn) {
    try { await fn(); console.log(`  ✅  ${label}`); passed++; }
    catch (e) { console.log(`  ❌  ${label}\n       → ${e.message}`); failed++; }
}

function expect(cond, msg) { if (!cond) throw new Error(msg); }

async function mustPass(method, path, data, token) {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await axios({ method, url: BASE + path, data, headers, validateStatus: () => true });
    expect(res.status >= 200 && res.status < 300, `Expected 2xx, got ${res.status}: ${JSON.stringify(res.data)}`);
    return res.data;
}

async function mustFail(expectedStatus, method, path, data, token) {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await axios({ method, url: BASE + path, data, headers, validateStatus: () => true });
    expect(res.status === expectedStatus, `Expected ${expectedStatus}, got ${res.status}: ${JSON.stringify(res.data)}`);
    return res.data;
}

async function loginUser(id, pw) {
    const res = await axios.post(`${BASE}/auth/login`, { user_id: id, password: pw });
    return res.data.token;
}

let victimToken, volunteerToken, admin1Token, admin2Token, admin3Token, dispatcherToken;
let recoveryId;

// ── Section 1: Login ─────────────────────────────────────────────────────────
async function section_login() {
    console.log('\n── Section 1: Login ──────────────────────────────────────────');
    await run('Victim (U019) login succeeds', async () => { victimToken = await loginUser(SEED.victim.id, SEED.victim.pw); expect(victimToken, 'no token'); });
    await run('Volunteer (U009) login succeeds', async () => { volunteerToken = await loginUser(SEED.volunteer.id, SEED.volunteer.pw); expect(volunteerToken, 'no token'); });
    await run('Admin1 (U001, Availability=Yes) login succeeds', async () => { admin1Token = await loginUser(SEED.admin1.id, SEED.admin1.pw); expect(admin1Token, 'no token'); });
    await run('Admin2 (U002, Availability=No) login succeeds', async () => { admin2Token = await loginUser(SEED.admin2.id, SEED.admin2.pw); expect(admin2Token, 'no token'); });
    await run('Admin3 (U003, Availability=Yes) login succeeds', async () => { admin3Token = await loginUser(SEED.admin3.id, SEED.admin3.pw); expect(admin3Token, 'no token'); });
    await run('Dispatcher (U004) login succeeds', async () => { dispatcherToken = await loginUser(SEED.dispatcher.id, SEED.dispatcher.pw); expect(dispatcherToken, 'no token'); });
    await run('FAIL — wrong password', async () => { await mustFail(401, 'post', '/auth/login', { user_id: SEED.victim.id, password: 'WrongPass@1' }); });
    await run('FAIL — unknown user_id', async () => { await mustFail(404, 'post', '/auth/login', { user_id: 'DOESNOTEXIST', password: 'Test@1234' }); });
}

// ── Section 2: Public /forgot ─────────────────────────────────────────────────
async function section_forgot() {
    console.log('\n── Section 2: POST /password-recovery/forgot (public) ────────');
    // U020 has no existing PR record — will be assigned to U001 or U003 (round-robin)
    await run('PASS — valid user_id + email (U020, no existing PR record)', async () => {
        const d = await mustPass('post', '/password-recovery/forgot', { user_id: SEED.victim2.id, email: SEED.victim2.email });
        expect(d.recovery_id, 'No recovery_id in response');
    });
    await run('FAIL — duplicate pending request (U020 just submitted above)', async () => {
        await mustFail(400, 'post', '/password-recovery/forgot', { user_id: SEED.victim2.id, email: SEED.victim2.email });
    });
    await run('FAIL — missing user_id', async () => { await mustFail(400, 'post', '/password-recovery/forgot', { email: SEED.victim.email }); });
    await run('FAIL — missing email', async () => { await mustFail(400, 'post', '/password-recovery/forgot', { user_id: SEED.victim.id }); });
    await run('FAIL — wrong email for this user_id', async () => { await mustFail(404, 'post', '/password-recovery/forgot', { user_id: SEED.victim.id, email: 'wrong@email.com' }); });
    await run('FAIL — non-existent user_id', async () => { await mustFail(404, 'post', '/password-recovery/forgot', { user_id: 'ZZZZZZ', email: 'nobody@wps.com' }); });
}

// ── Section 3: Logged-in create ───────────────────────────────────────────────
async function section_recovery_create() {
    console.log('\n── Section 3: POST /password-recovery (logged in) ────────────');
    await run('PASS — victim (U039) creates recovery request', async () => {
        const tok = await loginUser(SEED.victim39.id, SEED.victim39.pw);
        const d = await mustPass('post', '/password-recovery', {}, tok);
        recoveryId = d.Recovery_id;
        expect(recoveryId, 'No Recovery_id in response');
    });
    await run('PASS — volunteer (U009) creates recovery request', async () => {
        const d = await mustPass('post', '/password-recovery', {}, volunteerToken);
        expect(d.Recovery_id, 'No Recovery_id in response');
    });
    await run('FAIL — admin cannot create recovery request (wrong role)', async () => { await mustFail(403, 'post', '/password-recovery', {}, admin1Token); });
    await run('FAIL — no token provided', async () => { await mustFail(401, 'post', '/password-recovery', {}); });
}

// ── Section 4: Admin CRUD ─────────────────────────────────────────────────────
async function section_recovery_admin() {
    console.log('\n── Section 4: Admin CRUD on /password-recovery ───────────────');

    await run('PASS — admin views all recovery requests', async () => {
        const d = await mustPass('get', '/password-recovery', null, admin1Token);
        expect(Array.isArray(d) && d.length > 0, 'Expected non-empty array');
    });

    await run('PASS — assigned admin resets password (U001 or U003 owns recoveryId)', async () => {
        expect(recoveryId, 'recoveryId undefined — section 3 must pass first');
        let done = false;
        for (const tok of [admin1Token, admin3Token]) {
            const res = await axios({ method: 'put', url: `${BASE}/password-recovery/${recoveryId}/reset-password`, data: { note: 'Test reset' }, headers: { Authorization: `Bearer ${tok}` }, validateStatus: () => true });
            if (res.status === 200) { expect(res.data.new_password, 'No new_password'); done = true; break; }
        }
        expect(done, `Neither U001 nor U003 could reset ${recoveryId}`);
    });

    await run('FAIL — reset same request again (already Processed)', async () => {
        expect(recoveryId, 'recoveryId undefined');
        let got400 = false;
        for (const tok of [admin1Token, admin3Token]) {
            const res = await axios({ method: 'put', url: `${BASE}/password-recovery/${recoveryId}/reset-password`, data: {}, headers: { Authorization: `Bearer ${tok}` }, validateStatus: () => true });
            if (res.status === 400) { got400 = true; break; }
        }
        expect(got400, `Expected 400 for already-processed ${recoveryId}`);
    });

    await run('PASS — U001 updates note on PR006 (assigned to U001, Pending)', async () => {
        await mustPass('put', '/password-recovery/PR006', { note: 'Updated by test' }, admin1Token);
    });
    await run('FAIL — non-admin cannot update request', async () => { await mustFail(403, 'put', '/password-recovery/PR006', { note: 'hack' }, victimToken); });
    await run('FAIL — invalid status value', async () => { await mustFail(400, 'put', '/password-recovery/PR006', { status: 'BadStatus' }, admin1Token); });
    await run('PASS — victim views own recovery requests', async () => {
        const d = await mustPass('get', '/password-recovery/my-requests', null, victimToken);
        expect(Array.isArray(d), 'Expected array');
    });
    await run('FAIL — admin cannot call my-requests (wrong role)', async () => { await mustFail(403, 'get', '/password-recovery/my-requests', null, admin1Token); });
    await run('PASS — U003 deletes PR008 (assigned to U003, Pending)', async () => { await mustPass('delete', '/password-recovery/PR008', null, admin3Token); });
    await run('FAIL — delete non-existent request', async () => { await mustFail(404, 'delete', '/password-recovery/DOESNOTEXIST', null, admin1Token); });
    await run('FAIL — non-admin cannot delete', async () => { await mustFail(403, 'delete', '/password-recovery/PR009', null, victimToken); });
}

// ── Section 5: Public Emergency — Victim ──────────────────────────────────────
async function section_emergency_victim() {
    console.log('\n── Section 5: POST /victim/emergency (Victim, public) ────────');
    const v = { user_id: SEED.victim.id, email: SEED.victim.email, note: 'I am in danger at home please help', location: 'House 9, Safe Street, Gulberg, Lahore' };
    await run('PASS — registered victim submits emergency', async () => { const d = await mustPass('post', '/victim/emergency', v); expect(d.request_id, 'no request_id'); });
    await run('FAIL — missing note', async () => { const { note, ...r } = v; await mustFail(400, 'post', '/victim/emergency', r); });
    await run('FAIL — note too short', async () => { await mustFail(400, 'post', '/victim/emergency', { ...v, note: 'hi' }); });
    await run('FAIL — missing location', async () => { const { location, ...r } = v; await mustFail(400, 'post', '/victim/emergency', r); });
    await run('FAIL — location too short', async () => { await mustFail(400, 'post', '/victim/emergency', { ...v, location: 'Lahore' }); });
    await run('FAIL — wrong email', async () => { await mustFail(404, 'post', '/victim/emergency', { ...v, email: 'wrong@email.com' }); });
    await run('FAIL — missing user_id', async () => { const { user_id, ...r } = v; await mustFail(400, 'post', '/victim/emergency', r); });
    // U005 has User account but is NOT in Victim table — tests auto-register path
    const nv = { user_id: SEED.dispatcher2.id, email: SEED.dispatcher2.email, note: 'Need help right now attacker outside door', location: 'House 24, Centre Road, Model Town, Lahore' };
    await run('FAIL — not yet a victim, missing emergency_contact', async () => { await mustFail(400, 'post', '/victim/emergency', nv); });
    await run('FAIL — not yet a victim, emergency_contact has letters', async () => { await mustFail(400, 'post', '/victim/emergency', { ...nv, emergency_contact: 'abcdefghij' }); });
    await run('FAIL — not yet a victim, emergency_contact wrong prefix', async () => { await mustFail(400, 'post', '/victim/emergency', { ...nv, emergency_contact: '04001234567' }); });
    await run('FAIL — not yet a victim, emergency_contact too short', async () => { await mustFail(400, 'post', '/victim/emergency', { ...nv, emergency_contact: '0300123' }); });
}

// ── Section 6: Public Emergency — Volunteer ───────────────────────────────────
async function section_emergency_volunteer() {
    console.log('\n── Section 6: POST /victim/emergency/volunteer (public) ──────');
    const v = { user_id: SEED.volunteer.id, email: SEED.volunteer.email, note: 'I am being threatened and need immediate help now', location: 'House 5, Help Avenue, Gulberg, Lahore' };
    await run('PASS — volunteer submits (auto-registers as Victim, reuses Emergency_contact)', async () => { const d = await mustPass('post', '/victim/emergency/volunteer', v); expect(d.request_id, 'no request_id'); });
    await run('PASS — same volunteer submits again (already in Victim table)', async () => { const d = await mustPass('post', '/victim/emergency/volunteer', v); expect(d.request_id, 'no request_id'); });
    await run('FAIL — missing note', async () => { const { note, ...r } = v; await mustFail(400, 'post', '/victim/emergency/volunteer', r); });
    await run('FAIL — note too short', async () => { await mustFail(400, 'post', '/victim/emergency/volunteer', { ...v, note: 'sos' }); });
    await run('FAIL — location too short', async () => { await mustFail(400, 'post', '/victim/emergency/volunteer', { ...v, location: 'Home' }); });
    await run('FAIL — wrong email', async () => { await mustFail(404, 'post', '/victim/emergency/volunteer', { ...v, email: 'notme@wps.com' }); });
    await run('FAIL — non-volunteer on this endpoint (victim U019)', async () => {
        await mustFail(403, 'post', '/victim/emergency/volunteer', { user_id: SEED.victim.id, email: SEED.victim.email, note: 'I need help right now at home please', location: 'House 9, Safe Street, Gulberg, Lahore' });
    });
}

// ── Section 7: Public Emergency — Admin ───────────────────────────────────────
async function section_emergency_admin() {
    console.log('\n── Section 7: POST /victim/emergency/admin (public) ──────────');
    const b = { user_id: SEED.admin1.id, email: SEED.admin1.email, note: 'There is an attacker outside my office building right now', location: 'Block 12, Admin Block, Model Town, Lahore' };
    await run('FAIL — admin not yet a victim, missing emergency_contact', async () => { await mustFail(400, 'post', '/victim/emergency/admin', b); });
    await run('FAIL — emergency_contact does not start with 03', async () => { await mustFail(400, 'post', '/victim/emergency/admin', { ...b, emergency_contact: '04001234567' }); });
    await run('FAIL — emergency_contact has letters', async () => { await mustFail(400, 'post', '/victim/emergency/admin', { ...b, emergency_contact: '0300abcdefg' }); });
    await run('FAIL — emergency_contact too short', async () => { await mustFail(400, 'post', '/victim/emergency/admin', { ...b, emergency_contact: '03001' }); });
    await run('PASS — admin submits with valid emergency_contact (auto-registers as Victim)', async () => { const d = await mustPass('post', '/victim/emergency/admin', { ...b, emergency_contact: '03001234501' }); expect(d.request_id, 'no request_id'); });
    await run('PASS — same admin submits again (already a Victim, no emergency_contact needed)', async () => { const d = await mustPass('post', '/victim/emergency/admin', b); expect(d.request_id, 'no request_id'); });
    await run('FAIL — non-admin on this endpoint (victim U019)', async () => { await mustFail(403, 'post', '/victim/emergency/admin', { user_id: SEED.victim.id, email: SEED.victim.email, note: 'I need help right now please hurry', location: 'House 9, Safe Street, Gulberg, Lahore' }); });
    await run('FAIL — note too short', async () => { await mustFail(400, 'post', '/victim/emergency/admin', { ...b, note: 'hey' }); });
    await run('FAIL — location too short', async () => { await mustFail(400, 'post', '/victim/emergency/admin', { ...b, location: 'Lahore' }); });
    await run('FAIL — wrong email', async () => { await mustFail(404, 'post', '/victim/emergency/admin', { ...b, email: 'fake@wps.com' }); });
}

// ── Section 8: Public Emergency — Dispatcher ──────────────────────────────────
async function section_emergency_dispatcher() {
    console.log('\n── Section 8: POST /victim/emergency/dispatcher (public) ─────');
    const b = { user_id: SEED.dispatcher.id, email: SEED.dispatcher.email, note: 'Someone is following me after my shift ended tonight', location: 'House 22, Centre Road, Gulberg, Lahore' };
    await run('FAIL — dispatcher not yet a victim, missing emergency_contact', async () => { await mustFail(400, 'post', '/victim/emergency/dispatcher', b); });
    await run('FAIL — emergency_contact does not start with 03', async () => { await mustFail(400, 'post', '/victim/emergency/dispatcher', { ...b, emergency_contact: '04009876543' }); });
    await run('FAIL — emergency_contact has letters', async () => { await mustFail(400, 'post', '/victim/emergency/dispatcher', { ...b, emergency_contact: '0300xxxxxxx' }); });
    await run('FAIL — emergency_contact too long (12 digits)', async () => { await mustFail(400, 'post', '/victim/emergency/dispatcher', { ...b, emergency_contact: '030012345678' }); });
    await run('PASS — dispatcher submits with valid emergency_contact (auto-registers as Victim)', async () => {
        const d = await mustPass('post', '/victim/emergency/dispatcher', { ...b, emergency_contact: '03001234502' });
        expect(d.request_id, 'no request_id');
        expect(d.message.toLowerCase().includes('dispatcher'), 'Expected dispatcher-specific message');
    });
    await run('PASS — same dispatcher submits again (already a Victim, no emergency_contact needed)', async () => { const d = await mustPass('post', '/victim/emergency/dispatcher', b); expect(d.request_id, 'no request_id'); });
    await run('FAIL — non-dispatcher on this endpoint (victim U019)', async () => { await mustFail(403, 'post', '/victim/emergency/dispatcher', { user_id: SEED.victim.id, email: SEED.victim.email, note: 'I need help right now at home please', location: 'House 9, Safe Street, Gulberg III, Lahore' }); });
    await run('FAIL — non-dispatcher on this endpoint (volunteer U009)', async () => { await mustFail(403, 'post', '/victim/emergency/dispatcher', { user_id: SEED.volunteer.id, email: SEED.volunteer.email, note: 'Someone is attacking me right now please help', location: 'House 5, Help Avenue, Gulberg, Lahore' }); });
    await run('FAIL — note too short', async () => { await mustFail(400, 'post', '/victim/emergency/dispatcher', { ...b, note: 'sos' }); });
    await run('FAIL — location too short', async () => { await mustFail(400, 'post', '/victim/emergency/dispatcher', { ...b, location: 'Near shop' }); });
    await run('FAIL — wrong email', async () => { await mustFail(404, 'post', '/victim/emergency/dispatcher', { ...b, email: 'notme@wps.com' }); });
    await run('FAIL — missing user_id', async () => { const { user_id, ...r } = b; await mustFail(400, 'post', '/victim/emergency/dispatcher', r); });
}

(async () => {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  WPS API Test Suite');
    console.log('  Backend:  http://localhost:5000');
    console.log('  Seed:     U001=Yes  U002=No  U003=Yes  (admin availability)');
    console.log('  Install:  npm install axios');
    console.log('  Run:      node test_api.js');
    console.log('═══════════════════════════════════════════════════════════════');
    await section_login();
    await section_forgot();
    await section_recovery_create();
    await section_recovery_admin();
    await section_emergency_victim();
    await section_emergency_volunteer();
    await section_emergency_admin();
    await section_emergency_dispatcher();
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log(`  Results: ${passed} passed, ${failed} failed`);
    console.log(failed === 0 ? '  All tests passed ✅' : '  Some tests failed ❌ — check output above');
    console.log('═══════════════════════════════════════════════════════════════\n');
    process.exit(failed > 0 ? 1 : 0);
})();