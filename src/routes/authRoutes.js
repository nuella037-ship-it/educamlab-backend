// src/routes/authRoutes.js - Complete Authentication Routes
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validate, validators } = require('../middleware/validation');

// ============================================
// PUBLIC ROUTES
// ============================================
router.post('/register', validate(validators.register), authController.register);
router.post('/login', validate(validators.login), authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/verify-otp', authController.verifyOTP);
router.post('/resend-otp', authController.resendOTP);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// ============================================
// PROTECTED ROUTES
// ============================================
router.get('/me', authenticate, authController.getMe);
router.put('/me', authenticate, authController.updateProfile);
router.put('/change-password', authenticate, authController.changePassword);
router.post('/logout', authenticate, authController.logout);

module.exports = router;