// scripts/health.js - Health Check Script
const axios = require('axios');
const { pool } = require('../src/config/database');
const logger = require('../src/utils/logger');

const API_URL = process.env.API_URL || 'http://localhost:5000/api/health';

async function healthCheck() {
    let allHealthy = true;
    let status = {};

    console.log('\n🏥 Running Health Check...\n');

    // Check API
    try {
        const start = Date.now();
        const response = await axios.get(API_URL, { timeout: 5000 });
        const duration = Date.now() - start;
        
        if (response.status === 200 && response.data.status === 'healthy') {
            status.api = { status: 'healthy', duration: duration + 'ms' };
            console.log('✅ API: Healthy');
        } else {
            status.api = { status: 'unhealthy', response: response.data };
            allHealthy = false;
            console.log('❌ API: Unhealthy');
        }
    } catch (error) {
        status.api = { status: 'unhealthy', error: error.message };
        allHealthy = false;
        console.log('❌ API: Failed -', error.message);
    }

    // Check Database
    try {
        const start = Date.now();
        const connection = await pool.getConnection();
        await connection.query('SELECT 1');
        connection.release();
        const duration = Date.now() - start;
        
        status.database = { status: 'healthy', duration: duration + 'ms' };
        console.log('✅ Database: Healthy');
    } catch (error) {
        status.database = { status: 'unhealthy', error: error.message };
        allHealthy = false;
        console.log('❌ Database: Failed -', error.message);
    }

    // Check Disk Space
    try {
        const disk = require('diskusage');
        const usage = await disk.check('/');
        const percentUsed = ((usage.used / usage.total) * 100).toFixed(1);
        status.disk = { 
            status: percentUsed < 85 ? 'healthy' : 'warning', 
            used: (usage.used / (1024 * 1024 * 1024)).toFixed(1) + ' GB',
            total: (usage.total / (1024 * 1024 * 1024)).toFixed(1) + ' GB',
            percent: percentUsed + '%'
        };
        console.log(`✅ Disk: ${status.disk.used} / ${status.disk.total} (${status.disk.percent})`);
    } catch (error) {
        status.disk = { status: 'unknown', error: error.message };
        console.log('⚠️ Disk: Could not check');
    }

    // Output summary
    console.log('\n📊 Health Check Results:');
    console.log('=' .repeat(40));
    console.log(`API:       ${status.api.status}`);
    console.log(`Database:  ${status.database.status}`);
    console.log(`Disk:      ${status.disk.status}`);
    console.log('=' .repeat(40));
    console.log(`Overall:   ${allHealthy ? '✅ HEALTHY' : '❌ UNHEALTHY'}\n`);

    process.exit(allHealthy ? 0 : 1);
}

healthCheck();