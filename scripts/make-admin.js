// scripts/make-admin.js - Make User Admin with PIN
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');
const { generateSecurePin } = require('../src/utils/security');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function makeAdmin(identifier) {
    let connection;
    
    try {
        console.log(`🔍 Looking for user: ${identifier}`);
        
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        console.log('✅ Connected to database');

        // Check if role column exists
        try {
            await connection.query('SELECT role FROM users LIMIT 1');
        } catch (error) {
            console.log('⚠️ Role column not found. Adding it now...');
            await connection.query('ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT "user"');
            console.log('✅ Role column added successfully');
        }

        // Check if pin column exists
        try {
            await connection.query('SELECT pin FROM users LIMIT 1');
        } catch (error) {
            console.log('⚠️ Pin column not found. Adding it now...');
            await connection.query('ALTER TABLE users ADD COLUMN pin VARCHAR(255) NULL');
            console.log('✅ Pin column added successfully');
        }

        // Find user by email or phone
        const [users] = await connection.query(
            'SELECT id, email, phone, role FROM users WHERE email = ? OR phone = ?',
            [identifier, identifier]
        );

        if (users.length === 0) {
            console.log(`❌ User ${identifier} not found`);
            const [allUsers] = await connection.query(
                'SELECT id, email, phone, role FROM users LIMIT 10'
            );
            if (allUsers.length > 0) {
                console.log('\n📋 Available users:');
                allUsers.forEach(u => {
                    console.log(`   ${u.id}: ${u.email} (${u.phone || 'No phone'}) - Role: ${u.role || 'user'}`);
                });
            } else {
                console.log('\n📋 No users found. Please register first.');
                console.log('   Register at: POST /api/v1/auth/register');
            }
            await connection.end();
            process.exit(1);
        }

        const user = users[0];
        console.log(`✅ Found user: ${user.email} (ID: ${user.id}, Role: ${user.role || 'user'})`);

        // Update user role
        await connection.query(
            'UPDATE users SET role = "admin" WHERE id = ?',
            [user.id]
        );

        // Generate PIN if not exists
        const [pinCheck] = await connection.query(
            'SELECT pin FROM users WHERE id = ?',
            [user.id]
        );

        let pin = null;
        if (!pinCheck[0].pin) {
            pin = generateSecurePin(6);
            const salt = await bcrypt.genSalt(12);
            const hashedPin = await bcrypt.hash(pin, salt);
            await connection.query(
                'UPDATE users SET pin = ? WHERE id = ?',
                [hashedPin, user.id]
            );
        }

        const [updated] = await connection.query(
            'SELECT id, email, phone, role FROM users WHERE id = ?',
            [user.id]
        );

        console.log('\n✅ SUCCESS!');
        console.log(`📧 Email: ${updated[0].email}`);
        console.log(`📱 Phone: ${updated[0].phone}`);
        console.log(`🆔 User ID: ${updated[0].id}`);
        console.log(`👤 Role: ${updated[0].role}`);
        if (pin) {
            console.log(`🔑 Generated PIN: ${pin}`);
        } else {
            console.log(`🔑 User already has a PIN`);
        }
        console.log('\n🔐 You can now log in and access the admin dashboard!');
        
        await connection.end();
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (connection) await connection.end();
        process.exit(1);
    }
}

const identifier = process.argv[2];
if (!identifier) {
    console.log('📧 Usage: node scripts/make-admin.js <email-or-phone>');
    console.log('📧 Example: node scripts/make-admin.js admin@educamlab.com');
    console.log('📧 Example: node scripts/make-admin.js 677777777');
    process.exit(1);
}

makeAdmin(identifier);