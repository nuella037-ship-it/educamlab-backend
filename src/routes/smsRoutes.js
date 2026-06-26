// src/routes/smsRoutes.js - SMS Routes
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { isAdmin } = require('../middleware/admin');
const smsService = require('../services/smsService');
const logger = require('../utils/logger');

// ============================================
// SEND SINGLE SMS (Admin only)
// ============================================
router.post('/send', authenticate, isAdmin, async (req, res) => {
    try {
        const { phone, message } = req.body;

        if (!phone || !message) {
            return res.status(400).json({
                success: false,
                message: 'Phone number and message are required'
            });
        }

        const result = await smsService.sendSms(phone, message);

        res.status(200).json({
            success: true,
            message: 'SMS sent successfully',
            data: result
        });

    } catch (error) {
        logger.error('❌ SMS send error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to send SMS'
        });
    }
});

// ============================================
// SEND BULK SMS (Admin only)
// ============================================
router.post('/batch', authenticate, isAdmin, async (req, res) => {
    try {
        const { recipients, message, senderId } = req.body;

        if (!recipients || !recipients.length || !message) {
            return res.status(400).json({
                success: false,
                message: 'Recipients and message are required'
            });
        }

        const result = await smsService.sendBulkSms(recipients, message, senderId);

        res.status(200).json({
            success: true,
            message: 'Bulk SMS sent successfully',
            data: result
        });

    } catch (error) {
        logger.error('❌ Bulk SMS error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to send bulk SMS'
        });
    }
});

// ============================================
// SEND PIN VIA SMS (Admin only)
// ============================================
router.post('/send-pin', authenticate, isAdmin, async (req, res) => {
    try {
        const { phone, pin } = req.body;

        if (!phone || !pin) {
            return res.status(400).json({
                success: false,
                message: 'Phone number and PIN are required'
            });
        }

        const result = await smsService.sendPinSms(phone, pin);

        res.status(200).json({
            success: true,
            message: 'PIN sent successfully',
            data: result
        });

    } catch (error) {
        logger.error('❌ Send PIN SMS error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to send PIN'
        });
    }
});

// ============================================
// GET SMS STATS (Admin only)
// ============================================
router.get('/stats', authenticate, isAdmin, async (req, res) => {
    try {
        const stats = await smsService.getStats();
        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        logger.error('❌ SMS stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get SMS stats'
        });
    }
});

// ============================================
// GET SMS HISTORY (Admin only)
// ============================================
router.get('/history', authenticate, isAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        
        // Get from database if you have an SMS history table
        // For now, return placeholder
        res.status(200).json({
            success: true,
            data: [],
            pagination: {
                total: 0,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: 0
            }
        });

    } catch (error) {
        logger.error('❌ SMS history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get SMS history'
        });
    }
});

module.exports = router;