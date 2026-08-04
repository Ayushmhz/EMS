const mysql = require('mysql2');
require('dotenv').config();

console.log(`📡 Attempting to connect to DB at: ${process.env.DB_HOST || 'NOT SET'}:${process.env.DB_PORT || '4000'}`);

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 4000,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME || 'test',
    ...(process.env.DB_HOST !== '127.0.0.1' && process.env.DB_HOST !== 'localhost' ? {
        ssl: {
            minVersion: 'TLSv1.2',
            rejectUnauthorized: true
        }
    } : {}),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const promisePool = pool.promise();

// AUTO-MIGRATION LOGIC (Self-Healing Schema)
async function autoMigrate() {
    try {
        console.log('🛡️  Running self-healing schema check...');
        
        // 1. Check Events table
        const [eventCols] = await promisePool.execute('DESCRIBE events');
        const eventFields = eventCols.map(c => c.Field);
        
        if (!eventFields.includes('category')) {
            await promisePool.execute("ALTER TABLE events ADD COLUMN category ENUM('free', 'paid') DEFAULT 'free'");
            console.log('✅ Added category to events');
        }
        if (!eventFields.includes('price_regular')) {
            await promisePool.execute("ALTER TABLE events ADD COLUMN price_regular DECIMAL(10,2) DEFAULT 0.00");
            await promisePool.execute("ALTER TABLE events ADD COLUMN price_student DECIMAL(10,2) DEFAULT 0.00");
            console.log('✅ Added pricing columns to events');
        }
        
        // Cleanup: Remove price_vip if exists
        if (eventFields.includes('price_vip')) {
            await promisePool.execute("ALTER TABLE events DROP COLUMN price_vip");
            console.log('🗑️ Removed price_vip from events');
        }

        // 2. Check Registrations table
        const [regCols] = await promisePool.execute('DESCRIBE registrations');
        const regFields = regCols.map(c => c.Field);

        if (!regFields.includes('ticket_type')) {
            await promisePool.execute("ALTER TABLE registrations ADD COLUMN ticket_type ENUM('regular', 'student') DEFAULT 'regular'");
            console.log('✅ Added ticket_type to registrations');
        } else {
            // Check if VIP is still in ENUM (simplified check by just trying to remove it)
            try {
                // First, convert any existing VIP to regular
                await promisePool.execute("UPDATE registrations SET ticket_type = 'regular' WHERE ticket_type = 'vip'");
                // Then modify the column to remove VIP from ENUM
                await promisePool.execute("ALTER TABLE registrations MODIFY COLUMN ticket_type ENUM('regular', 'student') DEFAULT 'regular'");
                console.log('✅ Removed VIP from registrations ticket_type enum');
            } catch (e) {
                // If it fails, maybe the column is already updated or has other issues, we can log and continue
                console.log('ℹ️ Ticket type enum already updated or skipped');
            }
        }
        if (!regFields.includes('payment_status')) {
            await promisePool.execute("ALTER TABLE registrations ADD COLUMN payment_status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending'");
            console.log('✅ Added payment_status to registrations');
        }
        if (!regFields.includes('amount')) {
            await promisePool.execute("ALTER TABLE registrations ADD COLUMN amount DECIMAL(10,2) DEFAULT 0.00");
            console.log('✅ Added amount to registrations');
        }
        if (!regFields.includes('check_in_status')) {
            await promisePool.execute("ALTER TABLE registrations ADD COLUMN check_in_status ENUM('not_checked_in', 'checked_in') DEFAULT 'not_checked_in'");
            console.log('✅ Added check_in_status to registrations');
        }
        if (!regFields.includes('check_in_time')) {
            await promisePool.execute("ALTER TABLE registrations ADD COLUMN check_in_time TIMESTAMP NULL DEFAULT NULL");
            console.log('✅ Added check_in_time to registrations');
        }
        if (!regFields.includes('transaction_id')) {
            await promisePool.execute("ALTER TABLE registrations ADD COLUMN transaction_id VARCHAR(255)");
            console.log('✅ Added transaction_id to registrations');
        }

        // 3. Check Payments table
        await promisePool.execute(`
            CREATE TABLE IF NOT EXISTS payments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                event_id INT NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                payment_method VARCHAR(50) NOT NULL,
                transaction_id VARCHAR(255) NOT NULL,
                pidx VARCHAR(255),
                ticket_type VARCHAR(50) NOT NULL,
                payment_status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Payments table verified');

        // Check if pidx exists in payments
        const [payCols] = await promisePool.execute('DESCRIBE payments');
        if (!payCols.map(c => c.Field).includes('pidx')) {
            await promisePool.execute("ALTER TABLE payments ADD COLUMN pidx VARCHAR(255) AFTER transaction_id");
            console.log('✅ Added pidx to payments');
        }

        // 4. Check Transaction Logs table
        await promisePool.execute(`
            CREATE TABLE IF NOT EXISTS transaction_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                event_id INT,
                gateway VARCHAR(50),
                pidx_or_oid VARCHAR(255),
                status VARCHAR(50),
                raw_response TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Transaction logs table verified');

        // 5. Check Reviews table
        await promisePool.execute(`
            CREATE TABLE IF NOT EXISTS reviews (
                id INT AUTO_INCREMENT PRIMARY KEY,
                event_id INT NOT NULL,
                user_id INT NOT NULL,
                rating INT NOT NULL,
                comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY unique_user_event (user_id, event_id)
            )
        `);
        console.log('✅ Reviews table verified');

        console.log('✨ Database is now healthy and up-to-date!');
    } catch (err) {
        console.error('❌ Auto-migration failed:', err.message);
    }
}

// Run migration on startup
autoMigrate();

module.exports = promisePool;
