const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../backend/.env' });

async function main() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME
    });

    try {
        const hashedPassword = await bcrypt.hash('password123', 10);
        await connection.execute('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, 'student1@gmail.com']);
        console.log("Successfully set password for student1@gmail.com to password123");
    } catch (err) {
        console.error("Error setting password:", err);
    } finally {
        await connection.end();
    }
}

main();
