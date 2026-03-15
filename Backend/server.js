// server.js
const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const pool = require('./db'); // MySQL pool
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/admin');
const passwordRecoveryRoutes = require('./routes/passwordRecovery');
const dispatcherRoutes = require('./routes/dispatcher');
const volunteerRoutes = require('./routes/volunteer');
const victimRoutes = require('./routes/victim');

dotenv.config();

const app = express();

// Middleware
app.use(bodyParser.json()); // parse JSON bodies

// Test API
app.get('/', (req, res) => {
    res.send('Women Protection Services API is running');
});

// Routes
app.use('/api/auth', authRoutes);         // Login/Register routes
app.use('/api/admin', adminRoutes);       // Admin routes
app.use('/api/dispatcher', dispatcherRoutes); // Dispatcher routes
app.use('/api/password-recovery', passwordRecoveryRoutes);
app.use('/api/volunteer', volunteerRoutes);   // Volunteer routes
app.use('/api/victim', victimRoutes);         // Victim routes

// Error handling for unknown routes
app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
    try {
        // Test DB connection
        const [rows] = await pool.query('SELECT NOW() AS now');
        console.log(`DB Connected! Time: ${rows[0].now}`);
        console.log(`Server running on port ${PORT}`);
    } catch (err) {
        console.error('DB connection failed:', err);
    }
});