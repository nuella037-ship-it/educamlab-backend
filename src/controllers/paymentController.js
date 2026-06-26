// src/controllers/paymentController.js - Cash Payment Only
const { pool, query, withTransaction } = require('../config/database');
const Payment = require('../models/Payment');
const Pin = require('../models/Pin');
const User = require('../models/User');
const smsService = require('../services/smsService');
const logger = require('../utils/logger');
const { generateSecurePin } = require('../utils/security');
const bcrypt = require('bcryptjs');

// ============================================
// USER: REQUEST CASH PAYMENT
// ============================================
const requestPayment = async (req, res) => {
    try {
        const userId = req.userId;
        const { plan } = req.body;

        if (!plan) {
            return res.status(400).json({
                success: false,
                message: 'Plan is required'
            });
        }

        const validPlans = ['daily', 'weekly', 'monthly', 'annual'];
        if (!validPlans.includes(plan)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid plan. Must be daily, weekly, monthly, or annual'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const planPrices = {
            daily: 150,
            weekly: 800,
            monthly: 2500,
            annual: 15000
        };

        const amount = planPrices[plan];
        const transactionId = `CASH-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

        // Create payment record - status 'pending'
        const payment = await Payment.create({
            userId,
            amount,
            subscriptionType: plan,
            transactionId,
            status: 'pending',
            notes: 'Cash payment request - pending admin confirmation'
        });

        // Log activity
        await User.logActivity(
            userId,
            'payment_request',
            `Requested cash payment for ${plan} plan (${amount} XAF)`,
            req.ip,
            req.headers['user-agent']
        );

        res.status(200).json({
            success: true,
            message: 'Payment request submitted. Please pay cash to admin to receive your PIN.',
            data: {
                transactionId,
                amount,
                plan,
                status: 'pending',
                adminInstructions: 'Please contact admin to complete your cash payment.'
            }
        });

    } catch (error) {
        logger.error('❌ Payment request error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to process payment request'
        });
    }
};

// ============================================
// USER: GET PAYMENT STATUS
// ============================================
const getPaymentStatus = async (req, res) => {
    try {
        const { transactionId } = req.params;
        const userId = req.userId;

        const payment = await Payment.getByTransactionId(transactionId);
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        if (payment.user_id !== parseInt(userId)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        res.status(200).json({
            success: true,
            data: payment
        });

    } catch (error) {
        logger.error('❌ Payment status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get payment status'
        });
    }
};

// ============================================
// USER: GET MY PAYMENTS
// ============================================
const getUserPayments = async (req, res) => {
    try {
        const userId = req.userId;
        const payments = await Payment.getUserPayments(userId);

        res.status(200).json({
            success: true,
            data: payments
        });

    } catch (error) {
        logger.error('❌ Get user payments error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get payments'
        });
    }
};

// ============================================
// ADMIN: GENERATE PIN FOR USER (After Cash Payment)
// ============================================
const generatePinForUser = async (req, res) => {
    try {
        const { userId, plan = 'monthly' } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user already has an active PIN
        const activePin = await Pin.getActivePin(userId);
        if (activePin) {
            return res.status(400).json({
                success: false,
                message: 'User already has an active PIN. Please revoke it first.',
                data: { existingPin: activePin.pin_code }
            });
        }

        // Generate PIN
        const pinResult = await Pin.generate(userId, plan, req.userId);
        const pinCode = pinResult.pinCode;

        // Update user's pin field (for login)
        const salt = await bcrypt.genSalt(12);
        const hashedPin = await bcrypt.hash(pinCode, salt);
        await pool.query(
            'UPDATE users SET pin = ?, last_pin_generated_at = NOW() WHERE id = ?',
            [hashedPin, userId]
        );

        // Update subscription
        const durations = { daily: 1, weekly: 7, monthly: 30, annual: 365 };
        const subExpiry = new Date();
        subExpiry.setDate(subExpiry.getDate() + (durations[plan] || 30));
        await pool.query(
            'UPDATE users SET subscription_type = ?, subscription_expires = ? WHERE id = ?',
            [plan, subExpiry, userId]
        );

        // Create a completed payment record for this PIN
        const transactionId = `PIN-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        const planPrices = {
            daily: 150,
            weekly: 800,
            monthly: 2500,
            annual: 15000
        };

        await Payment.create({
            userId,
            amount: planPrices[plan],
            subscriptionType: plan,
            transactionId,
            status: 'completed',
            pin: pinCode,
            notes: `PIN generated by admin for cash payment`
        });

        // Send PIN via SMS if enabled
        if (user.phone) {
            try {
                await smsService.sendPinSms(user.phone, pinCode);
            } catch (smsError) {
                logger.warn(`⚠️ Failed to send PIN SMS: ${smsError.message}`);
            }
        }

        // Log activity
        await User.logActivity(
            req.userId,
            'admin',
            `Generated PIN for user ${userId} (${user.firstname} ${user.lastname}) - PIN: ${pinCode}`,
            req.ip,
            req.headers['user-agent']
        );

        res.status(200).json({
            success: true,
            message: 'PIN generated successfully for cash payment',
            data: {
                pin: pinCode,
                plan: plan,
                expiresAt: pinResult.expiresAt,
                user: {
                    id: user.id,
                    name: `${user.firstname} ${user.lastname}`,
                    phone: user.phone
                }
            }
        });

    } catch (error) {
        logger.error('❌ Generate PIN error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to generate PIN'
        });
    }
};

