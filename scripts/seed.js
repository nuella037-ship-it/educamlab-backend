// scripts/seed.js - Complete Database Seeder with PIN Support
const { query } = require('../src/config/database');
const bcrypt = require('bcryptjs');
const logger = require('../src/utils/logger');
const { generateSecurePin } = require('../src/utils/security');

async function seedDatabase() {
    try {
        logger.info('🌱 Starting database seeding...');

        // ============================================
        // CREATE ADMIN USER
        // ============================================
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@educamlab.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
        const adminPhone = process.env.ADMIN_PHONE || '677777777';

        const [existing] = await query(
            'SELECT id FROM users WHERE email = ?',
            [adminEmail]
        );

        if (existing.length === 0) {
            const salt = await bcrypt.genSalt(12);
            const passwordHash = await bcrypt.hash(adminPassword, salt);
            const adminPin = generateSecurePin(6);
            const hashedPin = await bcrypt.hash(adminPin, salt);

            await query(
                `INSERT INTO users 
                (firstname, lastname, email, phone, password_hash, pin, role, is_verified) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                ['Admin', 'User', adminEmail, adminPhone, passwordHash, hashedPin, 'super_admin', true]
            );

            logger.info(`✅ Admin user created: ${adminEmail}`);
            logger.info(`🔑 Admin PIN: ${adminPin}`);
        } else {
            logger.info(`✅ Admin user already exists: ${adminEmail}`);
        }

        // ============================================
        // CREATE SAMPLE COURSES
        // ============================================
        const [courseCount] = await query(
            'SELECT COUNT(*) as count FROM courses'
        );

        if (courseCount[0].count === 0) {
            const sampleCourses = [
                {
                    title: 'Web Development Fundamentals',
                    slug: 'web-development-fundamentals',
                    description: 'Learn HTML, CSS, and JavaScript from scratch. Build real-world projects.',
                    category: 'technology',
                    level: 'beginner',
                    instructor: 'John Doe',
                    is_published: true,
                    is_featured: true,
                    price: 5000
                },
                {
                    title: 'Data Science Essentials',
                    slug: 'data-science-essentials',
                    description: 'Learn data analysis, visualization, and machine learning with Python.',
                    category: 'science',
                    level: 'intermediate',
                    instructor: 'Jane Smith',
                    is_published: true,
                    is_featured: true,
                    price: 7500
                },
                {
                    title: 'UI/UX Design Masterclass',
                    slug: 'ui-ux-design-masterclass',
                    description: 'Learn user-centered design principles, prototyping, and user testing.',
                    category: 'design',
                    level: 'all-levels',
                    instructor: 'Alice Johnson',
                    is_published: true,
                    is_featured: false,
                    price: 6000
                },
                {
                    title: 'Business Management 101',
                    slug: 'business-management-101',
                    description: 'Learn the fundamentals of business management, strategy, and leadership.',
                    category: 'business',
                    level: 'beginner',
                    instructor: 'Robert Chen',
                    is_published: true,
                    is_featured: false,
                    price: 4000
                },
                {
                    title: 'French Language for Beginners',
                    slug: 'french-language-beginners',
                    description: 'Learn French from scratch with interactive lessons and practice.',
                    category: 'language',
                    level: 'beginner',
                    instructor: 'Marie Dupont',
                    is_published: true,
                    is_featured: false,
                    price: 3500
                }
            ];

            for (const course of sampleCourses) {
                await query(
                    `INSERT INTO courses 
                    (title, slug, description, category, level, instructor, is_published, is_featured, price)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        course.title,
                        course.slug,
                        course.description,
                        course.category,
                        course.level,
                        course.instructor,
                        course.is_published ? 1 : 0,
                        course.is_featured ? 1 : 0,
                        course.price
                    ]
                );
            }

            logger.info(`✅ ${sampleCourses.length} sample courses created`);
        } else {
            logger.info(`✅ Courses already exist: ${courseCount[0].count}`);
        }

        // ============================================
        // CREATE DEFAULT SETTINGS
        // ============================================
        const [settingsCount] = await query(
            'SELECT COUNT(*) as count FROM settings'
        );

        if (settingsCount[0].count === 0) {
            const defaultSettings = [
                {
                    type: 'site',
                    settings: {
                        name: 'EduCamLab',
                        description: 'Learning Platform',
                        currency: 'XAF',
                        timezone: 'Africa/Douala'
                    }
                },
                {
                    type: 'pin',
                    settings: {
                        pinLength: 6,
                        pinExpiry: 30,
                        allowMultiple: false,
                        autoGenerate: false
                    }
                },
                {
                    type: 'sms',
                    settings: {
                        provider: 'africastalking',
                        enabled: false,
                        pinDelivery: true,
                        senderId: 'EduCamLab'
                    }
                },
                {
                    type: 'payment',
                    settings: {
                        methods: ['cash'],
                        defaultMethod: 'cash',
                        minAmount: 100,
                        maxAmount: 100000
                    }
                }
            ];

            for (const setting of defaultSettings) {
                await query(
                    'INSERT INTO settings (type, settings) VALUES (?, ?)',
                    [setting.type, JSON.stringify(setting.settings)]
                );
            }

            logger.info(`✅ Default settings created`);
        } else {
            logger.info(`✅ Settings already exist`);
        }

        logger.info('🎉 Database seeding completed successfully!');
        process.exit(0);

    } catch (error) {
        logger.error('❌ Seeding failed:', error.message);
        process.exit(1);
    }
}

seedDatabase();