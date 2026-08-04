const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/paymentController');
const { authenticateToken } = require('../middleware/auth');

// Khalti Endpoints
router.post('/khalti/initiate', authenticateToken, PaymentController.initiateKhalti);
router.get('/khalti/callback', PaymentController.khaltiCallback);

// eSewa Endpoints
router.post('/esewa/initiate', authenticateToken, PaymentController.initiateEsewa);
router.get('/esewa/callback', PaymentController.esewaCallback);

module.exports = router;
