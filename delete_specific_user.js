const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function deleteUser() {
    console.log('🗑️ Attempting to delete user john@gmail.com from cloud database...');
    
    // Remote Connection (TiDB Cloud)
    const remoteConn = await mysql.createConnection({
        host: process.env.REMOTE_DB_HOST,
        user: process.env.REMOTE_DB_USER,
        password: process.env.REMOTE_DB_PASS,
        database: process.env.REMOTE_DB_NAME || 'test',
        port: parseInt(process.env.REMOTE_DB_PORT) || 3306,
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: false }
    });

    try {
        const emailToDelete = 'john@gmail.com';
        
        // 1. Check if user exists
        const [users] = await remoteConn.execute('SELECT id, fullname FROM users WHERE email = ?', [emailToDelete]);
        
        if (users.length === 0) {
            console.log(`❌ No user found with email: ${emailToDelete}`);
            return;
        }

        const user = users[0];
        console.log(`👤 Found user: ${user.fullname} (ID: ${user.id})`);

        // 2. Delete the user (registrations will be deleted automatically due to ON DELETE CASCADE)
        await remoteConn.execute('DELETE FROM users WHERE id = ?', [user.id]);
        
        console.log(`✅ Successfully deleted ${emailToDelete} from the database!`);

    } catch (err) {
        console.error('❌ Deletion failed:', err.message);
    } finally {
        await remoteConn.end();
        process.exit();
    }
}

deleteUser();
