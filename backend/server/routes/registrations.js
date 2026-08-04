const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Register for an event
router.post('/', authenticateToken, async (req, res) => {
    if (req.user.role === 'admin') {
        return res.status(403).json({ message: 'Only students can register for the events. Admin can only manage and edit the events.' });
    }
    const { event_id, ticket_type } = req.body;
    const user_id = req.user.id;

    try {
        // 1. Check if already registered
        const [existing] = await db.execute(
            'SELECT * FROM registrations WHERE user_id = ? AND event_id = ?',
            [user_id, event_id]
        );
        if (existing.length > 0) {
            return res.status(400).json({ message: 'You are already registered for this event.' });
        }

        // 2. Check event details
        const [eventData] = await db.execute('SELECT * FROM events WHERE id = ?', [event_id]);
        if (eventData.length === 0) {
            return res.status(404).json({ message: 'Event not found.' });
        }

        const event = eventData[0];

        // Check Deadline
        if (event.registration_deadline) {
            const deadline = new Date(event.registration_deadline);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (today > deadline) {
                return res.status(400).json({ message: 'Registration deadline has passed for this event.' });
            }
        }

        const [regCount] = await db.execute('SELECT COUNT(*) as count FROM registrations WHERE event_id = ? AND payment_status = \'paid\'', [event_id]);

        if (regCount[0].count >= event.capacity) {
            return res.status(400).json({ message: 'Event reached maximum capacity.' });
        }

        // Calculate amount based on ticket type
        let amount = 0;
        if (event.category === 'paid') {
            if (ticket_type === 'student') amount = event.price_student;
            else amount = event.price_regular;
        }

        // 3. Register - ONLY for free events
        // Paid events are handled by PaymentController after verification
        if (event.category === 'paid') {
            return res.status(400).json({ message: 'This is a paid event. Please register via the payment gateway.' });
        }

        const [result] = await db.execute(
            'INSERT INTO registrations (user_id, event_id, ticket_type, amount, payment_status) VALUES (?, ?, ?, ?, ?)',
            [user_id, event_id, ticket_type || 'regular', 0, 'paid']
        );

        res.status(201).json({ 
            message: 'Registered successfully!',
            registration_id: result.insertId,
            category: 'free'
        });

    } catch (err) {
        console.error('Registration Error:', err);
        res.status(500).json({ 
            message: 'Server error during registration', 
            error: err.message,
            sql: err.sql
        });
    }
});

// Get user registrations
router.get('/my-registrations', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT r.id as reg_id, e.id as event_id, r.registration_date, r.ticket_type, r.payment_status, r.check_in_status, r.amount,
                   e.title, e.description, e.event_date, e.event_time, e.location, e.capacity, e.image_url, e.status, e.category
            FROM registrations r 
            JOIN events e ON r.event_id = e.id 
            WHERE r.user_id = ?
            ORDER BY e.event_date ASC
        `, [req.user.id]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Admin-only deletion of ANY registration
router.delete('/admin/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [result] = await db.execute('DELETE FROM registrations WHERE id = ?', [req.params.id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Registration not found or already deleted.' });
        }

        res.json({ message: 'Registration deleted successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Admin-only: Remove specific student from specific event (Roster management)
router.delete('/admin/:eventId/:studentId', authenticateToken, isAdmin, async (req, res) => {
    const { eventId, studentId } = req.params;
    try {
        const [result] = await db.execute(
            'DELETE FROM registrations WHERE event_id = ? AND user_id = ?',
            [eventId, studentId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Registration record not found.' });
        }

        res.json({ message: 'Student removed from event successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Cancel registration
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        await db.execute('DELETE FROM registrations WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        res.json({ message: 'Registration cancelled.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get individual ticket details for QR generation
router.get('/ticket/:id', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT r.id as reg_id, r.ticket_type, r.amount, r.payment_status, r.transaction_id,
                   e.title as event_title, e.event_date, e.event_time, e.location,
                   u.fullname as user_name, u.email as user_email
            FROM registrations r
            JOIN events e ON r.event_id = e.id
            JOIN users u ON r.user_id = u.id
            WHERE r.id = ? AND r.user_id = ?
        `, [req.params.id, req.user.id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Ticket not found or access denied.' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all registrations for an event (Admin only)
router.get('/event/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT r.id as reg_id, u.id as user_id, r.registration_date, u.fullname, u.email, u.faculty 
            FROM registrations r 
            JOIN users u ON r.user_id = u.id 
            WHERE r.event_id = ? AND r.payment_status = 'paid'
        `, [req.params.id]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get unique students who have registered (Admin only) — sorted by latest registration
router.get('/unique-students', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT u.id as user_id, u.fullname as student_name, u.faculty,
                   MAX(r.registration_date) as last_registered
            FROM registrations r
            JOIN users u ON r.user_id = u.id
            GROUP BY u.id, u.fullname, u.faculty
            ORDER BY last_registered DESC
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all events registered by a specific student (Admin only)
router.get('/by-student/:userId', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT e.title as event_name, e.event_date, e.location, r.registration_date
            FROM registrations r
            JOIN events e ON r.event_id = e.id
            WHERE r.user_id = ?
            ORDER BY r.registration_date DESC
        `, [req.params.userId]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all registrations grouped by student (Admin only)
router.get('/grouped', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT 
                r.id as reg_id,
                u.id as user_id,
                u.fullname as student_name,
                u.faculty,
                e.title as event_name,
                r.registration_date
            FROM registrations r
            JOIN users u ON r.user_id = u.id
            JOIN events e ON r.event_id = e.id
            WHERE r.payment_status = 'paid'
            ORDER BY 
                (SELECT MAX(r2.registration_date) FROM registrations r2 WHERE r2.user_id = u.id) DESC,
                u.id,
                r.registration_date DESC
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});



// Get all registrations across all events (Admin only)
router.get('/all', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT u.fullname as student_name, u.faculty, e.title as event_title, r.registration_date
            FROM registrations r
            JOIN users u ON r.user_id = u.id
            JOIN events e ON r.event_id = e.id
            WHERE r.payment_status = 'paid'
            ORDER BY r.registration_date DESC
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
