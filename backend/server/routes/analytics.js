const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Get Revenue Dashboard Data
router.get('/revenue', authenticateToken, isAdmin, async (req, res) => {
    try {
        // 1. Total Revenue
        const [revenueRow] = await db.execute(`
            SELECT SUM(p.amount) as total 
            FROM payments p
            INNER JOIN registrations r ON p.transaction_id = r.transaction_id AND r.payment_status = 'paid'
            WHERE p.payment_status = 'paid'
        `);
        const totalRevenue = revenueRow[0].total || 0;

        // 2. Paid Tickets Sold
        const [paidTicketsRow] = await db.execute('SELECT COUNT(*) as count FROM registrations WHERE payment_status = \'paid\' AND amount > 0');
        const paidTicketsSold = paidTicketsRow[0].count;

        // 3. Free Event Registrations
        const [freeRegRow] = await db.execute('SELECT COUNT(*) as count FROM registrations WHERE amount = 0');
        const freeRegistrations = freeRegRow[0].count;

        // 4. Most Profitable Event
        const [profitableEventRow] = await db.execute(`
            SELECT e.title, SUM(p.amount) as revenue
            FROM payments p
            INNER JOIN registrations r ON p.transaction_id = r.transaction_id AND r.payment_status = 'paid'
            JOIN events e ON p.event_id = e.id
            WHERE p.payment_status = 'paid'
            GROUP BY e.id
            ORDER BY revenue DESC
            LIMIT 1
        `);
        const mostProfitableEvent = profitableEventRow[0] || { title: 'N/A', revenue: 0 };

        // 5. Monthly Revenue (Last 6 months)
        const [monthlyRevenue] = await db.execute(`
            SELECT DATE_FORMAT(p.created_at, '%b %Y') as month, SUM(p.amount) as total
            FROM payments p
            INNER JOIN registrations r ON p.transaction_id = r.transaction_id AND r.payment_status = 'paid'
            WHERE p.payment_status = 'paid'
            GROUP BY month
            ORDER BY MIN(p.created_at) DESC
            LIMIT 6
        `);

        // 6. Payment Success vs Failed
        const [statusStats] = await db.execute(`
            SELECT payment_status, COUNT(*) as count
            FROM registrations
            WHERE amount > 0
            GROUP BY payment_status
        `);

        // 7. Recent Transactions
        const [recentTransactions] = await db.execute(`
            SELECT p.*, u.fullname as user_name, e.title as event_title
            FROM payments p
            INNER JOIN registrations r ON p.transaction_id = r.transaction_id AND r.payment_status = 'paid'
            JOIN users u ON p.user_id = u.id
            JOIN events e ON p.event_id = e.id
            WHERE p.payment_status = 'paid'
            ORDER BY p.created_at DESC
            LIMIT 10
        `);

        res.json({
            totalRevenue,
            paidTicketsSold,
            freeRegistrations,
            mostProfitableEvent,
            monthlyRevenue,
            statusStats,
            recentTransactions
        });
    } catch (err) {
        console.error('Analytics Error:', err);
        res.status(500).json({ 
            message: 'Failed to fetch analytics', 
            error: err.message,
            sqlState: err.sqlState
        });
    }
});

// Reset Revenue Analytics (Admin Only)
router.post('/reset', authenticateToken, isAdmin, async (req, res) => {
    try {
        // We delete logs and payments, but we keep registrations to avoid breaking the student dashboard
        // However, we should probably set registrations' amount to 0 or something if we want to "reset" them too
        // But usually "Reset Revenue" means reset the financial history.
        
        await db.execute('DELETE FROM payments');
        await db.execute('DELETE FROM transaction_logs');
        
        // Update registrations to reflect that they are now "reset" (optional but clean)
        // Set amount to 0 and status to pending/reset? 
        // Better: Just reset the financial records. Analytics uses payments table mostly.
        
        res.json({ message: 'Revenue analytics have been reset successfully.' });
    } catch (err) {
        console.error('Reset Error:', err);
        res.status(500).json({ message: 'Failed to reset analytics' });
    }
});

module.exports = router;
