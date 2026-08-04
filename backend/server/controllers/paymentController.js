const db = require('../db');
const PaymentService = require('../services/paymentService');
const { generateEsewaSignature } = require('../utils/esewaSignature');
require('dotenv').config();

class PaymentController {
    // Initiate Khalti Payment
    static async initiateKhalti(req, res) {
        if (req.user.role === 'admin') {
            return res.status(403).json({ message: 'Only students can register for the events. Admin can only manage and edit the events.' });
        }
        const { event_id, ticket_type, amount } = req.body;
        const user_id = req.user.id;

        try {
            // Check if already registered
            const [existing] = await db.execute(
                'SELECT id FROM registrations WHERE user_id = ? AND event_id = ? AND payment_status = \'paid\'',
                [user_id, event_id]
            );
            if (existing.length > 0) {
                return res.status(400).json({ message: 'You are already registered for this event.' });
            }

            // Generate a unique purchase order ID (include ticket_type for callback handling)
            const purchase_order_id = `ORDER_${user_id}_${event_id}_${ticket_type}_${Date.now()}`;
            
            const details = {
                return_url: `${process.env.BACKEND_URL}/api/payments/khalti/callback`,
                website_url: process.env.FRONTEND_URL,
                amount: Math.round(parseFloat(amount) * 100), // Khalti expects paisa as integer
                purchase_order_id: purchase_order_id,
                purchase_order_name: `Event Registration - Event ID ${event_id}`,
                customer_info: {
                    name: req.user.fullname || 'Student',
                    email: req.user.email,
                    phone: '9800000000' // Placeholder as Khalti requires phone
                }
            };

            console.log('Initiating Khalti with details:', JSON.stringify(details, null, 2));
            const khaltiResponse = await PaymentService.initiateKhaltiPayment(details);

            // Log the initiation
            await db.execute(
                'INSERT INTO transaction_logs (user_id, event_id, gateway, pidx_or_oid, status) VALUES (?, ?, ?, ?, ?)',
                [user_id, event_id, 'Khalti', khaltiResponse.pidx, 'initiated']
            );

            res.json(khaltiResponse);
        } catch (error) {
            console.error('Khalti Initiation Detail Error:', error.response ? error.response.data : error.message);
            res.status(500).json({ 
                message: 'Khalti initiation failed', 
                error: error.response ? error.response.data : error.message 
            });
        }
    }

    // Khalti Callback/Verification
    static async khaltiCallback(req, res) {
        const { pidx, status, purchase_order_id } = req.query;

        try {
            if (status !== 'Completed') {
                return res.redirect(`${process.env.FRONTEND_URL}/payment-failure.html?reason=cancelled`);
            }

            // Verify with Khalti API
            const verification = await PaymentService.verifyKhaltiPayment(pidx);

            if (verification.status === 'Completed') {
                // Duplicate Prevention: Check if this transaction was already processed
                const [existing] = await db.execute('SELECT id FROM registrations WHERE transaction_id = ?', [verification.transaction_id]);
                if (existing.length > 0) {
                    return res.redirect(`${process.env.FRONTEND_URL}/payment-success.html?id=${existing[0].id}&regId=${existing[0].id}&note=already_processed`);
                }

                // Extract details from purchase_order_id (ORDER_userId_eventId_ticketType_timestamp)
                const orderId = purchase_order_id || verification.purchase_order_id;
                if (!orderId) {
                    throw new Error("Missing purchase_order_id in Khalti callback/verification");
                }
                const parts = orderId.split('_');
                const user_id = parseInt(parts[1]);
                const event_id = parseInt(parts[2]);
                const ticket_type = parts[3] || 'regular';
                const amount = verification.total_amount / 100;

                // SAVE REGISTRATION ONLY NOW
                const [regResult] = await db.execute(
                    'INSERT INTO registrations (user_id, event_id, ticket_type, amount, payment_status, transaction_id) VALUES (?, ?, ?, ?, ?, ?)',
                    [user_id, event_id, ticket_type, amount, 'paid', verification.transaction_id]
                );

                // Save Payment Record
                await db.execute(
                    'INSERT INTO payments (user_id, event_id, amount, payment_method, transaction_id, pidx, ticket_type, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [user_id, event_id, amount, 'Khalti', verification.transaction_id, pidx, ticket_type, 'paid']
                );

                // Update Logs
                await db.execute(
                    'UPDATE transaction_logs SET status = ?, raw_response = ? WHERE pidx_or_oid = ?',
                    ['completed', JSON.stringify(verification), pidx]
                );

                return res.redirect(`${process.env.FRONTEND_URL}/payment-success.html?id=${regResult.insertId}&regId=${regResult.insertId}`);
            } else {
                return res.redirect(`${process.env.FRONTEND_URL}/payment-failure.html?reason=verification_failed`);
            }
        } catch (error) {
            console.error(error);
            res.redirect(`${process.env.FRONTEND_URL}/payment-failure.html?reason=error`);
        }
    }

