// src/routes/paymentRoutes.js - Cash Payment Routes
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');
const { isAdmin } = require('../middleware/admin');

// ============================================
// USER ROUTES (Authenticated)
// ============================================
router.post('/request', authenticate, paymentController.requestPayment);
router.get('/status/:transactionId', authenticate, paymentController.getPaymentStatus);
router.get('/user', authenticate, paymentController.getUserPayments);

// ============================================
// ADMIN ROUTES (Cash Payment Management)
// ============================================
// Payments
router.get('/', authenticate, isAdmin, paymentController.getAllPayments);
router.get('/stats', authenticate, isAdmin, paymentController.getPaymentStats);
router.delete('/:id', authenticate, isAdmin, paymentController.deletePayment);

// PIN Management (Admin generates PIN after cash payment)
router.post('/generate-pin', authenticate, isAdmin, paymentController.generatePinForUser);
router.post('/revoke-pin/:userId', authenticate, isAdmin, paymentController.revokePin);
router.get('/pins/user/:userId', authenticate, isAdmin, paymentController.getUserPins);
router.get('/pins/all', authenticate, isAdmin, paymentController.getAllPins);

// Webhook (not used for cash)
router.post('/webhook', paymentController.handleWebhook);

module.exports = router;