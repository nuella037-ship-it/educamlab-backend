// scripts/test.js - API Test Script
const axios = require('axios');
const logger = require('../src/utils/logger');

const API_URL = process.env.API_URL || 'http://localhost:5000/api/v1';

async function runTests() {
    console.log('\n🧪 Running API Tests...\n');

    let passed = 0;
    let failed = 0;

    // Test 1: Health Check
    try {
        const response = await axios.get(`${API_URL.replace('/api/v1', '/api/health')}`);
        if (response.status === 200 && response.data.status === 'healthy') {
            console.log('✅ Health Check: PASSED');
            passed++;
        } else {
            console.log('❌ Health Check: FAILED');
            failed++;
        }
    } catch (error) {
        console.log('❌ Health Check: FAILED -', error.message);
        failed++;
    }

    // Test 2: Get Categories
    try {
        const response = await axios.get(`${API_URL}/courses/categories`);
        if (response.status === 200) {
            console.log('✅ Get Categories: PASSED');
            passed++;
        } else {
            console.log('❌ Get Categories: FAILED');
            failed++;
        }
    } catch (error) {
        console.log('❌ Get Categories: FAILED -', error.message);
        failed++;
    }

    // Test 3: Get Courses
    try {
        const response = await axios.get(`${API_URL}/courses`);
        if (response.status === 200) {
            console.log('✅ Get Courses: PASSED');
            passed++;
        } else {
            console.log('❌ Get Courses: FAILED');
            failed++;
        }
    } catch (error) {
        console.log('❌ Get Courses: FAILED -', error.message);
        failed++;
    }

    // Test 4: Contact Submit
    try {
        const response = await axios.post(`${API_URL}/contact`, {
            name: 'Test User',
            email: 'test@example.com',
            subject: 'Test Subject',
            message: 'This is a test message.'
        });
        if (response.status === 201) {
            console.log('✅ Contact Submit: PASSED');
            passed++;
        } else {
            console.log('❌ Contact Submit: FAILED');
            failed++;
        }
    } catch (error) {
        console.log('❌ Contact Submit: FAILED -', error.message);
        failed++;
    }

    console.log('\n📊 Test Results:');
    console.log('=' .repeat(40));
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Total:  ${passed + failed}`);
    console.log('=' .repeat(40));

    process.exit(failed > 0 ? 1 : 0);
}

runTests();