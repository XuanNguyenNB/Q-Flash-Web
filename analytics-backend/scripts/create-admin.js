/**
 * Script to create admin user
 * Usage: node scripts/create-admin.js <username> <password>
 */

import bcrypt from 'bcrypt';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '../analytics.db');

async function createAdmin() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log('Usage: node scripts/create-admin.js <username> <password>');
        console.log('Example: node scripts/create-admin.js admin mypassword123');
        process.exit(1);
    }

    const [username, password] = args;

    if (password.length < 6) {
        console.error('❌ Password must be at least 6 characters');
        process.exit(1);
    }

    try {
        const db = new Database(DB_PATH);

        // Check if user already exists
        const existing = db.prepare('SELECT id FROM admin_users WHERE username = ?').get(username);

        if (existing) {
            console.error(`❌ User "${username}" already exists`);
            process.exit(1);
        }

        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Insert user
        db.prepare(`
            INSERT INTO admin_users (username, password_hash)
            VALUES (?, ?)
        `).run(username, passwordHash);

        console.log('');
        console.log('✅ Admin user created successfully!');
        console.log('═══════════════════════════════════════');
        console.log(`   Username: ${username}`);
        console.log(`   Password: ${'*'.repeat(password.length)}`);
        console.log('═══════════════════════════════════════');
        console.log('');

        db.close();
    } catch (error) {
        console.error('❌ Error creating admin:', error.message);
        process.exit(1);
    }
}

createAdmin();
