// src/routes/contactRoutes.js - Complete Contact Routes
const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const { authenticate } = require('../middleware/auth');
const { isAdmin } = require('../middleware/admin');
const { validate, validators } = require('../middleware/validation');

// ============================================
// PUBLIC ROUTES
// ============================================
router.post('/', validate(validators.contact), contactController.submitContact);

// ============================================
// ADMIN ROUTES
// ============================================
router.get('/', authenticate, isAdmin, contactController.getContactMessages);
router.get('/stats', authenticate, isAdmin, contactController.getContactStats);
router.get('/:id', authenticate, isAdmin, contactController.getContactMessageById);
router.post('/:id/reply', authenticate, isAdmin, contactController.replyToContact);
router.delete('/:id', authenticate, isAdmin, contactController.deleteContactMessage);

module.exports = router;