// src/models/Pin.js - PIN Model
const { pool, query } = require('../config/database');
const { generateSecurePin } = require('../utils/security');
const logger = require('../utils/logger');

class Pin {
    // ============================================
    // GENERATE PIN
    // ============================================
    static async generate(userId, plan = 'monthly', createdBy = null) {
        const pinCode = generateSecurePin(6);
        const durations = { daily: 1, weekly: 7, monthly: 30, annual: 365 };
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (durations[plan] || 30));

        const [result] = await query(
            `INSERT INTO user_pins (user_id, pin_code, plan, expires_at, created_by)
            VALUES (?, ?, ?, ?, ?)`,
            [userId, pinCode, plan, expiresAt, createdBy]
        );

        logger.info(`🔐 PIN generated for user ${userId}: ${pinCode}`);

        return {
            id: result.insertId,
            userId,
            pinCode,
            plan,
            expiresAt
        };
    }

    // ============================================
    // VALIDATE PIN (For login)
    // ============================================
    static async validate(userId, pinCode) {
        const [rows] = await query(
            `SELECT * FROM user_pins
            WHERE user_id = ? AND pin_code = ? AND is_active = 1 AND expires_at > NOW()`,
            [userId, pinCode]
        );

        if (rows.length === 0) return null;

        // Update last_used
        await query(
            'UPDATE user_pins SET last_used = NOW(), used_at = NOW() WHERE id = ?',
            [rows[0].id]
        );

        return rows[0];
    }

    // ============================================
    // GET USER PINS
    // ============================================
    static async getUserPins(userId) {
        const [rows] = await query(
            `SELECT * FROM user_pins
            WHERE user_id = ?
            ORDER BY created_at DESC`,
            [userId]
        );
        return rows;
    }

    // ============================================
    // GET ACTIVE PIN
    // ============================================
    static async getActivePin(userId) {
        const [rows] = await query(
            `SELECT * FROM user_pins
            WHERE user_id = ? AND is_active = 1 AND expires_at > NOW()
            ORDER BY created_at DESC
            LIMIT 1`,
            [userId]
        );
        return rows[0] || null;
    }

    // ============================================
    // REVOKE PIN
    // ============================================
    static async revoke(userId, pinCode) {
        const [result] = await query(
            `UPDATE user_pins
            SET is_active = 0, revoked_at = NOW()
            WHERE user_id = ? AND pin_code = ? AND is_active = 1`,
            [userId, pinCode]
        );

        if (result.affectedRows > 0) {
            logger.info(`🔐 PIN revoked for user ${userId}: ${pinCode}`);
            return true;
        }
        return false;
    }

    // ============================================
    // REVOKE EXPIRED PINS (Cron job)
    // ============================================
    static async revokeExpired() {
        const [result] = await query(
            `UPDATE user_pins
            SET is_active = 0, revoked_at = NOW()
            WHERE is_active = 1 AND expires_at < NOW()`
        );
        return result.affectedRows;
    }

    // ============================================
    // GET STATS
    // ============================================
    static async getStats() {
        const [stats] = await query(
            `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as revoked,
                SUM(CASE WHEN is_active = 1 AND expires_at > NOW() THEN 1 ELSE 0 END) as valid
            FROM user_pins`
        );
        return stats[0];
    }

    // ============================================
    // GET ALL PINS (Admin)
    // ============================================
    static async getAll(limit = 100) {
        const [rows] = await query(
            `SELECT up.*, CONCAT(u.firstname, ' ', u.lastname) as user_name, u.phone
            FROM user_pins up
            LEFT JOIN users u ON up.user_id = u.id
            ORDER BY up.created_at DESC
            LIMIT ?`,
            [limit]
        );
        return rows;
    }
}

module.exports = Pin;