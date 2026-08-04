const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Get ticket details by ID (for automatic name retrieval)
router.get('/ticket/:id', authenticateToken, async (req, res) => {
    const ticketId = req.params.id;
    try {
        const [rows] = await db.execute(`
            SELECT r.id, r.check_in_status, u.fullname as student_name
            FROM registrations r
            JOIN users u ON r.user_id = u.id
            WHERE r.id = ?
        `, [ticketId]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Invalid Ticket ID' });
        }

        res.json({
            success: true,
            ticket: rows[0]
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Verify Attendee by Ticket ID
router.post('/verify', authenticateToken, async (req, res) => {
    const { ticket_id } = req.body;
    const registration_id = ticket_id || req.body.registration_id;

    if (!registration_id) {
        return res.status(400).json({ success: false, message: 'Ticket ID is required' });
    }

    try {
        // Find registration
        const [rows] = await db.execute(`
            SELECT r.*, u.fullname, e.title as event_title, e.event_date
            FROM registrations r
            JOIN users u ON r.user_id = u.id
            JOIN events e ON r.event_id = e.id
            WHERE r.id = ?
        `, [registration_id]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Invalid Ticket ID' });
        }

        const registration = rows[0];

        if (registration.payment_status !== 'paid') {
            return res.status(400).json({ success: false, message: 'Payment Pending or Failed!' });
        }

        if (registration.check_in_status === 'checked_in') {
            return res.status(400).json({ 
                success: false, 
                message: 'This ticket has already been verified and cannot be used again.' 
            });
        }

        // Mark as Checked In (verified)
        await db.execute('UPDATE registrations SET check_in_status = \'checked_in\', check_in_time = NOW() WHERE id = ?', [registration_id]);

        res.json({
            success: true,
            message: 'Ticket Verified Successfully',
            attendee: {
                name: registration.fullname,
                event: registration.event_title,
                ticket: registration.ticket_type
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Verification failed' });
    }
});

module.exports = router;
