// src/middleware/errorHandler.js - Production Ready
const logger = require('../utils/logger');

// ============================================
// GLOBAL ERROR HANDLER
// ============================================
const errorHandler = (err, req, res, next) => {
    // Log error with context
    logger.error('Error:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userId: req.userId,
        requestId: req.requestId
    });

    // Default error
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal server error';
    let errors = err.errors || [];

    // MySQL errors
    if (err.code) {
        switch (err.code) {
            case 'ER_DUP_ENTRY':
                statusCode = 400;
                message = 'Duplicate entry. This data already exists.';
                break;
            case 'ER_NO_REFERENCED_ROW':
                statusCode = 400;
                message = 'Referenced record does not exist.';
                break;
            case 'ER_ROW_IS_REFERENCED':
                statusCode = 400;
                message = 'Cannot delete record because it is referenced by other records.';
                break;
            case 'ER_DATA_TOO_LONG':
                statusCode = 400;
                message = 'Data is too long for the field.';
                break;
            case 'ER_TRUNCATED_WRONG_VALUE':
                statusCode = 400;
                message = 'Invalid data format.';
                break;
            case 'ER_BAD_NULL_ERROR':
                statusCode = 400;
                message = 'Required field cannot be null.';
                break;
            case 'ER_DUP_ENTRY_WITH_KEY_NAME':
                statusCode = 400;
                message = 'Duplicate entry. This value already exists.';
                break;
        }
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token. Please login again.';
    }

    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired. Please login again.';
    }

    // Validation errors
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation error';
        errors = Object.values(err.errors).map(e => e.message);
    }

    // Multer errors (file upload)
    if (err.name === 'MulterError') {
        statusCode = 400;
        switch (err.code) {
            case 'LIMIT_FILE_SIZE':
                message = 'File too large. Maximum size is 5MB.';
                break;
            case 'LIMIT_FILE_COUNT':
                message = 'Too many files uploaded.';
                break;
            case 'LIMIT_UNEXPECTED_FILE':
                message = 'Unexpected file field.';
                break;
            default:
                message = 'File upload error.';
        }
    }

    // Rate limiting errors
    if (err.name === 'RateLimitError') {
        statusCode = 429;
        message = 'Too many requests. Please slow down and try again later.';
    }

    // Send response
    const response = {
        success: false,
        message,
        ...(errors.length > 0 && { errors }),
        ...(process.env.NODE_ENV === 'development' && {
            stack: err.stack,
            code: err.code
        })
    };

    res.status(statusCode).json(response);
};

// ============================================
// 404 HANDLER
// ============================================
const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
        path: req.originalUrl,
        method: req.method
    });
};

// ============================================
// ASYNC WRAPPER
// ============================================
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

module.exports = { 
    errorHandler, 
    notFoundHandler,
    asyncHandler
};