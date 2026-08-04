const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function fixSchema() {
    console.log('🛠️ Fixing Live Database Schema...');
    const conn = await mysql.createConnection({
        host: process.env.REMOTE_DB_HOST,
        user: process.env.REMOTE_DB_USER,
        password: process.env.REMOTE_DB_PASS,
        database: process.env.REMOTE_DB_NAME || 'test',
        port: parseInt(process.env.REMOTE_DB_PORT) || 3306,
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: false }
    });

    try {
        console.log('📝 Adding missing columns if they dont exist...');
        
        // Add status to events
        try {
            await conn.execute("ALTER TABLE events ADD COLUMN status ENUM('upcoming', 'ended') DEFAULT 'upcoming'");
            console.log('✅ Added status column to events');
        } catch (e) { console.log('ℹ️ Status column already exists or skipped.'); }

        // Add faculty to users
        try {
            await conn.execute("ALTER TABLE users ADD COLUMN faculty VARCHAR(100)");
            console.log('✅ Added faculty column to users');
        } catch (e) { console.log('ℹ️ Faculty column already exists or skipped.'); }

        // Add profile_pic to users
        try {
            await conn.execute("ALTER TABLE users ADD COLUMN profile_pic VARCHAR(255)");
            console.log('✅ Added profile_pic column to users');
        } catch (e) { console.log('ℹ️ profile_pic column already exists or skipped.'); }

        console.log('🎉 Schema is now perfectly synced with your code!');
    } catch (err) {
        console.error('❌ Fix failed:', err.message);
    } finally {
        await conn.end();
        process.exit();
    }
}

fixSchema();
