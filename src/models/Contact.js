// src/models/Contact.js - Contact Message Model
const { pool, query } = require('../config/database');
const logger = require('../utils/logger');

class Contact {
    // ============================================
    // CREATE CONTACT MESSAGE
    // ============================================
    static async create(data) {
        const { name, email, subject, message } = data;

        const [result] = await query(
            `INSERT INTO contact_messages (name, email, subject, message, status)
            VALUES (?, ?, ?, ?, 'new')`,
            [name.trim(), email.trim(), subject.trim(), message.trim()]
        );

        logger.info(`📧 Contact message received: ${result.insertId} from ${email}`);
        return { id: result.insertId, ...data };
    }

    // ============================================
    // GET MESSAGE BY ID
    // ============================================
    static async getById(id) {
        const [rows] = await query(
            'SELECT * FROM contact_messages WHERE id = ?',
            [id]
        );
        return rows[0] || null;
    }

    // ============================================
    // GET ALL MESSAGES (Admin)
    // ============================================
    static async getAll({ status = null, page = 1, limit = 20 } = {}) {
        const offset = (page - 1) * limit;
        let conditions = [];
        let params = [];

        if (status && status !== 'all') {
            conditions.push('status = ?');
            params.push(status);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const [rows] = await query(
            `SELECT * FROM contact_messages
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );

        const [countResult] = await query(
            `SELECT COUNT(*) as total FROM contact_messages ${whereClause}`,
            params
        );

        // Get status counts
        const [statusCounts] = await query(
            `SELECT status, COUNT(*) as count FROM contact_messages GROUP BY status`
        );

        return {
            messages: rows,
            statusCounts,
            pagination: {
                total: countResult[0].total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        };
    }

    // ============================================
    // UPDATE STATUS
    // ============================================
    static async updateStatus(id, status) {
        const validStatus = ['new', 'read', 'replied'];
        if (!validStatus.includes(status)) {
            throw new Error('Invalid status');
        }

        await query(
            'UPDATE contact_messages SET status = ? WHERE id = ?',
            [status, id]
        );

        return true;
    }

    // ============================================
    // MARK AS REPLIED
    // ============================================
    static async markReplied(id, reply) {
        await query(
            `UPDATE contact_messages 
            SET status = 'replied', replied_at = NOW() 
            WHERE id = ?`,
            [id]
        );

        logger.info(`📧 Contact message ${id} marked as replied`);
        return true;
    }

    // ============================================
    // DELETE MESSAGE
    // ============================================
    static async delete(id) {
        const [result] = await query(
            'DELETE FROM contact_messages WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            throw new Error('Message not found');
        }

        logger.info(`📧 Contact message ${id} deleted`);
        return true;
    }

    // ============================================
    // GET STATS
    // ============================================
    static async getStats() {
        const [stats] = await query(
            `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new,
                SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read,
                SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END) as replied,
                SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today
            FROM contact_messages`
        );
        return stats[0];
    }
}

module.exports = Contact;