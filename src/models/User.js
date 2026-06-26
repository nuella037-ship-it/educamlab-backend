// src/models/User.js - Complete User Model with PIN Support
const { pool, query, withTransaction } = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const logger = require('../utils/logger');

class User {
    // ============================================
    // FIND METHODS
    // ============================================

    static async findByEmail(email) {
        const [rows] = await query(
            'SELECT * FROM users WHERE email = ?',
            [email.toLowerCase().trim()]
        );
        return rows[0] || null;
    }

    static async findByPhone(phone) {
        const [rows] = await query(
            'SELECT * FROM users WHERE phone = ?',
            [phone.trim()]
        );
        return rows[0] || null;
    }

    static async findById(id) {
        const [rows] = await query(
            `SELECT id, firstname, lastname, email, phone, role, is_verified, 
                    subscription_type, subscription_expires, created_at, updated_at,
                    pin, last_pin_generated_at, last_pin_used_at
            FROM users WHERE id = ?`,
            [id]
        );
        return rows[0] || null;
    }

    static async findByEmailOrPhone(identifier) {
        const [rows] = await query(
            'SELECT * FROM users WHERE email = ? OR phone = ?',
            [identifier.trim(), identifier.trim()]
        );
        return rows[0] || null;
    }

    // ============================================
    // CREATE USER
    // ============================================

