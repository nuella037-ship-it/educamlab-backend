// src/utils/cleanup.js - Database Cleanup Utilities
const { query } = require('../config/database');
const logger = require('./logger');

// ============================================
// CLEANUP EXPIRED SESSIONS
// ============================================
const cleanupExpiredSessions = async () => {
    try {
        // Clean up expired verification codes
        const [verificationResult] = await query(
            `UPDATE users 
            SET verification_code = NULL, verification_code_expires = NULL 
            WHERE verification_code_expires < NOW()`
        );
        
        // Clean up expired reset tokens
        const [resetResult] = await query(
            `UPDATE users 
            SET reset_token = NULL, reset_token_expires = NULL 
            WHERE reset_token_expires < NOW()`
        );
        
        // Clean up expired subscriptions
        const [subscriptionResult] = await query(
            `UPDATE users 
            SET subscription_type = 'none', subscription_expires = NULL 
            WHERE subscription_expires < NOW() AND subscription_type != 'none'`
        );

        // Clean up expired PINs
        const [pinResult] = await query(
            `UPDATE user_pins 
            SET is_active = 0, revoked_at = NOW() 
            WHERE is_active = 1 AND expires_at < NOW()`
        );

        logger.info(`🧹 Cleanup completed: 
            ${verificationResult.affectedRows || 0} verification codes,
            ${resetResult.affectedRows || 0} reset tokens,
            ${subscriptionResult.affectedRows || 0} subscriptions,
            ${pinResult.affectedRows || 0} expired PINs`);

        return {
            verificationCleaned: verificationResult.affectedRows || 0,
            resetTokensCleaned: resetResult.affectedRows || 0,
            subscriptionsCleaned: subscriptionResult.affectedRows || 0,
            pinsCleaned: pinResult.affectedRows || 0
        };

    } catch (error) {
        logger.error('❌ Cleanup error:', error);
        throw error;
    }
};

// ============================================
// CLEANUP OLD ACTIVITY LOGS
// ============================================
const cleanupActivityLogs = async (days = 90) => {
    try {
        const [result] = await query(
            'DELETE FROM user_activities WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
            [days]
        );
        logger.info(`🧹 Cleaned up ${result.affectedRows || 0} old activity logs`);
        return result.affectedRows || 0;
    } catch (error) {
        logger.error('❌ Activity log cleanup error:', error);
        throw error;
    }
};

// ============================================
// CLEANUP OLD PAYMENT RECORDS
// ============================================
const cleanupPayments = async (days = 365) => {
    try {
        // Only delete pending payments older than X days
        const [result] = await query(
            `DELETE FROM payments 
            WHERE status = 'pending' 
            AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
            [days]
        );
        logger.info(`🧹 Cleaned up ${result.affectedRows || 0} old pending payments`);
        return result.affectedRows || 0;
    } catch (error) {
        logger.error('❌ Payment cleanup error:', error);
        throw error;
    }
};

// ============================================
// CLEANUP UNVERIFIED USERS
// ============================================
const cleanupUnverifiedUsers = async (days = 7) => {
    try {
        const [result] = await query(
            `DELETE FROM users 
            WHERE is_verified = 0 
            AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
            AND role = 'user'`,
            [days]
        );
        logger.info(`🧹 Cleaned up ${result.affectedRows || 0} unverified users`);
        return result.affectedRows || 0;
    } catch (error) {
        logger.error('❌ Unverified users cleanup error:', error);
        throw error;
    }
};

// ============================================
// RUN ALL CLEANUPS
// ============================================
const runAllCleanups = async () => {
    try {
        const results = {
            sessions: await cleanupExpiredSessions(),
            activities: await cleanupActivityLogs(),
            payments: await cleanupPayments(),
            users: await cleanupUnverifiedUsers()
        };
        return results;
    } catch (error) {
        logger.error('❌ Full cleanup error:', error);
        throw error;
    }
};

module.exports = {
    cleanupExpiredSessions,
    cleanupActivityLogs,
    cleanupPayments,
    cleanupUnverifiedUsers,
    runAllCleanups
};