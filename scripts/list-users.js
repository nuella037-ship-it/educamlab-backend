// scripts/list-users.js
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function listUsers() {
    let connection;
    
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        // First, check if role column exists
        try {
            await connection.query('SELECT role FROM users LIMIT 1');
        } catch (error) {
            console.log('⚠️  Role column not found. Adding it now...');
            await connection.query('ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT "user"');
            console.log('✅ Role column added successfully\n');
        }

        console.log('📋 All Users:\n');
        console.log('ID | Email | Role | Verified | Created At');
        console.log('---|-------|------|----------|-----------');

        const [users] = await connection.query(
            `SELECT id, email, role, is_verified, created_at 
            FROM users 
            ORDER BY created_at DESC`
        );

        if (users.length === 0) {
            console.log('No users found');
        } else {
            users.forEach(u => {
                const role = u.role || 'user';
                const verified = u.is_verified ? '✅' : '❌';
                const date = u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A';
                console.log(`${u.id} | ${u.email} | ${role} | ${verified} | ${date}`);
            });
        }

        console.log(`\n📊 Total: ${users.length} users`);
        
        await connection.end();
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (connection) await connection.end();
        process.exit(1);
    }
}

listUsers();