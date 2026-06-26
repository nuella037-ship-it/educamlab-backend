// src/controllers/adminController.js - Complete Admin Controller with Cash Payment Support
const { pool, query, withTransaction } = require('../config/database');
const User = require('../models/User');
const Course = require('../models/Course');
const Payment = require('../models/Payment');
const Pin = require('../models/Pin');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');
const logger = require('../utils/logger');
const { generateSecurePin } = require('../utils/security');
const bcrypt = require('bcryptjs');

// ============================================
// DASHBOARD STATS
// ============================================

const getDashboardStats = async (req, res) => {
    try {
        // Get user stats
        const [userStats] = await pool.query(
            `SELECT 
                COUNT(*) as total_users,
                SUM(CASE WHEN is_verified = 1 THEN 1 ELSE 0 END) as verified_users,
                SUM(CASE WHEN is_verified = 0 THEN 1 ELSE 0 END) as unverified_users,
                SUM(CASE WHEN role IN ('admin', 'super_admin') THEN 1 ELSE 0 END) as admin_users,
                SUM(CASE WHEN subscription_type != 'none' AND subscription_expires > NOW() THEN 1 ELSE 0 END) as subscribed_users,
                SUM(CASE WHEN pin IS NOT NULL THEN 1 ELSE 0 END) as users_with_pin
            FROM users`
        );

        // Get course stats
        const [courseStats] = await pool.query(
            `SELECT 
                COUNT(*) as total_courses,
                SUM(CASE WHEN is_published = 1 THEN 1 ELSE 0 END) as published_courses,
                SUM(CASE WHEN is_published = 0 THEN 1 ELSE 0 END) as draft_courses,
                SUM(CASE WHEN is_featured = 1 THEN 1 ELSE 0 END) as featured_courses
            FROM courses`
        );

        // Get enrollment stats
        const [enrollmentStats] = await pool.query(
            `SELECT 
                COUNT(*) as total_enrollments,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_enrollments,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_enrollments,
                AVG(progress) as avg_progress
            FROM enrollments`
        );

        // Get payment stats (cash only)
        const [paymentStats] = await pool.query(
            `SELECT 
                COUNT(*) as total_payments,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_payments,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_payments,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_payments,
                SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_revenue,
                COUNT(DISTINCT user_id) as unique_customers
            FROM payments`
        );

        // Get PIN stats
        const [pinStats] = await pool.query(
            `SELECT 
                COUNT(*) as total_pins,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_pins,
                SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as revoked_pins
            FROM user_pins`
        );

        // Get recent activity
        const [recentActivities] = await pool.query(
            `SELECT 
                ua.*,
                CONCAT(u.firstname, ' ', u.lastname) as user_name
            FROM user_activities ua
            LEFT JOIN users u ON ua.user_id = u.id
            ORDER BY ua.created_at DESC
            LIMIT 10`
        );

        // Get recent users
        const [recentUsers] = await pool.query(
            `SELECT id, firstname, lastname, email, phone, role, created_at, is_verified, pin
            FROM users
            ORDER BY created_at DESC
            LIMIT 5`
        );

        // Get recent payments
        const [recentPayments] = await pool.query(
            `SELECT p.*, CONCAT(u.firstname, ' ', u.lastname) as user_name
            FROM payments p
            LEFT JOIN users u ON p.user_id = u.id
            ORDER BY p.created_at DESC
            LIMIT 5`
        );

        // Get recent messages
        const [recentMessages] = await pool.query(
            `SELECT * FROM contact_messages
            WHERE status = 'new'
            ORDER BY created_at DESC
            LIMIT 5`
        );

        res.status(200).json({
            success: true,
            data: {
                users: {
                    total: userStats[0].total_users || 0,
                    verified: userStats[0].verified_users || 0,
                    unverified: userStats[0].unverified_users || 0,
                    admins: userStats[0].admin_users || 0,
                    subscribed: userStats[0].subscribed_users || 0,
                    hasPin: userStats[0].users_with_pin || 0
                },
                courses: {
                    total: courseStats[0].total_courses || 0,
                    published: courseStats[0].published_courses || 0,
                    drafts: courseStats[0].draft_courses || 0,
                    featured: courseStats[0].featured_courses || 0
                },
                enrollments: {
                    total: enrollmentStats[0].total_enrollments || 0,
                    active: enrollmentStats[0].active_enrollments || 0,
                    completed: enrollmentStats[0].completed_enrollments || 0,
                    avgProgress: Math.round(enrollmentStats[0].avg_progress || 0)
                },
                payments: {
                    total: paymentStats[0].total_payments || 0,
                    successful: paymentStats[0].successful_payments || 0,
                    pending: paymentStats[0].pending_payments || 0,
                    failed: paymentStats[0].failed_payments || 0,
                    totalRevenue: parseFloat(paymentStats[0].total_revenue || 0),
                    uniqueCustomers: paymentStats[0].unique_customers || 0
                },
                pins: {
                    total: pinStats[0].total_pins || 0,
                    active: pinStats[0].active_pins || 0,
                    revoked: pinStats[0].revoked_pins || 0
                },
                recentActivity: recentActivities,
                recentUsers: recentUsers,
                recentPayments: recentPayments,
                recentMessages: recentMessages
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
// USER MANAGEMENT
// ============================================

const getUsers = async (req, res) => {
    try {
        const { page = 1, limit = 20, search = null, role = null, isVerified = null } = req.query;

        const result = await User.getAllUsers({
            page: parseInt(page),
            limit: parseInt(limit),
            search,
            role,
            isVerified
        });

        res.status(200).json({
            success: true,
            data: result.users,
            pagination: result.pagination
        });

    } catch (error) {
        logger.error('❌ Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users'
        });
    }
};

const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get user's enrollments
        const [enrollments] = await pool.query(
            `SELECT e.*, c.title, c.slug
            FROM enrollments e
            JOIN courses c ON e.course_id = c.id
            WHERE e.user_id = ?
            ORDER BY e.enrolled_at DESC`,
            [id]
        );

        // Get user's payments
        const [payments] = await pool.query(
            `SELECT * FROM payments
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 20`,
            [id]
        );

        // Get user's PINs
        const [pins] = await pool.query(
            `SELECT * FROM user_pins
            WHERE user_id = ?
            ORDER BY created_at DESC`,
            [id]
        );

        // Get user's activity
        const [activities] = await pool.query(
            `SELECT * FROM user_activities
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 20`,
            [id]
        );

        res.status(200).json({
            success: true,
            data: {
                ...user,
                enrollments,
                payments,
                pins,
                activities
            }
        });

    } catch (error) {
        logger.error('❌ Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user'
        });
    }
};

const getUserByPhone = async (req, res) => {
    try {
        const { phone } = req.params;
        const user = await User.findByPhone(phone);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: user
        });

    } catch (error) {
        logger.error('❌ Get user by phone error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user'
        });
    }
};

