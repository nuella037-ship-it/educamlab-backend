// src/models/Payment.js - Cash Payment Model
const { pool, query } = require('../config/database');
const logger = require('../utils/logger');

class Payment {
    // ============================================
    // CREATE PAYMENT (Cash)
    // ============================================
    static async create(paymentData) {
        const {
            userId,
            amount,
            currency = 'XAF',
            subscriptionType,
            transactionId,
            status = 'pending',
            pin = null,
            notes = null,
            reference = null
        } = paymentData;

        const [result] = await query(
            `INSERT INTO payments 
            (user_id, amount, currency, subscription_type, transaction_id, status, pin, notes, reference)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, amount, currency, subscriptionType, transactionId, status, pin, notes, reference]
        );

        logger.info(`💰 Cash payment created: ${result.insertId} for user ${userId}`);
        return { id: result.insertId, ...paymentData };
    }

    // ============================================
    // GET PAYMENT BY ID
    // ============================================
    static async getById(id) {
        const [rows] = await query(
            `SELECT p.*, CONCAT(u.firstname, ' ', u.lastname) as user_name, u.phone as user_phone
            FROM payments p
            LEFT JOIN users u ON p.user_id = u.id
            WHERE p.id = ?`,
            [id]
        );
        return rows[0] || null;
    }

    // ============================================
    // GET PAYMENT BY TRANSACTION ID
    // ============================================
    static async getByTransactionId(transactionId) {
        const [rows] = await query(
            `SELECT p.*, CONCAT(u.firstname, ' ', u.lastname) as user_name
            FROM payments p
            LEFT JOIN users u ON p.user_id = u.id
            WHERE p.transaction_id = ?`,
            [transactionId]
        );
        return rows[0] || null;
    }

    // ============================================
    // GET USER PAYMENTS
    // ============================================
    static async getUserPayments(userId, limit = 20) {
        const [rows] = await query(
            `SELECT * FROM payments
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ?`,
            [userId, limit]
        );
        return rows;
    }

    // ============================================
    // UPDATE PAYMENT STATUS
    // ============================================
    static async updateStatus(id, status, data = {}) {
        const fields = ['status = ?'];
        const values = [status];

        if (status === 'completed') {
            fields.push('completed_at = NOW()');
        }

        if (data.pin) {
            fields.push('pin = ?');
            values.push(data.pin);
        }

        values.push(id);

        await query(
            `UPDATE payments SET ${fields.join(', ')} WHERE id = ?`,
            values
        );

        logger.info(`💰 Payment ${id} status updated to ${status}`);
        return true;
    }

    // ============================================
    // GET PAYMENT STATS
    // ============================================
    static async getStats() {
        const [stats] = await query(
            `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as confirmed,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as revenue,
                COUNT(DISTINCT user_id) as unique_customers
            FROM payments`
        );
        return stats[0];
    }

    // ============================================
    // GET REVENUE BY PERIOD
    // ============================================
    static async getRevenueByPeriod(period = 'monthly') {
        let dateFormat;
        let groupBy;

        switch (period) {
            case 'daily':
                dateFormat = '%Y-%m-%d';
                groupBy = 'DATE(created_at)';
                break;
            case 'monthly':
                dateFormat = '%Y-%m';
                groupBy = 'DATE_FORMAT(created_at, "%Y-%m")';
                break;
            case 'yearly':
                dateFormat = '%Y';
                groupBy = 'YEAR(created_at)';
                break;
            default:
                dateFormat = '%Y-%m';
                groupBy = 'DATE_FORMAT(created_at, "%Y-%m")';
        }

        const [rows] = await query(
            `SELECT 
                DATE_FORMAT(created_at, ?) as period,
                COUNT(*) as count,
                SUM(amount) as revenue,
                SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as successful_revenue
            FROM payments
            WHERE status != 'pending'
            GROUP BY ${groupBy}
            ORDER BY period DESC
            LIMIT 12`,
            [dateFormat]
        );

        return rows;
    }

    // ============================================
    // GET REVENUE BY PLAN
    // ============================================
    static async getRevenueByPlan() {
        const [rows] = await query(
            `SELECT 
                subscription_type as plan,
                COUNT(*) as count,
                SUM(amount) as revenue,
                AVG(amount) as avg_amount,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_count
            FROM payments
            WHERE status = 'completed'
            GROUP BY subscription_type
            ORDER BY revenue DESC`
        );
        return rows;
    }

    // ============================================
    // DELETE PAYMENT
    // ============================================
    static async delete(id) {
        const [result] = await query(
            'DELETE FROM payments WHERE id = ? AND status != "completed"',
            [id]
        );
        return result.affectedRows > 0;
    }
}

module.exports = Payment;