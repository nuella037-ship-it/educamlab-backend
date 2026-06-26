// src/controllers/userController.js - Complete User Controller
const { pool } = require('../config/database');
const User = require('../models/User');
const Course = require('../models/Course');
const Payment = require('../models/Payment');
const Pin = require('../models/Pin');
const logger = require('../utils/logger');

// ============================================
// GET USER DASHBOARD STATS
// ============================================
const getDashboardStats = async (req, res) => {
    try {
        const userId = req.userId;

        // Get enrolled courses
        const enrolledCourses = await Course.getUserCourses(userId);
        
        // Get active subscription
        const subscription = await User.hasActiveSubscription(userId);

        // Get user payments
        const payments = await Payment.getUserPayments(userId);

        // Get user pins
        const pins = await Pin.getUserPins(userId);

        // Get user activity
        const [activities] = await pool.query(
            `SELECT * FROM user_activities 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT 10`,
            [userId]
        );

        // Calculate stats
        const totalEnrolled = enrolledCourses.length;
        const completed = enrolledCourses.filter(c => c.status === 'completed').length;
        const inProgress = enrolledCourses.filter(c => c.status === 'active').length;
        const avgProgress = totalEnrolled > 0 
            ? Math.round(enrolledCourses.reduce((sum, c) => sum + c.progress, 0) / totalEnrolled)
            : 0;

        // Get review stats
        const [reviewStats] = await pool.query(
            `SELECT COUNT(*) as total_reviews, AVG(rating) as avg_rating 
            FROM course_reviews 
            WHERE user_id = ?`,
            [userId]
        );

        res.status(200).json({
            success: true,
            data: {
                enrolledCourses,
                subscription: subscription || null,
                payments: payments,
                pins: pins,
                recentActivity: activities,
                stats: {
                    totalEnrolled,
                    completed,
                    inProgress,
                    avgProgress
                },
                reviewStats: {
                    total: reviewStats[0].total_reviews || 0,
                    avgRating: parseFloat(reviewStats[0].avg_rating || 0)
                }
            }
        });

    } catch (error) {
        logger.error('❌ Dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard stats'
        });
    }
};

// ============================================
// GET USER PROFILE
// ============================================
const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const subscription = await User.hasActiveSubscription(req.userId);
        const pins = await Pin.getUserPins(req.userId);

        res.status(200).json({
            success: true,
            data: {
                ...user,
                hasActiveSubscription: !!subscription,
                pins: pins
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
// UPDATE USER PROFILE
// ============================================
const updateProfile = async (req, res) => {
    try {
        const { firstname, lastname, phone } = req.body;
        const userId = req.userId;

        const updates = {};
        if (firstname !== undefined) {
            if (firstname.length < 2 || firstname.length > 50) {
                return res.status(400).json({
                    success: false,
                    message: 'First name must be between 2 and 50 characters'
                });
            }
            updates.firstname = firstname.trim();
        }
        if (lastname !== undefined) {
            if (lastname.length < 2 || lastname.length > 50) {
                return res.status(400).json({
                    success: false,
                    message: 'Last name must be between 2 and 50 characters'
                });
            }
            updates.lastname = lastname.trim();
        }
        if (phone !== undefined) {
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

module.exports = {
    getDashboardStats,
    getProfile,
    updateProfile
};