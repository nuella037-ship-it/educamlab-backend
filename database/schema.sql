-- ============================================
-- EDU CAM LAB - FIXED DATABASE SCHEMA
-- ============================================

-- Create database
CREATE DATABASE IF NOT EXISTS educamlab;
USE educamlab;

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    firstname VARCHAR(50) NOT NULL,
    lastname VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    pin VARCHAR(255) NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_code VARCHAR(10) NULL,
    verification_code_expires DATETIME NULL,
    reset_token VARCHAR(255) NULL,
    reset_token_expires DATETIME NULL,
    subscription_type ENUM('daily', 'weekly', 'monthly', 'annual', 'none') DEFAULT 'none',
    subscription_expires DATETIME NULL,
    last_pin_generated_at DATETIME NULL,
    last_pin_used_at DATETIME NULL,
    pin_attempts INT DEFAULT 0,
    pin_locked_until DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_phone (phone),
    INDEX idx_role (role)
);

-- ============================================
-- COURSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS courses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(200) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    level ENUM('beginner', 'intermediate', 'advanced', 'all-levels') DEFAULT 'beginner',
    duration_weeks INT DEFAULT 8,
    instructor VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,
    is_published BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_level (level),
    INDEX idx_published (is_published)
);

-- ============================================
-- ENROLLMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS enrollments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    course_id INT NOT NULL,
    progress INT DEFAULT 0,
    status ENUM('active', 'completed', 'cancelled') DEFAULT 'active',
    enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,
    INDEX idx_user_course (user_id, course_id)
);

-- ============================================
-- PAYMENTS TABLE (Cash Only - No Foreign Key)
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'XAF',
    subscription_type ENUM('daily', 'weekly', 'monthly', 'annual') NOT NULL,
    transaction_id VARCHAR(100) UNIQUE NULL,
    status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
    pin VARCHAR(10) NULL,
    notes TEXT NULL,
    reference VARCHAR(100) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,
    INDEX idx_transaction (transaction_id),
    INDEX idx_status (status),
    INDEX idx_user (user_id)
);

-- ============================================
-- USER PINS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_pins (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    pin_code VARCHAR(10) NOT NULL,
    plan ENUM('daily', 'weekly', 'monthly', 'annual') NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at DATETIME NOT NULL,
    last_used DATETIME NULL,
    used_at DATETIME NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_by INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    revoked_at DATETIME NULL,
    UNIQUE KEY unique_active_pin (user_id, pin_code),
    INDEX idx_user_pin (user_id, pin_code),
    INDEX idx_active (is_active),
    INDEX idx_expires (expires_at)
);

-- ============================================
-- COURSE REVIEWS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS course_reviews (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    course_id INT NOT NULL,
    rating TINYINT NOT NULL,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_review (user_id, course_id),
    INDEX idx_course (course_id),
    INDEX idx_rating (rating),
    CHECK (rating >= 1 AND rating <= 5)
);

-- ============================================
-- CONTACT MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS contact_messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    status ENUM('new', 'read', 'replied') DEFAULT 'new',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    replied_at DATETIME NULL,
    INDEX idx_email (email),
    INDEX idx_status (status)
);

-- ============================================
-- USER ACTIVITIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_activities (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    description TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_type (activity_type),
    INDEX idx_created (created_at)
);

-- ============================================
-- BROADCASTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS broadcasts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    admin_id INT NOT NULL,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    channel VARCHAR(20) DEFAULT 'sms',
    recipients INT DEFAULT 0,
    status ENUM('draft', 'sent', 'failed', 'cancelled') DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME NULL,
    INDEX idx_admin (admin_id),
    INDEX idx_status (status),
    INDEX idx_created (created_at)
);

-- ============================================
-- SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    type VARCHAR(50) UNIQUE NOT NULL,
    settings JSON NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);