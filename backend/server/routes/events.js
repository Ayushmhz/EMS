const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');
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
    console.warn('⚠️ Cloudinary environment variables are missing. Image uploads will not work.');
}

// Cloudinary Storage for Event Thumbnails
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'college-events/thumbnails',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp']
    }
});

const upload = multer({ storage: storage });

// Get all events
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT e.*, u.fullname as organizer,
            (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.payment_status = 'paid') as registered_count,
            (SELECT AVG(rating) FROM reviews rev WHERE rev.event_id = e.id) as average_rating,
            (SELECT COUNT(*) FROM reviews rev WHERE rev.event_id = e.id) as review_count
            FROM events e 
            LEFT JOIN users u ON e.created_by = u.id 
            ORDER BY e.event_date ASC, e.event_time ASC
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create event (Admin only)
router.post('/', authenticateToken, isAdmin, upload.single('thumbnail'), async (req, res) => {
    const { 
        title, description, event_date, event_time, location, capacity, registration_deadline,
        category, price_regular, price_student 
    } = req.body;
    const image_url = req.file ? req.file.path : 'https://images.unsplash.com/photo-1540575861501-7ad05823c9f5?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (new Date(event_date) < today) {
        return res.status(400).json({ message: 'Event start date cannot be in the past.' });
    }

    if (registration_deadline) {
        if (new Date(registration_deadline) < today) {
            return res.status(400).json({ message: 'Registration deadline cannot be in the past.' });
        }
    }

    if (registration_deadline && event_date) {
        if (new Date(registration_deadline) >= new Date(event_date)) {
            return res.status(400).json({ message: 'Registration deadline must be earlier than the event start date.' });
        }
    }

    try {
        const [conflicts] = await db.execute(
            'SELECT * FROM events WHERE location = ? AND event_date = ? AND event_time = ?',
            [location, event_date, event_time]
        );

        if (conflicts.length > 0) {
            return res.status(400).json({ message: 'Event conflict!' });
        }

        await db.execute(
            'INSERT INTO events (title, description, event_date, event_time, location, capacity, image_url, registration_deadline, created_by, category, price_regular, price_student) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [title, description, event_date, event_time, location, capacity, image_url, registration_deadline, req.user.id, category || 'free', price_regular || 0, price_student || 0]
        );

        res.status(201).json({ message: 'Event created successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update event (Admin only)
router.put('/:id', authenticateToken, isAdmin, upload.single('thumbnail'), async (req, res) => {
    const { 
        title, description, event_date, event_time, location, capacity, registration_deadline,
        category, price_regular, price_student 
    } = req.body;
    const { id } = req.params;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (new Date(event_date) < today) {
        return res.status(400).json({ message: 'Event start date cannot be in the past.' });
    }

    if (registration_deadline) {
        if (new Date(registration_deadline) < today) {
            return res.status(400).json({ message: 'Registration deadline cannot be in the past.' });
        }
    }

    if (registration_deadline && event_date) {
        if (new Date(registration_deadline) >= new Date(event_date)) {
            return res.status(400).json({ message: 'Registration deadline must be earlier than the event start date.' });
        }
    }

    try {
        // Find existing event to keep old image if no new one uploaded
        const [existing] = await db.execute('SELECT image_url FROM events WHERE id = ?', [id]);
        if (existing.length === 0) return res.status(404).json({ message: 'Event not found' });
        let image_url = existing[0].image_url;

        if (req.file) {
            image_url = req.file.path;
        }

        const [conflicts] = await db.execute(
            'SELECT * FROM events WHERE location = ? AND event_date = ? AND event_time = ? AND id != ?',
            [location, event_date, event_time, id]
        );

        if (conflicts.length > 0) {
            return res.status(400).json({ message: 'Event conflict!' });
        }

        await db.execute(
            'UPDATE events SET title=?, description=?, event_date=?, event_time=?, location=?, capacity=?, image_url=?, registration_deadline=?, category=?, price_regular=?, price_student=? WHERE id=?',
            [title, description, event_date, event_time, location, capacity, image_url, registration_deadline, category, price_regular, price_student, id]
        );

        res.json({ message: 'Event updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete event (Admin only)
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        await db.execute('DELETE FROM events WHERE id = ?', [req.params.id]);
        res.json({ message: 'Event deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// End event (Admin only)
router.patch('/:id/end', authenticateToken, isAdmin, async (req, res) => {
    try {
        await db.execute('UPDATE events SET status = ? WHERE id = ?', ['ended', req.params.id]);
        res.json({ message: 'Event ended successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// --- Reviews and Ratings Feature ---

// Get all reviews for a specific event
router.get('/:eventId/reviews', async (req, res) => {
    const { eventId } = req.params;
    try {
        const [reviews] = await db.execute(`
            SELECT r.*, u.fullname as user_name, u.profile_pic as user_profile_pic 
            FROM reviews r 
            JOIN users u ON r.user_id = u.id 
            WHERE r.event_id = ? 
            ORDER BY r.created_at DESC
        `, [eventId]);

        // Calculate average rating
        const [stats] = await db.execute(`
            SELECT AVG(rating) as average_rating, COUNT(*) as review_count
            FROM reviews
            WHERE event_id = ?
        `, [eventId]);

        res.json({
            reviews,
            average_rating: stats[0].average_rating ? parseFloat(stats[0].average_rating) : null,
            review_count: stats[0].review_count || 0
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error retrieving reviews' });
    }
});

// Submit a review for an event (Students only - registered/paid)
router.post('/:eventId/reviews', authenticateToken, async (req, res) => {
    const { eventId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id;

    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: 'Rating must be between 1 and 5.' });
    }

    try {
        // 1. Check if the user is registered for the event and has paid (or free event registration status 'paid')
        const [registration] = await db.execute(
            'SELECT * FROM registrations WHERE user_id = ? AND event_id = ? AND payment_status = ?',
            [userId, eventId, 'paid']
        );

        if (registration.length === 0) {
            return res.status(403).json({ message: 'You must be registered for this event to leave a review.' });
        }

        // 2. Check if the user has already reviewed the event
        const [existingReview] = await db.execute(
            'SELECT * FROM reviews WHERE user_id = ? AND event_id = ?',
            [userId, eventId]
        );

        if (existingReview.length > 0) {
            return res.status(400).json({ message: 'You have already reviewed this event.' });
        }

        // 3. Insert new review
        await db.execute(
            'INSERT INTO reviews (event_id, user_id, rating, comment) VALUES (?, ?, ?, ?)',
            [eventId, userId, rating, comment || '']
        );

        res.status(201).json({ message: 'Review submitted successfully!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error submitting review' });
    }
});

// Delete a review (Admin or the user who wrote it)
router.delete('/:eventId/reviews/:reviewId', authenticateToken, async (req, res) => {
    const { reviewId } = req.params;
    const userId = req.user.id;
    const userRole = (req.user.role || '').toLowerCase().trim();

    try {
        // Check if review exists
        const [reviewData] = await db.execute('SELECT * FROM reviews WHERE id = ?', [reviewId]);
        if (reviewData.length === 0) {
            return res.status(404).json({ message: 'Review not found.' });
        }

        const review = reviewData[0];

        // Authorization check: admin or author
        if (userRole !== 'admin' && review.user_id !== userId) {
            return res.status(403).json({ message: 'You are not authorized to delete this review.' });
        }

        await db.execute('DELETE FROM reviews WHERE id = ?', [reviewId]);
        res.json({ message: 'Review deleted successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error deleting review' });
    }
});

module.exports = router;
