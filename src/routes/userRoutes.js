// src/routes/userRoutes.js - Complete User Routes
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');

// ============================================
// PROTECTED ROUTES
// ============================================
router.get('/dashboard/stats', authenticate, userController.getDashboardStats);
router.get('/profile', authenticate, userController.getProfile);
router.put('/profile', authenticate, userController.updateProfile);

module.exports = router;