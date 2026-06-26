// src/services/mtnMomoService.js - DISABLED (Cash Only)
const logger = require('../utils/logger');

class MTNMoMoService {
    constructor() {
        this.enabled = false;
        logger.info('💳 MTN MoMo service DISABLED - Using cash payments only');
    }

    // ============================================
    // ALL METHODS DISABLED
    // ============================================
    async getAccessToken() {
        throw new Error('MTN MoMo service is disabled. Use cash payments.');
    }

    async requestToPay(phoneNumber, amount, transactionId, description) {
        throw new Error('MTN MoMo service is disabled. Use cash payments.');
    }

    async getTransactionStatus(transactionId) {
        throw new Error('MTN MoMo service is disabled. Use cash payments.');
    }

    async pollTransactionStatus(transactionId, maxAttempts = 30, interval = 3000) {
        throw new Error('MTN MoMo service is disabled. Use cash payments.');
    }

    async validateAccount(phoneNumber) {
        throw new Error('MTN MoMo service is disabled. Use cash payments.');
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new MTNMoMoService();