const createUser = async (req, res) => {
    try {
        const { firstname, lastname, email, phone, password, role } = req.body;

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

        if (role && role !== 'user') {
            await User.updateRole(user.id, role);
        }

        await User.logActivity(
            req.userId,
            'admin',
            `Created user: ${email}`,
            req.ip,
            req.headers['user-agent']
        );

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: user
        });

    } catch (error) {
        logger.error('❌ Create user error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create user'
        });
    }
};

const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { firstname, lastname, email, phone, role, is_verified } = req.body;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const updates = {};
        if (firstname) updates.firstname = firstname.trim();
        if (lastname) updates.lastname = lastname.trim();
        if (email) {
            const existing = await User.findByEmail(email);
            if (existing && existing.id !== parseInt(id)) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already in use'
                });
            }
            updates.email = email.toLowerCase().trim();
        }
        if (phone) {
            const existing = await User.findByPhone(phone);
            if (existing && existing.id !== parseInt(id)) {
                return res.status(400).json({
                    success: false,
                    message: 'Phone number already in use'
                });
            }
            updates.phone = phone.trim();
        }
        if (role) updates.role = role;
        if (is_verified !== undefined) updates.is_verified = is_verified;

        const fields = [];
        const values = [];
        for (const [key, value] of Object.entries(updates)) {
            fields.push(`${key} = ?`);
            values.push(value);
        }
        values.push(id);

        await pool.query(
            `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
            values
        );

        const updatedUser = await User.findById(id);

        await User.logActivity(
            req.userId,
            'admin',
            `Updated user: ${updatedUser.email}`,
            req.ip,
            req.headers['user-agent']
        );

        res.status(200).json({
            success: true,
            message: 'User updated successfully',
            data: updatedUser
        });

    } catch (error) {
        logger.error('❌ Update user error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to update user'
        });
    }
};

const updateUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!role) {
            return res.status(400).json({
                success: false,
                message: 'Role is required'
            });
        }

        if (parseInt(id) === req.userId) {
            return res.status(400).json({
                success: false,
                message: 'Cannot change your own role'
            });
        }

        await User.updateRole(id, role);

        await User.logActivity(
            req.userId,
            'admin',
            `Updated user ${id} role to ${role}`,
            req.ip,
            req.headers['user-agent']
        );

        res.status(200).json({
            success: true,
            message: 'User role updated successfully'
        });

    } catch (error) {
        logger.error('❌ Update user role error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to update user role'
        });
    }
};

const updateUserVerification = async (req, res) => {
    try {
        const { id } = req.params;
        const { verified } = req.body;

        if (verified === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Verification status is required'
            });
        }

        await pool.query(
            'UPDATE users SET is_verified = ? WHERE id = ?',
            [verified ? 1 : 0, id]
        );

        await User.logActivity(
            req.userId,
            'admin',
            `${verified ? 'Verified' : 'Unverified'} user ${id}`,
            req.ip,
            req.headers['user-agent']
        );

        res.status(200).json({
            success: true,
            message: `User ${verified ? 'verified' : 'unverified'} successfully`
        });

    } catch (error) {
        logger.error('❌ Update verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update verification status'
        });
    }
};

const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (parseInt(id) === req.userId) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete your own account'
            });
        }

        await User.delete(id);

        await User.logActivity(
            req.userId,
            'admin',
            `Deleted user ${id}`,
            req.ip,
            req.headers['user-agent']
        );

        res.status(200).json({
            success: true,
            message: 'User deleted successfully'
        });

    } catch (error) {
        logger.error('❌ Delete user error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to delete user'
        });
    }
};

// ============================================
// PIN MANAGEMENT (Admin - Cash Payments)
// ============================================

const generatePinForUser = async (req, res) => {
    try {
        const { userId, plan = 'monthly' } = req.body;

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

        // Check if user already has active PIN
        const activePin = await Pin.getActivePin(userId);
        if (activePin) {
            return res.status(400).json({
                success: false,
                message: 'User already has an active PIN. Please revoke it first.',
                data: { existingPin: activePin.pin_code }
            });
        }

        // Generate PIN
        const pinResult = await Pin.generate(userId, plan, req.userId);
        const pinCode = pinResult.pinCode;

        // Update user's pin field
        const salt = await bcrypt.genSalt(12);
        const hashedPin = await bcrypt.hash(pinCode, salt);
        await pool.query(
            'UPDATE users SET pin = ?, last_pin_generated_at = NOW() WHERE id = ?',
            [hashedPin, userId]
        );

        // Update subscription
        const durations = { daily: 1, weekly: 7, monthly: 30, annual: 365 };
        const subExpiry = new Date();
        subExpiry.setDate(subExpiry.getDate() + (durations[plan] || 30));
        await pool.query(
            'UPDATE users SET subscription_type = ?, subscription_expires = ? WHERE id = ?',
            [plan, subExpiry, userId]
        );

        // Create completed payment record
        const planPrices = {
            daily: 150,
            weekly: 800,
            monthly: 2500,
            annual: 15000
        };
        const transactionId = `PIN-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

        await Payment.create({
            userId,
            amount: planPrices[plan],
            subscriptionType: plan,
            transactionId,
            status: 'completed',
            pin: pinCode,
            notes: `PIN generated by admin for cash payment`
        });

        // Send PIN via SMS if enabled
        if (user.phone) {
            try {
                await smsService.sendPinSms(user.phone, pinCode);
            } catch (smsError) {
                logger.warn(`⚠️ Failed to send PIN SMS: ${smsError.message}`);
            }
        }

        // Log activity
        await User.logActivity(
            req.userId,
            'admin',
            `Generated PIN for user ${userId} (${user.firstname} ${user.lastname}) - PIN: ${pinCode}`,
            req.ip,
            req.headers['user-agent']
        );

        res.status(200).json({
            success: true,
            message: 'PIN generated successfully for cash payment',
            data: {
                pin: pinCode,
                plan: plan,
                expiresAt: pinResult.expiresAt,
                user: {
                    id: user.id,
                    name: `${user.firstname} ${user.lastname}`,
                    phone: user.phone
                }
            }
        });

    } catch (error) {
        logger.error('❌ Generate PIN error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to generate PIN'
        });
    }
};

