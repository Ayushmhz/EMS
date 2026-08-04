const db = require('./backend/server/db');

async function checkRoles() {
    try {
        const [users] = await db.execute('SELECT id, fullname, role FROM users');
        console.log('User Roles:');
        users.forEach(u => {
            console.log(`- ${u.fullname}: "${u.role}" (Length: ${u.role.length})`);
        });
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkRoles();
