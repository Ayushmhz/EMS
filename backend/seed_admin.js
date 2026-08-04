const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, './.env') });

async function seedAdmin() {
    const adminEmail = 'admin@college.edu';
    const adminPassword = 'admin@123';
    const adminName = 'System Administrator';

    console.log('🌱 Starting Admin Seeding Script for Aiven MySQL...');
    
    // Connect using Aiven credentials from backend/.env
    const conn = await mysql.createConnection({
        host: process.env.REMOTE_DB_HOST,
        user: process.env.REMOTE_DB_USER,
        password: process.env.REMOTE_DB_PASS,
        database: process.env.REMOTE_DB_NAME || 'defaultdb',
        port: parseInt(process.env.REMOTE_DB_PORT) || 3306,
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: false }
    });

    try {
        // 1. Clean up old test admin if it exists
        console.log('🧹 Cleaning up old test admin...');
        await conn.execute('DELETE FROM users WHERE email = ?', ['admin@ems.com']);

        // 2. Check if new admin already exists
        const [existing] = await conn.execute('SELECT id FROM users WHERE email = ?', [adminEmail]);
        if (existing.length > 0) {
            console.log(`ℹ️ Admin account already exists for: ${adminEmail}`);
            // Let's update its password to ensure it is admin@123
            console.log('🔑 Updating password...');
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            await conn.execute('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, adminEmail]);
        } else {
            // 3. Hash the password
            console.log('🔑 Hashing password...');
            const hashedPassword = await bcrypt.hash(adminPassword, 10);

            // 4. Insert admin user
            console.log('👤 Creating admin account in database...');
            await conn.execute(
                "INSERT INTO users (fullname, email, password, role, faculty) VALUES (?, ?, ?, 'admin', 'Administration')",
                [adminName, adminEmail, hashedPassword]
            );
        }

        console.log('\n=========================================');
        console.log('✅ Admin Account Seeded Successfully!');
        console.log('=========================================');
        console.log('You can now log in to your Admin dashboard:');
        console.log(`📧 Email:    ${adminEmail}`);
        console.log(`🔒 Password: ${adminPassword}`);
        console.log('=========================================\n');

    } catch (err) {
        console.error('❌ Seeding failed:', err.message);
    } finally {
        await conn.end();
        process.exit();
    }
}

seedAdmin();
