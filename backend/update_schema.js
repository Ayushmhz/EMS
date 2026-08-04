const db = require('./server/db');

async function updateSchema() {
    try {
        console.log('🚀 Starting Database Schema Update...');

        // 1. Update 'events' table
        try {
            await db.execute("ALTER TABLE events ADD COLUMN category ENUM('free', 'paid') DEFAULT 'free'");
            await db.execute("ALTER TABLE events ADD COLUMN price_regular DECIMAL(10,2) DEFAULT 0.00");
            await db.execute("ALTER TABLE events ADD COLUMN price_student DECIMAL(10,2) DEFAULT 0.00");
            console.log('✅ Added category and price columns to events table.');
        } catch (e) {
            console.log('ℹ️ Events table columns might already exist:', e.message);
        }

        // 2. Update 'registrations' table
        try {
            await db.execute("ALTER TABLE registrations ADD COLUMN ticket_type ENUM('regular', 'student') DEFAULT 'regular'");
            await db.execute("ALTER TABLE registrations ADD COLUMN payment_status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending'");
            await db.execute("ALTER TABLE registrations ADD COLUMN check_in_status ENUM('not_checked_in', 'checked_in') DEFAULT 'not_checked_in'");
            await db.execute("ALTER TABLE registrations ADD COLUMN amount DECIMAL(10,2) DEFAULT 0.00");
            await db.execute("ALTER TABLE registrations ADD COLUMN transaction_id VARCHAR(255)");
            console.log('✅ Added ticketing columns to registrations table.');
        } catch (e) {
            console.log('ℹ️ Registrations table columns might already exist:', e.message);
        }

        // 3. Create 'payments' table
        const createPaymentsTable = `
            CREATE TABLE IF NOT EXISTS payments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                event_id INT NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                payment_method VARCHAR(50) NOT NULL,
                transaction_id VARCHAR(255) NOT NULL,
                ticket_type VARCHAR(50) NOT NULL,
                payment_status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
            )
        `;
        await db.execute(createPaymentsTable);
        console.log('✅ Payments table created/verified.');

        console.log('✨ Schema update completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Schema update failed:', err);
        process.exit(1);
    }
}

updateSchema();
