// src/models/CourseReview.js - Complete Review Model
const { pool, query } = require('../config/database');
const logger = require('../utils/logger');

class CourseReview {
    // ============================================
    // GET COURSE REVIEWS
    // ============================================
    static async getByCourse(courseId, { page = 1, limit = 10 } = {}) {
        const offset = (page - 1) * limit;
        
        const [reviews] = await query(
            `SELECT 
                cr.id, 
                cr.rating, 
                cr.comment, 
                cr.created_at,
                cr.updated_at,
                u.id as user_id,
                u.firstname,
                u.lastname,
                u.phone
            FROM course_reviews cr
            JOIN users u ON cr.user_id = u.id
            WHERE cr.course_id = ?
            ORDER BY cr.created_at DESC
            LIMIT ? OFFSET ?`,
            [courseId, parseInt(limit), offset]
        );

        const [countResult] = await query(
            'SELECT COUNT(*) as total FROM course_reviews WHERE course_id = ?',
            [courseId]
        );

        const [avgRating] = await query(
            'SELECT AVG(rating) as avg, COUNT(*) as count FROM course_reviews WHERE course_id = ?',
            [courseId]
        );

        // Get rating distribution
        const [distribution] = await query(
            `SELECT rating, COUNT(*) as count 
            FROM course_reviews 
            WHERE course_id = ? 
            GROUP BY rating 
            ORDER BY rating DESC`,
            [courseId]
        );

        return {
            reviews,
            stats: {
                total: countResult[0].total,
                average: parseFloat(avgRating[0].avg || 0),
                count: parseInt(avgRating[0].count || 0)
            },
            distribution,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        };
    }

    // ============================================
    // GET USER REVIEW
    // ============================================
    static async getUserReview(userId, courseId) {
        const [rows] = await query(
            'SELECT * FROM course_reviews WHERE user_id = ? AND course_id = ?',
            [userId, courseId]
        );
        return rows[0] || null;
    }

    // ============================================
    // CREATE REVIEW
    // ============================================
    static async create(userId, courseId, rating, comment) {
        // Check if user is enrolled
        const [enrollment] = await query(
            'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? AND status = "completed"',
            [userId, courseId]
        );

        if (enrollment.length === 0) {
            throw new Error('You must complete the course to review it');
        }

        // Check if already reviewed
        const [existing] = await query(
            'SELECT id FROM course_reviews WHERE user_id = ? AND course_id = ?',
            [userId, courseId]
        );

        if (existing.length > 0) {
            throw new Error('You have already reviewed this course');
        }

        // Validate rating
        if (rating < 1 || rating > 5) {
            throw new Error('Rating must be between 1 and 5');
        }

        const [result] = await query(
            'INSERT INTO course_reviews (user_id, course_id, rating, comment) VALUES (?, ?, ?, ?)',
            [userId, courseId, rating, comment || null]
        );

        logger.info(`⭐ Review created: User ${userId} rated course ${courseId} with ${rating} stars`);

        return { 
            id: result.insertId, 
            userId, 
            courseId, 
            rating, 
            comment 
        };
    }

    // ============================================
    // UPDATE REVIEW
    // ============================================
    static async update(reviewId, userId, rating, comment) {
        if (rating < 1 || rating > 5) {
            throw new Error('Rating must be between 1 and 5');
        }

        const [result] = await query(
            'UPDATE course_reviews SET rating = ?, comment = ?, updated_at = NOW() WHERE id = ? AND user_id = ?',
            [rating, comment || null, reviewId, userId]
        );

        if (result.affectedRows === 0) {
            throw new Error('Review not found or you don\'t have permission');
        }

        logger.info(`⭐ Review updated: ${reviewId}`);
        return true;
    }

    // ============================================
    // DELETE REVIEW
    // ============================================
    static async delete(reviewId, userId) {
        const [result] = await query(
            'DELETE FROM course_reviews WHERE id = ? AND user_id = ?',
            [reviewId, userId]
        );

        if (result.affectedRows === 0) {
            throw new Error('Review not found or you don\'t have permission');
        }

        logger.info(`⭐ Review deleted: ${reviewId}`);
        return true;
    }

    // ============================================
    // ADMIN: DELETE REVIEW
    // ============================================
    static async deleteAdmin(reviewId) {
        const [result] = await query(
            'DELETE FROM course_reviews WHERE id = ?',
            [reviewId]
        );

        if (result.affectedRows === 0) {
            throw new Error('Review not found');
        }

        logger.info(`⭐ Review deleted by admin: ${reviewId}`);
        return true;
    }

    // ============================================
    // GET REVIEW STATS
    // ============================================
    static async getStats() {
        const [stats] = await query(
            `SELECT 
                COUNT(*) as total,
                AVG(rating) as avg_rating,
                MIN(rating) as min_rating,
                MAX(rating) as max_rating,
                COUNT(DISTINCT user_id) as unique_reviewers,
                COUNT(DISTINCT course_id) as courses_with_reviews
            FROM course_reviews`
        );

        const [distribution] = await query(
            `SELECT rating, COUNT(*) as count 
            FROM course_reviews 
            GROUP BY rating 
            ORDER BY rating DESC`
        );

        return {
            ...stats[0],
            avg_rating: parseFloat(stats[0].avg_rating || 0),
            distribution
        };
    }
}

module.exports = CourseReview;