const revokePin = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const activePin = await Pin.getActivePin(userId);
        if (!activePin) {
            return res.status(400).json({
                success: false,
                message: 'User does not have an active PIN'
            });
        }

        await Pin.revoke(userId, activePin.pin_code);

        await pool.query(
            'UPDATE users SET pin = NULL WHERE id = ?',
            [userId]
        );

        await pool.query(
            'UPDATE users SET subscription_type = "none", subscription_expires = NULL WHERE id = ?',
            [userId]
        );

        await User.logActivity(
            req.userId,
            'admin',
            `Revoked PIN for user ${userId} (${user.firstname} ${user.lastname})`,
            req.ip,
            req.headers['user-agent']
        );

        res.status(200).json({
            success: true,
            message: 'PIN revoked successfully'
        });

    } catch (error) {
        logger.error('❌ Revoke PIN error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to revoke PIN'
        });
    }
};

const getUserPins = async (req, res) => {
    try {
        const { userId } = req.params;

        const pins = await Pin.getUserPins(userId);

        res.status(200).json({
            success: true,
            data: pins
        });

    } catch (error) {
        logger.error('❌ Get user pins error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get user pins'
        });
    }
};

const getAllPins = async (req, res) => {
    try {
        const { limit = 100 } = req.query;
        const pins = await Pin.getAll(parseInt(limit));

        res.status(200).json({
            success: true,
            data: pins
        });

    } catch (error) {
        logger.error('❌ Get all pins error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get pins'
        });
    }
};