    static async create(userData) {
        const { firstname, lastname, email, phone, password } = userData;
        
        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(password, salt);
        
        const verificationCode = crypto.randomInt(100000, 999999).toString();
        const codeExpires = new Date(Date.now() + 10 * 60 * 1000);

        const [result] = await query(
            `INSERT INTO users 
            (firstname, lastname, email, phone, password_hash, role, 
             verification_code, verification_code_expires) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                firstname.trim(),
                lastname.trim(),
                email.toLowerCase().trim(),
                phone.trim(),
                passwordHash,
                'user',
                verificationCode,
                codeExpires
            ]
        );

        const user = await this.findById(result.insertId);
        logger.info(`👤 User created: ${email} (ID: ${result.insertId})`);
        return { ...user, verificationCode };
    }

    // ============================================
    // VERIFICATION
    // ============================================

    static async verify(userId, code) {
        const [rows] = await query(
            `SELECT id FROM users 
            WHERE id = ? AND verification_code = ? AND verification_code_expires > NOW()`,
            [userId, code]
        );

        if (rows.length === 0) return false;

        await query(
            `UPDATE users 
            SET is_verified = TRUE, verification_code = NULL, verification_code_expires = NULL 
            WHERE id = ?`,
            [userId]
        );

        logger.info(`✅ User verified: ${userId}`);
        return true;
    }

    static async resendVerificationCode(userId) {
        const verificationCode = crypto.randomInt(100000, 999999).toString();
        const codeExpires = new Date(Date.now() + 10 * 60 * 1000);

        await query(
            `UPDATE users 
            SET verification_code = ?, verification_code_expires = ? 
            WHERE id = ?`,
            [verificationCode, codeExpires, userId]
        );

        return verificationCode;
    }

    // ============================================
    // AUTHENTICATION
    // ============================================

    static async validateCredentials(email, password) {
        const user = await this.findByEmail(email);
        if (!user) return null;

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) return null;

        return user;
    }

    static async validatePassword(userId, password) {
        const [rows] = await query(
            'SELECT password_hash FROM users WHERE id = ?',
            [userId]
        );
        if (rows.length === 0) return false;
        return await bcrypt.compare(password, rows[0].password_hash);
    }

    static async validatePin(userId, pin) {
        const [rows] = await query(
            'SELECT pin FROM users WHERE id = ?',
            [userId]
        );
        if (!rows[0] || !rows[0].pin) return false;
        
        const isValid = await bcrypt.compare(pin, rows[0].pin);
        if (isValid) {
            await query(
                'UPDATE users SET last_pin_used_at = NOW() WHERE id = ?',
                [userId]
            );
        }
        return isValid;
    }

    static async getUserPin(userId) {
        const [rows] = await query(
            'SELECT pin FROM users WHERE id = ?',
            [userId]
        );
        return rows[0]?.pin || null;
    }

    // ============================================
    // SUBSCRIPTION
    // ============================================

    static async updateSubscription(userId, subscriptionType, durationDays) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + durationDays);

        await query(
            `UPDATE users 
            SET subscription_type = ?, subscription_expires = ? 
            WHERE id = ?`,
            [subscriptionType, expiresAt, userId]
        );

        logger.info(`📋 Subscription updated: User ${userId} -> ${subscriptionType}`);
        return await this.findById(userId);
    }

    static async hasActiveSubscription(userId) {
        const [rows] = await query(
            `SELECT subscription_type, subscription_expires 
            FROM users 
            WHERE id = ? AND subscription_type != 'none' AND subscription_expires > NOW()`,
            [userId]
        );
        return rows.length > 0 ? rows[0] : null;
    }

    // ============================================
    // PIN MANAGEMENT
    // ============================================

    static async updatePin(userId, pin) {
        const salt = await bcrypt.genSalt(12);
        const hashedPin = await bcrypt.hash(pin, salt);
        await query(
            'UPDATE users SET pin = ?, last_pin_generated_at = NOW() WHERE id = ?',
            [hashedPin, userId]
        );
        logger.info(`🔐 PIN updated for user: ${userId}`);
        return true;
    }

    static async clearPin(userId) {
        await query(
            'UPDATE users SET pin = NULL WHERE id = ?',
            [userId]
        );
        logger.info(`🔐 PIN cleared for user: ${userId}`);
        return true;
    }

    // ============================================
    // PASSWORD RESET
    // ============================================

    static async createResetToken(email) {
        const user = await this.findByEmail(email);
        if (!user) return null;

        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        await query(
            `UPDATE users 
            SET reset_token = ?, reset_token_expires = ? 
            WHERE id = ?`,
            [resetToken, expiresAt, user.id]
        );

        return resetToken;
    }

    static async resetPassword(token, newPassword) {
        const [rows] = await query(
            `SELECT id FROM users 
            WHERE reset_token = ? AND reset_token_expires > NOW()`,
            [token]
        );

        if (rows.length === 0) return false;

        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        await query(
            `UPDATE users 
            SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL 
            WHERE id = ?`,
            [passwordHash, rows[0].id]
        );

        logger.info(`🔑 Password reset completed for user: ${rows[0].id}`);
        return true;
    }

    // ============================================
    // ROLE MANAGEMENT
    // ============================================

    static async isAdmin(userId) {
        const [rows] = await query(
            'SELECT role FROM users WHERE id = ?',
            [userId]
        );
        return rows.length > 0 && ['admin', 'super_admin'].includes(rows[0].role);
    }

    static async updateRole(userId, role) {
        const validRoles = ['user', 'admin', 'moderator', 'super_admin'];
        if (!validRoles.includes(role)) {
            throw new Error('Invalid role');
        }

        await query(
            'UPDATE users SET role = ? WHERE id = ?',
            [role, userId]
        );
        logger.info(`👤 Role updated for user ${userId}: ${role}`);
        return true;
    }

    // ============================================
    // ACTIVITY LOGGING
    // ============================================

    static async logActivity(userId, activityType, description, ipAddress = null, userAgent = null) {
        try {
            await query(
                `INSERT INTO user_activities 
                (user_id, activity_type, description, ip_address, user_agent) 
                VALUES (?, ?, ?, ?, ?)`,
                [userId, activityType, description, ipAddress, userAgent]
            );
            return true;
        } catch (error) {
            logger.error('❌ Log activity error:', error);
            return false;
        }
    }

    // ============================================
    // USER LISTING (Admin)
    // ============================================

    static async getAllUsers({ page = 1, limit = 20, search = null, role = null, isVerified = null } = {}) {
        const offset = (page - 1) * limit;
        let conditions = [];
        const params = [];

        if (search) {
            conditions.push('(firstname LIKE ? OR lastname LIKE ? OR email LIKE ? OR phone LIKE ?)');
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        if (role) {
            conditions.push('role = ?');
            params.push(role);
        }

        if (isVerified !== null) {
            conditions.push('is_verified = ?');
            params.push(isVerified === 'true' ? 1 : 0);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const [rows] = await query(
            `SELECT id, firstname, lastname, email, phone, role, is_verified, 
                    subscription_type, subscription_expires, created_at, updated_at,
                    pin, last_pin_generated_at
            FROM users 
            ${whereClause}
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );

        const [countResult] = await query(
            `SELECT COUNT(*) as total FROM users ${whereClause}`,
            params
        );

        return {
            users: rows,
            pagination: {
                total: countResult[0].total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        };
    }

    // ============================================
    // DELETE USER
    // ============================================

    static async delete(id) {
        const user = await this.findById(id);
        if (!user) {
            throw new Error('User not found');
        }

        if (user.role === 'admin' || user.role === 'super_admin') {
            const [adminCount] = await query(
                'SELECT COUNT(*) as count FROM users WHERE role IN ("admin", "super_admin")'
            );
            if (adminCount[0].count <= 1) {
                throw new Error('Cannot delete the last admin account');
            }
        }

        await query('DELETE FROM users WHERE id = ?', [id]);
        logger.info(`🗑️ User deleted: ${id} (${user.email})`);
        return true;
    }

    // ============================================
    // STATS
    // ============================================

    static async getStats() {
        const [userStats] = await query(
            `SELECT 
                COUNT(*) as total_users,
                SUM(CASE WHEN is_verified = 1 THEN 1 ELSE 0 END) as verified_users,
                SUM(CASE WHEN role IN ('admin', 'super_admin') THEN 1 ELSE 0 END) as admin_users,
                SUM(CASE WHEN subscription_type != 'none' AND subscription_expires > NOW() THEN 1 ELSE 0 END) as subscribed_users,
                SUM(CASE WHEN pin IS NOT NULL THEN 1 ELSE 0 END) as users_with_pin
            FROM users`
        );
        return userStats[0];
    }
}

module.exports = User;