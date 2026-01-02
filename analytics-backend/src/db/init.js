/**
 * Database initialization script
 * Run this once to create the database and tables
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '../../analytics.db');

console.log('🗄️  Initializing database at:', DB_PATH);

try {
    const db = new Database(DB_PATH);

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Read and execute schema
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    db.exec(schema);

    console.log('✅ Database initialized successfully!');
    console.log('📊 Tables created:');

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    tables.forEach(t => console.log(`   - ${t.name}`));

    db.close();
} catch (error) {
    console.error('❌ Error initializing database:', error.message);
    process.exit(1);
}
