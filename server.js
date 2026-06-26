// server.js - Production Ready
const app = require('./src/app');
const { testConnection } = require('./src/config/database');
const logger = require('./src/utils/logger');
const cron = require('node-cron');
const { cleanupExpiredSessions, cleanupActivityLogs, cleanupPayments } = require('./src/utils/cleanup');

const PORT = process.env.PORT || 5000;

// ============================================
// GRACEFUL SHUTDOWN
// ============================================
const gracefulShutdown = async (signal) => {
    logger.info(`⚠️ Received ${signal}. Closing gracefully...`);
    
    // Close database connections
    try {
        const { pool } = require('./src/config/database');
        await pool.end();
        logger.info('✅ Database connections closed');
    } catch (error) {
        logger.error('❌ Error closing database:', error);
    }

    process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================
// UNHANDLED ERRORS
// ============================================
process.on('unhandledRejection', (error) => {
    logger.error('❌ Unhandled Rejection:', error);
    gracefulShutdown('unhandledRejection');
});

process.on('uncaughtException', (error) => {
    logger.error('❌ Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
});

// ============================================
// SCHEDULED TASKS
// ============================================
// Run cleanup daily at 2 AM
cron.schedule('0 2 * * *', async () => {
    logger.info('🔄 Running scheduled cleanup...');
    try {
        await cleanupExpiredSessions();
        await cleanupActivityLogs(90);
        await cleanupPayments(365);
        logger.info('✅ Scheduled cleanup completed');
    } catch (error) {
        logger.error('❌ Scheduled cleanup failed:', error);
    }
});

// ============================================
// START SERVER
// ============================================
const startServer = async () => {
    try {
        // Test database connection
        const dbConnected = await testConnection(5, 3000);
        if (!dbConnected) {
            logger.error('❌ Failed to connect to database. Server will not start.');
            process.exit(1);
        }

        // Start listening
        const server = app.listen(PORT, () => {
            logger.info(`🚀 Server running on port ${PORT}`);
            logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`🔗 API URL: http://localhost:${PORT}/api/v1`);
            logger.info(`📧 Email: ${process.env.EMAIL_ENABLED ? 'Enabled' : 'Disabled (Mock mode)'}`);
            logger.info(`💳 Payment Mode: Cash Only`);
        });

        // Handle server errors
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                logger.error(`❌ Port ${PORT} is already in use`);
                process.exit(1);
            }
            logger.error(`❌ Server error: ${error.message}`);
        });

        // Server timeout
        server.timeout = 120000; // 2 minutes
        server.keepAliveTimeout = 65000;

    } catch (error) {
        logger.error('❌ Server startup failed:', error);
        process.exit(1);
    }
};

startServer();