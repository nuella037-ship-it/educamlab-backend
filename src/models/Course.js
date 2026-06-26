// src/models/Course.js - Complete Course Model
const { pool, query } = require('../config/database');
const logger = require('../utils/logger');

class Course {
    // ============================================
    // GET ALL COURSES WITH FILTERS
    // ============================================
    static async getAll({
        page = 1,
        limit = 20,
        category = null,
        level = null,
        search = null,
        sortBy = 'newest',
        minPrice = null,
        maxPrice = null,
        instructor = null,
        featured = null,
        published = true
    } = {}) {
        const offset = (page - 1) * limit;
        let conditions = [];
        const params = [];

        if (published) {
            conditions.push('is_published = TRUE');
        }

        if (category) {
            const categories = category.split(',');
            const placeholders = categories.map(() => '?').join(',');
            conditions.push(`category IN (${placeholders})`);
            params.push(...categories);
        }

        if (level) {
            const levels = level.split(',');
            const placeholders = levels.map(() => '?').join(',');
            conditions.push(`level IN (${placeholders})`);
            params.push(...levels);
        }

        if (search) {
            conditions.push('(title LIKE ? OR description LIKE ? OR instructor LIKE ?)');
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        if (minPrice !== null) {
            conditions.push('price >= ?');
            params.push(minPrice);
        }
        if (maxPrice !== null) {
            conditions.push('price <= ?');
            params.push(maxPrice);
        }

        if (instructor) {
            conditions.push('instructor LIKE ?');
            params.push(`%${instructor}%`);
        }

        if (featured !== null) {
            conditions.push('is_featured = ?');
            params.push(featured === 'true' ? 1 : 0);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        let sortClause = 'ORDER BY created_at DESC';
        switch (sortBy) {
            case 'popular':
                sortClause = 'ORDER BY (SELECT COUNT(*) FROM enrollments WHERE course_id = courses.id) DESC';
                break;
            case 'newest':
                sortClause = 'ORDER BY created_at DESC';
                break;
            case 'oldest':
                sortClause = 'ORDER BY created_at ASC';
                break;
            case 'price_low':
                sortClause = 'ORDER BY price ASC';
                break;
            case 'price_high':
                sortClause = 'ORDER BY price DESC';
                break;
            case 'title_asc':
                sortClause = 'ORDER BY title ASC';
                break;
            case 'title_desc':
                sortClause = 'ORDER BY title DESC';
                break;
            default:
                sortClause = 'ORDER BY created_at DESC';
        }

        const [countResult] = await query(
            `SELECT COUNT(*) as total FROM courses ${whereClause}`,
            params
        );

        const [rows] = await query(
            `SELECT 
                id, 
                title, 
                slug, 
                description, 
                category, 
                level, 
                duration_weeks, 
                instructor, 
                price, 
                is_featured,
                is_published,
                created_at,
                updated_at,
                (SELECT COUNT(*) FROM enrollments WHERE course_id = courses.id) as enrollment_count,
                (SELECT AVG(rating) FROM course_reviews WHERE course_id = courses.id) as avg_rating
            FROM courses 
            ${whereClause}
            ${sortClause}
            LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );

        return {
            courses: rows,
            pagination: {
                total: countResult[0].total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        };
    }

    // ============================================
    // GET COURSE CATEGORIES
    // ============================================
    static async getCategories() {
        const [rows] = await query(
            `SELECT 
                category, 
                COUNT(*) as count 
            FROM courses 
            WHERE is_published = TRUE 
            GROUP BY category 
            ORDER BY count DESC`
        );
        return rows;
    }

    // ============================================
    // GET COURSE LEVELS
    // ============================================
    static async getLevels() {
        const [rows] = await query(
            `SELECT 
                level, 
                COUNT(*) as count 
            FROM courses 
            WHERE is_published = TRUE 
            GROUP BY level 
            ORDER BY count DESC`
        );
        return rows;
    }

    // ============================================
    // GET INSTRUCTORS
    // ============================================
    static async getInstructors() {
        const [rows] = await query(
            `SELECT 
                DISTINCT instructor,
                COUNT(*) as course_count 
            FROM courses 
            WHERE is_published = TRUE 
            GROUP BY instructor 
            ORDER BY course_count DESC`
        );
        return rows;
    }

    // ============================================
    // GET COURSE BY SLUG
    // ============================================
    static async getBySlug(slug) {
        const [rows] = await query(
            `SELECT 
                c.*,
                (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) as enrollment_count,
                (SELECT AVG(rating) FROM course_reviews WHERE course_id = c.id) as avg_rating,
                (SELECT COUNT(*) FROM course_reviews WHERE course_id = c.id) as review_count
            FROM courses c
            WHERE c.slug = ? AND c.is_published = TRUE`,
            [slug]
        );
        return rows[0] || null;
    }

    // ============================================
    // GET COURSE BY ID
    // ============================================
    static async getById(id) {
        const [rows] = await query(
            `SELECT id, title, slug, description, category, level, duration_weeks, instructor, price, is_featured, is_published, created_at, updated_at 
            FROM courses 
            WHERE id = ?`,
            [id]
        );
        return rows[0] || null;
    }

    // ============================================
    // GET RELATED COURSES
    // ============================================
    static async getRelated(courseId, category, limit = 4) {
        const [rows] = await query(
            `SELECT id, title, slug, description, category, level, duration_weeks, instructor, price, is_featured 
            FROM courses 
            WHERE category = ? AND id != ? AND is_published = TRUE 
            ORDER BY RAND() 
            LIMIT ?`,
            [category, courseId, limit]
        );
        return rows;
    }

    // ============================================
    // GET FEATURED COURSES
    // ============================================
    static async getFeatured(limit = 4) {
        const [rows] = await query(
            `SELECT 
                id, title, slug, description, category, level, duration_weeks, instructor, price,
                (SELECT COUNT(*) FROM enrollments WHERE course_id = courses.id) as enrollment_count
            FROM courses 
            WHERE is_published = TRUE AND is_featured = TRUE 
            ORDER BY created_at DESC 
            LIMIT ?`,
            [limit]
        );
        return rows;
    }

    // ============================================
    // GET USER ENROLLED COURSES
    // ============================================
    static async getUserCourses(userId) {
        const [rows] = await query(
            `SELECT 
                c.id, 
                c.title, 
                c.slug, 
                c.description, 
                c.category, 
                c.level, 
                c.duration_weeks, 
                c.instructor,
                e.progress, 
                e.status, 
                e.enrolled_at, 
                e.completed_at
            FROM enrollments e
            JOIN courses c ON e.course_id = c.id
            WHERE e.user_id = ? AND e.status != 'cancelled'
            ORDER BY e.enrolled_at DESC`,
            [userId]
        );
        return rows;
    }

    // ============================================
    // GET USER COURSE PROGRESS
    // ============================================
    static async getUserProgress(userId, courseId) {
        const [rows] = await query(
            `SELECT progress, status, enrolled_at, completed_at 
            FROM enrollments 
            WHERE user_id = ? AND course_id = ?`,
            [userId, courseId]
        );
        return rows[0] || null;
    }

    // ============================================
    // ENROLL USER IN COURSE
    // ============================================
    static async enrollUser(userId, courseId) {
        const [course] = await query(
            'SELECT id, title FROM courses WHERE id = ? AND is_published = TRUE',
            [courseId]
        );
        if (course.length === 0) {
            throw new Error('Course not found or not available');
        }

        const [existing] = await query(
            'SELECT id, status FROM enrollments WHERE user_id = ? AND course_id = ?',
            [userId, courseId]
        );

        if (existing.length > 0) {
            if (existing[0].status === 'cancelled') {
                await query(
                    'UPDATE enrollments SET status = "active", enrolled_at = NOW() WHERE id = ?',
                    [existing[0].id]
                );
                return { id: existing[0].id, userId, courseId, status: 'active' };
            }
            return { id: existing[0].id, userId, courseId, status: existing[0].status };
        }

        const [result] = await query(
            'INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)',
            [userId, courseId]
        );

        logger.info(`📚 User ${userId} enrolled in course ${courseId}`);
        return { id: result.insertId, userId, courseId, status: 'active' };
    }

    // ============================================
    // UPDATE COURSE PROGRESS
    // ============================================
    static async updateProgress(userId, courseId, progress) {
        if (progress < 0 || progress > 100) {
            throw new Error('Progress must be between 0 and 100');
        }

        const [enrollment] = await query(
            'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? AND status = "active"',
            [userId, courseId]
        );

        if (enrollment.length === 0) {
            throw new Error('Not enrolled in this course');
        }

        await query(
            `UPDATE enrollments 
            SET progress = ?, 
                status = CASE WHEN ? >= 100 THEN 'completed' ELSE 'active' END,
                completed_at = CASE WHEN ? >= 100 THEN NOW() ELSE NULL END
            WHERE user_id = ? AND course_id = ?`,
            [progress, progress, progress, userId, courseId]
        );

        return { progress, status: progress >= 100 ? 'completed' : 'active' };
    }

    // ============================================
    // GET COURSE STATS
    // ============================================
    static async getStats() {
        const [totalCourses] = await query(
            'SELECT COUNT(*) as total FROM courses WHERE is_published = TRUE'
        );
        
        const [totalStudents] = await query(
            'SELECT COUNT(DISTINCT user_id) as total FROM enrollments'
        );

        const [avgProgress] = await query(
            'SELECT AVG(progress) as avg FROM enrollments'
        );

        const [totalEnrollments] = await query(
            'SELECT COUNT(*) as total FROM enrollments'
        );

        const [categoryStats] = await query(
            `SELECT category, COUNT(*) as count 
            FROM courses 
            WHERE is_published = TRUE 
            GROUP BY category 
            ORDER BY count DESC`
        );

        return {
            totalCourses: totalCourses[0].total,
            totalStudents: totalStudents[0].total,
            avgProgress: Math.round(avgProgress[0].avg || 0),
            totalEnrollments: totalEnrollments[0].total,
            categoryStats
        };
    }

    // ============================================
    // ADMIN: CREATE COURSE
    // ============================================
    static async create(courseData) {
        const { 
            title, slug, description, category, level, 
            duration_weeks, instructor, price, is_featured, is_published
        } = courseData;
        
        const [existing] = await query(
            'SELECT id FROM courses WHERE slug = ?',
            [slug]
        );
        if (existing.length > 0) {
            throw new Error('Course slug already exists');
        }

        const [result] = await query(
            `INSERT INTO courses 
            (title, slug, description, category, level, duration_weeks, instructor, price, is_featured, is_published) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                title.trim(),
                slug.trim().toLowerCase(),
                description.trim(),
                category,
                level || 'beginner',
                duration_weeks || 8,
                instructor || 'Admin',
                price || 0,
                is_featured || false,
                is_published !== undefined ? is_published : true
            ]
        );

        logger.info(`📚 Course created: ${title}`);
        return this.getById(result.insertId);
    }

    // ============================================
    // ADMIN: UPDATE COURSE
    // ============================================
    static async update(id, courseData) {
        const fields = [];
        const values = [];

        const allowedFields = ['title', 'slug', 'description', 'category', 'level', 'duration_weeks', 'instructor', 'price', 'is_featured', 'is_published'];
        
        for (const field of allowedFields) {
            if (courseData[field] !== undefined) {
                fields.push(`${field} = ?`);
                values.push(courseData[field]);
            }
        }

        if (fields.length === 0) {
            throw new Error('No fields to update');
        }

        // Check slug uniqueness if updating
        if (courseData.slug) {
            const [existing] = await query(
                'SELECT id FROM courses WHERE slug = ? AND id != ?',
                [courseData.slug, id]
            );
            if (existing.length > 0) {
                throw new Error('Course slug already exists');
            }
        }

        values.push(id);
        await query(
            `UPDATE courses SET ${fields.join(', ')} WHERE id = ?`,
            values
        );

        logger.info(`📚 Course updated: ${id}`);
        return this.getById(id);
    }

    // ============================================
    // ADMIN: DELETE COURSE
    // ============================================
    static async delete(id) {
        const [enrollments] = await query(
            'SELECT COUNT(*) as count FROM enrollments WHERE course_id = ?',
            [id]
        );
        
        if (enrollments[0].count > 0) {
            throw new Error(`Cannot delete course with ${enrollments[0].count} existing enrollments`);
        }

        // Delete reviews first
        await query('DELETE FROM course_reviews WHERE course_id = ?', [id]);
        await query('DELETE FROM courses WHERE id = ?', [id]);
        
        logger.info(`📚 Course deleted: ${id}`);
        return true;
    }
}

module.exports = Course;