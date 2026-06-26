// scripts/backup.js - Automated Backup Script
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const logger = require('../src/utils/logger');

dotenv.config();

const backupPath = process.env.BACKUP_PATH || './backups';
const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS) || 30;

// Ensure backup directory exists
if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(backupPath, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(backupPath, `backup-${timestamp}.sql`);

// Database backup command
const command = `mysqldump -h ${process.env.DB_HOST} -P ${process.env.DB_PORT} -u ${process.env.DB_USER} -p${process.env.DB_PASSWORD} ${process.env.DB_NAME} > ${backupFile}`;

logger.info('📦 Starting database backup...');

exec(command, (error, stdout, stderr) => {
    if (error) {
        logger.error('❌ Backup failed:', error);
        process.exit(1);
    }

    // Compress backup
    const gzipCommand = `gzip ${backupFile}`;
    exec(gzipCommand, (gzipError) => {
        if (gzipError) {
            logger.error('❌ Compression failed:', gzipError);
            process.exit(1);
        }

        const compressedFile = `${backupFile}.gz`;
        const stats = fs.statSync(compressedFile);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

        logger.info(`✅ Backup created: ${compressedFile} (${sizeMB} MB)`);

        // Delete old backups
        const files = fs.readdirSync(backupPath);
        let deletedCount = 0;

        files.forEach(file => {
            const filePath = path.join(backupPath, file);
            const fileStats = fs.statSync(filePath);
            const age = (Date.now() - fileStats.mtimeMs) / (1000 * 60 * 60 * 24);
            
            if (age > retentionDays) {
                fs.unlinkSync(filePath);
                deletedCount++;
            }
        });

        if (deletedCount > 0) {
            logger.info(`🗑️ Deleted ${deletedCount} old backups`);
        }

        process.exit(0);
    });
});