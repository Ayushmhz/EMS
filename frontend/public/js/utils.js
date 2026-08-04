// Backend API URL Configuration
// FOR PRODUCTION: Replace the fallback URL below with your actual deployed Render backend URL.
// TIP: You can also temporarily override this in the browser console using: localStorage.setItem('BACKEND_URL', 'https://your-url.onrender.com')
const API_BASE = localStorage.getItem('BACKEND_URL') || (
    window.location.protocol === 'file:'
        ? 'http://localhost:5000'
        : (window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' || 
           window.location.hostname.includes('ngrok') ||
           window.location.hostname.includes('loca.lt') ||
           window.location.hostname.includes('trycloudflare.com')
            ? ''
            : 'https://ems-nk30.onrender.com') // <-- Deployed Render backend URL
);


async function apiFetch(endpoint, options = {}) {
    let token = localStorage.getItem('token');
    const headers = { 
        'ngrok-skip-browser-warning': 'true',
        ...options.headers 
    };

    // If body is not FormData, default to JSON
    // If body IS FormData, do NOT set Content-Type header manually, let browser set boundary
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        if (options.body && typeof options.body !== 'string') {
            options.body = JSON.stringify(options.body);
        }
    }

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        ...options,
        headers
    };

    try {
        console.log(`[API Request] ${options.method || 'GET'} ${API_BASE}${endpoint}`);
        const response = await fetch(`${API_BASE}${endpoint}`, config);

        // Check if response is empty (204 No Content)
        if (response.status === 204) {
            return null;
        }

        const contentType = response.headers.get('content-type');
        let data;

        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            // Attempt to read text if not JSON
            const text = await response.text();
            // If response is not ok, we still want to throw with the text content if possible
            if (!response.ok) {
                throw new Error(`Server Error (${response.status}): ${text.substring(0, 100)}`);
            }
            // If ok but not json, return text logic or throw? 
            // For this app, backend should always return JSON except maybe for files/images which we don't fetch this way usually.
            // Let's assume it's an error if we expected JSON.
            throw new Error(`Server returned non-JSON response (${response.status}): ${text.substring(0, 50)}...`);
        }

        if (!response.ok) {
            throw new Error(data.message || 'Something went wrong');
        }

        return data;
    } catch (err) {
        console.error('API Fetch Error:', err);
        throw err;
    }
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    // Ensure toast has base class + type + show
    toast.className = `toast toast-${type} show`;

    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

function getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

function checkAuth(roleRequired = null) {
    const user = getUser();
    const token = localStorage.getItem('token');

    if (!token || !user) {
        window.location.href = 'auth.html';
        return null;
    }

    if (roleRequired && user.role !== roleRequired) {
        window.location.href = 'dashboard.html';
        return null;
    }

    return user;
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    // User requested format: Month Day, Year (e.g., May 25, 2026)
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTime(timeString) {
    if (!timeString) return 'N/A';
    // Handle formats like '10:00:00' or '10:00'
    const parts = timeString.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    
    const date = new Date();
    date.setHours(hours);
    date.setMinutes(minutes);
    
    return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true 
    });
}

function validatePassword(password) {
    if (!password || password.length < 6) {
        return { valid: false, message: "Password must be at least 6 characters long" };
    }

    // Must contain letters and numbers
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (!hasLetter || !hasNumber) {
        return { valid: false, message: "Password must contain both letters and numbers" };
    }

    const commonPasswords = ['123456', '12345678', 'password', 'qwerty', '111111', 'abc123'];
    if (commonPasswords.includes(password.toLowerCase())) {
        return { valid: false, message: "Password is too weak. Please choose a stronger password" };
    }

    // Check for repetitive characters
    if (/^(.)\1+$/.test(password)) {
        return { valid: false, message: "Password is too weak. Avoid simple repeating characters" };
    }

    // Check for patterns like "ababab"
    if (password.length >= 6) {
        const pattern = password.substring(0, 2);
        let isPattern = true;
        for (let i = 0; i < password.length; i += 2) {
            if (password.substring(i, i + 2) !== pattern) {
                isPattern = false;
                break;
            }
        }
        if (isPattern) return { valid: false, message: "Password is too weak. Please choose a stronger password" };
    }

    return { valid: true };
}
