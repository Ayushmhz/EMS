const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function check() {
    console.log('🔍 Checking Live Database...');
    const remoteConn = await mysql.createConnection({
        host: process.env.REMOTE_DB_HOST,
        user: process.env.REMOTE_DB_USER,
        password: process.env.REMOTE_DB_PASS,
        database: process.env.REMOTE_DB_NAME || 'test',
        port: parseInt(process.env.REMOTE_DB_PORT) || 3306,
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: false }
    });

    try {
        const [users] = await remoteConn.execute('SELECT id, email, fullname FROM users');
        console.log('👥 Users in Live DB:', users);

        const [events] = await remoteConn.execute('SELECT id, title FROM events');
        console.log('📅 Events in Live DB:', events);

        if (events.length === 0) {
            console.log('⚠️ No events found in live database!');
        }
    } catch (err) {
        console.error('❌ Check failed:', err.message);
    } finally {
        await remoteConn.end();
        process.exit();
    }
}

check();
