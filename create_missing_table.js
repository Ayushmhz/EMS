const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function createTable() {
    console.log('🛠️ Creating Missing Registrations Table...');
    const conn = await mysql.createConnection({
        host: process.env.REMOTE_DB_HOST,
        user: process.env.REMOTE_DB_USER,
        password: process.env.REMOTE_DB_PASS,
        database: process.env.REMOTE_DB_NAME || 'test',
        port: parseInt(process.env.REMOTE_DB_PORT) || 3306,
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: false }
    });

    try {
        const sql = `
            CREATE TABLE IF NOT EXISTS registrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                event_id INT NOT NULL,
                registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY (user_id, event_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
            )
        `;
        
        await conn.execute(sql);
        console.log('✅ Table "registrations" created successfully!');
    } catch (err) {
        console.error('❌ Failed to create table:', err.message);
    } finally {
        await conn.end();
        process.exit();
    }
}

createTable();
