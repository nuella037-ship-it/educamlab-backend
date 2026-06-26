// src/controllers/contactController.js - Complete Contact Controller
const Contact = require('../models/Contact');
const User = require('../models/User');
const emailService = require('../services/emailService');
const logger = require('../utils/logger');

// ============================================
// SUBMIT CONTACT MESSAGE
// ============================================
const submitContact = async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        if (!name || !email || !subject || !message) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Validate email
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email address'
            });
        }

        const contact = await Contact.create({ name, email, subject, message });

        // Send admin notification
        try {
            await emailService.sendAdminNotification(contact);
        } catch (emailError) {
            logger.warn(`⚠️ Failed to send admin notification: ${emailError.message}`);
        }

        logger.info(`📧 Contact message received from ${email}`);

        res.status(201).json({
            success: true,
            message: 'Your message has been sent. We\'ll get back to you soon!',
            data: { id: contact.id }
        });

    } catch (error) {
        logger.error('❌ Contact error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send message. Please try again.'
        });
    }
};

// ============================================
// ADMIN: GET CONTACT MESSAGES
// ============================================
const getContactMessages = async (req, res) => {
    try {
        const { status = null, page = 1, limit = 20 } = req.query;
        const result = await Contact.getAll({ status, page, limit });

        res.status(200).json({
            success: true,
            data: result.messages,
            statusCounts: result.statusCounts,
            pagination: result.pagination
        });

    } catch (error) {
        logger.error('❌ Get messages error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch messages'
        });
    }
};

// ============================================
// ADMIN: GET CONTACT MESSAGE BY ID
// ============================================
const getContactMessageById = async (req, res) => {
    try {
        const { id } = req.params;
        const message = await Contact.getById(id);

        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // Mark as read if new
        if (message.status === 'new') {
            await Contact.updateStatus(id, 'read');
            message.status = 'read';
        }

        res.status(200).json({
            success: true,
            data: message
        });

    } catch (error) {
        logger.error('❌ Get message error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch message'
        });
    }
};

// ============================================
// ADMIN: REPLY TO CONTACT MESSAGE
// ============================================
const replyToContact = async (req, res) => {
    try {
        const { id } = req.params;
        const { reply } = req.body;

        if (!reply) {
            return res.status(400).json({
                success: false,
                message: 'Reply message is required'
            });
        }

        const message = await Contact.getById(id);
        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // Mark as replied
        await Contact.markReplied(id, reply);

        // Send reply email
        try {
            await emailService.sendContactReply(message, reply);
        } catch (emailError) {
            logger.warn(`⚠️ Failed to send reply email: ${emailError.message}`);
        }

        // Log activity
        await User.logActivity(
            req.userId,
            'admin',
            `Replied to contact message ${id}`,
            req.ip,
            req.headers['user-agent']
        );

        logger.info(`📧 Replied to contact message ${id}`);

        res.status(200).json({
            success: true,
            message: 'Reply sent successfully'
        });

    } catch (error) {
        logger.error('❌ Reply error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send reply'
        });
    }
};

// ============================================
// ADMIN: DELETE CONTACT MESSAGE
// ============================================
const deleteContactMessage = async (req, res) => {
    try {
        const { id } = req.params;
        await Contact.delete(id);

        res.status(200).json({
            success: true,
            message: 'Message deleted successfully'
        });

    } catch (error) {
        logger.error('❌ Delete message error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to delete message'
        });
    }
};

// ============================================
// ADMIN: GET CONTACT STATS
// ============================================
const getContactStats = async (req, res) => {
    try {
        const stats = await Contact.getStats();
        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        logger.error('❌ Contact stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch contact stats'
        });
    }
};

module.exports = {
    submitContact,
    getContactMessages,
    getContactMessageById,
    replyToContact,
    deleteContactMessage,
    getContactStats
};