// src/middleware/admin.js - Admin Authorization Middleware
const User = require('../models/User');
const logger = require('../utils/logger');

// ============================================
// IS ADMIN
// ============================================
const isAdmin = async (req, res, next) => {
    try {
        if (!req.userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const isAdminUser = await User.isAdmin(req.userId);
        
        if (!isAdminUser) {
            logger.warn(`⚠️ Unauthorized admin access attempt: User ${req.userId}`);
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }
        
        next();
        
    } catch (error) {
        logger.error('❌ Admin check error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify admin access'
        });
    }
};

// ============================================
// IS SUPER ADMIN
// ============================================
const isSuperAdmin = async (req, res, next) => {
    try {
        if (!req.userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const user = await User.findById(req.userId);
        if (!user || user.role !== 'super_admin') {
            logger.warn(`⚠️ Unauthorized super admin access attempt: User ${req.userId}`);
            return res.status(403).json({
                success: false,
                message: 'Super admin access required'
            });
        }
        
        next();
        
    } catch (error) {
        logger.error('❌ Super admin check error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify super admin access'
        });
    }
};

// ============================================
// IS ADMIN OR SUPER ADMIN
// ============================================
const isAdminOrSuper = async (req, res, next) => {
    try {
        if (!req.userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const user = await User.findById(req.userId);
        if (!user || !['admin', 'super_admin'].includes(user.role)) {
            logger.warn(`⚠️ Unauthorized admin access attempt: User ${req.userId}`);
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }
        
        next();
        
    } catch (error) {
        logger.error('❌ Admin check error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify admin access'
        });
    }
};

module.exports = { 
    isAdmin, 
    isSuperAdmin,
    isAdminOrSuper
};