// test-register.js
const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

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

    console.log('\n--- REGISTRATION TESTS ---\n');

    // ---------------------------------------------------------------
    // R1. SUCCESSFUL REGISTRATION
    // ---------------------------------------------------------------
    await test('User registers successfully', async () => {
        const res = await axios.post(`${BASE_URL}/auth/register`, {
            Name: 'Test User',
            Email: 'testuser123@wps.com',
            Phone_no: '03001234567',
            Address: '123 Test Street, Lahore',
            Password: 'Test@1234',
            Date_of_Birth: '2000-01-01',
            Emergency_contact: '03009876543',
            CNIC: '3520111111999'
        });
        assert(res.status === 201, `Expected 201, got ${res.status}`);
        assert(res.data.token, 'No token in response');
        assert(res.data.user_id, 'No user_id in response');
        console.log(`   → Registered user: ${res.data.user_id}`);
    });

    // ---------------------------------------------------------------
    // R2. DUPLICATE EMAIL REJECTED
    // ---------------------------------------------------------------
    await test('Duplicate email is rejected', async () => {
        try {
            await axios.post(`${BASE_URL}/auth/register`, {
                Name: 'Test User 2',
                Email: 'testuser123@wps.com',
                Phone_no: '03001234568',
                Address: '123 Test Street, Lahore',
                Password: 'Test@1234',
                Date_of_Birth: '2000-01-01',
                Emergency_contact: '03009876543',
                CNIC: '3520111111998'
            });
            throw new Error('Should have been rejected');
        } catch (err) {
            assert(err.response?.status === 400, `Expected 400, got ${err.response?.status}`);
        }
    });

    // ---------------------------------------------------------------
    // R3. DUPLICATE CNIC REJECTED
    // ---------------------------------------------------------------
    await test('Duplicate CNIC is rejected', async () => {
        try {
            await axios.post(`${BASE_URL}/auth/register`, {
                Name: 'Test User 3',
                Email: 'testuser456@wps.com',
                Phone_no: '03001234569',
                Address: '123 Test Street, Lahore',
                Password: 'Test@1234',
                Date_of_Birth: '2000-01-01',
                Emergency_contact: '03009876543',
                CNIC: '3520111111999'
            });
            throw new Error('Should have been rejected');
        } catch (err) {
            assert(err.response?.status === 400, `Expected 400, got ${err.response?.status}`);
        }
    });

    // ---------------------------------------------------------------
    // R4. WEAK PASSWORD REJECTED
    // ---------------------------------------------------------------
    await test('Weak password is rejected', async () => {
        try {
            await axios.post(`${BASE_URL}/auth/register`, {
                Name: 'Test User 4',
                Email: 'testuser789@wps.com',
                Phone_no: '03001234570',
                Address: '123 Test Street, Lahore',
                Password: 'weakpassword',
                Date_of_Birth: '2000-01-01',
                Emergency_contact: '03009876543',
                CNIC: '3520111111997'
            });
            throw new Error('Should have been rejected');
        } catch (err) {
            assert(err.response?.status === 400, `Expected 400, got ${err.response?.status}`);
        }
    });

    // ---------------------------------------------------------------
    // R5. MISSING FIELDS REJECTED
    // ---------------------------------------------------------------
    await test('Missing fields are rejected', async () => {
        try {
            await axios.post(`${BASE_URL}/auth/register`, {
                Name: 'Test User 5',
                Email: 'testuser000@wps.com'
            });
            throw new Error('Should have been rejected');
        } catch (err) {
            assert(err.response?.status === 400, `Expected 400, got ${err.response?.status}`);
        }
    });

    // ---------------------------------------------------------------
    // R6. INVALID CNIC REJECTED
    // ---------------------------------------------------------------
    await test('Invalid CNIC format is rejected', async () => {
        try {
            await axios.post(`${BASE_URL}/auth/register`, {
                Name: 'Test User 6',
                Email: 'testuser111@wps.com',
                Phone_no: '03001234571',
                Address: '123 Test Street, Lahore',
                Password: 'Test@1234',
                Date_of_Birth: '2000-01-01',
                Emergency_contact: '03009876543',
                CNIC: '123'
            });
            throw new Error('Should have been rejected');
        } catch (err) {
            assert(err.response?.status === 400, `Expected 400, got ${err.response?.status}`);
        }
    });

    // ---------------------------------------------------------------
    // R7. INVALID PHONE NUMBER REJECTED
    // ---------------------------------------------------------------
    await test('Invalid phone number is rejected', async () => {
        try {
            await axios.post(`${BASE_URL}/auth/register`, {
                Name: 'Test User 7',
                Email: 'testuser222@wps.com',
                Phone_no: '123',
                Address: '123 Test Street, Lahore',
                Password: 'Test@1234',
                Date_of_Birth: '2000-01-01',
                Emergency_contact: '03009876543',
                CNIC: '3520111111996'
            });
            throw new Error('Should have been rejected');
        } catch (err) {
            assert(err.response?.status === 400, `Expected 400, got ${err.response?.status}`);
        }
    });

    // ---------------------------------------------------------------
    // R8. INVALID EMAIL REJECTED
    // ---------------------------------------------------------------
    await test('Invalid email format is rejected', async () => {
        try {
            await axios.post(`${BASE_URL}/auth/register`, {
                Name: 'Test User 8',
                Email: 'notanemail',
                Phone_no: '03001234572',
                Address: '123 Test Street, Lahore',
                Password: 'Test@1234',
                Date_of_Birth: '2000-01-01',
                Emergency_contact: '03009876543',
                CNIC: '3520111111995'
            });
            throw new Error('Should have been rejected');
        } catch (err) {
            assert(err.response?.status === 400, `Expected 400, got ${err.response?.status}`);
        }
    });

    console.log('\n--- All registration tests complete ---\n');
}

runTests();