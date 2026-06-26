// src/utils/security.js - Security Utilities
const crypto = require('crypto');

// ============================================
// GENERATE SECURE PIN
// ============================================
const generateSecurePin = (length = 6) => {
    // Use characters that are easy to read and type
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let pin = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = crypto.randomInt(0, chars.length);
        pin += chars[randomIndex];
    }
    return pin;
};

// ============================================
// GENERATE RANDOM OTP
// ============================================
const generateOTP = (length = 6) => {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
        otp += digits[crypto.randomInt(0, digits.length)];
    }
    return otp;
};

// ============================================
// GENERATE CSRF TOKEN
// ============================================
const generateCSRFToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

// ============================================
// HASH DATA
// ============================================
const hashData = (data) => {
    return crypto.createHash('sha256').update(data).digest('hex');
};

// ============================================
// ENCRYPT DATA
// ============================================
const encryptData = (text) => {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.JWT_SECRET || 'default-secret-key', 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
};

// ============================================
// DECRYPT DATA
// ============================================
const decryptData = (text) => {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.JWT_SECRET || 'default-secret-key', 'salt', 32);
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
};

// ============================================
// VALIDATE PHONE NUMBER
// ============================================
const validatePhone = (phone) => {
    // Remove any non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    // Check if it's exactly 9 digits (Cameroon format)
    return /^[0-9]{9}$/.test(cleaned);
};

// ============================================
// FORMAT PHONE NUMBER
// ============================================
const formatPhone = (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 9) {
        return cleaned;
    }
    if (cleaned.length > 9) {
        return cleaned.slice(-9);
    }
    return cleaned;
};

module.exports = {
    generateSecurePin,
    generateOTP,
    generateCSRFToken,
    hashData,
    encryptData,
    decryptData,
    validatePhone,
    formatPhone
};