    // Prepare eSewa Form Data
    static async initiateEsewa(req, res) {
        if (req.user.role === 'admin') {
            return res.status(403).json({ message: 'Only students can register for the events. Admin can only manage and edit the events.' });
        }
        const { event_id, ticket_type, amount } = req.body;
        const user_id = req.user.id;

        try {
            // Check if already registered
            const [existing] = await db.execute(
                'SELECT id FROM registrations WHERE user_id = ? AND event_id = ? AND payment_status = \'paid\'',
                [user_id, event_id]
            );
            if (existing.length > 0) {
                return res.status(400).json({ message: 'You are already registered for this event.' });
            }

            const transaction_uuid = `ESEWA_${user_id}_${event_id}_${ticket_type}_${Date.now()}`;
            const product_code = process.env.ESEWA_PRODUCT_CODE;
            const secret = process.env.ESEWA_SECRET_KEY;
            
            // Normalize amount: eSewa V2 Sandbox usually expects a clean integer string if no decimals are needed
            const formattedAmount = amount.toString();
            
            // Signature Message Format: total_amount=X,transaction_uuid=Y,product_code=Z
            // NO SPACES ALLOWED
            const signatureString = `total_amount=${formattedAmount},transaction_uuid=${transaction_uuid},product_code=${product_code}`;
            const signature = generateEsewaSignature(signatureString, secret);

            const formData = {
                amount: formattedAmount,
                tax_amount: '0',
                total_amount: formattedAmount,
                transaction_uuid: transaction_uuid,
                product_code: product_code,
                product_service_charge: '0',
                product_delivery_charge: '0',
                success_url: `${process.env.BACKEND_URL}/api/payments/esewa/callback`,
                failure_url: `${process.env.FRONTEND_URL}/payment-failure.html`,
                signed_field_names: "total_amount,transaction_uuid,product_code",
                signature: signature
            };

            // Log Initiation
            await db.execute(
                'INSERT INTO transaction_logs (user_id, event_id, gateway, pidx_or_oid, status) VALUES (?, ?, ?, ?, ?)',
                [user_id, event_id, 'eSewa', transaction_uuid, 'initiated']
            );

            res.json({ 
                payment_url: process.env.ESEWA_INITIATE_URL,
                formData 
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'eSewa preparation failed' });
        }
    }

    // eSewa Callback/Verification
    static async esewaCallback(req, res) {
        const { data } = req.query; // eSewa sends a 'data' parameter in GET success_url

        try {
            const decoded = await PaymentService.verifyEsewaPayment(data);

            if (decoded.status === 'COMPLETE') {
                // Duplicate Prevention: Check if this transaction was already processed
                const [existing] = await db.execute('SELECT id FROM registrations WHERE transaction_id = ?', [decoded.transaction_code]);
                if (existing.length > 0) {
                    return res.redirect(`${process.env.FRONTEND_URL}/payment-success.html?id=${existing[0].id}&regId=${existing[0].id}&note=already_processed`);
                }

                const parts = decoded.transaction_uuid.split('_');
                const user_id = parseInt(parts[1]);
                const event_id = parseInt(parts[2]);
                const ticket_type = parts[3] || 'regular';
                const amount = parseFloat(decoded.total_amount.toString().replace(/,/g, ''));

                // SAVE REGISTRATION ONLY NOW
                const [regResult] = await db.execute(
                    'INSERT INTO registrations (user_id, event_id, ticket_type, amount, payment_status, transaction_id) VALUES (?, ?, ?, ?, ?, ?)',
                    [user_id, event_id, ticket_type, amount, 'paid', decoded.transaction_code]
                );

                // Save Payment Record
                await db.execute(
                    'INSERT INTO payments (user_id, event_id, amount, payment_method, transaction_id, ticket_type, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [user_id, event_id, amount, 'eSewa', decoded.transaction_code, ticket_type, 'paid']
                );

                // Update Logs
                await db.execute(
                    'UPDATE transaction_logs SET status = ?, raw_response = ? WHERE pidx_or_oid = ?',
                    ['completed', JSON.stringify(decoded), decoded.transaction_uuid]
                );

                return res.redirect(`${process.env.FRONTEND_URL}/payment-success.html?id=${regResult.insertId}&regId=${regResult.insertId}`);
            } else {
                return res.redirect(`${process.env.FRONTEND_URL}/payment-failure.html?reason=not_complete`);
            }
        } catch (error) {
            console.error(error);
            res.redirect(`${process.env.FRONTEND_URL}/payment-failure.html?reason=error`);
        }
    }
}

module.exports = PaymentController;
