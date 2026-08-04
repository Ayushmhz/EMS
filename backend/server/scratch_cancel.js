const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config({ path: '../backend/.env' });

const API_BASE = 'http://localhost:5000';

async function main() {
    // Generate token for Student One (id = 3)
    const token = jwt.sign(
        { id: 3, role: 'student', name: 'Student One' },
        process.env.JWT_SECRET || 'any_long_secret_string_12345',
        { expiresIn: '1d' }
    );

    try {
        console.log("Simulating DELETE request to /api/registrations/3...");
        const res = await axios.delete(`${API_BASE}/api/registrations/3`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Success Response status:", res.status);
        console.log("Success Response data:", res.data);
    } catch (err) {
        console.error("FAILED Response:", err.response ? err.response.data : err.message);
    }
}

main();
