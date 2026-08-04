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

    console.log("Token generated:", token);

    try {
        console.log("\nFetching /api/registrations/my-registrations...");
        const resRegs = await axios.get(`${API_BASE}/api/registrations/my-registrations`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Status:", resRegs.status);
        console.log("Response:", JSON.stringify(resRegs.data, null, 2));
    } catch (err) {
        console.error("Error fetching registrations:", err.response ? err.response.data : err.message);
    }

    // Generate token for Admin (id = 1)
    const adminToken = jwt.sign(
        { id: 1, role: 'admin', name: 'Admin User' },
        process.env.JWT_SECRET || 'any_long_secret_string_12345',
        { expiresIn: '1d' }
    );

    try {
        console.log("\nFetching /api/analytics/revenue...");
        const resAnalytics = await axios.get(`${API_BASE}/api/analytics/revenue`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log("Status:", resAnalytics.status);
        console.log("Response totalRevenue:", resAnalytics.data.totalRevenue);
    } catch (err) {
        console.error("Error fetching analytics:", err.response ? err.response.data : err.message);
    }
}

main();
