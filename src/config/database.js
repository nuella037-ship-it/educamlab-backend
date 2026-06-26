// src/config/database.js - Production Ready
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const logger = require('../utils/logger');

dotenv.config();

// Connection pool configuration
const poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'educamlab',
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    timezone: '+01:00',
    charset: 'utf8mb4',
    connectTimeout: 30000,
    acquireTimeout: 30000,
    timeout: 30000,
    ...(process.env.NODE_ENV === 'production' && process.env.DB_SSL === 'true' ? {
        ssl: {
            rejectUnauthorized: false
        }
    } : {})
};

// Create pool
const pool = mysql.createPool(poolConfig);

// ============================================
// TEST CONNECTION WITH RETRY
// ============================================
const testConnection = async (retries = 5, delay = 2000) => {
    let lastError = null;
    for (let i = 0; i < retries; i++) {
        let connection = null;
        try {
            connection = await pool.getConnection();
            logger.info(`✅ Database connected successfully (attempt ${i + 1})`);
            connection.release();
            return true;
        } catch (error) {
            lastError = error;
            logger.warn(`⚠️ Database connection attempt ${i + 1} failed: ${error.message}`);
            if (connection) {
                try { connection.release(); } catch (e) {}
            }
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    logger.error(`❌ Database connection failed after ${retries} attempts: ${lastError?.message}`);
    return false;
};

// ============================================
// CONNECTION GETTER
// ============================================
const getConnection = async () => {
    try {
        return await pool.getConnection();
    } catch (error) {
        logger.error('❌ Failed to get database connection:', error);
        throw error;
    }
};

// ============================================
// QUERY EXECUTOR WITH LOGGING
// ============================================
const query = async (sql, params = []) => {
    const start = Date.now();
    try {
        const [rows, fields] = await pool.query(sql, params);
        const duration = Date.now() - start;
        if (duration > 1000) {
            logger.warn(`⚠️ Slow query (${duration}ms): ${sql.substring(0, 100)}...`);
        }
        return [rows, fields];
    } catch (error) {
        const duration = Date.now() - start;
        logger.error(`❌ Query failed (${duration}ms): ${error.message}`, { 
            sql: sql.substring(0, 200),
            params: JSON.stringify(params).substring(0, 100)
        });
        throw error;
    }
};

// ============================================
// TRANSACTION HELPERS
// ============================================
const beginTransaction = async () => {
    const connection = await getConnection();
    await connection.beginTransaction();
    return connection;
};

const commitTransaction = async (connection) => {
    await connection.commit();
    connection.release();
};

const rollbackTransaction = async (connection) => {
    await connection.rollback();
    connection.release();
};

const withTransaction = async (callback) => {
    const connection = await getConnection();
    try {
        await connection.beginTransaction();
        const result = await callback(connection);
        await connection.commit();
        connection.release();
        return result;
    } catch (error) {
        await connection.rollback();
        connection.release();
        throw error;
    }
};

// ============================================
// PING FOR KEEP-ALIVE
// ============================================
const ping = async () => {
    try {
        await pool.query('SELECT 1');
        return true;
    } catch (error) {
        logger.error('❌ Database ping failed:', error);
        return false;
    }
};

module.exports = {
    pool,
    testConnection,
    getConnection,
    query,
    beginTransaction,
    commitTransaction,
    rollbackTransaction,
    withTransaction,
    ping
};