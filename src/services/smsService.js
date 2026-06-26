// src/services/smsService.js - SMS Service for PIN Delivery
const axios = require('axios');
const logger = require('../utils/logger');

class SMSService {
    constructor() {
        this.provider = process.env.SMS_PROVIDER || 'africastalking';
        this.apiKey = process.env.SMS_API_KEY;
        this.senderId = process.env.SMS_SENDER_ID || 'EduCamLab';
        this.enabled = process.env.SMS_ENABLED === 'true';
        this.pinDelivery = process.env.SMS_PIN_DELIVERY === 'true';
        
        this.username = process.env.AT_USERNAME || 'sandbox';
        this.apiUrl = process.env.AT_API_URL || 'https://api.sandbox.africastalking.com/version1';
        
        logger.info(`📱 SMS Service: ${this.provider} (${this.enabled ? 'Enabled' : 'Disabled'})`);
    }

    // ============================================
    // SEND SINGLE SMS
    // ============================================
    async sendSms(phone, message) {
        if (!this.enabled) {
            logger.info(`📱 SMS (MOCKED): To ${phone} - ${message.substring(0, 30)}...`);
            return { success: true, mocked: true };
        }

        if (!phone || !message) {
            throw new Error('Phone number and message are required');
        }

        // Format phone number
        let formattedPhone = phone.replace(/\D/g, '');
        if (formattedPhone.length > 9) {
            formattedPhone = formattedPhone.slice(-9);
        }

        if (formattedPhone.length < 9) {
            throw new Error('Invalid phone number format');
        }

        try {
            const recipientsArray = [formattedPhone];
            const formattedRecipients = recipientsArray.map(p => {
                let phone = p.replace(/\D/g, '');
                if (phone.length > 9) phone = phone.slice(-9);
                return `237${phone}`;
            });

            const response = await axios.post(
                `${this.apiUrl}/messaging`,
                {
                    username: this.username,
                    to: formattedRecipients,
                    message: message,
                    from: this.senderId
                },
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'apiKey': this.apiKey
                    }
                }
            );

            const data = response.data;
            
            if (data.SMSMessageData) {
                const sentCount = data.SMSMessageData.Recipients?.length || 0;
                const failedCount = data.SMSMessageData.Recipients?.filter(r => r.status === 'Rejected').length || 0;
                
                logger.info(`📱 SMS sent: ${sentCount} sent, ${failedCount} failed to ${formattedPhone}`);
                
                return {
                    success: true,
                    sent: sentCount,
                    failed: failedCount,
                    response: data.SMSMessageData
                };
            }

            throw new Error('Unexpected response from SMS provider');

        } catch (error) {
            logger.error('❌ SMS API error:', error.response?.data || error.message);
            
            // Check for specific errors
            if (error.response?.data?.description) {
                throw new Error(error.response.data.description);
            }
            throw new Error(error.message || 'SMS API error');
        }
    }

    // ============================================
    // SEND BULK SMS
    // ============================================
    async sendBulkSms(recipients, message, senderId = null) {
        if (!this.enabled) {
            logger.info(`📱 Bulk SMS (MOCKED): ${recipients.length} recipients`);
            return { 
                success: true, 
                mocked: true, 
                sent: recipients.length,
                failed: 0
            };
        }

        if (!recipients || !recipients.length || !message) {
            throw new Error('Recipients and message are required');
        }

        // Format all phone numbers
        const formattedRecipients = recipients.map(p => {
            let phone = p.replace(/\D/g, '');
            if (phone.length > 9) phone = phone.slice(-9);
            return `237${phone}`;
        }).filter(p => p.length === 12);

        if (formattedRecipients.length === 0) {
            throw new Error('No valid phone numbers found');
        }

        try {
            const response = await axios.post(
                `${this.apiUrl}/messaging`,
                {
                    username: this.username,
                    to: formattedRecipients,
                    message: message,
                    from: senderId || this.senderId
                },
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'apiKey': this.apiKey
                    }
                }
            );

            const data = response.data;
            
            if (data.SMSMessageData) {
                const sentCount = data.SMSMessageData.Recipients?.length || 0;
                const failedCount = data.SMSMessageData.Recipients?.filter(r => r.status === 'Rejected').length || 0;
                
                logger.info(`📱 Bulk SMS: ${sentCount} sent, ${failedCount} failed`);
                
                return {
                    success: true,
                    sent: sentCount,
                    failed: failedCount,
                    total: formattedRecipients.length,
                    response: data.SMSMessageData
                };
            }

            throw new Error('Unexpected response from SMS provider');

        } catch (error) {
            logger.error('❌ Bulk SMS error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.description || error.message || 'Bulk SMS failed');
        }
    }

    // ============================================
    // SEND PIN VIA SMS
    // ============================================
    async sendPinSms(phone, pin) {
        const message = `🔐 Your EduCamLab PIN is: ${pin}. Use this to login to your account. Valid until expiration.`;
        return this.sendSms(phone, message);
    }

    // ============================================
    // GET STATS
    // ============================================
    async getStats() {
        return {
            provider: this.provider,
            enabled: this.enabled,
            senderId: this.senderId,
            pinDelivery: this.pinDelivery,
            status: this.enabled ? 'active' : 'inactive'
        };
    }
}

module.exports = new SMSService();