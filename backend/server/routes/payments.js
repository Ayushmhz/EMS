const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/paymentController');
const { authenticateToken } = require('../middleware/auth');

/**
 * @route POST /api/payments/khalti/initiate
 * @desc Initiate Khalti Payment
 * @access Private
 */
router.post('/khalti/initiate', authenticateToken, PaymentController.initiateKhalti);

/**
 * @route GET /api/payments/khalti/callback
 * @desc Khalti Payment Callback (Verification)
 * @access Public (Called by Khalti)
 */
router.get('/khalti/callback', PaymentController.khaltiCallback);

/**
 * @route POST /api/payments/esewa/initiate
 * @desc Prepare eSewa Form Data
 * @access Private
 */
router.post('/esewa/initiate', authenticateToken, PaymentController.initiateEsewa);

/**
 * @route GET /api/payments/esewa/callback
 * @desc eSewa Payment Callback (Verification)
 * @access Public (Called by eSewa)
 */
router.get('/esewa/callback', PaymentController.esewaCallback);

module.exports = router;

