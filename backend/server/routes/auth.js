const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');
require('dotenv').config();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Cloudinary Configuration
const cloudinaryConfig = {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
};

if (cloudinaryConfig.cloud_name) {
    cloudinary.config(cloudinaryConfig);
} else {
    console.warn('⚠️ Cloudinary environment variables are missing in Auth routes. Profile uploads will not work.');
}

// Cloudinary Storage for Profile Pics
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'college-events/profiles',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp']
    }
});
const upload = multer({ storage: storage });

// Password validation helper
const validatePassword = (password) => {
    if (!password || password.length < 6) {
        return { valid: false, message: "Password must be at least 6 characters long" };
    }

    // Must contain letters and numbers
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (!hasLetter || !hasNumber) {
        return { valid: false, message: "Password must contain both letters and numbers" };
    }

    // Check for common weak passwords
    const commonPasswords = ['123456', '12345678', 'password', 'qwerty', '111111', 'abc123'];
    if (commonPasswords.includes(password.toLowerCase())) {
        return { valid: false, message: "Password is too weak. Please choose a stronger password" };
    }

    // Check for repetitive characters (e.g., "aaaaaa", "111111")
    if (/^(.)\1+$/.test(password)) {
        return { valid: false, message: "Password is too weak. Avoid simple repeating characters" };
    }

    // Check for simple patterns like "ababab" or "121212"
    if (password.length >= 6) {
        const half = password.substring(0, Math.floor(password.length / 2));
        if (password === half + half) {
            return { valid: false, message: "Password is too weak. Avoid simple repetitive patterns" };
        }
    }

    return { valid: true };
};

// TEMPORARY ENVIRONMENT DEBUG ENDPOINT
router.get('/test-env', (req, res) => {
    res.json({
        FRONTEND_URL: process.env.FRONTEND_URL || 'NOT SET',
        BACKEND_URL: process.env.BACKEND_URL || 'NOT SET',
        KHALTI_SECRET_KEY: process.env.KHALTI_SECRET_KEY ? `${process.env.KHALTI_SECRET_KEY.substring(0, 4)}...` : 'NOT SET',
        KHALTI_PUBLIC_KEY: process.env.KHALTI_PUBLIC_KEY ? `${process.env.KHALTI_PUBLIC_KEY.substring(0, 4)}...` : 'NOT SET',
        ESEWA_SECRET_KEY: process.env.ESEWA_SECRET_KEY ? `${process.env.ESEWA_SECRET_KEY.substring(0, 4)}...` : 'NOT SET',
        ESEWA_PRODUCT_CODE: process.env.ESEWA_PRODUCT_CODE || 'NOT SET',
        CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || 'NOT SET',
        CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ? `${process.env.CLOUDINARY_API_KEY.substring(0, 4)}...` : 'NOT SET',
        CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ? `${process.env.CLOUDINARY_API_SECRET.substring(0, 4)}...` : 'NOT SET',
    });
});

// Register
router.post('/register', async (req, res) => {
    const { fullname, email, password, faculty } = req.body;
    const role = 'student';

    // Password validation
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
        return res.status(400).json({ message: passwordCheck.message });
    }

    try {
        const [existingUser] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.execute(
            'INSERT INTO users (fullname, email, password, role, faculty) VALUES (?, ?, ?, ?, ?)',
            [fullname, email, hashedPassword, role, faculty]
        );

        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Role-based Authorization check
        const { requiredRole } = req.body;
        const userRole = (user.role || '').toLowerCase().trim();
        const reqRole = (requiredRole || '').toLowerCase().trim();

        if (requiredRole && userRole !== reqRole) {
            const errorMessage = reqRole === 'admin'
                ? 'Access Denied. Admin access only'
                : 'Please Use Admin Portal';
            return res.status(403).json({ message: errorMessage });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, name: user.fullname },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                name: user.fullname,
                email: user.email,
                role: user.role,
                faculty: user.faculty,
                profile_pic: user.profile_pic || null
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get Current User Info
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const [users] = await db.execute('SELECT id, fullname, email, role, faculty, profile_pic FROM users WHERE id = ?', [req.user.id]);
        if (users.length === 0) return res.status(404).json({ message: 'User not found' });

        const user = users[0];
        res.json({
            ...user,
            profile_pic: user.profile_pic || null
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update Profile
router.post('/update-profile', authenticateToken, upload.single('profile_pic'), async (req, res) => {
    const { fullname, faculty } = req.body;
    const userId = req.user.id;

    let queryParts = [];
    let params = [];

    if (fullname) {
        queryParts.push('fullname = ?');
        params.push(fullname);
    }

    if (faculty !== undefined) {
        queryParts.push('faculty = ?');
        params.push(faculty);
    }

    if (req.file) {
        queryParts.push('profile_pic = ?');
        params.push(req.file.path);
    }

    if (queryParts.length === 0) {
        return res.status(400).json({ message: 'No fields to update' });
    }

    const query = `UPDATE users SET ${queryParts.join(', ')} WHERE id = ?`;
    params.push(userId);

    try {
        await db.execute(query, params);

        let profilePicUrl = undefined;
        if (req.file) {
            profilePicUrl = req.file.path; // Cloudinary returns URL in path
        }

        res.json({
            message: 'Profile updated successfully',
            profile_pic: profilePicUrl
        });
    } catch (err) {
        console.error('Update Profile Error:', err);
        // Special check for missing columns - common in this dev environment
        if (err.code === 'ER_BAD_FIELD_ERROR') {
            return res.status(500).json({ message: 'Database schema mismatch. Please contact admin.' });
        }
        res.status(500).json({ message: 'Server error' });
    }
});

// Change Password
router.post('/change-password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Password validation for new password
    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.valid) {
        return res.status(400).json({ message: passwordCheck.message });
    }

    try {
        const [users] = await db.execute('SELECT password FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, userId]);

        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all students (Admin only)
router.get('/students', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [users] = await db.execute('SELECT id, fullname, email, faculty, created_at FROM users WHERE role = \'student\'');
        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Reset User Password (Admin only)
router.post('/reset-user-password/:userId', authenticateToken, isAdmin, async (req, res) => {
    try {
        const defaultPassword = 'password123';
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);
        await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.params.userId]);
        res.json({ message: `Password reset to: ${defaultPassword}` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete User (Admin only)
router.delete('/:userId', authenticateToken, isAdmin, async (req, res) => {
    try {
        const userId = req.params.userId;
        
        // Prevent admin from deleting themselves
        if (parseInt(userId) === req.user.id) {
            return res.status(400).json({ message: "You cannot delete your own admin account from here." });
        }

        await db.execute('DELETE FROM users WHERE id = ?', [userId]);
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