const revokeExpiredPins = async (req, res) => {
    try {
        const count = await Pin.revokeExpired();

        await User.logActivity(
            req.userId,
            'admin',
            `Revoked ${count} expired PINs`,
            req.ip,
            req.headers['user-agent']
        );

        res.status(200).json({
            success: true,
            message: `Revoked ${count} expired PINs`,
            data: { count }
        });

    } catch (error) {
        logger.error('❌ Revoke expired pins error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to revoke expired PINs'
        });
    }
};

// ============================================
// PAYMENT MANAGEMENT (Cash)
// ============================================

const getPayments = async (req, res) => {
    try {
        const { page = 1, limit = 20, status = null, search = null, plan = null } = req.query;
        const offset = (page - 1) * limit;
        let conditions = [];
        const params = [];

        if (status) {
            conditions.push('p.status = ?');
            params.push(status);
        }

        if (plan) {
            conditions.push('p.subscription_type = ?');
            params.push(plan);
        }

        if (search) {
            conditions.push('(CONCAT(u.firstname, " ", u.lastname) LIKE ? OR u.phone LIKE ? OR p.transaction_id LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const [payments] = await pool.query(
            `SELECT p.*, CONCAT(u.firstname, ' ', u.lastname) as user_name, u.phone as user_phone
            FROM payments p
            LEFT JOIN users u ON p.user_id = u.id
            ${whereClause}
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );

        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM payments p
            LEFT JOIN users u ON p.user_id = u.id
            ${whereClause}`,
            params
        );

        res.status(200).json({
            success: true,
            data: payments,
            pagination: {
                total: countResult[0].total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        });

    } catch (error) {
        logger.error('❌ Get payments error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get payments'
        });
    }
};

const getPaymentStats = async (req, res) => {
    try {
        const [stats] = await pool.query(
            `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as confirmed,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as revenue
            FROM payments`
        );

        const [monthlyRevenue] = await pool.query(
            `SELECT 
                DATE_FORMAT(created_at, '%Y-%m') as month,
                SUM(amount) as revenue,
                COUNT(*) as count
            FROM payments
            WHERE status = 'completed'
            GROUP BY DATE_FORMAT(created_at, '%Y-%m')
            ORDER BY month DESC
            LIMIT 6`
        );

        const [planDistribution] = await pool.query(
            `SELECT 
                subscription_type as plan,
                COUNT(*) as count,
                SUM(amount) as revenue
            FROM payments
            WHERE status = 'completed'
            GROUP BY subscription_type`
        );

        res.status(200).json({
            success: true,
            data: {
                ...stats[0],
                monthlyRevenue,
                planDistribution
            }
        });

    } catch (error) {
        logger.error('❌ Payment stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get payment stats'
        });
    }
};