// ============================================
// ADMIN: REVOKE PIN
// ============================================
const revokePin = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const activePin = await Pin.getActivePin(userId);
        if (!activePin) {
            return res.status(400).json({
                success: false,
                message: 'User does not have an active PIN'
            });
        }

        await Pin.revoke(userId, activePin.pin_code);

        // Remove pin from user
        await pool.query(
            'UPDATE users SET pin = NULL WHERE id = ?',
            [userId]
        );

        // Update subscription to none
        await pool.query(
            'UPDATE users SET subscription_type = "none", subscription_expires = NULL WHERE id = ?',
            [userId]
        );

        await User.logActivity(
            req.userId,
            'admin',
            `Revoked PIN for user ${userId} (${user.firstname} ${user.lastname})`,
            req.ip,
            req.headers['user-agent']
        );

        res.status(200).json({
            success: true,
            message: 'PIN revoked successfully'
        });

    } catch (error) {
        logger.error('❌ Revoke PIN error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to revoke PIN'
        });
    }
};

// ============================================
// ADMIN: GET ALL PAYMENTS
// ============================================
const getAllPayments = async (req, res) => {
    try {
        const { page = 1, limit = 20, status, search } = req.query;
        const offset = (page - 1) * limit;

        let conditions = [];
        let params = [];

        if (status) {
            conditions.push('p.status = ?');
            params.push(status);
        }

        if (search) {
            conditions.push('(CONCAT(u.firstname, " ", u.lastname) LIKE ? OR u.phone LIKE ? OR p.transaction_id LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const [payments] = await pool.query(
            `SELECT p.*, CONCAT(u.firstname, ' ', u.lastname) as user_name, u.phone as user_phone
            FROM payments p
            LEFT JOIN users u ON p.user_id = u.id
            ${whereClause}
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );

        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM payments p
            LEFT JOIN users u ON p.user_id = u.id
            ${whereClause}`,
            params
        );

        res.status(200).json({
            success: true,
            data: payments,
            pagination: {
                total: countResult[0].total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        });

    } catch (error) {
        logger.error('❌ Get payments error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get payments'
        });
    }
};

// ============================================
// ADMIN: GET PAYMENT STATS
// ============================================
const getPaymentStats = async (req, res) => {
    try {
        const [stats] = await pool.query(
            `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as confirmed,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as revenue
            FROM payments`
        );

        // Get monthly revenue
        const [monthlyRevenue] = await pool.query(
            `SELECT 
                DATE_FORMAT(created_at, '%Y-%m') as month,
                SUM(amount) as revenue,
                COUNT(*) as count
            FROM payments
            WHERE status = 'completed'
            GROUP BY DATE_FORMAT(created_at, '%Y-%m')
            ORDER BY month DESC
            LIMIT 6`
        );

        // Get plan distribution
        const [planDistribution] = await pool.query(
            `SELECT 
                subscription_type as plan,
                COUNT(*) as count,
                SUM(amount) as revenue
            FROM payments
            WHERE status = 'completed'
            GROUP BY subscription_type`
        );

        res.status(200).json({
            success: true,
            data: {
                ...stats[0],
                monthlyRevenue,
                planDistribution
            }
        });

    } catch (error) {
        logger.error('❌ Payment stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get payment stats'
        });
    }
};

// ============================================
// ADMIN: DELETE PAYMENT
// ============================================
const deletePayment = async (req, res) => {
    try {
        const { id } = req.params;

        const payment = await Payment.getById(id);
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        if (payment.status === 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete completed payment'
            });
        }

        await Payment.delete(id);

        await User.logActivity(
            req.userId,
            'admin',
            `Deleted payment ${id}`,
            req.ip,
            req.headers['user-agent']
        );

        res.status(200).json({
            success: true,
            message: 'Payment deleted successfully'
        });

    } catch (error) {
        logger.error('❌ Delete payment error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to delete payment'
        });
    }
};

// ============================================
// ADMIN: GET USER PINS
// ============================================
const getUserPins = async (req, res) => {
    try {
        const { userId } = req.params;

        const pins = await Pin.getUserPins(userId);

        res.status(200).json({
            success: true,
            data: pins
        });

    } catch (error) {
        logger.error('❌ Get user pins error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get user pins'
        });
    }
};

// ============================================
// ADMIN: GET ALL PINS
// ============================================
const getAllPins = async (req, res) => {
    try {
        const { limit = 100 } = req.query;
        const pins = await Pin.getAll(parseInt(limit));

        res.status(200).json({
            success: true,
            data: pins
        });

    } catch (error) {
        logger.error('❌ Get all pins error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get pins'
        });
    }
};

// ============================================
// WEBHOOK (Not used - cash only)
// ============================================
const handleWebhook = async (req, res) => {
    res.status(200).json({ success: true });
};

module.exports = {
    // User routes
    requestPayment,
    getPaymentStatus,
    getUserPayments,
    
    // Admin routes
    generatePinForUser,
    revokePin,
    getAllPayments,
    getPaymentStats,
    deletePayment,
    getUserPins,
    getAllPins,
    
    // Webhook (not used)
    handleWebhook
};