const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function migrate() {
    console.log('🚀 Starting Data Migration...');

    // 1. Local Connection (Source)
    const localConn = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'college_event_mgmt'
    });

    // 2. Remote Connection (Destination)
    const remoteConn = await mysql.createConnection({
        host: process.env.REMOTE_DB_HOST,
        user: process.env.REMOTE_DB_USER,
        password: process.env.REMOTE_DB_PASS,
        database: process.env.REMOTE_DB_NAME || 'test',
        port: parseInt(process.env.REMOTE_DB_PORT) || 3306,
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: false }
    });

    try {
        console.log('📦 Fetching local events...');
        const [events] = await localConn.execute('SELECT * FROM events');
        
        console.log(`✨ Found ${events.length} events. Moving them to TiDB...`);

        for (const event of events) {
            await remoteConn.execute(
                `INSERT IGNORE INTO events (id, title, description, event_date, event_time, location, capacity, image_url, registration_deadline, created_by) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [event.id, event.title, event.description, event.event_date, event.event_time, event.location, event.capacity, event.image_url, event.registration_deadline, event.created_by]
            );
        }

        console.log('✅ Migration completed successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        await localConn.end();
        await remoteConn.end();
        process.exit();
    }
}

migrate();
