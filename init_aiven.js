const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, './backend/.env') });

// Temporarily override connection variables to point to Aiven for initialization
process.env.DB_HOST = process.env.REMOTE_DB_HOST;
process.env.DB_PORT = process.env.REMOTE_DB_PORT;
process.env.DB_USER = process.env.REMOTE_DB_USER;
process.env.DB_PASS = process.env.REMOTE_DB_PASS;
process.env.DB_NAME = process.env.REMOTE_DB_NAME;

console.log(`🚀 Connecting to Aiven Database at ${process.env.DB_HOST}...`);
const db = require('./backend/server/db');

console.log('⏳ Waiting 5 seconds for the database schema check to complete...');
setTimeout(async () => {
    try {
        const [tables] = await db.execute('SHOW TABLES');
        console.log('✅ Success! Existing Tables on Aiven:', tables.map(t => Object.values(t)[0]));
        process.exit(0);
    } catch (err) {
        console.error('❌ Failed to verify tables on Aiven:', err.message);
        process.exit(1);
    }
}, 5000);
