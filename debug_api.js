const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function debug() {
    console.log('🧪 Debugging API Query...');
    const conn = await mysql.createConnection({
        host: process.env.REMOTE_DB_HOST,
        user: process.env.REMOTE_DB_USER,
        password: process.env.REMOTE_DB_PASS,
        database: process.env.REMOTE_DB_NAME || 'test',
        port: parseInt(process.env.REMOTE_DB_PORT) || 3306,
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: false }
    });

    try {
        console.log('🛰️ Running the Events query...');
        const query = `
            SELECT e.*, u.fullname as organizer,
            (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id) as registered_count
            FROM events e 
            LEFT JOIN users u ON e.created_by = u.id 
            ORDER BY e.event_date ASC, e.event_time ASC
        `;

        const [rows] = await conn.execute(query);
        console.log('✅ Query success! Row count:', rows.length);
        console.log('Sample data:', rows[0]);

    } catch (err) {
        console.error('❌ QUERY FAILED!');
        console.error('Error Code:', err.code);
        console.error('Error Message:', err.message);

        if (err.message.includes('Unknown column')) {
            console.log('💡 Tip: It looks like a column is missing. I will check the table structure...');
            const [columns] = await conn.execute('DESCRIBE events');
            console.log('Current events columns:', columns.map(c => c.Field));
        }
    } finally {
        await conn.end();
        process.exit();
    }
}

debug();
