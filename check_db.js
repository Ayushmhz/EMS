const db = require('./backend/server/db');

async function checkTables() {
    try {
        console.log('Checking database tables...');
        const [tables] = await db.execute('SHOW TABLES');
        console.log('Existing Tables:', tables.map(t => Object.values(t)[0]));

        const [eventsCols] = await db.execute('DESCRIBE events');
        console.log('Events Columns:', eventsCols.map(c => c.Field));

        const [regsCols] = await db.execute('DESCRIBE registrations');
        console.log('Registrations Columns:', regsCols.map(c => c.Field));

        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

checkTables();
