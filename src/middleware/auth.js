// src/middleware/auth.js - Authentication Middleware with PIN Support
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

// ============================================
// AUTHENTICATE MIDDLEWARE
// ============================================
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const token = authHeader.split(' ')[1];
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.userId = decoded.userId;
            
            const user = await User.findById(req.userId);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'User not found'
                });
            }
            
            req.user = user;
            next();
        } catch (jwtError) {
            if (jwtError.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    message: 'Token expired. Please login again.'
                });
            }
            if (jwtError.name === 'JsonWebTokenError') {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid token'
                });
            }
            throw jwtError;
        }

    } catch (error) {
        logger.error('❌ Auth middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'Authentication failed'
        });
    }
};

// ============================================
// REQUIRE SUBSCRIPTION
// ============================================
const requireSubscription = async (req, res, next) => {
    try {
        if (!req.userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const subscription = await User.hasActiveSubscription(req.userId);
        if (!subscription) {
            return res.status(403).json({
                success: false,
                message: 'Active subscription required to access this content'
            });
        }

        req.subscription = subscription;
        next();
    } catch (error) {
        logger.error('❌ Subscription check error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify subscription'
        });
    }
};

// ============================================
// REQUIRE VERIFIED
// ============================================
const requireVerified = async (req, res, next) => {
    try {
        if (!req.userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const user = await User.findById(req.userId);
        if (!user || !user.is_verified) {
            return res.status(403).json({
                success: false,
                message: 'Email verification required'
            });
        }

        next();
    } catch (error) {
        logger.error('❌ Verification check error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify user status'
        });
    }
};

// ============================================
// REQUIRE ACTIVE PIN
// ============================================
const requireActivePin = async (req, res, next) => {
    try {
        if (!req.userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const Pin = require('../models/Pin');
        const activePin = await Pin.getActivePin(req.userId);
        if (!activePin) {
            return res.status(403).json({
                success: false,
                message: 'Active PIN required for this action'
            });
        }

        req.activePin = activePin;
        next();
    } catch (error) {
        logger.error('❌ PIN check error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify PIN status'
        });
    }
};

module.exports = {
    authenticate,
    requireSubscription,
    requireVerified,
    requireActivePin
};