// src/services/emailService.js - Complete Email Service with Templates
const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

class EmailService {
    constructor() {
        this.transporter = null;
        this.isConfigured = false;
        this.fromEmail = process.env.EMAIL_FROM || 'noreply@educamlab.com';
        this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        this.retryAttempts = 3;
        this.retryDelay = 2000;
        this.templateDir = path.join(__dirname, '../templates');
        this.initializeTransporter();
        this.ensureTemplateDirectory();
    }

    // ============================================
    // ENSURE TEMPLATE DIRECTORY EXISTS
    // ============================================
    ensureTemplateDirectory() {
        if (!fs.existsSync(this.templateDir)) {
            fs.mkdirSync(this.templateDir, { recursive: true });
            logger.info(`📁 Created template directory: ${this.templateDir}`);
        }
    }

    // ============================================
    // INITIALIZE TRANSPORTER
    // ============================================
    initializeTransporter() {
        const hasEmailHost = process.env.EMAIL_HOST && process.env.EMAIL_HOST.length > 0;
        const hasEmailUser = process.env.EMAIL_USER && process.env.EMAIL_USER.length > 0;
        const hasEmailPass = process.env.EMAIL_PASS && process.env.EMAIL_PASS.length > 0;
        
        const isPlaceholder = process.env.EMAIL_PASS && (
            process.env.EMAIL_PASS === 'your_app_password_here' ||
            process.env.EMAIL_PASS === 'your-16-char-app-password' ||
            process.env.EMAIL_PASS.includes('your_') ||
            process.env.EMAIL_PASS.includes('your-') ||
            process.env.EMAIL_PASS.includes('placeholder') ||
            process.env.EMAIL_PASS.includes('app_password') ||
            process.env.EMAIL_PASS.length < 8
        );

        const hasValidConfig = hasEmailHost && hasEmailUser && hasEmailPass && !isPlaceholder;

        if (!hasValidConfig) {
            logger.warn('⚠️ Email service not configured. Running in mock mode.');
            this.isConfigured = false;
            return;
        }

        try {
            const isGmail = process.env.EMAIL_HOST.includes('gmail') || 
                           process.env.EMAIL_HOST.includes('googlemail');

            const config = {
                host: process.env.EMAIL_HOST,
                port: parseInt(process.env.EMAIL_PORT) || 587,
                secure: process.env.EMAIL_PORT === '465',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                },
                family: 4,
                connectionTimeout: 30000,
                greetingTimeout: 30000,
                socketTimeout: 30000,
                tls: {
                    rejectUnauthorized: false,
                    minVersion: 'TLSv1.2'
                }
            };

            if (isGmail) {
                config.secure = false;
                config.requireTLS = true;
                config.tls = {
                    rejectUnauthorized: false,
                    minVersion: 'TLSv1.2',
                    ciphers: 'SSLv3'
                };
                config.pool = true;
                config.maxConnections = 5;
                config.maxMessages = 100;
            }

            this.transporter = nodemailer.createTransport(config);
            this.isConfigured = true;
            
            if (this.fromEmail === 'noreply@educamlab.com') {
                this.fromEmail = process.env.EMAIL_FROM || `EduCamLab <${process.env.EMAIL_USER}>`;
            }
            
            this.verifyConnectionAsync();
            
            logger.info(`✅ Email service configured with ${process.env.EMAIL_HOST}`);

        } catch (error) {
            logger.error('❌ Email configuration error:', error.message);
            this.isConfigured = false;
            this.transporter = null;
        }
    }

    // ============================================
    // VERIFY CONNECTION
    // ============================================
    async verifyConnectionAsync() {
        if (!this.transporter || !this.isConfigured) return;
        try {
            await this.transporter.verify();
            logger.info('✅ SMTP connection verified successfully');
        } catch (error) {
            logger.warn('⚠️ SMTP verification failed:', error.message);
        }
    }

    // ============================================
    // RENDER TEMPLATE
    // ============================================
    async renderTemplate(templateName, data) {
        try {
            const templatePath = path.join(this.templateDir, `${templateName}.ejs`);
            
            // Check if template exists
            if (!fs.existsSync(templatePath)) {
                logger.warn(`⚠️ Template not found: ${templatePath}`);
                return null;
            }

            const html = await ejs.renderFile(templatePath, {
                ...data,
                frontendUrl: this.frontendUrl,
                year: new Date().getFullYear(),
                appName: 'EduCamLab'
            });
            return html;
        } catch (error) {
            logger.error('❌ Template render error:', error.message);
            return null;
        }
    }

    // ============================================
    // SEND EMAIL
    // ============================================
    async sendEmail({ to, subject, template, data, text = null }) {
        if (!this.isConfigured || !this.transporter) {
            logger.info(`📧 EMAIL (MOCKED) - To: ${to}, Subject: ${subject}`);
            if (data) {
                logger.info(`📧 Data:`, JSON.stringify(data, null, 2));
            }
            return { success: true, mocked: true };
        }

        if (!to || !to.includes('@')) {
            logger.error('❌ Invalid email address:', to);
            return { success: false, error: 'Invalid email address' };
        }

        try {
            let html = null;
            if (template) {
                html = await this.renderTemplate(template, data);
                if (!html) {
                    // Fallback to text if template fails
                    text = text || `Message: ${JSON.stringify(data)}`;
                }
            }

            const mailOptions = {
                from: this.fromEmail,
                to: to,
                subject: subject,
                html: html || text,
                text: text || undefined,
                headers: {
                    'X-EduCamLab': 'email-service',
                    'X-Application': 'EduCamLab'
                }
            };

            let lastError = null;
            for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
                try {
                    const info = await this.transporter.sendMail(mailOptions);
                    logger.info(`✅ Email sent to ${to}: ${info.messageId}`);
                    return { 
                        success: true, 
                        messageId: info.messageId,
                        accepted: info.accepted || [to],
                        rejected: info.rejected || []
                    };
                } catch (error) {
                    lastError = error;
                    logger.warn(`⚠️ Attempt ${attempt}/${this.retryAttempts} failed: ${error.message}`);
                    if (attempt < this.retryAttempts) {
                        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
                    }
                }
            }

            throw lastError || new Error('All email attempts failed');

        } catch (error) {
            logger.error('❌ Email send error:', error.message);
            return { 
                success: false, 
                error: error.message,
                mocked: true,
                fallback: true
            };
        }
    }

    // ============================================
    // SPECIFIC EMAIL METHODS
    // ============================================

    async sendVerificationEmail(user, code) {
        const subject = '🔐 Verify Your EduCamLab Account';
        const data = {
            firstname: user.firstname || 'User',
            code: code,
            userId: user.id,
            email: user.email
        };

        return await this.sendEmail({
            to: user.email,
            subject,
            template: 'verification',
            data,
            text: `Your verification code is: ${code}. Enter this code to verify your account.`
        });
    }

    async sendPasswordResetEmail(user, resetToken) {
        const resetLink = `${this.frontendUrl}/reset-password.html?token=${resetToken}`;
        const subject = '🔑 Reset Your EduCamLab Password';
        const data = {
            firstname: user.firstname || 'User',
            resetLink: resetLink,
            email: user.email
        };

        return await this.sendEmail({
            to: user.email,
            subject,
            template: 'password-reset',
            data,
            text: `Click this link to reset your password: ${resetLink}`
        });
    }

    async sendWelcomeEmail(user) {
        const subject = '🎉 Welcome to EduCamLab! Start Learning Today';
        const data = {
            firstname: user.firstname || 'User',
            email: user.email
        };

        return await this.sendEmail({
            to: user.email,
            subject,
            template: 'welcome',
            data,
            text: 'Welcome to EduCamLab! Start preparing for your exams today.'
        });
    }

    async sendContactReply(contact, reply) {
        const subject = `📧 Re: ${contact.subject}`;
        const data = {
            name: contact.name || 'User',
            subject: contact.subject || 'Inquiry',
            reply: reply,
            email: contact.email
        };

        return await this.sendEmail({
            to: contact.email,
            subject,
            template: 'contact-reply',
            data,
            text: `Reply to your inquiry: ${reply}`
        });
    }

    async sendPaymentConfirmation(user, payment, pin, plan) {
        const expiresAt = new Date();
        const durations = { daily: 1, weekly: 7, monthly: 30, annual: 365 };
        const durationDays = durations[plan] || 30;
        expiresAt.setDate(expiresAt.getDate() + durationDays);

        const subject = '✅ Payment Confirmed - EduCamLab Subscription Active';
        const data = {
            firstname: user.firstname || 'User',
            plan: plan.charAt(0).toUpperCase() + plan.slice(1),
            amount: payment.amount || 0,
            transactionId: payment.transaction_id || 'N/A',
            pin: pin,
            expiresAt: expiresAt.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            }),
            durationDays: durationDays,
            email: user.email
        };

        return await this.sendEmail({
            to: user.email,
            subject,
            template: 'payment-confirmation',
            data,
            text: `Your ${plan} subscription is active. Your PIN is: ${pin}`
        });
    }

    async sendAdminNotification(contact) {
        const subject = '📬 New Contact Message - EduCamLab';
        const data = {
            name: contact.name,
            email: contact.email,
            subject: contact.subject,
            message: contact.message,
            adminUrl: `${this.frontendUrl}/admin/messages`
        };

        const adminEmail = process.env.EMAIL_TO || 'admin@educamlab.com';
        
        return await this.sendEmail({
            to: adminEmail,
            subject,
            template: 'admin-notification',
            data,
            text: `
New Contact Message
-------------------
Name: ${contact.name}
Email: ${contact.email}
Subject: ${contact.subject}
Message: ${contact.message}
View all messages: ${this.frontendUrl}/admin/messages
            `
        });
    }

    async sendTestEmail(to) {
        const subject = '🧪 EduCamLab Email Test';
        const data = {
            email: to,
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development'
        };

        return await this.sendEmail({
            to: to || process.env.EMAIL_USER || 'test@example.com',
            subject,
            template: 'test-email',
            data,
            text: `
This is a test email from EduCamLab.

If you received this, your email configuration is working correctly!

Timestamp: ${new Date().toISOString()}
Environment: ${process.env.NODE_ENV || 'development'}
            `
        });
    }

    // ============================================
    // GET STATUS
    // ============================================
    getStatus() {
        return {
            isConfigured: this.isConfigured,
            fromEmail: this.fromEmail,
            host: process.env.EMAIL_HOST || 'Not configured',
            port: process.env.EMAIL_PORT || 'Not configured',
            provider: this.detectProvider(),
            frontendUrl: this.frontendUrl,
            templateDir: this.templateDir,
            passwordLength: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0
        };
    }

    detectProvider() {
        if (!process.env.EMAIL_HOST) return 'Not configured';
        if (process.env.EMAIL_HOST.includes('gmail')) return 'Gmail';
        if (process.env.EMAIL_HOST.includes('sendgrid')) return 'SendGrid';
        if (process.env.EMAIL_HOST.includes('mailgun')) return 'Mailgun';
        if (process.env.EMAIL_HOST.includes('smtp')) return 'Custom SMTP';
        return 'Unknown';
    }
}

module.exports = new EmailService();