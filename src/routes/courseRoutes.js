// src/routes/courseRoutes.js - Complete Course Routes
const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const reviewController = require('../controllers/reviewController');
const { authenticate, requireSubscription, requireVerified } = require('../middleware/auth');
const { isAdmin } = require('../middleware/admin');
const { validate, validators } = require('../middleware/validation');

// ============================================
// PUBLIC ROUTES
// ============================================
router.get('/', courseController.getAllCourses);
router.get('/featured', courseController.getFeaturedCourses);
router.get('/categories', courseController.getCategories);
router.get('/levels', courseController.getLevels);
router.get('/instructors', courseController.getInstructors);
router.get('/stats', courseController.getCourseStats);
router.get('/:slug', courseController.getCourseBySlug);

// ============================================
// COURSE REVIEWS (Public)
// ============================================
router.get('/:courseId/reviews', reviewController.getCourseReviews);

// ============================================
// PROTECTED ROUTES (User)
// ============================================
router.get('/user/enrolled', authenticate, courseController.getUserCourses);
router.get('/user/progress/:courseId', authenticate, courseController.getCourseProgress);
router.post('/:courseId/enroll', authenticate, requireVerified, requireSubscription, courseController.enrollInCourse);
router.put('/:courseId/progress', authenticate, requireVerified, requireSubscription, courseController.updateCourseProgress);

// ============================================
// REVIEWS (Protected)
// ============================================
router.post('/:courseId/reviews', authenticate, validate(validators.review), reviewController.createReview);
router.put('/:courseId/reviews/:reviewId', authenticate, validate(validators.review), reviewController.updateReview);
router.delete('/:courseId/reviews/:reviewId', authenticate, reviewController.deleteReview);

// ============================================
// ADMIN ROUTES
// ============================================
router.post('/', authenticate, isAdmin, validate(validators.course), courseController.createCourse);
router.put('/:id', authenticate, isAdmin, validate(validators.course), courseController.updateCourse);
router.delete('/:id', authenticate, isAdmin, courseController.deleteCourse);

// ============================================
// ADMIN REVIEW ROUTES
// ============================================
router.delete('/reviews/:reviewId', authenticate, isAdmin, reviewController.deleteReviewAdmin);

module.exports = router;