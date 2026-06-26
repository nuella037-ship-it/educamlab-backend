// src/routes/adminRoutes.js - Complete Admin Routes with Cash Payment Support
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate } = require('../middleware/auth');
const { isAdmin, isSuperAdmin } = require('../middleware/admin');
const { validate, validators } = require('../middleware/validation');

// All admin routes require authentication and admin privileges
router.use(authenticate);
router.use(isAdmin);

// ============================================
// DASHBOARD
// ============================================
router.get('/dashboard/stats', adminController.getDashboardStats);

// ============================================
// USER MANAGEMENT
// ============================================
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUserById);
router.get('/users/phone/:phone', adminController.getUserByPhone);
router.post('/users', validate(validators.register), adminController.createUser);
router.put('/users/:id', validate(validators.register), adminController.updateUser);
router.put('/users/:id/role', adminController.updateUserRole);
router.put('/users/:id/verify', adminController.updateUserVerification);
router.delete('/users/:id', adminController.deleteUser);

// ============================================
// PIN MANAGEMENT (Admin - Cash Payments)
// ============================================
router.post('/pins/generate', adminController.generatePinForUser);
router.post('/pins/revoke/:userId', adminController.revokePin);
router.get('/pins/user/:userId', adminController.getUserPins);
router.get('/pins/all', adminController.getAllPins);
router.post('/pins/revoke-expired', adminController.revokeExpiredPins);

// ============================================
// PAYMENT MANAGEMENT (Cash)
// ============================================
router.get('/payments', adminController.getPayments);
router.get('/payments/stats', adminController.getPaymentStats);
router.delete('/payments/:id', adminController.deletePayment);

// ============================================
// COURSE MANAGEMENT
// ============================================
router.get('/courses', adminController.getCoursesAdmin);
router.post('/courses', validate(validators.course), adminController.createCourseAdmin);
router.put('/courses/:id', validate(validators.course), adminController.updateCourseAdmin);
router.delete('/courses/:id', adminController.deleteCourseAdmin);

// ============================================
// CONTACT MESSAGES
// ============================================
router.get('/messages', adminController.getContactMessagesAdmin);
router.get('/messages/:id', adminController.getContactMessageById);
router.post('/messages/:id/reply', adminController.replyToContactAdmin);
router.delete('/messages/:id', adminController.deleteContactMessage);

// ============================================
// ACTIVITY LOG
// ============================================
router.get('/activities', adminController.getActivities);
router.get('/activities/stats', adminController.getActivityStats);
router.delete('/activities/clear', isSuperAdmin, adminController.clearActivities);

module.exports = router;