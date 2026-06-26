// src/controllers/reviewController.js - Complete Review Controller
const CourseReview = require('../models/CourseReview');
const User = require('../models/User');
const logger = require('../utils/logger');

// ============================================
// GET COURSE REVIEWS
// ============================================
const getCourseReviews = async (req, res) => {
    try {
        const { courseId } = req.params;
        const { page = 1, limit = 10 } = req.query;
        
        const result = await CourseReview.getByCourse(courseId, { page, limit });
        
        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('❌ Get reviews error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch reviews'
        });
    }
};

// ============================================
// CREATE REVIEW
// ============================================
const createReview = async (req, res) => {
    try {
        const { courseId } = req.params;
        const { rating, comment } = req.body;
        
        const review = await CourseReview.create(req.userId, courseId, rating, comment);
        
        await User.logActivity(
            req.userId,
            'review',
            `Reviewed course ${courseId} with rating ${rating}`,
            req.ip,
            req.headers['user-agent']
        );

        res.status(201).json({
            success: true,
            message: 'Review submitted successfully',
            data: review
        });
    } catch (error) {
        logger.error('❌ Create review error:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to submit review'
        });
    }
};

// ============================================
// UPDATE REVIEW
// ============================================
const updateReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { rating, comment } = req.body;
        
        await CourseReview.update(reviewId, req.userId, rating, comment);
        
        res.status(200).json({
            success: true,
            message: 'Review updated successfully'
        });
    } catch (error) {
        logger.error('❌ Update review error:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to update review'
        });
    }
};

// ============================================
// DELETE REVIEW
// ============================================
const deleteReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        await CourseReview.delete(reviewId, req.userId);
        
        res.status(200).json({
            success: true,
            message: 'Review deleted successfully'
        });
    } catch (error) {
        logger.error('❌ Delete review error:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to delete review'
        });
    }
};

// ============================================
// ADMIN: DELETE REVIEW
// ============================================
const deleteReviewAdmin = async (req, res) => {
    try {
        const { reviewId } = req.params;
        await CourseReview.deleteAdmin(reviewId);
        
        await User.logActivity(
            req.userId,
            'admin',
            `Deleted review ${reviewId}`,
            req.ip,
            req.headers['user-agent']
        );

        res.status(200).json({
            success: true,
            message: 'Review deleted successfully'
        });
    } catch (error) {
        logger.error('❌ Delete review admin error:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to delete review'
        });
    }
};

// ============================================
// GET REVIEW STATS
// ============================================
const getReviewStats = async (req, res) => {
    try {
        const stats = await CourseReview.getStats();
        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        logger.error('❌ Review stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch review stats'
        });
    }
};

// ============================================
// GET USER REVIEWS
// ============================================
const getUserReviews = async (req, res) => {
    try {
        const userId = req.userId;
        const [reviews] = await pool.query(
            `SELECT cr.*, c.title as course_title, c.slug as course_slug
            FROM course_reviews cr
            JOIN courses c ON cr.course_id = c.id
            WHERE cr.user_id = ?
            ORDER BY cr.created_at DESC`,
            [userId]
        );

        res.status(200).json({
            success: true,
            data: reviews
        });
    } catch (error) {
        logger.error('❌ Get user reviews error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user reviews'
        });
    }
};

module.exports = {
    getCourseReviews,
    createReview,
    updateReview,
    deleteReview,
    deleteReviewAdmin,
    getReviewStats,
    getUserReviews
};