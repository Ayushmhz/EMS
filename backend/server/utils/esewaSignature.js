const crypto = require('crypto');

/**
 * Generates eSewa V2 Signature
 * @param {string} message - The string message to sign
 * @param {string} secretKey - eSewa Secret Key
 * @returns {string} - HMAC SHA256 Signature in Base64
 */
const generateEsewaSignature = (message, secretKey) => {
    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(message);
    return hmac.digest('base64');
};

module.exports = { generateEsewaSignature };
