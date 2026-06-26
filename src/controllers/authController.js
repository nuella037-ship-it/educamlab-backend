// src/controllers/authController.js - Complete Auth with PIN Login
const User = require('../models/User');
const Pin = require('../models/Pin');
const jwt = require('jsonwebtoken');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');
const { pool } = require('../config/database');
const logger = require('../utils/logger');
const { validators } = require('../middleware/validation');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// ============================================
// TOKEN GENERATORS
// ============================================

const generateToken = (userId) => {
    return jwt.sign(
        { userId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

const generateRefreshToken = (userId) => {
    return jwt.sign(
        { userId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
    );
};

// ============================================
// REGISTER
// ============================================

const register = async (req, res) => {
    try {
        const { firstname, lastname, email, phone, password } = req.body;

        const errors = validators.register(req.body);
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }

        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        const existingPhone = await User.findByPhone(phone);
        if (existingPhone) {
            return res.status(400).json({
                success: false,
                message: 'Phone number already registered'
            });
        }

        const user = await User.create({ firstname, lastname, email, phone, password });

        const emailResult = await emailService.sendVerificationEmail(user, user.verificationCode);
        
        if (!emailResult.success) {
            logger.warn(`⚠️ Failed to send verification email to ${email}: ${emailResult.error}`);
        }

        const token = generateToken(user.id);
        const refreshToken = generateRefreshToken(user.id);

        logger.info(`✅ User registered: ${email} (ID: ${user.id})`);

        res.status(201).json({
            success: true,
            message: 'Registration successful. Please check your email for verification code.',
            data: {
                userId: user.id,
                email: user.email,
                phone: user.phone,
                token,
                refreshToken
            }
        });

    } catch (error) {
        logger.error('❌ Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Registration failed. Please try again.'
        });
    }
};

// ============================================
// LOGIN - Phone + Password OR Phone + PIN
// ============================================

const login = async (req, res) => {
    try {
        const { phone, password, pin } = req.body;

        if (!phone && !password && !pin) {
            return res.status(400).json({
                success: false,
                message: 'Phone number and password/PIN are required'
            });
        }

        if (!phone) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required'
            });
        }

        // Find user by phone
        let user = await User.findByPhone(phone);

        if (!user) {
            logger.warn(`⚠️ Failed login attempt for phone: ${phone}`);
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        if (!user.is_verified) {
            return res.status(403).json({
                success: false,
                message: 'Account not verified. Please check your email for verification code.',
                requiresVerification: true,
                userId: user.id
            });
        }

        // Check credentials
        let isValid = false;
        let loginMethod = '';

        // Try password
        if (password) {
            isValid = await User.validatePassword(user.id, password);
            if (isValid) loginMethod = 'password';
        }

        // Try PIN if password failed
        if (!isValid && pin) {
            isValid = await User.validatePin(user.id, pin);
            if (isValid) loginMethod = 'pin';
        }

        if (!isValid) {
            logger.warn(`⚠️ Failed login attempt for phone: ${phone}`);
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate tokens
        const token = generateToken(user.id);
        const refreshToken = generateRefreshToken(user.id);

        // Log activity
        await User.logActivity(
            user.id,
            'login',
            `User logged in with ${loginMethod}`,
            req.ip,
            req.headers['user-agent']
        );

        // Check subscription
        const subscription = await User.hasActiveSubscription(user.id);

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    id: user.id,
                    firstname: user.firstname,
                    lastname: user.lastname,
                    email: user.email,
                    phone: user.phone,
                    role: user.role,
                    isVerified: user.is_verified,
                    subscriptionType: user.subscription_type,
                    subscriptionExpires: user.subscription_expires,
                    hasActiveSubscription: !!subscription
                },
                token,
                refreshToken
            }
        });

    } catch (error) {
        logger.error('❌ Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed. Please try again.'
        });
    }
};

// ============================================
// REFRESH TOKEN
// ============================================

const refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: 'Refresh token is required'
            });
        }

        let decoded;
        try {
            decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
        } catch (error) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired refresh token'
            });
        }

        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        const newToken = generateToken(user.id);
        const newRefreshToken = generateRefreshToken(user.id);

        res.status(200).json({
            success: true,
            data: {
                token: newToken,
                refreshToken: newRefreshToken
            }
        });

    } catch (error) {
        logger.error('❌ Refresh token error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to refresh token'
        });
    }
};

// ============================================
// VERIFY OTP
// ============================================

const verifyOTP = async (req, res) => {
    try {
        const { userId, code } = req.body;

        if (!userId || !code) {
            return res.status(400).json({
                success: false,
                message: 'User ID and verification code are required'
            });
        }

        const success = await User.verify(userId, code);
        if (!success) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired verification code'
            });
        }

        await User.logActivity(
            userId,
            'verification',
            'Account verified successfully',
            req.ip,
            req.headers['user-agent']
        );

        const user = await User.findById(userId);
        await emailService.sendWelcomeEmail(user);

        res.status(200).json({
            success: true,
            message: 'Account verified successfully'
        });

    } catch (error) {
        logger.error('❌ Verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Verification failed. Please try again.'
        });
    }
};

// ============================================
// RESEND OTP
// ============================================

