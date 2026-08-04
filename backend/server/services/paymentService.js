const axios = require('axios');
require('dotenv').config();

class PaymentService {
    // Khalti: Initiate Payment
    static async initiateKhaltiPayment(details) {
        try {
            const response = await axios.post(
                process.env.KHALTI_INITIATE_URL,
                {
                    return_url: details.return_url,
                    website_url: details.website_url,
                    amount: details.amount, // Already converted to paisa in controller
                    purchase_order_id: details.purchase_order_id,
                    purchase_order_name: details.purchase_order_name,
                    customer_info: details.customer_info
                },
                {
                    headers: {
                        Authorization: `Key ${(process.env.KHALTI_SECRET_KEY || '').trim()}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000 // 30 second timeout to prevent 504
                }
            );
            return response.data;
        } catch (error) {
            if (error.code === 'ECONNABORTED') {
                console.error('Khalti Initiation Timeout: Request took too long');
                throw new Error('Khalti server is not responding. Please try again later.');
            }
            console.error('Khalti Initiation Error:', error.response ? error.response.data : error.message);
            throw new Error(error.response?.data?.detail || 'Failed to initiate Khalti payment');
        }
    }

    // Khalti: Verify Payment
    static async verifyKhaltiPayment(pidx) {
        try {
            const response = await axios.post(
                process.env.KHALTI_LOOKUP_URL,
                { pidx },
                {
                    headers: {
                        Authorization: `Key ${(process.env.KHALTI_SECRET_KEY || '').trim()}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000 // 30 second timeout to prevent 504
                }
            );
            return response.data;
        } catch (error) {
            if (error.code === 'ECONNABORTED') {
                console.error('Khalti Verification Timeout: Request took too long');
                throw new Error('Khalti verification timed out. Please try again.');
            }
            console.error('Khalti Verification Error:', error.response ? error.response.data : error.message);
            throw new Error('Failed to verify Khalti payment');
        }
    }

    // eSewa: Verify Payment (Status Check)
    static async verifyEsewaPayment(encodedData) {
        try {
            // eSewa V2 sends data in base64 encoded format in the success URL
            const decodedData = JSON.parse(Buffer.from(encodedData, 'base64').toString('utf-8'));
            
            // In eSewa V2, the verification is often just checking the status in the decoded data,
            // but for extra security, you can call their status check API if needed.
            // For Sandbox, usually the status 'COMPLETE' in the response is enough after signature check.
            
            return decodedData;
        } catch (error) {
            console.error('eSewa Verification Error:', error.message);
            throw new Error('Failed to decode eSewa response');
        }
    }
}

module.exports = PaymentService;
