const db = require('./backend/server/db');

async function debugPayments() {
    try {
        console.log('--- DB DIAGNOSTIC ---');
        const [tables] = await db.execute('SHOW TABLES');
        console.log('Tables:', tables.map(t => Object.values(t)[0]));

        const [cols] = await db.execute('DESCRIBE payments');
        console.log('Payments Columns:', cols.map(c => `${c.Field} (${c.Type})`));

        // Test an insert
        console.log('Testing dummy payment insert...');
        // We need a valid user_id and event_id from the DB
        const [users] = await db.execute('SELECT id FROM users LIMIT 1');
        const [events] = await db.execute('SELECT id FROM events LIMIT 1');

        if (users.length > 0 && events.length > 0) {
            const uid = users[0].id;
            const eid = events[0].id;
            await db.execute(
                'INSERT INTO payments (user_id, event_id, amount, payment_method, transaction_id, ticket_type, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [uid, eid, 100.00, 'Test', 'TEST_TXN', 'regular', 'paid']
            );
            console.log('✅ Dummy insert successful!');
        } else {
            console.log('❌ Cannot test insert: No users or events found.');
        }

        process.exit(0);
    } catch (err) {
        console.error('❌ DIAGNOSTIC FAILED:', err.message);
        console.error('SQL State:', err.sqlState);
        process.exit(1);
    }
}

debugPayments();
