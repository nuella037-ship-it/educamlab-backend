// src/routes/reviewRoutes.js
const express = require('express');
const router = express.Router({ mergeParams: true });
const reviewController = require('../controllers/reviewController');
const { authenticate } = require('../middleware/auth');
const { validate, validators } = require('../middleware/validation');

// Public routes
router.get('/', reviewController.getCourseReviews);

// Protected routes
router.post('/', authenticate, validate(validators.review), reviewController.createReview);
router.put('/:reviewId', authenticate, validate(validators.review), reviewController.updateReview);
router.delete('/:reviewId', authenticate, reviewController.deleteReview);

module.exports = router;