const deletePayment = async (req, res) => {
    try {
        const { id } = req.params;

        const payment = await Payment.getById(id);
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        if (payment.status === 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete completed payment'
            });
        }

        await Payment.delete(id);

        await User.logActivity(
            req.userId,
            'admin',
            `Deleted payment ${id}`,
            req.ip,
            req.headers['user-agent']
        );

        res.status(200).json({
            success: true,
            message: 'Payment deleted successfully'
        });

    } catch (error) {
        logger.error('❌ Delete payment error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to delete payment'
        });
    }
};

// ============================================
// COURSE MANAGEMENT (Admin)
// ============================================

const createCourseAdmin = async (req, res) => {
    try {
        const { 
            title, 
            slug, 
            description, 
            category, 
            level, 
            duration_weeks, 
            instructor, 
            price, 
            is_featured,
            is_published
        } = req.body;

        if (!title || !slug || !description || !category) {
            return res.status(400).json({
                success: false,
                message: 'Title, slug, description, and category are required'
            });
        }

        const course = await Course.create({
            title,
            slug,
            description,
            category,
            level: level || 'beginner',
            duration_weeks: duration_weeks || 8,
            instructor: instructor || 'Admin',
            price: price || 0,
            is_featured: is_featured || false,
            is_published: is_published !== undefined ? is_published : true
        });

        await User.logActivity(
            req.userId,
            'admin',
            `Created course: ${title}`,
            req.ip,
            req.headers['user-agent']
        );

        res.status(201).json({
            success: true,
            message: 'Course created successfully',
            data: course
        });

    } catch (error) {
        logger.error('❌ Create course error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create course'
        });
    }
};

const updateCourseAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const courseData = req.body;

        const course = await Course.update(id, courseData);
        
        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }

        await User.logActivity(
            req.userId,
            'admin',
            `Updated course: ${course.title}`,
            req.ip,
            req.headers['user-agent']
        );

        res.status(200).json({
            success: true,
            message: 'Course updated successfully',
            data: course
        });

    } catch (error) {
        logger.error('❌ Update course error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to update course'
        });
    }
};

