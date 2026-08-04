const db = require('./backend/server/db');

async function getTestUser() {
    try {
        const [users] = await db.execute('SELECT email, role FROM users WHERE role = "student" LIMIT 1');
        if (users.length > 0) {
            console.log(`TEST_USER_EMAIL: ${users[0].email}`);
        } else {
            console.log('NO_STUDENT_FOUND');
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

getTestUser();
