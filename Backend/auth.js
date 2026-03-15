// auth.js
// Handles authentication, JWT, password hashing, and role-based authorization

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// ⚠️ CHANGE THIS to a long random secret in production
const JWT_SECRET = 'supersecretkeychangeinproduction';


// ==============================
// 🔒 PASSWORD HASHING
// ==============================

// Hash password before storing in DB
const hashPassword = async (password) => {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
};

// Compare login password with hashed password in DB
const comparePassword = async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
};


// ==============================
// 🔎 VERIFY JWT MIDDLEWARE
// ==============================

const verifyJWT = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(' ')[1]; // Bearer TOKEN

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ message: "Invalid or expired token" });
    }
};


// ==============================
// 🛡 ROLE-BASED ACCESS CONTROL
// ==============================

// ✏️ CHANGE: now checks roles array instead of single role string
const allowRoles = (...allowedRoles) => {
    return (req, res, next) => {
        const userRoles = req.user.roles || [];
        const hasRole = allowedRoles.some(role => userRoles.includes(role));

        if (!hasRole) {
            return res.status(403).json({ message: "Access denied: insufficient permissions" });
        }

        next();
    };
};


// ==============================
// EXPORT EVERYTHING
// ==============================

module.exports = {
    hashPassword,
    comparePassword,
    verifyJWT,
    allowRoles,
    JWT_SECRET
    // ✏️ CHANGE: removed generateToken since JWT is signed directly in authRoutes
};