const deleteCourseAdmin = async (req, res) => {
    try {
        const { id } = req.params;

        const course = await Course.getById(id);
        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }

        const [enrollments] = await pool.query(
            'SELECT COUNT(*) as count FROM enrollments WHERE course_id = ?',
            [id]
        );

        if (enrollments[0].count > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete course with ${enrollments[0].count} existing enrollments`
            });
        }

        await Course.delete(id);

        await User.logActivity(
            req.userId,
            'admin',
            `Deleted course: ${course.title}`,
            req.ip,
            req.headers['user-agent']
        );

        res.status(200).json({
            success: true,
            message: 'Course deleted successfully'
        });

    } catch (error) {
        logger.error('❌ Delete course error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to delete course'
        });
    }
};

const getCoursesAdmin = async (req, res) => {
    try {
        const { page = 1, limit = 20, category = null, level = null, search = null, published = null } = req.query;
        const offset = (page - 1) * limit;
        let conditions = [];
        const params = [];

        if (category) {
            conditions.push('category = ?');
            params.push(category);
        }

        if (level) {
            conditions.push('level = ?');
            params.push(level);
        }

        if (search) {
            conditions.push('(title LIKE ? OR description LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }

        if (published !== null) {
            conditions.push('is_published = ?');
            params.push(published === 'true' ? 1 : 0);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const [courses] = await pool.query(
            `SELECT * FROM courses 
            ${whereClause}
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );

        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM courses ${whereClause}`,
            params
        );

        for (const course of courses) {
            const [enrollCount] = await pool.query(
                'SELECT COUNT(*) as count FROM enrollments WHERE course_id = ?',
                [course.id]
            );
            course.enrollment_count = enrollCount[0].count;
        }

        res.status(200).json({
            success: true,
            data: courses,
            pagination: {
                total: countResult[0].total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        });

    } catch (error) {
        logger.error('❌ Get courses admin error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch courses'
        });
    }
};

// ============================================
// CONTACT MESSAGES (Admin)
// ============================================

const getContactMessagesAdmin = async (req, res) => {
    try {
        const { status = null, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        let queryStr = 'SELECT * FROM contact_messages';
        let countQuery = 'SELECT COUNT(*) as total FROM contact_messages';
        let params = [];

        if (status && status !== 'all') {
            queryStr += ' WHERE status = ?';
            countQuery += ' WHERE status = ?';
            params.push(status);
        }

        queryStr += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [messages] = await pool.query(queryStr, params);
        const [countResult] = await pool.query(countQuery, status && status !== 'all' ? [status] : []);

        const [statusCounts] = await pool.query(
            `SELECT status, COUNT(*) as count FROM contact_messages GROUP BY status`
        );

        res.status(200).json({
            success: true,
            data: messages,
            statusCounts: statusCounts,
            pagination: {
                total: countResult[0].total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        });

    } catch (error) {
        logger.error('❌ Get messages error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch messages'
        });
    }
};

const getContactMessageById = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await pool.query(
            'SELECT * FROM contact_messages WHERE id = ?',
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        if (rows[0].status === 'new') {
            await pool.query(
                'UPDATE contact_messages SET status = "read" WHERE id = ?',
                [id]
            );
        }

        res.status(200).json({
            success: true,
            data: rows[0]
        });

    } catch (error) {
        logger.error('❌ Get message error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch message'
        });
    }
};

const replyToContactAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const { reply } = req.body;

        if (!reply) {
            return res.status(400).json({
                success: false,
                message: 'Reply message is required'
            });
        }

        const [rows] = await pool.query(
            'SELECT * FROM contact_messages WHERE id = ?',
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        const message = rows[0];

        await pool.query(
            `UPDATE contact_messages 
            SET status = 'replied', replied_at = NOW() 
            WHERE id = ?`,
            [id]
        );

        const emailResult = await emailService.sendContactReply(message, reply);

        await User.logActivity(
            req.userId,
            'admin',
            `Replied to contact message ${id}`,
            req.ip,
            req.headers['user-agent']
        );

        res.status(200).json({
            success: true,
            message: 'Reply sent successfully',
            data: {
                emailSent: emailResult.success
            }
        });

    } catch (error) {
        logger.error('❌ Reply error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send reply'
        });
    }
};

const deleteContactMessage = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await pool.query(
            'DELETE FROM contact_messages WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Message deleted successfully'
        });

    } catch (error) {
        logger.error('❌ Delete message error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete message'
        });
    }
};

// ============================================
// ACTIVITY LOG MANAGEMENT
// ============================================

const getActivities = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 50, 
            search = null, 
            type = null,
            start = null,
            end = null
        } = req.query;

        const offset = (page - 1) * limit;
        let conditions = [];
        const params = [];

        if (search) {
            conditions.push('(ua.description LIKE ? OR ua.activity_type LIKE ?)');
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm);
        }

        if (type) {
            conditions.push('ua.activity_type = ?');
            params.push(type);
        }

        if (start) {
            conditions.push('DATE(ua.created_at) >= ?');
            params.push(start);
        }

        if (end) {
            conditions.push('DATE(ua.created_at) <= ?');
            params.push(end);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const [activities] = await pool.query(
            `SELECT 
                ua.*,
                CONCAT(u.firstname, ' ', u.lastname) as user_name
            FROM user_activities ua
            LEFT JOIN users u ON ua.user_id = u.id
            ${whereClause}
            ORDER BY ua.created_at DESC
            LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );

        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total 
            FROM user_activities ua
            ${whereClause}`,
            params
        );

        const [stats] = await pool.query(
            `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN activity_type IN ('login', 'registration', 'verification') THEN 1 ELSE 0 END) as user_actions,
                SUM(CASE WHEN activity_type = 'admin' THEN 1 ELSE 0 END) as admin_actions,
                SUM(CASE WHEN activity_type = 'system' THEN 1 ELSE 0 END) as system_events
            FROM user_activities`
        );

        res.status(200).json({
            success: true,
            data: activities,
            stats: stats[0],
            pagination: {
                total: countResult[0].total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        });

    } catch (error) {
        logger.error('❌ Get activities error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch activities'
        });
    }
};

const clearActivities = async (req, res) => {
    try {
        await pool.query('DELETE FROM user_activities');
        
        await User.logActivity(
            req.userId,
            'admin',
            'Cleared all activity logs',
            req.ip,
            req.headers['user-agent']
        );

        res.status(200).json({
            success: true,
            message: 'All activities cleared successfully'
        });

    } catch (error) {
        logger.error('❌ Clear activities error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to clear activities'
        });
    }
};

const getActivityStats = async (req, res) => {
    try {
        const [stats] = await pool.query(
            `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN activity_type IN ('login', 'registration', 'verification') THEN 1 ELSE 0 END) as user_actions,
                SUM(CASE WHEN activity_type = 'admin' THEN 1 ELSE 0 END) as admin_actions,
                SUM(CASE WHEN activity_type = 'system' THEN 1 ELSE 0 END) as system_events,
                SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today,
                SUM(CASE WHEN DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as this_week
            FROM user_activities`
        );

        res.status(200).json({
            success: true,
            data: stats[0]
        });

    } catch (error) {
        logger.error('❌ Activity stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch activity stats'
        });
    }
};

// ============================================
// EXPORT
// ============================================

module.exports = {
    getDashboardStats,
    getUsers,
    getUserById,
    getUserByPhone,
    createUser,
    updateUser,
    updateUserRole,
    updateUserVerification,
    deleteUser,
    generatePinForUser,
    revokePin,
    getUserPins,
    getAllPins,
    revokeExpiredPins,
    getPayments,
    getPaymentStats,
    deletePayment,
    createCourseAdmin,
    updateCourseAdmin,
    deleteCourseAdmin,
    getCoursesAdmin,
    getContactMessagesAdmin,
    getContactMessageById,
    replyToContactAdmin,
    deleteContactMessage,
    getActivities,
    clearActivities,
    getActivityStats
};