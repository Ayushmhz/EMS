const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../backend/.env' });

async function main() {
    console.log("DB Host:", process.env.DB_HOST);
    console.log("DB Name:", process.env.DB_NAME);
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME
    });

    try {
        const [users] = await connection.execute('SELECT id, fullname, email, role FROM users');
        console.log("\n--- USERS ---");
        console.table(users);

        const [events] = await connection.execute('SELECT id, title, category FROM events');
        console.log("\n--- EVENTS ---");
        console.table(events);

        const [registrations] = await connection.execute('SELECT id, user_id, event_id, payment_status, transaction_id, amount FROM registrations');
        console.log("\n--- REGISTRATIONS ---");
        console.table(registrations);

        const [payments] = await connection.execute('SELECT id, user_id, event_id, payment_status, transaction_id, amount FROM payments');
        console.log("\n--- PAYMENTS ---");
        console.table(payments);
        
    } catch (err) {
        console.error("Error executing queries:", err);
    } finally {
        await connection.end();
    }
}

main();