const resendOTP = async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.is_verified) {
            return res.status(400).json({
                success: false,
                message: 'Account is already verified'
            });
        }

        const code = await User.resendVerificationCode(userId);
        
        const emailResult = await emailService.sendVerificationEmail(user, code);
        
        if (!emailResult.success) {
            logger.error(`❌ Failed to resend verification email to ${user.email}: ${emailResult.error}`);
            return res.status(500).json({
                success: false,
                message: 'Failed to send verification code. Please try again.'
            });
        }

        logger.info(`📧 Resent verification code to ${user.email}`);

        res.status(200).json({
            success: true,
            message: 'Verification code sent successfully. Please check your email.'
        });

    } catch (error) {
        logger.error('❌ Resend OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to resend code. Please try again.'
        });
    }
};

// ============================================
// FORGOT PASSWORD
// ============================================

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Valid email address is required'
            });
        }

        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(200).json({
                success: true,
                message: 'If an account exists with this email, a reset link has been sent'
            });
        }

        const token = await User.createResetToken(email);
        
        const emailResult = await emailService.sendPasswordResetEmail(user, token);
        
        if (!emailResult.success) {
            logger.error(`❌ Failed to send password reset email to ${email}: ${emailResult.error}`);
        }

        logger.info(`📧 Password reset requested for ${email}`);

        res.status(200).json({
            success: true,
            message: 'If an account exists with this email, a reset link has been sent'
        });

    } catch (error) {
        logger.error('❌ Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process request. Please try again.'
        });
    }
};

// ============================================
// RESET PASSWORD
// ============================================

const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Token and new password are required'
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters'
            });
        }

        if (!/[A-Z]/.test(newPassword)) {
            return res.status(400).json({
                success: false,
                message: 'Password must contain at least one uppercase letter'
            });
        }
        if (!/[a-z]/.test(newPassword)) {
            return res.status(400).json({
                success: false,
                message: 'Password must contain at least one lowercase letter'
            });
        }
        if (!/[0-9]/.test(newPassword)) {
            return res.status(400).json({
                success: false,
                message: 'Password must contain at least one number'
            });
        }
        if (!/[^a-zA-Z0-9]/.test(newPassword)) {
            return res.status(400).json({
                success: false,
                message: 'Password must contain at least one special character'
            });
        }

        const success = await User.resetPassword(token, newPassword);
        if (!success) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }

        logger.info(`✅ Password reset completed successfully`);

        res.status(200).json({
            success: true,
            message: 'Password reset successfully'
        });

    } catch (error) {
        logger.error('❌ Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset password. Please try again.'
        });
    }
};

// ============================================
// GET PROFILE
// ============================================

const getMe = async (req, res) => {
    try {
        const userId = req.userId;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const subscription = await User.hasActiveSubscription(userId);
        const activePin = await Pin.getActivePin(userId);

        res.status(200).json({
            success: true,
            data: {
                ...user,
                hasActiveSubscription: !!subscription,
                hasActivePin: !!activePin
            }
        });

    } catch (error) {
        logger.error('❌ Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get profile'
        });
    }
};

// ============================================
// UPDATE PROFILE
// ============================================

const updateProfile = async (req, res) => {
    try {
        const { firstname, lastname, phone } = req.body;
        const userId = req.userId;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const updates = {};
        if (firstname) {
            if (firstname.length < 2 || firstname.length > 50) {
                return res.status(400).json({
                    success: false,
                    message: 'First name must be between 2 and 50 characters'
                });
            }
            updates.firstname = firstname.trim();
        }
        if (lastname) {
            if (lastname.length < 2 || lastname.length > 50) {
                return res.status(400).json({
                    success: false,
                    message: 'Last name must be between 2 and 50 characters'
                });
            }
            updates.lastname = lastname.trim();
        }
        if (phone) {
            if (!/^[0-9]{9}$/.test(phone)) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid 9-digit phone number is required'
                });
            }
            const existingPhone = await User.findByPhone(phone);
            if (existingPhone && existingPhone.id !== userId) {
                return res.status(400).json({
                    success: false,
                    message: 'Phone number already in use'
                });
            }
            updates.phone = phone;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        const fields = [];
        const values = [];
        for (const [key, value] of Object.entries(updates)) {
            fields.push(`${key} = ?`);
            values.push(value);
        }
        values.push(userId);

        await pool.query(
            `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
            values
        );

        const user = await User.findById(userId);

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: user
        });

    } catch (error) {
        logger.error('❌ Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile'
        });
    }
};

// ============================================
// CHANGE PASSWORD
// ============================================

const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password and new password are required'
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 8 characters'
            });
        }

        const isValid = await User.validatePassword(userId, currentPassword);
        
        if (!isValid) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        await pool.query(
            'UPDATE users SET password_hash = ? WHERE id = ?',
            [passwordHash, userId]
        );

        await User.logActivity(
            userId,
            'password_change',
            'Password changed successfully',
            req.ip,
            req.headers['user-agent']
        );

        res.status(200).json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        logger.error('❌ Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to change password. Please try again.'
        });
    }
};

// ============================================
// LOGOUT
// ============================================

const logout = async (req, res) => {
    try {
        if (req.userId) {
            await User.logActivity(
                req.userId,
                'logout',
                'User logged out',
                req.ip,
                req.headers['user-agent']
            );
        }
        res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        logger.error('❌ Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Logout failed'
        });
    }
};

module.exports = {
    register,
    login,
    refreshToken,
    verifyOTP,
    resendOTP,
    forgotPassword,
    resetPassword,
    getMe,
    updateProfile,
    changePassword,
    logout
};