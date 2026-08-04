const jwt = require('jsonwebtoken');
require('dotenv').config();

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Access denied. No token provided.' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid token.' });
        req.user = user;
        next();
    });
};

const isAdmin = (req, res, next) => {
    const role = (req.user.role || '').toLowerCase().trim();
    if (role !== 'admin') {
        console.warn(`Access Denied for user ${req.user.id}. Role: "${req.user.role}"`);
        return res.status(403).json({ message: `Access Denied: Admin role required. Your role is: ${req.user.role}` });
    }
    next();
};

module.exports = { authenticateToken, isAdmin };
