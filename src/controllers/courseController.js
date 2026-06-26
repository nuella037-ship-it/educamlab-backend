// src/controllers/courseController.js - Complete Course Controller
const Course = require('../models/Course');
const User = require('../models/User');
const logger = require('../utils/logger');

// ============================================
// GET ALL COURSES
// ============================================
const getAllCourses = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            category,
            level,
            search,
            sortBy = 'newest',
            minPrice,
            maxPrice,
            instructor,
            featured
        } = req.query;

        const pageNum = parseInt(page) || 1;
        const limitNum = Math.min(parseInt(limit) || 20, 100);

        const result = await Course.getAll({
            page: pageNum,
            limit: limitNum,
            category,
            level,
            search,
            sortBy,
            minPrice: minPrice ? parseFloat(minPrice) : null,
            maxPrice: maxPrice ? parseFloat(maxPrice) : null,
            instructor,
            featured,
            published: true
        });

        res.status(200).json({
            success: true,
            data: result.courses,
            pagination: result.pagination,
            filters: {
                category,
                level,
                search,
                sortBy,
                minPrice,
                maxPrice,
                instructor,
                featured
            }
        });
    } catch (error) {
        logger.error('❌ Get courses error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch courses'
        });
    }
};

// ============================================
// GET COURSE CATEGORIES
// ============================================
const getCategories = async (req, res) => {
    try {
        const categories = await Course.getCategories();
        res.status(200).json({
            success: true,
            data: categories
        });
    } catch (error) {
        logger.error('❌ Get categories error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch categories'
        });
    }
};

// ============================================
// GET COURSE LEVELS
// ============================================
const getLevels = async (req, res) => {
    try {
        const levels = await Course.getLevels();
        res.status(200).json({
            success: true,
            data: levels
        });
    } catch (error) {
        logger.error('❌ Get levels error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch levels'
        });
    }
};

// ============================================
// GET INSTRUCTORS
// ============================================
const getInstructors = async (req, res) => {
    try {
        const instructors = await Course.getInstructors();
        res.status(200).json({
            success: true,
            data: instructors
        });
    } catch (error) {
        logger.error('❌ Get instructors error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch instructors'
        });
    }
};

// ============================================
// GET FEATURED COURSES
// ============================================
const getFeaturedCourses = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 4;
        const courses = await Course.getFeatured(limit);
        res.status(200).json({
            success: true,
            data: courses
        });
    } catch (error) {
        logger.error('❌ Get featured courses error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch featured courses'
        });
    }
};

// ============================================
// GET COURSE BY SLUG
// ============================================
const getCourseBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        const course = await Course.getBySlug(slug);
        
        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }

        const related = await Course.getRelated(course.id, course.category);

        let userProgress = null;
        if (req.userId) {
            userProgress = await Course.getUserProgress(req.userId, course.id);
        }

        res.status(200).json({
            success: true,
            data: {
                ...course,
                related,
                userProgress
            }
        });
    } catch (error) {
        logger.error('❌ Get course error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch course'
        });
    }
};

// ============================================
// GET USER ENROLLED COURSES
// ============================================
const getUserCourses = async (req, res) => {
    try {
        const courses = await Course.getUserCourses(req.userId);
        
        const total = courses.length;
        const completed = courses.filter(c => c.status === 'completed').length;
        const inProgress = courses.filter(c => c.status === 'active').length;
        const avgProgress = courses.length > 0 
            ? Math.round(courses.reduce((sum, c) => sum + c.progress, 0) / courses.length)
            : 0;

        res.status(200).json({
            success: true,
            data: {
                courses,
                stats: {
                    total,
                    completed,
                    inProgress,
                    avgProgress
                }
            }
        });
    } catch (error) {
        logger.error('❌ Get user courses error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch enrolled courses'
        });
    }
};

// ============================================
// GET COURSE PROGRESS
// ============================================
const getCourseProgress = async (req, res) => {
    try {
        const { courseId } = req.params;
        const progress = await Course.getUserProgress(req.userId, courseId);
        
        if (!progress) {
            return res.status(404).json({
                success: false,
                message: 'Not enrolled in this course'
            });
        }

        res.status(200).json({
            success: true,
            data: progress
        });
    } catch (error) {
        logger.error('❌ Get progress error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch progress'
        });
    }
};

// ============================================
// ENROLL IN COURSE
// ============================================
const enrollInCourse = async (req, res) => {
    try {
        const { courseId } = req.params;
        
        const course = await Course.getById(courseId);
        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }

        const enrollment = await Course.enrollUser(req.userId, courseId);
        
        await User.logActivity(
            req.userId,
            'enrollment',
            `Enrolled in course: ${course.title}`,
            req.ip,
            req.headers['user-agent']
        );

        res.status(200).json({
            success: true,
            message: 'Successfully enrolled in course',
            data: enrollment
        });
    } catch (error) {
        logger.error('❌ Enroll error:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to enroll in course'
        });
    }
};

// ============================================
// UPDATE COURSE PROGRESS
// ============================================
const updateCourseProgress = async (req, res) => {
    try {
        const { courseId } = req.params;
        const { progress } = req.body;
        
        if (progress === undefined || progress < 0 || progress > 100) {
            return res.status(400).json({
                success: false,
                message: 'Progress must be between 0 and 100'
            });
        }

        const result = await Course.updateProgress(req.userId, courseId, progress);

        if (progress >= 100) {
            await User.logActivity(
                req.userId,
                'course_completed',
                `Completed course`,
                req.ip,
                req.headers['user-agent']
            );
        }

        res.status(200).json({
            success: true,
            message: 'Progress updated successfully',
            data: result
        });
    } catch (error) {
        logger.error('❌ Update progress error:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to update progress'
        });
    }
};

// ============================================
// GET COURSE STATS
// ============================================
const getCourseStats = async (req, res) => {
    try {
        const stats = await Course.getStats();
        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        logger.error('❌ Get stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch stats'
        });
    }
};

// ============================================
// ADMIN: CREATE COURSE
// ============================================
const createCourse = async (req, res) => {
    try {
        const courseData = req.body;
        const course = await Course.create(courseData);
        
        await User.logActivity(
            req.userId,
            'admin',
            `Created course: ${courseData.title}`,
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
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to create course'
        });
    }
};

// ============================================
// ADMIN: UPDATE COURSE
// ============================================
const updateCourse = async (req, res) => {
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
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to update course'
        });
    }
};

// ============================================
// ADMIN: DELETE COURSE
// ============================================
const deleteCourse = async (req, res) => {
    try {
        const { id } = req.params;
        await Course.delete(id);
        
        await User.logActivity(
            req.userId,
            'admin',
            `Deleted course ID: ${id}`,
            req.ip,
            req.headers['user-agent']
        );

        res.status(200).json({
            success: true,
            message: 'Course deleted successfully'
        });
    } catch (error) {
        logger.error('❌ Delete course error:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to delete course'
        });
    }
};

module.exports = {
    getAllCourses,
    getCategories,
    getLevels,
    getInstructors,
    getFeaturedCourses,
    getCourseBySlug,
    getUserCourses,
    getCourseProgress,
    enrollInCourse,
    updateCourseProgress,
    getCourseStats,
    createCourse,
    updateCourse,
    deleteCourse
};