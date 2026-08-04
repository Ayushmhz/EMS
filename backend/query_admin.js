const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkAndCleanAdminRegistrations() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME
        });

        // 1. Find all admin user IDs
        const [admins] = await connection.execute("SELECT id, fullname, email, role FROM users WHERE LOWER(role) = 'admin'");
        console.log("Admin users found:", admins);

        if (admins.length > 0) {
            const adminIds = admins.map(a => a.id);
            const placeholders = adminIds.map(() => '?').join(',');

            // 2. Find all registrations for admin users
            const [adminRegs] = await connection.execute(
                `SELECT r.id as reg_id, r.user_id, r.event_id, u.fullname, u.email, e.title 
                 FROM registrations r 
                 JOIN users u ON r.user_id = u.id 
                 JOIN events e ON r.event_id = e.id 
                 WHERE r.user_id IN (${placeholders})`,
                adminIds
            );

            console.log("Admin registrations found:", adminRegs);

            if (adminRegs.length > 0) {
                // Delete admin registrations
                const regIdsToDelete = adminRegs.map(r => r.reg_id);
                const delPlaceholders = regIdsToDelete.map(() => '?').join(',');
                const [delResult] = await connection.execute(
                    `DELETE FROM registrations WHERE id IN (${delPlaceholders})`,
                    regIdsToDelete
                );
                console.log(`Successfully deleted ${delResult.affectedRows} admin registration record(s).`);
            } else {
                console.log("No admin registrations found in database.");
            }
        }

        // 3. Verify no admin registrations remain
        const [verifyRegs] = await connection.execute(
            `SELECT r.id FROM registrations r JOIN users u ON r.user_id = u.id WHERE LOWER(u.role) = 'admin'`
        );
        console.log("Verification - Admin registrations remaining:", verifyRegs.length);

        await connection.end();
    } catch (err) {
        console.error("Error running script:", err);
    }
}

checkAndCleanAdminRegistrations();
