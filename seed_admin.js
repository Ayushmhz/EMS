const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, './backend/.env') });

async function seedAdmin() {
    const adminEmail = 'admin@ems.com';
    const adminPassword = 'AdminPassword123'; // Strong password containing letters & numbers
    const adminName = 'System Administrator';

    console.log('🌱 Starting Admin Seeding Script for Aiven MySQL...');
    
    // Connect using Aiven credentials from .env
    const conn = await mysql.createConnection({
        host: process.env.REMOTE_DB_HOST,
        user: process.env.REMOTE_DB_USER,
        password: process.env.REMOTE_DB_PASS,
        database: process.env.REMOTE_DB_NAME || 'defaultdb',
        port: parseInt(process.env.REMOTE_DB_PORT) || 3306,
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: false }
    });

    try {
        // 1. Check if admin already exists
        const [existing] = await conn.execute('SELECT id FROM users WHERE email = ?', [adminEmail]);
        if (existing.length > 0) {
            console.log(`ℹ️ Admin account already exists for: ${adminEmail}`);
            console.log(`🔑 Login Credentials:`);
            console.log(`   📧 Email:    ${adminEmail}`);
            console.log(`   🔒 Password: (already set in database)`);
            return;
        }

        // 2. Hash the password
        console.log('🔑 Hashing password...');
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        // 3. Insert admin user
        console.log('👤 Creating admin account in database...');
        await conn.execute(
            "INSERT INTO users (fullname, email, password, role, faculty) VALUES (?, ?, ?, 'admin', 'Administration')",
            [adminName, adminEmail, hashedPassword]
        );

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
