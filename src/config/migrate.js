// src/config/migrate.js - Database Migration Runner
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

dotenv.config();

// ============================================
// MIGRATION RUNNER
// ============================================
const runMigration = async () => {
    let connection = null;
    
    try {
        logger.info('Starting database migration...');
        logger.info(`Database: ${process.env.DB_NAME}`);

        // Connect without database first
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            multipleStatements: true
        });

        // Create database if it doesn't exist
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`);
        await connection.query(`USE ${process.env.DB_NAME}`);
        logger.info(`Database '${process.env.DB_NAME}' ready`);

        // ============================================
        // RUN MAIN SCHEMA
        // ============================================
        const schemaPath = path.join(__dirname, '../../database/schema.sql');
        
        if (fs.existsSync(schemaPath)) {
            const sql = fs.readFileSync(schemaPath, 'utf8');
            const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);

            for (const stmt of statements) {
                try {
                    await connection.query(stmt);
                } catch (stmtError) {
                    // Skip duplicate table errors
                    if (stmtError.code === 'ER_TABLE_EXISTS_ERROR') {
                        logger.warn(`Skipping duplicate table: ${stmtError.message}`);
                        continue;
                    }
                    if (stmtError.message.includes('CHECK constraint')) {
                        logger.warn(`Skipping CHECK constraint: ${stmtError.message}`);
                        continue;
                    }
                    throw stmtError;
                }
            }
            logger.info('Schema executed successfully');
        } else {
            logger.warn('Schema file not found, skipping');
        }

        // ============================================
        // RUN MIGRATIONS
        // ============================================
        const migrationsDir = path.join(__dirname, '../../database/migrations');
        
        if (fs.existsSync(migrationsDir)) {
            const files = fs.readdirSync(migrationsDir).sort();
            
            for (const file of files) {
                if (file.endsWith('.sql')) {
                    try {
                        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
                        const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
                        
                        for (const stmt of statements) {
                            try {
                                await connection.query(stmt);
                            } catch (stmtError) {
                                if (stmtError.code === 'ER_TABLE_EXISTS_ERROR') {
                                    logger.warn(`Skipping duplicate table: ${stmtError.message}`);
                                    continue;
                                }
                                if (stmtError.message.includes('CHECK constraint')) {
                                    logger.warn(`Skipping CHECK constraint: ${stmtError.message}`);
                                    continue;
                                }
                                throw stmtError;
                            }
                        }
                        logger.info(`Migration ${file} completed`);
                    } catch (error) {
                        logger.error(`Migration ${file} failed: ${error.message}`);
                        throw error;
                    }
                }
            }
        }

        // ============================================
        // VERIFY TABLES
        // ============================================
        logger.info('\nVerifying table structure...');

        const tables = ['users', 'courses', 'enrollments', 'payments', 'course_reviews', 'contact_messages', 'user_activities', 'broadcasts', 'user_pins', 'settings'];
        for (const table of tables) {
            try {
                const [columns] = await connection.query(`SHOW COLUMNS FROM ${table}`);
                logger.info(`${table} table has ${columns.length} columns`);
            } catch (error) {
                logger.warn(`Could not verify ${table} table: ${error.message}`);
            }
        }

        logger.info('\nMigration completed successfully!');

    } catch (error) {
        logger.error(`Migration failed: ${error.message}`);
        if (error.stack) {
            logger.error(error.stack);
        }
        throw error;
    } finally {
        if (connection) {
            await connection.end();
        }
    }
};

// ============================================
// RUN MIGRATION
// ============================================
if (require.main === module) {
    runMigration()
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration failed:', error.message);
            process.exit(1);
        });
}

module.exports = runMigration;