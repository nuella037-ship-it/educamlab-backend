// src/middleware/validation.js - Complete Validation
const xss = require('xss');
const logger = require('../utils/logger');

// ============================================
// SANITIZE INPUT
// ============================================
const sanitize = (data) => {
    if (typeof data === 'string') {
        return xss(data.trim());
    }
    if (typeof data === 'object' && data !== null) {
        const sanitized = {};
        for (const [key, value] of Object.entries(data)) {
            sanitized[key] = sanitize(value);
        }
        return sanitized;
    }
    return data;
};

const sanitizeInput = (req, res, next) => {
    try {
        if (req.body) {
            req.body = sanitize(req.body);
        }
        if (req.query) {
            req.query = sanitize(req.query);
        }
        if (req.params) {
            req.params = sanitize(req.params);
        }
        next();
    } catch (error) {
        logger.error('❌ Sanitization error:', error);
        next(error);
    }
};

// ============================================
// VALIDATORS
// ============================================
const validators = {
    // User Registration
    register: (data) => {
        const errors = [];
        
        if (!data.firstname || data.firstname.length < 2 || data.firstname.length > 50) {
            errors.push('First name must be between 2 and 50 characters');
        }
        if (!data.lastname || data.lastname.length < 2 || data.lastname.length > 50) {
            errors.push('Last name must be between 2 and 50 characters');
        }
        if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            errors.push('Valid email address is required');
        }
        if (!data.phone || !/^[0-9]{9}$/.test(data.phone)) {
            errors.push('Valid 9-digit phone number is required');
        }
        if (!data.password || data.password.length < 8) {
            errors.push('Password must be at least 8 characters');
        }
        if (!/[A-Z]/.test(data.password)) {
            errors.push('Password must contain at least one uppercase letter');
        }
        if (!/[a-z]/.test(data.password)) {
            errors.push('Password must contain at least one lowercase letter');
        }
        if (!/[0-9]/.test(data.password)) {
            errors.push('Password must contain at least one number');
        }
        if (!/[^a-zA-Z0-9]/.test(data.password)) {
            errors.push('Password must contain at least one special character');
        }
        
        return errors;
    },

    // Login
    login: (data) => {
        const errors = [];
        if (!data.phone || !/^[0-9]{9}$/.test(data.phone)) {
            errors.push('Valid 9-digit phone number is required');
        }
        if (!data.password && !data.pin) {
            errors.push('Password or PIN is required');
        }
        return errors;
    },

    // Contact Message
    contact: (data) => {
        const errors = [];
        if (!data.name || data.name.length < 2 || data.name.length > 100) {
            errors.push('Name must be between 2 and 100 characters');
        }
        if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            errors.push('Valid email address is required');
        }
        if (!data.subject || data.subject.length < 3 || data.subject.length > 200) {
            errors.push('Subject must be between 3 and 200 characters');
        }
        if (!data.message || data.message.length < 10) {
            errors.push('Message must be at least 10 characters');
        }
        if (data.message && data.message.length > 2000) {
            errors.push('Message cannot exceed 2000 characters');
        }
        return errors;
    },

    // Payment Request (Cash)
    payment: (data) => {
        const errors = [];
        if (!data.plan || !['daily', 'weekly', 'monthly', 'annual'].includes(data.plan)) {
            errors.push('Valid subscription plan is required');
        }
        return errors;
    },

    // Course Creation/Update
    course: (data) => {
        const errors = [];
        if (!data.title || data.title.length < 3 || data.title.length > 200) {
            errors.push('Title must be between 3 and 200 characters');
        }
        if (!data.slug || !/^[a-z0-9-]+$/.test(data.slug)) {
            errors.push('Slug must contain only lowercase letters, numbers, and hyphens');
        }
        if (!data.description || data.description.length < 50) {
            errors.push('Description must be at least 50 characters');
        }
        if (!data.category || data.category.length < 2) {
            errors.push('Category is required');
        }
        if (data.level && !['beginner', 'intermediate', 'advanced', 'all-levels'].includes(data.level)) {
            errors.push('Invalid level');
        }
        if (data.price !== undefined && (isNaN(data.price) || data.price < 0)) {
            errors.push('Price must be a non-negative number');
        }
        return errors;
    },

    // Review
    review: (data) => {
        const errors = [];
        if (!data.rating || data.rating < 1 || data.rating > 5) {
            errors.push('Rating must be between 1 and 5');
        }
        if (data.comment && data.comment.length > 1000) {
            errors.push('Comment cannot exceed 1000 characters');
        }
        return errors;
    },

    // PIN Generation
    pin: (data) => {
        const errors = [];
        if (!data.userId) {
            errors.push('User ID is required');
        }
        if (data.plan && !['daily', 'weekly', 'monthly', 'annual'].includes(data.plan)) {
            errors.push('Invalid plan');
        }
        return errors;
    }
};

// ============================================
// VALIDATION MIDDLEWARE
// ============================================
const validate = (validator) => {
    return (req, res, next) => {
        const errors = validator(req.body);
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }
        next();
    };
};

module.exports = {
    sanitizeInput,
    validate,
    validators
};